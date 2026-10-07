import express from 'express'
import { listNotifications, markAllRead } from '../controllers/notificationController.js'
import { protect } from '../middleware/auth.js'

const router = express.Router()
router.get('/', protect('customer', 'technician', 'admin'), listNotifications)
router.patch('/read-all', protect('customer', 'technician', 'admin'), markAllRead)

export default router
