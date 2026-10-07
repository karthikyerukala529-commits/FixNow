import React from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Wrench, ShieldCheck, Sparkles } from 'lucide-react'
import ToolsBackdrop from '../components/ToolsBackdrop.jsx'

const roles = [
  { label: 'I need a service', sub: 'Book a verified technician', icon: User, path: '/login', color: 'bg-signal' },
  { label: "I'm a technician", sub: 'View jobs, quote, and earn', icon: Wrench, path: '/technician/login', color: 'bg-trust' },
  { label: 'Admin', sub: 'Operations dashboard', icon: ShieldCheck, path: '/admin/login', color: 'bg-ink-600' }
]

export default function Landing() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-ink relative flex flex-col items-center justify-center px-6 overflow-hidden">
      <ToolsBackdrop />
      <div className="relative flex items-center gap-2 mb-1">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-signal to-signal-700 flex items-center justify-center shadow-pop">
          <Wrench size={20} className="text-white" strokeWidth={2.5} />
        </div>
        <p className="font-display text-4xl font-bold text-white">FixNow</p>
      </div>
      <p className="text-ink-100 text-sm mt-2 mb-10 text-center relative flex items-center gap-1">
        <Sparkles size={13} className="text-signal" /> Verified technicians, dispatched in minutes.
      </p>
      <div className="w-full max-w-sm flex flex-col gap-3 relative">
        {roles.map((r) => {
          const Icon = r.icon
          return (
            <button key={r.path} onClick={() => navigate(r.path)} className="bg-white rounded-card shadow-card p-4 flex items-center gap-4 text-left hover:-translate-y-0.5 transition-transform">
              <div className={`w-11 h-11 rounded-xl ${r.color} text-white flex items-center justify-center shrink-0`}>
                <Icon size={20} />
              </div>
              <div>
                <p className="font-semibold text-ink text-sm">{r.label}</p>
                <p className="text-xs text-ink-400">{r.sub}</p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
