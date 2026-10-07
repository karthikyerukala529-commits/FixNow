import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import ToolsBackdrop from '../components/ToolsBackdrop.jsx'

export default function Login() {
  const [tab, setTab] = useState('login')
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-ink relative flex items-center justify-center px-6">
      <ToolsBackdrop />
      <div className="bg-white rounded-card shadow-card p-6 w-full max-w-sm relative">
        <h1 className="font-display font-bold text-xl text-ink mb-1">{tab === 'login' ? 'Welcome back' : 'Create your account'}</h1>
        <p className="text-xs text-ink-400 mb-5">{tab === 'login' ? 'Log in with your phone and password' : 'Register once with your phone — log in with a password from then on'}</p>
        <div className="flex bg-mist rounded-xl p-1 mb-5">
          <button onClick={() => setTab('login')} className={`flex-1 text-xs font-semibold py-2 rounded-lg ${tab === 'login' ? 'bg-white shadow-sm text-ink' : 'text-ink-400'}`}>Log In</button>
          <button onClick={() => setTab('register')} className={`flex-1 text-xs font-semibold py-2 rounded-lg ${tab === 'register' ? 'bg-white shadow-sm text-ink' : 'text-ink-400'}`}>Register</button>
        </div>
        {tab === 'login' ? <LoginForm /> : <RegisterForm onDone={() => navigate('/home')} />}
        <button onClick={() => navigate('/')} className="w-full text-center text-xs text-ink-400 mt-4 underline">← Back to role selection</button>
      </div>
    </div>
  )
}

function LoginForm() {
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true); setError('')
    try { await login(phone, password); navigate('/home') }
    catch (err) { setError(err.response?.data?.message || 'Login failed') }
    finally { setLoading(false) }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label className="text-xs font-medium text-ink-400">Phone number</label>
      <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="9876543210"
        className="w-full mt-1 mb-3 px-4 py-2.5 rounded-xl border border-ink-100 outline-none text-sm" inputMode="numeric" />
      <label className="text-xs font-medium text-ink-400">Password</label>
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
        className="w-full mt-1 mb-4 px-4 py-2.5 rounded-xl border border-ink-100 outline-none text-sm" />
      {error && <p className="text-xs text-signal-700 mb-3">{error}</p>}
      <button disabled={loading} className="w-full bg-signal text-white font-semibold py-3 rounded-xl disabled:opacity-60">
        {loading ? 'Logging in...' : 'Log In'}
      </button>
    </form>
  )
}

function RegisterForm({ onDone }) {
  const [step, setStep] = useState('phone')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { sendOtp, register } = useAuth()

  async function handleSendOtp(e) {
    e.preventDefault()
    setLoading(true); setError('')
    try { await sendOtp(phone); setStep('details') }
    catch (err) { setError(err.response?.data?.message || 'Could not send OTP') }
    finally { setLoading(false) }
  }

  async function handleRegister(e) {
    e.preventDefault()
    setLoading(true); setError('')
    try { await register(name, phone, code, password); onDone() }
    catch (err) { setError(err.response?.data?.message || 'Registration failed') }
    finally { setLoading(false) }
  }

  if (step === 'phone') {
    return (
      <form onSubmit={handleSendOtp}>
        <label className="text-xs font-medium text-ink-400">Phone number</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="9876543210"
          className="w-full mt-1 mb-4 px-4 py-2.5 rounded-xl border border-ink-100 outline-none text-sm" inputMode="numeric" />
        {error && <p className="text-xs text-signal-700 mb-3">{error}</p>}
        <button disabled={loading || phone.length < 10} className="w-full bg-signal text-white font-semibold py-3 rounded-xl disabled:opacity-60">
          {loading ? 'Sending OTP...' : 'Send OTP to verify'}
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={handleRegister}>
      <p className="text-xs text-ink-400 mb-3">Check your <strong>server terminal</strong> for the OTP.</p>
      <label className="text-xs font-medium text-ink-400">Your name</label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Priya Sharma"
        className="w-full mt-1 mb-3 px-4 py-2.5 rounded-xl border border-ink-100 outline-none text-sm" />
      <label className="text-xs font-medium text-ink-400">OTP</label>
      <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="1234"
        className="w-full mt-1 mb-3 px-4 py-2.5 rounded-xl border border-ink-100 outline-none text-sm tracking-[0.3em] font-mono" inputMode="numeric" />
      <label className="text-xs font-medium text-ink-400">Create a password</label>
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 4 characters"
        className="w-full mt-1 mb-4 px-4 py-2.5 rounded-xl border border-ink-100 outline-none text-sm" />
      {error && <p className="text-xs text-signal-700 mb-3">{error}</p>}
      <button disabled={loading} className="w-full bg-signal text-white font-semibold py-3 rounded-xl disabled:opacity-60">
        {loading ? 'Creating account...' : 'Create Account'}
      </button>
    </form>
  )
}
