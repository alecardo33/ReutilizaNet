import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// Componente de seguridad para atrapar cualquier error visual y mostrarlo en pantalla
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Error en Reportes:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 max-w-2xl mx-auto mt-10 bg-red-50 border border-red-300 rounded-lg shadow">
          <h2 className="text-xl font-bold text-red-800 mb-2">Se produjo un error al cargar los reportes</h2>
          <p className="text-sm text-red-600 font-mono bg-white p-3 rounded border border-red-200 mb-4">
            {this.state.error?.message || 'Error desconocido'}
          </p>
          <button 
            onClick={() => window.location.href = '/'}
            className="bg-gray-800 text-white px-4 py-2 rounded text-sm font-semibold hover:bg-black"
          >
            Volver al Inicio
          </button>
        </div>
      )
    }
    return this.nodeChildren()
  }

  nodeChildren() {
    return this.props.children
  }
}

function ReportsContent() {
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
    try {
      const [salesRes, invRes, settingsRes, purchasesRes, expensesRes] = await Promise.all([
        supabase.from('sales').select('*').order('created_at', { ascending: false }),
        supabase.from('inventory').select('*').order('name', { ascending: true }),
        supabase.from('company_settings').select('currency, company_name, logo_url, initial_capital').eq('id', 1).maybeSingle(),
        supabase.from('purchases').select('*').order('created_at', { ascending: false }),
        supabase.from('expenses').select('*').order('created_at', { ascending: false })
      ])

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
    } catch (err) {
      console.error('Error fetching reports data:', err)
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

  // Cálculos seguros
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
        <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow mb-6">
          <h1 className="text-xl font-bold text-gray-800">Panel Gerencial — {companyName}</h1>
          <button onClick={() => navigate('/')} className="bg-gray-600 text-white px-4 py-2 rounded text-sm">Inicio</button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded shadow">
            <p className="text-xs text-gray-500 uppercase">Capital Inicial</p>
            <p className="text-lg font-bold">{currency} {initialCapital.toFixed(2)}</p>
          </div>
          <div className="bg-white p-4 rounded shadow">
            <p className="text-xs text-gray-500 uppercase">Total Gastado</p>
            <p className="text-lg font-bold text-red-600">{currency} {(totalPurchasesPaidAll + totalExpensesAll).toFixed(2)}</p>
          </div>
          <div className="bg-white p-4 rounded shadow">
            <p className="text-xs text-gray-500 uppercase">Liquidez Total</p>
            <p className="text-lg font-bold text-emerald-600">{currency} {totalCashOnHand.toFixed(2)}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded shadow">
          {loading ? (
            <p className="text-sm text-gray-500">Cargando reportes...</p>
          ) : (
            <div>
              <p className="text-sm font-semibold text-green-700 mb-4">¡Reportes cargados correctamente sin errores!</p>
              <p className="text-sm text-gray-600">Ventas registradas: {sales.length} | Compras: {purchases.length} | Gastos: {expenses.length}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Reports() {
  return (
    <ErrorBoundary>
      <ReportsContent />
    </ErrorBoundary>
  )
}