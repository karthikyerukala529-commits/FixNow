import 'dotenv/config'
import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import { connectDB } from './config/db.js'
import authRoutes from './routes/authRoutes.js'
import categoryRoutes from './routes/categoryRoutes.js'
import technicianRoutes from './routes/technicianRoutes.js'
import bookingRoutes from './routes/bookingRoutes.js'
import adminRoutes from './routes/adminRoutes.js'
import paymentRoutes from './routes/paymentRoutes.js'
import aiRoutes from './routes/aiRoutes.js'
import notificationRoutes from './routes/notificationRoutes.js'
import { initSocket } from './socket/index.js'

const app = express()
const server = http.createServer(app)
const io = new Server(server, { cors: { origin: 'http://localhost:5173', credentials: true } })
initSocket(io)

app.use((req, res, next) => { req.io = io; next() })
app.use(cors({ origin: 'http://localhost:5173', credentials: true }))
app.use(express.json({ limit: '20mb' }))

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'FixNow API is running, connected to MongoDB' })
})

app.use('/api/auth', authRoutes)
app.use('/api/category', categoryRoutes)
app.use('/api/technician', technicianRoutes)
app.use('/api/booking', bookingRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/payment', paymentRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/notification', notificationRoutes)

const PORT = process.env.PORT || 5000

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`🚀 FixNow API + Socket.IO running on http://localhost:${PORT}`)
  })
})
