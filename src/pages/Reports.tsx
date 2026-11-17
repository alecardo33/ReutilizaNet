import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function Reports() {
  const navigate = useNavigate()
  const [sales, setSales] = useState<any[]>([])
  const [purchases, setPurchases] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [inventoryItems, setInventoryItems] = useState<any[]>([])
  const [initialCapital, setInitialCapital] = useState(0)
  const [currency, setCurrency] = useState('Bs.')
  const [companyName, setCompanyName] = useState('ReutilizaNet')
  const [logoUrl, setLogoUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const [reportTab, setReportTab] = useState<'capital_expenses' | 'sales' | 'purchases' | 'stock' | 'kardex'>('capital_expenses')
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
    setErrorMessage(null)
    try {
      const [salesRes, invRes, settingsRes, purchasesRes, expensesRes] = await Promise.all([
        supabase.from('sales').select('*').order('created_at', { ascending: false }),
        supabase.from('inventory').select('*').order('name', { ascending: true }),
        supabase.from('company_settings').select('currency, company_name, logo_url, initial_capital').eq('id', 1).maybeSingle(),
        supabase.from('purchases').select('*').order('created_at', { ascending: false }),
        supabase.from('expenses').select('*').order('created_at', { ascending: false })
      ])

      if (salesRes.error) console.error('Error sales:', salesRes.error)
      if (invRes.error) console.error('Error inventory:', invRes.error)
      if (purchasesRes.error) console.error('Error purchases:', purchasesRes.error)
      if (expensesRes.error) console.error('Error expenses:', expensesRes.error)

      if (salesRes.data) setSales(salesRes.data)
      if (purchasesRes.data) setPurchases(purchasesRes.data)
      if (expensesRes.data) setExpenses(expensesRes.data)
      if (settingsRes.data) {
        if (settingsRes.data.currency) setCurrency(settingsRes.data.currency)
        if (settingsRes.data.company_name) setCompanyName(settingsRes.data.company_name)
        if (settingsRes.data.logo_url) setLogoUrl(settingsRes.data.logo_url)
        setInitialCapital(Number(settingsRes.data.initial_capital) || 0)
      }
      if (invRes.data) setInventoryItems(invRes.data)
    } catch (err: any) {
      console.error('Error general cargando reportes:', err)
      setErrorMessage(err?.message || 'Error desconocido al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  const cleanProductName = (name?: string) => name ? name.replace(/\s*\[S\/N:\s*[^\]]+\]/i, '').trim() : 'Producto'
  const cleanSupplierName = (sup?: string) => sup ? sup.replace(/\s*\[Crédito[^\]]*\]/i, '').trim() : 'Proveedor'

  const getPurchasePaidAmount = (p: any) => {
    if (!p) return 0
    if (typeof p.amount_paid === 'number') return p.amount_paid
    return Number(p.total_cost) || 0
  }

  const getPurchasePendingDebt = (p: any) => {
    if (!p) return 0
    return Math.max(0, (Number(p.total_cost) || 0) - getPurchasePaidAmount(p))
  }

  const getSalePaidAmount = (s: any) => {
    if (!s) return 0
    if (typeof s.amount_paid === 'number') return s.amount_paid
    return Number(s.total_amount) || 0
  }

  const getSalePendingBalance = (s: any) => {
    if (!s) return 0
    return Math.max(0, (Number(s.total_amount) || 0) - getSalePaidAmount(s))
  }

  const matchesDateRange = (isoDate?: string) => {
    if (!isoDate) return true
    try {
      const day = new Date(isoDate).toISOString().split('T')[0]
      if (dateFrom && day < dateFrom) return false
      if (dateTo && day > dateTo) return false
      return true
    } catch {
      return true
    }
  }

  const matchesItemName = (rawName?: string) => {
    if (!selectedItemFilter) return true
    return cleanProductName(rawName).toLowerCase() === selectedItemFilter.toLowerCase()
  }

  // Métricas financieras seguras
  const totalExpensesAll = expenses.reduce((acc, e) => acc + Number(e?.amount || 0), 0)
  const totalPurchasesPaidAll = purchases.reduce((acc, p) => acc + getPurchasePaidAmount(p), 0)
  const totalPurchasesPayableAll = purchases.reduce((acc, p) => acc + getPurchasePendingDebt(p), 0)
  const remainingCapitalAfterOutflows = initialCapital - totalPurchasesPaidAll - totalExpensesAll
  const totalCashOnHand = remainingCapitalAfterOutflows + sales.reduce((acc, s) => acc + getSalePaidAmount(s), 0)

  const filteredSales = sales.filter(s => matchesDateRange(s?.created_at) && matchesItemName(s?.product_name))
  const filteredPurchases = purchases.filter(p => matchesDateRange(p?.created_at) && matchesItemName(p?.item_name))
  const filteredStockItems = inventoryItems.filter(i => selectedCategoryFilter === 'Todas' || i?.category === selectedCategoryFilter)

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-lg shadow mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Panel Gerencial y Reportes — {companyName}</h1>
            <p className="text-sm text-gray-500">Control financiero y de inventario</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigate('/')} className="bg-gray-600 text-white px-4 py-2 rounded text-sm hover:bg-gray-700">
              Inicio
            </button>
            <button onClick={() => navigate('/cashbox')} className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700">
              Caja
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="bg-red-50 border border-red-300 text-red-700 p-4 rounded-lg mb-6 text-sm">
            <strong>Error al cargar:</strong> {errorMessage}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-5 rounded-lg shadow border-l-4 border-gray-800">
            <p className="text-xs text-gray-500 uppercase font-semibold">Capital Inicial</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{currency} {initialCapital.toFixed(2)}</p>
          </div>
          <div className="bg-white p-5 rounded-lg shadow border-l-4 border-red-600">
            <p className="text-xs text-gray-500 uppercase font-semibold">Total Gastado / Invertido</p>
            <p className="text-xl font-bold text-red-600 mt-1">- {currency} {(totalPurchasesPaidAll + totalExpensesAll).toFixed(2)}</p>
          </div>
          <div className="bg-white p-5 rounded-lg shadow border-l-4 border-emerald-600">
            <p className="text-xs text-gray-500 uppercase font-semibold">Liquidez Total (Con Ventas)</p>
            <p className="text-xl font-bold text-emerald-700 mt-1">{currency} {totalCashOnHand.toFixed(2)}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          {loading ? (
            <p className="text-sm text-gray-500">Cargando información de reportes...</p>
          ) : (
            <div>
              <p className="text-sm text-gray-700 font-semibold mb-2">Resumen general de operaciones:</p>
              <ul className="text-sm text-gray-600 list-disc pl-5 space-y-1">
                <li>Ventas registradas: {filteredSales.length}</li>
                <li>Compras registradas: {filteredPurchases.length}</li>
                <li>Ítems en inventario: {filteredStockItems.length}</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}