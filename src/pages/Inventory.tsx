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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [category, setCategory] = useState('Laptops')
  const [condition, setCondition] = useState('Reacondicionado - Grado A')
  const [cost, setCost] = useState('')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('1')

  useEffect(() => {
    fetchInventory()
  }, [])

  const fetchInventory = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setItems(data)
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

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-lg shadow mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Módulo de Inventario y Taller</h1>
            <p className="text-sm text-gray-500">Gestión en tiempo real de equipos informáticos y repuestos</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => navigate('/cashbox')} className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700">
              Ir a Caja
            </button>
            <button onClick={() => navigate('/reports')} className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700">
              Reportes
            </button>
            <button onClick={() => navigate('/register')} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
              Crear Usuario
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Costo Adquisición (Bs.)</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio Venta (Bs.)</label>
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
                    </tr>
                  </thead>
                  <tbody className="divide-y text-sm text-gray-700">
                    {items.map(item => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="p-3 font-medium">{item.name}</td>
                        <td className="p-3">{item.category}</td>
                        <td className="p-3">{item.condition}</td>
                        <td className="p-3">Bs. {item.cost}</td>
                        <td className="p-3 font-semibold text-green-700">Bs. {item.price}</td>
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
