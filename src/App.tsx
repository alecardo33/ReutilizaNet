import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Inventory from './pages/Inventory'
import Store from './pages/Store'

// Componentes o páginas adicionales de ReutilizaNet
// Nota: Asegúrate de tener creados estos archivos en src/pages/ o src/components/ según corresponda.
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Cashbox from './pages/Cashbox'
import Reports from './pages/Reports'
import AdminUsers from './pages/AdminUsers'
import Settings from './pages/Settings'

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Dashboard />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/store" element={<Store />} />
        <Route path="/cashbox" element={<Cashbox />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  )
}
