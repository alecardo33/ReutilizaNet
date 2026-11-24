import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface Product {
  id: string
  name: string
  category: string
  cost: number
  price: number
  stock: number
}

interface CartItem extends Product {
  quantity: number
}

export default function Cashbox() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('Efectivo')
  const [amountPaid, setAmountPaid] = useState('')
  const [clientName, setClientName] = useState('')
  const [currency, setCurrency] = useState('Bs.')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    const [invRes, cfgRes] = await Promise.all([
      supabase.from('inventory').select('*').gt('stock', 0).order('name', { ascending: true }),
      supabase.from('company_settings').select('currency').eq('id', 1).maybeSingle()
    ])
    if (invRes.error) {
      console.error('Error al cargar productos:', invRes.error)
    } else if (invRes.data) {
      setProducts(invRes.data)
    }
    if (cfgRes.data?.currency) setCurrency(cfgRes.data.currency)
  }

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id)
      if (existing) {
        if (existing.quantity >= product.stock) return prev
        return prev.map(item =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      }
      return [...prev, { ...product, quantity: 1 }]
    })
  }

  const changeQty = (id: string, delta: number) => {
    setCart(prev =>
      prev
        .map(item => {
          if (item.id !== id) return item
          const next = Math.min(item.stock, item.quantity + delta)
          return { ...item, quantity: next }
        })
        .filter(item => item.quantity > 0)
    )
  }

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id))
  }

  const totalAmount = cart.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0)
  const isCredit = paymentMethod === 'Crédito'
  const numericAmountPaid = Number(amountPaid) || 0
  const changeAmount = !isCredit ? Math.max(0, numericAmountPaid - totalAmount) : 0
  const pendingBalance = isCredit ? Math.max(0, totalAmount - numericAmountPaid) : 0

  const handleProcessSale = async () => {
    setMessage('')
    if (cart.length === 0) {
      alert('El carrito está vacío.')
      return
    }
    if (paymentMethod === 'Efectivo' && amountPaid !== '' && numericAmountPaid < totalAmount) {
      alert('El monto pagado es menor al total de la venta.')
      return
    }
    if (isCredit && numericAmountPaid > totalAmount) {
      alert('El adelanto no puede ser mayor al total.')
      return
    }

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const customer = clientName.trim() || 'Cliente Mostrador'

      // Dinero realmente cobrado en esta venta
      const totalCollected = isCredit
        ? numericAmountPaid
        : totalAmount

      for (const item of cart) {
        const itemTotal = Number((Number(item.price) * item.quantity).toFixed(2))
        const itemPaid = totalAmount > 0
          ? Number(((itemTotal / totalAmount) * totalCollected).toFixed(2))
          : 0
        const itemPending = Number((itemTotal - itemPaid).toFixed(2))

        const extendedPayload = {
          inventory_id: item.id,
          product_name: item.name,
          customer,
          quantity: item.quantity,
          unit_cost: Number(item.cost) || 0,
          total_amount: itemTotal,
          amount_paid: itemPaid,
          payment_status: itemPending > 0.009 ? 'Pendiente' : 'Pagado',
          payment_method: paymentMethod,
          created_by: user?.id
        }

        let saleError = (await supabase.from('sales').insert([extendedPayload])).error

        // Si faltan columnas opcionales en la tabla, reintenta sin ellas
        if (saleError && /amount_paid|payment_status|created_by|column/i.test(saleError.message)) {
          const { amount_paid, payment_status, created_by, ...basePayload } = extendedPayload
          const encodedMethod = isCredit
            ? `Crédito [Pagado: ${itemPaid.toFixed(2)}]`
            : paymentMethod
          saleError = (
            await supabase.from('sales').insert([{ ...basePayload, payment_method: encodedMethod }])
          ).error
        }
        if (saleError) throw saleError

        const { error: stockError } = await supabase
          .from('inventory')
          .update({ stock: Math.max(0, item.stock - item.quantity) })
          .eq('id', item.id)
        if (stockError) throw stockError
      }

      setCart([])
      setAmountPaid('')
      setClientName('')
      setPaymentMethod('Efectivo')
      setMessage('¡Venta procesada con éxito!')
      await fetchProducts()
    } catch (err: any) {
      // El carrito NO se borra si hay error, para poder reintentar
      console.error('Error al procesar la venta:', err)
      alert(`Error al procesar la venta: ${err.message || 'Error desconocido'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const filteredProducts = products.filter(p =>
    (p.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-lg shadow mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Caja y Ventas</h1>
            <p className="text-sm text-gray-500">Registro de ventas al contado o a crédito</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => navigate('/')} className="bg-gray-600 text-white px-4 py-2 rounded text-sm hover:bg-gray-700">
              Inicio
            </button>
            <button onClick={() => navigate('/inventory')} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
              Inventario
            </button>
            <button onClick={() => navigate('/reports')} className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700">
              Reportes
            </button>
            <button onClick={handleLogout} className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700">
              Cerrar Sesión
            </button>
          </div>
        </div>

        {message && (
          <div className="bg-green-50 border border-green-300 text-green-800 px-4 py-3 rounded-lg text-sm font-medium mb-4">
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Catálogo */}
          <div className="lg:col-span-2 bg-white p-4 rounded-xl shadow">
            <h2 className="text-xl font-bold mb-4">Catálogo de Productos</h2>
            <input
              type="text"
              placeholder="Buscar producto..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full p-2 border rounded mb-4"
            />
            {filteredProducts.length === 0 ? (
              <p className="text-sm text-gray-500">No hay productos con stock disponible.</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto">
                {filteredProducts.map(product => {
                  const inCart = cart.find(c => c.id === product.id)?.quantity || 0
                  const noMore = inCart >= product.stock
                  return (
                    <div key={product.id} className="border p-4 rounded-lg flex flex-col justify-between">
                      <div>
                        <h3 className="font-semibold text-sm">{product.name}</h3>
                        <p className="text-xs text-gray-500">{product.category}</p>
                        <p className="text-green-600 font-bold mt-1">
                          {currency} {Number(product.price).toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500">Stock: {product.stock}</p>
                      </div>
                      <button
                        onClick={() => addToCart(product)}
                        disabled={noMore}
                        className="mt-3 bg-indigo-600 text-white py-1 px-3 rounded hover:bg-indigo-700 disabled:bg-gray-300 text-sm"
                      >
                        {noMore ? 'Sin más stock' : '+ Agregar'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Carrito y cobro */}
          <div className="bg-white p-4 rounded-xl shadow flex flex-col justify-between">
            <div>
              <h2 className="text-xl font-bold mb-4">Carrito de Venta</h2>
              <div className="space-y-3 max-h-[250px] overflow-y-auto mb-4">
                {cart.length === 0 ? (
                  <p className="text-gray-500 text-center py-6">El carrito está vacío</p>
                ) : (
                  cart.map(item => (
                    <div key={item.id} className="flex justify-between items-center border-b pb-2 gap-2">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{item.name}</p>
                        <p className="text-xs text-gray-500">
                          {currency} {Number(item.price).toFixed(2)} c/u
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => changeQty(item.id, -1)}
                          className="bg-gray-200 hover:bg-gray-300 px-2 rounded font-bold text-xs"
                        >
                          -
                        </button>
                        <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                        <button
                          onClick={() => changeQty(item.id, 1)}
                          disabled={item.quantity >= item.stock}
                          className="bg-gray-200 hover:bg-gray-300 px-2 rounded font-bold text-xs disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="text-red-500 hover:text-red-700 text-xs"
                      >
                        Quitar
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <div>
                <label className="text-sm font-medium">Nombre del Cliente (Opcional)</label>
                <input
                  type="text"
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  placeholder="Ej. Juan Pérez"
                  className="w-full p-2 border rounded mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Método de Pago</label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  className="w-full p-2 border rounded mt-1 bg-white"
                >
                  <option value="Efectivo">Efectivo</option>
                  <option value="QR">Pago QR</option>
                  <option value="Transferencia">Transferencia</option>
                  <option value="Crédito">Crédito / Fiado</option>
                </select>
              </div>

              {paymentMethod === 'Efectivo' && (
                <div>
                  <label className="text-sm font-medium">Monto Recibido ({currency})</label>
                  <input
                    type="number"
                    step="0.01"
                    value={amountPaid}
                    onChange={e => setAmountPaid(e.target.value)}
                    placeholder="0.00"
                    className="w-full p-2 border rounded mt-1"
                  />
                  <p className="text-sm text-gray-600 mt-1">
                    Cambio / Vuelto:{' '}
                    <span className="font-bold text-indigo-600">
                      {currency} {changeAmount.toFixed(2)}
                    </span>
                  </p>
                </div>
              )}

              {isCredit && (
                <div className="bg-orange-50 border border-orange-200 rounded p-3 space-y-2">
                  <label className="text-sm font-medium text-orange-900">
                    Adelanto recibido hoy ({currency}) — Opcional
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amountPaid}
                    onChange={e => setAmountPaid(e.target.value)}
                    placeholder="0.00"
                    className="w-full p-2 border border-orange-300 rounded bg-white"
                  />
                  <p className="text-sm text-orange-900">
                    Saldo por cobrar:{' '}
                    <span className="font-bold">
                      {currency} {pendingBalance.toFixed(2)}
                    </span>
                  </p>
                </div>
              )}

              <div className="flex justify-between text-lg font-bold pt-2 border-t">
                <span>Total:</span>
                <span className="text-green-600">
                  {currency} {totalAmount.toFixed(2)}
                </span>
              </div>
              <button
                onClick={handleProcessSale}
                disabled={loading || cart.length === 0}
                className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 disabled:bg-gray-300 transition"
              >
                {loading ? 'Procesando...' : 'Completar Venta'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}