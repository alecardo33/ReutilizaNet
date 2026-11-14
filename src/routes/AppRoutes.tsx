import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

import Login from '../pages/Login'
import Dashboard from '../pages/Dashboard'
import Inventory from '../pages/Inventory'
import Cashbox from '../pages/Cashbox'
import Reports from '../pages/Reports'
import AdminUsers from '../pages/AdminUsers'
import Settings from '../pages/Settings'

export function AppRoutes() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Cargando aplicación...</div>
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
        <Route path="/" element={session ? <Dashboard /> : <Navigate to="/login" />} />
        <Route path="/inventory" element={session ? <Inventory /> : <Navigate to="/login" />} />
        <Route path="/cashbox" element={session ? <Cashbox /> : <Navigate to="/login" />} />
        <Route path="/reports" element={session ? <Reports /> : <Navigate to="/login" />} />
        <Route path="/admin/users" element={session ? <AdminUsers /> : <Navigate to="/login" />} />
        <Route path="/settings" element={session ? <Settings /> : <Navigate to="/login" />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}
