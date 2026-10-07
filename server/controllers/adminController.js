import User from '../models/User.js'
import Technician from '../models/Technician.js'
import Booking from '../models/Booking.js'

const STATUSES = ['requested', 'quote_sent', 'quote_accepted', 'technician_arriving', 'arrived', 'in_progress', 'completed', 'cancelled']

export async function dashboardStats(req, res, next) {
  try {
    // Only the fields the dashboard needs — bookings can carry large base64 videos.
    const [customerCount, technicianCount, pendingTechnicians, bookings] = await Promise.all([
      User.countDocuments(),
      Technician.countDocuments(),
      Technician.countDocuments({ approvalStatus: 'pending' }),
      Booking.find().select('status category fare paymentStatus createdAt')
    ])

    const completed = bookings.filter((b) => b.status === 'completed')
    const paid = completed.filter((b) => b.paymentStatus === 'paid')
    const cancelled = bookings.filter((b) => b.status === 'cancelled')

    // Platform revenue = commission actually collected (paid jobs only).
    const totalRevenue = paid.reduce((s, b) => s + (b.fare?.platformCommission || 0), 0)
    const grossBookingValue = paid.reduce((s, b) => s + (b.fare?.total || 0), 0)
    const pendingPayments = completed.filter((b) => b.paymentStatus !== 'paid').reduce((s, b) => s + (b.fare?.total || 0), 0)

    const statusBreakdown = STATUSES.map((status) => ({ status, count: bookings.filter((b) => b.status === status).length }))

    const byCat = {}
    bookings.forEach((b) => { byCat[b.category] = (byCat[b.category] || 0) + 1 })
    const categoryBreakdown = Object.entries(byCat).map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count)

    res.json({
      success: true,
      stats: {
        customerCount, technicianCount, pendingTechnicians,
        bookingCount: bookings.length, completedCount: completed.length, cancelledCount: cancelled.length,
        paidCount: paid.length, totalRevenue, grossBookingValue, pendingPayments
      },
      statusBreakdown, categoryBreakdown
    })
  } catch (err) { next(err) }
}

export async function listTechnicians(req, res, next) {
  try {
    const technicians = await Technician.find().select('-passwordHash').sort({ createdAt: -1 })
    res.json({ success: true, technicians })
  } catch (err) { next(err) }
}

export async function listCustomers(req, res, next) {
  try {
    const [users, agg] = await Promise.all([
      User.find().select('-passwordHash').sort({ createdAt: -1 }).lean(),
      Booking.aggregate([{ $group: {
        _id: '$customer', bookings: { $sum: 1 },
        spent: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$fare.total', 0] } }
      } }])
    ])
    const stats = Object.fromEntries(agg.map((a) => [String(a._id), a]))
    const customers = users.map((u) => ({ ...u, bookings: stats[String(u._id)]?.bookings || 0, spent: stats[String(u._id)]?.spent || 0 }))
    res.json({ success: true, customers })
  } catch (err) { next(err) }
}

export async function listBookings(req, res, next) {
  try {
    const bookings = await Booking.find()
      .select('-problemVideoUrl -otp -otpHash -otpAttempts')
      .sort({ createdAt: -1 }).limit(150)
      .populate('customer', 'name phone').populate('technician', 'name phone')
    res.json({ success: true, bookings })
  } catch (err) { next(err) }
}

export async function approveTechnician(req, res, next) {
  try {
    const technician = await Technician.findByIdAndUpdate(req.params.technicianId, { approvalStatus: 'approved' }, { new: true }).select('-passwordHash')
    res.json({ success: true, technician })
  } catch (err) { next(err) }
}

export async function rejectTechnician(req, res, next) {
  try {
    const technician = await Technician.findByIdAndUpdate(req.params.technicianId, { approvalStatus: 'rejected' }, { new: true }).select('-passwordHash')
    res.json({ success: true, technician })
  } catch (err) { next(err) }
}
