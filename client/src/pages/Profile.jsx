import React from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'

export default function Profile() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  return (
    <div className="px-5 pt-6 pb-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-14 h-14 rounded-2xl bg-ink text-white flex items-center justify-center font-display font-semibold">
          {(user?.name || 'DU').slice(0, 2).toUpperCase()}
        </div>
        <div>
          <p className="font-display font-semibold text-ink">{user?.name}</p>
          <p className="text-xs text-ink-400">+91 {user?.phone}</p>
        </div>
      </div>
      <button onClick={() => { logout(); navigate('/login') }} className="flex items-center gap-2 text-signal font-medium text-sm px-1">
        <LogOut size={16} /> Log out
      </button>
    </div>
  )
}
