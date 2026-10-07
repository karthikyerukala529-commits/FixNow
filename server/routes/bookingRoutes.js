import express from 'express'
import {
  createBooking, getMyBookings, getBookingById, getTechnicianBookings,
  submitQuote, respondToQuote, updateBookingStatus, verifyArrivalOtp, requestTechnician, respondToRequest, regenerateOtp, cancelBooking
} from '../controllers/bookingController.js'
import { getMessages, sendMessage } from '../controllers/messageController.js'
import { protect } from '../middleware/auth.js'

const router = express.Router()
router.post('/', protect('customer'), createBooking)
router.get('/me', protect('customer'), getMyBookings)
router.get('/technician/me', protect('technician'), getTechnicianBookings)
router.patch('/:bookingId/request-technician', protect('customer'), requestTechnician)
router.patch('/:bookingId/respond', protect('technician'), respondToRequest)
router.patch('/:bookingId/regenerate-otp', protect('customer'), regenerateOtp)
router.patch('/:bookingId/cancel', protect('customer'), cancelBooking)
router.patch('/:bookingId/quote', protect('technician'), submitQuote)
router.patch('/:bookingId/quote/respond', protect('customer'), respondToQuote)
router.patch('/:bookingId/status', protect('technician'), updateBookingStatus)
router.post('/:bookingId/verify-otp', protect('technician'), verifyArrivalOtp)
router.get('/:bookingId/messages', protect('customer', 'technician'), getMessages)
router.post('/:bookingId/messages', protect('customer', 'technician'), sendMessage)
router.get('/:bookingId', protect('customer', 'technician'), getBookingById)

export default router
