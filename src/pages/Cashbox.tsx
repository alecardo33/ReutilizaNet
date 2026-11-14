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

interface CompanySettings {
  company_name: string
  nit: string
  address: string
  phone: string
  currency: string
  logo_url: string
  bank_name: string
  account_holder: string
  account_number: string
  account_type: string
  qr_image_url: string
  warranty_notes: string
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
  const [paymentMethod, setPaymentMethod] = useState('Efectivo (Contado)')
  const [quantity, setQuantity] = useState(1)
  const [amount, setAmount] = useState('')

  const [selectedReceipt, setSelectedReceipt] = useState<Sale | null>(null)
  const [warrantyNotes, setWarrantyNotes] = useState('30 días de garantía por defectos de hardware.')

  const [settings, setSettings] = useState<CompanySettings>({
    company_name: 'REUTILIZANET',
    nit: '',
    address: 'La Paz - Bolivia',
    phone: '',
    currency: 'Bs.',
    logo_url: '',
    bank_name: '',
    account_holder: '',
    account_number: '',
    account_type: 'Caja de Ahorro',
    qr_image_url: '',
    warranty_notes: '30 días de garantía por defectos de hardware (no cubre daños físicos, líquidos ni sobrecargas).',
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const [invRes, salesRes, settingsRes] = await Promise.all([
      supabase.from('inventory').select('id, name, cost, price, stock').gt('stock', 0).order('name'),
      supabase.from('sales').select('*').order('created_at', { ascending: false }),
      supabase.from('company_settings').select('*').eq('id', 1).single()
    ])

    if (invRes.data) setInventory(invRes.data)
    if (salesRes.data) setSales(salesRes.data)
    if (settingsRes.data) {
      setSettings(settingsRes.data)
      if (settingsRes.data.warranty_notes) {
        setWarrantyNotes(settingsRes.data.warranty_notes)
      }
    }
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

    const { data: insertedSale, error: saleError } = await supabase
      .from('sales')
      .insert([
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
      .select()
      .single()

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

    if (insertedSale) {
      setSelectedReceipt(insertedSale)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const handlePrint = () => {
    window.print()
  }

  const cur = settings.currency || 'Bs.'
  const totalCashbox = sales.reduce((acc, item) => acc + Number(item.total_amount), 0)

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-receipt, #printable-receipt * {
            visibility: visible;
          }
          #printable-receipt {
            position: fixed;
            left: 0;
            top: 0;
            width: 100%;
            max-width: 100%;
            margin: 0;
            padding: 16px;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-lg shadow mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Módulo de Caja y Ventas</h1>
            <p className="text-sm text-gray-500">Registro conectado al inventario, descuento de stock y notas de venta con QR</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => navigate('/')} className="bg-gray-600 text-white px-4 py-2 rounded text-sm hover:bg-gray-700">
              Inicio
            </button>
            <button onClick={() => navigate('/inventory')} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
              Ir a Inventario
            </button>
            <button onClick={() => navigate('/reports')} className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700">
              Reportes
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
                      {item.name} (Stock: {item.stock} | {cur} {item.price})
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monto Total ({cur})</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Modalidad / Método de Pago</label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  className="w-full border border-gray-300 p-2 rounded text-sm bg-white"
                >
                  <option value="Efectivo (Contado)">Efectivo (Contado)</option>
                  <option value="Transferencia / QR">Transferencia / QR</option>
                  <option value="Crédito / Por Cobrar">Crédito / Por Cobrar</option>
                  <option value="Tarjeta">Tarjeta de Débito / Crédito</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={processing}
                className="w-full bg-green-600 text-white font-semibold py-2 rounded hover:bg-green-700 transition"
              >
                {processing ? 'Procesando...' : 'Confirmar Venta y Generar Nota'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-lg shadow flex justify-between items-center border-l-4 border-green-600">
              <div>
                <p className="text-sm text-gray-500 font-medium">Total Acumulado en Ventas</p>
                <h3 className="text-3xl font-bold text-gray-800">{cur} {totalCashbox.toFixed(2)}</h3>
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
                        <th className="p-3 text-center">Comprobante</th>
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
                          <td className="p-3 font-bold text-green-700">{cur} {Number(sale.total_amount).toFixed(2)}</td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => setSelectedReceipt(sale)}
                              className="bg-gray-800 text-white px-3 py-1 rounded text-xs hover:bg-gray-900 transition"
                            >
                              Ver / Imprimir
                            </button>
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

      {/* Modal de Nota de Venta / Recibo Imprimible */}
      {selectedReceipt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div
            id="printable-receipt"
            className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 border border-gray-200 my-4"
          >
            {/* Encabezado Dinámico con Logo y Datos de Configuración */}
            <div className="flex justify-between items-start border-b-2 border-gray-800 pb-3 mb-3 gap-3">
              <div className="flex items-start gap-3">
                {settings.logo_url && (
                  <img
                    src={settings.logo_url}
                    alt="Logo Empresa"
                    className="w-14 h-14 object-contain shrink-0"
                  />
                )}
                <div>
                  <h2 className="text-xl font-extrabold tracking-tight text-gray-900 uppercase">
                    {settings.company_name || 'REUTILIZANET'}
                  </h2>
                  {settings.nit && (
                    <p className="text-xs font-semibold text-gray-700">NIT: {settings.nit}</p>
                  )}
                  {settings.address && (
                    <p className="text-xs text-gray-600">{settings.address}</p>
                  )}
                  {settings.phone && (
                    <p className="text-xs text-gray-600">Tel / WhatsApp: {settings.phone}</p>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="inline-block bg-gray-900 text-white text-xs font-bold px-2.5 py-1 rounded uppercase">
                  Nota de Venta
                </span>
                <p className="text-xs text-gray-600 mt-1 font-mono">
                  N° {selectedReceipt.id.slice(0, 8).toUpperCase()}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(selectedReceipt.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Datos del Cliente y Pago */}
            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-2.5 rounded text-xs mb-3 border border-gray-200">
              <div>
                <p className="text-gray-500 uppercase font-semibold">Cliente:</p>
                <p className="text-gray-900 font-bold text-sm mt-0.5">{selectedReceipt.customer}</p>
              </div>
              <div className="text-right">
                <p className="text-gray-500 uppercase font-semibold">Condición / Pago:</p>
                <p className="text-gray-900 font-bold text-sm mt-0.5">{selectedReceipt.payment_method}</p>
              </div>
            </div>

            {/* Detalle del Equipo */}
            <table className="w-full text-left border-collapse mb-3 text-sm">
              <thead>
                <tr className="border-b border-gray-300 text-xs uppercase text-gray-600">
                  <th className="py-1.5">Cant.</th>
                  <th className="py-1.5">Descripción</th>
                  <th className="py-1.5 text-right">P. Unit.</th>
                  <th className="py-1.5 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="py-2 font-semibold">{selectedReceipt.quantity}</td>
                  <td className="py-2 font-medium text-gray-800">{selectedReceipt.product_name}</td>
                  <td className="py-2 text-right">
                    {cur} {(Number(selectedReceipt.total_amount) / Number(selectedReceipt.quantity)).toFixed(2)}
                  </td>
                  <td className="py-2 text-right font-bold">
                    {cur} {Number(selectedReceipt.total_amount).toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Total */}
            <div className="flex justify-end border-t-2 border-gray-800 pt-2 mb-3">
              <div className="text-right">
                <span className="text-xs uppercase text-gray-600 font-semibold mr-3">Total a Pagar / Pagado:</span>
                <span className="text-xl font-extrabold text-gray-900">
                  {cur} {Number(selectedReceipt.total_amount).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Sección de Pago por QR Bancario desde Configuración */}
            <div className="flex items-center gap-4 bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
              <div className="bg-white p-1.5 rounded border border-gray-300 shrink-0">
                {settings.qr_image_url ? (
                  <img
                    src={settings.qr_image_url}
                    alt="QR Pago Bancario"
                    className="w-24 h-24 object-contain"
                  />
                ) : (
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
                      `${settings.company_name} | Nota: ${selectedReceipt.id.slice(0, 8).toUpperCase()} | Monto: ${cur} ${Number(selectedReceipt.total_amount).toFixed(2)} | Cuenta: ${settings.account_number}`
                    )}`}
                    alt="QR Referencia"
                    className="w-24 h-24 object-contain"
                  />
                )}
              </div>
              <div className="text-xs text-gray-700 space-y-1">
                <p className="font-bold text-blue-900 uppercase">Paga o cancela saldo vía QR Simple / Transferencia</p>
                {settings.bank_name && <p><span className="font-semibold">Banco:</span> {settings.bank_name}</p>}
                {settings.account_holder && <p><span className="font-semibold">Titular:</span> {settings.account_holder}</p>}
                {settings.account_number && (
                  <p>
                    <span className="font-semibold">Cuenta:</span> {settings.account_number}{' '}
                    {settings.account_type ? `(${settings.account_type})` : ''}
                  </p>
                )}
                <p className="text-blue-800 font-semibold">
                  Ref. Nota N° {selectedReceipt.id.slice(0, 8).toUpperCase()} — Monto: {cur} {Number(selectedReceipt.total_amount).toFixed(2)}
                </p>
              </div>
            </div>

            {/* Cláusula de Garantía */}
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-700 uppercase mb-1">Condiciones de Garantía / Observaciones:</p>
              <textarea
                rows={2}
                value={warrantyNotes}
                onChange={e => setWarrantyNotes(e.target.value)}
                className="w-full text-xs text-gray-600 border border-gray-300 rounded p-1.5 focus:outline-none focus:ring-1 focus:ring-gray-500"
              />
            </div>

            {/* Firmas */}
            <div className="grid grid-cols-2 gap-8 pt-4 text-center text-xs text-gray-600">
              <div className="border-t border-gray-400 pt-1">Entregado por ({settings.company_name})</div>
              <div className="border-t border-gray-400 pt-1">Recibí Conforme (Cliente)</div>
            </div>

            {/* Botones de Acción */}
            <div className="mt-4 flex justify-end gap-3 no-print border-t pt-3">
              <button
                onClick={() => setSelectedReceipt(null)}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded text-sm hover:bg-gray-300 font-medium"
              >
                Cerrar
              </button>
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 font-semibold"
              >
                Imprimir / Guardar PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
