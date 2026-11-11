import { useState } from 'react'
import { supabaseAdminAuth, supabase } from '../lib/supabase'

export default function AdminUsers() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<'admin' | 'staff' | 'client'>('staff')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

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
          .update({ role, full_name: fullName })
          .eq('id', data.user.id)

        if (profileError) throw profileError

        setMessage('¡Usuario creado y rol asignado exitosamente!')
        setEmail('')
        setPassword('')
        setFullName('')
      }
    } catch (err: any) {
      setMessage(`Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-lg mx-auto bg-white rounded shadow mt-10">
      <h2 className="text-xl font-bold mb-4">Gestión de Usuarios (Admin)</h2>
      <form onSubmit={handleCreateUser} className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Nombre Completo</label>
          <input 
            type="text" 
            value={fullName} 
            onChange={(e) => setFullName(e.target.value)} 
            required 
            className="w-full border p-2 rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Correo Electrónico</label>
          <input 
            type="email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required 
            className="w-full border p-2 rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Contraseña Temporal</label>
          <input 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required 
            className="w-full border p-2 rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Rol del Sistema</label>
          <select 
            value={role} 
            onChange={(e) => setRole(e.target.value as any)} 
            className="w-full border p-2 rounded"
          >
            <option value="staff">Staff / Técnico</option>
            <option value="admin">Administrador</option>
            <option value="client">Cliente</option>
          </select>
        </div>
        <button 
          type="submit" 
          disabled={loading} 
          className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700"
        >
          {loading ? 'Creando usuario...' : 'Crear Usuario'}
        </button>
        {message && <p className="text-sm mt-2 text-center">{message}</p>}
      </form>
    </div>
  )
}
