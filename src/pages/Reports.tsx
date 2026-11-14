import React from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Reports() {
  const navigate = useNavigate()

  const monthlyStats = {
    totalRevenue: 18450,
    equipmentCost: 11200,
    sparePartsCost: 1450,
    netProfit: 5800,
  }

  const recentClosures = [
    { id: 1, period: 'Semana 1 - Actual', salesCount: 12, revenue: 6200, cost: 4100, profit: 2100 },
    { id: 2, period: 'Semana 2 - Actual', salesCount: 15, revenue: 7450, cost: 4850, profit: 2600 },
    { id: 3, period: 'Semana 3 - En curso', salesCount: 9, revenue: 4800, cost: 3700, profit: 1100 },
  ]

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-lg shadow mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Panel Gerencial y Reportes Financieros</h1>
            <p className="text-sm text-gray-500">Acceso exclusivo de Administración - Rentabilidad y costos de reacondicionamiento</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigate('/inventory')} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
              Inventario
            </button>
            <button onClick={() => navigate('/cashbox')} className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700">
              Caja
            </button>
            <button onClick={() => navigate('/register')} className="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700">
              Gestionar Usuarios
            </button>
            <button onClick={handleLogout} className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700">
              Cerrar Sesión
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-5 rounded-lg shadow border-t-4 border-blue-600">
            <p className="text-xs text-gray-500 uppercase font-semibold">Ingresos Brutos (Mes)</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">${monthlyStats.totalRevenue}</p>
          </div>
          <div className="bg-white p-5 rounded-lg shadow border-t-4 border-orange-500">
            <p className="text-xs text-gray-500 uppercase font-semibold">Costo Compra Equipos</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">${monthlyStats.equipmentCost}</p>
          </div>
          <div className="bg-white p-5 rounded-lg shadow border-t-4 border-yellow-500">
            <p className="text-xs text-gray-500 uppercase font-semibold">Inversión en Repuestos</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">${monthlyStats.sparePartsCost}</p>
          </div>
          <div className="bg-white p-5 rounded-lg shadow border-t-4 border-green-600">
            <p className="text-xs text-gray-500 uppercase font-semibold">Ganancia Neta Libre</p>
            <p className="text-2xl font-bold text-green-700 mt-1">${monthlyStats.netProfit}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Desglose de Rendimiento por Semana</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                  <th className="p-3">Periodo</th>
                  <th className="p-3">Equipos Vendidos</th>
                  <th className="p-3">Ventas Totales</th>
                  <th className="p-3">Costo Base + Taller</th>
                  <th className="p-3">Utilidad Neta</th>
                </tr>
              </thead>
              <tbody className="divide-y text-sm text-gray-700">
                {recentClosures.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="p-3 font-medium">{item.period}</td>
                    <td className="p-3">{item.salesCount} unidades</td>
                    <td className="p-3">${item.revenue}</td>
                    <td className="p-3 text-red-600">-${item.cost}</td>
                    <td className="p-3 font-bold text-green-700">+${item.profit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
