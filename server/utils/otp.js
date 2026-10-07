import crypto from 'crypto'

export function generateOtp() { return String(Math.floor(1000 + Math.random() * 9000)) }
export function hashOtp(code) { return crypto.createHash('sha256').update(code).digest('hex') }
