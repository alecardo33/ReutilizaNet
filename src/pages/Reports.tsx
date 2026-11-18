import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Reports() {
  const navigate = useNavigate()
  const [sales, setSales] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [currency, setCurrency] = useState('Bs.')
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const [salesRes, expRes, cfgRes] = await Promise.all([
          supabase.from('sales').select('*').order('created_at', { ascending: false }),
          supabase.from('expenses').select('amount'),
          supabase.from('company_settings').select('currency').eq('id', 1).single()
        ])
        if (salesRes.error) throw salesRes.error
        setSales(salesRes.data || [])
        setExpenses(expRes.data || [])
        if (cfgRes.data?.currency) setCurrency(cfgRes.data.currency)
      } catch (err: any) {
        console.error('Error al cargar reportes:', err)
        setErrorMsg(err?.message || 'No se pudieron cargar los reportes')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const num = (v: any) => (isNaN(Number(v)) ? 0 : Number(v))
  const money = (v: any) => num(v).toFixed(2)

  const totalFacturado = sales.reduce((s, v) => s + num(v.total_amount), 0)
  const totalCosto = sales.reduce((s, v) => s + num(v.unit_cost) * num(v.quantity), 0)
  const margen = totalFacturado - totalCosto
  const totalGastos = expenses.reduce((s, e) => s + num(e.amount), 0)
  const utilidad = margen - totalGastos

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-5xl mx-auto bg-white p-6 rounded-lg shadow">
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Panel de Reportes</h1>
            <p className="text-sm text-gray-500">Historial de ventas, márgenes y gastos</p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="bg-gray-800 text-white px-4 py-2 rounded text-sm hover:bg-gray-900"
          >
            Volver al Dashboard
          </button>
        </div>

        {errorMsg && (
          <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm">{errorMsg}</div>
        )}

        {loading ? (
          <p className="text-center py-8 text-gray-500">Cargando reportes...</p>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded">
                <p className="text-xs font-semibold text-blue-800 uppercase">Ventas</p>
                <p className="text-xl font-bold text-blue-900">{sales.length}</p>
                <p className="text-sm text-blue-700">{currency} {money(totalFacturado)}</p>
              </div>
              <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded">
                <p className="text-xs font-semibold text-amber-800 uppercase">Margen bruto</p>
                <p className="text-xl font-bold text-amber-900">{currency} {money(margen)}</p>
              </div>
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                <p className="text-xs font-semibold text-red-800 uppercase">Gastos</p>
                <p className="text-xl font-bold text-red-900">{currency} {money(totalGastos)}</p>
              </div>
              <div className="bg-green-50 border-l-4 border-green-600 p-4 rounded">
                <p className="text-xs font-semibold text-green-800 uppercase">Utilidad neta</p>
                <p className="text-xl font-bold text-green-900">{currency} {money(utilidad)}</p>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold text-gray-800 mb-3">Últimas ventas</h3>
              {sales.length === 0 ? (
                <div className="bg-gray-50 p-6 rounded text-center text-gray-500 border">
                  No hay ventas registradas todavía.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 border">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 text-sm">
                      {sales.slice(0, 10).map((s, i) => (
                        <tr key={s.id ?? i} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-600">
                            {s.created_at ? new Date(s.created_at).toLocaleString() : '—'}
                          </td>
                          <td className="px-4 py-2">{String(s.product_name ?? '—')}</td>
                          <td className="px-4 py-2">{String(s.customer ?? 'Cliente Mostrador')}</td>
                          <td className="px-4 py-2 text-right font-semibold">
                            {currency} {money(s.total_amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}