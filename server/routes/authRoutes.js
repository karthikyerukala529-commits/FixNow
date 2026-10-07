import express from 'express'
import { sendOtp, register, login, verifyOtp } from '../controllers/authController.js'
import { otpLimiter } from '../middleware/rateLimiter.js'

const router = express.Router()
router.post('/send-otp', otpLimiter, sendOtp)
router.post('/register', register)
router.post('/login', login)
router.post('/verify-otp', verifyOtp)

export default router
