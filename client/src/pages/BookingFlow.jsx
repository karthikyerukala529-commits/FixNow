import React, { useRef, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Video, X, Sparkles, Star, TrendingUp, CalendarClock, Zap, ShieldCheck } from 'lucide-react'
import { api } from '../services/api.js'

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const CATEGORY_LABELS = {
  electrician: 'Electrician', plumber: 'Plumber', 'ac-repair': 'AC Repair', 'ro-repair': 'RO Repair',
  carpenter: 'Carpenter', painter: 'Painter', cctv: 'CCTV Installation', 'washing-machine': 'Washing Machine Repair',
  fridge: 'Refrigerator Repair', 'pest-control': 'Pest Control', 'house-cleaning': 'House Cleaning', appliance: 'Appliance Repair'
}

const SLOTS = [
  { id: 'morning', label: 'Morning', hint: '9 AM – 12 PM' },
  { id: 'afternoon', label: 'Afternoon', hint: '12 PM – 4 PM' },
  { id: 'evening', label: 'Evening', hint: '4 PM – 8 PM' },
  { id: 'night', label: 'Night', hint: '8 PM – 10 PM' }
]

// Captures a single frame from the uploaded video, classifies it via the
// CLIP-based AI service, then — directly below the confidence score — shows
// a cost estimate and the top 3 recommended technicians for that predicted
// category, so the customer doesn't have to leave this screen to compare.
function AiSuggestion({ videoRef, onPickTechnician }) {
  const [status, setStatus] = useState('idle') // idle -> loading -> done -> error
  const [result, setResult] = useState(null)
  const [recommended, setRecommended] = useState([])
  const [priceEstimate, setPriceEstimate] = useState(null)
  const [error, setError] = useState('')
  const canvasRef = useRef(null)

  async function runClassification() {
    setStatus('loading')
    setError('')
    try {
      const video = videoRef.current
      const canvas = canvasRef.current
      canvas.width = video.videoWidth || 480
      canvas.height = video.videoHeight || 360
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
      const formData = new FormData()
      formData.append('image', blob, 'frame.jpg')

      const { data } = await api.post('/ai/classify-service', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setResult(data)

      // Fetch recommended technicians + a price estimate for the predicted
      // category, so both appear right under the confidence score.
      const techRes = await api.get(`/technician/category/${data.predictedCategory}`, { params: { lat: 17.43, lng: 78.41 } })
      setRecommended(techRes.data.technicians.slice(0, 3))
      setPriceEstimate(techRes.data.priceEstimate)

      setStatus('done')
    } catch (err) {
      setError(err.response?.data?.message || 'AI service unavailable — is ai-service/main.py running on port 8000?')
      setStatus('error')
    }
  }

  return (
    <div className="mt-3">
      <canvas ref={canvasRef} className="hidden" />
      {status === 'idle' && (
        <button onClick={runClassification} className="w-full flex items-center justify-center gap-2 bg-trust-50 text-trust text-xs font-semibold py-2.5 rounded-xl">
          <Sparkles size={14} /> Get AI category suggestion from this video
        </button>
      )}
      {status === 'loading' && (
        <p className="text-xs text-ink-400 text-center py-2">Analyzing frame with CLIP zero-shot classifier...</p>
      )}
      {status === 'error' && <p className="text-xs text-signal-700">{error}</p>}
      {status === 'done' && result && (
        <div className="bg-trust-50 rounded-xl p-3">
          <p className="text-xs text-trust font-semibold mb-1 flex items-center gap-1"><Sparkles size={13} /> AI Suggestion</p>
          <p className="text-sm text-ink">
            Likely category: <span className="font-bold">{CATEGORY_LABELS[result.predictedCategory] || result.predictedCategory}</span>
            <span className="text-ink-400"> ({result.confidence}% confidence)</span>
          </p>
          <p className="text-[10px] text-ink-400 mt-1 mb-3">This is a suggestion only — you choose the final category and technician.</p>

          {priceEstimate && (
            <div className="flex items-center gap-1.5 bg-white rounded-lg px-3 py-2 mb-3">
              <TrendingUp size={13} className="text-okgreen shrink-0" />
              <p className="text-xs text-ink">
                Estimated cost: <span className="font-semibold">₹{priceEstimate.min} – ₹{priceEstimate.max}</span>
              </p>
            </div>
          )}

          {recommended.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-ink-700 mb-2">Recommended technicians for this issue</p>
              <div className="flex flex-col gap-2">
                {recommended.map((t) => (
                  <div key={t._id} className="bg-white rounded-xl p-2.5 flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-trust to-ink flex items-center justify-center text-white text-[11px] font-semibold shrink-0">
                      {t.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-ink truncate flex items-center gap-1">{t.name} <ShieldCheck size={11} className="text-trust shrink-0" /></p>
                      <p className="text-[10px] text-ink-400 flex items-center gap-2">
                        <span className="flex items-center gap-0.5 text-amber-500"><Star size={10} fill="currentColor" /> {t.rating}</span>
                        <span>{t.experienceYears} yrs</span>
                        <span className="text-trust font-medium">{t.matchScore}% match</span>
                      </p>
                    </div>
                    <button
                      onClick={() => onPickTechnician(t._id, result.predictedCategory)}
                      className="text-[10px] font-semibold bg-signal text-white px-2.5 py-1.5 rounded-full shrink-0"
                    >
                      Book Now
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function BookingFlow() {
  const { technicianId } = useParams()
  const [params] = useSearchParams()
  const [category, setCategory] = useState(params.get('category'))
  const [activeTechnicianId, setActiveTechnicianId] = useState(technicianId)
  const navigate = useNavigate()
  const [problem, setProblem] = useState('')
  const [videoFile, setVideoFile] = useState(null)
  const [videoPreview, setVideoPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const videoRef = useRef(null)

  // Advance booking: ASAP by default, or the customer can schedule for a
  // later date/time slot — e.g. a plumbing issue reported midweek but the
  // customer is only free on the weekend.
  const [scheduleMode, setScheduleMode] = useState('now') // 'now' | 'later'
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledSlot, setScheduledSlot] = useState('morning')
  const [isEmergency, setIsEmergency] = useState(false)

  const todayStr = new Date().toISOString().split('T')[0]

  function handleVideoSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 15 * 1024 * 1024) {
      setError('Video is too large — please keep it under 15MB (a short 5-10 second clip is plenty).')
      return
    }
    setError('')
    setVideoFile(file)
    setVideoPreview(URL.createObjectURL(file))
  }

  function handlePickRecommended(newTechnicianId, newCategory) {
    setActiveTechnicianId(newTechnicianId)
    setCategory(newCategory)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleConfirm() {
    if (scheduleMode === 'later' && !scheduledDate) {
      setError('Pick a date for your scheduled visit')
      return
    }
    setLoading(true)
    setError('')
    try {
      const problemVideoUrl = videoFile ? await fileToBase64(videoFile) : undefined
      const { data } = await api.post('/booking', {
        technicianId: activeTechnicianId, category, problemDescription: problem, problemVideoUrl,
        isScheduled: scheduleMode === 'later',
        scheduledDate: scheduleMode === 'later' ? scheduledDate : undefined,
        scheduledSlot: scheduleMode === 'later' ? scheduledSlot : undefined,
        isEmergency,
        address: { line1: 'Flat 402, Sunrise Residency', city: 'Hyderabad', lat: 17.43, lng: 78.41 }
      })
      navigate('/bookings', { state: { justBooked: data.booking._id } })
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create booking')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen pb-6">
      <div className="px-5 pt-6 pb-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)}><ArrowLeft size={20} className="text-ink" /></button>
        <h1 className="font-display font-semibold text-ink">Request a quote</h1>
      </div>
      <div className="px-5">
        <div className="bg-trust-50 rounded-2xl p-3 mb-4">
          <p className="text-xs text-trust font-medium">Show the technician the actual problem on video — they'll send you a real price instead of a guessed one.</p>
        </div>

        <label className="text-xs font-medium text-ink-400">Describe the problem</label>
        <textarea value={problem} onChange={(e) => setProblem(e.target.value)} placeholder="e.g. Ceiling fan not spinning, makes a clicking noise"
          className="w-full mt-1 px-4 py-3 rounded-2xl border border-ink-100 outline-none text-sm resize-none" rows={3} />

        <label className="text-xs font-medium text-ink-400 mt-4 block">Upload a short video (optional but recommended)</label>
        {!videoPreview ? (
          <label className="mt-2 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-ink-100 rounded-2xl py-8 cursor-pointer text-ink-400">
            <Video size={22} />
            <span className="text-xs font-medium">Tap to record or upload a video</span>
            <input type="file" accept="video/*" capture="environment" onChange={handleVideoSelect} className="hidden" />
          </label>
        ) : (
          <div>
            <div className="relative mt-2">
              <video ref={videoRef} src={videoPreview} controls crossOrigin="anonymous" className="w-full rounded-2xl bg-black" />
              <button onClick={() => { setVideoFile(null); setVideoPreview(null) }} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center">
                <X size={14} />
              </button>
            </div>
            <AiSuggestion videoRef={videoRef} onPickTechnician={handlePickRecommended} />
          </div>
        )}

        {/* Advance booking */}
        <div className="mt-5">
          <label className="text-xs font-medium text-ink-400 flex items-center gap-1"><CalendarClock size={13} /> When do you need this?</label>
          <div className="flex bg-mist rounded-xl p-1 mt-1.5">
            <button onClick={() => setScheduleMode('now')} className={`flex-1 text-xs font-semibold py-2 rounded-lg ${scheduleMode === 'now' ? 'bg-white shadow-sm text-ink' : 'text-ink-400'}`}>
              As soon as possible
            </button>
            <button onClick={() => setScheduleMode('later')} className={`flex-1 text-xs font-semibold py-2 rounded-lg ${scheduleMode === 'later' ? 'bg-white shadow-sm text-ink' : 'text-ink-400'}`}>
              Schedule for later
            </button>
          </div>

          {scheduleMode === 'later' && (
            <div className="mt-3">
              <input
                type="date"
                min={todayStr}
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-ink-100 outline-none text-sm"
              />
              <div className="grid grid-cols-2 gap-2 mt-2">
                {SLOTS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setScheduledSlot(s.id)}
                    className={`text-left px-3 py-2 rounded-xl border text-xs ${scheduledSlot === s.id ? 'border-signal bg-signal-50' : 'border-ink-100'}`}
                  >
                    <p className={`font-semibold ${scheduledSlot === s.id ? 'text-signal' : 'text-ink'}`}>{s.label}</p>
                    <p className="text-ink-400">{s.hint}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Emergency toggle — only makes sense for ASAP requests */}
        {scheduleMode === 'now' && (
          <button
            onClick={() => setIsEmergency(!isEmergency)}
            className={`w-full mt-4 flex items-center gap-2 px-4 py-3 rounded-2xl border text-left ${isEmergency ? 'border-signal bg-signal-50' : 'border-ink-100 bg-white'}`}
          >
            <Zap size={16} className={isEmergency ? 'text-signal' : 'text-ink-400'} />
            <div className="flex-1">
              <p className={`text-xs font-semibold ${isEmergency ? 'text-signal' : 'text-ink'}`}>Urgent / Emergency service</p>
              <p className="text-[10px] text-ink-400">Prioritized with available technicians right now</p>
            </div>
            <div className={`w-9 h-5 rounded-full relative transition-colors ${isEmergency ? 'bg-signal' : 'bg-ink-100'}`}>
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${isEmergency ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
          </button>
        )}

        <div className="bg-white rounded-card shadow-card p-4 mt-4 text-sm">
          <p className="text-ink-400">Service address</p>
          <p className="font-medium text-ink mt-1">Flat 402, Sunrise Residency, Hyderabad</p>
        </div>

        {error && <p className="text-xs text-signal-700 mt-3">{error}</p>}
        <button onClick={handleConfirm} disabled={loading} className="w-full mt-6 bg-signal text-white font-semibold py-3.5 rounded-2xl shadow-pop disabled:opacity-60">
          {loading ? 'Sending request...' : 'Send Request'}
        </button>
      </div>
    </div>
  )
}
