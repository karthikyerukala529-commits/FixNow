"""
FixNow AI Service — a separate Python microservice, kept independent from the
Node.js backend:

    React → Node.js/Express → Python FastAPI AI Service → AI Models

Run with:  uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from classifier import classify_frames, validate_and_estimate

app = FastAPI(title="FixNow AI Service", version="2.0")

# Only the Node backend calls this service directly (never the browser),
# but CORS is left open for local development convenience.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_IMAGE_BYTES = 8 * 1024 * 1024  # 8MB per frame


@app.get("/health")
def health():
    return {"success": True, "message": "FixNow AI service is running"}


@app.post("/analyze-problem")
async def analyze_problem(
    files: List[UploadFile] = File(...),
    selectedService: Optional[str] = Form(None),
    problemDescription: Optional[str] = Form(None),
):
    """
    Primary analysis endpoint.

    Accepts MULTIPLE frames sampled across the customer's video (not a single
    frame at t=0, which was frequently blank/black and produced nonsense
    predictions). Scores are averaged across frames, which is far more stable.

    `selectedService` is the category the CUSTOMER chose. It is used to
    validate relevance — the AI never silently overrides the customer's
    choice, it only reports whether the media appears to match.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No frames provided")

    frames = []
    for f in files:
        if not f.content_type or not f.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="Frames must be images")
        data = await f.read()
        if len(data) > MAX_IMAGE_BYTES:
            raise HTTPException(status_code=400, detail="Frame too large (max 8MB)")
        frames.append(data)

    try:
        scores = classify_frames(frames)
    except Exception as e:
        # Real error surfaces in the service log; the Node layer converts this
        # into a customer-friendly message rather than exposing internals.
        raise HTTPException(status_code=500, detail=f"Classification failed: {str(e)}")

    result = validate_and_estimate(
        scores,
        selected_service=selectedService,
        problem_description=problemDescription or "",
    )
    return {"success": True, **result}


@app.post("/classify-service")
async def classify_service(file: UploadFile = File(...)):
    """
    Legacy single-image endpoint, preserved so any existing caller keeps
    working. New code should use /analyze-problem.
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    image_bytes = await file.read()
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail="Image too large (max 8MB)")

    try:
        scores = classify_frames([image_bytes])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Classification failed: {str(e)}")

    top = max(scores, key=scores.get)
    return {
        "success": True,
        "predictedCategory": top,
        "confidence": scores[top],
        "allScores": scores,
    }
