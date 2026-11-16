import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabaseAdminAuth, supabase } from '../lib/supabase'

interface UserProfile {
  id: string
  email: string
  full_name: string
  role: 'admin' | 'technician' | 'seller'
}

export default function AdminUsers() {
  const navigate = useNavigate()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<'admin' | 'technician' | 'seller'>('technician')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    setLoadingUsers(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .order('email', { ascending: true })

    if (!error && data) {
      setUsers(data as UserProfile[])
    }
    setLoadingUsers(false)
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const { data, error: authError } = await supabaseAdminAuth.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName }
        }
      })

      if (authError) throw authError

      if (data.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: data.user.id,
            email,
            role,
            full_name: fullName
          })

        if (profileError) throw profileError

        setMessage('¡Usuario creado y rol asignado exitosamente!')
        setEmail('')
        setPassword('')
        setFullName('')
        fetchUsers()
      }
    } catch (err: any) {
      setMessage(`Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'technician' | 'seller') => {
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId)

    if (error) {
      alert('Error al actualizar rol: ' + error.message)
    } else {
      setUsers(users.map(u => (u.id === userId ? { ...u, role: newRole } : u)))
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-lg shadow mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Gestión de Usuarios (Admin)</h1>
            <p className="text-sm text-gray-500">Creación de cuentas y cambio de roles de acceso</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => navigate('/')} className="bg-gray-600 text-white px-4 py-2 rounded text-sm hover:bg-gray-700">
              Inicio
            </button>
            <button onClick={() => navigate('/inventory')} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
              Inventario
            </button>
            <button onClick={() => navigate('/cashbox')} className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700">
              Caja
            </button>
            <button onClick={() => navigate('/reports')} className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700">
              Reportes
            </button>
            <button onClick={() => navigate('/settings')} className="bg-gray-800 text-white px-4 py-2 rounded text-sm hover:bg-gray-900">
              Configuración
            </button>
            <button onClick={handleLogout} className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700">
              Cerrar Sesión
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulario de creación */}
          <div className="bg-white p-6 rounded-lg shadow h-fit">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Registrar Nuevo Usuario</h2>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="w-full border border-gray-300 p-2 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Correo Electrónico</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full border border-gray-300 p-2 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña Temporal</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full border border-gray-300 p-2 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rol del Sistema</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'admin' | 'technician' | 'seller')}
                  className="w-full border border-gray-300 p-2 rounded text-sm bg-white"
                >
                  <option value="technician">Técnico (Inventario y Taller)</option>
                  <option value="seller">Vendedor (Caja y Ventas)</option>
                  <option value="admin">Administrador (Acceso Total)</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white font-semibold py-2 rounded hover:bg-blue-700 transition"
              >
                {loading ? 'Creando usuario...' : 'Crear Usuario'}
              </button>
              {message && (
                <p className={`text-sm mt-2 text-center font-medium ${message.startsWith('Error') ? 'text-red-600' : 'text-green-700'}`}>
                  {message}
                </p>
              )}
            </form>
          </div>

          {/* Lista de usuarios y selector de rol */}
          <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Usuarios Registrados y Roles</h2>
            {loadingUsers ? (
              <p className="text-sm text-gray-500">Cargando usuarios...</p>
            ) : users.length === 0 ? (
              <p className="text-sm text-gray-500">No se encontraron usuarios en la tabla profiles.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                      <th className="p-3">Nombre</th>
                      <th className="p-3">Correo</th>
                      <th className="p-3">Rol Asignado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-sm text-gray-700">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50">
                        <td className="p-3 font-medium">{u.full_name || 'Sin nombre'}</td>
                        <td className="p-3 text-gray-600">{u.email}</td>
                        <td className="p-3">
                          <select
                            value={u.role}
                            onChange={(e) =>
                              handleRoleChange(u.id, e.target.value as 'admin' | 'technician' | 'seller')
                            }
                            className="border border-gray-300 rounded px-2.5 py-1.5 text-xs font-semibold bg-white"
                          >
                            <option value="technician">Técnico (Inventario)</option>
                            <option value="seller">Vendedor (Caja)</option>
                            <option value="admin">Administrador (Total)</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}