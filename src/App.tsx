import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import Inventory from './pages/Inventory'
import Cashbox from './pages/Cashbox'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rutas públicas */}
        <Route path="/login" element={<Login />} />
        
        {/* Ruta de registro protegida solo para administradores */}
        <Route 
          path="/register" 
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Register />
            </ProtectedRoute>
          } 
        />

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

        {/* Módulo de Configuración: Solo Administrador */}
        <Route 
          path="/settings" 
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Settings />
            </ProtectedRoute>
          } 
        />

        {/* Redirección por defecto */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
