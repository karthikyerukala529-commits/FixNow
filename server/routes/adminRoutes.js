import express from 'express'
import { adminLogin } from '../controllers/adminAuthController.js'
import { dashboardStats, listTechnicians, listCustomers, listBookings, approveTechnician, rejectTechnician } from '../controllers/adminController.js'
import { protect } from '../middleware/auth.js'

const router = express.Router()
router.post('/login', adminLogin)
router.get('/dashboard', protect('admin'), dashboardStats)
router.get('/technicians', protect('admin'), listTechnicians)
router.get('/customers', protect('admin'), listCustomers)
router.get('/bookings', protect('admin'), listBookings)
router.patch('/technicians/:technicianId/approve', protect('admin'), approveTechnician)
router.patch('/technicians/:technicianId/reject', protect('admin'), rejectTechnician)

export default router
