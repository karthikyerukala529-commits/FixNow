import rateLimit from 'express-rate-limit'

export const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many OTP requests — try again in a few minutes' }
})
