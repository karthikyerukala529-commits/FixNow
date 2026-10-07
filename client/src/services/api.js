import axios from 'axios'

export const api = axios.create({ baseURL: 'http://localhost:5000/api' })
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('fixnow_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const technicianApi = axios.create({ baseURL: 'http://localhost:5000/api' })
technicianApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('fixnow_tech_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const adminApi = axios.create({ baseURL: 'http://localhost:5000/api' })
adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('fixnow_admin_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
