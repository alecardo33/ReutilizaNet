import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface Transaction {
  id: string
  type: 'purchase' | 'sale' | 'expense'
  description: string
  amount: number
  category: string
  created_at: string
}

export default function Reports() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTransactions()
  }, [])

  async function fetchTransactions() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      if (data) setTransactions(data)
    } catch (error) {
      console.error('Error al cargar transacciones para reportes:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filtrar transacciones del mes actual
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  const monthlyTransactions = transactions.filter(tx => {
    const txDate = new Date(tx.created_at)
    return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear
  })

  // Cálculos financieros del mes
  const totalSales = monthlyTransactions
    .filter(tx => tx.type === 'sale')
    .reduce((acc, curr) => acc + curr.amount, 0)

  const totalPurchases = monthlyTransactions
    .filter(tx => tx.type === 'purchase')
    .reduce((acc, curr) => acc + curr.amount, 0)

  const totalExpenses = monthlyTransactions
    .filter(tx => tx.type === 'expense')
    .reduce((acc, curr) => acc + curr.amount, 0)

  // Saldo de Ganancias Netas (Ventas - Compras - Gastos)
  const netProfit = totalSales - (totalPurchases + totalExpenses)

  if (loading) return <div className="p-6">Cargando reportes mensuales...</div>

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Reportes y Cierre Mensual</h1>
      <p className="text-gray-600 mb-6">
        Resumen financiero del mes actual ({now.toLocaleString('default', { month: 'long' })} {currentYear})
      </p>

      {/* Tarjetas de Resumen Financiero */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-5 rounded-lg shadow border-l-4 border-green-500">
          <p className="text-sm font-medium text-gray-500">Total Ventas (Ingresos)</p>
          <p className="text-2xl font-bold text-green-600 mt-1">${totalSales.toFixed(2)}</p>
        </div>

        <div className="bg-white p-5 rounded-lg shadow border-l-4 border-blue-500">
          <p className="text-sm font-medium text-gray-500">Total Compras (Insumos/Equipos)</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">${totalPurchases.toFixed(2)}</p>
        </div>

        <div className="bg-white p-5 rounded-lg shadow border-l-4 border-red-500">
          <p className="text-sm font-medium text-gray-500">Gastos (Alquiler, Empleados)</p>
          <p className="text-2xl font-bold text-red-600 mt-1">${totalExpenses.toFixed(2)}</p>
        </div>

        <div className={`bg-white p-5 rounded-lg shadow border-l-4 ${netProfit >= 0 ? 'border-emerald-600' : 'border-orange-500'}`}>
          <p className="text-sm font-medium text-gray-500">Ganancias Netas</p>
          <p className={`text-2xl font-bold mt-1 ${netProfit >= 0 ? 'text-emerald-700' : 'text-orange-600'}`}>
            ${netProfit.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Detalle de Movimientos del Mes */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b">
          <h2 className="text-lg font-semibold text-gray-800">Movimientos Registrados este Mes</h2>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descripción / Categoría</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Monto</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {monthlyTransactions.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                  No hay movimientos registrados en este mes.
                </td>
              </tr>
            ) : (
              monthlyTransactions.map((tx) => {
                const isIncome = tx.type === 'sale'
                return (
                  <tr key={tx.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(tx.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        tx.type === 'sale' ? 'bg-green-100 text-green-800' :
                        tx.type === 'purchase' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {tx.type === 'sale' ? 'Venta' : tx.type === 'purchase' ? 'Compra' : 'Gasto'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {tx.description} <br />
                      <span className="text-xs text-gray-400 font-normal">{tx.category}</span>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-bold ${
                      isIncome ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {isIncome ? '+' : '-'}${tx.amount.toFixed(2)}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
