import React, { createContext, useContext, useState } from 'react'
import { adminApi } from '../services/api.js'

const AdminAuthContext = createContext(null)

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(() => {
    const saved = localStorage.getItem('fixnow_admin_user')
    return saved ? JSON.parse(saved) : null
  })

  async function login(email, password) {
    const { data } = await adminApi.post('/admin/login', { email, password })
    localStorage.setItem('fixnow_admin_token', data.token)
    localStorage.setItem('fixnow_admin_user', JSON.stringify(data.user))
    setAdmin(data.user)
    return data
  }

  function logout() {
    localStorage.removeItem('fixnow_admin_token')
    localStorage.removeItem('fixnow_admin_user')
    setAdmin(null)
  }

  return (
    <AdminAuthContext.Provider value={{ admin, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  )
}

export function useAdminAuth() { return useContext(AdminAuthContext) }
