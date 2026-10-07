import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Star, ShieldCheck, SlidersHorizontal, Sparkles, TrendingUp } from 'lucide-react'
import { api } from '../services/api.js'

const AVATAR_COLORS = ['from-signal to-signal-700', 'from-trust to-ink', 'from-okgreen to-trust', 'from-amber-400 to-signal', 'from-purple-500 to-trust']

export default function ServiceDetail() {
  const { categorySlug } = useParams()
  const navigate = useNavigate()
  const [technicians, setTechnicians] = useState([])
  const [priceEstimate, setPriceEstimate] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sort, setSort] = useState('match') // 'match' | 'price'

  useEffect(() => {
    // Passing our (demo) location lets the backend factor proximity into
    // each technician's match score — falls back gracefully if unavailable.
    const demoLat = 17.43
    const demoLng = 78.41
    api.get(`/technician/category/${categorySlug}`, { params: { lat: demoLat, lng: demoLng } })
      .then((res) => { setTechnicians(res.data.technicians); setPriceEstimate(res.data.priceEstimate) })
      .catch(() => setError('Could not load technicians.'))
      .finally(() => setLoading(false))
  }, [categorySlug])

  const sorted = useMemo(() => {
    const list = [...technicians]
    if (sort === 'match') return list.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))
    return list.sort((a, b) => a.baseCharge - b.baseCharge)
  }, [technicians, sort])

  const bestMatchId = sorted.length ? [...sorted].sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))[0]._id : null

  return (
    <div className="pb-6">
      <div className="bg-gradient-to-br from-ink to-ink-700 px-5 pt-6 pb-6 rounded-b-[2rem] text-white relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-signal/10 blur-2xl" />
        <button onClick={() => navigate(-1)} className="mb-3 relative"><ArrowLeft size={20} /></button>
        <h1 className="font-display text-xl font-bold capitalize relative">{categorySlug.replace('-', ' ')}</h1>
        {!loading && <p className="text-xs text-ink-100 mt-1 relative">{technicians.length} verified technicians available nearby</p>}
      </div>

      <div className="px-5 mt-4">
        {/* Category-level price estimate — an honest min/max range across
            currently active technicians, NOT a trained ML price prediction.
            Shown before the customer even picks a technician, per the ask
            to estimate cost up front. */}
        {!loading && priceEstimate && (
          <div className="bg-trust-50 rounded-2xl p-3 mb-4 flex items-start gap-2">
            <TrendingUp size={16} className="text-trust mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-trust">
                Estimated cost: ₹{priceEstimate.min} – ₹{priceEstimate.max}
              </p>
              <p className="text-xs text-ink-400 mt-0.5">
                Based on current technicians' typical rates for this service. Your exact price is confirmed after a technician reviews your problem.
              </p>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-card skeleton" />)}
          </div>
        )}
        {error && <p className="text-sm text-signal-700">{error}</p>}
        {!loading && !error && technicians.length === 0 && <p className="text-sm text-ink-400">No technicians online for this category right now.</p>}

        {!loading && technicians.length > 0 && (
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-ink-400">Showing {sorted.length} technicians</p>
            <button onClick={() => setSort(sort === 'match' ? 'price' : 'match')} className="flex items-center gap-1 text-xs font-medium text-trust">
              <SlidersHorizontal size={13} /> Sort: {sort === 'match' ? 'Best match' : 'Lowest price'}
            </button>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {sorted.map((t, i) => (
            <motion.div
              key={t._id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-card shadow-card p-4 flex items-center gap-4 relative"
            >
              {t._id === bestMatchId && (
                <span className="absolute -top-2 left-3 bg-okgreen text-white text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                  <Sparkles size={10} /> Best match
                </span>
              )}
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${AVATAR_COLORS[i % AVATAR_COLORS.length]} flex items-center justify-center font-display font-semibold text-white shrink-0`}>
                {t.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-ink text-sm flex items-center gap-1">{t.name} <ShieldCheck size={14} className="text-trust shrink-0" /></p>
                <div className="flex items-center gap-3 text-xs text-ink-400 mt-1">
                  <span className="flex items-center gap-1 text-amber-500 font-medium"><Star size={13} fill="currentColor" /> {t.rating || 'New'}</span>
                  <span>{t.completedJobs} jobs</span>
                  <span>{t.experienceYears} yrs exp</span>
                </div>
                {typeof t.matchScore === 'number' && (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <div className="flex-1 max-w-[100px] h-1.5 bg-ink-100 rounded-full overflow-hidden">
                      <div className="h-full bg-trust rounded-full" style={{ width: `${Math.min(t.matchScore, 100)}%` }} />
                    </div>
                    <span className="text-[10px] text-trust font-semibold">{Math.min(t.matchScore, 100)}% match</span>
                  </div>
                )}
              </div>
              <div className="text-right shrink-0">
                {/* One combined number — this already reflects what the customer
                    would pay, no separate platform fee shown anywhere. */}
                <p className="font-display font-bold text-ink">from ₹{t.baseCharge}</p>
                <button onClick={() => navigate(`/analyze/${categorySlug}`)} className="mt-2 text-xs font-semibold bg-signal text-white px-3 py-1.5 rounded-full">Describe Problem</button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
