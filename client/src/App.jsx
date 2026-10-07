import React, { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Wrench } from 'lucide-react'
import Landing from './pages/Landing.jsx'
import Login from './pages/Login.jsx'
import Home from './pages/Home.jsx'
import ServiceDetail from './pages/ServiceDetail.jsx'
import BookingFlow from './pages/BookingFlow.jsx'
import ProblemAnalysis from './pages/ProblemAnalysis.jsx'
import LiveTracking from './pages/LiveTracking.jsx'
import BookingHistory from './pages/BookingHistory.jsx'
import Profile from './pages/Profile.jsx'
import Notifications from './pages/Notifications.jsx'
import CustomerLayout from './layouts/CustomerLayout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import TechnicianLogin from './pages/TechnicianLogin.jsx'
import TechnicianDashboard from './pages/TechnicianDashboard.jsx'
import AdminLogin from './pages/AdminLogin.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'

// A brief branded splash on first load — one of the simplest, highest-impact
// cues that separates an "app" feel from a plain website snapping straight
// into content.
function Splash() {
  return (
    <motion.div
      key="splash"
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-50 bg-ink flex flex-col items-center justify-center"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.35 }}
        className="w-16 h-16 rounded-2xl bg-gradient-to-br from-signal to-signal-700 flex items-center justify-center shadow-pop mb-3"
      >
        <Wrench size={28} className="text-white" strokeWidth={2.5} />
      </motion.div>
      <p className="font-display text-2xl font-bold text-white">FixNow</p>
    </motion.div>
  )
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 900)
    return () => clearTimeout(t)
  }, [])

  return (
    <>
      <AnimatePresence>{showSplash && <Splash />}</AnimatePresence>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute><CustomerLayout /></ProtectedRoute>}>
          <Route path="/home" element={<Home />} />
          <Route path="/service/:categorySlug" element={<ServiceDetail />} />
          <Route path="/analyze/:categorySlug" element={<ProblemAnalysis />} />
        <Route path="/book/:technicianId" element={<BookingFlow />} />
          <Route path="/tracking/:bookingId" element={<LiveTracking />} />
          <Route path="/bookings" element={<BookingHistory />} />
          <Route path="/alerts" element={<Notifications />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
        <Route path="/technician/login" element={<TechnicianLogin />} />
        <Route path="/technician" element={<TechnicianDashboard />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </>
  )
}
