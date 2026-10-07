import assert from 'assert'
import crypto from 'crypto'
process.env.JWT_SECRET = 'test-secret'
const load = (p) => import(new URL('../' + p, import.meta.url).href)
const Booking = (await load('models/Booking.js')).default
const Notification = (await load('models/Notification.js')).default
const Technician = (await load('models/Technician.js')).default
const Payment = (await load('models/Payment.js')).default
const B = await load('controllers/bookingController.js')
const P = await load('controllers/paymentController.js')

// ---- stand-in model layer (the controller logic under test is the REAL code) ----
let doc = {
  _id: 'b1', customer: 'c1', technician: 't1', category: 'electrician', status: 'requested', paymentStatus: 'pending',
  quote: { status: 'pending' }, otpAttempts: 0,
  save: async function () {},
  toObject: function () { return JSON.parse(JSON.stringify(this)) }
}
const sameId = (q) => q._id === doc._id
Booking.findOne = async (q) => (sameId(q) && (!q.customer || q.customer === doc.customer) && (!q.technician || q.technician === doc.technician)) ? doc : null
Booking.findById = async () => doc
Booking.findOneAndUpdate = async (q, upd) => {
  if (!sameId(q) || q.technician !== doc.technician) return null
  if (q.status?.$in && !q.status.$in.includes(doc.status)) return null
  Object.assign(doc, upd); return doc
}
Booking.find = () => ({ sort: () => ({ populate: async () => [doc] }) })
Notification.create = async () => ({})
const techWallet = { balance: 0, jobs: 0 }
Technician.findByIdAndUpdate = async (_id, u) => { if (u.$inc?.walletBalance) techWallet.balance += u.$inc.walletBalance; if (u.$inc?.completedJobs) techWallet.jobs += u.$inc.completedJobs; return {} }
const payments = []
Payment.create = async (p) => { payments.push(p); return p }
Payment.findOne = async (q) => payments.find((p) => p.razorpayOrderId === q.razorpayOrderId && String(p.booking) === String(q.booking)) || null
Payment.findOneAndUpdate = async () => ({})

const call = async (fn, user, body = {}, params = { bookingId: 'b1' }) => {
  const out = {}
  const res = { status(c) { out.code = c; return this }, json(j) { out.body = j; out.code ??= 200; return this } }
  await fn({ user, body, params, io: undefined }, res, (e) => { throw e })
  return out
}
const cust = { id: 'c1', role: 'customer' }, tech = { id: 't1', role: 'technician' }, other = { id: 't9', role: 'technician' }

// 1. technician quotes after watching the video
let r = await call(B.submitQuote, tech, { amount: 500, labourCost: 400, partsCost: 100, finalProblem: 'Capacitor failed' })
assert.equal(r.code, 200); assert.equal(doc.status, 'quote_sent'); console.log('✓ technician quotes from the video → quote_sent')
r = await call(B.submitQuote, other, { amount: 500 }); assert.equal(r.code, 400); console.log('✓ a different technician cannot quote this job')
r = await call(B.submitQuote, tech, { amount: -5 }); assert.equal(r.code, 400)
doc.status = 'requested'; r = await call(B.submitQuote, tech, { amount: 0 }); assert.equal(r.code, 400); doc.status = 'quote_sent'
console.log('✓ invalid quote amounts rejected')

// 2. no OTP exists before the customer accepts
assert.equal(doc.otp, undefined); console.log('✓ no OTP exists before the customer accepts')

// 3. customer accepts → OTP generated, fare computed
r = await call(B.respondToQuote, cust, { action: 'accept' })
assert.equal(doc.status, 'quote_accepted'); assert(/^\d{4}$/.test(doc.otp)); assert(doc.otpHash && doc.otpHash !== doc.otp)
assert.deepEqual([doc.fare.total, doc.fare.platformCommission, doc.fare.technicianPayout], [500, 75, 425])
assert.equal(r.body.booking.otp, doc.otp, 'customer is shown the OTP')
console.log('✓ accept → 4-digit OTP generated + hashed; fare 500 / commission 75 / payout 425')

// 4. the technician NEVER receives the OTP
r = await call(B.getTechnicianBookings, tech)
const tb = r.body.bookings[0]
assert(!('otp' in tb) && !('otpHash' in tb), 'OTP leaked to technician!'); console.log('✓ technician API response contains NO otp / otpHash')

// 5. stages cannot be skipped
for (const bad of ['arrived', 'in_progress', 'completed']) { r = await call(B.updateBookingStatus, tech, { status: bad }); assert.equal(r.code, 400, bad) }
console.log('✓ cannot jump quote_accepted → arrived / in_progress / completed')
r = await call(B.updateBookingStatus, tech, { status: 'technician_arriving' }); assert.equal(r.code, 200)
r = await call(B.verifyArrivalOtp, tech, { otp: doc.otp }); assert.equal(r.code, 400); assert.equal(doc.status, 'technician_arriving')
console.log('✓ OTP rejected until the technician has marked "arrived"')
r = await call(B.updateBookingStatus, tech, { status: 'in_progress' }); assert.equal(r.code, 400)
r = await call(B.updateBookingStatus, tech, { status: 'arrived' }); assert.equal(r.code, 200)
r = await call(B.updateBookingStatus, tech, { status: 'in_progress' }); assert.equal(r.code, 400); assert.equal(doc.status, 'arrived')
console.log('✓ arrived → in_progress is NOT possible by status update (OTP is the only way)')

// 6. brute force lockout
const real = doc.otp; const wrong = real === '1111' ? '2222' : '1111'
const lefts = []
for (let i = 0; i < 5; i++) { r = await call(B.verifyArrivalOtp, tech, { otp: wrong }); lefts.push(r.body.attemptsLeft); assert.equal(r.code, 400) }
assert.deepEqual(lefts, [4, 3, 2, 1, 0]); assert.equal(r.body.locked, true)
r = await call(B.verifyArrivalOtp, tech, { otp: real }); assert.equal(r.code, 423); assert.equal(doc.status, 'arrived')
console.log('✓ 5 wrong guesses lock it — even the CORRECT code is refused afterwards (423)')

// 7. customer regenerates, technician verifies
r = await call(B.regenerateOtp, other, {}); assert.equal(r.code, 404, 'non-owner cannot regenerate')
r = await call(B.regenerateOtp, cust, {}); assert.equal(r.code, 200); assert.equal(doc.otpAttempts, 0)
r = await call(B.verifyArrivalOtp, tech, { otp: '12' }); assert.equal(r.code, 400)
r = await call(B.verifyArrivalOtp, tech, { otp: doc.otp }); assert.equal(r.code, 200); assert.equal(doc.status, 'in_progress'); assert.equal(doc.otp, undefined)
console.log('✓ customer regenerates → technician verifies → in_progress; plain OTP wiped')

// 8. work → completed, but NOT paid and wallet NOT credited
r = await call(B.updateBookingStatus, tech, { status: 'completed' }); assert.equal(r.code, 200)
assert.equal(doc.paymentStatus, 'pending'); assert.equal(techWallet.balance, 0)
console.log('✓ completed ≠ paid: paymentStatus still "pending", wallet still ₹0')

// 9. payment
doc.status = 'in_progress'; r = await call(P.createOrder, cust, { bookingId: 'b1' }, {}); assert.equal(r.code, 400)
doc.status = 'completed'
console.log('✓ payment refused while the job is not completed')
r = await call(P.createOrder, other, { bookingId: 'b1' }, {}); assert.equal(r.code, 403)
r = await call(P.createOrder, cust, { bookingId: 'b1' }, {}); assert.equal(r.code, 200); assert.equal(r.body.demo, true); assert.equal(doc.paymentStatus, 'initiated')
const demoOrder = r.body.orderId
r = await call(P.verifyPayment, cust, { bookingId: 'b1', razorpayOrderId: 'demo_order_forged' }, {}); assert.equal(r.code, 400)
console.log('✓ a forged order id is rejected even in demo mode')
r = await call(P.verifyPayment, cust, { bookingId: 'b1', razorpayOrderId: demoOrder }, {}); assert.equal(r.code, 200)
assert.equal(doc.paymentStatus, 'paid'); assert.equal(techWallet.balance, 425)
console.log('✓ demo payment verified → paid; technician wallet credited ₹425 only now')

// 10. LIVE-MODE bypass attempt (the vulnerability found in the audit)
doc.paymentStatus = 'initiated'; techWallet.balance = 0
process.env.RAZORPAY_KEY_ID = 'rzp_test_x'; process.env.RAZORPAY_KEY_SECRET = 'topsecret'
payments.push({ booking: 'b1', razorpayOrderId: 'demo_order_attack' })
r = await call(P.verifyPayment, cust, { bookingId: 'b1', razorpayOrderId: 'demo_order_attack' }, {})
assert.equal(r.code, 400); assert.notEqual(doc.paymentStatus, 'paid')
console.log('✓ LIVE mode: "demo_order_" bypass is BLOCKED (previously marked paid with no signature)')
payments.push({ booking: 'b1', razorpayOrderId: 'order_real1' })
r = await call(P.verifyPayment, cust, { bookingId: 'b1', razorpayOrderId: 'order_real1', razorpayPaymentId: 'pay_1', razorpaySignature: 'deadbeef' }, {})
assert.equal(r.code, 400); assert.notEqual(doc.paymentStatus, 'paid'); console.log('✓ LIVE mode: wrong signature rejected')
doc.paymentStatus = 'initiated'
const sig = crypto.createHmac('sha256', 'topsecret').update('order_real1|pay_1').digest('hex')
r = await call(P.verifyPayment, cust, { bookingId: 'b1', razorpayOrderId: 'order_real1', razorpayPaymentId: 'pay_1', razorpaySignature: sig }, {})
assert.equal(r.code, 200); assert.equal(doc.paymentStatus, 'paid'); console.log('✓ LIVE mode: correct HMAC signature accepted')

console.log('\nALL END-TO-END CONTROLLER CHECKS PASSED')
