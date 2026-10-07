# FixNow — On-Demand Home Services Platform (with AI Service Classification)

A full-stack MERN platform connecting customers to verified home-service technicians,
with three role-based portals (Customer / Technician / Admin), real-time Socket.IO
tracking, video-based dynamic quotation, and a Python AI microservice for zero-shot
image classification of the reported problem.

```
FixNow/
├── client/       React + Vite + Tailwind frontend
├── server/       Node + Express + MongoDB + Socket.IO backend
└── ai-service/   Python FastAPI microservice — CLIP-based image classification
```

---

## 1. Prerequisites

- **Node.js** 18+ and npm
- **MongoDB** running locally (`mongodb://127.0.0.1:27017`) — confirm with `mongosh`
- **Python** 3.9+ and pip (only needed for the AI service — everything else works without it)

---

## 2. Run the backend (Express + MongoDB + Socket.IO)

```
cd server
npm install
copy .env.example .env      (Windows)   |   cp .env.example .env   (Mac/Linux)
node utils/seed.js
npm run dev
```

`seed.js` creates:
- 12 service categories
- 5 demo technicians (phones `9000000001`–`9000000005`, password `tech1234`)
- 1 admin account (`admin@fixnow.com` / `admin123`)

You should see:
```
✅ MongoDB connected: fixnow
🚀 FixNow API + Socket.IO running on http://localhost:5000
```

---

## 3. Run the frontend (React)

In a **second terminal**:
```
cd client
npm install
npm run dev
```
Open **http://localhost:5173** — you'll land on the role-selection landing page.

---

## 4. Run the AI service (Python FastAPI — for the video classification feature)

In a **third terminal**:
```
cd ai-service
python -m venv venv
venv\Scripts\activate        (Windows)   |   source venv/bin/activate   (Mac/Linux)
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Note:** the first `pip install` downloads PyTorch and the CLIP model weights (~1–2GB combined) — this can take several minutes depending on your connection. The first classification request will also be slower (~10–20s) while the model loads into memory; every request after that is fast (~1–2s).

You should see:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
```
Visit `http://localhost:8000/health` to confirm — you should see `{"success":true,"message":"FixNow AI service is running"}`.

**The rest of the app works fully without this service running** — the AI suggestion button will just show a friendly "AI service is not running" message instead of breaking anything.

---

## 5. Full walkthrough

1. **Landing page** (`/`) → three role cards: "I need a service", "I'm a technician", "Admin"
2. **Customer** → Register tab → phone → OTP (printed in the server terminal) → name + password → account created
3. **Home** → pick a category (e.g. Electrician) → pick a technician → **Request Quote**
4. Upload/record a short video of the problem → tap **"Get AI category suggestion from this video"** (requires the AI service running) → see the predicted category and confidence score
5. Send the request. **Technician tab** (`/technician/login`, log in with `9000000001` / `tech1234`) → the job appears → **Watch customer's video** → enter a quote amount + note → **Send Quote**
6. **Customer, Bookings tab** → the quote appears → **Accept & Book**
7. **Technician** advances the job: Start heading over → Mark arrived → Start job → Mark completed — the customer's **Track live** screen updates in real time via Socket.IO
8. **Customer** → **Pay** on the completed booking (demo payment flow — works without real Razorpay keys)
9. **Admin** (`/admin/login`, `admin@fixnow.com` / `admin123`) → dashboard with revenue/booking analytics and a technician list — tap any technician to see their bio, experience, and categories, then Approve/Reject

---

## 6. About the AI Service Classification module

**Technique used:** zero-shot image classification via OpenAI's CLIP model
(`openai/clip-vit-base-patch32`, via Hugging Face Transformers).

**Why zero-shot instead of a trained CNN:** a supervised classifier (CNN, EfficientNet,
ViT) needs thousands of labeled photos per category (leaking pipes, broken wiring,
etc.), which this project does not have access to. CLIP was pretrained on 400M
image-text pairs and matches an image against plain-English category descriptions
with no task-specific training data — a legitimate, citable technique (Radford et
al., 2021), not a fabricated result.

**Documented limitation (state this in your report):** zero-shot accuracy is lower
than a properly fine-tuned supervised model trained on a real, home-service-specific
labeled dataset would achieve. This is an honest, scoped trade-off — not a claim of
production-grade accuracy — with fine-tuning on a real dataset listed as future work.

**How it works end-to-end:**
1. Customer uploads/records a video in the booking flow
2. The browser captures a single frame from that video onto an HTML5 `<canvas>`
3. That frame (as a JPEG) is sent to `POST /api/ai/classify-service` on the Node backend
4. Node proxies it to the Python FastAPI service at `POST /classify-service`
5. CLIP scores the image against all 12 category text prompts and returns a confidence-ranked list
6. The frontend shows the top prediction — the customer can accept the category they already picked, or switch based on the AI's suggestion. **The AI never force-changes the booking category.**

---

## 7. Architecture

```
   CUSTOMER / TECHNICIAN / ADMIN
              │
              ▼
       React Frontend (Vite)
              │
    REST API  │  Socket.IO
              ▼
      Node.js + Express
        │            │
        ▼            ▼
    MongoDB      Python FastAPI AI Service
   (Mongoose)      (CLIP zero-shot classifier)
```

---

## 8. What's implemented vs. scoped for future work

**Fully implemented and working:**
- JWT auth with OTP-verified registration + password login, for 3 independent roles
- Customer, Technician, Admin dashboards
- Video-assisted dynamic quotation (customer records video → technician quotes → customer accepts/declines)
- AI-based service classification (CLIP zero-shot)
- Real-time Socket.IO tracking (simulated GPS progress + live status)
- Demo/test-mode payment flow (Razorpay-shaped, works without live keys)
- Admin analytics dashboard + technician approval workflow

**Scoped as future work (documented, not fabricated):**
- Real Google Maps (currently a simulated animated map — same Socket.IO event shape)
- ML-based price estimation (needs real historical booking data to train on)
- ML-based technician recommendation scoring (spec recommends starting with transparent weighted scoring first — see Section 9)
- Review sentiment analysis (straightforward to add with a pretrained DistilBERT model — not yet wired in)
- Cloud storage for videos (currently base64-in-MongoDB for the demo; flagged for Cloudinary/S3 in production)

## 9. Troubleshooting

- **"Cannot GET /"** at `localhost:5000` → normal, there's no route at the bare root; use `/api/health` instead
- **`MONGO_URI` undefined error** → your `.env` file is missing; run `copy .env.example .env` inside `server/`
- **AI suggestion button shows an error** → the Python service isn't running; start it per Section 4
- **`ERR_MODULE_NOT_FOUND`** → you haven't run `npm install` in that folder yet

---

## Update ✅ — Real OTP Verification + 5 Technicians per Category + UI Polish

### 1. OTP is now actually enforced (was previously decorative)
Before, the OTP shown to the customer was never checked anywhere — a technician could mark a job "in progress" with a single tap. Now:
- The technician **cannot** move a job from "arrived" to "in progress" via the generic status button
- Instead, an OTP entry field appears on their dashboard once they mark "arrived"
- They must enter the exact 4-digit code the customer sees on their tracking screen
- The backend (`POST /api/booking/:id/verify-otp`) checks it server-side before allowing the status change — this is a real identity check, not just UI decoration

### 2. 5 technicians per category (60 total, up from 12)
Every service category now has 5 named technicians with distinct bios, experience levels, ratings, and prices — so the "browse technicians" screen actually has something to browse instead of showing one result. Re-seed to get them:
```
cd server
node utils/seed.js
```
Look for: `✅ Seeded 12 categories, 60 demo technicians (5 per category), and 1 admin account`
All seeded technicians share the password `tech1234`; phone `9000000001` is still Ravi Kumar (Electrician) for the existing demo instructions.

### 3. Interface polish
- Technician list (`ServiceDetail`) now has colorful gradient avatars, a "Top rated" badge, sort toggle (rating/price), staggered fade-in animation, and skeleton loading placeholders
- Technician Dashboard header now has a gradient background with a subtle glow effect and icon-labeled stat cards
- OTP entry appears as a distinct amber-highlighted card so it's visually clear it's a required security step, not an optional action

### Run it
```
cd server
npm install
node utils/seed.js
npm run dev
```
```
cd client
npm install
npm run dev
```

**Test the OTP fix specifically:**
1. Customer: book a technician, get a quote, accept it
2. Technician: Start heading over → Mark arrived
3. Notice there's **no** "Start job" button anymore — instead an amber OTP entry box appears
4. Try entering a wrong code — you should get "Incorrect OTP"
5. Switch to the customer's Live Tracking screen, read the real OTP, enter it correctly on the technician side → job starts

---

## Update ✅ — AI Accuracy Fix, Technician Recommendation, Price Estimate, Rapido-Style Commission, App-Like Polish

### 1. Fixed AI misclassification (fan photos were suggesting CCTV)
`ai-service/classifier.py` now uses **prompt ensembling**: 3 distinct, visually specific phrasings per category (e.g. explicitly naming "ceiling fan" and "wall fan" under electrician) are each embedded and averaged, instead of relying on one vague sentence per category. This is the same technique CLIP's own paper uses to stabilize zero-shot predictions — a legitimate accuracy improvement, not a fabricated fix.

### 2. AI now recommends technicians, not just a category
`GET /api/technician/category/:category` computes a transparent, weighted **match score** per technician:
- Rating — 45%
- Experience — 25%
- Completed jobs — 20%
- Proximity to the customer (when location is available) — 10%

Technicians are returned ranked by this score. The AI category-suggestion button in the booking flow now says **"See recommended [category] technicians"**, taking the customer straight to this ranked list — closing the loop between "AI thinks it's X" and "here are the best X technicians for you."

### 3. Cost estimate before requesting a technician
`ServiceDetail` now shows a banner at the top of every category page: **"Estimated cost: ₹X – ₹Y"** — computed from the real range of what currently active technicians in that category charge. This is explicitly labeled as an estimate, not a quote (a trained ML price-prediction model would need real historical booking data we don't have — documented as future work).

### 4. Combined pricing + Rapido-style commission
Previously the customer paid the technician's quote **plus** a separate ₹19 platform fee — two numbers, shown at different points, which was confusing. Now:
- The customer pays **exactly** what the technician quotes — one number, shown consistently everywhere, no add-on ever
- FixNow's cut (**15%**, same model as Rapido/Uber) is deducted from the **technician's payout** instead, calculated when the customer accepts the quote
- The technician's quote form shows a live preview: *"Customer pays ₹450 exactly. You'll receive ₹383 after FixNow's 15% fee."*
- The technician dashboard's earnings card shows their real take-home, plus a running total of commission paid
- The admin dashboard now shows both **Platform revenue** (FixNow's actual commission earned) and **Gross booking value** (total customer payments) as separate, honestly-labeled figures

### 5. App-like polish
- Installable **PWA manifest** + generated app icon — "Add to Home Screen" now works properly on mobile browsers
- Branded **splash screen** on first load (FixNow logo, fades out after ~0.9s)
- Smooth **slide/fade page transitions** between screens (Framer Motion `AnimatePresence`) instead of instant snaps — one of the biggest visual differences between a "website" and an "app"
- Tap feedback (`active:scale-90`) on the bottom navigation

### Run it
Re-seed isn't required for these changes (existing bookings will just use the old fare shape until a new quote is accepted — that's fine for a demo).
```
cd server
npm install
npm run dev
```
```
cd client
npm install
npm run dev
```
```
cd ai-service
venv\Scripts\activate
uvicorn main:app --reload --port 8000
```

**Test the fixes:**
1. **AI classification:** upload/record a video of a fan and run the AI suggestion — it should now correctly lean electrician, not CCTV
2. **Recommendation:** open any category — technicians show a "% match" bar and the top one gets a "Best match" badge
3. **Price estimate:** open any category page — see the "Estimated cost" banner before picking a technician
4. **Commission model:** as a technician, enter a quote amount and watch the "you'll receive ₹X after FixNow's 15% fee" line update live; as a customer, the quote you're asked to accept is the exact amount you pay, nothing added
5. **App feel:** reload the app and watch the splash screen; navigate between Home/Bookings/Profile and notice the slide transition

---

## Update ✅ — Inline Recommendations, Advance Booking, Messaging, Notifications

### 1. Recommended technicians + cost estimate now shown right under the AI confidence
Exactly as requested: after the AI classifies your video, the same card now shows (in order): the predicted category + confidence, an **estimated cost range** for that category, and the **top 3 recommended technicians** (ranked by match score) with a one-tap **Book Now** — no need to leave the screen or navigate elsewhere.

### 2. Advance booking (schedule for later)
On the booking screen, choose **"As soon as possible"** or **"Schedule for later"** — the latter reveals a date picker (can't pick a past date) and a time-slot selector (Morning / Afternoon / Evening / Night). Solves exactly the scenario you described: a plumbing issue reported on a weekday, serviced on the weekend. Scheduled bookings show a clear badge (`📅 Scheduled: 2026-08-30 · Evening`) on both the customer's and technician's booking lists.

### 3. Emergency / urgent service toggle
A toggle on ASAP bookings marks the request as urgent — shown as a 🚨 badge to both sides, and the technician gets a distinctly worded notification ("New urgent job request").

### 4. Real in-app messaging
A chat icon appears on any active or completed booking, opening a slide-up chat panel. Messages are persisted (`Message` model, scoped to the booking) and delivered instantly via Socket.IO to whoever else has that booking's chat open — with a background notification if they don't.

### 5. Smart notifications
A bell icon (customer's Bookings page, technician's dashboard header) shows unread count and a dropdown list. Notifications fire automatically for: new job request, quote received, quote accepted, technician arriving, job completed, and new chat messages — both persisted (so they're there next time you open the app) and pushed live over Socket.IO while the app is open.

### 6. Rebooking
Completed, paid bookings show a **"Book again"** shortcut that jumps straight back into the booking flow with the same technician and category pre-filled.

### Run it
```
cd server && npm install && npm run dev
cd client && npm install && npm run dev
cd ai-service && venv\Scripts\activate && uvicorn main:app --reload --port 8000
```

**Test the new flow:**
1. Customer: record/upload a video → tap "Get AI category suggestion" → see confidence, cost estimate, AND 3 recommended technicians in one card
2. Toggle "Schedule for later" → pick a weekend date + an evening slot → send request
3. Technician: quote it, customer accepts — then tap the chat icon on either side and exchange a message; watch it arrive instantly on the other screen without a refresh
4. Notice the notification bell badge update in real time when a quote/message arrives
5. After a booking is completed and paid, use "Book again" to instantly re-request the same technician

---

## Update ✅ — Analysis-First Flow, Real Cost Estimation, Relevant Matching, Payment After Completion

Nothing was rebuilt from scratch. Auth, Socket.IO tracking, Razorpay, chat, notifications, admin/technician dashboards, booking history and all 12 service categories are preserved. Changes are listed by file with the reason.

### Root causes found (Phase 2)
| Problem | Actual cause |
|---|---|
| Video never produced an estimate | AI service accepted **images only**; the client grabbed **one frame at `currentTime=0`**, which is usually blank/black → garbage prediction |
| Irrelevant technicians | Recommendations keyed off the *AI-predicted* category (so a misprediction cascaded), and `computeMatchScore` weighted **rating at 45% with no skill gate** |
| Technician chosen too early | Route was `/book/:technicianId` — a technician had to be picked before the video was ever uploaded |
| Cost estimate meaningless | It was just `min/max` of `baseCharge` per category — identical for every problem, ignoring the detected issue entirely |

### Files changed

**`ai-service/classifier.py`** — multi-frame score averaging + prompt ensembling; added `validate_and_estimate()` which reports category relevance (never overrides the customer's choice), detects severity from the customer's own wording, and derives a cost range from category base bands × severity multiplier.

**`ai-service/main.py`** — new `POST /analyze-problem` accepting multiple frames plus `selectedService` and `problemDescription`. Legacy `/classify-service` kept so nothing that already calls it breaks.

**`server/controllers/aiController.js`** — proxies multi-frame requests, adds a 60s timeout, and returns customer-safe messages ("We couldn't analyse this video…") while real errors go to the server log. No more raw "AI service returned an error" in the UI.

**`server/controllers/technicianController.js`** — **hard relevance filter**: only technicians carrying the requested category/skill are returned at all. Weights moved to env (`W_SERVICE_MATCH=45` vs `W_RATING=20`) so skill always outranks rating. Adds `distanceKm` and `etaMinutes` per technician.

**`server/models/Booking.js`** — added `aiAnalysis`, `estimatedCost`, `inspection`/`quote_sent`/`quote_accepted` statuses, quote breakdown (`labourCost`/`partsCost`/`finalProblem`), and a **`paymentStatus` state machine** (`pending → initiated → paid/failed/refunded`) separate from booking status. `paid` and `aiPrediction` retained for backward compatibility.

**`server/controllers/bookingController.js`** — technician is now **optional at creation** (chosen after analysis); `submitQuote` requires status `arrived`/`inspection` so the quote follows a real inspection; completing a job no longer credits the wallet; new `requestTechnician` endpoint.

**`server/controllers/paymentController.js`** — **payment is refused server-side unless `status === 'completed'`**. Real Razorpay order creation + **HMAC signature verification** when live keys exist (demo fallback otherwise). Technician wallet is credited on *payment*, not on completion.

**`client/src/pages/ProblemAnalysis.jsx`** *(new)* — the corrected flow in one screen: describe → upload → animated analysis steps → relevance check → estimate → recommended technicians → request. `captureFrames()` seeks to 25/50/75% of the video and waits for the `seeked` event before drawing, which is the direct fix for blank-frame misclassification.

**`client/src/App.jsx` / `Home.jsx` / `ServiceDetail.jsx`** — service tiles now route to `/analyze/:categorySlug`. `ServiceDetail` is preserved and still lists technicians; its CTA enters the analysis flow instead of booking technician-first.

**`client/src/pages/TechnicianDashboard.jsx`** — new stage order (arrive → inspect → quote → customer accepts → OTP → work → complete), quote form now takes labour/parts/diagnosis and shows the AI estimate for reference.

**`client/src/pages/BookingHistory.jsx`** — friendly status labels, estimate shown while pending, final quote shown against the earlier estimate, and payment gated on `completed` + `paymentStatus !== 'paid'`.

### Verified behaviour
- **Cost varies by problem** (test #32): fan noise → ₹360–600 · fan motor dead → ₹480–800 · fan cleaning → ₹260–420 · AC not cooling → ₹600–960 · plumbing leak → ₹510–800
- **Negative case** (test #30): fan-repair selected + unrelated video → mismatch warning with *Continue* / *Change Service*, category never auto-switched
- **Matching** (test #31): plumbers and carpenters are filtered out of an AC job entirely, regardless of rating

### Run
```
cd server && npm install && npm run dev
cd client && npm install && npm run dev
cd ai-service && venv\Scripts\activate && uvicorn main:app --reload --port 8000
```

### Fix — technician could not accept a requested job
The analysis-first flow made `requested` the technician's real starting state, but no accept/reject action existed for it, so a new job card rendered with no buttons.

- **`server/controllers/bookingController.js`** — added `respondToRequest` (`PATCH /api/booking/:id/respond`). Accepting moves the job to `accepted`; declining cancels it and notifies the customer to pick another technician. `'accepted'` added to `ALLOWED_STATUSES`.
- **`client/src/pages/TechnicianDashboard.jsx`** — new `AcceptRequest` card for `requested` jobs: watch the customer's video, see the AI estimate and detected problem, then **Accept Job** / **Decline**.

Full technician chain now has an action at every stage:
`requested` → Accept → `accepted` → Start heading over → `technician_arriving` → Mark arrived → `arrived` → Start inspection → `inspection` → Send Final Quote → `quote_sent` → *(customer accepts)* → `quote_accepted` → Verify OTP → `in_progress` → Mark completed → `completed` → *(customer pays)*

---

## v6 — Quote-after-video flow, secure OTP, tabbed technician/admin UIs, Urban-Company-style customer app

### The flow (exactly as requested)
```
Customer: pick service → describe + upload video → AI estimate → choose technician → request
Technician: sees request → WATCHES THE VIDEO → sends quote (labour + parts)
Customer: gets a notification → reviews quote → ACCEPTS      ← OTP is generated here
Customer: lands on live tracking, sees the OTP
Technician: Start heading over → I've arrived → enters the customer's OTP → work starts
Technician: Mark completed
Customer: reviews final amount → pays (Razorpay) ← payment happens only now
```
(This returns to quoting from the video, as you asked. The earlier "quote after arriving" order from the long spec is superseded.)

### Security problems found and fixed
| Problem | Fix |
|---|---|
| OTP was created at booking time and **returned to the technician's browser** in `/booking/technician/me` | OTP now exists only after the customer accepts; stored as a keyed HMAC hash; **stripped from every technician response** |
| Unlimited OTP guesses (10,000 possibilities) | 5 wrong attempts **lock** the code (HTTP 423); customer can generate a new one |
| `GET /booking/:id` had **no ownership check** — any customer could read any booking incl. its OTP | Customer must own it / technician must be assigned |
| `passwordHash` returned by the **public** technician list and admin list | `.select('-passwordHash')` everywhere |
| **Payment bypass:** in live mode, an order id starting `demo_order_` skipped signature checking | Live mode **always** requires a valid Razorpay signature; the order must exist for that booking and the job must be `completed` |
| `razorpay` missing from `package.json` (live mode would crash) | Added |
| Technician could jump `arrived → in_progress` or any stage via the status endpoint | Server-side state machine (`utils/bookingFlow.js`); OTP is the only way into `in_progress` |

### Tests (run `cd server && npm test`)
- `tests/flow.test.mjs` — state machine, OTP hashing/timing-safe compare, secret stripping
- `tests/controllers.test.mjs` — the **real** booking and payment controllers run against a stand-in model layer: quote → accept → OTP → arrival → lockout → regenerate → verify → complete → pay, including the live-mode bypass attempts (18 checks)

**Verified in a sandbox:** `vite build` (2,790 modules), every server module imports, both test files pass.
**NOT verified:** a full run against a real MongoDB (it couldn't be downloaded in my environment), the Razorpay Checkout window with live keys, and real map tiles. Run through the flow once on your machine.

### New / changed screens
- **Customer** — `Home.jsx` (search, tinted service grid, promo carousel, live booking cards, how-it-works, trust), 4-tab bottom nav (Home / Bookings / Alerts / Profile), `Notifications.jsx`, `BookingHistory.jsx` (quote card, OTP card, progress tracker, Active/Past filter, cancel, Razorpay), `LiveTracking.jsx` (OTP, technician card with call + chat)
- **Technician** — `TechnicianDashboard.jsx`: New / Active / Done tabs; each stage has its own panel (quote form with live "you earn ₹X" preview → waiting → start heading → arrived → **OTP panel with attempts + lockout** → complete → payment status)
- **Admin** — `AdminDashboard.jsx`: Overview (revenue, awaiting-payment, pending-approval alert, status + service charts, recent bookings), Technicians (search + filter + portfolio), Customers (spend + bookings), Bookings (payment state + commission split)
- `components/BookingProgress.jsx` — one tracker shared by all three roles

### Demo data — run `cd server && node utils/seed.js`
Seeding now **upserts** instead of deleting, so your own test accounts and bookings keep working.

| Role | Login | Password |
|---|---|---|
| Admin | admin@fixnow.com | admin123 |
| Technician | 9000000001 … 9000000060 (9000000001 = Ravi Kumar, Electrician) | tech1234 |
| Customer | 9800000001 … 9800000020 (9800000001 = Karthik Reddy) | cust1234 |

Plus 28 demo bookings (paid, unpaid, requested, quoted, cancelled) so the admin charts have data.

### Real maps and real payments → see `docs/GO_LIVE.md`
Step-by-step with code for Razorpay (test → live, plus a webhook), OpenStreetMap/Leaflet (free) and Google Maps, and a pre-launch hardening checklist.
