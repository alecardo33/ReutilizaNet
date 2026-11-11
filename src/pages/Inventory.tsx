import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Product, ItemStock, Provider } from '../types/inventory'

export default function Inventory() {
  const [products, setProducts] = useState<Product[]>([])
  const [itemsStock, setItemsStock] = useState<ItemStock[]>([])
  const [providers, setProviders] = useState<Provider[]>([])
  
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  // Formulario de nuevo equipo base
  const [name, setName] = useState('')
  const [providerId, setProviderId] = useState('')
  const [baseCost, setBaseCost] = useState(0)
  const [salePrice, setSalePrice] = useState(0)
  const [selectedItems, setSelectedItems] = useState<{ id: string; quantity: number }[]>([])

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    try {
      const [prodRes, itemsRes, provRes] = await Promise.all([
        supabase.from('products').select('*, providers(*)'),
        supabase.from('items_stock').select('*'),
        supabase.from('providers').select('*')
      ])

      if (prodRes.data) setProducts(prodRes.data)
      if (itemsRes.data) setItemsStock(itemsRes.data)
      if (provRes.data) setProviders(provRes.data)
    } catch (error) {
      console.error('Error cargando inventario:', error)
    } finally {
      setLoading(false)
    }
  }

  // Cálculo dinámico del costo final (Costo base + Costo de los ítems adicionales seleccionados)
  const calculatedFinalCost = baseCost + selectedItems.reduce((acc, curr) => {
    const item = itemsStock.find(i => i.id === curr.id)
    return acc + (item ? item.cost_price * curr.quantity : 0)
  }, 0)

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      // 1. Insertar producto principal
      const { data: newProd, error: prodError } = await supabase
        .from('products')
        .insert([{
          name,
          provider_id: providerId || null,
          base_cost: baseCost,
          final_cost: calculatedFinalCost,
          sale_price: salePrice,
          stock: 1
        }])
        .select()
        .single()

      if (prodError) throw prodError

      // 2. Registrar relaciones de ítems adicionales y descontar stock
      if (newProd && selectedItems.length > 0) {
        for (const sel of selectedItems) {
          await supabase.from('product_items').insert({
            product_id: newProd.id,
            item_id: sel.id,
            quantity: sel.quantity
          })

          // Descontar del stock del componente
          const currentItem = itemsStock.find(i => i.id === sel.id)
          if (currentItem) {
            await supabase
              .from('items_stock')
              .update({ stock: Math.max(0, currentItem.stock - sel.quantity) })
              .eq('id', sel.id)
          }
        }
      }

      setShowModal(false)
      setName('')
      setBaseCost(0)
      setSalePrice(0)
      setSelectedItems([])
      fetchData()
    } catch (error: any) {
      alert(`Error al crear producto: ${error.message}`)
    }
  }

  if (loading) return <div className="p-6">Cargando inventario...</div>

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Inventario de Equipos y Componentes</h1>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + Nuevo Equipo Informático
        </button>
      </div>

      {/* Tabla de Productos */}
      <div className="bg-white shadow rounded-lg overflow-hidden mb-8">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Equipo / Producto</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proveedor</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Costo Base</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Costo Final ( c/ Adiciones )</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Precio Venta</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ganancia Estimada</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {products.map((p) => {
              const profit = p.sale_price - p.final_cost
              return (
                <tr key={p.id}>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{p.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">{p.providers?.name || 'N/D'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-gray-700">${p.base_cost.toFixed(2)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right font-semibold text-blue-600">${p.final_cost.toFixed(2)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-green-600 font-bold">${p.sale_price.toFixed(2)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-gray-900">${profit.toFixed(2)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal para Nuevo Producto con Selección Múltiple */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <h2 className="text-xl font-bold mb-4">Armar / Registrar Nuevo Equipo</h2>
            <form onSubmit={handleCreateProduct} className="space-y-4">
              <div>
                <label className="block text-sm font-medium">Nombre del Equipo</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  required 
                  placeholder="Ej: Laptop Core i5 8th Gen"
                  className="w-full border p-2 rounded" 
                />
              </div>

              <div>
                <label className="block text-sm font-medium">Proveedor</label>
                <select 
                  value={providerId} 
                  onChange={e => setProviderId(e.target.value)} 
                  className="w-full border p-2 rounded"
                >
                  <option value="">Seleccione proveedor</option>
                  {providers.map(prov => (
                    <option key={prov.id} value={prov.id}>{prov.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium">Costo Base ($)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={baseCost} 
                    onChange={e => setBaseCost(parseFloat(e.target.value) || 0)} 
                    className="w-full border p-2 rounded" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Precio de Venta ($)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={salePrice} 
                    onChange={e => setSalePrice(parseFloat(e.target.value) || 0)} 
                    className="w-full border p-2 rounded" 
                  />
                </div>
              </div>

              {/* Selección múltiple de componentes adicionales */}
              <div>
                <label className="block text-sm font-medium mb-1">Componentes Adicionales (RAM, SSD, etc.)</label>
                <div className="border p-3 rounded max-h-40 overflow-y-auto space-y-2">
                  {itemsStock.map(item => {
                    const found = selectedItems.find(s => s.id === item.id)
                    return (
                      <div key={item.id} className="flex justify-between items-center text-sm">
                        <span>{item.name} (${item.cost_price.toFixed(2)} c/u - Stock: {item.stock})</span>
                        <input 
                          type="number" 
                          min="0" 
                          max={item.stock}
                          value={found?.quantity || 0}
                          onChange={e => {
                            const qty = parseInt(e.target.value) || 0
                            setSelectedItems(prev => {
                              const filtered = prev.filter(p => p.id !== item.id)
                              if (qty > 0) return [...filtered, { id: item.id, quantity: qty }]
                              return filtered
                            })
                          }}
                          className="w-16 border p-1 rounded text-center"
                        />
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="bg-gray-50 p-3 rounded flex justify-between items-center">
                <span className="font-medium">Costo Final Calculado:</span>
                <span className="text-lg font-bold text-blue-600">${calculatedFinalCost.toFixed(2)}</span>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-100"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Guardar Producto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}