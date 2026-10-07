import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { api } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { socket } from '../services/socket.js'

const EMOJI = {
  new_request: '📋', quote_received: '💰', quote_accepted: '✅', technician_arriving: '🚗',
  completed: '🎉', message: '💬', scheduled_reminder: '⏰'
}

function timeAgo(d) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (m < 1440) return `${Math.floor(m / 60)}h ago`
  return `${Math.floor(m / 1440)}d ago`
}

export default function Notifications() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/notification').then((r) => setItems(r.data.notifications)).finally(() => setLoading(false))
    api.patch('/notification/read-all').catch(() => {})
    if (user?.id) socket.emit('user:join', user.id)
    socket.on('notification:new', (n) => setItems((prev) => [n, ...prev]))
    return () => socket.off('notification:new')
  }, [user?.id])

  return (
    <div className="px-5 pt-6">
      <h1 className="font-display font-bold text-xl text-ink mb-4">Alerts</h1>
      {loading && <div className="flex flex-col gap-3">{[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-2xl skeleton" />)}</div>}
      {!loading && items.length === 0 && (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-full bg-mist mx-auto flex items-center justify-center"><Bell size={22} className="text-ink-400" /></div>
          <p className="text-sm font-medium text-ink mt-3">You're all caught up</p>
          <p className="text-xs text-ink-400 mt-1">Quotes, technician updates and messages show up here.</p>
        </div>
      )}
      <div className="flex flex-col gap-2.5">
        {items.map((n) => (
          <button key={n._id} onClick={() => navigate('/bookings')}
            className="text-left bg-white border border-ink-100 rounded-2xl p-3.5 flex gap-3 active:bg-mist">
            <div className="w-9 h-9 rounded-full bg-mist flex items-center justify-center text-base shrink-0">{EMOJI[n.type] || '🔔'}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-ink truncate">{n.title}</p>
                <span className="text-[10px] text-ink-400 shrink-0">{timeAgo(n.createdAt)}</span>
              </div>
              <p className="text-xs text-ink-400 mt-0.5">{n.body}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
