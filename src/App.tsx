import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Inventory from './pages/Inventory'
import Cashbox from './pages/Cashbox'
import Reports from './pages/Reports'
import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Ruta pública */}
        <Route path="/login" element={<Login />} />

        {/* Módulo de Inventario: Administrador y Técnico */}
        <Route 
          path="/inventory" 
          element={
            <ProtectedRoute allowedRoles={['admin', 'technician']}>
              <Inventory />
            </ProtectedRoute>
          } 
        />

        {/* Módulo de Caja: Administrador y Vendedor */}
        <Route 
          path="/cashbox" 
          element={
            <ProtectedRoute allowedRoles={['admin', 'seller']}>
              <Cashbox />
            </ProtectedRoute>
          } 
        />

        {/* Módulo de Reportes: Solo Administrador */}
        <Route 
          path="/reports" 
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Reports />
            </ProtectedRoute>
          } 
        />

        {/* Redirección por defecto */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
