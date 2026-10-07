# Going live: real maps and real payments

FixNow runs today with a **simulated map** and a **demo payment**. Both are designed to be swapped for the real thing without touching the rest of the app.

> **Honest status:** the Razorpay code in `BookingHistory.jsx` and `paymentController.js` is complete and its signature logic is unit-tested, but it has **not been run against live Razorpay keys** (that needs your account). The map snippets below are **untested drop-ins** — they follow the libraries' documented APIs, but expect to fix small details on first run.

---

## 1. Real payments (Razorpay)

### What is already built
| Piece | Where | Behaviour |
|---|---|---|
| Order creation | `server/controllers/paymentController.js → createOrder` | Refuses unless the job is `completed`. With keys set, creates a real Razorpay order; without keys, creates a labelled demo order |
| Checkout window | `client/src/pages/BookingHistory.jsx → PayButton` | Loads `checkout.js`, opens Razorpay, sends the signature back |
| Verification | `paymentController.js → verifyPayment` | **Server-side HMAC-SHA256 signature check.** In live mode the signature is always required |
| Settlement | same | Marks `paymentStatus = paid` and credits the technician's wallet **only then** |

You do not need to write payment code — you only need keys.

### Step by step
1. Create an account at **razorpay.com** and open the Dashboard.
2. Make sure the toggle (top of dashboard) says **Test Mode**.
3. **Settings → API Keys → Generate Test Key.** Copy the **Key Id** (`rzp_test_…`) and **Key Secret** (shown once).
4. Put them in `server/.env`:
   ```
   RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
   RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
   ```
5. `cd server && npm install` (the `razorpay` package is already in `package.json`), then restart `npm run dev`.
6. Run a booking through to **Completed**, then tap **Pay ₹…** as the customer. The real Razorpay window opens.
7. Pay with Razorpay's **test** credentials (check their "Test Cards / UPI" page for the current values — typically card `4111 1111 1111 1111` with any future expiry and any CVV, or the test UPI id `success@razorpay`). No real money moves in Test Mode.
8. Confirm in the Razorpay Dashboard → Transactions, and that the booking shows **Paid** and the technician's wallet increased.

**Never** put `RAZORPAY_KEY_SECRET` in the client. Only the Key Id is sent to the browser.

### Going to real money
1. Complete Razorpay **KYC / business activation** (PAN, bank account, website details). Live keys are only issued after approval.
2. Switch the Dashboard toggle to **Live Mode**, generate **Live Keys**, and replace the two values in your production `.env` (`rzp_live_…`).
3. Deploy over **HTTPS** (Razorpay Checkout requires it).
4. Do one small real payment yourself and refund it from the Dashboard.

### Recommended hardening: a webhook
The browser callback can be lost if the customer closes the tab right after paying. A webhook makes Razorpay tell *your server* directly. Add to `server/server.js` **before** `app.use(express.json(...))` (it needs the raw body):

```js
import crypto from 'crypto'
import Booking from './models/Booking.js'
import Payment from './models/Payment.js'

app.post('/api/payment/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['x-razorpay-signature']
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(req.body).digest('hex')
  if (signature !== expected) return res.status(400).send('bad signature')

  const event = JSON.parse(req.body.toString())
  if (event.event === 'payment.captured') {
    const p = event.payload.payment.entity
    const payment = await Payment.findOneAndUpdate({ razorpayOrderId: p.order_id }, { status: 'paid', razorpayPaymentId: p.id })
    if (payment) await Booking.findByIdAndUpdate(payment.booking, { paymentStatus: 'paid', paid: true, paidAt: new Date() })
  }
  res.json({ ok: true })
})
```
Then in the Dashboard: **Settings → Webhooks → Add**, URL `https://YOUR-DOMAIN/api/payment/webhook`, event `payment.captured`, and a secret that you also put in `.env` as `RAZORPAY_WEBHOOK_SECRET`. (Locally, expose your port with a tunnel such as ngrok to test.)

---

## 2. Real maps

Two routes. **Option A needs no credit card.**

### Option A — OpenStreetMap + Leaflet (free, no API key)

**Install** (client):
```
cd client
npm install leaflet react-leaflet@4
```
(`react-leaflet@4` is the line that supports React 18.)

**1. Create `client/src/components/LiveMap.jsx`:**
```jsx
import React, { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Coloured dots avoid Leaflet's default-marker image path problems under Vite.
const dot = (color) => L.divIcon({
  className: '',
  html: `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.4)"></div>`,
  iconSize: [18, 18], iconAnchor: [9, 9]
})

function FitBounds({ points }) {
  const map = useMap()
  useEffect(() => {
    if (points.length > 1) map.fitBounds(points, { padding: [40, 40] })
    else if (points.length === 1) map.setView(points[0], 15)
  }, [points.map((p) => p.join()).join('|')])
  return null
}

// customer / technician: { lat, lng } — technician may be null until the first ping.
export default function LiveMap({ customer, technician }) {
  const points = [customer, technician].filter(Boolean).map((p) => [p.lat, p.lng])
  return (
    <MapContainer center={[customer.lat, customer.lng]} zoom={14} className="w-full h-56 rounded-2xl z-0" scrollWheelZoom={false}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[customer.lat, customer.lng]} icon={dot('#17A673')}><Popup>Your location</Popup></Marker>
      {technician && <Marker position={[technician.lat, technician.lng]} icon={dot('#FF6A3D')}><Popup>Technician</Popup></Marker>}
      <FitBounds points={points} />
    </MapContainer>
  )
}
```

**2. Technician sends real GPS** — in `TechnicianDashboard.jsx`, inside `setStatus`, replace the simulated `setInterval` block with:
```js
if (status === 'technician_arriving') {
  const watchId = navigator.geolocation.watchPosition(
    (pos) => socket.emit('technician:location_update', {
      bookingId: b._id, lat: pos.coords.latitude, lng: pos.coords.longitude
    }),
    (err) => console.warn('GPS error', err.message),
    { enableHighAccuracy: true, maximumAge: 5000 }
  )
  window.__fixnowWatch = watchId           // stop it when the technician arrives:
}
if (status === 'arrived' && window.__fixnowWatch != null) {
  navigator.geolocation.clearWatch(window.__fixnowWatch)
}
```
The server already relays `lat`/`lng` (`socket/index.js`), so nothing changes there. **Browsers only allow geolocation on `https://` or `localhost`.**

**3. Customer sees it** — in `LiveTracking.jsx`:
```jsx
import LiveMap from '../components/LiveMap.jsx'
// state:
const [techPos, setTechPos] = useState(null)
// in the socket effect:
socket.on('technician:location', ({ lat, lng, progress }) => {
  if (lat != null) setTechPos({ lat, lng }); else setProgress(progress)
})
// replace <SimulatedMap … /> with:
<LiveMap customer={{ lat: booking.address?.lat || 17.43, lng: booking.address?.lng || 78.41 }} technician={techPos} />
```

**4. Real customer address** — the booking currently stores a fixed demo address. To capture the customer's real position when they request a technician (`ProblemAnalysis.jsx`), use:
```js
const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej))
address: { line1: 'Current location', city: 'Hyderabad', lat: pos.coords.latitude, lng: pos.coords.longitude }
```
Pass the same lat/lng as the `lat`/`lng` query params when fetching technicians, so the distance and ETA shown on technician cards become real.

**Note on OSM tiles:** the public tile server is fine for a project/demo but has a usage policy; for production traffic use a tile provider (MapTiler, Stadia, etc.) or self-host.

### Option B — Google Maps (needs a billing-enabled Google Cloud project)
1. console.cloud.google.com → create a project → **enable billing** (a card is required; Google gives a monthly free credit).
2. **APIs & Services → Library**: enable **Maps JavaScript API** (and **Distance Matrix API** if you want road-based ETA).
3. **Credentials → Create API key.** Restrict it: *HTTP referrers* → `http://localhost:5173/*` and your production domain; *API restrictions* → the APIs above.
4. `client/.env`: `VITE_GOOGLE_MAPS_API_KEY=your_key`
5. `cd client && npm install @react-google-maps/api`
6. Same component contract as Option A — create `LiveMap.jsx`:
```jsx
import React from 'react'
import { GoogleMap, MarkerF, useJsApiLoader } from '@react-google-maps/api'

export default function LiveMap({ customer, technician }) {
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY })
  if (!isLoaded) return <div className="w-full h-56 rounded-2xl skeleton" />
  return (
    <GoogleMap mapContainerClassName="w-full h-56 rounded-2xl" center={technician || customer} zoom={15}
      options={{ disableDefaultUI: true, zoomControl: true }}>
      <MarkerF position={customer} />
      {technician && <MarkerF position={technician} />}
    </GoogleMap>
  )
}
```
For **road-based ETA**, call the Distance Matrix API from the **server** (never the browser — it would expose a key that can't be referrer-restricted for that API):
```js
const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${tLat},${tLng}&destinations=${cLat},${cLng}&key=${process.env.GOOGLE_MAPS_SERVER_KEY}`
const { rows } = await (await fetch(url)).json()
const etaMinutes = Math.round(rows[0].elements[0].duration.value / 60)
```

---

## 3. Other things to do before real users

| Item | Why | How |
|---|---|---|
| **Authenticate Socket.IO** | Today any client that knows a booking id can join `booking:<id>` and receive its status/chat events. IDs aren't guessable, but they aren't secret either | In `socket/index.js` add `io.use((socket, next) => { try { socket.user = jwt.verify(socket.handshake.auth.token, process.env.JWT_SECRET); next() } catch { next(new Error('unauthorised')) } })`, send `auth: { token }` from `client/src/services/socket.js`, and only let a user join rooms for bookings they own |
| **Real SMS OTP for sign-up** | Registration OTPs currently print to the server console | Plug MSG91 / Twilio / Firebase Phone Auth into `authController.sendOtp` |
| **Move videos out of MongoDB** | Videos are stored as base64 inside the booking (16 MB document cap, slow lists) | Upload to Cloudinary / S3 and store only the URL in `problemVideoUrl` |
| **HTTPS + CORS + secrets** | Geolocation, Razorpay and browsers all require HTTPS | Set `CLIENT_URL` to your real origin, rotate `JWT_SECRET`, never commit `.env` |
| **Rate-limit login/register** | Only OTP sending is limited today | Reuse `middleware/rateLimiter.js` on `/auth/login` |
| **Ratings & reviews** | The flow ends at payment; there is no review step yet | Add a `Review` model + `POST /api/review` after `paymentStatus = paid` |
