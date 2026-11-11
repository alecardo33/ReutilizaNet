import React, { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: ('admin' | 'technician' | 'seller')[]
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    async function checkUserAndRole() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user) {
          setIsAuthenticated(false)
          setLoading(false)
          return
        }

        setIsAuthenticated(true)

        // Consultar el rol en la tabla profiles
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (profile && !error) {
          setUserRole(profile.role)
        }
      } catch (error) {
        console.error('Error al verificar permisos:', error)
      } finally {
        setLoading(false)
      }
    }

    checkUserAndRole()
  }, [])

  if (loading) {
    return <div className="p-6 text-center text-gray-600">Verificando permisos de acceso...</div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && userRole && !allowedRoles.includes(userRole as any)) {
    return (
      <div className="p-8 text-center max-w-md mx-auto mt-10 bg-white shadow rounded-lg">
        <h2 className="text-xl font-bold text-red-600 mb-2">Acceso Restringido</h2>
        <p className="text-gray-600 text-sm">
          No tienes el rol necesario ({allowedRoles.join(', ')}) para visualizar esta sección. Tu rol actual es <span className="font-semibold">{userRole}</span>.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
