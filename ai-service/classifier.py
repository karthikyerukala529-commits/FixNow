"""
Zero-shot home-service problem classification using OpenAI's CLIP model,
plus category-relevance validation and dynamic cost estimation.

WHY ZERO-SHOT INSTEAD OF A TRAINED CNN/EfficientNet/ViT:
A supervised classifier needs thousands of labeled photos per category, which
this project does not have. Fabricating that dataset — or fabricating accuracy
numbers against one that doesn't exist — would be dishonest. CLIP (Radford et
al., OpenAI, 2021) was pretrained on 400M image-text pairs and matches an image
against plain-English descriptions with NO task-specific training data. This is
a citable, legitimate technique to report as zero-shot classification.

TWO ACCURACY MEASURES APPLIED HERE:
1. Prompt ensembling — several distinct phrasings per category are embedded and
   averaged before softmax (the same approach CLIP's own ImageNet evaluation
   uses). A single vague prompt is noisy and was a cause of misclassification.
2. Multi-frame averaging — scores are averaged across several frames sampled
   across the video, instead of trusting one frame (which was often the blank
   first frame of the clip, producing nonsense predictions).

LIMITATION TO STATE IN YOUR REPORT:
Zero-shot accuracy is still below a properly fine-tuned supervised model trained
on a real, home-service-specific labeled dataset. This is a documented trade-off
given the absence of that dataset, not a claim of production-grade accuracy.
Fine-tuning on a real labeled dataset is listed as future work.
"""

import io
import torch
from PIL import Image
from transformers import CLIPProcessor, CLIPModel

_model = None
_processor = None

CATEGORY_PROMPTS = {
    "electrician": [
        "a photo of a ceiling fan or wall fan that is broken, not spinning, or making noise",
        "a photo of exposed electrical wiring, a broken switch, or a sparking power outlet",
        "a photo of a non-working light fixture, tube light, or electrical panel problem",
    ],
    "plumber": [
        "a photo of a leaking water pipe or dripping tap",
        "a photo of a clogged drain, blocked sink, or overflowing toilet",
        "a photo of a broken bathroom or kitchen plumbing fixture",
    ],
    "ac-repair": [
        "a photo of a split or window air conditioner unit with water leaking from it",
        "a photo of an air conditioner that is not cooling or making unusual noise",
        "a photo of an air conditioner outdoor or indoor unit needing repair",
    ],
    "ro-repair": [
        "a photo of a water purifier or RO system leaking water",
        "a photo of an RO machine filter or membrane that needs replacement",
        "a photo of a malfunctioning water filtration unit under a kitchen sink",
    ],
    "carpenter": [
        "a photo of a broken wooden door, window frame, or hinge",
        "a photo of damaged or cracked wooden furniture such as a cabinet or table",
        "a photo of a wardrobe or cupboard with a carpentry repair needed",
    ],
    "painter": [
        "a photo of a wall with peeling, cracked, or damaged paint",
        "a photo of a stained or water-damaged wall or ceiling needing repainting",
        "a photo of exterior wall paint that is faded or chipped",
    ],
    "cctv": [
        "a photo of a CCTV security camera mounted on a wall being installed",
        "a photo of a security camera device with a lens, not a household appliance",
        "a photo of a video surveillance camera or DVR recording equipment",
    ],
    "washing-machine": [
        "a photo of a washing machine leaking water onto the floor",
        "a photo of a washing machine drum that is not spinning",
        "a photo of a front-load or top-load washing machine with a visible fault",
    ],
    "fridge": [
        "a photo of a refrigerator that is not cooling properly",
        "a photo of a refrigerator with a broken door seal or ice buildup",
        "a photo of a fridge leaking water or making unusual noise",
    ],
    "pest-control": [
        "a photo of cockroaches, ants, or termites inside a home",
        "a photo of a rodent or rat infestation in a house",
        "a photo of pest damage such as termite-eaten wood or an insect nest",
    ],
    "house-cleaning": [
        "a photo of a dirty, dusty, or messy room that needs deep cleaning",
        "a photo of a stained carpet, sofa, or floor needing professional cleaning",
        "a photo of an untidy kitchen or bathroom needing a deep clean",
    ],
    "appliance": [
        "a photo of a broken microwave, mixer, or small kitchen appliance",
        "a photo of a malfunctioning home appliance not related to AC, fridge, or washing machine",
        "a photo of a chimney, exhaust fan, or water heater that needs repair",
    ],
}

CATEGORY_LABELS = {
    "electrician": "Electrical / Fan Repair",
    "plumber": "Plumbing",
    "ac-repair": "AC Repair",
    "ro-repair": "RO / Water Purifier Repair",
    "carpenter": "Carpentry",
    "painter": "Painting",
    "cctv": "CCTV Installation",
    "washing-machine": "Washing Machine Repair",
    "fridge": "Refrigerator Repair",
    "pest-control": "Pest Control",
    "house-cleaning": "House Cleaning",
    "appliance": "Appliance Repair",
}

# Base labour bands per category (INR). These are the platform's own baseline
# pricing assumptions — the estimate is derived from these plus the detected
# severity, NOT a single hardcoded number for every problem.
CATEGORY_BASE_COST = {
    "electrician": (300, 500),
    "plumber": (350, 550),
    "ac-repair": (500, 800),
    "ro-repair": (400, 650),
    "carpenter": (400, 700),
    "painter": (600, 1200),
    "cctv": (700, 1200),
    "washing-machine": (450, 750),
    "fridge": (500, 900),
    "pest-control": (600, 1100),
    "house-cleaning": (500, 1000),
    "appliance": (350, 600),
}

# Keyword → (severity, multiplier, problem phrasing). The customer's own words
# carry real diagnostic signal that the image alone doesn't — "not working at
# all" implies a bigger job than "making noise" — so the text is used to adjust
# severity and therefore the estimated range.
SEVERITY_KEYWORDS = [
    (["not working", "dead", "completely stopped", "no power", "burnt", "burning", "smoke", "spark"],
     "high", 1.6, "complete failure / possible component burnout"),
    (["replace", "replacement", "broken", "damaged", "crack", "leak", "leaking", "motor"],
     "high", 1.45, "component damage requiring replacement"),
    (["not cooling", "no cooling", "not spinning", "stops", "stopped", "slow", "weak"],
     "medium", 1.2, "performance failure"),
    (["noise", "sound", "vibrat", "rattle", "click"],
     "medium", 1.1, "mechanical noise / wear"),
    (["clean", "service", "maintenance", "dust", "check"],
     "low", 0.85, "routine service / cleaning"),
]


def _load_model():
    """Lazy-loads CLIP once per process (first request downloads and caches
    the ~600MB model; every request after that is fast)."""
    global _model, _processor
    if _model is None:
        _model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
        _processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
        _model.eval()
    return _model, _processor


def classify_frames(frames: list) -> dict:
    """Averages CLIP scores across several frames sampled from the video."""
    model, processor = _load_model()

    labels = list(CATEGORY_PROMPTS.keys())
    all_prompts = [p for prompts in CATEGORY_PROMPTS.values() for p in prompts]
    per_cat = len(next(iter(CATEGORY_PROMPTS.values())))

    images = []
    for data in frames:
        try:
            images.append(Image.open(io.BytesIO(data)).convert("RGB"))
        except Exception:
            continue  # skip an unreadable frame rather than failing the whole request
    if not images:
        raise ValueError("No readable frames")

    with torch.no_grad():
        text_inputs = processor(text=all_prompts, return_tensors="pt", padding=True)
        text_features = model.get_text_features(**text_inputs)
        text_features = text_features / text_features.norm(dim=-1, keepdim=True)

        image_inputs = processor(images=images, return_tensors="pt")
        image_features = model.get_image_features(**image_inputs)
        image_features = image_features / image_features.norm(dim=-1, keepdim=True)

        # [num_frames, num_prompts] -> average over frames
        sims = image_features @ text_features.T
        sims = sims.mean(dim=0)

        # Prompt ensembling: average the prompts belonging to each category.
        cat_scores = torch.stack([sims[i * per_cat:(i + 1) * per_cat].mean() for i in range(len(labels))])
        probs = (cat_scores * model.logit_scale.exp()).softmax(dim=0)

    return {label: round(float(p) * 100, 1) for label, p in zip(labels, probs)}


def _detect_severity(text: str):
    t = (text or "").lower()
    for keywords, severity, multiplier, phrasing in SEVERITY_KEYWORDS:
        if any(k in t for k in keywords):
            return severity, multiplier, phrasing
    return "medium", 1.0, "general fault"


def validate_and_estimate(scores: dict, selected_service: str = None, problem_description: str = ""):
    """
    Compares the AI's view against the category the CUSTOMER selected, and
    produces a cost estimate driven by category + severity.

    Crucially, this NEVER overrides the customer's selection. It reports
    `isRelevant` and lets the UI ask the customer what they want to do.
    """
    sorted_scores = dict(sorted(scores.items(), key=lambda kv: kv[1], reverse=True))
    top_category = next(iter(sorted_scores))
    top_confidence = sorted_scores[top_category]

    # Relevance: the customer's chosen category is considered a match if the
    # AI ranks it first, or ranks it close behind the leader. CLIP's absolute
    # scores are noisy, so a strict "must be #1" rule would reject too much.
    is_relevant = True
    selected_score = None
    if selected_service and selected_service in scores:
        selected_score = scores[selected_service]
        ranked = list(sorted_scores.keys())
        rank = ranked.index(selected_service)
        is_relevant = rank == 0 or selected_score >= (top_confidence * 0.55)

    # Cost is always estimated for the category the CUSTOMER selected (falling
    # back to the AI's guess only if they didn't select one) — the estimate
    # should describe the job they're actually booking.
    cost_category = selected_service if selected_service in CATEGORY_BASE_COST else top_category
    base_min, base_max = CATEGORY_BASE_COST.get(cost_category, (400, 700))

    severity, multiplier, phrasing = _detect_severity(problem_description)
    est_min = int(round(base_min * multiplier / 10.0) * 10)
    est_max = int(round(base_max * multiplier / 10.0) * 10)

    detected_label = CATEGORY_LABELS.get(top_category, top_category)
    detected_problem = f"{CATEGORY_LABELS.get(cost_category, cost_category)} — {phrasing}"

    return {
        "selectedService": selected_service,
        "selectedServiceLabel": CATEGORY_LABELS.get(selected_service, selected_service),
        "isRelevant": is_relevant,
        "predictedCategory": top_category,
        "predictedCategoryLabel": detected_label,
        "confidence": top_confidence,
        "selectedServiceScore": selected_score,
        "detectedProblem": detected_problem,
        "severity": severity,
        "requiredSkills": [cost_category],
        "estimatedCost": {"min": est_min, "max": est_max, "currency": "INR"},
        "allScores": sorted_scores,
    }
