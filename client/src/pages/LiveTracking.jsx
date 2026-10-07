import React, { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, KeyRound, Phone, MessageCircle, ShieldCheck, Star, RefreshCw, CheckCircle2, Wrench } from 'lucide-react'
import { api } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { socket } from '../services/socket.js'
import BookingProgress from '../components/BookingProgress.jsx'
import ChatModal from '../components/ChatModal.jsx'

// Stand-in map driven by Socket.IO progress pings. docs/GO_LIVE.md shows how to
// swap this single component for a real map (Leaflet/OpenStreetMap or Google Maps)
// without touching any of the socket wiring around it.
function SimulatedMap({ progress }) {
  const x = 40 + progress * 220
  const y = 160 - progress * 90
  return (
    <svg viewBox="0 0 300 200" className="w-full h-52 rounded-2xl bg-ink-50">
      <path d="M40 160 C 100 60, 200 200, 260 60" stroke="#2F6FED" strokeWidth="3" strokeDasharray="6 6" fill="none" opacity="0.5" />
      <circle cx="40" cy="160" r="6" fill="#14213D" />
      <circle cx="260" cy="60" r="7" fill="#17A673" />
      <circle cx={x} cy={y} r="9" fill="#FF6A3D" style={{ transition: 'cx 0.9s linear, cy 0.9s linear' }} />
    </svg>
  )
}

const HEADLINE = {
  quote_accepted: ['Booking confirmed', 'Your technician will set off shortly.'],
  technician_arriving: ['Technician is on the way', 'Keep your OTP ready.'],
  arrived: ['Technician has arrived', 'Read your OTP out to start the work.'],
  in_progress: ['Work in progress', 'Your technician has been verified and started the job.'],
  completed: ['Work completed', 'Review the amount and pay to finish.'],
  cancelled: ['Booking cancelled', '']
}

export default function LiveTracking() {
  const { bookingId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [booking, setBooking] = useState(null)
  const [progress, setProgress] = useState(0)
  const [chat, setChat] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => api.get(`/booking/${bookingId}`).then((r) => setBooking(r.data.booking)), [bookingId])

  useEffect(() => {
    load()
    socket.emit('booking:join', bookingId)
    socket.on('technician:location', ({ progress }) => setProgress(progress))
    socket.on('booking:status', load) // re-fetch so OTP / amounts stay accurate
    return () => { socket.off('technician:location'); socket.off('booking:status', load) }
  }, [bookingId, load])

  async function regenerate() {
    setBusy(true)
    try { await api.patch(`/booking/${bookingId}/regenerate-otp`); await load() } finally { setBusy(false) }
  }

  if (!booking) return <div className="p-6"><div className="h-52 rounded-2xl skeleton" /></div>

  const [title, sub] = HEADLINE[booking.status] || ['Booking', '']
  const eta = Math.max(0, Math.round((1 - progress) * 8))
  const t = booking.technician
  const showOtp = ['quote_accepted', 'technician_arriving', 'arrived'].includes(booking.status) && booking.otp
  const moving = booking.status === 'technician_arriving'

  return (
    <div className="pb-8">
      <div className="px-5 pt-5 pb-3 flex items-center gap-3">
        <button onClick={() => navigate('/bookings')}><ArrowLeft size={20} className="text-ink" /></button>
        <h1 className="font-display font-semibold text-ink">Track your service</h1>
      </div>

      <div className="px-5">
        <SimulatedMap progress={Math.min(progress, 1)} />

        <div className="mt-4 flex items-start justify-between">
          <div>
            <p className="font-display font-bold text-ink text-lg leading-tight">{title}</p>
            <p className="text-xs text-ink-400 mt-0.5">{sub}</p>
          </div>
          {moving && (
            <div className="text-right">
              <p className="dispatch-digit bg-ink text-white text-xl font-semibold rounded-lg px-3 py-1">{eta} min</p>
              <p className="text-[10px] text-ink-400 mt-0.5">ETA</p>
            </div>
          )}
        </div>

        <BookingProgress booking={booking} />

        {/* OTP — shown only to the customer, only until work starts */}
        {showOtp && (
          <div className="mt-5 rounded-2xl bg-ink p-4 text-white">
            <div className="flex items-center justify-between">
              <p className="text-xs text-ink-100 flex items-center gap-1.5"><KeyRound size={13} /> Your OTP</p>
              <button onClick={regenerate} disabled={busy} className="text-[10px] text-ink-100 flex items-center gap-1">
                <RefreshCw size={11} className={busy ? 'animate-spin' : ''} /> New code
              </button>
            </div>
            <div className="flex gap-2.5 mt-2.5">
              {String(booking.otp).split('').map((d, i) => (
                <span key={i} className="dispatch-digit w-12 h-14 rounded-xl bg-white/10 flex items-center justify-center text-3xl font-bold">{d}</span>
              ))}
            </div>
            <p className="text-[11px] text-ink-100 mt-3">
              Share this only <strong>after</strong> the technician arrives. The work can't start without it, and nobody else can see it.
            </p>
          </div>
        )}

        {booking.status === 'in_progress' && (
          <div className="mt-5 rounded-2xl bg-okgreen-50 p-4 flex items-center gap-3">
            <Wrench size={18} className="text-okgreen" />
            <p className="text-sm text-ink">Verified ✓ — your technician is working on it now.</p>
          </div>
        )}

        {booking.status === 'completed' && (
          <div className="mt-5 rounded-2xl bg-signal-50 p-4">
            <p className="text-sm font-semibold text-ink flex items-center gap-1.5"><CheckCircle2 size={15} className="text-okgreen" /> The job is done</p>
            <p className="text-xs text-ink-400 mt-1">Total to pay: <strong className="text-ink">₹{booking.fare?.total}</strong>. Payment is only taken now, after the work.</p>
            <button onClick={() => navigate('/bookings')} className="mt-3 w-full bg-signal text-white text-sm font-semibold py-3 rounded-xl">Review & Pay</button>
          </div>
        )}

        {t && (
          <div className="mt-5 bg-white border border-ink-100 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-trust to-ink text-white font-semibold flex items-center justify-center">{t.name.slice(0, 2).toUpperCase()}</div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-ink text-sm flex items-center gap-1">{t.name} <ShieldCheck size={13} className="text-trust" /></p>
                <p className="text-xs text-ink-400 flex items-center gap-2"><span className="flex items-center gap-0.5 text-amber-500"><Star size={11} fill="currentColor" />{t.rating}</span><span>{t.experienceYears} yrs</span></p>
              </div>
              <a href={`tel:${t.phone}`} className="w-10 h-10 rounded-full bg-okgreen text-white flex items-center justify-center"><Phone size={16} /></a>
              <button onClick={() => setChat(true)} className="w-10 h-10 rounded-full bg-mist flex items-center justify-center"><MessageCircle size={16} className="text-ink" /></button>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-ink-100 text-xs">
              <span className="text-ink-400 capitalize">{booking.category.replace('-', ' ')}</span>
              <span className="font-display font-bold text-ink">₹{booking.fare?.total}</span>
            </div>
          </div>
        )}
      </div>

      {chat && t && <ChatModal bookingId={bookingId} apiInstance={api} currentUserName={user?.name} otherPartyName={t.name} onClose={() => setChat(false)} />}
    </div>
  )
}
