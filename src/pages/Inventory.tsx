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
}

export default function Inventory() {
  const navigate = useNavigate()
  const [items, setItems] = useState<Equipment[]>([])
  const [currency, setCurrency] = useState('Bs.')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Formulario nuevo equipo
  const [name, setName] = useState('')
  const [category, setCategory] = useState('Laptops')
  const [condition, setCondition] = useState('Reacondicionado - Grado A')
  const [cost, setCost] = useState('')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('1')

  // Filtros y búsqueda
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
    fetchInventory()
  }, [])

  const fetchInventory = async () => {
    setLoading(true)
    const [invRes, settingsRes] = await Promise.all([
      supabase.from('inventory').select('*').order('created_at', { ascending: false }),
      supabase.from('company_settings').select('currency').eq('id', 1).single()
    ])

    if (!invRes.error && invRes.data) {
      setItems(invRes.data)
    }
    if (settingsRes.data?.currency) {
      setCurrency(settingsRes.data.currency)
    }
    setLoading(false)
  }

  const handleAddEquipment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !cost || !price) return
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase.from('inventory').insert([
      {
        name,
        category,
        condition,
        cost: Number(cost),
        price: Number(price),
        stock: Number(stock) || 1,
        created_by: user?.id
      }
    ])

    if (!error) {
      setName('')
      setCost('')
      setPrice('')
      setStock('1')
      fetchInventory()
    } else {
      alert('Error al guardar equipo: ' + error.message)
    }
    setSaving(false)
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

  // Abrir modal de edición
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

  // Guardar cambios de edición
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingItem || !editName.trim()) return

    setUpdatingItem(true)
    const updatedFields = {
      name: editName.trim(),
      category: editCategory,
      condition: editCondition,
      cost: Number(editCost) || 0,
      price: Number(editPrice) || 0,
      stock: Math.max(0, Number(editStock) || 0)
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

  // Eliminar equipo del inventario
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

  // Abrir modal de mejora para un equipo específico
  const openUpgradeModal = (equipment: Equipment) => {
    setBaseEquipment(equipment)
    setSelectedComponentId('')
    setComponentQty(1)
    setNewEquipmentName(equipment.name)
    setNewSalePrice(equipment.price.toString())
    setUpgradeModalOpen(true)
  }

  // Al elegir componente, sugerir actualización de nombre y precio
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

  // Ejecutar la mejora (ensamblaje)
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
    const finalPrice = Number(newSalePrice) || Number(baseEquipment.price)

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
      await fetchInventory()
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
            <h1 className="text-2xl font-bold text-gray-800">Módulo de Inventario y Taller</h1>
            <p className="text-sm text-gray-500">Gestión en tiempo real de equipos informáticos, repuestos y mejoras (upgrades)</p>
          </div>
          <div className="flex flex-wrap gap-2">
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
            <button onClick={handleLogout} className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700">
              Cerrar Sesión
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulario de Registro */}
          <div className="bg-white p-6 rounded-lg shadow h-fit">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Registrar Equipo o Componente</h2>
            <form onSubmit={handleAddEquipment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción del Equipo / Pieza</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  placeholder="Ej: ThinkPad T480 i5 8GB SSD 256"
                  className="w-full border border-gray-300 p-2 rounded text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
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
                  value={condition}
                  onChange={e => setCondition(e.target.value)}
                  className="w-full border border-gray-300 p-2 rounded text-sm bg-white"
                >
                  <option value="Reacondicionado - Grado A">Reacondicionado - Grado A</option>
                  <option value="Usado - Buen estado">Usado - Buen estado</option>
                  <option value="En taller / Para reparación">En taller / Para reparación</option>
                  <option value="Para repuestos">Para repuestos</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Costo Adquisición ({currency})</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio Venta ({currency})</label>
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
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad en Stock</label>
                <input
                  type="number"
                  min="1"
                  value={stock}
                  onChange={e => setStock(e.target.value)}
                  required
                  className="w-full border border-gray-300 p-2 rounded text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-blue-600 text-white font-semibold py-2 rounded hover:bg-blue-700 transition"
              >
                {saving ? 'Guardando...' : 'Agregar al Inventario'}
              </button>
            </form>
          </div>

          {/* Tabla de Stock con Barra de Filtros y Edición */}
          <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow">
            <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
              <h2 className="text-lg font-bold text-gray-800">
                Stock Actual de Equipos y Repuestos{' '}
                <span className="text-xs font-normal text-gray-500">
                  ({filteredItems.length} de {items.length} registros)
                </span>
              </h2>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-blue-600 hover:underline font-medium"
                >
                  Limpiar filtros
                </button>
              )}
            </div>

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
              <p className="text-gray-500 text-sm">Cargando inventario desde Supabase...</p>
            ) : items.length === 0 ? (
              <p className="text-gray-500 text-sm">No hay equipos registrados aún. Agrega el primero desde el formulario.</p>
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
                      <th className="p-3">Costo</th>
                      <th className="p-3">Venta</th>
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
                        <td className="p-3">{currency} {item.cost}</td>
                        <td className="p-3 font-semibold text-green-700">{currency} {item.price}</td>
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
                              title="Editar equipo, precios o estado"
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
                            <button
                              onClick={() => handleDeleteEquipment(item)}
                              title="Eliminar registro"
                              className="bg-red-100 hover:bg-red-200 text-red-700 text-xs font-semibold px-2 py-1 rounded transition"
                            >
                              ✕
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Edición de Equipo */}
      {editModalOpen && editingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Editar Equipo / Componente</h3>
            <p className="text-xs text-gray-500 mb-4">
              Modifica los datos, precios o estado de <span className="font-semibold text-gray-800">{editingItem.name}</span>.
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

              <div className="grid grid-cols-3 gap-3">
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
              Instala un componente de tu inventario en <span className="font-semibold text-gray-800">{baseEquipment.name}</span>. Se descontará del stock y se sumará al costo real.
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
                      [{comp.category}] {comp.name} (Stock: {comp.stock} | Costo: {currency} {comp.cost})
                    </option>
                  ))}
                </select>
              </div>

              {selectedComponent && (
                <>
                  <div className="grid grid-cols-2 gap-3">
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
                    <div className="bg-gray-50 p-2 rounded border border-gray-200 flex flex-col justify-center">
                      <span className="text-[11px] text-gray-500 uppercase font-semibold">Nuevo Costo Total</span>
                      <span className="text-base font-bold text-gray-900">
                        {currency} {calculatedNewCost.toFixed(2)}
                      </span>
                    </div>
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
