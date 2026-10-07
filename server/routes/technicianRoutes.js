import express from 'express'
import { listTechniciansByCategory, updateOnlineStatus, getEarnings, getMe } from '../controllers/technicianController.js'
import { protect } from '../middleware/auth.js'

const router = express.Router()
router.get('/category/:category', listTechniciansByCategory)
router.get('/me', protect('technician'), getMe)
router.patch('/status', protect('technician'), updateOnlineStatus)
router.get('/earnings', protect('technician'), getEarnings)

export default router
