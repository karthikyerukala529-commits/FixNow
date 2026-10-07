import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Power, LogOut, PlayCircle, ShieldCheck, KeyRound, Briefcase, Wallet, MessageCircle, CalendarClock, Zap,
  Star, Phone, MapPin, Navigation, CheckCircle2, Clock, Lock, Inbox
} from 'lucide-react'
import { technicianApi } from '../services/api.js'
import { socket } from '../services/socket.js'
import { useTechnicianAuth } from '../context/TechnicianAuthContext.jsx'
import ChatModal from '../components/ChatModal.jsx'
import NotificationBell from '../components/NotificationBell.jsx'
import BookingProgress from '../components/BookingProgress.jsx'

const SLOT_LABELS = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', night: 'Night' }
const COMMISSION = 0.15
const CHATTABLE = ['quote_sent', 'quote_accepted', 'technician_arriving', 'arrived', 'in_progress', 'completed']

const STATUS_CHIP = {
  requested: ['New request', 'bg-trust-50 text-trust'], accepted: ['New request', 'bg-trust-50 text-trust'],
  quote_sent: ['Awaiting customer', 'bg-amber-50 text-amber-700'], quote_accepted: ['Confirmed', 'bg-okgreen-50 text-okgreen'],
  technician_arriving: ['On the way', 'bg-trust-50 text-trust'], arrived: ['Arrived', 'bg-amber-50 text-amber-700'],
  in_progress: ['Working', 'bg-signal-50 text-signal'], completed: ['Completed', 'bg-okgreen-50 text-okgreen'], cancelled: ['Cancelled', 'bg-mist text-ink-400']
}
const TABS = [
  { id: 'new', label: 'New', match: (b) => ['requested', 'accepted'].includes(b.status) },
  { id: 'active', label: 'Active', match: (b) => ['quote_sent', 'quote_accepted', 'technician_arriving', 'arrived', 'in_progress'].includes(b.status) },
  { id: 'done', label: 'Done', match: (b) => ['completed', 'cancelled'].includes(b.status) }
]

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium text-ink-400">{label}</span>
      {children}
    </label>
  )
}
const inputCls = 'w-full mt-1 px-3 py-2.5 rounded-xl border border-ink-100 text-sm outline-none focus:border-trust bg-white'

// STAGE 1 — watch the customer's video, then send the quote.
function QuotePanel({ booking, onDone }) {
  const [showVideo, setShowVideo] = useState(false)
  const [labour, setLabour] = useState('')
  const [parts, setParts] = useState('')
  const [diagnosis, setDiagnosis] = useState(booking.aiAnalysis?.detectedProblem || '')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const total = (Number(labour) || 0) + (Number(parts) || 0)

  async function send() {
    if (total <= 0) { setErr('Enter your labour and/or parts cost'); return }
    setBusy(true); setErr('')
    try {
      await technicianApi.patch(`/booking/${booking._id}/quote`, { amount: total, labourCost: Number(labour) || 0, partsCost: Number(parts) || 0, finalProblem: diagnosis, note })
      onDone()
    } catch (e) { setErr(e.response?.data?.message || 'Could not send the quote') }
    finally { setBusy(false) }
  }
  async function decline() {
    if (!window.confirm('Decline this job?')) return
    await technicianApi.patch(`/booking/${booking._id}/respond`, { action: 'reject' })
    onDone()
  }

  return (
    <div className="mt-4 space-y-3">
      {booking.problemVideoUrl ? (
        !showVideo ? (
          <button onClick={() => setShowVideo(true)} className="w-full flex items-center justify-center gap-2 bg-ink text-white rounded-xl py-3 text-sm font-semibold">
            <PlayCircle size={18} /> Watch customer's video
          </button>
        ) : <video src={booking.problemVideoUrl} controls autoPlay className="w-full rounded-xl bg-black max-h-72" />
      ) : <p className="text-xs text-ink-400 bg-mist rounded-xl p-3">The customer didn't attach a video.</p>}

      {booking.estimatedCost?.min && (
        <div className="bg-trust-50 rounded-xl p-3 text-xs text-ink">
          <span className="font-semibold text-trust">AI estimate shown to the customer:</span> ₹{booking.estimatedCost.min} – ₹{booking.estimatedCost.max}
          {booking.aiAnalysis?.severity && <span className="text-ink-400"> · {booking.aiAnalysis.severity} severity</span>}
        </div>
      )}

      <Field label="What's wrong? (diagnosis)">
        <input value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="e.g. Fan capacitor failed" className={inputCls} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Labour (₹)"><input type="number" inputMode="numeric" value={labour} onChange={(e) => setLabour(e.target.value)} placeholder="0" className={inputCls} /></Field>
        <Field label="Parts (₹)"><input type="number" inputMode="numeric" value={parts} onChange={(e) => setParts(e.target.value)} placeholder="0" className={inputCls} /></Field>
      </div>
      <Field label="Note for the customer (optional)"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Includes 3-month warranty" className={inputCls} /></Field>

      <div className="bg-mist rounded-xl p-3 flex items-center justify-between">
        <div>
          <p className="text-[11px] text-ink-400">Customer pays</p>
          <p className="font-display font-bold text-ink text-xl">₹{total}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-ink-400">You earn (after {Math.round(COMMISSION * 100)}% fee)</p>
          <p className="font-display font-bold text-okgreen text-xl">₹{total - Math.round(total * COMMISSION)}</p>
        </div>
      </div>

      {err && <p className="text-xs text-signal-700">{err}</p>}
      <div className="flex gap-2">
        <button onClick={decline} className="flex-1 border border-ink-100 text-ink-400 text-sm font-semibold py-3 rounded-xl">Decline</button>
        <button onClick={send} disabled={busy || total <= 0} className="flex-[2] bg-trust text-white text-sm font-semibold py-3 rounded-xl disabled:opacity-50">
          {busy ? 'Sending…' : 'Send quote to customer'}
        </button>
      </div>
    </div>
  )
}

// STAGE 4 — customer's OTP is required before any work can start.
function OtpPanel({ booking, onDone }) {
  const [otp, setOtp] = useState('')
  const [err, setErr] = useState('')
  const [left, setLeft] = useState(null)
  const [locked, setLocked] = useState(false)
  const [busy, setBusy] = useState(false)

  async function verify() {
    setBusy(true); setErr('')
    try {
      await technicianApi.post(`/booking/${booking._id}/verify-otp`, { otp })
      onDone()
    } catch (e) {
      const d = e.response?.data || {}
      setErr(d.message || 'Could not verify the OTP')
      setLeft(d.attemptsLeft ?? null)
      setLocked(!!d.locked)
      setOtp('')
    } finally { setBusy(false) }
  }

  return (
    <div className="mt-4 rounded-2xl border-2 border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-semibold text-amber-900 flex items-center gap-1.5"><KeyRound size={15} /> Verify the customer to start work</p>
      <p className="text-xs text-amber-800/80 mt-1">Ask the customer for the 4-digit OTP shown in their app. You can't see it — only they can.</p>
      {locked ? (
        <div className="mt-3 bg-white rounded-xl p-3 flex items-start gap-2">
          <Lock size={15} className="text-signal mt-0.5 shrink-0" />
          <p className="text-xs text-ink">{err}</p>
        </div>
      ) : (
        <>
          <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" placeholder="• • • •"
            className="w-full mt-3 text-center text-3xl tracking-[0.5em] font-mono font-bold py-3 rounded-xl border border-amber-200 bg-white outline-none focus:border-amber-500" />
          {err && <p className="text-xs text-signal-700 mt-2 font-medium">{err}</p>}
          {left !== null && left > 0 && <p className="text-[11px] text-amber-800/70 mt-1">Wrong guesses are limited to protect the customer.</p>}
          <button onClick={verify} disabled={busy || otp.length < 4} className="w-full mt-3 bg-amber-600 text-white text-sm font-semibold py-3 rounded-xl disabled:opacity-50">
            {busy ? 'Checking…' : 'Verify & start work'}
          </button>
        </>
      )}
    </div>
  )
}

function JobCard({ b, onChange, onChat }) {
  const [label, tone] = STATUS_CHIP[b.status] || [b.status, 'bg-mist text-ink-400']
  const [busy, setBusy] = useState(false)
  const paid = b.paymentStatus === 'paid' || b.paid

  async function setStatus(status) {
    setBusy(true)
    try {
      await technicianApi.patch(`/booking/${b._id}/status`, { status })
      if (status === 'technician_arriving') {
        // Simulated GPS pings — replace with real geolocation (see docs/GO_LIVE.md).
        let progress = 0
        const timer = setInterval(() => {
          progress += 0.12
          socket.emit('technician:location_update', { bookingId: b._id, progress: Math.min(progress, 1) })
          if (progress >= 1) clearInterval(timer)
        }, 1000)
      }
      onChange()
    } finally { setBusy(false) }
  }

  return (
    <div className="bg-white rounded-2xl border border-ink-100 shadow-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display font-semibold text-ink capitalize flex items-center gap-1.5">
            {b.category.replace('-', ' ')}
            {b.isEmergency && <span className="text-[9px] font-bold bg-signal text-white px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Zap size={8} /> URGENT</span>}
          </p>
          {b.isScheduled && (
            <p className="text-[11px] text-trust font-medium mt-0.5 flex items-center gap-1"><CalendarClock size={11} /> {b.scheduledDate} · {SLOT_LABELS[b.scheduledSlot]}</p>
          )}
        </div>
        <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${tone}`}>{label}</span>
      </div>

      <div className="mt-3 flex items-center gap-3 bg-mist rounded-xl p-3">
        <div className="w-9 h-9 rounded-full bg-ink text-white text-xs font-semibold flex items-center justify-center">{(b.customer?.name || '?').slice(0, 2).toUpperCase()}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink truncate">{b.customer?.name || 'Customer'}</p>
          {b.address?.line1 && <p className="text-[11px] text-ink-400 flex items-center gap-1 truncate"><MapPin size={10} /> {b.address.line1}, {b.address.city}</p>}
        </div>
        {b.customer?.phone && <a href={`tel:${b.customer.phone}`} className="w-9 h-9 rounded-full bg-okgreen text-white flex items-center justify-center"><Phone size={14} /></a>}
        {CHATTABLE.includes(b.status) && (
          <button onClick={() => onChat(b._id)} className="w-9 h-9 rounded-full bg-white border border-ink-100 flex items-center justify-center"><MessageCircle size={14} className="text-ink" /></button>
        )}
      </div>

      {b.problemDescription && <p className="text-xs text-ink-400 italic mt-2.5">"{b.problemDescription}"</p>}
      <BookingProgress booking={b} />

      {['requested', 'accepted'].includes(b.status) && <QuotePanel booking={b} onDone={onChange} />}

      {b.status === 'quote_sent' && (
        <div className="mt-4 bg-amber-50 rounded-xl p-3 flex items-start gap-2">
          <Clock size={15} className="text-amber-700 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-900">Quote sent — ₹{b.quote?.amount}</p>
            <p className="text-xs text-amber-800/80">Waiting for the customer to accept. You'll be notified instantly.</p>
          </div>
        </div>
      )}

      {b.status === 'quote_accepted' && (
        <div className="mt-4">
          <div className="bg-okgreen-50 rounded-xl p-3 mb-3">
            <p className="text-sm font-semibold text-ink flex items-center gap-1.5"><CheckCircle2 size={15} className="text-okgreen" /> Customer accepted ₹{b.fare?.total}</p>
            <p className="text-xs text-ink-400 mt-0.5">You'll earn ₹{b.fare?.technicianPayout}. Head to the address above.</p>
          </div>
          <button onClick={() => setStatus('technician_arriving')} disabled={busy} className="w-full bg-signal text-white text-sm font-semibold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60">
            <Navigation size={15} /> Start heading over
          </button>
        </div>
      )}

      {b.status === 'technician_arriving' && (
        <button onClick={() => setStatus('arrived')} disabled={busy} className="w-full mt-4 bg-trust text-white text-sm font-semibold py-3 rounded-xl disabled:opacity-60">
          I've arrived at the location
        </button>
      )}

      {b.status === 'arrived' && <OtpPanel booking={b} onDone={onChange} />}

      {b.status === 'in_progress' && (
        <button onClick={() => setStatus('completed')} disabled={busy} className="w-full mt-4 bg-okgreen text-white text-sm font-semibold py-3 rounded-xl disabled:opacity-60">
          Mark work as completed
        </button>
      )}

      {b.status === 'completed' && (
        <div className={`mt-4 rounded-xl p-3 flex items-center justify-between ${paid ? 'bg-okgreen-50' : 'bg-mist'}`}>
          <p className="text-sm font-semibold text-ink">{paid ? 'Paid ✓' : 'Waiting for customer payment'}</p>
          <p className="font-display font-bold text-ink">₹{paid ? b.fare?.technicianPayout : b.fare?.total}<span className="text-[10px] text-ink-400 font-normal ml-1">{paid ? 'credited' : 'total'}</span></p>
        </div>
      )}
    </div>
  )
}

export default function TechnicianDashboard() {
  const { technician, logout } = useTechnicianAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [bookings, setBookings] = useState([])
  const [earnings, setEarnings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('new')
  const [chatId, setChatId] = useState(null)

  function loadAll() {
    Promise.all([technicianApi.get('/technician/me'), technicianApi.get('/booking/technician/me'), technicianApi.get('/technician/earnings')])
      .then(([me, bk, er]) => { setProfile(me.data.technician); setBookings(bk.data.bookings); setEarnings(er.data) })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!technician) { navigate('/technician/login'); return }
    loadAll()
    socket.emit('technician:join', technician.id)
    socket.emit('user:join', technician.id)
    socket.on('booking:new_request', loadAll)
    socket.on('notification:new', loadAll)
    return () => { socket.off('booking:new_request', loadAll); socket.off('notification:new', loadAll) }
  }, [technician])

  async function toggleOnline() {
    const { data } = await technicianApi.patch('/technician/status', { isOnline: !profile.isOnline })
    setProfile(data.technician)
  }

  const counts = useMemo(() => Object.fromEntries(TABS.map((t) => [t.id, bookings.filter(t.match).length])), [bookings])
  const list = useMemo(() => bookings.filter(TABS.find((t) => t.id === tab).match), [bookings, tab])
  const chatBooking = bookings.find((b) => b._id === chatId)

  if (!technician) return null
  if (loading) return <div className="max-w-3xl mx-auto p-6"><div className="h-40 rounded-2xl skeleton" /></div>

  return (
    <div className="min-h-screen bg-mist pb-10">
      <div className="bg-gradient-to-br from-ink to-ink-700 text-white pt-6 pb-8 rounded-b-[2rem] relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-trust/15 blur-2xl" />
        <div className="max-w-3xl mx-auto px-5 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-signal to-signal-700 flex items-center justify-center font-bold">{profile?.name?.slice(0, 2).toUpperCase()}</div>
              <div>
                <p className="text-[11px] text-ink-100 flex items-center gap-1"><ShieldCheck size={11} /> Technician</p>
                <p className="font-display font-bold text-lg leading-tight">{profile?.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell apiInstance={technicianApi} userId={technician?.id} dark />
              <button onClick={toggleOnline} className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-semibold ${profile?.isOnline ? 'bg-okgreen' : 'bg-white/15'}`}>
                <Power size={14} /> {profile?.isOnline ? 'Online' : 'Offline'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            {[
              { icon: Briefcase, label: 'Jobs done', value: earnings?.completedJobs ?? 0 },
              { icon: Wallet, label: 'Earnings (paid)', value: `₹${profile?.walletBalance ?? 0}` },
              { icon: Star, label: 'Rating', value: profile?.rating || 'New' },
              { icon: Inbox, label: 'New requests', value: counts.new }
            ].map((s) => (
              <div key={s.label} className="bg-white/10 rounded-2xl p-3">
                <p className="text-[11px] text-ink-100 flex items-center gap-1"><s.icon size={11} /> {s.label}</p>
                <p className="font-display font-bold text-xl mt-0.5">{s.value}</p>
              </div>
            ))}
          </div>
          {earnings?.totalCommissionPaid > 0 && (
            <p className="text-[11px] text-ink-100 mt-3">After FixNow's {Math.round(COMMISSION * 100)}% platform fee (₹{earnings.totalCommissionPaid} so far). Customers are never charged on top of your quote.</p>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-5 -mt-4 relative">
        <div className="bg-white rounded-2xl shadow-card p-1.5 flex gap-1">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 text-sm font-semibold py-2.5 rounded-xl flex items-center justify-center gap-1.5 ${tab === t.id ? 'bg-ink text-white' : 'text-ink-400'}`}>
              {t.label}
              {counts[t.id] > 0 && <span className={`text-[10px] min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center ${tab === t.id ? 'bg-signal text-white' : 'bg-mist text-ink-400'}`}>{counts[t.id]}</span>}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-4">
          {list.length === 0 && (
            <div className="text-center py-14 bg-white rounded-2xl">
              <p className="text-sm font-medium text-ink">{tab === 'new' ? 'No new requests right now' : tab === 'active' ? 'No active jobs' : 'No completed jobs yet'}</p>
              <p className="text-xs text-ink-400 mt-1">{profile?.isOnline ? 'New jobs appear here instantly.' : 'Go online to start receiving jobs.'}</p>
            </div>
          )}
          {list.map((b) => <JobCard key={b._id} b={b} onChange={loadAll} onChat={setChatId} />)}
        </div>

        <button onClick={() => { logout(); navigate('/technician/login') }} className="flex items-center gap-2 text-signal text-sm font-medium mt-8">
          <LogOut size={16} /> Log out
        </button>
      </div>

      {chatBooking && <ChatModal bookingId={chatBooking._id} apiInstance={technicianApi} currentUserName={profile?.name} otherPartyName={chatBooking.customer?.name} onClose={() => setChatId(null)} />}
    </div>
  )
}
