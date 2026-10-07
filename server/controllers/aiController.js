// Proxies problem-analysis requests to the separate Python FastAPI AI service,
// keeping AI inference out of the Node process entirely:
//   React → Node.js/Express → Python FastAPI AI Service → AI Models
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000'
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 60000)

// Customer-facing wording. Detailed technical errors stay in the server log —
// the customer never sees a raw "AI service returned an error".
const FRIENDLY_ERROR =
  "We couldn't analyse this video. Please try uploading a clearer video, or describe the problem manually."

/**
 * POST /api/ai/analyze-problem
 * Body (multipart): frames[] (1..5 JPEGs sampled across the video),
 *                   selectedService, problemDescription
 *
 * Returns the structured analysis: relevance to the customer's chosen service,
 * detected problem, severity, and an estimated cost range.
 */
export async function analyzeProblem(req, res, next) {
  const { selectedService, problemDescription } = req.body
  const files = req.files || []

  if (!files.length) {
    return res.status(400).json({ success: false, message: 'No video frames were captured. Please re-upload the video.' })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS)

  try {
    const formData = new FormData()
    files.forEach((f, i) => {
      formData.append('files', new Blob([f.buffer], { type: f.mimetype }), f.originalname || `frame-${i}.jpg`)
    })
    if (selectedService) formData.append('selectedService', selectedService)
    if (problemDescription) formData.append('problemDescription', problemDescription)

    const aiRes = await fetch(`${AI_SERVICE_URL}/analyze-problem`, {
      method: 'POST',
      body: formData,
      signal: controller.signal
    })

    if (!aiRes.ok) {
      const detail = await aiRes.text()
      console.error('[AI] service responded', aiRes.status, detail)
      return res.status(502).json({ success: false, message: FRIENDLY_ERROR })
    }

    const data = await aiRes.json()
    res.json(data)
  } catch (err) {
    if (err.name === 'AbortError') {
      console.error('[AI] request timed out after', AI_TIMEOUT_MS, 'ms')
      return res.status(504).json({ success: false, message: 'Analysis is taking too long. Please try again.' })
    }
    if (err.cause?.code === 'ECONNREFUSED') {
      console.error('[AI] service unreachable at', AI_SERVICE_URL)
      return res.status(503).json({
        success: false,
        message: FRIENDLY_ERROR,
        hint: 'AI service is not running. Start it with: cd ai-service && uvicorn main:app --reload --port 8000'
      })
    }
    console.error('[AI] unexpected error', err)
    return res.status(500).json({ success: false, message: FRIENDLY_ERROR })
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Legacy single-frame endpoint, preserved so nothing that already calls it breaks.
 */
export async function classifyService(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No image provided' })

    const formData = new FormData()
    formData.append('file', new Blob([req.file.buffer], { type: req.file.mimetype }), req.file.originalname || 'frame.jpg')

    const aiRes = await fetch(`${AI_SERVICE_URL}/classify-service`, { method: 'POST', body: formData })
    if (!aiRes.ok) {
      const detail = await aiRes.text()
      console.error('[AI] classify-service responded', aiRes.status, detail)
      return res.status(502).json({ success: false, message: FRIENDLY_ERROR })
    }
    res.json(await aiRes.json())
  } catch (err) {
    if (err.cause?.code === 'ECONNREFUSED') {
      return res.status(503).json({ success: false, message: FRIENDLY_ERROR })
    }
    next(err)
  }
}
