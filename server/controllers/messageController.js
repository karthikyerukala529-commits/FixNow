import Message from '../models/Message.js'
import Booking from '../models/Booking.js'
import { notify } from '../utils/notify.js'

// Confirms the requester is actually the customer or technician on this
// booking before letting them read/send messages — chat is private to the
// two people matched by the booking, not open to anyone who knows the ID.
async function assertParticipant(bookingId, userId, role) {
  const booking = await Booking.findById(bookingId)
  if (!booking) return null
  const isCustomer = role === 'customer' && booking.customer.toString() === userId
  const isTechnician = role === 'technician' && booking.technician?.toString() === userId
  if (!isCustomer && !isTechnician) return null
  return booking
}

export async function getMessages(req, res, next) {
  try {
    const booking = await assertParticipant(req.params.bookingId, req.user.id, req.user.role)
    if (!booking) return res.status(403).json({ success: false, message: 'Not a participant on this booking' })

    const messages = await Message.find({ booking: booking._id }).sort({ createdAt: 1 })
    res.json({ success: true, messages })
  } catch (err) { next(err) }
}

export async function sendMessage(req, res, next) {
  try {
    const { text, senderName } = req.body
    if (!text || !text.trim()) return res.status(400).json({ success: false, message: 'Message text is required' })

    const booking = await assertParticipant(req.params.bookingId, req.user.id, req.user.role)
    if (!booking) return res.status(403).json({ success: false, message: 'Not a participant on this booking' })

    const senderModel = req.user.role === 'technician' ? 'Technician' : 'User'
    const message = await Message.create({
      booking: booking._id,
      senderModel,
      senderId: req.user.id,
      senderName: senderName || 'User',
      text: text.trim()
    })

    // Real-time delivery to whoever else is viewing this booking's chat right now.
    req.io?.to(`booking:${booking._id}`).emit('chat:message', message)

    // A quiet notification for the other participant in case they're not
    // actively looking at the chat screen.
    const recipientModel = senderModel === 'User' ? 'Technician' : 'User'
    const recipientId = senderModel === 'User' ? booking.technician : booking.customer
    if (recipientId) {
      await notify(req.io, {
        recipientModel,
        recipientId,
        booking: booking._id,
        type: 'message',
        title: `New message from ${message.senderName}`,
        body: text.trim().slice(0, 80)
      })
    }

    res.status(201).json({ success: true, message })
  } catch (err) { next(err) }
}
