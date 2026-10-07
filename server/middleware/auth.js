import jwt from 'jsonwebtoken'

export function protect(...allowedRoles) {
  return (req, res, next) => {
    try {
      const header = req.headers.authorization
      if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Not authorized, no token' })
      }
      const token = header.split(' ')[1]
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      if (allowedRoles.length && !allowedRoles.includes(decoded.role)) {
        return res.status(403).json({ success: false, message: 'Forbidden for this role' })
      }
      req.user = decoded
      next()
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' })
    }
  }
}
