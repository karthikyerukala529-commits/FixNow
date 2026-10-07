import assert from 'assert'
process.env.JWT_SECRET = 'test'
const f = await import(new URL('../utils/bookingFlow.js', import.meta.url).href)

// state machine
assert(f.canTechTransition('quote_accepted', 'technician_arriving'))
assert(f.canTechTransition('technician_arriving', 'arrived'))
assert(f.canTechTransition('in_progress', 'completed'))
assert(!f.canTechTransition('arrived', 'in_progress'), 'must NOT skip the OTP')
assert(!f.canTechTransition('requested', 'in_progress'))
assert(!f.canTechTransition('quote_sent', 'technician_arriving'), 'cannot travel before the customer accepts')
assert(!f.canTechTransition('quote_accepted', 'completed'))

// otp
for (let i = 0; i < 500; i++) { const o = f.generateOtp(); assert(/^\d{4}$/.test(o) && +o >= 1000) }
const booking = { _id: 'abc123', otp: '4821' }
booking.otpHash = f.hashOtp(booking._id, '4821')
assert(f.otpMatches(booking, '4821'))
assert(!f.otpMatches(booking, '4822'))
assert(!f.otpMatches(booking, '482'))
assert(!f.otpMatches(booking, ''))
assert(!f.otpMatches(booking, '48211'))
assert(!f.otpMatches({ ...booking, _id: 'other' }, '4821'), 'hash is bound to booking id')
assert(f.otpMatches({ _id: 'x', otp: '1234' }, '1234'), 'legacy plain-otp booking still verifies')

// leakage
const s = { otp: '4821', otpHash: 'h', otpAttempts: 2, status: 'arrived', x: 1 }
const forTech = f.sanitizeBooking(s, 'technician')
assert(!('otp' in forTech) && !('otpHash' in forTech) && !('otpAttempts' in forTech), 'technician must never see the OTP')
assert(f.sanitizeBooking(s, 'customer').otp === '4821', 'customer sees it while active')
assert(!('otp' in f.sanitizeBooking({ ...s, status: 'completed' }, 'customer')), 'hidden after completion')
assert(!('otpHash' in f.sanitizeBooking(s, 'customer')))
console.log('ALL BOOKING-FLOW / OTP TESTS PASSED')
