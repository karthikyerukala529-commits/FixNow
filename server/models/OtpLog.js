import mongoose from 'mongoose'

const otpLogSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, index: true },
    codeHash: { type: String, required: true },
    role: { type: String, enum: ['customer', 'technician', 'admin'], default: 'customer' },
    attempts: { type: Number, default: 0 },
    verified: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
)

export default mongoose.model('OtpLog', otpLogSchema)
