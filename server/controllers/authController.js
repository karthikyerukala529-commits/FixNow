import bcrypt from 'bcryptjs'
import User from '../models/User.js'
import Technician from '../models/Technician.js'
import OtpLog from '../models/OtpLog.js'
import { generateOtp, hashOtp } from '../utils/otp.js'
import { generateAccessToken } from '../utils/generateToken.js'

export async function sendOtp(req, res, next) {
  try {
    const { phone, role = 'customer' } = req.body
    if (!phone || phone.length < 10) {
      return res.status(400).json({ success: false, message: 'Valid 10-digit phone number required' })
    }
    const code = generateOtp()
    await OtpLog.create({ phone, role, codeHash: hashOtp(code), expiresAt: new Date(Date.now() + 5 * 60 * 1000) })
    console.log(`📱 OTP for ${phone} (${role}): ${code}`)
    res.json({ success: true, message: 'OTP sent successfully (check the server terminal)' })
  } catch (err) { next(err) }
}

export async function register(req, res, next) {
  try {
    const { phone, code, password, role = 'customer', name, categories, experienceYears, bio } = req.body
    if (!password || password.length < 4) {
      return res.status(400).json({ success: false, message: 'Password must be at least 4 characters' })
    }
    const record = await OtpLog.findOne({ phone, role, verified: false }).sort({ createdAt: -1 })
    if (!record || record.expiresAt < new Date()) {
      return res.status(400).json({ success: false, message: 'OTP expired — request a new one' })
    }
    if (record.codeHash !== hashOtp(code)) {
      record.attempts += 1
      await record.save()
      return res.status(400).json({ success: false, message: 'Incorrect OTP' })
    }
    record.verified = true
    await record.save()

    const Model = role === 'technician' ? Technician : User
    const existing = await Model.findOne({ phone })
    if (existing) return res.status(409).json({ success: false, message: 'Already registered — please log in instead' })

    const passwordHash = await bcrypt.hash(password, 10)
    const accountData = { phone, name: name || 'New User', passwordHash, isVerified: true }

    if (role === 'technician') {
      if (!categories || categories.length === 0) {
        return res.status(400).json({ success: false, message: 'Select at least one service category' })
      }
      accountData.categories = categories
      accountData.experienceYears = experienceYears || 0
      accountData.bio = bio || ''
      accountData.skills = categories
    }

    const account = await Model.create(accountData)
    const token = generateAccessToken({ id: account._id, role, phone })
    res.status(201).json({ success: true, token, user: { id: account._id, name: account.name, phone: account.phone, role } })
  } catch (err) { next(err) }
}

export async function login(req, res, next) {
  try {
    const { phone, password, role = 'customer' } = req.body
    const Model = role === 'technician' ? Technician : User
    const account = await Model.findOne({ phone })
    if (!account || !account.passwordHash) {
      return res.status(401).json({ success: false, message: 'No password-based account found for this number — register first' })
    }
    const match = await bcrypt.compare(password, account.passwordHash)
    if (!match) return res.status(401).json({ success: false, message: 'Incorrect password' })
    const token = generateAccessToken({ id: account._id, role, phone })
    res.json({ success: true, token, user: { id: account._id, name: account.name, phone: account.phone, role } })
  } catch (err) { next(err) }
}

export async function verifyOtp(req, res, next) {
  try {
    const { phone, code, role = 'customer', name } = req.body
    const record = await OtpLog.findOne({ phone, role, verified: false }).sort({ createdAt: -1 })
    if (!record || record.expiresAt < new Date()) {
      return res.status(400).json({ success: false, message: 'OTP expired — request a new one' })
    }
    if (record.codeHash !== hashOtp(code)) {
      record.attempts += 1
      await record.save()
      return res.status(400).json({ success: false, message: 'Incorrect OTP' })
    }
    record.verified = true
    await record.save()
    const Model = role === 'technician' ? Technician : User
    let account = await Model.findOne({ phone })
    if (!account) account = await Model.create({ phone, name: name || 'New User', isVerified: true })
    const token = generateAccessToken({ id: account._id, role, phone })
    res.json({ success: true, token, user: { id: account._id, name: account.name, phone: account.phone, role } })
  } catch (err) { next(err) }
}
