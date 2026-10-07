import Technician from '../models/Technician.js'
import Booking from '../models/Booking.js'

// Weights are configurable via env rather than permanently hardcoded, so the
// balance can be tuned without a code change.
// SERVICE RELEVANCE IS INTENTIONALLY THE LARGEST TERM: a 5-star carpenter must
// never outrank a 4.2-star AC technician for an AC job. Relevance is ALSO a
// hard filter below — the weight only orders technicians who already qualify.
const W = {
  serviceMatch: Number(process.env.W_SERVICE_MATCH || 45),
  rating: Number(process.env.W_RATING || 20),
  experience: Number(process.env.W_EXPERIENCE || 12),
  jobs: Number(process.env.W_JOBS || 10),
  proximity: Number(process.env.W_PROXIMITY || 8),
  availability: Number(process.env.W_AVAILABILITY || 5)
}

function distanceKm(lat1, lng1, lat2, lng2) {
  if ([lat1, lng1, lat2, lng2].some((v) => v === undefined || v === null)) return null
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

function computeMatchScore(tech, { category, requiredSkills = [], customerLat, customerLng }) {
  const skills = [...(tech.categories || []), ...(tech.skills || [])]

  // Service relevance — exact category match scores full marks; a match on any
  // additional skill the AI flagged as required scores partial.
  let serviceScore = 0
  if (skills.includes(category)) serviceScore = W.serviceMatch
  else if (requiredSkills.some((s) => skills.includes(s))) serviceScore = W.serviceMatch * 0.7

  const ratingScore = ((tech.rating || 0) / 5) * W.rating
  const experienceScore = Math.min((tech.experienceYears || 0) / 12, 1) * W.experience
  const jobsScore = Math.min((tech.completedJobs || 0) / 700, 1) * W.jobs
  const availabilityScore = tech.isOnline ? W.availability : 0

  const dist = distanceKm(customerLat, customerLng, tech.currentLocation?.lat, tech.currentLocation?.lng)
  const proximityScore = dist === null
    ? W.proximity * 0.6 // neutral default when location is unknown
    : Math.max(0, W.proximity * (1 - Math.min(dist, 10) / 10))

  return {
    matchScore: Math.round(serviceScore + ratingScore + experienceScore + jobsScore + availabilityScore + proximityScore),
    distanceKm: dist === null ? null : Math.round(dist * 10) / 10,
    etaMinutes: dist === null ? null : Math.max(5, Math.round(dist * 4 + 5))
  }
}

/**
 * GET /api/technician/category/:category?lat=&lng=&skills=a,b
 *
 * HARD RELEVANCE FILTER: only technicians who actually carry the requested
 * category (or one of the AI's requiredSkills) are returned at all. This is
 * what stops plumbers/carpenters appearing for an AC job regardless of rating.
 */
export async function listTechniciansByCategory(req, res, next) {
  try {
    const { category } = req.params
    const { lat, lng, skills } = req.query
    const requiredSkills = skills ? String(skills).split(',').filter(Boolean) : []
    const customerLat = lat ? Number(lat) : undefined
    const customerLng = lng ? Number(lng) : undefined

    const relevantCategories = [category, ...requiredSkills]
    const technicians = await Technician.find({
      approvalStatus: 'approved',
      $or: [{ categories: { $in: relevantCategories } }, { skills: { $in: relevantCategories } }]
    }).select('-passwordHash')

    const scored = technicians
      .map((t) => {
        const obj = t.toObject()
        return { ...obj, ...computeMatchScore(t, { category, requiredSkills, customerLat, customerLng }) }
      })
      // Online technicians first, then by match score.
      .sort((a, b) => (b.isOnline - a.isOnline) || (b.matchScore - a.matchScore))

    res.json({ success: true, technicians: scored, weights: W })
  } catch (err) { next(err) }
}

export async function updateOnlineStatus(req, res, next) {
  try {
    const { isOnline } = req.body
    const technician = await Technician.findByIdAndUpdate(req.user.id, { isOnline }, { new: true }).select('-passwordHash')
    res.json({ success: true, technician })
  } catch (err) { next(err) }
}

export async function getEarnings(req, res, next) {
  try {
    const bookings = await Booking.find({ technician: req.user.id, status: 'completed' })
    // Earnings reflect what the technician actually receives — the quoted
    // total minus the platform's commission — not the customer's full payment.
    const totalEarnings = bookings.reduce((sum, b) => sum + (b.fare?.technicianPayout || 0), 0)
    const totalCommissionPaid = bookings.reduce((sum, b) => sum + (b.fare?.platformCommission || 0), 0)
    res.json({ success: true, completedJobs: bookings.length, totalEarnings, totalCommissionPaid })
  } catch (err) { next(err) }
}

export async function getMe(req, res, next) {
  try {
    const technician = await Technician.findById(req.user.id).select('-passwordHash')
    res.json({ success: true, technician })
  } catch (err) { next(err) }
}
