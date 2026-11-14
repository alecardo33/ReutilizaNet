import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface SaleRecord {
  id: string
  product_name: string
  quantity: number
  unit_cost: number
  total_amount: number
  payment_method: string
  created_at: string
}

export default function Reports() {
  const navigate = useNavigate()
  const [sales, setSales] = useState<SaleRecord[]>([])
  const [inventoryValue, setInventoryValue] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchFinancialData()
  }, [])

  const fetchFinancialData = async () => {
    setLoading(true)
    const [salesRes, invRes] = await Promise.all([
      supabase.from('sales').select('*').order('created_at', { ascending: false }),
      supabase.from('inventory').select('cost, stock')
    ])

    if (salesRes.data) {
      setSales(salesRes.data)
    }

    if (invRes.data) {
      const totalInvCost = invRes.data.reduce((acc, item) => acc + (Number(item.cost) * Number(item.stock)), 0)
      setInventoryValue(totalInvCost)
    }
    setLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const totalRevenue = sales.reduce((acc, s) => acc + Number(s.total_amount), 0)
  const totalSoldCost = sales.reduce((acc, s) => acc + (Number(s.unit_cost) * Number(s.quantity)), 0)
  const netProfit = totalRevenue - totalSoldCost

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-lg shadow mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Panel Gerencial y Reportes Financieros</h1>
            <p className="text-sm text-gray-500">Métricas reales calculadas desde tus ventas e inventario en Supabase</p>
          </div>
          <div className="flex flex-wrap gap-2">
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
            <p className="text-xs text-gray-500 uppercase font-semibold">Ingresos Brutos Totales</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">Bs. {totalRevenue.toFixed(2)}</p>
          </div>
          <div className="bg-white p-5 rounded-lg shadow border-t-4 border-orange-500">
            <p className="text-xs text-gray-500 uppercase font-semibold">Costo de Equipos Vendidos</p>
            <p className="text-2xl font-bold text-gray-800 mt-1">Bs. {totalSoldCost.toFixed(2)}</p>
          </div>
          <div className="bg-white p-5 rounded-lg shadow border-t-4 border-green-600">
            <p className="text-xs text-gray-500 uppercase font-semibold">Ganancia Neta Real</p>
            <p className="text-2xl font-bold text-green-700 mt-1">Bs. {netProfit.toFixed(2)}</p>
          </div>
          <div className="bg-white p-5 rounded-lg shadow border-t-4 border-purple-600">
            <p className="text-xs text-gray-500 uppercase font-semibold">Capital en Stock Actual</p>
            <p className="text-2xl font-bold text-purple-700 mt-1">Bs. {inventoryValue.toFixed(2)}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Rentabilidad por Operación Registrada</h2>
          {loading ? (
            <p className="text-sm text-gray-500">Calculando reportes financieros...</p>
          ) : sales.length === 0 ? (
            <p className="text-sm text-gray-500">Aún no hay ventas registradas para generar reportes.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Equipo / Concepto</th>
                    <th className="p-3">Cant.</th>
                    <th className="p-3">Venta Total</th>
                    <th className="p-3">Costo Base</th>
                    <th className="p-3">Utilidad Neta</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-sm text-gray-700">
                  {sales.map(item => {
                    const costTotal = Number(item.unit_cost) * Number(item.quantity)
                    const profit = Number(item.total_amount) - costTotal
                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="p-3 text-xs text-gray-500">{new Date(item.created_at).toLocaleDateString()}</td>
                        <td className="p-3 font-medium">{item.product_name}</td>
                        <td className="p-3">{item.quantity}</td>
                        <td className="p-3">Bs. {Number(item.total_amount).toFixed(2)}</td>
                        <td className="p-3 text-red-600">-Bs. {costTotal.toFixed(2)}</td>
                        <td className="p-3 font-bold text-green-700">+Bs. {profit.toFixed(2)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
