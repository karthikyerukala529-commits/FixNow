import crypto from 'crypto'
import Payment from '../models/Payment.js'
import Booking from '../models/Booking.js'
import { notify } from '../utils/notify.js'

/**
 * POST /api/payment/create-order
 *
 * Payment may only be initiated AFTER the technician has completed the work.
 * This is enforced server-side — the frontend cannot skip ahead by calling
 * this early.
 */
export async function createOrder(req, res, next) {
  try {
    const { bookingId } = req.body
    const booking = await Booking.findById(bookingId)
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' })
    if (booking.customer.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not your booking' })
    }
    if (booking.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Payment can only be made after the technician marks the job completed' })
    }
    if (booking.paymentStatus === 'paid') {
      return res.status(400).json({ success: false, message: 'This booking is already paid' })
    }
    if (!booking.fare?.total) {
      return res.status(400).json({ success: false, message: 'No final amount set for this booking' })
    }

    const isLive = !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
    let orderId
    let keyId

    if (isLive) {
      // Real Razorpay order creation. Kept as a dynamic import so the package
      // is only required when live keys are actually configured.
      const { default: Razorpay } = await import('razorpay')
      const razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
      })
      const order = await razorpay.orders.create({
        amount: Math.round(booking.fare.total * 100), // paise
        currency: 'INR',
        receipt: `booking_${booking._id}`
      })
      orderId = order.id
      keyId = process.env.RAZORPAY_KEY_ID
    } else {
      // Demo fallback so the flow completes end-to-end without live keys.
      orderId = 'demo_order_' + Date.now()
    }

    await Payment.create({
      booking: bookingId,
      customer: req.user.id,
      amount: booking.fare.total,
      razorpayOrderId: orderId,
      status: 'created'
    })

    booking.paymentStatus = 'initiated'
    await booking.save()

    res.json({ success: true, demo: !isLive, orderId, keyId, amount: booking.fare.total })
  } catch (err) { next(err) }
}

/**
 * POST /api/payment/verify
 *
 * For live Razorpay, the HMAC signature is verified server-side — a booking is
 * NEVER marked paid on the strength of a frontend claim alone.
 */
export async function verifyPayment(req, res, next) {
  try {
    const { bookingId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body

    const booking = await Booking.findById(bookingId)
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' })
    if (booking.customer.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not your booking' })
    }

    if (booking.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Payment can only be verified for a completed job' })
    }
    if (booking.paymentStatus === 'paid') {
      return res.json({ success: true, paymentStatus: 'paid' })
    }

    // The order must be one WE created for THIS booking.
    const payment = await Payment.findOne({ razorpayOrderId, booking: bookingId })
    if (!payment) return res.status(400).json({ success: false, message: 'Unknown payment order' })

    const isLive = !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
    if (isLive) {
      // Live mode: the signature is ALWAYS required. A "demo_order_" id can no
      // longer be used to skip verification.
      const expected = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex')
      const a = Buffer.from(expected)
      const b = Buffer.from(String(razorpaySignature || ''))
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        await Payment.findOneAndUpdate({ razorpayOrderId }, { status: 'failed' })
        booking.paymentStatus = 'failed'
        await booking.save()
        return res.status(400).json({ success: false, message: 'Payment verification failed' })
      }
    } else if (!String(razorpayOrderId).startsWith('demo_order_')) {
      return res.status(400).json({ success: false, message: 'Invalid order for demo mode' })
    }

    await Payment.findOneAndUpdate(
      { razorpayOrderId },
      { status: 'paid', razorpayPaymentId: razorpayPaymentId || 'demo_payment_' + Date.now() }
    )

    booking.paymentStatus = 'paid'
    booking.paid = true // kept in sync for backward compatibility
    booking.paidAt = new Date()
    await booking.save()

    if (booking.technician) {
      // Wallet is credited on PAYMENT, not on job completion — a completed but
      // unpaid job must not inflate a technician's balance.
      const { default: Technician } = await import('../models/Technician.js')
      await Technician.findByIdAndUpdate(booking.technician, {
        $inc: { walletBalance: booking.fare.technicianPayout || 0 }
      })

      await notify(req.io, {
        recipientModel: 'Technician',
        recipientId: booking.technician,
        booking: booking._id,
        type: 'completed',
        title: 'Payment received',
        body: `₹${booking.fare.total} paid — ₹${booking.fare.technicianPayout} added to your earnings`
      })
    }

    res.json({ success: true, paymentStatus: 'paid' })
  } catch (err) { next(err) }
}
