import mongoose from 'mongoose'

const technicianSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String },
    role: { type: String, enum: ['technician'], default: 'technician' },
    categories: [{ type: String, required: true }],
    experienceYears: { type: Number, default: 0 },
    bio: { type: String, trim: true },
    skills: [{ type: String }],
    approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    isOnline: { type: Boolean, default: false },
    currentLocation: { lat: Number, lng: Number, updatedAt: Date },
    baseCharge: { type: Number, default: 199 },
    rating: { type: Number, default: 0 },
    totalRatings: { type: Number, default: 0 },
    completedJobs: { type: Number, default: 0 },
    walletBalance: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
)

export default mongoose.model('Technician', technicianSchema)
