import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface SaleRecord {
  id: string
  product_name: string
  customer?: string
  quantity: number
  unit_cost: number
  total_amount: number
  amount_paid?: number
  payment_status?: string
  payment_method: string
  created_at: string
}

interface PurchaseRecord {
  id: string
  item_name: string
  category: string
  supplier: string
  quantity: number
  unit_cost: number
  total_cost: number
  created_at: string
}

export default function Reports() {
  const navigate = useNavigate()
  const [sales, setSales] = useState<SaleRecord[]>([])
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([])
  const [inventoryValue, setInventoryValue] = useState(0)
  const [initialCapital, setInitialCapital] = useState(0)
  const [currency, setCurrency] = useState('Bs.')
  const [companyName, setCompanyName] = useState('ReutilizaNet')
  const [logoUrl, setLogoUrl] = useState('')
  const [loading, setLoading] = useState(true)

  // Filtros en Reportes
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending'>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    fetchFinancialData()
  }, [])

  const fetchFinancialData = async () => {
    setLoading(true)
    const [salesRes, invRes, settingsRes, purchasesRes] = await Promise.all([
      supabase.from('sales').select('*').order('created_at', { ascending: false }),
      supabase.from('inventory').select('cost, stock'),
      supabase.from('company_settings').select('currency, company_name, logo_url, initial_capital').eq('id', 1).single(),
      supabase.from('purchases').select('*').order('created_at', { ascending: false })
    ])

    if (salesRes.data) setSales(salesRes.data)
    if (!purchasesRes.error && purchasesRes.data) setPurchases(purchasesRes.data)
    if (settingsRes.data) {
      if (settingsRes.data.currency) setCurrency(settingsRes.data.currency)
      if (settingsRes.data.company_name) setCompanyName(settingsRes.data.company_name)
      if (settingsRes.data.logo_url) setLogoUrl(settingsRes.data.logo_url)
      setInitialCapital(Number(settingsRes.data.initial_capital) || 0)
    }

    if (invRes.data) {
      const totalInvCost = invRes.data.reduce((acc, item) => acc + (Number(item.cost) * Number(item.stock)), 0)
      setInventoryValue(totalInvCost)
    }
    setLoading(false)
  }

  const getSalePaidAmount = (sale: SaleRecord): number => {
    if (typeof sale.amount_paid === 'number' && !isNaN(sale.amount_paid)) {
      return Number(sale.amount_paid)
    }
    const match = sale.payment_method?.match(/Pagado:\s*([0-9]+(?:\.[0-9]+)?)/i)
    if (match) return Number(match[1])
    if (sale.payment_method?.toLowerCase().includes('crédito') || sale.payment_method?.toLowerCase().includes('credito')) {
      return 0
    }
    return Number(sale.total_amount)
  }

  const getSalePendingBalance = (sale: SaleRecord): number => {
    const total = Number(sale.total_amount)
    const paid = getSalePaidAmount(sale)
    return Math.max(0, Number((total - paid).toFixed(2)))
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const filteredSales = sales.filter(sale => {
    const pending = getSalePendingBalance(sale)
    const isPending = pending > 0.009

    if (statusFilter === 'pending' && !isPending) return false
    if (statusFilter === 'paid' && isPending) return false

    if (dateFrom) {
      const saleDate = new Date(sale.created_at).toISOString().split('T')[0]
      if (saleDate < dateFrom) return false
    }
    if (dateTo) {
      const saleDate = new Date(sale.created_at).toISOString().split('T')[0]
      if (saleDate > dateTo) return false
    }
    return true
  })

  const filteredPurchases = purchases.filter(p => {
    if (dateFrom) {
      const pDate = new Date(p.created_at).toISOString().split('T')[0]
      if (pDate < dateFrom) return false
    }
    if (dateTo) {
      const pDate = new Date(p.created_at).toISOString().split('T')[0]
      if (pDate > dateTo) return false
    }
    return true
  })

  const totalRevenue = filteredSales.reduce((acc, s) => acc + Number(s.total_amount), 0)
  const totalCollected = filteredSales.reduce((acc, s) => acc + getSalePaidAmount(s), 0)
  const totalReceivable = filteredSales.reduce((acc, s) => acc + getSalePendingBalance(s), 0)
  const totalSoldCost = filteredSales.reduce((acc, s) => acc + (Number(s.unit_cost) * Number(s.quantity)), 0)
  const netProfit = totalRevenue - totalSoldCost

  const totalPurchasesCost = filteredPurchases.reduce((acc, p) => acc + Number(p.total_cost), 0)
  const remainingInitialCapital = initialCapital - purchases.reduce((acc, p) => acc + Number(p.total_cost), 0)
  const totalCashOnHand = remainingInitialCapital + sales.reduce((acc, s) => acc + getSalePaidAmount(s), 0)

  const clearFilters = () => {
    setStatusFilter('all')
    setDateFrom('')
    setDateTo('')
  }

  const hasFilters = statusFilter !== 'all' || dateFrom !== '' || dateTo !== ''

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-lg shadow mb-6 gap-4">
          <div className="flex items-center gap-3">
            {logoUrl && (
              <img src={logoUrl} alt="Logo" className="w-12 h-12 object-contain rounded" />
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Panel Gerencial y Reportes — {companyName}
              </h1>
              <p className="text-sm text-gray-500">
                Control de capital inicial, compras de inventario, ventas cobradas, créditos y utilidad neta
              </p>
            </div>
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
            <button onClick={() => navigate('/admin/users')} className="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700">
              Gestionar Usuarios
            </button>
            <button onClick={() => navigate('/settings')} className="bg-gray-800 text-white px-4 py-2 rounded text-sm hover:bg-gray-900">
              Configuración
            </button>
            <button onClick={handleLogout} className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700">
              Cerrar Sesión
            </button>
          </div>
        </div>

        {/* Estado del Capital del Negocio */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-5 rounded-lg shadow border-l-4 border-gray-800">
            <p className="text-xs text-gray-500 uppercase font-semibold">Capital Inicial</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{currency} {initialCapital.toFixed(2)}</p>
            <p className="text-[11px] text-gray-400 mt-1">Fondo base registrado en Configuración</p>
          </div>

          <div className="bg-white p-5 rounded-lg shadow border-l-4 border-red-500">
            <p className="text-xs text-gray-500 uppercase font-semibold">Compras de Equipos / Periféricos</p>
            <p className="text-2xl font-bold text-red-600 mt-1">- {currency} {totalPurchasesCost.toFixed(2)}</p>
            <p className="text-[11px] text-gray-400 mt-1">Descontado del capital inicial</p>
          </div>

          <div className="bg-white p-5 rounded-lg shadow border-l-4 border-amber-500">
            <p className="text-xs text-gray-500 uppercase font-semibold">Saldo Remanente de Capital</p>
            <p className={`text-2xl font-bold mt-1 ${remainingInitialCapital >= 0 ? 'text-amber-700' : 'text-red-600'}`}>
              {currency} {remainingInitialCapital.toFixed(2)}
            </p>
            <p className="text-[11px] text-gray-400 mt-1">Capital inicial disponible sin contar ventas</p>
          </div>

          <div className="bg-white p-5 rounded-lg shadow border-l-4 border-emerald-600">
            <p className="text-xs text-gray-500 uppercase font-semibold">Liquidez Total (Capital + Cobros)</p>
            <p className={`text-2xl font-bold mt-1 ${totalCashOnHand >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
              {currency} {totalCashOnHand.toFixed(2)}
            </p>
            <p className="text-[11px] text-gray-400 mt-1">Efectivo real disponible en el negocio</p>
          </div>
        </div>

        {/* Filtros de Período y Estado */}
        <div className="bg-white p-4 rounded-lg shadow mb-6 flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Estado de Cobro</label>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as 'all' | 'paid' | 'pending')}
                className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white"
              >
                <option value="all">Todas las operaciones</option>
                <option value="paid">Solo Pagadas / Canceladas</option>
                <option value="pending">Solo Créditos Pendientes</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Desde</label>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Hasta</label>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="border border-gray-300 rounded px-3 py-1.5 text-sm bg-white"
              />
            </div>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-blue-600 hover:underline font-semibold py-2"
              >
                Limpiar filtros
              </button>
            )}
          </div>
          <div className="text-xs text-gray-500">
            Mostrando <span className="font-bold text-gray-800">{filteredSales.length}</span> ventas y <span className="font-bold text-gray-800">{filteredPurchases.length}</span> compras
          </div>
        </div>

        {/* Tarjetas de Ventas y Rentabilidad */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow border-t-4 border-emerald-600">
            <p className="text-xs text-gray-500 uppercase font-semibold">Ventas Cobradas</p>
            <p className="text-xl font-bold text-emerald-700 mt-1">{currency} {totalCollected.toFixed(2)}</p>
          </div>

          <div className="bg-white p-4 rounded-lg shadow border-t-4 border-amber-500">
            <p className="text-xs text-gray-500 uppercase font-semibold">Por Cobrar (Créditos)</p>
            <p className="text-xl font-bold text-amber-600 mt-1">{currency} {totalReceivable.toFixed(2)}</p>
          </div>

          <div className="bg-white p-4 rounded-lg shadow border-t-4 border-blue-600">
            <p className="text-xs text-gray-500 uppercase font-semibold">Facturación Total</p>
            <p className="text-xl font-bold text-gray-800 mt-1">{currency} {totalRevenue.toFixed(2)}</p>
          </div>

          <div className="bg-white p-4 rounded-lg shadow border-t-4 border-green-600">
            <p className="text-xs text-gray-500 uppercase font-semibold">Utilidad Neta Ventas</p>
            <p className="text-xl font-bold text-green-700 mt-1">{currency} {netProfit.toFixed(2)}</p>
          </div>

          <div className="bg-white p-4 rounded-lg shadow border-t-4 border-purple-600">
            <p className="text-xs text-gray-500 uppercase font-semibold">Valor Stock Actual</p>
            <p className="text-xl font-bold text-purple-700 mt-1">{currency} {inventoryValue.toFixed(2)}</p>
          </div>
        </div>

        {/* Tabla Detallada de Rentabilidad */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Rentabilidad y Estado de Cobro por Venta</h2>
          {loading ? (
            <p className="text-sm text-gray-500">Calculando reportes financieros...</p>
          ) : filteredSales.length === 0 ? (
            <p className="text-sm text-gray-500">No hay ventas que coincidan con los filtros seleccionados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Equipo / Concepto</th>
                    <th className="p-3">Cliente</th>
                    <th className="p-3 text-center">Cant.</th>
                    <th className="p-3">Venta Total</th>
                    <th className="p-3">Cobrado</th>
                    <th className="p-3">Saldo Pend.</th>
                    <th className="p-3">Costo Base</th>
                    <th className="p-3">Utilidad Neta</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-sm text-gray-700">
                  {filteredSales.map(item => {
                    const total = Number(item.total_amount)
                    const paid = getSalePaidAmount(item)
                    const pending = getSalePendingBalance(item)
                    const hasDebt = pending > 0.009
                    const costTotal = Number(item.unit_cost) * Number(item.quantity)
                    const profit = total - costTotal

                    return (
                      <tr key={item.id} className={hasDebt ? 'bg-amber-50/40 hover:bg-amber-50' : 'hover:bg-gray-50'}>
                        <td className="p-3 text-xs text-gray-500">
                          {new Date(item.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-3">
                          <p className="font-medium text-gray-900">{item.product_name}</p>
                          <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded mt-0.5 ${
                            hasDebt
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {hasDebt ? 'Crédito Pendiente' : 'Pagado'}
                          </span>
                        </td>
                        <td className="p-3 text-xs font-medium">{item.customer || 'Cliente Mostrador'}</td>
                        <td className="p-3 text-center">{item.quantity}</td>
                        <td className="p-3 font-semibold">{currency} {total.toFixed(2)}</td>
                        <td className="p-3 text-emerald-700 font-semibold">{currency} {paid.toFixed(2)}</td>
                        <td className="p-3">
                          {hasDebt ? (
                            <span className="font-bold text-amber-700">{currency} {pending.toFixed(2)}</span>
                          ) : (
                            <span className="text-xs text-gray-400">{currency} 0.00</span>
                          )}
                        </td>
                        <td className="p-3 text-red-600">-{currency} {costTotal.toFixed(2)}</td>
                        <td className={`p-3 font-bold ${profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                          {profit >= 0 ? '+' : ''}{currency} {profit.toFixed(2)}
                        </td>
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
