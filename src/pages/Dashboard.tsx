import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Dashboard() {
  const navigate = useNavigate()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Encabezado Principal */}
        <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-lg shadow mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Panel Principal - ReutilizaNet</h1>
            <p className="text-sm text-gray-500">Gestión integral de equipos informáticos, ventas y caja</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => navigate('/settings')}
              className="bg-gray-800 text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-900 transition"
            >
              Configuración
            </button>
            <button
              onClick={handleLogout}
              className="bg-red-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-red-700 transition"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>

        {/* Módulos del Sistema */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div
            onClick={() => navigate('/inventory')}
            className="bg-white p-6 rounded-lg shadow hover:shadow-md transition cursor-pointer border-t-4 border-blue-600"
          >
            <h2 className="text-lg font-bold text-gray-800 mb-2">Inventario y Ventas</h2>
            <p className="text-sm text-gray-600">
              Control de stock de hardware, registro de ingresos, precios y emisión de notas de venta.
            </p>
          </div>

          <div
            onClick={() => navigate('/cashbox')}
            className="bg-white p-6 rounded-lg shadow hover:shadow-md transition cursor-pointer border-t-4 border-green-600"
          >
            <h2 className="text-lg font-bold text-gray-800 mb-2">Caja y Movimientos</h2>
            <p className="text-sm text-gray-600">
              Apertura y cierre de caja, registro de ingresos, egresos y control de saldo diario.
            </p>
          </div>

          <div
            onClick={() => navigate('/reports')}
            className="bg-white p-6 rounded-lg shadow hover:shadow-md transition cursor-pointer border-t-4 border-purple-600"
          >
            <h2 className="text-lg font-bold text-gray-800 mb-2">Reportes</h2>
            <p className="text-sm text-gray-600">
              Historial de ventas, márgenes de ganancia, movimientos de caja y exportación de datos.
            </p>
          </div>

          <div
            onClick={() => navigate('/admin/users')}
            className="bg-white p-6 rounded-lg shadow hover:shadow-md transition cursor-pointer border-t-4 border-amber-500"
          >
            <h2 className="text-lg font-bold text-gray-800 mb-2">Usuarios y Roles</h2>
            <p className="text-sm text-gray-600">
              Administración de cuentas del personal, permisos de acceso y control de operadores.
            </p>
          </div>

          <div
            onClick={() => navigate('/settings')}
            className="bg-white p-6 rounded-lg shadow hover:shadow-md transition cursor-pointer border-t-4 border-gray-800"
          >
            <h2 className="text-lg font-bold text-gray-800 mb-2">Configuración de Empresa</h2>
            <p className="text-sm text-gray-600">
              Datos fiscales (NIT), logotipo, moneda principal, cuenta bancaria, QR y garantías.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
