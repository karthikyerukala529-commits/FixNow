import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { useAdminAuth } from '../context/AdminAuthContext.jsx'
import ToolsBackdrop from '../components/ToolsBackdrop.jsx'

export default function AdminLogin() {
  const [email, setEmail] = useState('admin@fixnow.com')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAdminAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true); setError('')
    try { await login(email, password); navigate('/admin') }
    catch (err) { setError(err.response?.data?.message || 'Login failed') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-ink relative flex items-center justify-center px-6">
      <ToolsBackdrop />
      <form onSubmit={handleSubmit} className="bg-white rounded-card shadow-card p-6 w-full max-w-sm relative">
        <div className="w-10 h-10 rounded-xl bg-ink-600 text-white flex items-center justify-center mb-3">
          <ShieldCheck size={18} />
        </div>
        <h1 className="font-display font-bold text-xl text-ink mb-1">Admin Login</h1>
        <p className="text-xs text-ink-400 mb-5">Seeded account: admin@fixnow.com / admin123</p>
        <label className="text-xs font-medium text-ink-400">Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full mt-1 mb-4 px-4 py-2.5 rounded-xl border border-ink-100 outline-none text-sm" />
        <label className="text-xs font-medium text-ink-400">Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full mt-1 mb-4 px-4 py-2.5 rounded-xl border border-ink-100 outline-none text-sm" />
        {error && <p className="text-xs text-signal-700 mb-3">{error}</p>}
        <button disabled={loading} className="w-full bg-ink text-white font-semibold py-3 rounded-xl disabled:opacity-60">
          {loading ? 'Logging in...' : 'Log in'}
        </button>
        <button type="button" onClick={() => navigate('/')} className="w-full text-center text-xs text-ink-400 mt-4 underline">← Back to role selection</button>
      </form>
    </div>
  )
}
