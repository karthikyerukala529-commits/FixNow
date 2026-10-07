import mongoose from 'mongoose'

// Chat is always scoped to a specific booking — there's no open-ended
// messaging between a customer and technician who haven't been matched by
// a booking. This mirrors how the Socket.IO rooms are already scoped
// (`booking:<id>`), so persistence and real-time delivery use the same key.
const messageSchema = new mongoose.Schema(
  {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    senderModel: { type: String, enum: ['User', 'Technician'], required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, required: true },
    senderName: { type: String, required: true },
    text: { type: String, required: true, trim: true, maxlength: 1000 }
  },
  { timestamps: true }
)

export default mongoose.model('Message', messageSchema)
