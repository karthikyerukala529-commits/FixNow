import React from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Home, ClipboardList, Bell, User } from 'lucide-react'

const tabs = [
  { path: '/home', label: 'Home', icon: Home },
  { path: '/bookings', label: 'Bookings', icon: ClipboardList },
  { path: '/alerts', label: 'Alerts', icon: Bell },
  { path: '/profile', label: 'Profile', icon: User }
]

// Screens where the bottom bar would just get in the way of a focused task.
const HIDE_NAV = ['/analyze/', '/tracking/', '/book/']

export default function CustomerLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const hideNav = HIDE_NAV.some((p) => location.pathname.startsWith(p))

  return (
    <div className="min-h-screen bg-mist flex flex-col">
      <main className={`flex-1 max-w-lg mx-auto w-full overflow-hidden bg-white md:shadow-card ${hideNav ? 'pb-6' : 'pb-24'}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {!hideNav && (
        <nav className="fixed bottom-0 inset-x-0 z-30 max-w-lg mx-auto bg-white border-t border-ink-100 pb-[env(safe-area-inset-bottom)]">
          <div className="grid grid-cols-4">
            {tabs.map((tab) => {
              const active = location.pathname === tab.path
              const Icon = tab.icon
              return (
                <button key={tab.path} onClick={() => navigate(tab.path)}
                  className="relative flex flex-col items-center gap-1 pt-2.5 pb-2 text-[11px] font-medium active:scale-95 transition-transform">
                  {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-signal" />}
                  <Icon size={21} strokeWidth={active ? 2.5 : 2} className={active ? 'text-signal' : 'text-ink-400'} />
                  <span className={active ? 'text-signal' : 'text-ink-400'}>{tab.label}</span>
                </button>
              )
            })}
          </div>
        </nav>
      )}
    </div>
  )
}
