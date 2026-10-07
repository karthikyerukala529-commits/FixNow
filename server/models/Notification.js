import mongoose from 'mongoose'

const notificationSchema = new mongoose.Schema(
  {
    recipientModel: { type: String, enum: ['User', 'Technician'], required: true },
    recipientId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    type: {
      type: String,
      enum: ['new_request', 'quote_received', 'quote_accepted', 'technician_arriving', 'completed', 'message', 'scheduled_reminder'],
      required: true
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    isRead: { type: Boolean, default: false }
  },
  { timestamps: true }
)

export default mongoose.model('Notification', notificationSchema)
