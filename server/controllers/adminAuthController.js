import bcrypt from 'bcryptjs'
import Admin from '../models/Admin.js'
import { generateAccessToken } from '../utils/generateToken.js'

export async function adminLogin(req, res, next) {
  try {
    const { email, password } = req.body
    const admin = await Admin.findOne({ email: email.toLowerCase() })
    if (!admin) return res.status(401).json({ success: false, message: 'Invalid credentials' })
    const match = await bcrypt.compare(password, admin.passwordHash)
    if (!match) return res.status(401).json({ success: false, message: 'Invalid credentials' })
    const token = generateAccessToken({ id: admin._id, role: 'admin', email: admin.email })
    res.json({ success: true, token, user: { id: admin._id, name: admin.name, email: admin.email, role: 'admin' } })
  } catch (err) { next(err) }
}
