import express from 'express'
import multer from 'multer'
import { analyzeProblem, classifyService } from '../controllers/aiController.js'
import { protect } from '../middleware/auth.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 5 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Frames must be images'))
    cb(null, true)
  }
})

const router = express.Router()
router.post('/analyze-problem', protect('customer'), upload.array('frames', 5), analyzeProblem)
router.post('/classify-service', protect('customer'), upload.single('image'), classifyService)

export default router
