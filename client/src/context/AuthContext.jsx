import React, { createContext, useContext, useState } from 'react'
import { api } from '../services/api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('fixnow_user')
    return saved ? JSON.parse(saved) : null
  })

  function persist(data) {
    localStorage.setItem('fixnow_token', data.token)
    localStorage.setItem('fixnow_user', JSON.stringify(data.user))
    setUser(data.user)
  }

  async function sendOtp(phone) {
    const { data } = await api.post('/auth/send-otp', { phone, role: 'customer' })
    return data
  }

  async function register(name, phone, code, password) {
    const { data } = await api.post('/auth/register', { name, phone, code, password, role: 'customer' })
    persist(data)
    return data
  }

  async function login(phone, password) {
    const { data } = await api.post('/auth/login', { phone, password, role: 'customer' })
    persist(data)
    return data
  }

  function logout() {
    localStorage.removeItem('fixnow_token')
    localStorage.removeItem('fixnow_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, sendOtp, register, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() { return useContext(AuthContext) }
