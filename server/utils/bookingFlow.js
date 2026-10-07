import crypto from 'crypto'

// ---------------------------------------------------------------------------
// Booking state machine + OTP guard. Kept in one pure module so the rules are
// enforced server-side (the UI can never skip a stage) and are unit-testable.
//
//   requested ──(technician watches video, sends quote)──▶ quote_sent
//   quote_sent ──(customer accepts; OTP generated)──────▶ quote_accepted
//   quote_accepted ──▶ technician_arriving ──▶ arrived
//   arrived ──(technician enters customer's OTP)────────▶ in_progress
//   in_progress ──▶ completed ──(customer pays)──▶ paymentStatus = paid
// ---------------------------------------------------------------------------

// Transitions a TECHNICIAN may trigger through the generic status endpoint.
// 'arrived' -> 'in_progress' is deliberately absent: it is only reachable by
// verifying the OTP.
export const TECH_TRANSITIONS = {
  quote_accepted: ['technician_arriving'],
  technician_arriving: ['arrived'],
  in_progress: ['completed']
}

export function canTechTransition(from, to) {
  return (TECH_TRANSITIONS[from] || []).includes(to)
}

// Statuses in which the customer may still cancel without penalty.
export const CUSTOMER_CANCELLABLE = ['requested', 'quote_sent', 'quote_accepted']

// Statuses during which a customer should be shown their OTP.
export const OTP_VISIBLE = ['quote_accepted', 'technician_arriving', 'arrived']

export const MAX_OTP_ATTEMPTS = 5

export function generateOtp() {
  return String(crypto.randomInt(1000, 10000)) // cryptographically secure 4-digit
}

function secret() {
  return process.env.JWT_SECRET || 'dev-secret'
}

// Keyed hash bound to the booking id, so a hash from one booking is useless on another.
export function hashOtp(bookingId, otp) {
  return crypto.createHmac('sha256', secret()).update(`${bookingId}:${otp}`).digest('hex')
}

export function otpMatches(booking, input) {
  const candidate = String(input || '')
  if (!/^\d{4}$/.test(candidate)) return false

  // Legacy bookings created before hashing existed only carry the plain code.
  const expected = booking.otpHash || (booking.otp ? hashOtp(booking._id, booking.otp) : null)
  if (!expected) return false

  const a = Buffer.from(hashOtp(booking._id, candidate))
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b) // constant-time compare
}

// Strips secrets before a booking is sent to a client.
export function sanitizeBooking(doc, role) {
  const b = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc }
  delete b.otpHash
  delete b.otpAttempts
  if (role !== 'customer' || !OTP_VISIBLE.includes(b.status)) delete b.otp
  return b
}
