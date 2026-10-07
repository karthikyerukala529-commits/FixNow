import Notification from '../models/Notification.js'

const roleToModel = { customer: 'User', technician: 'Technician', admin: 'Admin' }

export async function listNotifications(req, res, next) {
  try {
    const recipientModel = roleToModel[req.user.role]
    const notifications = await Notification.find({ recipientModel, recipientId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(30)
    const unreadCount = await Notification.countDocuments({ recipientModel, recipientId: req.user.id, isRead: false })
    res.json({ success: true, notifications, unreadCount })
  } catch (err) { next(err) }
}

export async function markAllRead(req, res, next) {
  try {
    const recipientModel = roleToModel[req.user.role]
    await Notification.updateMany({ recipientModel, recipientId: req.user.id, isRead: false }, { isRead: true })
    res.json({ success: true })
  } catch (err) { next(err) }
}
