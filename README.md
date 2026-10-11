# FixNow — Smart On-Demand Home Services

> Book a verified technician in minutes: describe the problem, upload a video, get an AI cost estimate, choose a relevant technician, approve their quote, track them live, verify them with a private OTP, and **pay only after the work is done**.

**Version 6** · MERN stack + Socket.IO + a Python AI microservice · Three role-based apps (Customer · Technician · Admin)

---

## Table of contents

1. [What FixNow does](#1-what-fixnow-does)
2. [The booking lifecycle](#2-the-booking-lifecycle)
3. [Architecture & tech stack](#3-architecture--tech-stack)
4. [Project structure](#4-project-structure)
5. [Prerequisites](#5-prerequisites)
6. [Quick start](#6-quick-start)
7. [Environment variables](#7-environment-variables)
8. [Demo accounts & seed data](#8-demo-accounts--seed-data)
9. [Guided walkthrough](#9-guided-walkthrough)
10. [How the AI works (and what it does not do)](#10-how-the-ai-works-and-what-it-does-not-do)
11. [Technician matching](#11-technician-matching)
12. [Pricing, commission & payments](#12-pricing-commission--payments)
13. [OTP verification & security](#13-otp-verification--security)
14. [API reference](#14-api-reference)
15. [Real-time events (Socket.IO)](#15-real-time-events-socketio)
16. [Data model](#16-data-model)
17. [Tests & verification status](#17-tests--verification-status)
18. [Troubleshooting](#18-troubleshooting)
19. [Known limitations](#19-known-limitations)
20. [Going live & roadmap](#20-going-live--roadmap)
21. [Notes for your project report](#21-notes-for-your-project-report)
22. [Version history](#22-version-history)

---

## 1. What FixNow does

### Customer
- Register once (phone + OTP + password), then log in with phone and password
- Browse **12 service categories** — Electrician, Plumber, AC Repair, RO Repair, Carpenter, Painter, CCTV, Washing Machine, Refrigerator, Pest Control, House Cleaning, Appliance Repair
- Describe the problem and **upload a short video** → AI analysis → **estimated cost range**
- The AI **validates the video against the service you chose** and warns on a mismatch — it never switches your service for you
- See **only relevant technicians**, ranked by a transparent match score
- Book **as soon as possible** or **schedule for later** (date + Morning/Afternoon/Evening/Night), with an **Urgent** option
- Receive the technician's **quote**, accept or decline it
- Get a private **4-digit OTP** and **track the technician live**
- **In-app chat** with the technician, call button, notifications (bell + Alerts tab)
- **Pay after completion** through Razorpay; cancel before work starts; book the same service again

### Technician
- Register with services, experience and bio (admin approves before you appear to customers)
- Online / Offline toggle; **New · Active · Done** job tabs
- **Watch the customer's video**, see the AI estimate, send a **quote** (labour + parts) with a live preview of what you earn after the platform fee
- Start heading over → arrived → **enter the customer's OTP** → do the work → mark completed
- Chat, call, notifications, earnings and wallet (credited when the customer pays)

### Admin
- **Overview:** platform revenue, gross booking value, awaiting-payment total, pending-approval alert, bookings-by-status and most-requested-services charts, recent bookings
- **Technicians:** search, filter (all / pending / approved / rejected), expand portfolio, approve or reject
- **Customers:** list with booking count and amount spent
- **Bookings:** latest 150 with payment state and the commission split

---

## 2. The booking lifecycle

```
CUSTOMER   pick service → describe + upload video → AI analysis → estimate → choose technician → request
TECHNICIAN                      watches video → sends QUOTE
CUSTOMER                        reviews quote → ACCEPTS ──► OTP is generated here
CUSTOMER                        sees live tracking + OTP
TECHNICIAN  Start heading over → I've arrived → enters customer's OTP → work starts → Mark completed
CUSTOMER                        reviews final amount → PAYS  ◄── payment happens only now
```

### Booking status (server-enforced state machine)

| Status | Meaning | Who moves it forward |
|---|---|---|
| `requested` | Technician assigned, reviewing the video | Technician sends a quote |
| `quote_sent` | Quote waiting for the customer | Customer accepts / declines |
| `quote_accepted` | Confirmed — **OTP now exists** | Technician: *Start heading over* |
| `technician_arriving` | On the way | Technician: *I've arrived* |
| `arrived` | At the address | Technician enters the **OTP** (the only way forward) |
| `in_progress` | Work under way | Technician: *Mark completed* |
| `completed` | Work done — **not yet paid** | Customer pays |
| `cancelled` | Declined / cancelled | — |

`accepted` and `inspection` exist in the enum only for older records; the current flow does not use them. Jobs left in `accepted` by a previous version can still be quoted.

### Payment status (separate from booking status)

`pending → initiated → paid` (or `failed`, `refunded`). **A completed booking is not a paid booking.**

---

## 3. Architecture & tech stack

```
┌────────────────────────┐     REST + Socket.IO     ┌──────────────────────────┐
│  React 18 (Vite)       │ ───────────────────────► │  Node.js + Express       │
│  Customer / Tech / Admin│ ◄─────────────────────── │  JWT · bcrypt · rate limit│
└────────────────────────┘                          └───────┬──────────┬───────┘
        :5173                                         :5000 │          │ HTTP (multipart)
                                                            ▼          ▼
                                                    ┌──────────┐  ┌────────────────────┐
                                                    │ MongoDB  │  │ Python FastAPI     │
                                                    │ Mongoose │  │ CLIP (zero-shot)   │
                                                    └──────────┘  └────────────────────┘
                                                                          :8000
```

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, React Router, Axios, Framer Motion, Recharts, lucide-react, socket.io-client |
| Backend | Node.js (ESM), Express, Mongoose, JWT, bcryptjs, express-rate-limit, multer, Socket.IO, razorpay |
| Database | MongoDB (local) |
| AI | Python, FastAPI, Hugging Face Transformers, PyTorch, OpenAI **CLIP** (`openai/clip-vit-base-patch32`) |
| Payments | Razorpay (demo mode without keys) |
| PWA | `manifest.json` + generated app icons (installable on a phone's home screen) |

The AI runs as a **separate service** so Node never loads a model; the Node layer proxies requests, enforces a timeout, and converts failures into customer-friendly messages.

---

## 4. Project structure

```
FixNow/
├── README.md
├── docs/
│   └── GO_LIVE.md                 # real maps + real Razorpay, with code
├── client/                        # React app  (http://localhost:5173)
│   ├── public/manifest.json
│   └── src/
│       ├── App.jsx                # routes + splash screen
│       ├── layouts/CustomerLayout.jsx      # 4-tab bottom nav
│       ├── pages/
│       │   ├── Landing.jsx, Login.jsx, TechnicianLogin.jsx, AdminLogin.jsx
│       │   ├── Home.jsx                    # search, services, promos, live bookings
│       │   ├── ProblemAnalysis.jsx         # describe → upload → analyse → estimate → technicians
│       │   ├── BookingHistory.jsx          # quote card, OTP card, progress, pay
│       │   ├── LiveTracking.jsx            # map, OTP, technician card
│       │   ├── Notifications.jsx, Profile.jsx
│       │   ├── TechnicianDashboard.jsx     # New / Active / Done + stage panels
│       │   ├── AdminDashboard.jsx          # Overview / Technicians / Customers / Bookings
│       │   ├── ServiceDetail.jsx, BookingFlow.jsx   # legacy technician-first screens (see §19)
│       ├── components/ BookingProgress, ChatModal, NotificationBell, ProtectedRoute, ToolsBackdrop
│       ├── context/    AuthContext, TechnicianAuthContext, AdminAuthContext   # 3 independent sessions
│       └── services/   api.js (3 axios instances), socket.js
├── server/                        # Express API (http://localhost:5000)
│   ├── server.js
│   ├── config/db.js
│   ├── models/        User, Technician, Booking, Payment, Category, Admin, OtpLog, Message, Notification
│   ├── controllers/   auth, booking, technician, payment, ai, admin, adminAuth, category, message, notification
│   ├── routes/        one file per controller group
│   ├── middleware/    auth.js (JWT + role check), rateLimiter.js
│   ├── socket/index.js
│   ├── utils/         bookingFlow.js (state machine + OTP guard), notify.js, otp.js, generateToken.js, seed.js
│   └── tests/         flow.test.mjs, controllers.test.mjs
└── ai-service/                    # FastAPI (http://localhost:8000)
    ├── main.py                    # /analyze-problem, /classify-service, /health
    ├── classifier.py              # CLIP scoring, relevance check, severity, cost estimate
    └── requirements.txt
```

---

## 5. Prerequisites

| Tool | Version | Needed for |
|---|---|---|
| Node.js | 18 or newer (22 works) | server + client |
| MongoDB | running locally on `127.0.0.1:27017` | database (test with `mongosh`) |
| Python | **3.11 or 3.12** | AI service only |

> ⚠️ **Do not use a very new Python (3.13/3.14) for the AI service.** PyTorch/NumPy ship no ready-made packages for it and `pip` will try to compile them and fail. Use 3.11 (on Windows: `py -3.11`).

The AI service is **optional**: without it everything else works, but the video-analysis step will show a friendly "couldn't analyse" message with a *Describe Manually* option.

---

## 6. Quick start

Open **three terminals** from the project root and keep them all running.

### Terminal 1 — Backend
```bash
cd server
npm install
copy .env.example .env        # Windows        (Mac/Linux: cp .env.example .env)
node utils/seed.js            # demo categories, technicians, customers, bookings
npm run dev
```
Expected:
```
✅ MongoDB connected: fixnow
🚀 FixNow API + Socket.IO running on http://localhost:5000
```
Health check: <http://localhost:5000/api/health>

### Terminal 2 — Frontend
```bash
cd client
npm install
npm run dev
```
Open **<http://localhost:5173>**.

### Terminal 3 — AI service (optional but recommended)
```bash
cd ai-service
py -3.11 -m venv venv                                  # Mac/Linux: python3.11 -m venv venv
venv\Scripts\activate                                  # Mac/Linux: source venv/bin/activate
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
Expected: `Uvicorn running on http://127.0.0.1:8000` · Health: <http://localhost:8000/health>

The **first** analysis downloads the CLIP model (~600 MB) and takes 10–30 s; later ones take a couple of seconds.

### Every time after that
Just `npm run dev` in `server/` and `client/`, and `venv\Scripts\activate` + `uvicorn main:app --reload --port 8000` in `ai-service/`. `.env`, `npm install`, `pip install` and the seed are one-time (re-run the seed any time you want to reset the demo data).

> **Tip — new folder each time?** `.env` and `node_modules` are not in the zip. If you extract into a new folder you must recreate `.env` and run `npm install` again. Extract over the same folder to keep them.

---

## 7. Environment variables

**`server/.env`** (copy from `.env.example`)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `5000` | API port |
| `NODE_ENV` | `development` | |
| `MONGO_URI` | `mongodb://127.0.0.1:27017/fixnow` | **Required** — the server exits if missing |
| `JWT_SECRET` | dev placeholder | Signs login tokens **and** keys the OTP hash. **Change it** for anything real |
| `JWT_EXPIRES_IN` | `7d` | Token lifetime |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | empty | Empty ⇒ **demo payments**. Set both ⇒ real Razorpay (see `docs/GO_LIVE.md`) |
| `AI_SERVICE_URL` | `http://localhost:8000` | Where Node reaches the AI service |
| `AI_TIMEOUT_MS` | `60000` | Abort an analysis that takes too long |
| `W_SERVICE_MATCH` `W_RATING` `W_EXPERIENCE` `W_JOBS` `W_PROXIMITY` `W_AVAILABILITY` | `45 / 20 / 12 / 10 / 8 / 5` | Technician-matching weights (see §11) |
| `PLATFORM_COMMISSION_RATE` | `0.15` | Platform's cut of each job. ⚠️ The technician screen's earnings preview is hardcoded to 15% — if you change this, also change `COMMISSION` in `TechnicianDashboard.jsx` |
| `CLIENT_URL` | `http://localhost:5173` | Documented but **not currently read** — CORS origin is hardcoded (see §19) |

**`ai-service/.env.example`** contains `AI_SERVICE_PORT=8000`, but the code does not read it — set the port with `uvicorn … --port`.

**Client:** there is no client `.env`. The API base URL (`http://localhost:5000/api`) is hardcoded in `client/src/services/api.js` and `socket.js` — change those when deploying.

---

## 8. Demo accounts & seed data

`node utils/seed.js` **upserts** (it never deletes your own test accounts or bookings) and creates:

| Role | Login | Password |
|---|---|---|
| **Admin** | `admin@fixnow.com` | `admin123` |
| **Technicians** (60 — 5 per category) | `9000000001` … `9000000060` | `tech1234` |
| **Customers** (20) | `9800000001` … `9800000020` | `cust1234` |

Useful ones: `9000000001` = Ravi Kumar (Electrician) · `9800000001` = Karthik Reddy (customer).

Technicians are numbered by category in order: 01–05 Electrician, 06–10 Plumber, 11–15 AC Repair, 16–20 RO Repair, 21–25 Carpenter, 26–30 Painter, 31–35 CCTV, 36–40 Washing Machine, 41–45 Refrigerator, 46–50 Pest Control, 51–55 House Cleaning, 56–60 Appliance.

Also seeded: **28 demo bookings** (16 completed & paid, 3 completed & unpaid, 3 requested, 3 quoted, 3 cancelled) so the admin charts have data. Demo bookings are flagged `isDemo`, and a re-seed replaces only those.

> New technicians who register start as **pending** and do not appear to customers until an admin approves them.

---

## 9. Guided walkthrough

The three roles use separate login sessions, so you can be all three at once — e.g. customer in a normal window, technician in a private/incognito window, admin in another tab.

1. **Customer** — open `/`, choose *I need a service*, log in as `9800000001` / `cust1234`.
2. Tap **Electrician**. Type *"Fan is making noise and sometimes stops."*, upload a short video, tap **Analyse Problem**.
3. Watch the analysis steps → **Problem Detected**, **confidence**, and **Estimated Service Cost**.
4. Pick **Ravi Kumar** → **Request Technician**.
5. **Technician** — log in at `/technician/login` as `9000000001` / `tech1234`. Open **New**, **Watch customer's video**, enter Labour and Parts, **Send quote to customer**.
6. **Customer** — a notification arrives. Open **Bookings** → **Accept & Confirm**. You land on live tracking with your **OTP**.
7. **Technician** — **Active** tab → **Start heading over**. Watch the marker move on the customer's screen. Then **I've arrived**.
8. **Technician** — type the customer's OTP → **Verify & start work**. Try a wrong code first to see the attempt limit.
9. **Technician** — **Mark work as completed**.
10. **Customer** — **Bookings** → **Pay**. (Demo mode completes instantly; with Razorpay keys the real window opens.)
11. **Admin** — log in at `/admin/login`: revenue, charts, the booking and its commission split.

**Negative test:** choose *Electrician* but upload an unrelated video (e.g. a CCTV camera) → you get a **mismatch warning** with *Change Service* / *Continue*, and your category is never auto-changed.

---

## 10. How the AI works (and what it does not do)

**Pipeline:** the browser seeks to **25 %, 50 % and 75 %** of the video, grabs three frames (waiting for each `seeked` event so real pixels are drawn), and sends them with your selected service and description to `POST /api/ai/analyze-problem`. Node forwards them to the FastAPI service, which returns a structured result.

**Why three frames:** the first frame of a clip is very often blank or black. Scoring just that frame produced nonsense (a fan video reading as CCTV). Scores are now averaged across frames.

**Classifier:** zero-shot **CLIP** (Radford et al., OpenAI, 2021). Each service has three descriptive text prompts ("a photo of a ceiling fan that is broken…"); their embeddings are averaged (**prompt ensembling**) and compared with each frame. No training data is needed.

**Relevance check:** the customer's chosen service is "relevant" if CLIP ranks it first, or scores it at least **55 %** of the top category. Otherwise the UI shows a mismatch warning. It reports — it never overrides.

**Response shape**
```json
{
  "success": true,
  "selectedService": "electrician",
  "isRelevant": true,
  "predictedCategory": "electrician",
  "confidence": 71.4,
  "detectedProblem": "Electrical / Fan Repair — mechanical noise / wear",
  "severity": "medium",
  "requiredSkills": ["electrician"],
  "estimatedCost": { "min": 360, "max": 600, "currency": "INR" },
  "allScores": { "electrician": 71.4, "cctv": 9.1 }
}
```

### Cost estimation — read this honestly
The estimate is **not** a trained price model and is **not derived from the video's pixels**. It is:

> `category base band` × `severity multiplier from keywords in the customer's description`, rounded to the nearest ₹10

| Service | Base band (₹) | | Service | Base band (₹) |
|---|---|---|---|---|
| Electrician | 300–500 | | Refrigerator | 500–900 |
| Plumber | 350–550 | | Pest control | 600–1100 |
| AC repair | 500–800 | | House cleaning | 500–1000 |
| RO repair | 400–650 | | Painter | 600–1200 |
| Carpenter | 400–700 | | CCTV | 700–1200 |
| Washing machine | 450–750 | | Appliance | 350–600 |

Severity keywords (first match wins): *not working / dead / burnt / spark* ×1.6 · *broken / leak / replace / motor* ×1.45 · *not cooling / stops / slow* ×1.2 · *noise / vibration / rattle* ×1.1 · *clean / service / maintenance* ×0.85 · otherwise ×1.0.

So a fan "making noise" ≈ ₹360–600, a fan "completely dead" ≈ ₹480–800, and "just needs cleaning" ≈ ₹260–420. The video is used to **validate the category**; the **description** drives the price. The UI always labels it *approximate* and the technician's quote is the binding price. A real regression model would need historical booking data — see the roadmap.

### What CLIP does *not* do
It identifies the **category**, not the specific fault. The "Detected problem" text is composed from the category plus the keyword phrase above. Zero-shot accuracy is also lower than a classifier fine-tuned on a labelled home-service dataset.

---

## 11. Technician matching

`GET /api/technician/category/:category?lat=&lng=&skills=`

1. **Hard filter** — only **approved** technicians whose `categories`/`skills` contain the requested service (or an AI-required skill) are returned at all. A plumber can never appear for an AC job, whatever their rating.
2. **Score** (weights are env-configurable and sum to 100):

| Factor | Weight | Notes |
|---|---|---|
| Service match | **45** | exact = full; match on an AI-required skill = 70 % |
| Rating | 20 | `rating / 5` |
| Experience | 12 | capped at 12 years |
| Completed jobs | 10 | capped at 700 |
| Proximity | 8 | linear to 0 at 10 km; neutral if unknown |
| Availability | 5 | online technicians |

3. **Order** — online technicians first, then by score. Each result carries `distanceKm` and an `etaMinutes` estimate (`max(5, distance × 4 + 5)`).

> Distance/ETA use the **demo coordinates** `(17.43, 78.41)` sent by the client until real geolocation is wired in (see `docs/GO_LIVE.md`).

---

## 12. Pricing, commission & payments

- **The customer sees one price** — exactly what the technician quoted. Nothing is added on top.
- **The platform's cut (15 %)** is deducted from the technician's payout, Rapido-style:

```
Quote ₹500  →  Customer pays ₹500  ·  Platform keeps ₹75  ·  Technician earns ₹425
```
- **Payment only after completion** — `POST /payment/create-order` is refused server-side unless the booking is `completed`.
- **The technician's wallet is credited when the customer pays**, not when the job is marked complete.
- **Demo mode** (no Razorpay keys): a clearly-labelled demo order completes instantly so the whole flow can be tested.
- **Live mode** (keys set): real Razorpay Checkout; the server verifies the **HMAC-SHA256 signature** (constant-time compare) before marking anything paid. A forged or `demo_order_…` id is rejected, and the order must exist for that booking.

The admin dashboard separates **platform revenue** (commission on *paid* jobs), **gross booking value**, and **awaiting payment** (completed but unpaid).

---

## 13. OTP verification & security

### The OTP
- Generated **only when the customer accepts the quote** (cryptographically secure 4-digit)
- Stored as a **keyed HMAC hash** bound to the booking id; the plain code exists only so the customer can read it out, and is **wiped once used**
- **Never sent to the technician** — stripped from every technician response
- The technician must have marked **arrived**; the check is constant-time
- **5 wrong guesses lock the code** (HTTP 423) — even the correct code is then refused until the customer generates a new one (↻ button)
- Customers see the OTP only while the job is `quote_accepted` / `technician_arriving` / `arrived`

### Other protections
- Passwords hashed with bcrypt; JWT auth with **role checks** on every protected route; three separate sessions (`fixnow_token`, `fixnow_tech_token`, `fixnow_admin_token`)
- Booking and chat access are **ownership-checked** (a customer can only read their own booking; a technician only theirs)
- `passwordHash` is never returned by any API
- **Stage skipping is impossible from the client** — all technician transitions are validated against the state machine in `server/utils/bookingFlow.js`
- Registration-OTP sending is rate-limited (5 per 10 minutes); upload type and size limits on frames (≤ 5 frames, 8 MB each)

---

## 14. API reference

Base URL `http://localhost:5000/api` · `Authorization: Bearer <token>` · roles in **bold**.

### Auth
| Method | Path | Notes |
|---|---|---|
| POST | `/auth/send-otp` | `{ phone, role }` — OTP is printed in the **server terminal** (dev) |
| POST | `/auth/register` | `{ phone, code, password, role, name, categories?, experienceYears?, bio? }` |
| POST | `/auth/login` | `{ phone, password, role }` |
| POST | `/admin/login` | `{ email, password }` |

### Catalogue & technicians
| Method | Path | Role |
|---|---|---|
| GET | `/category` | public |
| GET | `/technician/category/:slug?lat&lng&skills` | public — ranked, relevant, approved only |
| GET | `/technician/me` · `/technician/earnings` | **technician** |
| PATCH | `/technician/status` `{ isOnline }` | **technician** |

### AI
| Method | Path | Role |
|---|---|---|
| POST | `/ai/analyze-problem` | **customer** — multipart: `frames[]` (≤5), `selectedService`, `problemDescription` |
| POST | `/ai/classify-service` | **customer** — legacy single-frame endpoint |

### Bookings
| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/booking` | customer | Create (technician optional) |
| GET | `/booking/me` | customer | My bookings |
| GET | `/booking/technician/me` | technician | My jobs (no OTP) |
| GET | `/booking/:id` | customer / technician | Owner only |
| PATCH | `/booking/:id/request-technician` | customer | Assign a technician after analysis |
| PATCH | `/booking/:id/respond` | technician | Decline a request (`{ action: 'reject' }`) |
| PATCH | `/booking/:id/quote` | technician | `{ amount, labourCost, partsCost, finalProblem, note }` |
| PATCH | `/booking/:id/quote/respond` | customer | `{ action: 'accept' \| 'reject' }` — **accept creates the OTP** |
| PATCH | `/booking/:id/status` | technician | `technician_arriving` → `arrived` → `completed` (validated) |
| POST | `/booking/:id/verify-otp` | technician | `{ otp }` — the only way into `in_progress` |
| PATCH | `/booking/:id/regenerate-otp` | customer | New code, attempts reset |
| PATCH | `/booking/:id/cancel` | customer | Allowed up to `quote_accepted` |
| GET / POST | `/booking/:id/messages` | customer / technician | Chat |

### Payments · Notifications · Admin
| Method | Path | Role |
|---|---|---|
| POST | `/payment/create-order` `{ bookingId }` | customer — only when `completed` |
| POST | `/payment/verify` | customer — signature verified server-side |
| GET | `/notification` · PATCH `/notification/read-all` | any role |
| GET | `/admin/dashboard` · `/admin/technicians` · `/admin/customers` · `/admin/bookings` | **admin** |
| PATCH | `/admin/technicians/:id/approve` · `/reject` | **admin** |

---

## 15. Real-time events (Socket.IO)

**Rooms:** `booking:<id>` (a booking's participants) · `technician:<id>` · `user:<id>` (personal notifications)

| Event | Direction | Payload |
|---|---|---|
| `booking:join` / `technician:join` / `user:join` | client → server | id |
| `technician:location_update` | technician → server | `{ bookingId, progress }` (simulated) **or** `{ bookingId, lat, lng }` (real GPS) |
| `technician:location` | server → booking room | `{ progress, lat, lng, at }` |
| `booking:status` | server → booking room | `{ status }` — screens re-fetch on this |
| `booking:new_request` | server → technician room | `{ bookingId }` |
| `chat:message` | server → booking room | the saved message |
| `notification:new` | server → user room | the saved notification |

The map on the tracking screen is currently a **simulated** animated marker driven by `progress`. The socket relay already accepts real `lat`/`lng`; `docs/GO_LIVE.md` shows how to plug in a real map.

---

## 16. Data model

| Collection | Key fields |
|---|---|
| **users** | name, phone (unique), passwordHash, walletBalance, isVerified |
| **technicians** | name, phone, passwordHash, categories[], skills[], experienceYears, bio, approvalStatus, isOnline, currentLocation, baseCharge, rating, completedJobs, walletBalance |
| **bookings** | customer, technician, category, problemDescription, problemVideoUrl (base64), aiAnalysis{…}, estimatedCost{min,max}, address, isScheduled/scheduledDate/scheduledSlot, isEmergency, **status**, quote{amount,labourCost,partsCost,finalProblem,status}, fare{total,platformCommissionRate,platformCommission,technicianPayout}, otp, otpHash, otpAttempts, otpVerifiedAt, **paymentStatus**, paidAt, isDemo |
| **payments** | booking, customer, amount, razorpayOrderId, razorpayPaymentId, status |
| **messages** | booking, senderModel, senderId, senderName, text |
| **notifications** | recipientModel, recipientId, booking, type, title, body, isRead |
| **categories** | name, slug, icon, order |
| **admins** | name, email, passwordHash |
| **otplogs** | phone, codeHash, role, attempts, verified, expiresAt (registration OTPs) |

---

## 17. Tests & verification status

```bash
cd server
npm test
```
- `tests/flow.test.mjs` — state-machine transitions, OTP generation/hash/constant-time compare, secret stripping (18 assertions)
- `tests/controllers.test.mjs` — runs the **real** booking and payment controllers against a stand-in model layer (18 checks): quote → accept → OTP → technician never sees it → stage-skip attempts rejected → arrival → 5-strike lockout (correct code refused) → regenerate → verify → complete (not paid, wallet untouched) → pay, **plus** the live-mode payment-bypass attempts

| Verified | Not verified |
|---|---|
| `vite build` compiles all modules · every server module imports · both test files pass | A full run against a **real MongoDB** · the **Razorpay Checkout window** with live keys · **real map tiles** · the AI model's accuracy on your own videos |

Please run the walkthrough in §9 once on your machine.

---

## 18. Troubleshooting

| Symptom | Cause → fix |
|---|---|
| `Cannot GET /` on port 5000 | Normal — the API has no root route. Use `/api/health` |
| `MONGO_URI … undefined` | `.env` is missing → `copy .env.example .env` inside `server/` |
| `ERR_MODULE_NOT_FOUND` / `'vite' is not recognized` | `npm install` hasn't been run in that folder |
| `MongoDB connection error` | MongoDB isn't running → start the service; test with `mongosh` |
| `cd` fails with the path inside a `.zip` | You can't `cd` into a zip. **Right-click → Extract All** first |
| `torch==2.3.1` not found / `NumPy requires GCC` | Python is too new. Use **Python 3.11/3.12** and recreate the venv |
| `'uvicorn' is not recognized` | The venv isn't active, or `pip install` failed earlier → activate it and reinstall |
| Analysis says *"We couldn't analyse this video…"* | The AI service isn't running (Node logs `service unreachable`) → start Terminal 3. Or choose **Describe Manually** |
| First analysis takes ~30 s | One-time CLIP download/load |
| Video rejected | Limit is **15 MB** — a 5–10 s clip is plenty |
| No technicians shown | Re-run `node utils/seed.js`; newly registered technicians need **admin approval** |
| Technician card has no buttons / price is blank | Job from an older version stuck in `accepted` — it now shows the quote form; send a quote |
| OTP "locked" | 5 wrong attempts — the customer taps **↻ New code** on their screen |
| Payment "can only be made after… completed" | By design — the technician must mark the job completed first |
| Razorpay window doesn't open | Keys missing/wrong in `server/.env`, or the server wasn't restarted. See `docs/GO_LIVE.md` |
| Port already in use | Another copy is running → stop it, or change `PORT` / the Vite port |

---

## 19. Known limitations

Being upfront about these:

- **Cost estimate is a heuristic** (category band × keyword severity), not a learned model, and the video does not change the price (§10)
- **CLIP is zero-shot** — category-level only, lower accuracy than a fine-tuned model
- **Maps are simulated** and distances/ETAs use demo coordinates until real GPS is integrated (`docs/GO_LIVE.md`)
- **Registration OTPs print to the server console** — no SMS gateway yet
- **Socket.IO rooms aren't authenticated** — anyone who knows a booking id could join its room. IDs aren't guessable but aren't secret; code to fix this is in `docs/GO_LIVE.md`
- **Videos are stored as base64 inside the booking** (16 MB document cap, heavy payloads) — move to Cloudinary/S3 for production
- **CORS and API URLs are hardcoded to localhost** (`server.js`, `client/src/services/api.js`, `socket.js`); `CLIENT_URL` isn't read yet
- **Commission % is hardcoded in the technician screen** (the server value is configurable)
- **No review/rating step** after payment yet, and no refund flow (the `refunded` state exists but nothing triggers it)
- **Legacy routes remain:** `/book/:technicianId` (`BookingFlow.jsx`) and `/service/:slug` (`ServiceDetail.jsx`) are the old technician-first screens. Nothing in the app links to them any more; they are kept so older bookmarks don't break. `ServiceDetail`'s button now sends users into the analysis flow
- Login/register aren't rate-limited (only OTP sending is)

---

## 20. Going live & roadmap

**`docs/GO_LIVE.md`** has step-by-step instructions and code for:
- **Razorpay** — test keys → KYC → live keys, plus a webhook
- **Real maps** — OpenStreetMap/Leaflet (free, no card) or Google Maps, with real technician GPS
- A **pre-launch hardening checklist**

**Suggested next steps:** reviews & ratings feeding the match score · review sentiment analysis · real SMS OTP · cloud video storage · authenticated sockets · a regression model for pricing trained on real completed jobs · fine-tuning the classifier on a labelled dataset.

---

## 21. Notes for your project report

- **Domain:** full-stack web development with real-time systems and applied AI (service marketplace).
- **AI statement to use:** *"Service validation uses zero-shot classification with OpenAI CLIP (Radford et al., 2021), with prompt ensembling and multi-frame averaging. Cost estimation is rule-based (category band × severity). A supervised classifier and a learned price model are listed as future work, as they require a labelled dataset and historical booking data that were not available."*
- **Be ready to explain:** why the OTP is hashed and attempt-limited · why payment is verified server-side · why technician matching uses a hard skill filter before weighting · why the commission comes out of the technician's side.
- **Possible base paper:** Aravindhan et al., *"Web Application Based On Demand Home Service System,"* ICACCS 2020 (IEEE) — **verify the citation details yourself** before using them.

---

## 22. Version history

| Version | Highlights |
|---|---|
| **v6** | Quote-after-video flow; OTP generated on acceptance, hashed, attempt-limited and hidden from technicians; server-side state machine; fixed ownership-check, password-hash and payment-bypass holes; Urban-Company-style customer app (4-tab nav, Alerts, progress tracker); tabbed technician and admin dashboards; 20 demo customers + 28 demo bookings; real Razorpay Checkout code; `docs/GO_LIVE.md`; automated tests |
