import React, { useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Video, X, Sparkles, Star, ShieldCheck, AlertTriangle,
  CheckCircle2, CalendarClock, Zap, Clock, MapPin, Loader2
} from 'lucide-react'
import { api } from '../services/api.js'

const CATEGORY_LABELS = {
  electrician: 'Electrical / Fan Repair', plumber: 'Plumbing', 'ac-repair': 'AC Repair',
  'ro-repair': 'RO / Water Purifier Repair', carpenter: 'Carpentry', painter: 'Painting',
  cctv: 'CCTV Installation', 'washing-machine': 'Washing Machine Repair', fridge: 'Refrigerator Repair',
  'pest-control': 'Pest Control', 'house-cleaning': 'House Cleaning', appliance: 'Appliance Repair'
}

const SLOTS = [
  { id: 'morning', label: 'Morning', hint: '9 AM – 12 PM' },
  { id: 'afternoon', label: 'Afternoon', hint: '12 PM – 4 PM' },
  { id: 'evening', label: 'Evening', hint: '4 PM – 8 PM' },
  { id: 'night', label: 'Night', hint: '8 PM – 10 PM' }
]

const ANALYSIS_STEPS = [
  'Analysing your problem...',
  'Identifying the issue...',
  'Checking service category...',
  'Estimating service cost...',
  'Finding suitable technicians...'
]

const STAGES = ['Problem', 'Analysis', 'Estimate', 'Technician']

function ProgressTracker({ current }) {
  return (
    <div className="flex items-center gap-1 px-5 pb-3">
      {STAGES.map((s, i) => (
        <React.Fragment key={s}>
          <div className="flex flex-col items-center gap-1">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
              i < current ? 'bg-okgreen text-white' : i === current ? 'bg-signal text-white' : 'bg-ink-100 text-ink-400'
            }`}>
              {i < current ? '✓' : i + 1}
            </div>
            <span className={`text-[9px] ${i <= current ? 'text-ink font-medium' : 'text-ink-400'}`}>{s}</span>
          </div>
          {i < STAGES.length - 1 && <div className={`flex-1 h-0.5 mb-4 ${i < current ? 'bg-okgreen' : 'bg-ink-100'}`} />}
        </React.Fragment>
      ))}
    </div>
  )
}

/**
 * Captures several frames spread across the video rather than a single frame
 * at t=0 — the first frame of a clip is very often blank/black, which was a
 * direct cause of nonsense classifications (a fan video reading as CCTV).
 * Each seek waits for the 'seeked' event so the canvas draws real pixels.
 */
async function captureFrames(video, count = 3) {
  const duration = video.duration
  if (!duration || !isFinite(duration)) throw new Error('Video metadata unavailable')

  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth || 480
  canvas.height = video.videoHeight || 360
  const ctx = canvas.getContext('2d')

  const originalTime = video.currentTime
  const frames = []

  for (let i = 1; i <= count; i++) {
    const t = (duration * i) / (count + 1)
    await new Promise((resolve) => {
      const onSeeked = () => { video.removeEventListener('seeked', onSeeked); resolve() }
      video.addEventListener('seeked', onSeeked)
      video.currentTime = Math.min(t, Math.max(0, duration - 0.05))
    })
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.85))
    if (blob) frames.push(blob)
  }

  video.currentTime = originalTime
  return frames
}

function TechnicianCard({ t, onRequest, requesting }) {
  const initials = t.name.slice(0, 2).toUpperCase()
  return (
    <div className="bg-white rounded-2xl border border-ink-100 p-4">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-trust to-ink flex items-center justify-center text-white text-sm font-semibold shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-ink text-sm flex items-center gap-1">
            {t.name} <ShieldCheck size={13} className="text-trust shrink-0" />
          </p>
          <p className="text-xs text-ink-400 capitalize">{(t.categories || []).join(', ').replace(/-/g, ' ')}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-400 mt-1.5">
            <span className="flex items-center gap-0.5 text-amber-500 font-medium">
              <Star size={11} fill="currentColor" /> {t.rating || 'New'}
            </span>
            <span>{t.experienceYears} yrs exp</span>
            <span>{t.completedJobs} jobs</span>
            {t.distanceKm !== null && t.distanceKm !== undefined && (
              <span className="flex items-center gap-0.5"><MapPin size={10} /> {t.distanceKm} km</span>
            )}
            {t.etaMinutes && <span className="flex items-center gap-0.5"><Clock size={10} /> ETA {t.etaMinutes} min</span>}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 max-w-[110px] h-1.5 bg-ink-100 rounded-full overflow-hidden">
              <div className="h-full bg-trust rounded-full" style={{ width: `${Math.min(t.matchScore, 100)}%` }} />
            </div>
            <span className="text-[10px] text-trust font-semibold">{Math.min(t.matchScore, 100)}% match</span>
            {t.isOnline && <span className="text-[10px] text-okgreen font-semibold ml-auto">● Available now</span>}
          </div>
        </div>
      </div>
      <button
        onClick={() => onRequest(t)}
        disabled={requesting}
        className="w-full mt-3 bg-signal text-white text-xs font-semibold py-2.5 rounded-xl disabled:opacity-60"
      >
        {requesting ? 'Requesting...' : 'Request Technician'}
      </button>
    </div>
  )
}

export default function ProblemAnalysis() {
  const { categorySlug } = useParams()
  const navigate = useNavigate()
  const videoRef = useRef(null)

  const [problem, setProblem] = useState('')
  const [videoFile, setVideoFile] = useState(null)
  const [videoPreview, setVideoPreview] = useState(null)
  const [error, setError] = useState('')

  const [phase, setPhase] = useState('describe') // describe -> analysing -> result
  const [stepIndex, setStepIndex] = useState(0)
  const [analysis, setAnalysis] = useState(null)
  const [technicians, setTechnicians] = useState([])
  const [requesting, setRequesting] = useState(false)

  const [scheduleMode, setScheduleMode] = useState('now')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledSlot, setScheduledSlot] = useState('morning')
  const [isEmergency, setIsEmergency] = useState(false)

  const todayStr = new Date().toISOString().split('T')[0]
  const serviceLabel = CATEGORY_LABELS[categorySlug] || categorySlug

  function handleVideoSelect(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 15 * 1024 * 1024) {
      setError('Video is too large — please keep it under 15MB (a short 5–10 second clip is plenty).')
      return
    }
    setError('')
    setVideoFile(file)
    setVideoPreview(URL.createObjectURL(file))
  }

  async function runAnalysis() {
    if (!videoFile) { setError('Please upload a short video of the problem first.'); return }
    setError('')
    setPhase('analysing')
    setStepIndex(0)

    const ticker = setInterval(() => setStepIndex((i) => Math.min(i + 1, ANALYSIS_STEPS.length - 1)), 1200)

    try {
      const video = videoRef.current
      if (video.readyState < 1) {
        await new Promise((r) => video.addEventListener('loadedmetadata', r, { once: true }))
      }
      const frames = await captureFrames(video, 3)
      if (!frames.length) throw new Error('Could not read frames from this video')

      const formData = new FormData()
      frames.forEach((f, i) => formData.append('frames', f, `frame-${i}.jpg`))
      formData.append('selectedService', categorySlug)
      formData.append('problemDescription', problem)

      const { data } = await api.post('/ai/analyze-problem', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setAnalysis(data)

      // Technicians are fetched for the service the CUSTOMER selected — the AI
      // never silently reroutes them to a different trade.
      const skills = (data.requiredSkills || []).join(',')
      const techRes = await api.get(`/technician/category/${categorySlug}`, {
        params: { lat: 17.43, lng: 78.41, skills }
      })
      setTechnicians(techRes.data.technicians.slice(0, 5))
      setPhase('result')
    } catch (err) {
      setError(err.response?.data?.message ||
        "We couldn't analyse this video. Please try uploading a clearer video, or describe the problem manually.")
      setPhase('describe')
    } finally {
      clearInterval(ticker)
    }
  }

  async function requestTechnician(tech) {
    if (scheduleMode === 'later' && !scheduledDate) {
      setError('Pick a date for your scheduled visit')
      return
    }
    setRequesting(true)
    setError('')
    try {
      const problemVideoUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(videoFile)
      })

      await api.post('/booking', {
        technicianId: tech._id,
        category: categorySlug,
        problemDescription: problem,
        problemVideoUrl,
        aiAnalysis: analysis ? {
          selectedService: analysis.selectedService,
          isRelevant: analysis.isRelevant,
          predictedCategory: analysis.predictedCategory,
          confidence: analysis.confidence,
          detectedProblem: analysis.detectedProblem,
          severity: analysis.severity,
          requiredSkills: analysis.requiredSkills
        } : undefined,
        estimatedCost: analysis?.estimatedCost,
        isScheduled: scheduleMode === 'later',
        scheduledDate: scheduleMode === 'later' ? scheduledDate : undefined,
        scheduledSlot: scheduleMode === 'later' ? scheduledSlot : undefined,
        isEmergency,
        address: { line1: 'Flat 402, Sunrise Residency', city: 'Hyderabad', lat: 17.43, lng: 78.41 }
      })
      navigate('/bookings')
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create booking')
    } finally {
      setRequesting(false)
    }
  }

  const stage = phase === 'describe' ? 0 : phase === 'analysing' ? 1 : 2

  return (
    <div className="min-h-screen pb-8 bg-white">
      <div className="px-5 pt-6 pb-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)}><ArrowLeft size={20} className="text-ink" /></button>
        <div>
          <h1 className="font-display font-semibold text-ink leading-tight">Tell us about your problem</h1>
          <p className="text-xs text-ink-400">{serviceLabel}</p>
        </div>
      </div>
      <ProgressTracker current={stage} />

      <div className="px-5">
        {/* ---------- DESCRIBE ---------- */}
        {phase === 'describe' && (
          <>
            <label className="text-xs font-semibold text-ink">Describe your issue</label>
            <textarea
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder="e.g. Fan is making unusual noise and sometimes stops rotating."
              className="w-full mt-1.5 px-4 py-3 rounded-2xl border border-ink-100 outline-none text-sm resize-none focus:border-trust"
              rows={3}
            />
            <p className="text-[11px] text-ink-400 mt-1">
              Describing the problem in your own words makes the cost estimate more accurate.
            </p>

            <label className="text-xs font-semibold text-ink mt-5 block">Upload a video of the problem</label>
            {!videoPreview ? (
              <label className="mt-2 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-trust/40 bg-trust-50/40 rounded-2xl py-10 cursor-pointer">
                <div className="w-11 h-11 rounded-full bg-trust flex items-center justify-center">
                  <Video size={20} className="text-white" />
                </div>
                <span className="text-sm font-semibold text-trust">Upload Video</span>
                <span className="text-[11px] text-ink-400">A 5–10 second clip works best · max 15MB</span>
                <input type="file" accept="video/*" capture="environment" onChange={handleVideoSelect} className="hidden" />
              </label>
            ) : (
              <div className="relative mt-2">
                <video ref={videoRef} src={videoPreview} controls preload="metadata" className="w-full rounded-2xl bg-black" />
                <button
                  onClick={() => { setVideoFile(null); setVideoPreview(null) }}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {error && (
              <div className="bg-signal-50 rounded-xl p-3 mt-4">
                <p className="text-xs text-signal-700">{error}</p>
                <div className="flex gap-2 mt-2">
                  <button onClick={runAnalysis} className="text-xs font-semibold text-signal underline">Try Again</button>
                  <button
                    onClick={() => { setAnalysis(null); setPhase('result'); setError('') }}
                    className="text-xs font-semibold text-ink-400 underline"
                  >
                    Describe Manually
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={runAnalysis}
              disabled={!videoFile}
              className="w-full mt-6 bg-signal text-white font-semibold py-3.5 rounded-2xl shadow-pop disabled:opacity-50"
            >
              Analyse Problem
            </button>
          </>
        )}

        {/* ---------- ANALYSING ---------- */}
        {phase === 'analysing' && (
          <div className="py-16 flex flex-col items-center">
            <Loader2 size={34} className="text-trust animate-spin" />
            <AnimatePresence mode="wait">
              <motion.p
                key={stepIndex}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                className="text-sm font-medium text-ink mt-5"
              >
                {ANALYSIS_STEPS[stepIndex]}
              </motion.p>
            </AnimatePresence>
            <p className="text-[11px] text-ink-400 mt-2">This usually takes a few seconds</p>
          </div>
        )}

        {/* ---------- RESULT ---------- */}
        {phase === 'result' && (
          <>
            {analysis && (
              <>
                {/* Relevance: the AI reports a mismatch but NEVER changes the
                    customer's chosen service on its own. */}
                {!analysis.isRelevant && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
                    <p className="text-sm font-semibold text-amber-800 flex items-center gap-1.5">
                      <AlertTriangle size={15} /> This video may not match {serviceLabel}
                    </p>
                    <p className="text-xs text-amber-700 mt-1">
                      It looks more like <strong>{CATEGORY_LABELS[analysis.predictedCategory] || analysis.predictedCategory}</strong>.
                      You can continue anyway, or switch service.
                    </p>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => navigate(`/analyze/${analysis.predictedCategory}`)}
                        className="flex-1 border border-amber-400 text-amber-800 text-xs font-semibold py-2 rounded-xl"
                      >
                        Change Service
                      </button>
                      <button
                        onClick={() => setAnalysis({ ...analysis, isRelevant: true })}
                        className="flex-1 bg-amber-600 text-white text-xs font-semibold py-2 rounded-xl"
                      >
                        Continue with {serviceLabel.split(' ')[0]}
                      </button>
                    </div>
                  </div>
                )}

                {analysis.isRelevant && (
                  <div className="bg-okgreen-50 rounded-2xl p-4 mb-4">
                    <p className="text-sm font-semibold text-okgreen flex items-center gap-1.5">
                      <CheckCircle2 size={15} /> Problem Detected
                    </p>
                    <p className="text-sm text-ink mt-2">{analysis.detectedProblem}</p>
                    <div className="flex items-center gap-4 text-[11px] text-ink-400 mt-2">
                      <span>Service: <strong className="text-ink">{serviceLabel}</strong></span>
                      <span>Confidence: <strong className="text-ink">{analysis.confidence}%</strong></span>
                      {analysis.severity && <span>Severity: <strong className="text-ink capitalize">{analysis.severity}</strong></span>}
                    </div>
                  </div>
                )}

                {analysis.estimatedCost && (
                  <div className="bg-ink rounded-2xl p-4 mb-5 text-white">
                    <p className="text-[11px] text-ink-100 uppercase tracking-wide">Estimated Service Cost</p>
                    <p className="font-display text-3xl font-bold mt-1">
                      ₹{analysis.estimatedCost.min} – ₹{analysis.estimatedCost.max}
                    </p>
                    <p className="text-[11px] text-ink-100 mt-2">
                      This is an approximate estimate. The final price is confirmed by the technician after inspection.
                    </p>
                  </div>
                )}
              </>
            )}

            {!analysis && (
              <div className="bg-mist rounded-2xl p-4 mb-5">
                <p className="text-sm text-ink font-medium">Continuing without AI analysis</p>
                <p className="text-xs text-ink-400 mt-1">
                  The technician will inspect the problem and give you a price before any work starts.
                </p>
              </div>
            )}

            {/* Scheduling */}
            <label className="text-xs font-semibold text-ink flex items-center gap-1"><CalendarClock size={13} /> When do you need this?</label>
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
                <input type="date" min={todayStr} value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-ink-100 outline-none text-sm" />
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {SLOTS.map((s) => (
                    <button key={s.id} onClick={() => setScheduledSlot(s.id)}
                      className={`text-left px-3 py-2 rounded-xl border text-xs ${scheduledSlot === s.id ? 'border-signal bg-signal-50' : 'border-ink-100'}`}>
                      <p className={`font-semibold ${scheduledSlot === s.id ? 'text-signal' : 'text-ink'}`}>{s.label}</p>
                      <p className="text-ink-400">{s.hint}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {scheduleMode === 'now' && (
              <button onClick={() => setIsEmergency(!isEmergency)}
                className={`w-full mt-3 flex items-center gap-2 px-4 py-3 rounded-2xl border text-left ${isEmergency ? 'border-signal bg-signal-50' : 'border-ink-100'}`}>
                <Zap size={16} className={isEmergency ? 'text-signal' : 'text-ink-400'} />
                <div className="flex-1">
                  <p className={`text-xs font-semibold ${isEmergency ? 'text-signal' : 'text-ink'}`}>Urgent / Emergency service</p>
                  <p className="text-[10px] text-ink-400">Prioritised with technicians available right now</p>
                </div>
                <div className={`w-9 h-5 rounded-full relative transition-colors ${isEmergency ? 'bg-signal' : 'bg-ink-100'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${isEmergency ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
              </button>
            )}

            {/* Recommended technicians — only shown AFTER analysis + estimate */}
            <h2 className="font-display font-semibold text-ink mt-6 mb-1 flex items-center gap-1.5">
              <Sparkles size={15} className="text-trust" /> Recommended Technicians
            </h2>
            <p className="text-[11px] text-ink-400 mb-3">Matched on {serviceLabel.toLowerCase()} skill, availability, distance, experience and rating.</p>

            {technicians.length === 0 && (
              <p className="text-sm text-ink-400">No {serviceLabel.toLowerCase()} technicians are available right now. Please try again shortly.</p>
            )}
            <div className="flex flex-col gap-3">
              {technicians.map((t) => (
                <TechnicianCard key={t._id} t={t} onRequest={requestTechnician} requesting={requesting} />
              ))}
            </div>

            {error && <p className="text-xs text-signal-700 mt-3">{error}</p>}
          </>
        )}
      </div>
    </div>
  )
}
