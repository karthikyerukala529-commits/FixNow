import React, { createContext, useContext, useState } from 'react'
import { technicianApi } from '../services/api.js'

const TechnicianAuthContext = createContext(null)

export function TechnicianAuthProvider({ children }) {
  const [technician, setTechnician] = useState(() => {
    const saved = localStorage.getItem('fixnow_tech_user')
    return saved ? JSON.parse(saved) : null
  })

  function persist(data) {
    localStorage.setItem('fixnow_tech_token', data.token)
    localStorage.setItem('fixnow_tech_user', JSON.stringify(data.user))
    setTechnician(data.user)
  }

  async function sendOtp(phone) {
    const { data } = await technicianApi.post('/auth/send-otp', { phone, role: 'technician' })
    return data
  }

  async function register({ name, phone, code, password, categories, experienceYears, bio }) {
    const { data } = await technicianApi.post('/auth/register', {
      name, phone, code, password, categories, experienceYears, bio, role: 'technician'
    })
    persist(data)
    return data
  }

  async function login(phone, password) {
    const { data } = await technicianApi.post('/auth/login', { phone, password, role: 'technician' })
    persist(data)
    return data
  }

  function logout() {
    localStorage.removeItem('fixnow_tech_token')
    localStorage.removeItem('fixnow_tech_user')
    setTechnician(null)
  }

  return (
    <TechnicianAuthContext.Provider value={{ technician, sendOtp, register, login, logout }}>
      {children}
    </TechnicianAuthContext.Provider>
  )
}

export function useTechnicianAuth() { return useContext(TechnicianAuthContext) }
