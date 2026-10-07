import React, { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { socket } from '../services/socket.js'

const typeEmoji = {
  new_request: '📋', quote_received: '💰', quote_accepted: '✅',
  technician_arriving: '🚗', completed: '🎉', message: '💬', scheduled_reminder: '⏰'
}

// A small bell + dropdown, reusable across the customer and technician
// headers. Pass the right axios instance and the current account's id so it
// can join the correct personal Socket.IO room for instant delivery.
export default function NotificationBell({ apiInstance, userId, dark }) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const ref = useRef(null)

  function load() {
    apiInstance.get('/notification').then((res) => {
      setNotifications(res.data.notifications)
      setUnreadCount(res.data.unreadCount)
    })
  }

  useEffect(() => {
    load()
    if (userId) socket.emit('user:join', userId)
    socket.on('notification:new', (n) => {
      setNotifications((prev) => [n, ...prev])
      setUnreadCount((prev) => prev + 1)
    })
    return () => socket.off('notification:new')
  }, [userId])

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function toggleOpen() {
    const next = !open
    setOpen(next)
    if (next && unreadCount > 0) {
      await apiInstance.patch('/notification/read-all')
      setUnreadCount(0)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={toggleOpen} className={`relative w-9 h-9 rounded-full flex items-center justify-center ${dark ? 'bg-white/10' : 'bg-mist'}`}>
        <Bell size={16} className={dark ? 'text-white' : 'text-ink'} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-signal text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-card z-50 max-h-96 overflow-y-auto">
          <p className="text-xs font-semibold text-ink px-4 pt-3 pb-2">Notifications</p>
          {notifications.length === 0 && <p className="text-xs text-ink-400 px-4 pb-4">Nothing yet.</p>}
          {notifications.map((n) => (
            <div key={n._id} className="px-4 py-2.5 border-t border-ink-100">
              <p className="text-xs font-medium text-ink flex items-center gap-1.5">
                <span>{typeEmoji[n.type] || '🔔'}</span> {n.title}
              </p>
              <p className="text-[11px] text-ink-400 mt-0.5">{n.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
