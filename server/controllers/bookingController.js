import Booking from '../models/Booking.js'
import Technician from '../models/Technician.js'
import { notify } from '../utils/notify.js'
import {
  canTechTransition, CUSTOMER_CANCELLABLE, OTP_VISIBLE, MAX_OTP_ATTEMPTS,
  generateOtp, hashOtp, otpMatches, sanitizeBooking
} from '../utils/bookingFlow.js'

const PLATFORM_COMMISSION_RATE = Number(process.env.PLATFORM_COMMISSION_RATE || 0.15)

// Large base64 video lives on the booking; list endpoints leave it out.
const LIST_EXCLUDE = '-problemVideoUrl'

export async function createBooking(req, res, next) {
  try {
    const {
      technicianId, category, problemDescription, problemVideoUrl, aiPrediction, aiAnalysis,
      estimatedCost, address, isScheduled, scheduledDate, scheduledSlot, isEmergency
    } = req.body

    if (!category) return res.status(400).json({ success: false, message: 'Service category is required' })

    let technician = null
    if (technicianId) {
      technician = await Technician.findById(technicianId)
      if (!technician) return res.status(404).json({ success: false, message: 'Technician not found' })
    }

    // NOTE: no OTP here. It is generated only once the customer accepts a quote.
    const booking = await Booking.create({
      customer: req.user.id,
      technician: technicianId || undefined,
      category, problemDescription, problemVideoUrl, aiPrediction, aiAnalysis, estimatedCost, address,
      isScheduled: !!isScheduled,
      scheduledDate: isScheduled ? scheduledDate : undefined,
      scheduledSlot: isScheduled ? scheduledSlot : undefined,
      isEmergency: !!isEmergency,
      status: 'requested',
      quote: { status: 'pending' }
    })

    if (technicianId) {
      req.io?.to(`technician:${technicianId}`).emit('booking:new_request', { bookingId: booking._id })
      await notify(req.io, {
        recipientModel: 'Technician', recipientId: technicianId, booking: booking._id, type: 'new_request',
        title: isEmergency ? '🚨 New urgent job request' : 'New job request',
        body: `${category.replace('-', ' ')} — ${isScheduled ? `scheduled for ${scheduledDate}` : 'ASAP'}. Watch the video and send your quote.`
      })
    }
    res.status(201).json({ success: true, booking: sanitizeBooking(booking, 'customer') })
  } catch (err) { next(err) }
}

export async function getMyBookings(req, res, next) {
  try {
    const bookings = await Booking.find({ customer: req.user.id })
      .select(LIST_EXCLUDE).sort({ createdAt: -1 }).populate('technician', 'name phone rating')
    res.json({ success: true, bookings: bookings.map((b) => sanitizeBooking(b, 'customer')) })
  } catch (err) { next(err) }
}

// Ownership is enforced: a customer can only read their own booking, a
// technician only the ones assigned to them.
export async function getBookingById(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.bookingId)
      .select(LIST_EXCLUDE).populate('technician', '-passwordHash')
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' })

    const ownerId = booking.customer.toString()
    const techId = booking.technician?._id?.toString()
    const allowed = (req.user.role === 'customer' && ownerId === req.user.id) ||
                    (req.user.role === 'technician' && techId === req.user.id)
    if (!allowed) return res.status(403).json({ success: false, message: 'Not your booking' })

    res.json({ success: true, booking: sanitizeBooking(booking, req.user.role) })
  } catch (err) { next(err) }
}

export async function getTechnicianBookings(req, res, next) {
  try {
    const bookings = await Booking.find({ technician: req.user.id })
      .sort({ createdAt: -1 }).populate('customer', 'name phone')
    // The technician must never receive the OTP — sanitizeBooking removes it.
    res.json({ success: true, bookings: bookings.map((b) => sanitizeBooking(b, 'technician')) })
  } catch (err) { next(err) }
}

/**
 * Technician reviews the customer's video and sends a quote.
 * Allowed from 'requested' (and legacy 'accepted' jobs that never got a price).
 */
export async function submitQuote(req, res, next) {
  try {
    const { amount, note, labourCost, partsCost, finalProblem } = req.body
    const total = Number(amount)
    if (!Number.isFinite(total) || total <= 0 || total > 200000) {
      return res.status(400).json({ success: false, message: 'Enter a valid quote amount' })
    }

    const booking = await Booking.findOneAndUpdate(
      { _id: req.params.bookingId, technician: req.user.id, status: { $in: ['requested', 'accepted'] } },
      {
        quote: { amount: total, note, labourCost: Number(labourCost) || 0, partsCost: Number(partsCost) || 0, finalProblem, status: 'sent', submittedAt: new Date() },
        status: 'quote_sent'
      },
      { new: true }
    )
    if (!booking) return res.status(400).json({ success: false, message: 'This job can no longer be quoted' })

    req.io?.to(`booking:${booking._id}`).emit('booking:status', { status: booking.status })
    await notify(req.io, {
      recipientModel: 'User', recipientId: booking.customer, booking: booking._id, type: 'quote_received',
      title: 'Quote received', body: `₹${total} for your ${booking.category.replace('-', ' ')} request — tap to review`
    })
    res.json({ success: true, booking: sanitizeBooking(booking, 'technician') })
  } catch (err) { next(err) }
}

/**
 * Customer accepts or declines the quote. ACCEPTING generates the OTP.
 */
export async function respondToQuote(req, res, next) {
  try {
    const { action } = req.body
    const booking = await Booking.findOne({ _id: req.params.bookingId, customer: req.user.id })
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' })
    if (booking.status !== 'quote_sent' || booking.quote.status !== 'sent') {
      return res.status(400).json({ success: false, message: 'There is no pending quote to respond to' })
    }

    if (action === 'accept') {
      const total = booking.quote.amount
      const platformCommission = Math.round(total * PLATFORM_COMMISSION_RATE)
      const otp = generateOtp()

      booking.quote.status = 'accepted'
      booking.status = 'quote_accepted'
      booking.fare = { total, platformCommissionRate: PLATFORM_COMMISSION_RATE, platformCommission, technicianPayout: total - platformCommission }
      booking.otp = otp
      booking.otpHash = hashOtp(booking._id, otp)
      booking.otpAttempts = 0
    } else {
      booking.quote.status = 'rejected'
      booking.status = 'cancelled'
    }
    await booking.save()

    req.io?.to(`booking:${booking._id}`).emit('booking:status', { status: booking.status })
    if (action === 'accept') {
      await notify(req.io, {
        recipientModel: 'Technician', recipientId: booking.technician, booking: booking._id, type: 'quote_accepted',
        title: 'Quote accepted!', body: `₹${booking.fare.total} accepted — you'll earn ₹${booking.fare.technicianPayout}. Head to the customer now.`
      })
    }
    res.json({ success: true, booking: sanitizeBooking(booking, 'customer') })
  } catch (err) { next(err) }
}

/**
 * Technician moves the job along. Every transition is validated against the
 * state machine, so stages cannot be skipped from the client.
 */
export async function updateBookingStatus(req, res, next) {
  try {
    const { status } = req.body
    const booking = await Booking.findOne({ _id: req.params.bookingId, technician: req.user.id })
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found for this technician' })

    if (!canTechTransition(booking.status, status)) {
      return res.status(400).json({ success: false, message: `Cannot move a job from "${booking.status}" to "${status}"` })
    }

    booking.status = status
    if (status === 'completed') booking.completedAt = new Date()
    await booking.save()

    // Job count increments now; the wallet is credited only when the customer pays.
    if (status === 'completed') await Technician.findByIdAndUpdate(req.user.id, { $inc: { completedJobs: 1 } })

    req.io?.to(`booking:${booking._id}`).emit('booking:status', { status: booking.status })
    const messages = {
      technician_arriving: { type: 'technician_arriving', title: 'Technician is on the way', body: 'Track them live. Keep your OTP ready to share when they arrive.' },
      arrived: { type: 'technician_arriving', title: 'Technician has arrived', body: 'Read your 4-digit OTP to the technician so they can start the work.' },
      completed: { type: 'completed', title: 'Work completed', body: `Please review and pay ₹${booking.fare?.total}.` }
    }
    if (messages[status]) {
      await notify(req.io, { recipientModel: 'User', recipientId: booking.customer, booking: booking._id, ...messages[status] })
    }
    res.json({ success: true, booking: sanitizeBooking(booking, 'technician') })
  } catch (err) { next(err) }
}

/**
 * The OTP check. The technician must have marked "arrived", the code must match
 * (constant-time), and wrong guesses are limited — 5 strikes locks the code
 * until the customer generates a fresh one.
 */
export async function verifyArrivalOtp(req, res, next) {
  try {
    const { otp } = req.body
    const booking = await Booking.findOne({ _id: req.params.bookingId, technician: req.user.id })
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found for this technician' })

    if (booking.status !== 'arrived') {
      return res.status(400).json({ success: false, message: 'Mark yourself as arrived before entering the OTP' })
    }
    if ((booking.otpAttempts || 0) >= MAX_OTP_ATTEMPTS) {
      return res.status(423).json({ success: false, locked: true, attemptsLeft: 0,
        message: 'Too many wrong attempts. Ask the customer to generate a new code from their app.' })
    }

    if (!otpMatches(booking, otp)) {
      booking.otpAttempts = (booking.otpAttempts || 0) + 1
      await booking.save()
      const attemptsLeft = Math.max(0, MAX_OTP_ATTEMPTS - booking.otpAttempts)
      return res.status(400).json({ success: false, attemptsLeft, locked: attemptsLeft === 0,
        message: attemptsLeft ? `Incorrect OTP. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} left.` : 'Too many wrong attempts. Ask the customer to generate a new code.' })
    }

    booking.status = 'in_progress'
    booking.otpVerifiedAt = new Date()
    booking.otp = undefined // plain code no longer needed once used
    await booking.save()

    req.io?.to(`booking:${booking._id}`).emit('booking:status', { status: booking.status })
    await notify(req.io, {
      recipientModel: 'User', recipientId: booking.customer, booking: booking._id, type: 'technician_arriving',
      title: 'Work has started', body: 'Your technician was verified and has started the work.'
    })
    res.json({ success: true, booking: sanitizeBooking(booking, 'technician') })
  } catch (err) { next(err) }
}

// Customer asks for a fresh code (e.g. after a lockout or if it was overheard).
export async function regenerateOtp(req, res, next) {
  try {
    const booking = await Booking.findOne({ _id: req.params.bookingId, customer: req.user.id })
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' })
    if (!OTP_VISIBLE.includes(booking.status)) {
      return res.status(400).json({ success: false, message: 'A code can only be regenerated before work starts' })
    }
    const otp = generateOtp()
    booking.otp = otp
    booking.otpHash = hashOtp(booking._id, otp)
    booking.otpAttempts = 0
    await booking.save()
    res.json({ success: true, booking: sanitizeBooking(booking, 'customer') })
  } catch (err) { next(err) }
}

export async function cancelBooking(req, res, next) {
  try {
    const booking = await Booking.findOne({ _id: req.params.bookingId, customer: req.user.id })
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' })
    if (!CUSTOMER_CANCELLABLE.includes(booking.status)) {
      return res.status(400).json({ success: false, message: 'This booking can no longer be cancelled' })
    }
    booking.status = 'cancelled'
    booking.otp = undefined
    await booking.save()
    req.io?.to(`booking:${booking._id}`).emit('booking:status', { status: 'cancelled' })
    if (booking.technician) {
      await notify(req.io, { recipientModel: 'Technician', recipientId: booking.technician, booking: booking._id,
        type: 'new_request', title: 'Booking cancelled', body: 'The customer cancelled this booking.' })
    }
    res.json({ success: true, booking: sanitizeBooking(booking, 'customer') })
  } catch (err) { next(err) }
}

export async function requestTechnician(req, res, next) {
  try {
    const { technicianId } = req.body
    const technician = await Technician.findById(technicianId)
    if (!technician) return res.status(404).json({ success: false, message: 'Technician not found' })
    const booking = await Booking.findOneAndUpdate(
      { _id: req.params.bookingId, customer: req.user.id, status: 'requested' },
      { technician: technicianId }, { new: true }
    )
    if (!booking) return res.status(400).json({ success: false, message: 'Booking not found or a technician is already assigned' })
    req.io?.to(`technician:${technicianId}`).emit('booking:new_request', { bookingId: booking._id })
    await notify(req.io, { recipientModel: 'Technician', recipientId: technicianId, booking: booking._id, type: 'new_request',
      title: booking.isEmergency ? '🚨 New urgent job request' : 'New job request',
      body: `${booking.category.replace('-', ' ')} — watch the video and send your quote.` })
    res.json({ success: true, booking: sanitizeBooking(booking, 'customer') })
  } catch (err) { next(err) }
}

// Technician declines a request they can't take.
export async function respondToRequest(req, res, next) {
  try {
    const { action } = req.body
    const booking = await Booking.findOne({ _id: req.params.bookingId, technician: req.user.id, status: { $in: ['requested', 'accepted'] } })
    if (!booking) return res.status(400).json({ success: false, message: 'Job not found or already actioned' })
    if (action === 'reject') {
      booking.status = 'cancelled'
      await booking.save()
      req.io?.to(`booking:${booking._id}`).emit('booking:status', { status: 'cancelled' })
      await notify(req.io, { recipientModel: 'User', recipientId: booking.customer, booking: booking._id, type: 'new_request',
        title: 'Technician unavailable', body: 'Please choose another technician from your recommendations.' })
    }
    res.json({ success: true, booking: sanitizeBooking(booking, 'technician') })
  } catch (err) { next(err) }
}
