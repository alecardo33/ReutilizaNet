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
  const [totalExpenses, setTotalExpenses] = useState(0)
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
  const [categories, setCategories] = useState<string[]>([
    'Laptops',
    'PCs de Escritorio',
    'Tablets',
    'Monitores',
    'Componentes',
    'Periféricos'
  ])
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
  const [unitsToUpgrade, setUnitsToUpgrade] = useState(1)
  const [newEquipmentName, setNewEquipmentName] = useState('')
  const [newSalePrice, setNewSalePrice] = useState('')
  const [upgrading, setUpgrading] = useState(false)

  // Modal de Eliminación con Detección Automática y Selección Múltiple
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<Equipment | null>(null)
  const [returnSelections, setReturnSelections] = useState<{ [id: string]: { selected: boolean; quantity: number } }>({})
  const [deletingWithRestock, setDeletingWithRestock] = useState(false)

  // Modal de Deshacer Mejora (Undo Upgrade)
  const [undoModalOpen, setUndoModalOpen] = useState(false)
  const [itemToUndo, setItemToUndo] = useState<Equipment | null>(null)
  const [undoUnits, setUndoUnits] = useState(1)
  const [returnCompId, setReturnCompId] = useState('')
  const [returnCompQtyPerUnit, setReturnCompQtyPerUnit] = useState(1)
  const [targetBaseId, setTargetBaseId] = useState('')
  const [baseItemNameInput, setBaseItemNameInput] = useState('')
  const [undoing, setUndoing] = useState(false)

  useEffect(() => {
    fetchInventoryAndCapital()
  }, [])

  const isAdmin = userRole === 'admin'
  const canManageCostAndPrice = isAdmin || userRole === 'technician'

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
      const existingCats = Array.from(new Set(invRes.data.map((i: any) => i.category).filter(Boolean)))
      if (existingCats.length > 0) {
        setCategories(prev => Array.from(new Set([...prev, ...existingCats])))
      }
    }
    if (settingsRes.data) {
      if (settingsRes.data.currency) setCurrency(settingsRes.data.currency)
      if (adminCheck) {
        setInitialCapital(Number(settingsRes.data.initial_capital) || 0)
      }
    }

    if (adminCheck) {
      const [purchasesRes, salesRes, expensesRes] = await Promise.all([
        supabase.from('purchases').select('*').order('created_at', { ascending: false }),
        supabase.from('sales').select('total_amount, amount_paid, payment_method'),
        supabase.from('expenses').select('amount')
      ])
      if (!purchasesRes.error && purchasesRes.data) {
        setPurchases(purchasesRes.data)
      }
      if (!salesRes.error && salesRes.data) {
        const collected = salesRes.data.reduce((sum, s) => sum + getSalePaidAmount(s), 0)
        setTotalSalesCollected(collected)
      }
      if (!expensesRes.error && expensesRes.data) {
        const expSum = expensesRes.data.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
        setTotalExpenses(expSum)
      }
    }

    setLoading(false)
  }

  const handleAddCategory = () => {
    const newCat = prompt('Ingrese el nombre de la nueva categoría:')
    if (newCat && newCat.trim()) {
      const formatted = newCat.trim()
      if (!categories.includes(formatted)) {
        setCategories([...categories, formatted])
        setCategory(formatted)
      } else {
        alert('Esa categoría ya existe.')
      }
    }
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
    const unitCostNum = canManageCostAndPrice ? (Number(cost) || 0) : 0
    const unitPriceNum = canManageCostAndPrice ? (Number(price) || 0) : 0
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
        const weightedCost = canManageCostAndPrice && newTotalStock > 0
          ? Number(((prevTotalVal + totalPurchaseCost) / newTotalStock).toFixed(2))
          : Number(existingItem.cost)

        const { error: updErr } = await supabase
          .from('inventory')
          .update({
            stock: newTotalStock,
            cost: weightedCost,
            price: canManageCostAndPrice && unitPriceNum > 0 ? unitPriceNum : existingItem.price
          })
          .eq('id', existingItem.id)

        if (updErr) throw updErr
      }

      // Si es Admin con modalidad de pago distinta de 'none', o si es Técnico y especificó un proveedor/costo
      const shouldRecordPurchase =
        (isAdmin && purchasePaymentType !== 'none' && totalPurchaseCost > 0) ||
        (!isAdmin && canManageCostAndPrice && (supplier.trim() !== '' || totalPurchaseCost > 0))

      if (shouldRecordPurchase) {
        const pendingDebt = isAdmin ? Number((totalPurchaseCost - depositNum).toFixed(2)) : 0
        const paidToRecord = isAdmin ? depositNum : 0
        const baseSupplier = supplier.trim() || 'Proveedor General'
        const encodedSupplier = isCreditPurchase
          ? `${baseSupplier} [Crédito - Pagado: ${depositNum.toFixed(2)} | Saldo: ${pendingDebt.toFixed(2)}]`
          : !isAdmin
          ? `${baseSupplier} [Ingreso Taller]`
          : baseSupplier

        const extendedPayload = {
          item_name: recordedItemName,
          category: recordedCategory,
          supplier: encodedSupplier,
          quantity: qtyNum,
          unit_cost: unitCostNum,
          total_cost: totalPurchaseCost,
          amount_paid: paidToRecord,
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
      alert('Error al registrar ingreso: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const openPaySupplierModal = (purchase: PurchaseRecord) => {
    const debt = getPurchasePendingDebt(purchase)
    setTargetCreditPurchase(purchase)
    setSupplierInstallmentAmount(debt.toFixed(2))
    setPaySupplierModalOpen(true)
  }

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

    if (canManageCostAndPrice) {
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

  const openDeleteModal = (item: Equipment) => {
    setItemToDelete(item)
    const initialSelections: { [id: string]: { selected: boolean; quantity: number } } = {}
    
    const upperName = item.name.toUpperCase()
    items.forEach(i => {
      if (i.id !== item.id) {
        const compNameUpper = i.name.toUpperCase()
        const isMentioned = upperName.includes(compNameUpper) || (upperName.includes('+') && upperName.split(' ').some(word => word.length > 3 && upperName.split('+')[1]?.includes(word)))
        if (isMentioned) {
          initialSelections[i.id] = { selected: true, quantity: item.stock }
        } else {
          initialSelections[i.id] = { selected: false, quantity: 1 }
        }
      }
    })
    setReturnSelections(initialSelections)
    setDeleteModalOpen(true)
  }

  const handleConfirmDelete = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!itemToDelete) return

    setDeletingWithRestock(true)
    try {
      for (const [compId, sel] of Object.entries(returnSelections)) {
        if (sel.selected && sel.quantity > 0) {
          const compItem = items.find(i => i.id === compId)
          if (compItem) {
            const newStock = compItem.stock + Number(sel.quantity)
            const { error: restockErr } = await supabase
              .from('inventory')
              .update({ stock: newStock })
              .eq('id', compItem.id)

            if (restockErr) throw restockErr
          }
        }
      }

      const { error: delErr } = await supabase
        .from('inventory')
        .delete()
        .eq('id', itemToDelete.id)

      if (delErr) throw delErr

      setItems(items.filter(i => i.id !== itemToDelete.id))
      setDeleteModalOpen(false)
      setItemToDelete(null)
    } catch (err: any) {
      alert('Error al eliminar equipo y reingresar componentes: ' + err.message)
    } finally {
      setDeletingWithRestock(false)
    }
  }

  const openUpgradeModal = (equipment: Equipment) => {
    setBaseEquipment(equipment)
    setSelectedComponentId('')
    setComponentQty(1)
    setUnitsToUpgrade(1)
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

    const upgradeCount = Math.max(1, Math.min(baseEquipment.stock, Number(unitsToUpgrade) || 1))
    const totalComponentsNeeded = componentQty * upgradeCount

    if (baseEquipment.stock < upgradeCount) {
      alert('No hay stock suficiente del equipo base para realizar la mejora.')
      return
    }

    if (component.stock < totalComponentsNeeded) {
      alert(`Stock insuficiente del componente. Se requieren ${totalComponentsNeeded} unidades pero solo hay ${component.stock} disponibles.`)
      return
    }

    setUpgrading(true)
    const { data: { user } } = await supabase.auth.getUser()

    const addedCostPerUnit = Number(component.cost) * componentQty
    const finalCost = Number(baseEquipment.cost) + addedCostPerUnit
    const finalPrice = canManageCostAndPrice
      ? (Number(newSalePrice) || Number(baseEquipment.price))
      : (Number(baseEquipment.price) + (Number(component.price) * componentQty))

    try {
      const { error: compError } = await supabase
        .from('inventory')
        .update({ stock: component.stock - totalComponentsNeeded })
        .eq('id', component.id)

      if (compError) throw compError

      if (upgradeCount === baseEquipment.stock) {
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
          .update({ stock: baseEquipment.stock - upgradeCount })
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
              stock: upgradeCount,
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

  const openUndoModal = (item: Equipment) => {
    setItemToUndo(item)
    setUndoUnits(1)
    setReturnCompId('')
    setReturnCompQtyPerUnit(1)
    setTargetBaseId('')
    const baseGuess = item.name.split('+')[0].trim()
    setBaseItemNameInput(baseGuess)
    setUndoModalOpen(true)
  }

  const handleConfirmUndoUpgrade = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!itemToUndo) return

    const unitsCount = Math.max(1, Math.min(itemToUndo.stock, Number(undoUnits) || 1))
    setUndoing(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (returnCompId) {
        const compItem = items.find(i => i.id === returnCompId)
        if (compItem) {
          const totalCompReturn = Number(returnCompQtyPerUnit || 1) * unitsCount
          const newCompStock = compItem.stock + totalCompReturn
          const { error: compUpdErr } = await supabase
            .from('inventory')
            .update({ stock: newCompStock })
            .eq('id', compItem.id)
          if (compUpdErr) throw compUpdErr
        }
      }

      const newUpgradedStock = itemToUndo.stock - unitsCount
      if (newUpgradedStock > 0) {
        const { error: updErr } = await supabase
          .from('inventory')
          .update({ stock: newUpgradedStock })
          .eq('id', itemToUndo.id)
        if (updErr) throw updErr
      } else {
        const { error: delErr } = await supabase
          .from('inventory')
          .delete()
          .eq('id', itemToUndo.id)
        if (delErr) throw delErr
      }

      if (targetBaseId) {
        const baseIt = items.find(i => i.id === targetBaseId)
        if (baseIt) {
          const newBaseStock = baseIt.stock + unitsCount
          const { error: baseUpdErr } = await supabase
            .from('inventory')
            .update({ stock: newBaseStock })
            .eq('id', baseIt.id)
          if (baseUpdErr) throw baseUpdErr
        }
      } else {
        const baseName = baseItemNameInput.trim() || itemToUndo.name.split('+')[0].trim() || 'Equipo Base'
        const estimatedBaseCost = Math.max(0, Number(itemToUndo.cost) * 0.8)
        const estimatedBasePrice = Math.max(0, Number(itemToUndo.price) * 0.8)

        const { error: insBaseErr } = await supabase
          .from('inventory')
          .insert([
            {
              name: baseName,
              category: itemToUndo.category,
              condition: itemToUndo.condition,
              cost: estimatedBaseCost,
              price: estimatedBasePrice,
              stock: unitsCount,
              created_by: user?.id
            }
          ])
        if (insBaseErr) throw insBaseErr
      }

      setUndoModalOpen(false)
      setItemToUndo(null)
      await fetchInventoryAndCapital()
    } catch (err: any) {
      alert('Error al deshacer mejora: ' + err.message)
    } finally {
      setUndoing(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const totalPurchasesPaidFromCapital = purchases.reduce((sum, p) => sum + getPurchasePaidAmount(p), 0)
  const totalSupplierDebt = purchases.reduce((sum, p) => sum + getPurchasePendingDebt(p), 0)
  const pendingPurchasesCount = purchases.filter(p => getPurchasePendingDebt(p) > 0.009).length

  const remainingInitialCapital = initialCapital - totalPurchasesPaidFromCapital
  const availableLiquidFund = initialCapital - totalPurchasesPaidFromCapital + totalSalesCollected - totalExpenses
  const formTotalPurchase = (Number(cost) || 0) * (Math.max(1, Number(stock) || 1))

  const displayedPurchases = purchaseFilter === 'pending'
    ? purchases.filter(p => getPurchasePendingDebt(p) > 0.009)
    : purchases

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
                ? 'Compras al contado o a crédito, control de stock y repotenciación'
                : 'Control de existencias, proveedores, estado físico, ensamblaje y precios unitarios'}
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
              <p className="text-[11px] text-gray-400 mt-0.5">
                Capital - compras - gastos ({currency} {totalExpenses.toFixed(2)}) + ventas
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-xs font-semibold text-gray-700">Categoría</label>
                        <button
                          type="button"
                          onClick={handleAddCategory}
                          title="Crear nueva categoría"
                          className="text-[10px] text-blue-600 hover:text-blue-800 font-bold bg-blue-50 hover:bg-blue-100 px-1.5 py-0.5 rounded transition"
                        >
                          + Nueva
                        </button>
                      </div>
                      <select
                        value={category}
                        onChange={e => setCategory(e.target.value)}
                        className="w-full border border-gray-300 p-2 rounded text-xs bg-white"
                      >
                        {categories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
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

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Proveedor / Acreedor {isAdmin && purchasePaymentType === 'credit' ? <span className="text-red-600">* (Obligatorio)</span> : '(Opcional)'}
                </label>
                <input
                  type="text"
                  value={supplier}
                  onChange={e => setSupplier(e.target.value)}
                  required={isAdmin && purchasePaymentType === 'credit'}
                  placeholder="Ej: Importadora Tech / Distribuidor"
                  className="w-full border border-gray-300 p-2 rounded text-sm"
                />
              </div>

              <div className={`grid ${canManageCostAndPrice ? 'grid-cols-3' : 'grid-cols-1'} gap-2`}>
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
                {canManageCostAndPrice && (
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
                          placeholder="0.00"
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
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
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
                          {canManageCostAndPrice && <th className="p-3">Costo</th>}
                          {canManageCostAndPrice && <th className="p-3">Venta</th>}
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
                            {canManageCostAndPrice && <td className="p-3">{currency} {item.cost}</td>}
                            {canManageCostAndPrice && <td className="p-3 font-semibold text-green-700">{currency} {item.price}</td>}
                            <td className="p-3">
                              {isAdmin ? (
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
                              ) : (
                                <div className="text-center">
                                  <span className={`font-bold px-2.5 py-0.5 rounded-full text-xs ${item.stock === 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-800'}`}>
                                    {item.stock}
                                  </span>
                                </div>
                              )}
                            </td>
                            <td className="p-3">
                              <div className="flex items-center justify-center gap-1.5">
                                {canManageCostAndPrice && (
                                  <button
                                    onClick={() => openEditModal(item)}
                                    title="Editar equipo, costo, precio o estado"
                                    className="bg-blue-100 hover:bg-blue-200 text-blue-800 text-xs font-semibold px-2 py-1 rounded transition"
                                  >
                                    Editar
                                  </button>
                                )}
                                {(item.category === 'Laptops' || item.category === 'PCs de Escritorio' || item.category === 'Tablets') && item.stock > 0 && (
                                  <button
                                    onClick={() => openUpgradeModal(item)}
                                    title="Instalar RAM, SSD o componente del stock"
                                    className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-2 py-1 rounded transition"
                                  >
                                    + Mejorar
                                  </button>
                                )}
                                {item.name.includes('+') && item.stock > 0 && (
                                  <button
                                    onClick={() => openUndoModal(item)}
                                    title="Deshacer mejora / desarmar equipo y devolver componente"
                                    className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold px-2 py-1 rounded transition"
                                  >
                                    Deshacer
                                  </button>
                                )}
                                {isAdmin && (
                                  <button
                                    onClick={() => openDeleteModal(item)}
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

      {paySupplierModalOpen && targetCreditPurchase && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Pagar / Abonar Compra a Crédito</h3>
            <p className="text-xs text-gray-500 mb-4">
              Proveedor: <span className="font-semibold text-gray-800">{cleanSupplierName(targetCreditPurchase.supplier)}</span> — {targetCreditPurchase.item_name}
            </p>

            <form onSubmit={handleConfirmSupplierPayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monto a pagar ahora ({currency})
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
                  {savingSupplierPayment ? 'Registrando...' : 'Confirmar Pago'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editModalOpen && editingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Editar Equipo / Componente</h3>
            <p className="text-xs text-gray-500 mb-4">
              Modifica los datos, costo, precio o estado de <span className="font-semibold text-gray-800">{editingItem.name}</span>.
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
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
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

              <div className={`grid ${canManageCostAndPrice ? 'grid-cols-3' : 'grid-cols-1'} gap-3`}>
                {canManageCostAndPrice && (
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

      {/* Modal de Eliminación con Detección Automática y Selección Múltiple */}
      {deleteModalOpen && itemToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Eliminar Equipo del Inventario</h3>
            <p className="text-xs text-gray-500 mb-4">
              Vas a eliminar <span className="font-semibold text-gray-800">{itemToDelete.name}</span>. Se han identificado automáticamente los componentes asociados sugeridos para reingresar al stock:
            </p>

            <form onSubmit={handleConfirmDelete} className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg max-h-60 overflow-y-auto space-y-2.5">
                <label className="block text-xs font-bold text-amber-900 uppercase">
                  Selecciona los ítems a devolver al stock:
                </label>
                {items.filter(i => i.id !== itemToDelete.id).length === 0 ? (
                  <p className="text-xs text-gray-500">No hay otros ítems en el inventario.</p>
                ) : (
                  items.filter(i => i.id !== itemToDelete.id).map(it => {
                    const sel = returnSelections[it.id] || { selected: false, quantity: 1 }
                    return (
                      <div key={it.id} className="bg-white border border-amber-200 p-2.5 rounded flex items-center justify-between gap-2 shadow-sm">
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="checkbox"
                            checked={sel.selected}
                            onChange={e => {
                              setReturnSelections({
                                ...returnSelections,
                                [it.id]: { ...sel, selected: e.target.checked }
                              })
                            }}
                            className="rounded border-gray-300 text-amber-600 focus:ring-amber-500 w-4 h-4"
                          />
                          <div className="text-xs">
                            <span className="font-bold text-gray-900">{it.name}</span>
                            <span className="block text-[10px] text-gray-500">[{it.category}] - Stock actual: {it.stock}</span>
                          </div>
                        </div>
                        {sel.selected && (
                          <div className="w-20">
                            <label className="block text-[10px] font-semibold text-gray-600 mb-0.5">Cantidad</label>
                            <input
                              type="number"
                              min="1"
                              value={sel.quantity}
                              onChange={e => {
                                setReturnSelections({
                                  ...returnSelections,
                                  [it.id]: { ...sel, quantity: Math.max(1, Number(e.target.value) || 1) }
                                })
                              }}
                              className="w-full border border-amber-300 p-1 rounded text-xs font-bold text-center bg-amber-50"
                              required
                            />
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteModalOpen(false)
                    setItemToDelete(null)
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded text-sm hover:bg-gray-300 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={deletingWithRestock}
                  className="px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700 font-semibold"
                >
                  {deletingWithRestock ? 'Eliminando...' : 'Confirmar Eliminación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Deshacer Mejora */}
      {undoModalOpen && itemToUndo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Deshacer Mejora / Revertir Ensamblaje</h3>
            <p className="text-xs text-gray-500 mb-4">
              Estás deshaciendo mejoras en <span className="font-semibold text-gray-800">{itemToUndo.name}</span> (Stock actual: {itemToUndo.stock}).
            </p>

            <form onSubmit={handleConfirmUndoUpgrade} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Unidades a deshacer / desarmar
                </label>
                <input
                  type="number"
                  min="1"
                  max={itemToUndo.stock}
                  value={undoUnits}
                  onChange={e => setUndoUnits(Math.max(1, Math.min(itemToUndo.stock, Number(e.target.value) || 1)))}
                  required
                  className="w-full border border-gray-300 p-2 rounded text-sm font-bold text-purple-900 bg-purple-50"
                />
              </div>

              <div className="bg-gray-50 border border-gray-200 p-3 rounded-lg space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1">
                    Componente a devolver al inventario (Opcional)
                  </label>
                  <select
                    value={returnCompId}
                    onChange={e => setReturnCompId(e.target.value)}
                    className="w-full border border-gray-300 p-2 rounded text-xs bg-white font-medium"
                  >
                    <option value="">-- No devolver componente --</option>
                    {items.map(it => (
                      <option key={it.id} value={it.id}>
                        [{it.category}] {it.name} (Stock: {it.stock})
                      </option>
                    ))}
                  </select>
                </div>

                {returnCompId && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Cantidad de unidades de componente por equipo desarmado
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={returnCompQtyPerUnit}
                      onChange={e => setReturnCompQtyPerUnit(Math.max(1, Number(e.target.value) || 1))}
                      required
                      className="w-full border border-gray-300 p-2 rounded text-xs bg-white font-bold"
                    />
                  </div>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg space-y-3">
                <div>
                  <label className="block text-xs font-bold text-blue-900 mb-1">
                    Restaurar stock al equipo base (Opcional)
                  </label>
                  <select
                    value={targetBaseId}
                    onChange={e => setTargetBaseId(e.target.value)}
                    className="w-full border border-blue-300 p-2 rounded text-xs bg-white font-medium"
                  >
                    <option value="">-- Crear / Restaurar como nuevo ítem base --</option>
                    {items.filter(i => i.id !== itemToUndo.id).map(it => (
                      <option key={it.id} value={it.id}>
                        [{it.category}] {it.name} (Stock: {it.stock})
                      </option>
                    ))}
                  </select>
                </div>

                {!targetBaseId && (
                  <div>
                    <label className="block text-xs font-semibold text-blue-900 mb-1">
                      Nombre del equipo base restaurado
                    </label>
                    <input
                      type="text"
                      value={baseItemNameInput}
                      onChange={e => setBaseItemNameInput(e.target.value)}
                      required
                      placeholder="Ej: ThinkPad T480"
                      className="w-full border border-blue-300 p-2 rounded text-xs bg-white font-bold"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setUndoModalOpen(false)
                    setItemToUndo(null)
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded text-sm hover:bg-gray-300 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={undoing}
                  className="px-4 py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 font-semibold"
                >
                  {undoing ? 'Procesando...' : 'Confirmar Deshacer Mejora'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {upgradeModalOpen && baseEquipment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Mejorar / Repotenciar Equipo</h3>
            <p className="text-xs text-gray-500 mb-4">
              Instala un componente en <span className="font-semibold text-gray-800">{baseEquipment.name}</span>. Se descontará del stock disponible.
            </p>

            <form onSubmit={handleApplyUpgrade} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Componente a Instalar</label>
                <select
                  value={selectedComponentId}
                  onChange={e => handleSelectComponent(e.target.value)}
                  required
                  className="w-full border border-gray-300 p-2 rounded text-sm bg-white"
                >
                  <option value="">-- Seleccionar pieza / componente --</option>
                  {availableComponents.map(comp => (
                    <option key={comp.id} value={comp.id}>
                      [{comp.category}] {comp.name} (Stock: {comp.stock}{canManageCostAndPrice ? ` | Costo: ${currency} ${comp.cost}` : ''})
                    </option>
                  ))}
                </select>
              </div>

              {selectedComponent && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Unidades a mejorar (Stock disponible: {baseEquipment.stock})
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={baseEquipment.stock}
                      value={unitsToUpgrade}
                      onChange={e => setUnitsToUpgrade(Math.max(1, Math.min(baseEquipment.stock, Number(e.target.value) || 1)))}
                      required
                      className="w-full border border-gray-300 p-2 rounded text-sm font-bold text-blue-800"
                    />
                  </div>

                  <div className={`grid ${canManageCostAndPrice ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
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
                    {canManageCostAndPrice && (
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

                  {canManageCostAndPrice && (
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
