import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface InventoryItem {
  id: string
  name: string
  category: string
  condition: string
  cost: number
  price: number
  stock: number
  created_at?: string
}

interface SaleRecord {
  id: string
  inventory_id?: string | null
  product_name: string
  serial_number?: string
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
  amount_paid?: number
  payment_status?: string
  created_at: string
}

interface KardexMovement {
  id: string
  date: string
  type: 'ENTRADA (Compra)' | 'SALIDA (Venta)'
  item_name: string
  reference: string
  serial_number?: string
  in_qty: number
  out_qty: number
  unit_cost: number
  total_value: number
  running_balance?: number
}

export default function Reports() {
  const navigate = useNavigate()
  const [sales, setSales] = useState<SaleRecord[]>([])
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([])
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [inventoryValue, setInventoryValue] = useState(0)
  const [initialCapital, setInitialCapital] = useState(0)
  const [currency, setCurrency] = useState('Bs.')
  const [companyName, setCompanyName] = useState('ReutilizaNet')
  const [logoUrl, setLogoUrl] = useState('')
  const [loading, setLoading] = useState(true)

  // Pestaña activa de reportes
  const [reportTab, setReportTab] = useState<'sales' | 'purchases' | 'stock' | 'kardex'>('sales')

  // Filtros globales por fecha e ítem específico
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending'>('all')
  const [selectedItemFilter, setSelectedItemFilter] = useState('')
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('Todas')

  useEffect(() => {
    fetchFinancialData()
  }, [])

  const fetchFinancialData = async () => {
    setLoading(true)
    const [salesRes, invRes, settingsRes, purchasesRes] = await Promise.all([
      supabase.from('sales').select('*').order('created_at', { ascending: false }),
      supabase.from('inventory').select('*').order('name', { ascending: true }),
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
      setInventoryItems(invRes.data)
      const totalInvCost = invRes.data.reduce((acc, item) => acc + (Number(item.cost) * Number(item.stock)), 0)
      setInventoryValue(totalInvCost)
    }
    setLoading(false)
  }

  const extractSerial = (sale: SaleRecord): string => {
    if (sale.serial_number && sale.serial_number.trim() !== '') {
      return sale.serial_number.trim()
    }
    const match = sale.product_name?.match(/\[S\/N:\s*([^\]]+)\]/i)
    return match ? match[1].trim() : ''
  }

  const cleanProductName = (name: string): string => {
    return name.replace(/\s*\[S\/N:\s*[^\]]+\]/i, '').trim()
  }

  const cleanSupplierName = (supplierStr?: string): string => {
    if (!supplierStr) return 'Proveedor General'
    return supplierStr.replace(/\s*\[Crédito[^\]]*\]/i, '').trim() || 'Proveedor General'
  }

  const getPurchasePaidAmount = (p: PurchaseRecord): number => {
    if (typeof p.amount_paid === 'number' && !isNaN(p.amount_paid)) {
      return Number(p.amount_paid)
    }
    const match = p.supplier?.match(/Pagado:\s*([0-9]+(?:\.[0-9]+)?)/i)
    if (match) return Number(match[1])
    if (p.payment_status === 'Pendiente' || p.supplier?.toLowerCase().includes('[crédito')) {
      return 0
    }
    return Number(p.total_cost) || 0
  }

  const getPurchasePendingDebt = (p: PurchaseRecord): number => {
    const total = Number(p.total_cost) || 0
    const paid = getPurchasePaidAmount(p)
    return Math.max(0, Number((total - paid).toFixed(2)))
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

  const matchesDateRange = (isoDate?: string) => {
    if (!isoDate) return true
    const day = new Date(isoDate).toISOString().split('T')[0]
    if (dateFrom && day < dateFrom) return false
    if (dateTo && day > dateTo) return false
    return true
  }

  const matchesItemName = (rawName: string) => {
    if (!selectedItemFilter) return true
    return cleanProductName(rawName).toLowerCase() === selectedItemFilter.toLowerCase()
  }

  // 1. Ventas filtradas
  const filteredSales = sales.filter(sale => {
    const pending = getSalePendingBalance(sale)
    const isPending = pending > 0.009

    if (statusFilter === 'pending' && !isPending) return false
    if (statusFilter === 'paid' && isPending) return false
    if (!matchesDateRange(sale.created_at)) return false
    if (!matchesItemName(sale.product_name)) return false
    return true
  })

  // 2. Compras filtradas
  const filteredPurchases = purchases.filter(p => {
    const debt = getPurchasePendingDebt(p)
    const isPending = debt > 0.009

    if (statusFilter === 'pending' && !isPending) return false
    if (statusFilter === 'paid' && isPending) return false
    if (!matchesDateRange(p.created_at)) return false
    if (selectedCategoryFilter !== 'Todas' && p.category !== selectedCategoryFilter) return false
    if (!matchesItemName(p.item_name)) return false
    return true
  })

  // 3. Stock de ítems específicos
  const filteredStockItems = inventoryItems.filter(item => {
    if (selectedCategoryFilter !== 'Todas' && item.category !== selectedCategoryFilter) return false
    if (selectedItemFilter && item.name.toLowerCase() !== selectedItemFilter.toLowerCase()) return false
    return true
  })

  // 4. Kardex cronológico
  const buildKardexMovements = (): KardexMovement[] => {
    const rawMovements: KardexMovement[] = []

    purchases.forEach(p => {
      if (selectedCategoryFilter !== 'Todas' && p.category !== selectedCategoryFilter) return
      if (!matchesItemName(p.item_name)) return
      const debt = getPurchasePendingDebt(p)
      rawMovements.push({
        id: `pur-${p.id}`,
        date: p.created_at,
        type: 'ENTRADA (Compra)',
        item_name: p.item_name,
        reference: `Proveedor: ${cleanSupplierName(p.supplier)}${debt > 0 ? ' (A Crédito)' : ''}`,
        in_qty: Number(p.quantity),
        out_qty: 0,
        unit_cost: Number(p.unit_cost),
        total_value: Number(p.total_cost)
      })
    })

    sales.forEach(s => {
      const cleanName = cleanProductName(s.product_name)
      const invMatch = inventoryItems.find(i => i.name.toLowerCase() === cleanName.toLowerCase())
      if (selectedCategoryFilter !== 'Todas' && invMatch && invMatch.category !== selectedCategoryFilter) return
      if (!matchesItemName(s.product_name)) return
      rawMovements.push({
        id: `sal-${s.id}`,
        date: s.created_at,
        type: 'SALIDA (Venta)',
        item_name: cleanName,
        reference: `Cliente: ${s.customer || 'Mostrador'}`,
        serial_number: extractSerial(s),
        in_qty: 0,
        out_qty: Number(s.quantity),
        unit_cost: Number(s.unit_cost),
        total_value: Number(s.total_amount)
      })
    })

    rawMovements.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    const balancesByProduct: Record<string, number> = {}
    const withBalances = rawMovements.map(mov => {
      const key = mov.item_name.toLowerCase()
      const prevBal = balancesByProduct[key] || 0
      const nextBal = prevBal + mov.in_qty - mov.out_qty
      balancesByProduct[key] = nextBal
      return {
        ...mov,
        running_balance: nextBal
      }
    })

    return withBalances.filter(mov => matchesDateRange(mov.date)).reverse()
  }

  const kardexMovements = buildKardexMovements()

  // Métricas financieras: solo compras pagadas restan del capital
  const totalRevenue = filteredSales.reduce((acc, s) => acc + Number(s.total_amount), 0)
  const totalCollected = filteredSales.reduce((acc, s) => acc + getSalePaidAmount(s), 0)
  const totalReceivable = filteredSales.reduce((acc, s) => acc + getSalePendingBalance(s), 0)
  const totalSoldCost = filteredSales.reduce((acc, s) => acc + (Number(s.unit_cost) * Number(s.quantity)), 0)
  const netProfit = totalRevenue - totalSoldCost

  const totalPurchasesPaidPeriod = filteredPurchases.reduce((acc, p) => acc + getPurchasePaidAmount(p), 0)
  const totalPurchasesPayableAll = purchases.reduce((acc, p) => acc + getPurchasePendingDebt(p), 0)
  const totalPurchasesPaidAll = purchases.reduce((acc, p) => acc + getPurchasePaidAmount(p), 0)

  const remainingInitialCapital = initialCapital - totalPurchasesPaidAll
  const totalCashOnHand = remainingInitialCapital + sales.reduce((acc, s) => acc + getSalePaidAmount(s), 0)

  const clearFilters = () => {
    setStatusFilter('all')
    setDateFrom('')
    setDateTo('')
    setSelectedItemFilter('')
    setSelectedCategoryFilter('Todas')
  }

  const hasFilters =
    statusFilter !== 'all' ||
    dateFrom !== '' ||
    dateTo !== '' ||
    selectedItemFilter !== '' ||
    selectedCategoryFilter !== 'Todas'

  const uniqueProductNames = Array.from(
    new Set([
      ...inventoryItems.map(i => i.name),
      ...purchases.map(p => p.item_name),
      ...sales.map(s => cleanProductName(s.product_name))
    ])
  ).sort()

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
        }
      `}</style>

      <div className="max-w-7xl mx-auto">
        {/* Encabezado */}
        <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-lg shadow mb-6 gap-4">
          <div className="flex items-center gap-3">
            {logoUrl && (
              <img src={logoUrl} alt="Logo" className="w-12 h-12 object-contain rounded" />
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Panel Gerencial, Kardex y Reportes — {companyName}
              </h1>
              <p className="text-sm text-gray-500">
                Consultas por fecha de compras (contado y crédito), ventas, stock específico y Kardex
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 no-print">
            <button onClick={handlePrint} className="bg-gray-900 text-white px-4 py-2 rounded text-sm hover:bg-black">
              Imprimir Reporte
            </button>
            <button onClick={() => navigate('/')} className="bg-gray-600 text-white px-4 py-2 rounded text-sm hover:bg-gray-700">
              Inicio
            </button>
            <button onClick={() => navigate('/inventory')} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
              Inventario
            </button>
            <button onClick={() => navigate('/cashbox')} className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700">
              Caja
            </button>
            <button onClick={() => navigate('/settings')} className="bg-gray-800 text-white px-4 py-2 rounded text-sm hover:bg-gray-900">
              Configuración
            </button>
            <button onClick={handleLogout} className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700">
              Cerrar Sesión
            </button>
          </div>
        </div>

        {/* Estado del Capital, Compras Pagadas y Cuentas por Pagar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-white p-5 rounded-lg shadow border-l-4 border-gray-800">
            <p className="text-xs text-gray-500 uppercase font-semibold">Capital Inicial</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{currency} {initialCapital.toFixed(2)}</p>
            <p className="text-[11px] text-gray-400 mt-1">Fondo base en Configuración</p>
          </div>

          <div className="bg-white p-5 rounded-lg shadow border-l-4 border-red-500">
            <p className="text-xs text-gray-500 uppercase font-semibold">Compras Pagadas (Período)</p>
            <p className="text-xl font-bold text-red-600 mt-1">- {currency} {totalPurchasesPaidPeriod.toFixed(2)}</p>
            <p className="text-[11px] text-gray-400 mt-1">Efectivamente salido de capital</p>
          </div>

          <div className="bg-white p-5 rounded-lg shadow border-l-4 border-orange-500">
            <p className="text-xs text-gray-500 uppercase font-semibold">Cuentas por Pagar (Créditos)</p>
            <p className="text-xl font-bold text-orange-600 mt-1">{currency} {totalPurchasesPayableAll.toFixed(2)}</p>
            <p className="text-[11px] text-gray-400 mt-1">Deuda a proveedores sin descontar</p>
          </div>

          <div className="bg-white p-5 rounded-lg shadow border-l-4 border-amber-500">
            <p className="text-xs text-gray-500 uppercase font-semibold">Saldo Remanente Capital</p>
            <p className={`text-xl font-bold mt-1 ${remainingInitialCapital >= 0 ? 'text-amber-700' : 'text-red-600'}`}>
              {currency} {remainingInitialCapital.toFixed(2)}
            </p>
            <p className="text-[11px] text-gray-400 mt-1">Capital menos compras pagadas</p>
          </div>

          <div className="bg-white p-5 rounded-lg shadow border-l-4 border-emerald-600">
            <p className="text-xs text-gray-500 uppercase font-semibold">Liquidez Total en Caja</p>
            <p className={`text-xl font-bold mt-1 ${totalCashOnHand >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
              {currency} {totalCashOnHand.toFixed(2)}
            </p>
            <p className="text-[11px] text-gray-400 mt-1">Saldo capital + ventas cobradas</p>
          </div>
        </div>

        {/* Panel de Filtros por Fecha e Ítem Específico */}
        <div className="bg-white p-4 rounded-lg shadow mb-6 space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 w-full lg:w-auto flex-1">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Fecha Desde</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Fecha Hasta</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Ítem Específico (Stock / Kardex)</label>
                <select
                  value={selectedItemFilter}
                  onChange={e => setSelectedItemFilter(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm bg-white"
                >
                  <option value="">-- Todos los ítems --</option>
                  {uniqueProductNames.map(pName => (
                    <option key={pName} value={pName}>
                      {pName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Categoría</label>
                <select
                  value={selectedCategoryFilter}
                  onChange={e => setSelectedCategoryFilter(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm bg-white"
                >
                  <option value="Todas">Todas las categorías</option>
                  <option value="Laptops">Laptops</option>
                  <option value="PCs de Escritorio">PCs de Escritorio</option>
                  <option value="Monitores">Monitores</option>
                  <option value="Componentes">Componentes</option>
                  <option value="Periféricos">Periféricos</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Estado (Pagado / Crédito)</label>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as 'all' | 'paid' | 'pending')}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm bg-white"
                >
                  <option value="all">Todas las operaciones</option>
                  <option value="paid">Solo Pagadas</option>
                  <option value="pending">Solo Créditos Pendientes</option>
                </select>
              </div>
            </div>

            {hasFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-blue-600 hover:underline font-semibold py-2 no-print"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </div>

        {/* Tarjetas Resumen de Ventas y Stock */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow border-t-4 border-emerald-600">
            <p className="text-xs text-gray-500 uppercase font-semibold">Ventas Cobradas</p>
            <p className="text-xl font-bold text-emerald-700 mt-1">{currency} {totalCollected.toFixed(2)}</p>
          </div>

          <div className="bg-white p-4 rounded-lg shadow border-t-4 border-amber-500">
            <p className="text-xs text-gray-500 uppercase font-semibold">Por Cobrar (Clientes)</p>
            <p className="text-xl font-bold text-amber-600 mt-1">{currency} {totalReceivable.toFixed(2)}</p>
          </div>

          <div className="bg-white p-4 rounded-lg shadow border-t-4 border-blue-600">
            <p className="text-xs text-gray-500 uppercase font-semibold">Facturación Período</p>
            <p className="text-xl font-bold text-gray-800 mt-1">{currency} {totalRevenue.toFixed(2)}</p>
          </div>

          <div className="bg-white p-4 rounded-lg shadow border-t-4 border-green-600">
            <p className="text-xs text-gray-500 uppercase font-semibold">Utilidad Neta Período</p>
            <p className="text-xl font-bold text-green-700 mt-1">{currency} {netProfit.toFixed(2)}</p>
          </div>

          <div className="bg-white p-4 rounded-lg shadow border-t-4 border-purple-600">
            <p className="text-xs text-gray-500 uppercase font-semibold">Valor Stock Actual</p>
            <p className="text-xl font-bold text-purple-700 mt-1">{currency} {inventoryValue.toFixed(2)}</p>
          </div>
        </div>

        {/* Pestañas de Reportes Específicos */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex flex-wrap gap-2 border-b pb-4 mb-5 no-print">
            <button
              onClick={() => setReportTab('sales')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition ${
                reportTab === 'sales' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Reporte de Ventas ({filteredSales.length})
            </button>
            <button
              onClick={() => setReportTab('purchases')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition ${
                reportTab === 'purchases' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Reporte de Compras ({filteredPurchases.length})
            </button>
            <button
              onClick={() => setReportTab('stock')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition ${
                reportTab === 'stock' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Stock de Ítems Específicos ({filteredStockItems.length})
            </button>
            <button
              onClick={() => setReportTab('kardex')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition ${
                reportTab === 'kardex' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Kardex por Fecha e Ítem ({kardexMovements.length})
            </button>
          </div>

          {loading ? (
            <p className="text-sm text-gray-500">Cargando información de reportes...</p>
          ) : reportTab === 'sales' ? (
            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-3">
                Reporte de Ventas {dateFrom || dateTo ? `(${dateFrom || 'Inicio'} al ${dateTo || 'Hoy'})` : ''}
              </h2>
              {filteredSales.length === 0 ? (
                <p className="text-sm text-gray-500">No hay ventas en el rango de fechas o filtros seleccionados.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                        <th className="p-3">Fecha</th>
                        <th className="p-3">Equipo / Concepto</th>
                        <th className="p-3">N° Serie</th>
                        <th className="p-3">Cliente</th>
                        <th className="p-3 text-center">Cant.</th>
                        <th className="p-3">Total</th>
                        <th className="p-3">Cobrado</th>
                        <th className="p-3">Saldo</th>
                        <th className="p-3">Utilidad</th>
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
                        const sn = extractSerial(item)

                        return (
                          <tr key={item.id} className={hasDebt ? 'bg-amber-50/40' : 'hover:bg-gray-50'}>
                            <td className="p-3 text-xs text-gray-500">
                              {new Date(item.created_at).toLocaleDateString()}
                            </td>
                            <td className="p-3 font-medium text-gray-900">{cleanProductName(item.product_name)}</td>
                            <td className="p-3 font-mono text-xs text-blue-700">{sn || '—'}</td>
                            <td className="p-3 text-xs">{item.customer || 'Cliente Mostrador'}</td>
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
          ) : reportTab === 'purchases' ? (
            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-3">
                Reporte de Compras (Contado y Crédito) {dateFrom || dateTo ? `(${dateFrom || 'Inicio'} al ${dateTo || 'Hoy'})` : ''}
              </h2>
              {filteredPurchases.length === 0 ? (
                <p className="text-sm text-gray-500">No hay compras registradas en el rango de fechas seleccionado.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                        <th className="p-3">Fecha</th>
                        <th className="p-3">Equipo / Periférico</th>
                        <th className="p-3">Proveedor</th>
                        <th className="p-3 text-center">Cant.</th>
                        <th className="p-3">Total Compra</th>
                        <th className="p-3">Pagado Capital</th>
                        <th className="p-3">Saldo Deuda</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-sm text-gray-700">
                      {filteredPurchases.map(p => {
                        const paid = getPurchasePaidAmount(p)
                        const debt = getPurchasePendingDebt(p)
                        const hasDebt = debt > 0.009
                        return (
                          <tr key={p.id} className={hasDebt ? 'bg-orange-50/40' : 'hover:bg-gray-50'}>
                            <td className="p-3 text-xs text-gray-500">
                              {new Date(p.created_at).toLocaleDateString()}
                            </td>
                            <td className="p-3">
                              <p className="font-medium text-gray-900">{p.item_name}</p>
                              <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded mt-0.5 ${
                                hasDebt ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'
                              }`}>
                                {hasDebt ? 'Crédito Pendiente' : 'Pagado'}
                              </span>
                            </td>
                            <td className="p-3 text-xs">{cleanSupplierName(p.supplier)}</td>
                            <td className="p-3 text-center font-semibold">{p.quantity}</td>
                            <td className="p-3 font-semibold">{currency} {Number(p.total_cost).toFixed(2)}</td>
                            <td className="p-3 text-red-600 font-semibold">- {currency} {paid.toFixed(2)}</td>
                            <td className="p-3">
                              {hasDebt ? (
                                <span className="font-bold text-orange-700">{currency} {debt.toFixed(2)}</span>
                              ) : (
                                <span className="text-xs text-gray-400">{currency} 0.00</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : reportTab === 'stock' ? (
            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-3">
                Reporte de Stock por Ítem Específico {dateFrom || dateTo ? `(Movimientos del ${dateFrom || 'Inicio'} al ${dateTo || 'Hoy'})` : ''}
              </h2>
              {filteredStockItems.length === 0 ? (
                <p className="text-sm text-gray-500">No hay ítems que coincidan con el filtro seleccionado.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                        <th className="p-3">Descripción del Ítem</th>
                        <th className="p-3">Categoría</th>
                        <th className="p-3">Estado</th>
                        <th className="p-3 text-center">Entradas (Período)</th>
                        <th className="p-3 text-center">Salidas (Período)</th>
                        <th className="p-3 text-center">Stock Actual</th>
                        <th className="p-3">Costo Unit.</th>
                        <th className="p-3">Valorización Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-sm text-gray-700">
                      {filteredStockItems.map(item => {
                        const periodIn = filteredPurchases
                          .filter(p => p.item_name.toLowerCase() === item.name.toLowerCase())
                          .reduce((sum, p) => sum + Number(p.quantity), 0)
                        const periodOut = filteredSales
                          .filter(s => cleanProductName(s.product_name).toLowerCase() === item.name.toLowerCase())
                          .reduce((sum, s) => sum + Number(s.quantity), 0)
                        const valTotal = Number(item.cost) * Number(item.stock)

                        return (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="p-3 font-medium text-gray-900">{item.name}</td>
                            <td className="p-3 text-xs">{item.category}</td>
                            <td className="p-3 text-xs">{item.condition}</td>
                            <td className="p-3 text-center text-emerald-700 font-semibold">+{periodIn}</td>
                            <td className="p-3 text-center text-red-600 font-semibold">-{periodOut}</td>
                            <td className="p-3 text-center">
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                item.stock === 0 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-800'
                              }`}>
                                {item.stock}
                              </span>
                            </td>
                            <td className="p-3">{currency} {Number(item.cost).toFixed(2)}</td>
                            <td className="p-3 font-bold text-gray-900">{currency} {valTotal.toFixed(2)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="flex flex-wrap justify-between items-center mb-3 gap-2">
                <h2 className="text-lg font-bold text-gray-800">
                  Kardex de Movimientos (Entradas, Salidas y Saldo Acumulado)
                </h2>
                {!selectedItemFilter && (
                  <span className="text-xs bg-purple-50 text-purple-800 border border-purple-200 px-2.5 py-1 rounded">
                    Tip: Selecciona un "Ítem Específico" arriba para ver su historial individual
                  </span>
                )}
              </div>

              {kardexMovements.length === 0 ? (
                <p className="text-sm text-gray-500">No hay movimientos de Kardex en el rango de fechas seleccionado.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                        <th className="p-3">Fecha y Hora</th>
                        <th className="p-3">Tipo Movimiento</th>
                        <th className="p-3">Ítem / Equipo</th>
                        <th className="p-3">Detalle / Serie</th>
                        <th className="p-3 text-center text-emerald-700">Entrada</th>
                        <th className="p-3 text-center text-red-600">Salida</th>
                        <th className="p-3 text-center bg-purple-50 text-purple-900">Saldo</th>
                        <th className="p-3">Monto Operación</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-sm text-gray-700">
                      {kardexMovements.map(mov => {
                        const isEntry = mov.type === 'ENTRADA (Compra)'
                        return (
                          <tr key={mov.id} className="hover:bg-gray-50">
                            <td className="p-3 text-xs text-gray-500">
                              {new Date(mov.date).toLocaleString()}
                            </td>
                            <td className="p-3">
                              <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded ${
                                isEntry
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {mov.type}
                              </span>
                            </td>
                            <td className="p-3 font-medium text-gray-900">{mov.item_name}</td>
                            <td className="p-3 text-xs text-gray-600">
                              <p>{mov.reference}</p>
                              {mov.serial_number && (
                                <p className="font-mono text-blue-700">S/N: {mov.serial_number}</p>
                              )}
                            </td>
                            <td className="p-3 text-center font-bold text-emerald-700">
                              {mov.in_qty > 0 ? `+${mov.in_qty}` : '—'}
                            </td>
                            <td className="p-3 text-center font-bold text-red-600">
                              {mov.out_qty > 0 ? `-${mov.out_qty}` : '—'}
                            </td>
                            <td className="p-3 text-center font-extrabold bg-purple-50/60 text-purple-900">
                              {mov.running_balance}
                            </td>
                            <td className="p-3 font-semibold">
                              {currency} {mov.total_value.toFixed(2)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
