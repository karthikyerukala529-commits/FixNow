import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { MapPin, Search, ChevronRight, Video, Calculator, UserCheck, Wallet, ShieldCheck, Navigation, KeyRound, X } from 'lucide-react'
import { api } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { iconMap } from '../utils/iconMap.js'
import BookingProgress from '../components/BookingProgress.jsx'

// Soft tinted tiles — each service gets its own colour so the grid scans quickly.
const TILE_TONES = [
  'bg-amber-50 text-amber-600', 'bg-trust-50 text-trust', 'bg-sky-50 text-sky-600', 'bg-cyan-50 text-cyan-600',
  'bg-orange-50 text-orange-600', 'bg-fuchsia-50 text-fuchsia-600', 'bg-slate-100 text-slate-600', 'bg-teal-50 text-teal-600',
  'bg-indigo-50 text-indigo-600', 'bg-lime-50 text-lime-700', 'bg-pink-50 text-pink-600', 'bg-gray-100 text-gray-600'
]

const BANNERS = [
  { title: 'Show us the problem', sub: 'Upload a video and get an instant cost estimate', cta: 'Get an estimate', grad: 'from-signal to-signal-700' },
  { title: 'Pay only after the work', sub: 'No advance. You pay once the job is done and approved', cta: 'How it works', grad: 'from-trust to-ink' },
  { title: 'Verified at your door', sub: 'Every visit is confirmed with your private OTP', cta: 'Book a technician', grad: 'from-okgreen to-trust' }
]

const STEPS = [
  { icon: Video, title: 'Share a video', body: 'Record the problem — a short clip is enough.' },
  { icon: Calculator, title: 'Get an estimate', body: 'Instant approximate cost from the AI.' },
  { icon: UserCheck, title: 'Pick a technician', body: 'Only relevant, skilled professionals.' },
  { icon: Wallet, title: 'Pay after the job', body: 'Approve the final quote, pay when done.' }
]

const TRUST = [
  { icon: ShieldCheck, title: 'Verified professionals', body: 'Reviewed and approved by our team' },
  { icon: Navigation, title: 'Live tracking', body: 'See your technician arrive in real time' },
  { icon: KeyRound, title: 'OTP-secured visits', body: 'Work starts only after you share your code' }
]

const STATUS_LABEL = {
  requested: 'Waiting for quote', quote_sent: 'Quote received', quote_accepted: 'Confirmed',
  technician_arriving: 'On the way', arrived: 'Arrived', in_progress: 'Work in progress', completed: 'Completed'
}

export default function Home() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [categories, setCategories] = useState([])
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    api.get('/category').then((r) => setCategories(r.data.categories))
      .catch(() => setError('Could not load services. Is the server running?'))
      .finally(() => setLoading(false))
    api.get('/booking/me').then((r) => setRecent(r.data.bookings.slice(0, 2))).catch(() => {})
  }, [])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return categories
    return categories.filter((c) => c.name.toLowerCase().includes(q) || c.slug.replace('-', ' ').includes(q))
  }, [categories, query])

  const firstName = (user?.name || 'there').split(' ')[0]

  return (
    <div>
      {/* Header */}
      <div className="px-5 pt-5 pb-4 bg-white sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <button className="text-left">
            <p className="text-[10px] uppercase tracking-wide text-ink-400 flex items-center gap-1"><MapPin size={11} className="text-signal" /> Service at</p>
            <p className="font-display font-semibold text-ink text-sm flex items-center gap-1">Jubilee Hills, Hyderabad <ChevronRight size={14} className="rotate-90 text-ink-400" /></p>
          </button>
          <button onClick={() => navigate('/profile')} className="w-9 h-9 rounded-full bg-gradient-to-br from-signal to-signal-700 text-white text-xs font-bold flex items-center justify-center">
            {firstName.slice(0, 2).toUpperCase()}
          </button>
        </div>

        <h1 className="font-display text-[22px] font-bold text-ink mt-4 leading-tight">Hi {firstName}, what needs fixing today?</h1>

        <div className="mt-3 flex items-center gap-2 bg-mist rounded-xl px-4 py-3">
          <Search size={17} className="text-ink-400 shrink-0" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search 'fan repair', 'AC service', 'tap leak'..."
            className="flex-1 bg-transparent outline-none text-sm text-ink placeholder:text-ink-400" />
          {query && <button onClick={() => setQuery('')}><X size={15} className="text-ink-400" /></button>}
        </div>
      </div>

      {/* Services */}
      <section className="px-5 mt-2">
        <h2 className="font-display font-semibold text-ink mb-3">{query ? `Results for "${query}"` : 'Our services'}</h2>
        {loading && <div className="grid grid-cols-3 gap-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 rounded-2xl skeleton" />)}</div>}
        {error && <p className="text-sm text-signal-700">{error}</p>}
        {!loading && !error && results.length === 0 && <p className="text-sm text-ink-400">No service matches that. Try "electrician" or "plumber".</p>}
        <div className="grid grid-cols-3 gap-3">
          {results.map((c, i) => {
            const Icon = iconMap[c.icon] || iconMap.settings
            return (
              <motion.button key={c._id} whileTap={{ scale: 0.95 }} onClick={() => navigate(`/analyze/${c.slug}`)}
                className="flex flex-col items-center text-center">
                <div className={`w-full aspect-[1/0.85] rounded-2xl flex items-center justify-center ${TILE_TONES[i % TILE_TONES.length]}`}>
                  <Icon size={28} strokeWidth={1.8} />
                </div>
                <span className="text-[11px] font-medium text-ink mt-1.5 leading-tight">{c.name}</span>
              </motion.button>
            )
          })}
        </div>
      </section>

      {/* Promo carousel */}
      {!query && (
        <section className="mt-6">
          <div className="flex gap-3 overflow-x-auto px-5 snap-x snap-mandatory scrollbar-hide pb-1">
            {BANNERS.map((b) => (
              <div key={b.title} className={`snap-start shrink-0 w-[78%] rounded-2xl p-4 text-white bg-gradient-to-br ${b.grad} relative overflow-hidden`}>
                <div className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full bg-white/10" />
                <p className="font-display font-bold text-lg leading-tight relative">{b.title}</p>
                <p className="text-xs text-white/85 mt-1 relative">{b.sub}</p>
                <span className="inline-block mt-3 text-[11px] font-semibold bg-white/20 px-3 py-1.5 rounded-full relative">{b.cta} →</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Active / recent bookings */}
      {!query && recent.length > 0 && (
        <section className="px-5 mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-semibold text-ink">Your bookings</h2>
            <button onClick={() => navigate('/bookings')} className="text-xs font-medium text-signal">See all</button>
          </div>
          <div className="flex flex-col gap-3">
            {recent.map((b) => (
              <button key={b._id} onClick={() => navigate('/bookings')} className="text-left bg-white border border-ink-100 rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-ink text-sm capitalize">{b.category.replace('-', ' ')}</p>
                  <span className="text-[10px] font-semibold text-trust bg-trust-50 px-2 py-1 rounded-full">{STATUS_LABEL[b.status] || b.status}</span>
                </div>
                <p className="text-xs text-ink-400 mt-0.5">{b.technician?.name || 'Finding a technician'}</p>
                <BookingProgress booking={b} compact />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* How it works */}
      {!query && (
        <section className="px-5 mt-7">
          <h2 className="font-display font-semibold text-ink mb-3">How FixNow works</h2>
          <div className="grid grid-cols-2 gap-3">
            {STEPS.map((s, i) => (
              <div key={s.title} className="bg-mist rounded-2xl p-3.5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center"><s.icon size={16} className="text-signal" /></div>
                  <span className="text-[10px] font-bold text-ink-400">STEP {i + 1}</span>
                </div>
                <p className="text-sm font-semibold text-ink mt-2">{s.title}</p>
                <p className="text-[11px] text-ink-400 mt-0.5">{s.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Trust */}
      {!query && (
        <section className="px-5 mt-7 mb-4">
          <div className="border border-ink-100 rounded-2xl divide-y divide-ink-100">
            {TRUST.map((t) => (
              <div key={t.title} className="flex items-center gap-3 p-3.5">
                <div className="w-9 h-9 rounded-full bg-okgreen-50 flex items-center justify-center shrink-0"><t.icon size={16} className="text-okgreen" /></div>
                <div>
                  <p className="text-sm font-semibold text-ink">{t.title}</p>
                  <p className="text-[11px] text-ink-400">{t.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
