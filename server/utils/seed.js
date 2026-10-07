// Run with: node utils/seed.js
// Seeds 12 service categories, 5 approved technicians per category (60 total),
// and 1 admin account.
import 'dotenv/config'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import Category from '../models/Category.js'
import Technician from '../models/Technician.js'
import Admin from '../models/Admin.js'
import User from '../models/User.js'
import Booking from '../models/Booking.js'

const categories = [
  { name: 'Electrician', slug: 'electrician', icon: 'zap', order: 1 },
  { name: 'Plumber', slug: 'plumber', icon: 'wrench', order: 2 },
  { name: 'AC Repair', slug: 'ac-repair', icon: 'wind', order: 3 },
  { name: 'RO Repair', slug: 'ro-repair', icon: 'droplets', order: 4 },
  { name: 'Carpenter', slug: 'carpenter', icon: 'hammer', order: 5 },
  { name: 'Painter', slug: 'painter', icon: 'paintbrush', order: 6 },
  { name: 'CCTV Installation', slug: 'cctv', icon: 'camera', order: 7 },
  { name: 'Washing Machine Repair', slug: 'washing-machine', icon: 'washing-machine', order: 8 },
  { name: 'Refrigerator Repair', slug: 'fridge', icon: 'refrigerator', order: 9 },
  { name: 'Pest Control', slug: 'pest-control', icon: 'bug', order: 10 },
  { name: 'House Cleaning', slug: 'house-cleaning', icon: 'sparkles', order: 11 },
  { name: 'Appliance Repair', slug: 'appliance', icon: 'settings', order: 12 }
]

// 5 named technicians per category, each with a distinct bio, base charge,
// rating and experience so the technician list actually looks like a real
// marketplace instead of repeated placeholders.
const TECHNICIANS_BY_CATEGORY = {
  electrician: [
    { name: 'Ravi Kumar', exp: 7, bio: 'Licensed electrician specializing in home wiring, fan/light repair, and MCB troubleshooting.', charge: 199, rating: 4.9 },
    { name: 'Manoj Reddy', exp: 4, bio: 'Fast response for fuse box issues, switchboard upgrades, and short-circuit diagnosis.', charge: 179, rating: 4.6 },
    { name: 'Srinivas Rao', exp: 12, bio: '12 years in industrial and residential wiring; also handles inverter and stabilizer setup.', charge: 249, rating: 4.8 },
    { name: 'Anil Kumar', exp: 3, bio: 'Specializes in smart switch and modular board installation for new-age homes.', charge: 169, rating: 4.5 },
    { name: 'Prakash Naidu', exp: 9, bio: 'Certified electrician for AC point wiring, geyser connections, and earthing work.', charge: 219, rating: 4.7 }
  ],
  plumber: [
    { name: 'Suresh Yadav', exp: 5, bio: 'Plumbing specialist — leak repairs, tap/pipe fitting, and bathroom fixture installation.', charge: 249, rating: 4.7 },
    { name: 'Ramesh Gupta', exp: 8, bio: 'Expert in bore-well pump repair, overhead tank plumbing, and drainage clearing.', charge: 229, rating: 4.6 },
    { name: 'Naveen Patil', exp: 3, bio: 'Quick fixes for dripping taps, flush tank issues, and kitchen sink installation.', charge: 189, rating: 4.4 },
    { name: 'Dinesh Chowdary', exp: 10, bio: 'Full bathroom re-piping, water heater plumbing, and sump connection specialist.', charge: 269, rating: 4.8 },
    { name: 'Ganesh Rao', exp: 6, bio: 'Handles both PVC and CPVC pipeline work, plus washbasin and geyser fittings.', charge: 209, rating: 4.5 }
  ],
  'ac-repair': [
    { name: 'Ali Sheikh', exp: 9, bio: 'Certified HVAC technician with 9 years servicing split and window ACs.', charge: 349, rating: 4.8 },
    { name: 'Faizan Ahmed', exp: 5, bio: 'Gas refilling, compressor repair, and AC deep cleaning specialist.', charge: 299, rating: 4.6 },
    { name: 'Ravinder Singh', exp: 11, bio: 'Handles inverter AC and central cooling systems for homes and small offices.', charge: 379, rating: 4.9 },
    { name: 'Kishore Babu', exp: 4, bio: 'Fast AC not-cooling diagnosis and PCB/sensor replacement.', charge: 279, rating: 4.5 },
    { name: 'Imran Khan', exp: 7, bio: 'AC installation, uninstallation, and annual maintenance contracts.', charge: 319, rating: 4.7 }
  ],
  'ro-repair': [
    { name: 'Sanjay Verma', exp: 6, bio: 'RO/UV/UF water purifier repair — filter replacement and membrane servicing.', charge: 229, rating: 4.6 },
    { name: 'Vinod Mehta', exp: 3, bio: 'Quick RO leak fixes and new purifier installation for all major brands.', charge: 189, rating: 4.4 },
    { name: 'Harish Chandra', exp: 8, bio: 'RO + water softener combo systems, annual maintenance specialist.', charge: 259, rating: 4.7 },
    { name: 'Arjun Malhotra', exp: 5, bio: 'TDS calibration, pump replacement, and taste/odor issue diagnosis.', charge: 209, rating: 4.5 },
    { name: 'Deepak Joshi', exp: 4, bio: 'Affordable RO servicing with same-day filter replacement.', charge: 199, rating: 4.5 }
  ],
  carpenter: [
    { name: 'Vikram Singh', exp: 11, bio: 'Custom furniture, door/window repair, and modular fitting — 11 years experience.', charge: 279, rating: 4.6 },
    { name: 'Ramu Naik', exp: 6, bio: 'Wardrobe and cabinet repair specialist, also handles hinge and lock replacement.', charge: 229, rating: 4.5 },
    { name: 'Suraj Thakur', exp: 9, bio: 'Custom wood furniture builds and polish/finishing work.', charge: 299, rating: 4.7 },
    { name: 'Mahesh Pillai', exp: 4, bio: 'Door alignment, false ceiling wood work, and window frame repair.', charge: 219, rating: 4.4 },
    { name: 'Ashok Verma', exp: 13, bio: '13 years in bespoke carpentry — kitchen units, study tables, and bed frames.', charge: 329, rating: 4.8 }
  ],
  painter: [
    { name: 'Ramesh Babu', exp: 7, bio: 'Interior and exterior wall painting, texture finishes, and waterproofing touch-ups.', charge: 249, rating: 4.6 },
    { name: 'Krishna Murthy', exp: 5, bio: 'Fast single-room repaint specialist with low-odor paint options.', charge: 199, rating: 4.4 },
    { name: 'Satish Kumar', exp: 10, bio: 'Full home painting projects, texture and stencil design work.', charge: 289, rating: 4.7 },
    { name: 'Bharat Reddy', exp: 4, bio: 'Touch-up and patch painting for rental and resale-ready homes.', charge: 179, rating: 4.3 },
    { name: 'Nagesh Rao', exp: 8, bio: 'Waterproof exterior coating and damp-wall treatment specialist.', charge: 259, rating: 4.6 }
  ],
  cctv: [
    { name: 'Rajesh Iyer', exp: 6, bio: 'Home and shop CCTV installation, DVR/NVR setup, and mobile app configuration.', charge: 399, rating: 4.7 },
    { name: 'Vivek Nair', exp: 4, bio: 'Wireless CCTV and doorbell camera specialist for apartments.', charge: 349, rating: 4.5 },
    { name: 'Sathish Menon', exp: 9, bio: 'Multi-camera commercial setups with remote monitoring configuration.', charge: 449, rating: 4.8 },
    { name: 'Arvind Rao', exp: 3, bio: 'Budget-friendly single/dual camera installs for small homes.', charge: 299, rating: 4.3 },
    { name: 'Mohit Sharma', exp: 7, bio: 'CCTV troubleshooting, cable re-routing, and storage upgrade specialist.', charge: 379, rating: 4.6 }
  ],
  'washing-machine': [
    { name: 'Ramu Das', exp: 6, bio: 'Front-load and top-load washing machine repair, drum and motor specialist.', charge: 249, rating: 4.6 },
    { name: 'Sunil Nayak', exp: 4, bio: 'Quick fixes for water-leak and spin-cycle issues, all major brands.', charge: 209, rating: 4.4 },
    { name: 'Prasad Rao', exp: 9, bio: 'PCB and control panel repair specialist for semi and fully automatic machines.', charge: 279, rating: 4.7 },
    { name: 'Kiran Kumar', exp: 3, bio: 'Same-day washing machine servicing and installation.', charge: 189, rating: 4.3 },
    { name: 'Ravi Teja', exp: 7, bio: 'Drainage pump and belt replacement specialist.', charge: 239, rating: 4.5 }
  ],
  fridge: [
    { name: 'Anand Verma', exp: 8, bio: 'Refrigerator not-cooling diagnosis, gas refill, and compressor repair.', charge: 299, rating: 4.7 },
    { name: 'Rakesh Mishra', exp: 5, bio: 'Double-door and side-by-side fridge repair specialist.', charge: 259, rating: 4.5 },
    { name: 'Sanjeev Kapoor', exp: 10, bio: 'Thermostat, defrost timer, and door-seal replacement expert.', charge: 319, rating: 4.8 },
    { name: 'Yogesh Pandey', exp: 3, bio: 'Fast fixes for minor fridge issues at an affordable rate.', charge: 219, rating: 4.3 },
    { name: 'Naresh Kumar', exp: 6, bio: 'Mini-fridge and visi-cooler repair for homes and small shops.', charge: 249, rating: 4.5 }
  ],
  'pest-control': [
    { name: 'Balaji Shetty', exp: 6, bio: 'Cockroach, termite, and general pest treatment with eco-friendly options.', charge: 349, rating: 4.6 },
    { name: 'Ramana Murthy', exp: 9, bio: 'Termite pre-construction and post-construction treatment specialist.', charge: 399, rating: 4.8 },
    { name: 'Chandu Prasad', exp: 4, bio: 'Mosquito and rodent control for apartments and independent homes.', charge: 279, rating: 4.4 },
    { name: 'Srikanth Reddy', exp: 7, bio: 'Bed bug and cockroach gel-treatment specialist with follow-up visits.', charge: 329, rating: 4.6 },
    { name: 'Gopal Krishna', exp: 5, bio: 'General pest control packages for homes, offices, and warehouses.', charge: 299, rating: 4.5 }
  ],
  'house-cleaning': [
    { name: 'Meena Devi', exp: 4, bio: 'Deep-cleaning specialist for homes and offices, eco-friendly products on request.', charge: 299, rating: 5.0 },
    { name: 'Lakshmi Amma', exp: 7, bio: 'Full-home deep clean including kitchen degreasing and bathroom descaling.', charge: 329, rating: 4.8 },
    { name: 'Radha Kumari', exp: 3, bio: 'Move-in/move-out cleaning specialist, same-day service available.', charge: 259, rating: 4.5 },
    { name: 'Saroja Devi', exp: 9, bio: 'Sofa, carpet, and upholstery deep cleaning in addition to home cleaning.', charge: 349, rating: 4.7 },
    { name: 'Kavitha Rani', exp: 5, bio: 'Regular and one-time home cleaning packages, pet-friendly products available.', charge: 279, rating: 4.6 }
  ],
  appliance: [
    { name: 'Vikas Malhotra', exp: 6, bio: 'General home appliance repair — microwave, mixer, and small kitchen appliances.', charge: 219, rating: 4.5 },
    { name: 'Rohit Sinha', exp: 4, bio: 'Chimney and exhaust fan repair, installation, and deep cleaning.', charge: 229, rating: 4.4 },
    { name: 'Ajay Bhatt', exp: 9, bio: 'Water heater/geyser repair and appliance installation specialist.', charge: 269, rating: 4.7 },
    { name: 'Manish Tiwari', exp: 3, bio: 'Fan, cooler, and small appliance quick-fix specialist.', charge: 179, rating: 4.3 },
    { name: 'Pankaj Yadav', exp: 7, bio: 'Multi-brand appliance troubleshooting and part replacement.', charge: 239, rating: 4.6 }
  ]
}

// Roughly spread technicians across nearby coordinates so distance-based
// sorting/filtering has something realistic to work with.
const BASE_LAT = 17.43
const BASE_LNG = 78.41

const CUSTOMER_NAMES = [
  'Karthik Reddy', 'Priya Sharma', 'Ananya Iyer', 'Rahul Verma', 'Sneha Patel',
  'Arjun Nair', 'Divya Krishnan', 'Mohammed Faisal', 'Lakshmi Narayan', 'Vikash Kumar',
  'Pooja Menon', 'Siddharth Rao', 'Neha Gupta', 'Aditya Singh', 'Meera Pillai',
  'Harsha Vardhan', 'Swathi Reddy', 'Imran Qureshi', 'Kavya Shetty', 'Rohit Malhotra'
]

const PROBLEMS = {
  electrician: ['Ceiling fan not rotating properly', 'Switchboard sparking', 'Tube light not working'],
  plumber: ['Tap leaking continuously', 'Bathroom drain blocked', 'Low water pressure'],
  'ac-repair': ['AC not cooling', 'Water dripping from indoor unit', 'AC making loud noise'],
  'ro-repair': ['RO water tastes bad', 'RO leaking below the unit'],
  carpenter: ['Wardrobe door hinge broken', 'Main door not closing'],
  painter: ['Wall paint peeling', 'Damp patch on ceiling'],
  cctv: ['Camera feed not showing', 'Need 2 new cameras installed'],
  'washing-machine': ['Machine not spinning', 'Water not draining'],
  fridge: ['Fridge not cooling', 'Ice build-up in freezer'],
  'pest-control': ['Cockroach infestation in kitchen', 'Termites in wardrobe'],
  'house-cleaning': ['Deep clean for 2BHK', 'Post-renovation cleaning'],
  appliance: ['Microwave not heating', 'Chimney very noisy']
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const COMMISSION = 0.15

async function buildTechnicians() {
  const passwordHash = await bcrypt.hash('tech1234', 10)
  const technicians = []
  let phoneCounter = 1
  for (const cat of categories) {
    const roster = TECHNICIANS_BY_CATEGORY[cat.slug] || []
    roster.forEach((t, i) => {
      const phone = '90000000' + String(phoneCounter).padStart(2, '0')
      phoneCounter += 1
      const completedJobs = 80 + t.exp * 60 + i * 17
      technicians.push({
        name: t.name, phone, passwordHash, categories: [cat.slug], skills: [cat.slug],
        experienceYears: t.exp, bio: t.bio, baseCharge: t.charge, rating: t.rating,
        totalRatings: completedJobs, completedJobs, isOnline: true, approvalStatus: 'approved',
        currentLocation: { lat: BASE_LAT + (Math.random() - 0.5) * 0.06, lng: BASE_LNG + (Math.random() - 0.5) * 0.06 }
      })
    })
  }
  return technicians
}

async function seed() {
  await mongoose.connect(process.env.MONGO_URI)

  // UPSERTS (not delete + recreate): documents keep their _id, so any real
  // bookings you made while testing remain attached to the right technician.
  for (const c of categories) await Category.updateOne({ slug: c.slug }, { $set: c }, { upsert: true })

  const technicians = await buildTechnicians()
  for (const t of technicians) await Technician.updateOne({ phone: t.phone }, { $set: t }, { upsert: true })

  const adminHash = await bcrypt.hash('admin123', 10)
  await Admin.updateOne({ email: 'admin@fixnow.com' }, { $set: { name: 'FixNow Admin', passwordHash: adminHash } }, { upsert: true })

  // Demo customers: 9800000001 … 98000000NN, password cust1234
  const custHash = await bcrypt.hash('cust1234', 10)
  const customerPhones = []
  for (let i = 0; i < CUSTOMER_NAMES.length; i++) {
    const phone = '98000000' + String(i + 1).padStart(2, '0')
    customerPhones.push(phone)
    await User.updateOne({ phone }, { $set: { name: CUSTOMER_NAMES[i], phone, passwordHash: custHash, isVerified: true } }, { upsert: true })
  }
  const customers = await User.find({ phone: { $in: customerPhones } })
  const techDocs = await Technician.find({ phone: /^90000000/ })

  // Demo bookings (flagged isDemo so a re-seed replaces only these). Only
  // states that are internally consistent are generated — no half-finished OTP jobs.
  await Booking.deleteMany({ isDemo: true })
  const plan = [
    ...Array(16).fill({ status: 'completed', paid: true }),
    ...Array(3).fill({ status: 'completed', paid: false }),
    ...Array(3).fill({ status: 'requested' }),
    ...Array(3).fill({ status: 'quote_sent' }),
    ...Array(3).fill({ status: 'cancelled' })
  ]
  const slots = ['morning', 'afternoon', 'evening', 'night']
  const docs = plan.map((p, n) => {
    const tech = pick(techDocs)
    const category = tech.categories[0]
    const amount = Math.round((tech.baseCharge * (0.9 + Math.random() * 0.9)) / 10) * 10
    const commission = Math.round(amount * COMMISSION)
    const daysAgo = Math.floor(Math.random() * 28)
    const scheduled = n % 5 === 0
    const base = {
      isDemo: true, customer: pick(customers)._id, technician: tech._id, category,
      problemDescription: pick(PROBLEMS[category] || ['General fault']),
      isScheduled: scheduled, scheduledDate: scheduled ? new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0] : undefined,
      scheduledSlot: scheduled ? pick(slots) : undefined,
      address: { line1: 'Flat 402, Sunrise Residency', city: 'Hyderabad', lat: BASE_LAT, lng: BASE_LNG },
      estimatedCost: { min: Math.round(amount * 0.8 / 10) * 10, max: Math.round(amount * 1.2 / 10) * 10, currency: 'INR' },
      createdAt: new Date(Date.now() - daysAgo * 86400000)
    }
    if (p.status === 'requested') return { ...base, status: 'requested', quote: { status: 'pending' } }
    if (p.status === 'quote_sent') return { ...base, status: 'quote_sent', quote: { amount, status: 'sent', labourCost: amount, partsCost: 0, submittedAt: new Date() } }
    if (p.status === 'cancelled') return { ...base, status: 'cancelled', quote: { status: 'rejected', amount } }
    return {
      ...base, status: 'completed', completedAt: new Date(base.createdAt.getTime() + 3600000),
      quote: { amount, status: 'accepted', labourCost: amount, partsCost: 0 },
      fare: { total: amount, platformCommissionRate: COMMISSION, platformCommission: commission, technicianPayout: amount - commission },
      paymentStatus: p.paid ? 'paid' : 'pending', paid: !!p.paid, paidAt: p.paid ? new Date(base.createdAt.getTime() + 7200000) : undefined
    }
  })
  await Booking.insertMany(docs)

  console.log(`✅ Seeded ${categories.length} categories, ${technicians.length} technicians (5 per category), ${customers.length} customers, ${docs.length} demo bookings, 1 admin`)
  console.log('   Admin       → admin@fixnow.com / admin123')
  console.log('   Technicians → 9000000001 … 9000000060 / tech1234   (9000000001 = Ravi Kumar, Electrician)')
  console.log('   Customers   → 9800000001 … 9800000020 / cust1234   (9800000001 = Karthik Reddy)')
  await mongoose.disconnect()
}

seed().catch((err) => { console.error('❌ Seed failed:', err.message); process.exit(1) })
