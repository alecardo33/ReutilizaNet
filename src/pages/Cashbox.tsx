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

interface Sale {
  id: string
  product_name: string
  customer: string
  payment_method: string
  quantity: number
  total_amount: number
  created_at: string
}

export default function Cashbox() {
  const navigate = useNavigate()
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)

  const [selectedItemId, setSelectedItemId] = useState('')
  const [manualProduct, setManualProduct] = useState('')
  const [customer, setCustomer] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('Efectivo')
  const [quantity, setQuantity] = useState(1)
  const [amount, setAmount] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const [invRes, salesRes] = await Promise.all([
      supabase.from('inventory').select('id, name, cost, price, stock').gt('stock', 0).order('name'),
      supabase.from('sales').select('*').order('created_at', { ascending: false })
    ])

    if (invRes.data) setInventory(invRes.data)
    if (salesRes.data) setSales(salesRes.data)
    setLoading(false)
  }

  const handleSelectProduct = (itemId: string) => {
    setSelectedItemId(itemId)
    if (itemId === 'manual' || itemId === '') {
      setAmount('')
      return
    }
    const item = inventory.find(i => i.id === itemId)
    if (item) {
      setAmount((item.price * quantity).toString())
    }
  }

  const handleQuantityChange = (newQty: number) => {
    const validQty = Math.max(1, newQty)
    setQuantity(validQty)
    if (selectedItemId && selectedItemId !== 'manual') {
      const item = inventory.find(i => i.id === selectedItemId)
      if (item) {
        setAmount((item.price * validQty).toString())
      }
    }
  }

  const handleRegisterSale = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount) return
    setProcessing(true)

    const { data: { user } } = await supabase.auth.getUser()
    const selectedItem = inventory.find(i => i.id === selectedItemId)

    const productName = selectedItem ? selectedItem.name : manualProduct
    const unitCost = selectedItem ? selectedItem.cost : 0

    if (!productName) {
      alert('Selecciona un equipo o escribe el concepto de venta.')
      setProcessing(false)
      return
    }

    if (selectedItem && selectedItem.stock < quantity) {
      alert(`Stock insuficiente. Solo quedan ${selectedItem.stock} unidades.`)
      setProcessing(false)
      return
    }

    const { error: saleError } = await supabase.from('sales').insert([
      {
        inventory_id: selectedItem ? selectedItem.id : null,
        product_name: productName,
        customer: customer || 'Cliente Mostrador',
        payment_method: paymentMethod,
        quantity,
        unit_cost: unitCost,
        total_amount: Number(amount),
        sold_by: user?.id
      }
    ])

    if (saleError) {
      alert('Error al registrar la venta: ' + saleError.message)
      setProcessing(false)
      return
    }

    if (selectedItem) {
      await supabase
        .from('inventory')
        .update({ stock: selectedItem.stock - quantity })
        .eq('id', selectedItem.id)
    }

    setSelectedItemId('')
    setManualProduct('')
    setCustomer('')
    setQuantity(1)
    setAmount('')
    await fetchData()
    setProcessing(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const totalCashbox = sales.reduce((acc, item) => acc + Number(item.total_amount), 0)

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-lg shadow mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Módulo de Caja y Ventas</h1>
            <p className="text-sm text-gray-500">Registro conectado al inventario y descuento automático de stock</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => navigate('/inventory')} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
              Ir a Inventario
            </button>
            <button onClick={() => navigate('/reports')} className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700">
              Reportes
            </button>
            <button onClick={handleLogout} className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700">
              Cerrar Sesión
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow h-fit">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Registrar Nueva Venta</h2>
            <form onSubmit={handleRegisterSale} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Seleccionar Equipo de Inventario</label>
                <select
                  value={selectedItemId}
                  onChange={e => handleSelectProduct(e.target.value)}
                  className="w-full border border-gray-300 p-2 rounded text-sm bg-white"
                  required
                >
                  <option value="">-- Elegir producto --</option>
                  {inventory.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} (Stock: {item.stock} - Bs. {item.price})
                    </option>
                  ))}
                  <option value="manual">+ Otro servicio / venta manual</option>
                </select>
              </div>

              {selectedItemId === 'manual' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripción / Servicio</label>
                  <input
                    type="text"
                    value={manualProduct}
                    onChange={e => setManualProduct(e.target.value)}
                    required
                    placeholder="Ej: Mantenimiento preventivo / Formateo"
                    className="w-full border border-gray-300 p-2 rounded text-sm"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad</label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={e => handleQuantityChange(Number(e.target.value))}
                    required
                    className="w-full border border-gray-300 p-2 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monto Total (Bs.)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    required
                    placeholder="0.00"
                    className="w-full border border-gray-300 p-2 rounded text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Cliente (Opcional)</label>
                <input
                  type="text"
                  value={customer}
                  onChange={e => setCustomer(e.target.value)}
                  placeholder="Ej: Ana Gómez / Cliente Mostrador"
                  className="w-full border border-gray-300 p-2 rounded text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Método de Pago</label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  className="w-full border border-gray-300 p-2 rounded text-sm bg-white"
                >
                  <option value="Efectivo">Efectivo</option>
                  <option value="Transferencia / QR">Transferencia / QR</option>
                  <option value="Tarjeta">Tarjeta de Débito / Crédito</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={processing}
                className="w-full bg-green-600 text-white font-semibold py-2 rounded hover:bg-green-700 transition"
              >
                {processing ? 'Procesando...' : 'Confirmar Venta'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-lg shadow flex justify-between items-center border-l-4 border-green-600">
              <div>
                <p className="text-sm text-gray-500 font-medium">Total Acumulado en Ventas</p>
                <h3 className="text-3xl font-bold text-gray-800">Bs. {totalCashbox.toFixed(2)}</h3>
              </div>
              <span className="bg-green-100 text-green-800 text-xs font-semibold px-3 py-1 rounded-full">
                {sales.length} ventas registradas
              </span>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Historial de Ventas Reales</h2>
              {loading ? (
                <p className="text-sm text-gray-500">Cargando ventas...</p>
              ) : sales.length === 0 ? (
                <p className="text-sm text-gray-500">Aún no hay ventas registradas en la base de datos.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b bg-gray-50 text-xs font-semibold text-gray-600 uppercase">
                        <th className="p-3">Equipo / Concepto</th>
                        <th className="p-3">Cant.</th>
                        <th className="p-3">Cliente</th>
                        <th className="p-3">Pago</th>
                        <th className="p-3">Fecha</th>
                        <th className="p-3">Monto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-sm text-gray-700">
                      {sales.map(sale => (
                        <tr key={sale.id} className="hover:bg-gray-50">
                          <td className="p-3 font-medium">{sale.product_name}</td>
                          <td className="p-3">{sale.quantity}</td>
                          <td className="p-3">{sale.customer}</td>
                          <td className="p-3">{sale.payment_method}</td>
                          <td className="p-3 text-gray-500 text-xs">
                            {new Date(sale.created_at).toLocaleString()}
                          </td>
                          <td className="p-3 font-bold text-green-700">Bs. {sale.total_amount}</td>
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
    </div>
  )
}
