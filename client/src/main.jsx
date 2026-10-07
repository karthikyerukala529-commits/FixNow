import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { TechnicianAuthProvider } from './context/TechnicianAuthContext.jsx'
import { AdminAuthProvider } from './context/AdminAuthContext.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <TechnicianAuthProvider>
          <AdminAuthProvider>
            <App />
          </AdminAuthProvider>
        </TechnicianAuthProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
