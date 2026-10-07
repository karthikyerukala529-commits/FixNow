import React, { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { X, Send } from 'lucide-react'
import { socket } from '../services/socket.js'

// A slide-up chat panel scoped to one booking. Works for either role — pass
// the right axios instance (api / technicianApi) and the current user's
// name so sent messages render correctly on both sides.
export default function ChatModal({ bookingId, apiInstance, currentUserName, otherPartyName, onClose }) {
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    apiInstance.get(`/booking/${bookingId}/messages`)
      .then((res) => setMessages(res.data.messages))
      .finally(() => setLoading(false))

    socket.emit('booking:join', bookingId)
    socket.on('chat:message', (msg) => setMessages((prev) => [...prev, msg]))
    return () => socket.off('chat:message')
  }, [bookingId])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  async function handleSend(e) {
    e.preventDefault()
    if (!text.trim() || sending) return
    setSending(true)
    try {
      await apiInstance.post(`/booking/${bookingId}/messages`, { text, senderName: currentUserName })
      setText('')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="relative bg-white w-full max-w-lg rounded-t-[1.5rem] h-[75vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-100">
          <div>
            <p className="font-display font-semibold text-ink text-sm">{otherPartyName || 'Chat'}</p>
            <p className="text-[11px] text-ink-400">Messages about this booking</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-mist flex items-center justify-center">
            <X size={16} className="text-ink" />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
          {loading && <p className="text-xs text-ink-400 text-center mt-4">Loading messages...</p>}
          {!loading && messages.length === 0 && (
            <p className="text-xs text-ink-400 text-center mt-4">No messages yet — say hello!</p>
          )}
          {messages.map((m) => {
            const isMine = m.senderName === currentUserName
            return (
              <div key={m._id} className={`max-w-[75%] ${isMine ? 'self-end items-end' : 'self-start items-start'} flex flex-col`}>
                {!isMine && <p className="text-[10px] text-ink-400 mb-0.5 px-1">{m.senderName}</p>}
                <div className={`px-3 py-2 rounded-2xl text-sm ${isMine ? 'bg-signal text-white rounded-br-sm' : 'bg-mist text-ink rounded-bl-sm'}`}>
                  {m.text}
                </div>
              </div>
            )
          })}
        </div>

        <form onSubmit={handleSend} className="flex items-center gap-2 px-4 py-3 border-t border-ink-100">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-4 py-2.5 rounded-full border border-ink-100 outline-none text-sm"
          />
          <button type="submit" disabled={sending || !text.trim()} className="w-10 h-10 rounded-full bg-signal text-white flex items-center justify-center disabled:opacity-50">
            <Send size={16} />
          </button>
        </form>
      </motion.div>
    </div>
  )
}
