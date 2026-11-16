import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface InventoryItem {
  id: string
  name: string
  cost: number
  price: number
  stock: number
}

interface CartItem {
  tempId: string
  inventory_id: string | null
  product_name: string
  serial_number: string
  quantity: number
  unit_cost: number
  unit_price: number
}

interface Sale {
  id: string
  product_name: string
  serial_number?: string
  customer: string
  payment_method: string
  quantity: number
  unit_cost: number
  total_amount: number
  amount_paid?: number
  payment_status?: string
  created_at: string
}

interface Expense {
  id: string
  description: string
  category: string
  amount: number
  payment_method: string
  notes?: string
  created_at: string
}

interface CompanySettings {
  company_name: string
  nit: string
  address: string
  phone: string
  currency: string
  logo_url: string
  bank_name: string
  account_holder: string
  account_number: string
  account_type: string
  qr_image_url: string
  warranty_notes: string
}

export default function Cashbox() {
  const navigate = useNavigate()
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)

  // Pestaña activa en el panel izquierdo: 'sale' (Venta) o 'expense' (Gasto / Egreso)
  const [leftTab, setLeftTab] = useState<'sale' | 'expense'>('sale')

  // Pestaña activa en el panel derecho: 'sales' (Historial Ventas) o 'expenses' (Historial Gastos)
  const [rightTab, setRightTab] = useState<'sales' | 'expenses'>('sales')

  // Selector de ítem para agregar al carrito
  const [selectedItemId, setSelectedItemId] = useState('')
  const [manualProduct, setManualProduct] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [unitPrice, setUnitPrice] = useState('')

  // Carrito múltiple
  const [cart, setCart] = useState<CartItem[]>([])

  // Datos generales de la venta y crédito
  const [customer, setCustomer] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('Efectivo (Contado)')
  const [initialDeposit, setInitialDeposit] = useState('')

  // Formulario de Gastos Operativos (Salarios, Pasajes, Servicios, etc.)
  const [expenseDesc, setExpenseDesc] = useState('')
  const [expenseCategory, setExpenseCategory] = useState('Salarios / Sueldos')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseMethod, setExpenseMethod] = useState('Efectivo (Caja)')
  const [expenseNotes, setExpenseNotes] = useState('')
  const [savingExpense, setSavingExpense] = useState(false)

  // Filtro en historial de ventas (Todas / Cuentas por Cobrar)
  const [historyFilter, setHistoryFilter] = useState<'all' | 'pending'>('all')

  // Modal de Registro de Abono / Cuota
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [targetCreditSale, setTargetCreditSale] = useState<Sale | null>(null)
  const [installmentAmount, setInstallmentAmount] = useState('')
  const [installmentMethod, setInstallmentMethod] = useState('Efectivo (Contado)')
  const [savingInstallment, setSavingInstallment] = useState(false)

  // Modal de comprobante / nota de venta
  const [selectedReceiptGroup, setSelectedReceiptGroup] = useState<Sale[] | null>(null)
  const [warrantyNotes, setWarrantyNotes] = useState('30 días de garantía por defectos de hardware.')

  const [settings, setSettings] = useState<CompanySettings>({
    company_name: 'REUTILIZANET',
    nit: '',
    address: 'La Paz - Bolivia',
    phone: '',
    currency: 'Bs.',
    logo_url: '',
    bank_name: '',
    account_holder: '',
    account_number: '',
    account_type: 'Caja de Ahorro',
    qr_image_url: '',
    warranty_notes: '30 días de garantía por defectos de hardware (no cubre daños físicos, líquidos ni sobrecargas).',
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const [invRes, salesRes, settingsRes, expensesRes] = await Promise.all([
      supabase.from('inventory').select('id, name, cost, price, stock').gt('stock', 0).order('name'),
      supabase.from('sales').select('*').order('created_at', { ascending: false }),
      supabase.from('company_settings').select('*').eq('id', 1).single(),
      supabase.from('expenses').select('*').order('created_at', { ascending: false })
    ])

    if (invRes.data) setInventory(invRes.data)
    if (salesRes.data) setSales(salesRes.data)
    if (!expensesRes.error && expensesRes.data) setExpenses(expensesRes.data)
    if (settingsRes.data) {
      setSettings(settingsRes.data)
      if (settingsRes.data.warranty_notes) {
        setWarrantyNotes(settingsRes.data.warranty_notes)
      }
    }
    setLoading(false)
  }

  // Registrar nuevo gasto en caja
  const handleRegisterExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    const amountNum = Number(expenseAmount)
    if (!expenseDesc.trim()) return
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Ingresa un monto de gasto válido mayor a 0.')
      return
    }

    setSavingExpense(true)
    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase.from('expenses').insert([
      {
        description: expenseDesc.trim(),
        category: expenseCategory,
        amount: Number(amountNum.toFixed(2)),
        payment_method: expenseMethod,
        notes: expenseNotes.trim() || null,
        created_by: user?.id
      }
    ])

    if (error) {
      alert('Error al registrar gasto (verifica haber ejecutado el SQL de la tabla expenses en Supabase): ' + error.message)
    } else {
      setExpenseDesc('')
      setExpenseAmount('')
      setExpenseNotes('')
      setRightTab('expenses')
      await fetchData()
    }
    setSavingExpense(false)
  }

  const handleDeleteExpense = async (exp: Expense) => {
    const ok = window.confirm(`¿Eliminar el gasto "${exp.description}" por ${cur} ${Number(exp.amount).toFixed(2)}?`)
    if (!ok) return
    const { error } = await supabase.from('expenses').delete().eq('id', exp.id)
    if (!error) {
      setExpenses(prev => prev.filter(item => item.id !== exp.id))
    } else {
      alert('No se pudo eliminar el gasto: ' + error.message)
    }
  }

  // Calcular stock disponible real restando lo que ya está en el carrito
  const getAvailableStock = (itemId: string) => {
    const invItem = inventory.find(i => i.id === itemId)
    if (!invItem) return 0
    const inCartQty = cart
      .filter(c => c.inventory_id === itemId)
      .reduce((sum, c) => sum + c.quantity, 0)
    return Math.max(0, invItem.stock - inCartQty)
  }

  const handleSelectProduct = (itemId: string) => {
    setSelectedItemId(itemId)
    setQuantity(1)
    setSerialNumber('')
    if (itemId === 'manual' || itemId === '') {
      setUnitPrice('')
      return
    }
    const item = inventory.find(i => i.id === itemId)
    if (item) {
      setUnitPrice(item.price.toString())
    }
  }

  const handleAddToCart = () => {
    if (!selectedItemId) {
      alert('Selecciona un equipo o servicio antes de agregar.')
      return
    }

    const validQty = Math.max(1, Number(quantity))
    const validPrice = Number(unitPrice)
    const cleanSerial = serialNumber.trim()

    if (isNaN(validPrice) || validPrice < 0) {
      alert('Ingresa un precio unitario válido.')
      return
    }

    if (selectedItemId === 'manual') {
      if (!manualProduct.trim()) {
        alert('Escribe la descripción del servicio o venta manual.')
        return
      }
      setCart(prev => [
        ...prev,
        {
          tempId: crypto.randomUUID(),
          inventory_id: null,
          product_name: manualProduct.trim(),
          serial_number: cleanSerial,
          quantity: validQty,
          unit_cost: 0,
          unit_price: validPrice
        }
      ])
      setManualProduct('')
      setSerialNumber('')
      setSelectedItemId('')
      setQuantity(1)
      setUnitPrice('')
      return
    }

    const item = inventory.find(i => i.id === selectedItemId)
    if (!item) return

    const remainingStock = getAvailableStock(item.id)
    if (validQty > remainingStock) {
      alert(`Stock insuficiente. Solo quedan ${remainingStock} unidades disponibles de ${item.name}.`)
      return
    }

    const existingIndex = !cleanSerial
      ? cart.findIndex(
          c => c.inventory_id === item.id && c.unit_price === validPrice && !c.serial_number
        )
      : -1

    if (existingIndex >= 0) {
      const updated = [...cart]
      updated[existingIndex].quantity += validQty
      setCart(updated)
    } else {
      setCart(prev => [
        ...prev,
        {
          tempId: crypto.randomUUID(),
          inventory_id: item.id,
          product_name: item.name,
          serial_number: cleanSerial,
          quantity: validQty,
          unit_cost: Number(item.cost),
          unit_price: validPrice
        }
      ])
    }

    setSelectedItemId('')
    setSerialNumber('')
    setQuantity(1)
    setUnitPrice('')
  }

  const handleRemoveFromCart = (tempId: string) => {
    setCart(prev => prev.filter(item => item.tempId !== tempId))
  }

  const extractSerial = (sale: Sale): string => {
    if (sale.serial_number && sale.serial_number.trim() !== '') {
      return sale.serial_number.trim()
    }
    const match = sale.product_name?.match(/\[S\/N:\s*([^\]]+)\]/i)
    return match ? match[1].trim() : ''
  }

  const cleanProductName = (name: string): string => {
    return name.replace(/\s*\[S\/N:\s*[^\]]+\]/i, '').trim()
  }

  const getSalePaidAmount = (sale: Sale): number => {
    if (typeof sale.amount_paid === 'number' && !isNaN(sale.amount_paid)) {
      return Number(sale.amount_paid)
    }
    const match = sale.payment_method?.match(/Pagado:\s*([0-9]+(?:\.[0-9]+)?)/i)
    if (match) {
      return Number(match[1])
    }
    if (sale.payment_method?.toLowerCase().includes('crédito') || sale.payment_method?.toLowerCase().includes('credito')) {
      return 0
    }
    return Number(sale.total_amount)
  }

  const getSalePendingBalance = (sale: Sale): number => {
    const total = Number(sale.total_amount)
    const paid = getSalePaidAmount(sale)
    return Math.max(0, Number((total - paid).toFixed(2)))
  }

  const isCreditPending = (sale: Sale): boolean => {
    return getSalePendingBalance(sale) > 0.009
  }

  const handleConfirmCartSale = async (e: React.FormEvent) => {
    e.preventDefault()

    let itemsToProcess = [...cart]
    if (itemsToProcess.length === 0 && selectedItemId) {
      const validQty = Math.max(1, Number(quantity))
      const validPrice = Number(unitPrice)
      const cleanSerial = serialNumber.trim()
      if (selectedItemId === 'manual' && manualProduct.trim()) {
        itemsToProcess.push({
          tempId: 'direct',
          inventory_id: null,
          product_name: manualProduct.trim(),
          serial_number: cleanSerial,
          quantity: validQty,
          unit_cost: 0,
          unit_price: validPrice || 0
        })
      } else {
        const item = inventory.find(i => i.id === selectedItemId)
        if (item && validQty <= item.stock) {
          itemsToProcess.push({
            tempId: 'direct',
            inventory_id: item.id,
            product_name: item.name,
            serial_number: cleanSerial,
            quantity: validQty,
            unit_cost: Number(item.cost),
            unit_price: validPrice || Number(item.price)
          })
        }
      }
    }

    if (itemsToProcess.length === 0) {
      alert('Agrega al menos un equipo o servicio al carrito para registrar la venta.')
      return
    }

    const isCredit = paymentMethod === 'Crédito / Por Cobrar'
    const finalCustomer = customer.trim() || 'Cliente Mostrador'

    if (isCredit && !customer.trim()) {
      alert('Para ventas a crédito debes ingresar el nombre del cliente.')
      return
    }

    const operationTotal = itemsToProcess.reduce(
      (sum, item) => sum + item.unit_price * item.quantity,
      0
    )

    const depositNum = isCredit ? Math.max(0, Number(initialDeposit) || 0) : operationTotal
    if (isCredit && depositNum > operationTotal) {
      alert(`El abono inicial (${depositNum}) no puede ser mayor al total de la venta (${operationTotal.toFixed(2)}).`)
      return
    }

    setProcessing(true)
    const { data: { user } } = await supabase.auth.getUser()

    const stockDeductions: Record<string, number> = {}
    for (const item of itemsToProcess) {
      if (item.inventory_id) {
        stockDeductions[item.inventory_id] = (stockDeductions[item.inventory_id] || 0) + item.quantity
      }
    }

    for (const [invId, totalQty] of Object.entries(stockDeductions)) {
      const invItem = inventory.find(i => i.id === invId)
      if (!invItem || invItem.stock < totalQty) {
        alert(`Stock insuficiente para ${invItem?.name || 'uno de los equipos'}.`)
        setProcessing(false)
        return
      }
    }

    let remainingDeposit = depositNum
    const baseRows = itemsToProcess.map((item, idx) => {
      const lineTotal = Number((item.unit_price * item.quantity).toFixed(2))
      let linePaid = lineTotal

      if (isCredit) {
        if (idx === itemsToProcess.length - 1) {
          linePaid = Number(Math.min(lineTotal, Math.max(0, remainingDeposit)).toFixed(2))
        } else {
          const ratio = operationTotal > 0 ? lineTotal / operationTotal : 0
          linePaid = Number(Math.min(lineTotal, depositNum * ratio).toFixed(2))
          remainingDeposit = Number((remainingDeposit - linePaid).toFixed(2))
        }
      }

      const linePending = Number((lineTotal - linePaid).toFixed(2))
      const methodLabel = isCredit
        ? linePending > 0
          ? `Crédito (Pagado: ${linePaid.toFixed(2)} | Saldo: ${linePending.toFixed(2)})`
          : `Crédito Cancelado (Pagado: ${linePaid.toFixed(2)})`
        : paymentMethod

      return {
        inventory_id: item.inventory_id,
        product_name: item.product_name,
        serial_number: item.serial_number || null,
        customer: finalCustomer,
        payment_method: methodLabel,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        total_amount: lineTotal,
        sold_by: user?.id,
        _linePaid: linePaid,
        _linePending: linePending
      }
    })

    const extendedRows = baseRows.map(({ _linePaid, _linePending, ...rest }) => ({
      ...rest,
      amount_paid: _linePaid,
      payment_status: _linePending > 0 ? 'Pendiente' : 'Pagado'
    }))

    let insertedSales: Sale[] | null = null
    let saleError: any = null

    const firstAttempt = await supabase.from('sales').insert(extendedRows).select()
    if (
      firstAttempt.error &&
      (firstAttempt.error.message.includes('serial_number') ||
        firstAttempt.error.message.includes('amount_paid') ||
        firstAttempt.error.message.includes('payment_status') ||
        firstAttempt.error.message.includes('column'))
    ) {
      const fallbackRows = baseRows.map(({ _linePaid, _linePending, serial_number, product_name, ...rest }) => ({
        ...rest,
        product_name: serial_number ? `${product_name} [S/N: ${serial_number}]` : product_name
      }))
      const secondAttempt = await supabase.from('sales').insert(fallbackRows).select()
      insertedSales = secondAttempt.data
      saleError = secondAttempt.error
    } else {
      insertedSales = firstAttempt.data
      saleError = firstAttempt.error
    }

    if (saleError) {
      alert('Error al registrar la venta: ' + saleError.message)
      setProcessing(false)
      return
    }

    for (const [invId, totalQty] of Object.entries(stockDeductions)) {
      const invItem = inventory.find(i => i.id === invId)
      if (invItem) {
        await supabase
          .from('inventory')
          .update({ stock: invItem.stock - totalQty })
          .eq('id', invId)
      }
    }

    setCart([])
    setSelectedItemId('')
    setManualProduct('')
    setSerialNumber('')
    setCustomer('')
    setQuantity(1)
    setUnitPrice('')
    setInitialDeposit('')
    setPaymentMethod('Efectivo (Contado)')
    setRightTab('sales')
    await fetchData()
    setProcessing(false)

    if (insertedSales && insertedSales.length > 0) {
      setSelectedReceiptGroup(insertedSales)
    }
  }

  const openInstallmentModal = (sale: Sale) => {
    const pending = getSalePendingBalance(sale)
    setTargetCreditSale(sale)
    setInstallmentAmount(pending.toFixed(2))
    setInstallmentMethod('Efectivo (Contado)')
    setPaymentModalOpen(true)
  }

  const handleRegisterInstallment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetCreditSale) return

    const total = Number(targetCreditSale.total_amount)
    const currentPaid = getSalePaidAmount(targetCreditSale)
    const pending = getSalePendingBalance(targetCreditSale)
    const addAmount = Number(installmentAmount)

    if (isNaN(addAmount) || addAmount <= 0) {
      alert('Ingresa un monto de abono mayor a 0.')
      return
    }
    if (addAmount > pending + 0.01) {
      alert(`El abono (${addAmount.toFixed(2)}) supera el saldo pendiente (${pending.toFixed(2)}).`)
      return
    }

    setSavingInstallment(true)
    const newPaid = Number(Math.min(total, currentPaid + addAmount).toFixed(2))
    const newPending = Number(Math.max(0, total - newPaid).toFixed(2))
    const isSettled = newPending <= 0.009

    const updatedMethodLabel = isSettled
      ? `Crédito Cancelado (${installmentMethod} - Pagado: ${newPaid.toFixed(2)})`
      : `Crédito (Pagado: ${newPaid.toFixed(2)} | Saldo: ${newPending.toFixed(2)})`

    const extUpdate = await supabase
      .from('sales')
      .update({
        payment_method: updatedMethodLabel,
        amount_paid: newPaid,
        payment_status: isSettled ? 'Pagado' : 'Pendiente'
      })
      .eq('id', targetCreditSale.id)

    if (extUpdate.error && (extUpdate.error.message.includes('amount_paid') || extUpdate.error.message.includes('payment_status') || extUpdate.error.message.includes('column'))) {
      const fallbackUpdate = await supabase
        .from('sales')
        .update({ payment_method: updatedMethodLabel })
        .eq('id', targetCreditSale.id)

      if (fallbackUpdate.error) {
        alert('Error al registrar abono: ' + fallbackUpdate.error.message)
        setSavingInstallment(false)
        return
      }
    } else if (extUpdate.error) {
      alert('Error al registrar abono: ' + extUpdate.error.message)
      setSavingInstallment(false)
      return
    }

    setPaymentModalOpen(false)
    setTargetCreditSale(null)
    setInstallmentAmount('')
    await fetchData()
    setSavingInstallment(false)
  }

  const handleOpenHistoryReceipt = (targetSale: Sale) => {
    const targetTime = new Date(targetSale.created_at).getTime()
    const relatedSales = sales.filter(s => {
      const sTime = new Date(s.created_at).getTime()
      return (
        s.customer === targetSale.customer &&
        Math.abs(sTime - targetTime) <= 10000
      )
    })
    setSelectedReceiptGroup(relatedSales.length > 0 ? relatedSales.reverse() : [targetSale])
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const handlePrint = () => {
    window.print()
  }

  const cur = settings.currency || 'Bs.'

  const totalCollectedCash = sales.reduce((acc, item) => acc + getSalePaidAmount(item), 0)
  const totalExpensesAmount = expenses.reduce((acc, item) => acc + Number(item.amount || 0), 0)
  const netCashInBox = totalCollectedCash - totalExpensesAmount
  const totalReceivable = sales.reduce((acc, item) => acc + getSalePendingBalance(item), 0)
  const pendingSalesCount = sales.filter(isCreditPending).length

  const displayedSales = historyFilter === 'pending'
    ? sales.filter(isCreditPending)
    : sales

  const cartTotal = cart.reduce((acc, item) => acc + item.unit_price * item.quantity, 0)
  const previewPendingTotal = selectedItemId && cart.length === 0
    ? Math.max(1, Number(quantity)) * (Number(unitPrice) || 0)
    : cartTotal

  const receiptTotal = selectedReceiptGroup
    ? selectedReceiptGroup.reduce((acc, item) => acc + Number(item.total_amount), 0)
    : 0
  const receiptPaid = selectedReceiptGroup
    ? selectedReceiptGroup.reduce((acc, item) => acc + getSalePaidAmount(item), 0)
    : 0
  const receiptPending = Math.max(0, Number((receiptTotal - receiptPaid).toFixed(2)))

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-receipt, #printable-receipt * {
            visibility: visible;
          }
          #printable-receipt {
            position: fixed;
            left: 0;
            top: 0;
            width: 100%;
            max-width: 100%;
            margin: 0;
            padding: 16px;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-lg shadow mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Módulo de Caja, Ventas, Créditos y Gastos</h1>
            <p className="text-sm text-gray-500">Cobros con N° de Serie, cuentas por cobrar, pago de salarios, pasajes y egresos operativos</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => navigate('/')} className="bg-gray-600 text-white px-4 py-2 rounded text-sm hover:bg-gray-700">
              Inicio
            </button>
            <button onClick={() => navigate('/inventory')} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
              Ir a Inventario
            </button>
            <button onClick={() => navigate('/reports')} className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700">
              Reportes
            </button>
            <button onClick={() => navigate('/settings')} className="bg-gray-800 text-white px-4 py-2 rounded text-sm hover:bg-gray-900">
              Configuración
            </button>
            <button onClick={handleLogout} className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700">
              Cerrar Sesión
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Panel Izquierdo: Selector entre Nueva Venta y Registrar Gasto */}
          <div className="bg-white p-6 rounded-lg shadow h-fit space-y-5">
            <div className="grid grid-cols-2 gap-1.5 bg-gray-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setLeftTab('sale')}
                className={`py-2 rounded text-xs font-bold transition ${
                  leftTab === 'sale'
                    ? 'bg-green-600 text-white shadow-sm'
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                + Registrar Venta
              </button>
              <button
                type="button"
                onClick={() => setLeftTab('expense')}
                className={`py-2 rounded text-xs font-bold transition ${
                  leftTab === 'expense'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                - Registrar Gasto / Salario
              </button>
            </div>

            {leftTab === 'sale' ? (
              <>
                <div>
                  <h2 className="text-lg font-bold text-gray-800 mb-3">1. Agregar Ítems a la Venta</h2>
                  <div className="space-y-3 bg-gray-50 p-3.5 rounded-lg border border-gray-200">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Equipo o Servicio</label>
                      <select
                        value={selectedItemId}
                        onChange={e => handleSelectProduct(e.target.value)}
                        className="w-full border border-gray-300 p-2 rounded text-sm bg-white"
                      >
                        <option value="">-- Elegir producto --</option>
                        {inventory.map(item => {
                          const avail = getAvailableStock(item.id)
                          return (
                            <option key={item.id} value={item.id} disabled={avail === 0}>
                              {item.name} (Disp: {avail} | {cur} {item.price})
                            </option>
                          )
                        })}
                        <option value="manual">+ Otro servicio / venta manual</option>
                      </select>
                    </div>

                    {selectedItemId === 'manual' && (
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Descripción / Servicio</label>
                        <input
                          type="text"
                          value={manualProduct}
                          onChange={e => setManualProduct(e.target.value)}
                          placeholder="Ej: Mantenimiento / Instalación SSD"
                          className="w-full border border-gray-300 p-2 rounded text-sm bg-white"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        N° de Serie / Service Tag (Para Garantía - Opcional)
                      </label>
                      <input
                        type="text"
                        value={serialNumber}
                        onChange={e => setSerialNumber(e.target.value)}
                        placeholder="Ej: PF2X9K1L / S/N-884920"
                        className="w-full border border-gray-300 p-2 rounded text-sm bg-white font-mono"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Cantidad</label>
                        <input
                          type="number"
                          min="1"
                          value={quantity}
                          onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
                          className="w-full border border-gray-300 p-2 rounded text-sm bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Precio Unit. ({cur})</label>
                        <input
                          type="number"
                          step="0.01"
                          value={unitPrice}
                          onChange={e => setUnitPrice(e.target.value)}
                          placeholder="0.00"
                          className="w-full border border-gray-300 p-2 rounded text-sm bg-white"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddToCart}
                      className="w-full bg-blue-600 text-white font-semibold py-2 rounded text-sm hover:bg-blue-700 transition"
                    >
                      + Agregar al Carrito
                    </button>
                  </div>
                </div>

                {/* Lista del Carrito */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-bold text-gray-800 uppercase">Detalle del Carrito ({cart.length})</h3>
                    {cart.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setCart([])}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Vaciar
                      </button>
                    )}
                  </div>

                  {cart.length === 0 ? (
                    <p className="text-xs text-gray-400 italic border border-dashed border-gray-300 rounded p-3 text-center">
                      Aún no agregaste productos. Puedes sumar varios equipos o servicios aquí.
                    </p>
                  ) : (
                    <div className="border border-gray-200 rounded-lg divide-y divide-gray-200 max-h-48 overflow-y-auto">
                      {cart.map(item => (
                        <div key={item.tempId} className="p-2.5 flex justify-between items-center text-xs bg-white">
                          <div className="pr-2">
                            <p className="font-semibold text-gray-800">{item.product_name}</p>
                            {item.serial_number && (
                              <p className="text-[11px] font-mono text-blue-700">Serie: {item.serial_number}</p>
                            )}
                            <p className="text-gray-500">
                              {item.quantity} x {cur} {item.unit_price.toFixed(2)} ={' '}
                              <span className="font-bold text-gray-800">
                                {cur} {(item.quantity * item.unit_price).toFixed(2)}
                              </span>
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveFromCart(item.tempId)}
                            className="text-red-600 hover:bg-red-50 px-2 py-1 rounded font-bold"
                            title="Quitar ítem"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {cart.length > 0 && (
                    <div className="mt-2 bg-green-50 border border-green-200 rounded p-2.5 flex justify-between items-center">
                      <span className="text-xs font-bold text-green-900 uppercase">Total Carrito:</span>
                      <span className="text-lg font-extrabold text-green-700">
                        {cur} {cartTotal.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Datos de Cliente, Pago y Abono Inicial */}
                <form onSubmit={handleConfirmCartSale} className="space-y-3 border-t pt-4">
                  <h2 className="text-sm font-bold text-gray-800 uppercase">2. Datos del Cliente y Pago</h2>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Nombre del Cliente {paymentMethod === 'Crédito / Por Cobrar' ? <span className="text-red-600">* (Obligatorio)</span> : '(Opcional)'}
                    </label>
                    <input
                      type="text"
                      value={customer}
                      onChange={e => setCustomer(e.target.value)}
                      required={paymentMethod === 'Crédito / Por Cobrar'}
                      placeholder="Ej: Ana Gómez / Cliente Mostrador"
                      className="w-full border border-gray-300 p-2 rounded text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Modalidad / Método de Pago</label>
                    <select
                      value={paymentMethod}
                      onChange={e => setPaymentMethod(e.target.value)}
                      className="w-full border border-gray-300 p-2 rounded text-sm bg-white"
                    >
                      <option value="Efectivo (Contado)">Efectivo (Contado)</option>
                      <option value="Transferencia / QR">Transferencia / QR</option>
                      <option value="Crédito / Por Cobrar">Crédito / Por Cobrar (Con Abonos)</option>
                      <option value="Tarjeta">Tarjeta de Débito / Crédito</option>
                    </select>
                  </div>

                  {paymentMethod === 'Crédito / Por Cobrar' && (
                    <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 space-y-2">
                      <label className="block text-xs font-bold text-amber-900">
                        Abono Inicial / Cuota de Entrada ({cur})
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={initialDeposit}
                        onChange={e => setInitialDeposit(e.target.value)}
                        placeholder="0.00 (deja 0 si no deja adelanto)"
                        className="w-full border border-amber-400 p-2 rounded text-sm bg-white font-semibold"
                      />
                      <div className="flex justify-between text-xs pt-1 border-t border-amber-200">
                        <span className="text-amber-800">Saldo pendiente por cobrar:</span>
                        <span className="font-bold text-red-700">
                          {cur} {Math.max(0, previewPendingTotal - (Number(initialDeposit) || 0)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={processing}
                    className="w-full bg-green-600 text-white font-semibold py-2.5 rounded hover:bg-green-700 transition shadow-sm"
                  >
                    {processing
                      ? 'Procesando Venta...'
                      : cart.length > 0
                      ? `Confirmar Venta (${cur} ${cartTotal.toFixed(2)})`
                      : 'Confirmar Venta y Generar Nota'}
                  </button>
                </form>
              </>
            ) : (
              /* FORMULARIO DE GASTOS OPERATIVOS (SALARIOS, PASAJES, SERVICIOS) */
              <form onSubmit={handleRegisterExpense} className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">Registrar Gasto / Salida de Caja</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Descuenta directamente del efectivo en caja y de la utilidad neta del negocio.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Categoría del Gasto</label>
                  <select
                    value={expenseCategory}
                    onChange={e => setExpenseCategory(e.target.value)}
                    className="w-full border border-gray-300 p-2 rounded text-sm bg-white"
                  >
                    <option value="Salarios / Sueldos">Salarios / Sueldos</option>
                    <option value="Pasajes / Transporte">Pasajes / Transporte / Envíos</option>
                    <option value="Alquiler / Servicios Básicos">Alquiler / Luz / Agua / Internet</option>
                    <option value="Insumos de Taller / Limpieza">Insumos de Taller / Limpieza</option>
                    <option value="Alimentación / Refrigerio">Alimentación / Refrigerio</option>
                    <option value="Otros Gastos Operativos">Otros Gastos Operativos</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Concepto / Descripción</label>
                  <input
                    type="text"
                    value={expenseDesc}
                    onChange={e => setExpenseDesc(e.target.value)}
                    required
                    placeholder="Ej: Pago sueldo técnico / Pasajes entrega laptop"
                    className="w-full border border-gray-300 p-2 rounded text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Monto ({cur})</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={expenseAmount}
                      onChange={e => setExpenseAmount(e.target.value)}
                      required
                      placeholder="0.00"
                      className="w-full border border-red-300 p-2 rounded text-sm font-bold text-red-700"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Origen del Pago</label>
                    <select
                      value={expenseMethod}
                      onChange={e => setExpenseMethod(e.target.value)}
                      className="w-full border border-gray-300 p-2 rounded text-xs bg-white"
                    >
                      <option value="Efectivo (Caja)">Efectivo (Caja)</option>
                      <option value="Transferencia / QR">Transferencia / QR</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Observación / Beneficiario (Opcional)</label>
                  <input
                    type="text"
                    value={expenseNotes}
                    onChange={e => setExpenseNotes(e.target.value)}
                    placeholder="Ej: Daniel Coronado - Quincena / Recibo N° 12"
                    className="w-full border border-gray-300 p-2 rounded text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingExpense}
                  className="w-full bg-red-600 text-white font-semibold py-2.5 rounded hover:bg-red-700 transition shadow-sm"
                >
                  {savingExpense
                    ? 'Registrando gasto...'
                    : `Registrar Gasto (- ${cur} ${(Number(expenseAmount) || 0).toFixed(2)})`}
                </button>
              </form>
            )}
          </div>

          {/* Panel Derecho: Resumen de Caja + Historial de Ventas y Gastos */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tarjetas de Resumen de Caja */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-lg shadow border-l-4 border-green-600">
                <p className="text-xs text-gray-500 uppercase font-semibold">Ingresos Cobrados</p>
                <h3 className="text-xl font-bold text-green-700 mt-1">{cur} {totalCollectedCash.toFixed(2)}</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Contado + abonos ventas</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow border-l-4 border-red-600">
                <p className="text-xs text-gray-500 uppercase font-semibold">Gastos / Salarios</p>
                <h3 className="text-xl font-bold text-red-600 mt-1">- {cur} {totalExpensesAmount.toFixed(2)}</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">{expenses.length} gasto(s) registrado(s)</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow border-l-4 border-emerald-700">
                <p className="text-xs text-gray-500 uppercase font-semibold">Saldo Neto en Caja</p>
                <h3 className={`text-xl font-bold mt-1 ${netCashInBox >= 0 ? 'text-emerald-800' : 'text-red-700'}`}>
                  {cur} {netCashInBox.toFixed(2)}
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Ingresos menos gastos</p>
              </div>
              <div className="bg-white p-4 rounded-lg shadow border-l-4 border-amber-500">
                <p className="text-xs text-gray-500 uppercase font-semibold">Cuentas por Cobrar</p>
                <h3 className="text-xl font-bold text-amber-600 mt-1">{cur} {totalReceivable.toFixed(2)}</h3>
                <p className="text-[11px] text-gray-500 mt-0.5">{pendingSalesCount} crédito(s) cliente</p>
              </div>
            </div>

            {/* Historial de Ventas y Gastos */}
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex flex-wrap justify-between items-center mb-4 gap-3 border-b pb-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => setRightTab('sales')}
                    className={`px-4 py-1.5 rounded-lg text-sm font-bold transition ${
                      rightTab === 'sales'
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Ventas y Créditos ({sales.length})
                  </button>
                  <button
                    onClick={() => setRightTab('expenses')}
                    className={`px-4 py-1.5 rounded-lg text-sm font-bold transition ${
                      rightTab === 'expenses'
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Gastos Operativos ({expenses.length})
                  </button>
                </div>

                {rightTab === 'sales' && (
                  <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
                    <button
                      onClick={() => setHistoryFilter('all')}
                      className={`px-3 py-1 rounded text-xs font-semibold transition ${
                        historyFilter === 'all'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Todas ({sales.length})
                    </button>
                    <button
                      onClick={() => setHistoryFilter('pending')}
                      className={`px-3 py-1 rounded text-xs font-semibold transition ${
                        historyFilter === 'pending'
                          ? 'bg-amber-500 text-white shadow-sm'
                          : 'text-amber-700 hover:bg-amber-100'
                      }`}
                    >
                      Por Cobrar ({pendingSalesCount})
                    </button>
                  </div>
                )}
              </div>

              {loading ? (
                <p className="text-sm text-gray-500">Cargando movimientos...</p>
              ) : rightTab === 'sales' ? (
                displayedSales.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    {historyFilter === 'pending'
                      ? 'No tienes cuentas por cobrar pendientes. ¡Todo está al día!'
                      : 'Aún no hay ventas registradas en la base de datos.'}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                          <th className="p-3">Equipo / Serie</th>
                          <th className="p-3">Cliente</th>
                          <th className="p-3">Total</th>
                          <th className="p-3">Pagado</th>
                          <th className="p-3">Saldo</th>
                          <th className="p-3">Fecha</th>
                          <th className="p-3 text-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y text-sm text-gray-700">
                        {displayedSales.map(sale => {
                          const paid = getSalePaidAmount(sale)
                          const pending = getSalePendingBalance(sale)
                          const hasDebt = pending > 0.009
                          const sn = extractSerial(sale)
                          return (
                            <tr key={sale.id} className={hasDebt ? 'bg-amber-50/40 hover:bg-amber-50' : 'hover:bg-gray-50'}>
                              <td className="p-3">
                                <p className="font-medium text-gray-900">
                                  {sale.quantity > 1 ? `${sale.quantity}x ` : ''}{cleanProductName(sale.product_name)}
                                </p>
                                {sn && (
                                  <p className="text-[11px] font-mono text-blue-700">S/N: {sn}</p>
                                )}
                                <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded mt-0.5 ${
                                  hasDebt
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-green-100 text-green-800'
                                }`}>
                                  {hasDebt ? 'Crédito Pendiente' : 'Pagado'}
                                </span>
                              </td>
                              <td className="p-3 font-medium">{sale.customer}</td>
                              <td className="p-3 font-semibold">{cur} {Number(sale.total_amount).toFixed(2)}</td>
                              <td className="p-3 text-green-700 font-semibold">{cur} {paid.toFixed(2)}</td>
                              <td className="p-3">
                                {hasDebt ? (
                                  <span className="font-bold text-red-600">{cur} {pending.toFixed(2)}</span>
                                ) : (
                                  <span className="text-xs text-gray-400">{cur} 0.00</span>
                                )}
                              </td>
                              <td className="p-3 text-gray-500 text-xs">
                                {new Date(sale.created_at).toLocaleDateString()}
                              </td>
                              <td className="p-3">
                                <div className="flex items-center justify-center gap-1.5">
                                  {hasDebt && (
                                    <button
                                      onClick={() => openInstallmentModal(sale)}
                                      className="bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1 rounded text-xs font-semibold transition"
                                    >
                                      + Abonar
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleOpenHistoryReceipt(sale)}
                                    className="bg-gray-800 text-white px-2.5 py-1 rounded text-xs hover:bg-gray-900 transition"
                                  >
                                    Nota
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                /* TABLA DE GASTOS OPERATIVOS */
                expenses.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No hay gastos registrados aún. Usa la pestaña "- Registrar Gasto / Salario" para registrar sueldos, pasajes o servicios.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                          <th className="p-3">Fecha</th>
                          <th className="p-3">Categoría</th>
                          <th className="p-3">Concepto / Detalle</th>
                          <th className="p-3">Método</th>
                          <th className="p-3">Monto</th>
                          <th className="p-3 text-center">Eliminar</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y text-sm text-gray-700">
                        {expenses.map(exp => (
                          <tr key={exp.id} className="hover:bg-red-50/40">
                            <td className="p-3 text-xs text-gray-500">
                              {new Date(exp.created_at).toLocaleDateString()}
                            </td>
                            <td className="p-3">
                              <span className="inline-block bg-red-100 text-red-800 text-[11px] font-semibold px-2 py-0.5 rounded">
                                {exp.category}
                              </span>
                            </td>
                            <td className="p-3">
                              <p className="font-medium text-gray-900">{exp.description}</p>
                              {exp.notes && <p className="text-xs text-gray-500">{exp.notes}</p>}
                            </td>
                            <td className="p-3 text-xs">{exp.payment_method}</td>
                            <td className="p-3 font-bold text-red-600">
                              - {cur} {Number(exp.amount).toFixed(2)}
                            </td>
                            <td className="p-3 text-center">
                              <button
                                onClick={() => handleDeleteExpense(exp)}
                                className="bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded text-xs font-bold"
                                title="Eliminar gasto"
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal para Registrar Abono / Cuota a Crédito */}
      {paymentModalOpen && targetCreditSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Registrar Abono / Pago de Saldo</h3>
            <p className="text-xs text-gray-500 mb-4">
              Cliente: <span className="font-semibold text-gray-800">{targetCreditSale.customer}</span> — {cleanProductName(targetCreditSale.product_name)}
            </p>

            <div className="grid grid-cols-3 gap-2 bg-gray-50 p-3 rounded-lg border border-gray-200 text-center mb-4">
              <div>
                <span className="block text-[10px] uppercase text-gray-500 font-semibold">Total Venta</span>
                <span className="text-sm font-bold text-gray-800">{cur} {Number(targetCreditSale.total_amount).toFixed(2)}</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase text-gray-500 font-semibold">Ya Pagado</span>
                <span className="text-sm font-bold text-green-700">{cur} {getSalePaidAmount(targetCreditSale).toFixed(2)}</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase text-gray-500 font-semibold">Saldo Actual</span>
                <span className="text-sm font-bold text-red-600">{cur} {getSalePendingBalance(targetCreditSale).toFixed(2)}</span>
              </div>
            </div>

            <form onSubmit={handleRegisterInstallment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monto que abona ahora ({cur})</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={getSalePendingBalance(targetCreditSale)}
                  value={installmentAmount}
                  onChange={e => setInstallmentAmount(e.target.value)}
                  required
                  className="w-full border border-gray-300 p-2 rounded text-sm font-bold text-green-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Método de recepción del abono</label>
                <select
                  value={installmentMethod}
                  onChange={e => setInstallmentMethod(e.target.value)}
                  className="w-full border border-gray-300 p-2 rounded text-sm bg-white"
                >
                  <option value="Efectivo (Contado)">Efectivo (Contado)</option>
                  <option value="Transferencia / QR">Transferencia / QR</option>
                  <option value="Tarjeta">Tarjeta de Débito / Crédito</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentModalOpen(false)
                    setTargetCreditSale(null)
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded text-sm hover:bg-gray-300 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingInstallment}
                  className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 font-semibold"
                >
                  {savingInstallment ? 'Registrando...' : 'Confirmar Abono'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Nota de Venta / Recibo Consolidado Imprimible */}
      {selectedReceiptGroup && selectedReceiptGroup.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div
            id="printable-receipt"
            className="bg-white rounded-lg shadow-xl max-w-xl w-full p-6 border border-gray-200 my-4"
          >
            <div className="flex justify-between items-start border-b-2 border-gray-800 pb-3 mb-3 gap-3">
              <div className="flex items-start gap-3">
                {settings.logo_url && (
                  <img
                    src={settings.logo_url}
                    alt="Logo Empresa"
                    className="w-14 h-14 object-contain shrink-0"
                  />
                )}
                <div>
                  <h2 className="text-xl font-extrabold tracking-tight text-gray-900 uppercase">
                    {settings.company_name || 'REUTILIZANET'}
                  </h2>
                  {settings.nit && (
                    <p className="text-xs font-semibold text-gray-700">NIT: {settings.nit}</p>
                  )}
                  {settings.address && (
                    <p className="text-xs text-gray-600">{settings.address}</p>
                  )}
                  {settings.phone && (
                    <p className="text-xs text-gray-600">Tel / WhatsApp: {settings.phone}</p>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="inline-block bg-gray-900 text-white text-xs font-bold px-2.5 py-1 rounded uppercase">
                  Nota de Venta
                </span>
                <p className="text-xs text-gray-600 mt-1 font-mono">
                  N° {selectedReceiptGroup[0].id.slice(0, 8).toUpperCase()}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(selectedReceiptGroup[0].created_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-2.5 rounded text-xs mb-3 border border-gray-200">
              <div>
                <p className="text-gray-500 uppercase font-semibold">Cliente:</p>
                <p className="text-gray-900 font-bold text-sm mt-0.5">{selectedReceiptGroup[0].customer}</p>
              </div>
              <div className="text-right">
                <p className="text-gray-500 uppercase font-semibold">Estado de Pago:</p>
                <p className={`font-bold text-sm mt-0.5 ${receiptPending > 0 ? 'text-red-700' : 'text-green-700'}`}>
                  {receiptPending > 0 ? 'Crédito / Saldo Pendiente' : 'Cancelado Total'}
                </p>
              </div>
            </div>

            <table className="w-full text-left border-collapse mb-3 text-sm">
              <thead>
                <tr className="border-b border-gray-300 text-xs uppercase text-gray-600">
                  <th className="py-1.5">Cant.</th>
                  <th className="py-1.5">Descripción</th>
                  <th className="py-1.5">N° Serie</th>
                  <th className="py-1.5 text-right">P. Unit.</th>
                  <th className="py-1.5 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {selectedReceiptGroup.map(item => {
                  const sn = extractSerial(item)
                  return (
                    <tr key={item.id}>
                      <td className="py-2 font-semibold">{item.quantity}</td>
                      <td className="py-2 font-medium text-gray-800">{cleanProductName(item.product_name)}</td>
                      <td className="py-2 font-mono text-xs text-gray-700">{sn || '—'}</td>
                      <td className="py-2 text-right">
                        {cur} {(Number(item.total_amount) / Number(item.quantity)).toFixed(2)}
                      </td>
                      <td className="py-2 text-right font-bold">
                        {cur} {Number(item.total_amount).toFixed(2)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <div className="border-t-2 border-gray-800 pt-2 mb-3 space-y-1 text-right">
              <div>
                <span className="text-xs uppercase text-gray-600 font-semibold mr-3">Total Nota de Venta:</span>
                <span className="text-lg font-extrabold text-gray-900">
                  {cur} {receiptTotal.toFixed(2)}
                </span>
              </div>
              {receiptPending > 0 && (
                <>
                  <div className="text-xs text-green-700 font-semibold">
                    <span className="mr-3">Total Abonado / Pagado:</span>
                    <span>{cur} {receiptPaid.toFixed(2)}</span>
                  </div>
                  <div className="text-sm text-red-700 font-extrabold">
                    <span className="mr-3 uppercase text-xs">Saldo Pendiente por Pagar:</span>
                    <span>{cur} {receiptPending.toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-4 bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
              <div className="bg-white p-1.5 rounded border border-gray-300 shrink-0">
                {settings.qr_image_url ? (
                  <img
                    src={settings.qr_image_url}
                    alt="QR Pago Bancario"
                    className="w-24 h-24 object-contain"
                  />
                ) : (
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
                      `${settings.company_name} | Nota: ${selectedReceiptGroup[0].id.slice(0, 8).toUpperCase()} | Saldo/Monto: ${cur} ${(receiptPending > 0 ? receiptPending : receiptTotal).toFixed(2)} | Cuenta: ${settings.account_number}`
                    )}`}
                    alt="QR Referencia"
                    className="w-24 h-24 object-contain"
                  />
                )}
              </div>
              <div className="text-xs text-gray-700 space-y-1">
                <p className="font-bold text-blue-900 uppercase">Paga o cancela saldo vía QR Simple / Transferencia</p>
                {settings.bank_name && <p><span className="font-semibold">Banco:</span> {settings.bank_name}</p>}
                {settings.account_holder && <p><span className="font-semibold">Titular:</span> {settings.account_holder}</p>}
                {settings.account_number && (
                  <p>
                    <span className="font-semibold">Cuenta:</span> {settings.account_number}{' '}
                    {settings.account_type ? `(${settings.account_type})` : ''}
                  </p>
                )}
                <p className="text-blue-800 font-semibold">
                  Ref. Nota N° {selectedReceiptGroup[0].id.slice(0, 8).toUpperCase()} —{' '}
                  {receiptPending > 0
                    ? `Saldo Pendiente: ${cur} ${receiptPending.toFixed(2)}`
                    : `Monto: ${cur} ${receiptTotal.toFixed(2)}`}
                </p>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-700 uppercase mb-1">Condiciones de Garantía / Observaciones:</p>
              <textarea
                rows={2}
                value={warrantyNotes}
                onChange={e => setWarrantyNotes(e.target.value)}
                className="w-full text-xs text-gray-600 border border-gray-300 rounded p-1.5 focus:outline-none focus:ring-1 focus:ring-gray-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-8 pt-4 text-center text-xs text-gray-600">
              <div className="border-t border-gray-400 pt-1">Entregado por ({settings.company_name})</div>
              <div className="border-t border-gray-400 pt-1">Recibí Conforme (Cliente)</div>
            </div>

            <div className="mt-4 flex justify-end gap-3 no-print border-t pt-3">
              <button
                onClick={() => setSelectedReceiptGroup(null)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded text-sm hover:bg-gray-300 font-medium"
              >
                Cerrar
              </button>
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 font-semibold"
              >
                Imprimir / Guardar PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
