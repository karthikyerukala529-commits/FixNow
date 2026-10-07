import mongoose from 'mongoose'

const bookingSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    technician: { type: mongoose.Schema.Types.ObjectId, ref: 'Technician' },
    category: { type: String, required: true },
    problemDescription: { type: String },
    problemVideoUrl: { type: String },
    // AI-based service classification, stored so results are auditable and
    // don't need to be re-computed. See ai-service/classifier.py for the
    // zero-shot CLIP classifier that produces this.
    aiPrediction: {
      predictedCategory: { type: String },
      confidence: { type: Number },
      allScores: { type: mongoose.Schema.Types.Mixed }
    },
    // Full structured analysis from the AI service (relevance to the customer's
    // chosen service, detected problem, severity, required skills). `aiPrediction`
    // above is retained for backward compatibility with existing documents.
    aiAnalysis: {
      selectedService: { type: String },
      isRelevant: { type: Boolean },
      predictedCategory: { type: String },
      confidence: { type: Number },
      detectedProblem: { type: String },
      severity: { type: String, enum: ['low', 'medium', 'high', null], default: null },
      requiredSkills: [{ type: String }]
    },
    // The AI's up-front approximate range, shown to the customer BEFORE a
    // technician is chosen. Distinct from the technician's binding final quote.
    estimatedCost: {
      min: { type: Number },
      max: { type: Number },
      currency: { type: String, default: 'INR' }
    },
    address: { line1: String, city: String, lat: Number, lng: Number },
    // Advance booking: the customer can request a technician immediately,
    // or schedule a visit for a later date/time slot (e.g. weekend, since
    // they're busy on weekdays) rather than being forced into an ASAP flow.
    isScheduled: { type: Boolean, default: false },
    scheduledDate: { type: String }, // 'YYYY-MM-DD', kept as a plain string — no timezone math needed for a date-only slot picker
    scheduledSlot: { type: String, enum: ['morning', 'afternoon', 'evening', 'night', null], default: null },
    isEmergency: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['requested', 'accepted', 'technician_arriving', 'arrived', 'inspection', 'quote_sent', 'quote_accepted', 'in_progress', 'completed', 'cancelled'],
      default: 'requested'
    },
    // The technician's BINDING quote, submitted after physically inspecting
    // the problem — this supersedes the AI's approximate estimate above.
    quote: {
      amount: { type: Number },
      note: { type: String },
      labourCost: { type: Number },
      partsCost: { type: Number },
      finalProblem: { type: String },
      status: { type: String, enum: ['pending', 'sent', 'accepted', 'rejected'], default: 'pending' },
      submittedAt: { type: Date }
    },
    // The OTP is generated only when the customer ACCEPTS the quote. The plain
    // code exists solely so the customer can read it out; verification uses the
    // keyed hash. Both are stripped from anything sent to a technician.
    otp: { type: String },
    otpHash: { type: String },
    otpAttempts: { type: Number, default: 0 },
    otpVerifiedAt: { type: Date },
    isDemo: { type: Boolean, default: false },
    // Rapido-style pricing: the customer pays exactly what the technician
    // quoted — `total` — with nothing added on top. The platform's cut is
    // a commission deducted from the technician's payout instead, computed
    // when the quote is accepted so the rate is locked in even if the
    // platform's commission percentage changes later.
    fare: {
      total: Number, // = quote.amount, exactly what the customer pays
      platformCommissionRate: { type: Number, default: 0.15 }, // 15%, Rapido-style
      platformCommission: Number, // amount the platform keeps
      technicianPayout: Number // total - platformCommission, credited to the technician
    },
    // Payment state is deliberately SEPARATE from booking status — a booking
    // being 'completed' does not mean it has been paid for.
    paymentStatus: {
      type: String,
      enum: ['pending', 'initiated', 'paid', 'failed', 'refunded'],
      default: 'pending'
    },
    paidAt: { type: Date },
    paid: { type: Boolean, default: false }, // retained for backward compatibility with existing UI/documents
    completedAt: { type: Date }
  },
  { timestamps: true }
)

export default mongoose.model('Booking', bookingSchema)
