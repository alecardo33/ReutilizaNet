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
      // 1. Descontar las unidades del componente usado
      const { error: compError } = await supabase
        .from('inventory')
        .update({ stock: component.stock - componentQty })
        .eq('id', component.id)

      if (compError) throw compError

      // 2. Si el equipo base tiene 1 sola unidad, lo actualizamos directamente;
      //    si tiene más de 1, descontamos 1 unidad del base y creamos el equipo mejorado.
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

  // Filtrar componentes disponibles para instalar
  const availableComponents = items.filter(
    i => i.stock > 0 && baseEquipment && i.id !== baseEquipment.id
  )

  const selectedComponent = items.find(i => i.id === selectedComponentId)
  const calculatedNewCost = baseEquipment && selectedComponent
    ? Number(baseEquipment.cost) + (Number(selectedComponent.cost) * componentQty)
    : baseEquipment ? Number(baseEquipment.cost) : 0

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
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

          <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Stock Actual de Equipos y Repuestos</h2>
            {loading ? (
              <p className="text-gray-500 text-sm">Cargando inventario desde Supabase...</p>
            ) : items.length === 0 ? (
              <p className="text-gray-500 text-sm">No hay equipos registrados aún. Agrega el primero desde el formulario.</p>
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
                      <th className="p-3 text-center">Taller</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-sm text-gray-700">
                    {items.map(item => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="p-3 font-medium">{item.name}</td>
                        <td className="p-3">{item.category}</td>
                        <td className="p-3">{item.condition}</td>
                        <td className="p-3">{currency} {item.cost}</td>
                        <td className="p-3 font-semibold text-green-700">{currency} {item.price}</td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleUpdateStock(item.id, item.stock, -1)}
                              className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-2 py-0.5 rounded font-bold"
                            >
                              -
                            </button>
                            <span className={`font-bold ${item.stock === 0 ? 'text-red-600' : ''}`}>
                              {item.stock}
                            </span>
                            <button
                              onClick={() => handleUpdateStock(item.id, item.stock, 1)}
                              className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-2 py-0.5 rounded font-bold"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          {(item.category === 'Laptops' || item.category === 'PCs de Escritorio') && item.stock > 0 ? (
                            <button
                              onClick={() => openUpgradeModal(item)}
                              title="Instalar RAM, SSD o componente del stock"
                              className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-2.5 py-1 rounded transition"
                            >
                              + Mejorar
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
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
