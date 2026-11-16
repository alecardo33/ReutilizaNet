import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface Equipment {
  id: string
  name: string
  category: string
  condition: string
  cost: number
  price: number
  stock: number
  created_at?: string
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

export default function Inventory() {
  const navigate = useNavigate()
  const [userRole, setUserRole] = useState<string>('')
  const [items, setItems] = useState<Equipment[]>([])
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([])
  const [currency, setCurrency] = useState('Bs.')
  const [initialCapital, setInitialCapital] = useState(0)
  const [totalSalesCollected, setTotalSalesCollected] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Pestaña activa en la vista derecha: 'stock' o 'purchases'
  const [activeTab, setActiveTab] = useState<'stock' | 'purchases'>('stock')
  const [purchaseFilter, setPurchaseFilter] = useState<'all' | 'pending'>('all')

  // Formulario de Compra / Ingreso de Equipo o Periférico
  const [purchaseMode, setPurchaseMode] = useState<'new' | 'existing'>('new')
  const [existingItemId, setExistingItemId] = useState('')
  const [name, setName] = useState('')
  const [category, setCategory] = useState('Laptops')
  const [condition, setCondition] = useState('Reacondicionado - Grado A')
  const [supplier, setSupplier] = useState('')
  const [cost, setCost] = useState('')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('1')

  // Modalidad de pago de compra: 'cash' (Descuenta capital), 'credit' (A crédito - Cuentas por Pagar), 'none' (Ingreso sin afectación)
  const [purchasePaymentType, setPurchasePaymentType] = useState<'cash' | 'credit' | 'none'>('cash')
  const [initialSupplierDeposit, setInitialSupplierDeposit] = useState('')

  // Modal para abonar / pagar compras a crédito (Cuentas por Pagar)
  const [paySupplierModalOpen, setPaySupplierModalOpen] = useState(false)
  const [targetCreditPurchase, setTargetCreditPurchase] = useState<PurchaseRecord | null>(null)
  const [supplierInstallmentAmount, setSupplierInstallmentAmount] = useState('')
  const [savingSupplierPayment, setSavingSupplierPayment] = useState(false)

  // Filtros y búsqueda de inventario
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategory, setFilterCategory] = useState('Todas')
  const [filterCondition, setFilterCondition] = useState('Todos')
  const [onlyInStock, setOnlyInStock] = useState(false)

  // Modal de Edición de Equipo
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Equipment | null>(null)
  const [editName, setEditName] = useState('')
  const [editCategory, setEditCategory] = useState('Laptops')
  const [editCondition, setEditCondition] = useState('Reacondicionado - Grado A')
  const [editCost, setEditCost] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editStock, setEditStock] = useState('0')
  const [updatingItem, setUpdatingItem] = useState(false)

  // Modal de Upgrade / Mejora de Equipo
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false)
  const [baseEquipment, setBaseEquipment] = useState<Equipment | null>(null)
  const [selectedComponentId, setSelectedComponentId] = useState('')
  const [componentQty, setComponentQty] = useState(1)
  const [newEquipmentName, setNewEquipmentName] = useState('')
  const [newSalePrice, setNewSalePrice] = useState('')
  const [upgrading, setUpgrading] = useState(false)

  useEffect(() => {
    fetchInventoryAndCapital()
  }, [])

  const isAdmin = userRole === 'admin'

  // Helpers para interpretar pagos y saldos de compras a crédito
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

  const cleanSupplierName = (supplierStr?: string): string => {
    if (!supplierStr) return 'Proveedor General'
    return supplierStr.replace(/\s*\[Crédito[^\]]*\]/i, '').trim() || 'Proveedor General'
  }

  const getSalePaidAmount = (sale: any): number => {
    if (typeof sale.amount_paid === 'number' && !isNaN(sale.amount_paid)) {
      return Number(sale.amount_paid)
    }
    const match = sale.payment_method?.match(/Pagado:\s*([0-9]+(?:\.[0-9]+)?)/i)
    if (match) return Number(match[1])
    if (sale.payment_method?.toLowerCase().includes('crédito') || sale.payment_method?.toLowerCase().includes('credito')) {
      return 0
    }
    return Number(sale.total_amount) || 0
  }

  const fetchInventoryAndCapital = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    let detectedRole = ''
    if (user) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      if (profileData?.role) {
        detectedRole = profileData.role
        setUserRole(profileData.role)
      }
    }

    const adminCheck = detectedRole === 'admin'

    const [invRes, settingsRes] = await Promise.all([
      supabase.from('inventory').select('*').order('created_at', { ascending: false }),
      supabase.from('company_settings').select('currency, initial_capital').eq('id', 1).single()
    ])

    if (!invRes.error && invRes.data) {
      setItems(invRes.data)
    }
    if (settingsRes.data) {
      if (settingsRes.data.currency) setCurrency(settingsRes.data.currency)
      if (adminCheck) {
        setInitialCapital(Number(settingsRes.data.initial_capital) || 0)
      }
    }

    if (adminCheck) {
      const [purchasesRes, salesRes] = await Promise.all([
        supabase.from('purchases').select('*').order('created_at', { ascending: false }),
        supabase.from('sales').select('total_amount, amount_paid, payment_method')
      ])
      if (!purchasesRes.error && purchasesRes.data) {
        setPurchases(purchasesRes.data)
      }
      if (!salesRes.error && salesRes.data) {
        const collected = salesRes.data.reduce((sum, s) => sum + getSalePaidAmount(s), 0)
        setTotalSalesCollected(collected)
      }
    }

    setLoading(false)
  }

  const handleSelectExistingForRestock = (itemId: string) => {
    setExistingItemId(itemId)
    const found = items.find(i => i.id === itemId)
    if (found) {
      setName(found.name)
      setCategory(found.category)
      setCondition(found.condition)
      setCost(found.cost.toString())
      setPrice(found.price.toString())
    }
  }

  const handleRegisterPurchase = async (e: React.FormEvent) => {
    e.preventDefault()
    const qtyNum = Math.max(1, Number(stock) || 1)
    const unitCostNum = isAdmin ? (Number(cost) || 0) : 0
    const unitPriceNum = isAdmin ? (Number(price) || 0) : 0
    const totalPurchaseCost = Number((unitCostNum * qtyNum).toFixed(2))

    if (purchaseMode === 'new' && !name.trim()) return
    if (purchaseMode === 'existing' && !existingItemId) {
      alert('Selecciona un equipo o periférico existente para reabastecer.')
      return
    }

    const isCreditPurchase = isAdmin && purchasePaymentType === 'credit'
    const depositNum = isCreditPurchase
      ? Math.max(0, Number(initialSupplierDeposit) || 0)
      : purchasePaymentType === 'cash'
      ? totalPurchaseCost
      : 0

    if (isCreditPurchase && depositNum > totalPurchaseCost) {
      alert(`El adelanto (${depositNum.toFixed(2)}) no puede ser mayor al total de la compra (${totalPurchaseCost.toFixed(2)}).`)
      return
    }

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()

    try {
      let recordedItemName = name.trim()
      let recordedCategory = category

      if (purchaseMode === 'new') {
        const { error: invErr } = await supabase.from('inventory').insert([
          {
            name: recordedItemName,
            category: recordedCategory,
            condition,
            cost: unitCostNum,
            price: unitPriceNum,
            stock: qtyNum,
            created_by: user?.id
          }
        ])
        if (invErr) throw invErr
      } else {
        const existingItem = items.find(i => i.id === existingItemId)
        if (!existingItem) throw new Error('Producto no encontrado.')
        recordedItemName = existingItem.name
        recordedCategory = existingItem.category

        const prevTotalVal = existingItem.stock * Number(existingItem.cost)
        const newTotalStock = existingItem.stock + qtyNum
        const weightedCost = isAdmin && newTotalStock > 0
          ? Number(((prevTotalVal + totalPurchaseCost) / newTotalStock).toFixed(2))
          : Number(existingItem.cost)

        const { error: updErr } = await supabase
          .from('inventory')
          .update({
            stock: newTotalStock,
            cost: weightedCost,
            price: isAdmin && unitPriceNum > 0 ? unitPriceNum : existingItem.price
          })
          .eq('id', existingItem.id)

        if (updErr) throw updErr
      }

      // Registrar en historial de compras si es contado o crédito (si es 'none' no afecta capital ni deudas)
      if (isAdmin && purchasePaymentType !== 'none' && totalPurchaseCost > 0) {
        const pendingDebt = Number((totalPurchaseCost - depositNum).toFixed(2))
        const baseSupplier = supplier.trim() || 'Proveedor General'
        const encodedSupplier = isCreditPurchase
          ? `${baseSupplier} [Crédito - Pagado: ${depositNum.toFixed(2)} | Saldo: ${pendingDebt.toFixed(2)}]`
          : baseSupplier

        const extendedPayload = {
          item_name: recordedItemName,
          category: recordedCategory,
          supplier: encodedSupplier,
          quantity: qtyNum,
          unit_cost: unitCostNum,
          total_cost: totalPurchaseCost,
          amount_paid: depositNum,
          payment_status: pendingDebt > 0.009 ? 'Pendiente' : 'Pagado',
          created_by: user?.id
        }

        const firstTry = await supabase.from('purchases').insert([extendedPayload])
        if (
          firstTry.error &&
          (firstTry.error.message.includes('amount_paid') ||
            firstTry.error.message.includes('payment_status') ||
            firstTry.error.message.includes('column'))
        ) {
          const { amount_paid, payment_status, ...fallbackPayload } = extendedPayload
          const secondTry = await supabase.from('purchases').insert([fallbackPayload])
          if (secondTry.error) throw secondTry.error
        } else if (firstTry.error) {
          throw firstTry.error
        }
      }

      setName('')
      setExistingItemId('')
      setSupplier('')
      setCost('')
      setPrice('')
      setStock('1')
      setInitialSupplierDeposit('')
      setPurchasePaymentType('cash')
      await fetchInventoryAndCapital()
    } catch (err: any) {
      alert('Error al registrar compra: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // Abrir modal para pagar o abonar una compra a crédito a proveedor
  const openPaySupplierModal = (purchase: PurchaseRecord) => {
    const debt = getPurchasePendingDebt(purchase)
    setTargetCreditPurchase(purchase)
    setSupplierInstallmentAmount(debt.toFixed(2))
    setPaySupplierModalOpen(true)
  }

  // Confirmar pago o abono a proveedor (este abono SÍ descuenta del capital disponible)
  const handleConfirmSupplierPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!targetCreditPurchase) return

    const total = Number(targetCreditPurchase.total_cost)
    const currentPaid = getPurchasePaidAmount(targetCreditPurchase)
    const currentDebt = getPurchasePendingDebt(targetCreditPurchase)
    const payNow = Number(supplierInstallmentAmount)

    if (isNaN(payNow) || payNow <= 0) {
      alert('Ingresa un monto válido mayor a 0.')
      return
    }
    if (payNow > currentDebt + 0.01) {
      alert(`El abono (${payNow.toFixed(2)}) no puede superar el saldo pendiente (${currentDebt.toFixed(2)}).`)
      return
    }

    setSavingSupplierPayment(true)
    const newPaid = Number(Math.min(total, currentPaid + payNow).toFixed(2))
    const newDebt = Number(Math.max(0, total - newPaid).toFixed(2))
    const isSettled = newDebt <= 0.009
    const pureSupplier = cleanSupplierName(targetCreditPurchase.supplier)

    const updatedSupplierText = isSettled
      ? `${pureSupplier} [Crédito Cancelado - Pagado: ${newPaid.toFixed(2)}]`
      : `${pureSupplier} [Crédito - Pagado: ${newPaid.toFixed(2)} | Saldo: ${newDebt.toFixed(2)}]`

    const extUpd = await supabase
      .from('purchases')
      .update({
        supplier: updatedSupplierText,
        amount_paid: newPaid,
        payment_status: isSettled ? 'Pagado' : 'Pendiente'
      })
      .eq('id', targetCreditPurchase.id)

    if (
      extUpd.error &&
      (extUpd.error.message.includes('amount_paid') ||
        extUpd.error.message.includes('payment_status') ||
        extUpd.error.message.includes('column'))
    ) {
      const fallbackUpd = await supabase
        .from('purchases')
        .update({ supplier: updatedSupplierText })
        .eq('id', targetCreditPurchase.id)

      if (fallbackUpd.error) {
        alert('Error al registrar pago a proveedor: ' + fallbackUpd.error.message)
        setSavingSupplierPayment(false)
        return
      }
    } else if (extUpd.error) {
      alert('Error al registrar pago a proveedor: ' + extUpd.error.message)
      setSavingSupplierPayment(false)
      return
    }

    setPaySupplierModalOpen(false)
    setTargetCreditPurchase(null)
    setSupplierInstallmentAmount('')
    await fetchInventoryAndCapital()
    setSavingSupplierPayment(false)
  }

  const handleUpdateStock = async (id: string, currentStock: number, delta: number) => {
    const newStock = Math.max(0, currentStock + delta)
    const { error } = await supabase
      .from('inventory')
      .update({ stock: newStock })
      .eq('id', id)

    if (!error) {
      setItems(items.map(item => item.id === id ? { ...item, stock: newStock } : item))
    }
  }

  const openEditModal = (item: Equipment) => {
    setEditingItem(item)
    setEditName(item.name)
    setEditCategory(item.category)
    setEditCondition(item.condition)
    setEditCost(item.cost.toString())
    setEditPrice(item.price.toString())
    setEditStock(item.stock.toString())
    setEditModalOpen(true)
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingItem || !editName.trim()) return

    setUpdatingItem(true)
    const updatedFields: Partial<Equipment> = {
      name: editName.trim(),
      category: editCategory,
      condition: editCondition,
      stock: Math.max(0, Number(editStock) || 0)
    }

    if (isAdmin) {
      updatedFields.cost = Number(editCost) || 0
      updatedFields.price = Number(editPrice) || 0
    }

    const { error } = await supabase
      .from('inventory')
      .update(updatedFields)
      .eq('id', editingItem.id)

    if (!error) {
      setItems(items.map(item => item.id === editingItem.id ? { ...item, ...updatedFields } : item))
      setEditModalOpen(false)
      setEditingItem(null)
    } else {
      alert('Error al actualizar equipo: ' + error.message)
    }
    setUpdatingItem(false)
  }

  const handleDeleteEquipment = async (item: Equipment) => {
    const confirmed = window.confirm(
      `¿Estás seguro de eliminar "${item.name}" del inventario? Esta acción no se puede deshacer.`
    )
    if (!confirmed) return

    const { error } = await supabase
      .from('inventory')
      .delete()
      .eq('id', item.id)

    if (!error) {
      setItems(items.filter(i => i.id !== item.id))
    } else {
      alert('No se pudo eliminar (puede estar asociado a una venta registrada): ' + error.message)
    }
  }

  const openUpgradeModal = (equipment: Equipment) => {
    setBaseEquipment(equipment)
    setSelectedComponentId('')
    setComponentQty(1)
    setNewEquipmentName(equipment.name)
    setNewSalePrice(equipment.price.toString())
    setUpgradeModalOpen(true)
  }

  const handleSelectComponent = (compId: string) => {
    setSelectedComponentId(compId)
    if (!baseEquipment) return
    const comp = items.find(i => i.id === compId)
    if (comp) {
      setNewEquipmentName(`${baseEquipment.name} + ${componentQty > 1 ? componentQty + 'x ' : ''}${comp.name}`)
      const suggestedSale = Number(baseEquipment.price) + (Number(comp.price) * componentQty)
      setNewSalePrice(suggestedSale.toFixed(2))
    } else {
      setNewEquipmentName(baseEquipment.name)
      setNewSalePrice(baseEquipment.price.toString())
    }
  }

  const handleComponentQtyChange = (qty: number) => {
    const validQty = Math.max(1, qty)
    setComponentQty(validQty)
    if (!baseEquipment || !selectedComponentId) return
    const comp = items.find(i => i.id === selectedComponentId)
    if (comp) {
      setNewEquipmentName(`${baseEquipment.name} + ${validQty > 1 ? validQty + 'x ' : ''}${comp.name}`)
      const suggestedSale = Number(baseEquipment.price) + (Number(comp.price) * validQty)
      setNewSalePrice(suggestedSale.toFixed(2))
    }
  }

  const handleApplyUpgrade = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!baseEquipment || !selectedComponentId) return

    const component = items.find(i => i.id === selectedComponentId)
    if (!component) return

    if (baseEquipment.stock < 1) {
      alert('No hay stock disponible del equipo base para realizar la mejora.')
      return
    }

    if (component.stock < componentQty) {
      alert(`Stock insuficiente del componente. Solo hay ${component.stock} unidades disponibles.`)
      return
    }

    setUpgrading(true)
    const { data: { user } } = await supabase.auth.getUser()

    const addedCost = Number(component.cost) * componentQty
    const finalCost = Number(baseEquipment.cost) + addedCost
    const finalPrice = isAdmin
      ? (Number(newSalePrice) || Number(baseEquipment.price))
      : (Number(baseEquipment.price) + (Number(component.price) * componentQty))

    try {
      const { error: compError } = await supabase
        .from('inventory')
        .update({ stock: component.stock - componentQty })
        .eq('id', component.id)

      if (compError) throw compError

      if (baseEquipment.stock === 1) {
        const { error: updateBaseError } = await supabase
          .from('inventory')
          .update({
            name: newEquipmentName.trim() || baseEquipment.name,
            cost: finalCost,
            price: finalPrice,
            condition: 'Reacondicionado - Grado A'
          })
          .eq('id', baseEquipment.id)

        if (updateBaseError) throw updateBaseError
      } else {
        const { error: decBaseError } = await supabase
          .from('inventory')
          .update({ stock: baseEquipment.stock - 1 })
          .eq('id', baseEquipment.id)

        if (decBaseError) throw decBaseError

        const { error: insertUpgradedError } = await supabase
          .from('inventory')
          .insert([
            {
              name: newEquipmentName.trim() || baseEquipment.name,
              category: baseEquipment.category,
              condition: 'Reacondicionado - Grado A',
              cost: finalCost,
              price: finalPrice,
              stock: 1,
              created_by: user?.id
            }
          ])

        if (insertUpgradedError) throw insertUpgradedError
      }

      setUpgradeModalOpen(false)
      setBaseEquipment(null)
      await fetchInventoryAndCapital()
    } catch (err: any) {
      alert('Error al procesar la mejora del equipo: ' + err.message)
    } finally {
      setUpgrading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  // Cálculos de Capital: SOLO lo efectivamente pagado en compras descuenta del capital
  const totalPurchasesPaidFromCapital = purchases.reduce((sum, p) => sum + getPurchasePaidAmount(p), 0)
  const totalSupplierDebt = purchases.reduce((sum, p) => sum + getPurchasePendingDebt(p), 0)
  const pendingPurchasesCount = purchases.filter(p => getPurchasePendingDebt(p) > 0.009).length

  const remainingInitialCapital = initialCapital - totalPurchasesPaidFromCapital
  const availableLiquidFund = initialCapital - totalPurchasesPaidFromCapital + totalSalesCollected
  const formTotalPurchase = (Number(cost) || 0) * (Math.max(1, Number(stock) || 1))

  const displayedPurchases = purchaseFilter === 'pending'
    ? purchases.filter(p => getPurchasePendingDebt(p) > 0.009)
    : purchases

  // Filtrado en tiempo real
  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = filterCategory === 'Todas' || item.category === filterCategory
    const matchesCondition = filterCondition === 'Todos' || item.condition === filterCondition
    const matchesStock = !onlyInStock || item.stock > 0
    return matchesSearch && matchesCategory && matchesCondition && matchesStock
  })

  const clearFilters = () => {
    setSearchTerm('')
    setFilterCategory('Todas')
    setFilterCondition('Todos')
    setOnlyInStock(false)
  }

  const hasActiveFilters =
    searchTerm.trim() !== '' ||
    filterCategory !== 'Todas' ||
    filterCondition !== 'Todos' ||
    onlyInStock

  const availableComponents = items.filter(
    i => i.stock > 0 && baseEquipment && i.id !== baseEquipment.id
  )

  const selectedComponent = items.find(i => i.id === selectedComponentId)
  const calculatedNewCost = baseEquipment && selectedComponent
    ? Number(baseEquipment.cost) + (Number(selectedComponent.cost) * componentQty)
    : baseEquipment ? Number(baseEquipment.cost) : 0

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-lg shadow mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              {isAdmin ? 'Módulo de Compras, Inventario y Taller' : 'Módulo de Taller e Inventario Técnico'}
            </h1>
            <p className="text-sm text-gray-500">
              {isAdmin
                ? 'Compras al contado o a crédito (sin afectar capital hasta pagar), control de stock y repotenciación'
                : 'Control de existencias, estado físico, ensamblaje y repotenciación de equipos'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isAdmin && (
              <>
                <button onClick={() => navigate('/')} className="bg-gray-600 text-white px-4 py-2 rounded text-sm hover:bg-gray-700">
                  Inicio
                </button>
                <button onClick={() => navigate('/cashbox')} className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700">
                  Ir a Caja
                </button>
                <button onClick={() => navigate('/reports')} className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700">
                  Reportes
                </button>
                <button onClick={() => navigate('/admin/users')} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
                  Usuarios
                </button>
                <button onClick={() => navigate('/settings')} className="bg-gray-800 text-white px-4 py-2 rounded text-sm hover:bg-gray-900">
                  Configuración
                </button>
              </>
            )}
            <button onClick={handleLogout} className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700">
              Cerrar Sesión
            </button>
          </div>
        </div>

        {/* Barra de Control de Capital Inicial, Compras Pagadas y Compras a Crédito (SOLO ADMIN) */}
        {isAdmin && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow border-l-4 border-gray-800">
              <div className="flex justify-between items-start">
                <p className="text-xs text-gray-500 uppercase font-semibold">Capital Inicial</p>
                <button onClick={() => navigate('/settings')} className="text-[11px] text-blue-600 hover:underline">Editar</button>
              </div>
              <p className="text-xl font-bold text-gray-900 mt-1">{currency} {initialCapital.toFixed(2)}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Fondo base configurado</p>
            </div>

            <div className="bg-white p-4 rounded-lg shadow border-l-4 border-red-500">
              <p className="text-xs text-gray-500 uppercase font-semibold">Pagado en Compras</p>
              <p className="text-xl font-bold text-red-600 mt-1">- {currency} {totalPurchasesPaidFromCapital.toFixed(2)}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Ya descontado del capital</p>
            </div>

            <div className="bg-white p-4 rounded-lg shadow border-l-4 border-orange-500">
              <p className="text-xs text-gray-500 uppercase font-semibold">Compras a Crédito (Deuda)</p>
              <p className="text-xl font-bold text-orange-600 mt-1">{currency} {totalSupplierDebt.toFixed(2)}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">{pendingPurchasesCount} compra(s) sin descontar aún</p>
            </div>

            <div className="bg-white p-4 rounded-lg shadow border-l-4 border-amber-500">
              <p className="text-xs text-gray-500 uppercase font-semibold">Saldo Capital Inicial</p>
              <p className={`text-xl font-bold mt-1 ${remainingInitialCapital >= 0 ? 'text-amber-700' : 'text-red-600'}`}>
                {currency} {remainingInitialCapital.toFixed(2)}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">Capital menos compras pagadas</p>
            </div>

            <div className="bg-white p-4 rounded-lg shadow border-l-4 border-emerald-600">
              <p className="text-xs text-gray-500 uppercase font-semibold">Fondo Total Disponible</p>
              <p className={`text-xl font-bold mt-1 ${availableLiquidFund >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                {currency} {availableLiquidFund.toFixed(2)}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">Saldo capital + ventas cobradas</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulario de Ingreso / Compra */}
          <div className="bg-white p-6 rounded-lg shadow h-fit">
            <h2 className="text-lg font-bold text-gray-800 mb-3">
              {isAdmin ? 'Registrar Compra / Ingreso' : 'Registrar Ingreso al Taller'}
            </h2>

            <div className="grid grid-cols-2 gap-1.5 bg-gray-100 p-1 rounded-lg mb-4">
              <button
                type="button"
                onClick={() => {
                  setPurchaseMode('new')
                  setExistingItemId('')
                  setName('')
                  setCost('')
                  setPrice('')
                }}
                className={`py-1.5 rounded text-xs font-semibold transition ${
                  purchaseMode === 'new' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
                }`}
              >
                + Equipo / Pieza Nueva
              </button>
              <button
                type="button"
                onClick={() => {
                  setPurchaseMode('existing')
                  setName('')
                  setCost('')
                  setPrice('')
                }}
                className={`py-1.5 rounded text-xs font-semibold transition ${
                  purchaseMode === 'existing' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
                }`}
              >
                Sumar a Existente
              </button>
            </div>

            <form onSubmit={handleRegisterPurchase} className="space-y-3.5">
              {purchaseMode === 'existing' ? (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Seleccionar Ítem del Catálogo</label>
                  <select
                    value={existingItemId}
                    onChange={e => handleSelectExistingForRestock(e.target.value)}
                    required
                    className="w-full border border-gray-300 p-2 rounded text-sm bg-white"
                  >
                    <option value="">-- Elegir equipo o periférico --</option>
                    {items.map(it => (
                      <option key={it.id} value={it.id}>
                        {it.name} (Stock actual: {it.stock})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Descripción del Equipo / Periférico</label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      required
                      placeholder="Ej: ThinkPad T480 i5 / Mouse Logitech / SSD 512"
                      className="w-full border border-gray-300 p-2 rounded text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Categoría</label>
                      <select
                        value={category}
                        onChange={e => setCategory(e.target.value)}
                        className="w-full border border-gray-300 p-2 rounded text-xs bg-white"
                      >
                        <option value="Laptops">Laptops</option>
                        <option value="PCs de Escritorio">PCs de Escritorio</option>
                        <option value="Monitores">Monitores</option>
                        <option value="Componentes">Componentes (RAM, SSD)</option>
                        <option value="Periféricos">Periféricos y Accesorios</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Estado</label>
                      <select
                        value={condition}
                        onChange={e => setCondition(e.target.value)}
                        className="w-full border border-gray-300 p-2 rounded text-xs bg-white"
                      >
                        <option value="Reacondicionado - Grado A">Reacondicionado - Grado A</option>
                        <option value="Usado - Buen estado">Usado - Buen estado</option>
                        <option value="En taller / Para reparación">En taller / Para reparación</option>
                        <option value="Para repuestos">Para repuestos</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {isAdmin && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Proveedor / Acreedor {purchasePaymentType === 'credit' ? <span className="text-red-600">* (Obligatorio)</span> : '(Opcional)'}
                  </label>
                  <input
                    type="text"
                    value={supplier}
                    onChange={e => setSupplier(e.target.value)}
                    required={purchasePaymentType === 'credit'}
                    placeholder="Ej: Importadora Tech / Distribuidor"
                    className="w-full border border-gray-300 p-2 rounded text-sm"
                  />
                </div>
              )}

              <div className={`grid ${isAdmin ? 'grid-cols-3' : 'grid-cols-1'} gap-2`}>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Cantidad</label>
                  <input
                    type="number"
                    min="1"
                    value={stock}
                    onChange={e => setStock(e.target.value)}
                    required
                    className="w-full border border-gray-300 p-2 rounded text-sm"
                  />
                </div>
                {isAdmin && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Costo Unit. ({currency})</label>
                      <input
                        type="number"
                        step="0.01"
                        value={cost}
                        onChange={e => setCost(e.target.value)}
                        required
                        placeholder="0.00"
                        className="w-full border border-gray-300 p-2 rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Precio Venta ({currency})</label>
                      <input
                        type="number"
                        step="0.01"
                        value={price}
                        onChange={e => setPrice(e.target.value)}
                        required
                        placeholder="0.00"
                        className="w-full border border-gray-300 p-2 rounded text-sm"
                      />
                    </div>
                  </>
                )}
              </div>

              {isAdmin && (
                <div className="space-y-2.5 bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <label className="block text-xs font-bold text-gray-800 uppercase">
                    Modalidad de Pago de la Compra
                  </label>
                  <select
                    value={purchasePaymentType}
                    onChange={e => setPurchasePaymentType(e.target.value as 'cash' | 'credit' | 'none')}
                    className="w-full border border-gray-300 p-2 rounded text-xs font-semibold bg-white"
                  >
                    <option value="cash">Contado (Descuenta del Capital ahora)</option>
                    <option value="credit">A Crédito / Fiado (No descuenta capital aún)</option>
                    <option value="none">Solo ingreso a stock (Sin movimiento de caja)</option>
                  </select>

                  {purchasePaymentType === 'cash' && (
                    <div className="flex justify-between text-xs pt-1 border-t border-gray-200">
                      <span className="text-gray-600">Se descontará del capital:</span>
                      <span className="font-bold text-red-700">- {currency} {formTotalPurchase.toFixed(2)}</span>
                    </div>
                  )}

                  {purchasePaymentType === 'credit' && (
                    <div className="bg-orange-50 border border-orange-200 rounded p-2.5 space-y-2">
                      <div>
                        <label className="block text-[11px] font-bold text-orange-900 mb-1">
                          Adelanto inicial pagado hoy ({currency}) — Opcional
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={initialSupplierDeposit}
                          onChange={e => setInitialSupplierDeposit(e.target.value)}
                          placeholder="0.00 (deja 0 si no pagas nada hoy)"
                          className="w-full border border-orange-300 p-1.5 rounded text-xs bg-white font-semibold"
                        />
                      </div>
                      <div className="flex justify-between text-[11px] pt-1 border-t border-orange-200">
                        <span className="text-orange-900">Deuda pendiente con proveedor:</span>
                        <span className="font-bold text-orange-700">
                          {currency} {Math.max(0, formTotalPurchase - (Number(initialSupplierDeposit) || 0)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className={`w-full text-white font-semibold py-2.5 rounded transition ${
                  isAdmin && purchasePaymentType === 'credit'
                    ? 'bg-orange-600 hover:bg-orange-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {saving
                  ? 'Registrando...'
                  : isAdmin && purchasePaymentType === 'cash'
                  ? `Registrar Compra (- ${currency} ${formTotalPurchase.toFixed(2)})`
                  : isAdmin && purchasePaymentType === 'credit'
                  ? `Registrar Compra a Crédito (${currency} ${formTotalPurchase.toFixed(2)})`
                  : 'Agregar al Inventario'}
              </button>
            </form>
          </div>

          {/* Panel Derecho: Stock Actual y Compras / Cuentas por Pagar */}
          <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow">
            <div className="flex flex-wrap justify-between items-center mb-4 gap-3 border-b pb-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab('stock')}
                  className={`px-4 py-1.5 rounded-lg text-sm font-bold transition ${
                    activeTab === 'stock'
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Inventario Actual ({items.length})
                </button>
                {isAdmin && (
                  <button
                    onClick={() => setActiveTab('purchases')}
                    className={`px-4 py-1.5 rounded-lg text-sm font-bold transition flex items-center gap-1.5 ${
                      activeTab === 'purchases'
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <span>Compras y Créditos ({purchases.length})</span>
                    {pendingPurchasesCount > 0 && (
                      <span className="bg-orange-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                        {pendingPurchasesCount} pend.
                      </span>
                    )}
                  </button>
                )}
              </div>

              {activeTab === 'stock' && hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-blue-600 hover:underline font-medium"
                >
                  Limpiar filtros
                </button>
              )}

              {activeTab === 'purchases' && isAdmin && (
                <div className="flex gap-1.5 bg-gray-100 p-1 rounded-lg">
                  <button
                    onClick={() => setPurchaseFilter('all')}
                    className={`px-2.5 py-1 rounded text-xs font-semibold ${
                      purchaseFilter === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
                    }`}
                  >
                    Todas ({purchases.length})
                  </button>
                  <button
                    onClick={() => setPurchaseFilter('pending')}
                    className={`px-2.5 py-1 rounded text-xs font-semibold ${
                      purchaseFilter === 'pending' ? 'bg-orange-500 text-white shadow-sm' : 'text-orange-700'
                    }`}
                  >
                    Por Pagar ({pendingPurchasesCount})
                  </button>
                </div>
              )}
            </div>

            {activeTab === 'stock' || !isAdmin ? (
              <>
                {/* Barra de Búsqueda y Filtros */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 mb-4 bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Buscar equipo o pieza..."
                    className="border border-gray-300 p-2 rounded text-xs bg-white"
                  />
                  <select
                    value={filterCategory}
                    onChange={e => setFilterCategory(e.target.value)}
                    className="border border-gray-300 p-2 rounded text-xs bg-white"
                  >
                    <option value="Todas">Todas las categorías</option>
                    <option value="Laptops">Laptops</option>
                    <option value="PCs de Escritorio">PCs de Escritorio</option>
                    <option value="Monitores">Monitores</option>
                    <option value="Componentes">Componentes</option>
                    <option value="Periféricos">Periféricos</option>
                  </select>
                  <select
                    value={filterCondition}
                    onChange={e => setFilterCondition(e.target.value)}
                    className="border border-gray-300 p-2 rounded text-xs bg-white"
                  >
                    <option value="Todos">Todos los estados</option>
                    <option value="Reacondicionado - Grado A">Reacondicionado - Grado A</option>
                    <option value="Usado - Buen estado">Usado - Buen estado</option>
                    <option value="En taller / Para reparación">En taller / Para reparación</option>
                    <option value="Para repuestos">Para repuestos</option>
                  </select>
                  <label className="flex items-center gap-2 text-xs text-gray-700 font-medium px-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={onlyInStock}
                      onChange={e => setOnlyInStock(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600"
                    />
                    Solo con stock (&gt; 0)
                  </label>
                </div>

                {loading ? (
                  <p className="text-gray-500 text-sm">Cargando inventario...</p>
                ) : items.length === 0 ? (
                  <p className="text-gray-500 text-sm">No hay equipos registrados aún.</p>
                ) : filteredItems.length === 0 ? (
                  <p className="text-gray-500 text-sm">Ningún equipo coincide con los filtros aplicados.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                          <th className="p-3">Equipo / Pieza</th>
                          <th className="p-3">Categoría</th>
                          <th className="p-3">Estado</th>
                          {isAdmin && (
                            <>
                              <th className="p-3">Costo</th>
                              <th className="p-3">Venta</th>
                            </>
                          )}
                          <th className="p-3 text-center">Stock</th>
                          <th className="p-3 text-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y text-sm text-gray-700">
                        {filteredItems.map(item => (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="p-3 font-medium">{item.name}</td>
                            <td className="p-3 text-xs">{item.category}</td>
                            <td className="p-3 text-xs">{item.condition}</td>
                            {isAdmin && (
                              <>
                                <td className="p-3">{currency} {item.cost}</td>
                                <td className="p-3 font-semibold text-green-700">{currency} {item.price}</td>
                              </>
                            )}
                            <td className="p-3">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleUpdateStock(item.id, item.stock, -1)}
                                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-2 py-0.5 rounded font-bold text-xs"
                                >
                                  -
                                </button>
                                <span className={`font-bold min-w-[1.25rem] text-center ${item.stock === 0 ? 'text-red-600' : ''}`}>
                                  {item.stock}
                                </span>
                                <button
                                  onClick={() => handleUpdateStock(item.id, item.stock, 1)}
                                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-2 py-0.5 rounded font-bold text-xs"
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => openEditModal(item)}
                                  title="Editar equipo o estado"
                                  className="bg-blue-100 hover:bg-blue-200 text-blue-800 text-xs font-semibold px-2 py-1 rounded transition"
                                >
                                  Editar
                                </button>
                                {(item.category === 'Laptops' || item.category === 'PCs de Escritorio') && item.stock > 0 && (
                                  <button
                                    onClick={() => openUpgradeModal(item)}
                                    title="Instalar RAM, SSD o componente del stock"
                                    className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-2 py-1 rounded transition"
                                  >
                                    + Mejorar
                                  </button>
                                )}
                                {isAdmin && (
                                  <button
                                    onClick={() => handleDeleteEquipment(item)}
                                    title="Eliminar registro"
                                    className="bg-red-100 hover:bg-red-200 text-red-700 text-xs font-semibold px-2 py-1 rounded transition"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              /* Tabla de Historial de Compras y Cuentas por Pagar a Proveedores */
              <div>
                {displayedPurchases.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    {purchaseFilter === 'pending'
                      ? 'No tienes compras a crédito pendientes de pago.'
                      : 'Aún no hay compras registradas.'}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                          <th className="p-3">Equipo / Proveedor</th>
                          <th className="p-3 text-center">Cant.</th>
                          <th className="p-3">Total Compra</th>
                          <th className="p-3">Pagado</th>
                          <th className="p-3">Saldo Deuda</th>
                          <th className="p-3">Fecha</th>
                          <th className="p-3 text-center">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y text-sm text-gray-700">
                        {displayedPurchases.map(p => {
                          const paid = getPurchasePaidAmount(p)
                          const debt = getPurchasePendingDebt(p)
                          const hasDebt = debt > 0.009
                          return (
                            <tr key={p.id} className={hasDebt ? 'bg-orange-50/50 hover:bg-orange-50' : 'hover:bg-gray-50'}>
                              <td className="p-3">
                                <p className="font-medium text-gray-900">{p.item_name}</p>
                                <p className="text-xs text-gray-500">{cleanSupplierName(p.supplier)}</p>
                                <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded mt-0.5 ${
                                  hasDebt
                                    ? 'bg-orange-100 text-orange-800'
                                    : 'bg-green-100 text-green-800'
                                }`}>
                                  {hasDebt ? 'Crédito Pendiente' : 'Pagado'}
                                </span>
                              </td>
                              <td className="p-3 text-center font-semibold">{p.quantity}</td>
                              <td className="p-3 font-semibold">{currency} {Number(p.total_cost).toFixed(2)}</td>
                              <td className="p-3 text-red-600 font-semibold">{currency} {paid.toFixed(2)}</td>
                              <td className="p-3">
                                {hasDebt ? (
                                  <span className="font-bold text-orange-700">{currency} {debt.toFixed(2)}</span>
                                ) : (
                                  <span className="text-xs text-gray-400">{currency} 0.00</span>
                                )}
                              </td>
                              <td className="p-3 text-xs text-gray-500">
                                {new Date(p.created_at).toLocaleDateString()}
                              </td>
                              <td className="p-3 text-center">
                                {hasDebt ? (
                                  <button
                                    onClick={() => openPaySupplierModal(p)}
                                    className="bg-orange-600 hover:bg-orange-700 text-white px-2.5 py-1 rounded text-xs font-semibold transition"
                                  >
                                    Pagar / Abonar
                                  </button>
                                ) : (
                                  <span className="text-xs text-green-700 font-medium">Liquidado</span>
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
            )}
          </div>
        </div>
      </div>

      {/* Modal para Pagar / Abonar Compra a Crédito a Proveedor */}
      {paySupplierModalOpen && targetCreditPurchase && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Pagar / Abonar Compra a Crédito</h3>
            <p className="text-xs text-gray-500 mb-4">
              Proveedor: <span className="font-semibold text-gray-800">{cleanSupplierName(targetCreditPurchase.supplier)}</span> — {targetCreditPurchase.item_name}
            </p>

            <div className="grid grid-cols-3 gap-2 bg-gray-50 p-3 rounded-lg border border-gray-200 text-center mb-4">
              <div>
                <span className="block text-[10px] uppercase text-gray-500 font-semibold">Total Compra</span>
                <span className="text-sm font-bold text-gray-800">{currency} {Number(targetCreditPurchase.total_cost).toFixed(2)}</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase text-gray-500 font-semibold">Ya Pagado</span>
                <span className="text-sm font-bold text-red-600">{currency} {getPurchasePaidAmount(targetCreditPurchase).toFixed(2)}</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase text-gray-500 font-semibold">Deuda Actual</span>
                <span className="text-sm font-bold text-orange-700">{currency} {getPurchasePendingDebt(targetCreditPurchase).toFixed(2)}</span>
              </div>
            </div>

            <form onSubmit={handleConfirmSupplierPayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monto a pagar ahora ({currency}) — Se descontará del capital
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={getPurchasePendingDebt(targetCreditPurchase)}
                  value={supplierInstallmentAmount}
                  onChange={e => setSupplierInstallmentAmount(e.target.value)}
                  required
                  className="w-full border border-gray-300 p-2 rounded text-sm font-bold text-orange-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setPaySupplierModalOpen(false)
                    setTargetCreditPurchase(null)
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded text-sm hover:bg-gray-300 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingSupplierPayment}
                  className="px-4 py-2 bg-orange-600 text-white rounded text-sm hover:bg-orange-700 font-semibold"
                >
                  {savingSupplierPayment ? 'Registrando...' : 'Confirmar Pago al Proveedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Edición de Equipo */}
      {editModalOpen && editingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Editar Equipo / Componente</h3>
            <p className="text-xs text-gray-500 mb-4">
              Modifica los datos o estado de <span className="font-semibold text-gray-800">{editingItem.name}</span>.
            </p>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción del Equipo / Pieza</label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  required
                  className="w-full border border-gray-300 p-2 rounded text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                  <select
                    value={editCategory}
                    onChange={e => setEditCategory(e.target.value)}
                    className="w-full border border-gray-300 p-2 rounded text-sm bg-white"
                  >
                    <option value="Laptops">Laptops</option>
                    <option value="PCs de Escritorio">PCs de Escritorio</option>
                    <option value="Monitores">Monitores</option>
                    <option value="Componentes">Componentes (RAM, SSD, Discos)</option>
                    <option value="Periféricos">Periféricos y Accesorios</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estado / Condición</label>
                  <select
                    value={editCondition}
                    onChange={e => setEditCondition(e.target.value)}
                    className="w-full border border-gray-300 p-2 rounded text-sm bg-white"
                  >
                    <option value="Reacondicionado - Grado A">Reacondicionado - Grado A</option>
                    <option value="Usado - Buen estado">Usado - Buen estado</option>
                    <option value="En taller / Para reparación">En taller / Para reparación</option>
                    <option value="Para repuestos">Para repuestos</option>
                  </select>
                </div>
              </div>

              <div className={`grid ${isAdmin ? 'grid-cols-3' : 'grid-cols-1'} gap-3`}>
                {isAdmin && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Costo ({currency})</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editCost}
                        onChange={e => setEditCost(e.target.value)}
                        required
                        className="w-full border border-gray-300 p-2 rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Venta ({currency})</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editPrice}
                        onChange={e => setEditPrice(e.target.value)}
                        required
                        className="w-full border border-gray-300 p-2 rounded text-sm font-semibold text-green-700"
                      />
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Stock</label>
                  <input
                    type="number"
                    min="0"
                    value={editStock}
                    onChange={e => setEditStock(e.target.value)}
                    required
                    className="w-full border border-gray-300 p-2 rounded text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setEditModalOpen(false)
                    setEditingItem(null)
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded text-sm hover:bg-gray-300 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={updatingItem}
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 font-semibold"
                >
                  {updatingItem ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Mejora / Ensamblaje de Equipo */}
      {upgradeModalOpen && baseEquipment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Mejorar / Repotenciar Equipo</h3>
            <p className="text-xs text-gray-500 mb-4">
              Instala un componente de tu inventario en <span className="font-semibold text-gray-800">{baseEquipment.name}</span>. Se descontará automáticamente del stock disponible.
            </p>

            <form onSubmit={handleApplyUpgrade} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Componente a Instalar (Stock disponible)</label>
                <select
                  value={selectedComponentId}
                  onChange={e => handleSelectComponent(e.target.value)}
                  required
                  className="w-full border border-gray-300 p-2 rounded text-sm bg-white"
                >
                  <option value="">-- Seleccionar pieza / componente --</option>
                  {availableComponents.map(comp => (
                    <option key={comp.id} value={comp.id}>
                      [{comp.category}] {comp.name} (Stock: {comp.stock}{isAdmin ? ` | Costo: ${currency} ${comp.cost}` : ''})
                    </option>
                  ))}
                </select>
              </div>

              {selectedComponent && (
                <>
                  <div className={`grid ${isAdmin ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad a instalar</label>
                      <input
                        type="number"
                        min="1"
                        max={selectedComponent.stock}
                        value={componentQty}
                        onChange={e => handleComponentQtyChange(Number(e.target.value))}
                        required
                        className="w-full border border-gray-300 p-2 rounded text-sm"
                      />
                    </div>
                    {isAdmin && (
                      <div className="bg-gray-50 p-2 rounded border border-gray-200 flex flex-col justify-center">
                        <span className="text-[11px] text-gray-500 uppercase font-semibold">Nuevo Costo Total</span>
                        <span className="text-base font-bold text-gray-900">
                          {currency} {calculatedNewCost.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nueva Descripción del Equipo</label>
                    <input
                      type="text"
                      value={newEquipmentName}
                      onChange={e => setNewEquipmentName(e.target.value)}
                      required
                      className="w-full border border-gray-300 p-2 rounded text-sm"
                    />
                  </div>

                  {isAdmin && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nuevo Precio de Venta ({currency})</label>
                      <input
                        type="number"
                        step="0.01"
                        value={newSalePrice}
                        onChange={e => setNewSalePrice(e.target.value)}
                        required
                        className="w-full border border-gray-300 p-2 rounded text-sm font-semibold text-green-700"
                      />
                    </div>
                  )}
                </>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setUpgradeModalOpen(false)
                    setBaseEquipment(null)
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded text-sm hover:bg-gray-300 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={upgrading || !selectedComponentId}
                  className="px-4 py-2 bg-amber-500 text-white rounded text-sm hover:bg-amber-600 font-semibold disabled:opacity-50"
                >
                  {upgrading ? 'Aplicando mejora...' : 'Confirmar Mejora'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
