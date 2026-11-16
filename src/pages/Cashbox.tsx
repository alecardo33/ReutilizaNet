import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface InventoryItem {
  id: string
  name: string
  category: string
  condition: string
  price: number
  cost: number
  stock: number
  item_type: 'inventory'
}

interface StoreProduct {
  id: string
  base_item_id: string
  name: string
  category: string
  components: any[]
  total_cost: number
  sale_price: number
  stock: number
  item_type: 'store'
}

interface CartItem {
  id: string
  name: string
  price: number
  cost: number
  qty: number
  stock: number
  item_type: 'inventory' | 'store'
  components?: any[]
}

export default function Cashbox() {
  const navigate = useNavigate()
  const location = useLocation()
  const [userRole, setUserRole] = useState<string>('')
  const [currency, setCurrency] = useState('Bs.')
  const [companySettings, setCompanySettings] = useState<any>(null)

  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [storeProducts, setStoreProducts] = useState<StoreProduct[]>([])
  const [loading, setLoading] = useState(true)

  // Búsqueda y pestañas en el catálogo de venta
  const [activeCatalogTab, setActiveCatalogTab] = useState<'store' | 'inventory'>('store')
  const [searchTerm, setSearchTerm] = useState('')

  // Carrito de ventas
  const [cart, setCart] = useState<CartItem[]>([])
  const [customerName, setCustomerName] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('Efectivo')
  const [amountPaidInput, setAmountPaidInput] = useState('')
  const [processingSale, setProcessingSale] = useState(false)

  // Modal de Recibo Imprimible
  const [receiptModalOpen, setReceiptModalOpen] = useState(false)
  const [completedSaleData, setCompletedSaleData] = useState<any>(null)

  useEffect(() => {
    fetchDataAndRouteState()
  }, [location.state])

  const fetchDataAndRouteState = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role) setUserRole(profile.role)
    }

    const [invRes, storeRes, settingsRes] = await Promise.all([
      supabase.from('inventory').select('*').gt('stock', 0).order('name'),
      supabase.from('store_products').select('*').gt('stock', 0).order('created_at', { ascending: false }),
      supabase.from('company_settings').select('*').eq('id', 1).single()
    ])

    let invList: InventoryItem[] = []
    let storeList: StoreProduct[] = []

    if (!invRes.error && invRes.data) {
      invList = invRes.data.map((i: any) => ({ ...i, item_type: 'inventory' as const }))
      setInventoryItems(invList)
    }
    if (!storeRes.error && storeRes.data) {
      storeList = storeRes.data.map((s: any) => ({ ...s, price: Number(s.sale_price), cost: Number(s.total_cost), item_type: 'store' as const }))
      setStoreProducts(storeList)
    }
    if (settingsRes.data) {
      if (settingsRes.data.currency) setCurrency(settingsRes.data.currency)
      setCompanySettings(settingsRes.data)
    }

    // Si viene un producto desde la Tienda vía router state
    const productToSell = location.state?.productToSell
    if (productToSell) {
      const foundInCart = cart.find(c => c.id === productToSell.id && c.item_type === 'store')
      if (!foundInCart) {
        const newItem: CartItem = {
          id: productToSell.id,
          name: productToSell.name,
          price: Number(productToSell.sale_price || productToSell.price),
          cost: Number(productToSell.total_cost || productToSell.cost),
          qty: 1,
          stock: productToSell.stock,
          item_type: 'store',
          components: productToSell.components
        }
        setCart([newItem])
      }
    }

    setLoading(false)
  }

  const handleAddToCart = (item: InventoryItem | StoreProduct) => {
    const itemType = item.item_type
    const itemId = item.id
    const itemName = item.name
    const itemPrice = Number('sale_price' in item ? item.sale_price : item.price)
    const itemCost = Number('total_cost' in item ? item.total_cost : item.cost)
    const itemStock = item.stock
    const components = 'components' in item ? item.components : undefined

    const existing = cart.find(c => c.id === itemId && c.item_type === itemType)
    if (existing) {
      if (existing.qty + 1 > itemStock) {
        alert('No hay suficiente stock disponible.')
        return
      }
      setCart(cart.map(c => c.id === itemId && c.item_type === itemType ? { ...c, qty: c.qty + 1 } : c))
    } else {
      if (itemStock < 1) {
        alert('Producto sin stock.')
        return
      }
      setCart([...cart, {
        id: itemId,
        name: itemName,
        price: itemPrice,
        cost: itemCost,
        qty: 1,
        stock: itemStock,
        item_type: itemType,
        components
      }])
    }
  }

  const handleUpdateCartQty = (id: string, itemType: string, delta: number) => {
    setCart(cart.map(c => {
      if (c.id === id && c.item_type === itemType) {
        const newQty = c.qty + delta
        if (newQty <= 0) return null
        if (newQty > c.stock) {
          alert('Stock máximo alcanzado.')
          return c
        }
        return { ...c, qty: newQty }
      }
      return c
    }).filter(Boolean) as CartItem[])
  }

  const handleRemoveFromCart = (id: string, itemType: string) => {
    setCart(cart.filter(c => !(c.id === id && c.item_type === itemType)))
  }

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0)
  const totalAmount = subtotal
  const paidNum = paymentMethod === 'A Crédito' ? 0 : (Number(amountPaidInput) || totalAmount)
  const changeNum = Math.max(0, paidNum - totalAmount)

  const handleCompleteSale = async (e: React.FormEvent) => {
    e.preventDefault()
    if (cart.length === 0) {
      alert('El carrito está vacío.')
      return
    }

    if (paymentMethod !== 'A Crédito' && paidNum < totalAmount) {
      alert('El monto pagado es menor al total de la venta.')
      return
    }

    setProcessingSale(true)
    const { data: { user } } = await supabase.auth.getUser()

    try {
      // 1. Descontar stock de cada ítem según su tipo (store o inventory)
      for (const item of cart) {
        if (item.item_type === 'store') {
          const storeProd = storeProducts.find(s => s.id === item.id)
          if (!storeProd || storeProd.stock < item.qty) {
            throw new Error(`Stock insuficiente en Tienda para "${item.name}".`)
          }
          const newStock = storeProd.stock - item.qty
          const { error: updErr } = await supabase
            .from('store_products')
            .update({ stock: newStock })
            .eq('id', item.id)
          if (updErr) throw updErr
        } else {
          const invItem = inventoryItems.find(i => i.id === item.id)
          if (!invItem || invItem.stock < item.qty) {
            throw new Error(`Stock insuficiente en Inventario para "${item.name}".`)
          }
          const newStock = invItem.stock - item.qty
          const { error: updErr } = await supabase
            .from('inventory')
            .update({ stock: newStock })
            .eq('id', item.id)
          if (updErr) throw updErr
        }
      }

      // 2. Registrar la venta en la tabla 'sales' con respaldo robusto si amount_paid no existe
      const salePayload = {
        customer_name: customerName.trim() || 'Cliente General',
        total_amount: totalAmount,
        amount_paid: paidNum,
        payment_method: `${paymentMethod}${paymentMethod === 'A Crédito' ? ' [Pendiente]' : ` - Pagado: ${paidNum.toFixed(2)}`}`,
        items: cart,
        created_by: user?.id
      }

      let insertedSale: any = null
      const firstSaleTry = await supabase.from('sales').insert([salePayload]).select().single()

      if (
        firstSaleTry.error &&
        (firstSaleTry.error.message.includes('amount_paid') ||
          firstSaleTry.error.message.includes('payment_method') ||
          firstSaleTry.error.message.includes('column'))
      ) {
        const { amount_paid, ...fallbackSalePayload } = salePayload
        const secondSaleTry = await supabase.from('sales').insert([fallbackSalePayload]).select().single()
        if (secondSaleTry.error) throw secondSaleTry.error
        insertedSale = secondSaleTry.data
      } else if (firstSaleTry.error) {
        throw firstSaleTry.error
      } else {
        insertedSale = firstSaleTry.data
      }

      setCompletedSaleData({
        id: insertedSale?.id || 'V-' + Date.now(),
        date: new Date().toLocaleString(),
        customer_name: salePayload.customer_name,
        items: cart,
        total_amount: totalAmount,
        amount_paid: paidNum,
        change: changeNum,
        payment_method: paymentMethod
      })

      setReceiptModalOpen(true)
      setCart([])
      setCustomerName('')
      setAmountPaidInput('')
      await fetchDataAndRouteState()
    } catch (err: any) {
      alert('Error al procesar la venta: ' + err.message)
    } finally {
      setProcessingSale(false)
    }
  }

  const filteredStoreProducts = storeProducts.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
  const filteredInventoryItems = inventoryItems.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()))

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-lg shadow mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Módulo de Caja y Ventas</h1>
            <p className="text-sm text-gray-500">Vende equipos ensamblados de Tienda o piezas del Inventario Principal</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => navigate('/')} className="bg-gray-600 text-white px-4 py-2 rounded text-sm hover:bg-gray-700">
              Inicio
            </button>
            <button onClick={() => navigate('/store')} className="bg-amber-600 text-white px-4 py-2 rounded text-sm hover:bg-amber-700">
              Tienda
            </button>
            <button onClick={() => navigate('/inventory')} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
              Inventario
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna Izquierda / Centro: Catálogo de Productos */}
          <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow">
            <div className="flex flex-wrap justify-between items-center mb-4 gap-3 border-b pb-3">
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveCatalogTab('store')}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition ${
                    activeCatalogTab === 'store' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Equipos en Tienda ({storeProducts.length})
                </button>
                <button
                  onClick={() => setActiveCatalogTab('inventory')}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition ${
                    activeCatalogTab === 'inventory' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Inventario General ({inventoryItems.length})
                </button>
              </div>

              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar producto..."
                className="border border-gray-300 p-2 rounded text-xs bg-white w-full sm:w-64"
              />
            </div>

            {loading ? (
              <p className="text-gray-500 text-sm">Cargando catálogo...</p>
            ) : activeCatalogTab === 'store' ? (
              filteredStoreProducts.length === 0 ? (
                <p className="text-gray-500 text-sm py-6 text-center">No hay equipos disponibles en Tienda.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-1">
                  {filteredStoreProducts.map(prod => (
                    <div key={prod.id} className="border border-gray-200 rounded-lg p-4 flex flex-col justify-between hover:shadow-md transition bg-purple-50/30">
                      <div>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-purple-100 text-purple-800 rounded uppercase">Tienda</span>
                        <h3 className="text-sm font-bold text-gray-900 mt-1">{prod.name}</h3>
                        <p className="text-xs text-gray-500 mb-2">Stock disponible: <span className="font-bold text-gray-800">{prod.stock}</span></p>
                      </div>
                      <div className="flex justify-between items-center pt-3 border-t border-gray-100 mt-2">
                        <span className="font-bold text-green-700 text-base">{currency} {Number(prod.sale_price).toFixed(2)}</span>
                        <button
                          onClick={() => handleAddToCart(prod)}
                          className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded text-xs font-bold shadow transition"
                        >
                          + Agregar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              filteredInventoryItems.length === 0 ? (
                <p className="text-gray-500 text-sm py-6 text-center">No hay ítems disponibles en Inventario.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-1">
                  {filteredInventoryItems.map(item => (
                    <div key={item.id} className="border border-gray-200 rounded-lg p-4 flex flex-col justify-between hover:shadow-md transition bg-blue-50/20">
                      <div>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-800 rounded uppercase">{item.category}</span>
                        <h3 className="text-sm font-bold text-gray-900 mt-1">{item.name}</h3>
                        <p className="text-xs text-gray-500 mb-2">Stock disponible: <span className="font-bold text-gray-800">{item.stock}</span></p>
                      </div>
                      <div className="flex justify-between items-center pt-3 border-t border-gray-100 mt-2">
                        <span className="font-bold text-green-700 text-base">{currency} {Number(item.price).toFixed(2)}</span>
                        <button
                          onClick={() => handleAddToCart(item)}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs font-bold shadow transition"
                        >
                          + Agregar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>

          {/* Columna Derecha: Carrito y Cobro */}
          <div className="bg-white p-6 rounded-lg shadow flex flex-col justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-3 border-b pb-2">Carrito de Venta</h2>

              {cart.length === 0 ? (
                <p className="text-gray-400 text-xs py-8 text-center">El carrito está vacío. Agrega productos desde Tienda o Inventario.</p>
              ) : (
                <div className="space-y-3 max-h-72 overflow-y-auto mb-4 pr-1">
                  {cart.map((item, idx) => (
                    <div key={`${item.item_type}-${item.id}-${idx}`} className="bg-gray-50 p-2.5 rounded-lg border border-gray-200 flex justify-between items-center gap-2">
                      <div className="flex-1">
                        <p className="text-xs font-bold text-gray-900">{item.name}</p>
                        <p className="text-[11px] text-green-700 font-semibold">{currency} {item.price.toFixed(2)} c/u</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleUpdateCartQty(item.id, item.item_type, -1)}
                          className="bg-gray-200 hover:bg-gray-300 px-2 py-0.5 rounded text-xs font-bold"
                        >
                          -
                        </button>
                        <span className="text-xs font-bold w-5 text-center">{item.qty}</span>
                        <button
                          onClick={() => handleUpdateCartQty(item.id, item.item_type, 1)}
                          className="bg-gray-200 hover:bg-gray-300 px-2 py-0.5 rounded text-xs font-bold"
                        >
                          +
                        </button>
                        <button
                          onClick={() => handleRemoveFromCart(item.id, item.item_type)}
                          className="text-red-600 hover:text-red-800 font-bold px-1.5 text-xs ml-1"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={handleCompleteSale} className="space-y-3.5 pt-4 border-t">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Nombre del Cliente (Opcional)</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  className="w-full border border-gray-300 p-2 rounded text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Método de Pago</label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  className="w-full border border-gray-300 p-2 rounded text-xs bg-white font-semibold"
                >
                  <option value="Efectivo">Efectivo</option>
                  <option value="Pago QR">Pago QR</option>
                  <option value="A Crédito">A Crédito / Fiado</option>
                </select>
              </div>

              {paymentMethod !== 'A Crédito' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Monto Pagado ({currency})</label>
                  <input
                    type="number"
                    step="0.01"
                    value={amountPaidInput}
                    onChange={e => setAmountPaidInput(e.target.value)}
                    placeholder={totalAmount.toFixed(2)}
                    className="w-full border border-gray-300 p-2 rounded text-xs font-bold text-green-700"
                    required
                  />
                </div>
              )}

              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-1 text-xs">
                <div className="flex justify-between font-bold text-sm text-gray-900 pt-1 border-t">
                  <span>Total a Pagar:</span>
                  <span className="text-green-700">{currency} {totalAmount.toFixed(2)}</span>
                </div>
                {paymentMethod !== 'A Crédito' && (
                  <div className="flex justify-between font-semibold text-gray-600">
                    <span>Cambio / Vuelto:</span>
                    <span>{currency} {changeNum.toFixed(2)}</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={processingSale || cart.length === 0}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded text-sm transition shadow disabled:opacity-50"
              >
                {processingSale ? 'Procesando Venta...' : 'Completar Venta e Imprimir Recibo'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {receiptModalOpen && completedSaleData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 border border-gray-200 text-center space-y-4">
            <div className="text-green-600 text-4xl mb-1">✓</div>
            <h3 className="text-lg font-bold text-gray-900">¡Venta Completada con Éxito!</h3>
            
            <div className="bg-gray-50 p-3 rounded text-left text-xs space-y-1.5 border">
              <p><span className="font-bold">Comprobante:</span> {completedSaleData.id}</p>
              <p><span className="font-bold">Cliente:</span> {completedSaleData.customer_name}</p>
              <p><span className="font-bold">Fecha:</span> {completedSaleData.date}</p>
              <hr className="my-1"/>
              <p className="font-bold">Ítems vendidos:</p>
              {completedSaleData.items.map((i: any, idx: number) => (
                <div key={idx} className="flex justify-between">
                  <span>{i.qty}x {i.name}</span>
                  <span>{currency} {(i.price * i.qty).toFixed(2)}</span>
                </div>
              ))}
              <hr className="my-1"/>
              <p className="flex justify-between font-bold text-sm text-green-700">
                <span>Total Cobrado:</span>
                <span>{currency} {completedSaleData.total_amount.toFixed(2)}</span>
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  window.print()
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded text-xs font-bold transition"
              >
                Imprimir Recibo
              </button>
              <button
                onClick={() => {
                  setReceiptModalOpen(false)
                  setCompletedSaleData(null)
                }}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded text-xs font-bold transition"
              >
                Chrrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
