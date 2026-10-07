import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageCircle, CalendarClock, Zap, RotateCcw, KeyRound, Navigation, RefreshCw } from 'lucide-react'
import { api } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { socket } from '../services/socket.js'
import ChatModal from '../components/ChatModal.jsx'
import BookingProgress from '../components/BookingProgress.jsx'

const SLOT_LABELS = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', night: 'Night' }
const STATUS_LABEL = {
  requested: 'Waiting for quote', accepted: 'Waiting for quote', quote_sent: 'Quote received', quote_accepted: 'Confirmed',
  technician_arriving: 'On the way', arrived: 'Technician arrived', inspection: 'Inspecting', in_progress: 'Work in progress',
  completed: 'Completed', cancelled: 'Cancelled'
}
const STATUS_TONE = {
  requested: 'text-trust bg-trust-50', accepted: 'text-trust bg-trust-50', quote_sent: 'text-amber-700 bg-amber-50',
  quote_accepted: 'text-okgreen bg-okgreen-50', technician_arriving: 'text-trust bg-trust-50', arrived: 'text-amber-700 bg-amber-50',
  inspection: 'text-amber-700 bg-amber-50', in_progress: 'text-signal bg-signal-50', completed: 'text-okgreen bg-okgreen-50', cancelled: 'text-ink-400 bg-mist'
}
const TRACKABLE = ['quote_accepted', 'technician_arriving', 'arrived', 'in_progress']
const CHATTABLE = ['quote_sent', 'quote_accepted', 'technician_arriving', 'arrived', 'in_progress', 'completed']
const OTP_STATUSES = ['quote_accepted', 'technician_arriving', 'arrived']
const CANCELLABLE = ['requested', 'quote_sent', 'quote_accepted']
const FILTERS = [['active', 'Active'], ['past', 'Past'], ['all', 'All']]

function loadRazorpay() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true)
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.onload = () => resolve(true)
    s.onerror = () => resolve(false)
    document.body.appendChild(s)
  })
}

// Pays AFTER the work is completed. With live Razorpay keys on the server this
// opens the real Checkout and sends the signature back for server-side
// verification; without keys the server runs a clearly-labelled demo order.
function PayButton({ booking, user, onPaid }) {
  const [state, setState] = useState('idle')
  const [error, setError] = useState('')

  async function pay() {
    setState('processing'); setError('')
    try {
      const { data: order } = await api.post('/payment/create-order', { bookingId: booking._id })

      if (order.demo) {
        await new Promise((r) => setTimeout(r, 1200))
        await api.post('/payment/verify', { bookingId: booking._id, razorpayOrderId: order.orderId })
        setState('idle'); onPaid(booking._id); return
      }

      if (!(await loadRazorpay())) throw new Error('Could not load the payment window. Check your connection.')
      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: Math.round(order.amount * 100), // paise
        currency: 'INR',
        name: 'FixNow',
        description: `${booking.category.replace('-', ' ')} service`,
        order_id: order.orderId,
        prefill: { name: user?.name, contact: user?.phone },
        theme: { color: '#FF6A3D' },
        handler: async (resp) => {
          try {
            await api.post('/payment/verify', {
              bookingId: booking._id,
              razorpayOrderId: resp.razorpay_order_id,
              razorpayPaymentId: resp.razorpay_payment_id,
              razorpaySignature: resp.razorpay_signature
            })
            onPaid(booking._id)
          } catch (e) {
            setError(e.response?.data?.message || 'Payment could not be verified')
          } finally { setState('idle') }
        },
        modal: { ondismiss: () => setState('idle') }
      })
      rzp.on('payment.failed', () => { setError('Payment failed. You have not been charged — please try again.'); setState('idle') })
      rzp.open()
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Could not start payment')
      setState('idle')
    }
  }

  return (
    <div className="text-right">
      <button onClick={pay} disabled={state === 'processing'} className="text-xs font-semibold bg-signal text-white px-4 py-2 rounded-full disabled:opacity-60 shadow-pop">
        {state === 'processing' ? 'Processing…' : `Pay ₹${booking.fare?.total}`}
      </button>
      {error && <p className="text-[10px] text-signal-700 mt-1 max-w-[200px]">{error}</p>}
    </div>
  )
}

function QuoteCard({ booking, onDone }) {
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function respond(action) {
    setLoading(true)
    try {
      await api.patch(`/booking/${booking._id}/quote/respond`, { action })
      // Accepting generates the OTP — take the customer straight to live tracking.
      if (action === 'accept') navigate(`/tracking/${booking._id}`)
      else onDone()
    } finally { setLoading(false) }
  }

  return (
    <div className="mt-3 rounded-2xl bg-amber-50/70 border border-amber-100 p-4">
      <p className="text-[11px] font-semibold text-amber-800 uppercase tracking-wide">Quote from {booking.technician?.name}</p>
      <div className="flex items-end justify-between mt-1">
        <p className="font-display font-bold text-ink text-3xl">₹{booking.quote.amount}</p>
        {booking.estimatedCost?.min && (
          <p className="text-[11px] text-ink-400 pb-1">Estimated: ₹{booking.estimatedCost.min}–₹{booking.estimatedCost.max}</p>
        )}
      </div>
      {booking.quote.finalProblem && <p className="text-xs text-ink mt-1">{booking.quote.finalProblem}</p>}
      {(booking.quote.labourCost > 0 || booking.quote.partsCost > 0) && (
        <p className="text-[11px] text-ink-400 mt-0.5">Labour ₹{booking.quote.labourCost || 0} · Parts ₹{booking.quote.partsCost || 0}</p>
      )}
      {booking.quote.note && <p className="text-xs text-ink-400 italic mt-1">"{booking.quote.note}"</p>}
      <p className="text-[10px] text-ink-400 mt-2">This is the exact amount you pay — nothing is added. You pay only after the work is finished.</p>
      <div className="flex gap-2 mt-3">
        <button onClick={() => respond('reject')} disabled={loading} className="flex-1 bg-white border border-ink-100 text-ink-400 text-xs font-semibold py-2.5 rounded-xl disabled:opacity-60">Decline</button>
        <button onClick={() => respond('accept')} disabled={loading} className="flex-[2] bg-signal text-white text-xs font-semibold py-2.5 rounded-xl disabled:opacity-60">Accept & Confirm</button>
      </div>
    </div>
  )
}

function OtpCard({ booking, onChanged }) {
  const [busy, setBusy] = useState(false)
  async function regenerate() {
    setBusy(true)
    try { await api.patch(`/booking/${booking._id}/regenerate-otp`); onChanged() } finally { setBusy(false) }
  }
  return (
    <div className="mt-3 rounded-2xl bg-ink p-4 text-white">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-ink-100 flex items-center gap-1"><KeyRound size={12} /> Your OTP — share it only when the technician arrives</p>
        <button onClick={regenerate} disabled={busy} title="Generate a new code"><RefreshCw size={13} className={`text-ink-100 ${busy ? 'animate-spin' : ''}`} /></button>
      </div>
      <div className="flex gap-2 mt-2">
        {String(booking.otp).split('').map((d, i) => (
          <span key={i} className="dispatch-digit w-10 h-12 rounded-lg bg-white/10 flex items-center justify-center text-2xl font-bold">{d}</span>
        ))}
      </div>
    </div>
  )
}

export default function BookingHistory() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('active')
  const [chatId, setChatId] = useState(null)
  const navigate = useNavigate()
  const { user } = useAuth()

  function reload() { api.get('/booking/me').then((r) => setBookings(r.data.bookings)).finally(() => setLoading(false)) }
  useEffect(() => {
    reload()
    // Live refresh whenever any of my bookings changes state.
    if (user?.id) socket.emit('user:join', user.id)
    socket.on('notification:new', reload)
    return () => socket.off('notification:new', reload)
  }, [user?.id])

  const visible = bookings.filter((b) => {
    const past = ['completed', 'cancelled'].includes(b.status) && (b.status === 'cancelled' || b.paymentStatus === 'paid' || b.paid)
    return filter === 'all' ? true : filter === 'past' ? past : !past
  })

  async function cancel(id) {
    if (!window.confirm('Cancel this booking?')) return
    await api.patch(`/booking/${id}/cancel`)
    reload()
  }

  const chatBooking = bookings.find((b) => b._id === chatId)

  return (
    <div className="px-5 pt-6">
      <h1 className="font-display font-bold text-xl text-ink">My bookings</h1>
      <div className="flex gap-2 mt-3 mb-4">
        {FILTERS.map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)}
            className={`text-xs font-semibold px-4 py-1.5 rounded-full ${filter === id ? 'bg-ink text-white' : 'bg-mist text-ink-400'}`}>{label}</button>
        ))}
      </div>

      {loading && <div className="flex flex-col gap-3">{[1, 2].map((i) => <div key={i} className="h-40 rounded-2xl skeleton" />)}</div>}
      {!loading && visible.length === 0 && (
        <div className="text-center py-14">
          <p className="text-sm font-medium text-ink">{filter === 'active' ? 'No active bookings' : 'Nothing here yet'}</p>
          <button onClick={() => navigate('/home')} className="mt-3 text-xs font-semibold bg-signal text-white px-5 py-2 rounded-full">Book a service</button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {visible.map((b) => {
          const paid = b.paymentStatus === 'paid' || b.paid
          return (
            <div key={b._id} className="bg-white border border-ink-100 rounded-2xl p-4 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-ink text-sm capitalize flex items-center gap-1.5">
                    {b.category.replace('-', ' ')}
                    {b.isEmergency && <span className="text-[9px] font-bold bg-signal text-white px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Zap size={8} /> URGENT</span>}
                  </p>
                  <p className="text-xs text-ink-400 truncate">{b.technician?.name || 'Finding a technician'} · {new Date(b.createdAt).toLocaleDateString()}</p>
                  {b.isScheduled && (
                    <p className="text-[11px] text-trust font-medium mt-1 flex items-center gap-1"><CalendarClock size={11} /> {b.scheduledDate} · {SLOT_LABELS[b.scheduledSlot]}</p>
                  )}
                </div>
                <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${STATUS_TONE[b.status] || 'bg-mist text-ink-400'}`}>
                  {b.status === 'completed' && paid ? 'Paid' : STATUS_LABEL[b.status] || b.status}
                </span>
              </div>

              {b.problemDescription && <p className="text-xs text-ink-400 mt-2 italic">"{b.problemDescription}"</p>}
              <BookingProgress booking={b} />

              {['requested', 'accepted'].includes(b.status) && (
                <div className="mt-3 bg-mist rounded-xl p-3">
                  {b.estimatedCost?.min && <p className="text-xs text-ink">Estimated cost: <strong>₹{b.estimatedCost.min} – ₹{b.estimatedCost.max}</strong></p>}
                  <p className="text-[11px] text-ink-400 mt-0.5">Your technician is reviewing the video and will send you a price.</p>
                </div>
              )}

              {b.status === 'quote_sent' && <QuoteCard booking={b} onDone={reload} />}
              {OTP_STATUSES.includes(b.status) && b.otp && <OtpCard booking={b} onChanged={reload} />}

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-ink-100 gap-2">
                <div>
                  <p className="text-[10px] text-ink-400">{b.fare?.total ? 'Total' : 'Quote'}</p>
                  <p className="font-display font-bold text-ink">{b.fare?.total ? `₹${b.fare.total}` : b.quote?.amount ? `₹${b.quote.amount}` : '—'}</p>
                </div>
                <div className="flex items-center gap-2">
                  {CANCELLABLE.includes(b.status) && <button onClick={() => cancel(b._id)} className="text-[11px] font-medium text-ink-400 underline">Cancel</button>}
                  {CHATTABLE.includes(b.status) && (
                    <button onClick={() => setChatId(b._id)} className="w-9 h-9 rounded-full bg-mist flex items-center justify-center"><MessageCircle size={15} className="text-ink" /></button>
                  )}
                  {TRACKABLE.includes(b.status) && (
                    <button onClick={() => navigate(`/tracking/${b._id}`)} className="text-xs font-semibold bg-ink text-white px-4 py-2 rounded-full flex items-center gap-1.5"><Navigation size={12} /> Track</button>
                  )}
                  {b.status === 'completed' && !paid && <PayButton booking={b} user={user} onPaid={reload} />}
                  {b.status === 'completed' && paid && b.technician && (
                    <button onClick={() => navigate(`/analyze/${b.category}`)} className="text-xs font-semibold text-trust flex items-center gap-1"><RotateCcw size={12} /> Book again</button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {chatBooking && <ChatModal bookingId={chatBooking._id} apiInstance={api} currentUserName={user?.name} otherPartyName={chatBooking.technician?.name} onClose={() => setChatId(null)} />}
    </div>
  )
}
