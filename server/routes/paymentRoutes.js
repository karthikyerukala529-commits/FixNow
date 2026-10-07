import express from 'express'
import { createOrder, verifyPayment } from '../controllers/paymentController.js'
import { protect } from '../middleware/auth.js'

const router = express.Router()
router.post('/create-order', protect('customer'), createOrder)
router.post('/verify', protect('customer'), verifyPayment)

export default router
