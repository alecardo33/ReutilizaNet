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

interface AssembledProduct {
  id: string
  base_item_id: string
  name: string
  category: string
  components: { component_id: string; name: string; qty: number; cost: number; price: number }[]
  total_cost: number
  sale_price: number
  stock: number
  created_at?: string
}

export default function Store() {
  const navigate = useNavigate()
  const [userRole, setUserRole] = useState<string>('')
  const [currency, setCurrency] = useState('Bs.')
  const [inventoryItems, setInventoryItems] = useState<Equipment[]>([])
  const [storeProducts, setStoreProducts] = useState<AssembledProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Formulario / Modal para Ensamblar Nuevo Equipo en Tienda
  const [assembleModalOpen, setAssembleModalOpen] = useState(false)
  const [selectedBaseId, setSelectedBaseId] = useState('')
  const [assembledName, setAssembledName] = useState('')
  const [assembledCategory, setAssembledCategory] = useState('PCs de Escritorio')
  const [selectedComponents, setSelectedComponents] = useState<{ component_id: string; qty: number }[]>([])
  const [customSalePrice, setCustomSalePrice] = useState('')
  const [quantityToBuild, setQuantityToBuild] = useState(1)

  useEffect(() => {
    fetchData()
  }, [])

  const isAdmin = userRole === 'admin'

  const fetchData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role) setUserRole(profile.role)
    }

    const [invRes, storeRes, settingsRes] = await Promise.all([
      supabase.from('inventory').select('*').order('name'),
      supabase.from('store_products').select('*').gt('stock', 0).order('created_at', { ascending: false }),
      supabase.from('company_settings').select('currency').eq('id', 1).single()
    ])

    if (!invRes.error && invRes.data) setInventoryItems(invRes.data)
    if (!storeRes.error && storeRes.data) setStoreProducts(storeRes.data)
    if (settingsRes.data?.currency) setCurrency(settingsRes.data.currency)

    setLoading(false)
  }

  const baseItem = inventoryItems.find(i => i.id === selectedBaseId)

  const calculatedCost = baseItem ? Number(baseItem.cost) : 0
  const calculatedSuggestedPrice = baseItem ? Number(baseItem.price) : 0

  const handleAddComponentRow = () => {
    setSelectedComponents([...selectedComponents, { component_id: '', qty: 1 }])
  }

  const handleRemoveComponentRow = (index: number) => {
    setSelectedComponents(selectedComponents.filter((_, i) => i !== index))
  }

  const handleComponentChange = (index: number, field: 'component_id' | 'qty', val: any) => {
    const updated = [...selectedComponents]
    updated[index] = { ...updated[index], [field]: val }
    setSelectedComponents(updated)
  }

  const handleSelectBase = (id: string) => {
    setSelectedBaseId(id)
    const found = inventoryItems.find(i => i.id === id)
    if (found) {
      setAssembledName(found.name)
      setAssembledCategory(found.category)
      setCustomSalePrice(found.price.toString())
    }
  }

  const computeTotals = () => {
    let totalCost = baseItem ? Number(baseItem.cost) * quantityToBuild : 0
    const componentsDetail: any[] = []

    selectedComponents.forEach(sc => {
      if (sc.component_id) {
        const comp = inventoryItems.find(i => i.id === sc.component_id)
        if (comp) {
          const totalQtyNeeded = sc.qty * quantityToBuild
          totalCost += Number(comp.cost) * totalQtyNeeded
          componentsDetail.push({
            component_id: comp.id,
            name: comp.name,
            qty: sc.qty,
            cost: Number(comp.cost),
            price: Number(comp.price)
          })
        }
      }
    })

    return { totalCost, componentsDetail }
  }

  const handleSaveAssembledProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!baseItem || !assembledName.trim()) {
      alert('Selecciona un equipo base y asigna un nombre.')
      return
    }

    const qty = Math.max(1, Number(quantityToBuild) || 1)
    if (baseItem.stock < qty) {
      alert(`Stock insuficiente del equipo base (${baseItem.name}). Solo hay ${baseItem.stock} unidades.`)
      return
    }

    const { totalCost, componentsDetail } = computeTotals()
    for (const sc of selectedComponents) {
      if (sc.component_id) {
        const comp = inventoryItems.find(i => i.id === sc.component_id)
        const needed = sc.qty * qty
        if (comp && comp.stock < needed) {
          alert(`Stock insuficiente del componente "${comp.name}". Se requieren ${needed} unidades pero solo hay ${comp.stock}.`)
          return
        }
      }
    }

    setSaving(true)
    try {
      const { error: baseUpdErr } = await supabase
        .from('inventory')
        .update({ stock: baseItem.stock - qty })
        .eq('id', baseItem.id)
      if (baseUpdErr) throw baseUpdErr

      for (const cd of componentsDetail) {
        const comp = inventoryItems.find(i => i.id === cd.component_id)
        if (comp) {
          const needed = cd.qty * qty
          const { error: compUpdErr } = await supabase
            .from('inventory')
            .update({ stock: comp.stock - needed })
            .eq('id', cd.component_id)
          if (compUpdErr) throw compUpdErr
        }
      }

      const finalSalePrice = Number(customSalePrice) || calculatedSuggestedPrice

      const { error: storeInsErr } = await supabase
        .from('store_products')
        .insert([
          {
            base_item_id: baseItem.id,
            name: assembledName.trim(),
            category: assembledCategory,
            components: componentsDetail,
            total_cost: Number((totalCost / qty).toFixed(2)),
            sale_price: finalSalePrice,
            stock: qty
          }
        ])

      if (storeInsErr) throw storeInsErr

      setAssembleModalOpen(false)
      setSelectedBaseId('')
      setAssembledName('')
      setSelectedComponents([])
      setQuantityToBuild(1)
      await fetchData()
      alert('¡Equipo ensamblado y publicado en Tienda con éxito!')
    } catch (err: any) {
      alert('Error al guardar producto en tienda: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSellProduct = (product: AssembledProduct) => {
    navigate('/cashbox', { state: { productToSell: product } })
  }

  const availableBaseItems = inventoryItems.filter(i => i.stock > 0 && i.category !== 'Componentes' && i.category !== 'Periféricos')
  const availableComponentItems = inventoryItems.filter(i => i.stock > 0)

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-lg shadow mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Módulo de Tienda y Ensamblaje</h1>
            <p className="text-sm text-gray-500">Arma equipos completos combinando base y componentes sin duplicar inventario bruto</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigate('/')} className="bg-gray-600 text-white px-4 py-2 rounded text-sm hover:bg-gray-700">
              Inicio
            </button>
            <button onClick={() => navigate('/inventory')} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
              Inventario Principal
            </button>
            <button onClick={() => navigate('/cashbox')} className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700">
              Ir a Caja / Venta
            </button>
          </div>
        </div>

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">Equipos Listos para Venta en Tienda ({storeProducts.length})</h2>
          <button
            onClick={() => setAssembleModalOpen(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-4 py-2 rounded-lg text-sm shadow transition flex items-center gap-2"
          >
            + Ensamblar Nuevo Equipo para Tienda
          </button>
        </div>

        {loading ? (
          <p className="text-gray-500">Cargando productos de tienda...</p>
        ) : storeProducts.length === 0 ? (
          <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
            <p className="text-lg font-medium mb-2">No hay equipos ensamblados en tienda aún.</p>
            <p className="text-xs text-gray-400">Haz clic en "+ Ensamblar Nuevo Equipo para Tienda" para configurar tu primera PC o laptop con componentes adicionales.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {storeProducts.map(prod => (
              <div key={prod.id} className="bg-white rounded-lg shadow p-5 border border-gray-200 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold px-2 py-0.5 bg-blue-100 text-blue-800 rounded">{prod.category}</span>
                    <span className="text-xs font-bold text-gray-500">Stock: {prod.stock}</span>
                  </div>
                  <h3 className="text-base font-bold text-gray-900 mb-1">{prod.name}</h3>
                  
                  {prod.components && prod.components.length > 0 && (
                    <div className="bg-gray-50 p-2.5 rounded text-xs text-gray-600 my-3 space-y-1">
                      <span className="font-semibold text-gray-700 block mb-1">Componentes Instalados:</span>
                      {prod.components.map((c, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span>• {c.qty}x {c.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-gray-100 mt-4 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase text-gray-400 block font-semibold">Precio Venta</span>
                    <span className="text-lg font-bold text-green-700">{currency} {Number(prod.sale_price).toFixed(2)}</span>
                  </div>
                  <button
                    onClick={() => handleSellProduct(prod)}
                    className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-3 py-2 rounded shadow transition"
                  >
                    Vender Equipo
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {assembleModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 border border-gray-200 my-8">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Ensamblar Equipo para Tienda</h3>
            <p className="text-xs text-gray-500 mb-4">Selecciona un equipo base del inventario y agrégale componentes adicionales. Los stocks se descontarán automáticamente.</p>

            <form onSubmit={handleSaveAssembledProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Equipo Base (Desde Inventario)</label>
                <select
                  value={selectedBaseId}
                  onChange={e => handleSelectBase(e.target.value)}
                  required
                  className="w-full border border-gray-300 p-2 rounded text-sm bg-white"
                >
                  <option value="">-- Seleccionar equipo base --</option>
                  {availableBaseItems.map(item => (
                    <option key={item.id} value={item.id}>
                      [{item.category}] {item.name} (Stock: {item.stock} | Costo: {currency} {item.cost})
                    </option>
                  ))}
                </select>
              </div>

              {baseItem && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Nombre Comercial del Equipo Ensamblado</label>
                    <input
                      type="text"
                      value={assembledName}
                      onChange={e => setAssembledName(e.target.value)}
                      required
                      className="w-full border border-gray-300 p-2 rounded text-sm font-semibold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Cantidad a Ensamblar</label>
                      <input
                        type="number"
                        min="1"
                        max={baseItem.stock}
                        value={quantityToBuild}
                        onChange={e => setQuantityToBuild(Math.max(1, Number(e.target.value) || 1))}
                        required
                        className="w-full border border-gray-300 p-2 rounded text-sm font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Precio Final de Venta ({currency})</label>
                      <input
                        type="number"
                        step="0.01"
                        value={customSalePrice}
                        onChange={e => setCustomSalePrice(e.target.value)}
                        required
                        className="w-full border border-gray-300 p-2 rounded text-sm font-bold text-green-700"
                      />
                    </div>
                  </div>

                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-gray-800 uppercase">Componentes Adicionales (RAM, SSD, etc.)</span>
                      <button
                        type="button"
                        onClick={handleAddComponentRow}
                        className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold px-2 py-1 rounded transition"
                      >
                        + Agregar Pieza
                      </button>
                    </div>

                    {selectedComponents.map((sc, index) => (
                      <div key={index} className="flex items-center gap-2 bg-white p-2 rounded border border-gray-200">
                        <select
                          value={sc.component_id}
                          onChange={e => handleComponentChange(index, 'component_id', e.target.value)}
                          required
                          className="flex-1 border border-gray-300 p-1.5 rounded text-xs bg-white"
                        >
                          <option value="">-- Elegir componente --</option>
                          {availableComponentItems.map(comp => (
                            <option key={comp.id} value={comp.id}>
                              {comp.name} (Stock: {comp.stock})
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="1"
                          value={sc.qty}
                          onChange={e => handleComponentChange(index, 'qty', Math.max(1, Number(e.target.value) || 1))}
                          className="w-16 border border-gray-300 p-1.5 rounded text-xs text-center font-bold"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveComponentRow(index)}
                          className="text-red-600 hover:text-red-800 font-bold px-2 text-sm"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg flex justify-between items-center text-xs">
                    <div>
                      <span className="text-gray-600 block">Costo Total Estimado:</span>
                      <span className="font-bold text-gray-900 text-sm">
                        {currency} {(computeTotals().totalCost / quantityToBuild).toFixed(2)} c/u (Total: {currency} {computeTotals().totalCost.toFixed(2)})
                      </span>
                    </div>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setAssembleModalOpen(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded text-sm hover:bg-gray-300 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || !selectedBaseId}
                  className="px-4 py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 font-semibold disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : 'Publicar en Tienda'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
