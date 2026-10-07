import Notification from '../models/Notification.js'

// Creates a Notification record and pushes it live over Socket.IO if the
// recipient is connected — the frontend's NotificationBell listens for
// `notification:new` on top of polling, so it updates instantly when open.
export async function notify(io, { recipientModel, recipientId, booking, type, title, body }) {
  const notification = await Notification.create({ recipientModel, recipientId, booking, type, title, body })
  io?.to(`user:${recipientId}`).emit('notification:new', notification)
  return notification
}
