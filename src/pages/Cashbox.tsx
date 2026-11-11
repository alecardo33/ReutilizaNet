import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

interface Transaction {
  id: string
  type: 'purchase' | 'sale' | 'expense'
  description: string
  amount: number
  category: string
  note?: string
  receipt_url?: string
  created_at: string
}

export default function Cashbox() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  // Campos del formulario
  const [type, setType] = useState<'purchase' | 'sale' | 'expense'>('expense')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState(0)
  const [category, setCategory] = useState('')
  const [note, setNote] = useState('')
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    fetchTransactions()
  }, [])

  async function fetchTransactions() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      if (data) setTransactions(data)
    } catch (error) {
      console.error('Error al cargar transacciones:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault()
    setUploading(true)

    try {
      let receiptUrl = null

      // Si se seleccionó un archivo de comprobante, se sube a Supabase Storage
      if (receiptFile) {
        const fileExt = receiptFile.name.split('.').pop()
        const fileName = `${Date.now()}.${fileExt}`
        const filePath = `${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('store-assets')
          .upload(filePath, receiptFile)

        if (uploadError) throw uploadError

        const { data: publicURLData } = supabase.storage
          .from('store-assets')
          .getPublicUrl(filePath)

        receiptUrl = publicURLData.publicUrl
      }

      // Obtener usuario actual
      const { data: { user } } = await supabase.auth.getUser()

      // Insertar transacción en la base de datos
      const { error: insertError } = await supabase
        .from('transactions')
        .insert([{
          type,
          description,
          amount,
          category,
          note,
          receipt_url: receiptUrl,
          user_id: user?.id
        }])

      if (insertError) throw insertError

      // Limpiar y recargar
      setShowModal(false)
      setType('expense')
      setDescription('')
      setAmount(0)
      setCategory('')
      setNote('')
      setReceiptFile(null)
      fetchTransactions()
    } catch (error: any) {
      alert(`Error al registrar la transacción: ${error.message}`)
    } finally {
      setUploading(false)
    }
  }

  if (loading) return <div className="p-6">Cargando módulo de caja...</div>

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Módulo de Caja y Transacciones</h1>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + Registrar Movimiento
        </button>
      </div>

      {/* Tabla de Movimientos */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descripción / Categoría</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nota / Glosa</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Monto</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Comprobante</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {transactions.map((tx) => {
              const isIncome = tx.type === 'sale'
              return (
                <tr key={tx.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(tx.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      tx.type === 'sale' ? 'bg-green-100 text-green-800' :
                      tx.type === 'purchase' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {tx.type === 'sale' ? 'Venta' : tx.type === 'purchase' ? 'Compra' : 'Gasto'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {tx.description} <br />
                    <span className="text-xs text-gray-400 font-normal">{tx.category}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                    {tx.note || '-'}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-bold ${
                    isIncome ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {isIncome ? '+' : '-'}${tx.amount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                    {tx.receipt_url ? (
                      <a href={tx.receipt_url} target="_blank" rel="noreferrer" className="text-blue-600 underline hover:text-blue-800">
                        Ver
                      </a>
                    ) : (
                      <span className="text-gray-400">N/D</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal para Nueva Transacción */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">Registrar Movimiento de Caja</h2>
            <form onSubmit={handleCreateTransaction} className="space-y-4">
              <div>
                <label className="block text-sm font-medium">Tipo de Movimiento</label>
                <select 
                  value={type} 
                  onChange={e => setType(e.target.value as any)} 
                  className="w-full border p-2 rounded"
                >
                  <option value="expense">Gasto Operativo (Alquiler, Sueldos, etc.)</option>
                  <option value="purchase">Compra de Ítems / Insumos</option>
                  <option value="sale">Venta de Equipo / Producto</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium">Descripción</label>
                <input 
                  type="text" 
                  value={description} 
                  onChange={e => setDescription(e.target.value)} 
                  required 
                  placeholder="Ej: Pago de alquiler del local"
                  className="w-full border p-2 rounded" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium">Monto ($)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={amount} 
                    onChange={e => setAmount(parseFloat(e.target.value) || 0)} 
                    required 
                    className="w-full border p-2 rounded" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Categoría</label>
                  <input 
                    type="text" 
                    value={category} 
                    onChange={e => setCategory(e.target.value)} 
                    placeholder="Ej: Alquiler, Salarios, Insumos"
                    className="w-full border p-2 rounded" 
                  />
                </div>
              </div>

              {/* Campo Nota / Glosa solicitado */}
              <div>
                <label className="block text-sm font-medium">Nota / Glosa de Referencia</label>
                <textarea 
                  value={note} 
                  onChange={e => setNote(e.target.value)} 
                  placeholder="Detalles adicionales, número de factura o referencia..."
                  className="w-full border p-2 rounded"
                  rows={2}
                />
              </div>

              {/* Subida de Comprobante */}
              <div>
                <label className="block text-sm font-medium">Adjuntar Comprobante (Imagen o PDF)</label>
                <input 
                  type="file" 
                  accept="image/*,application/pdf"
                  onChange={e => setReceiptFile(e.target.files?.[0] || null)}
                  className="w-full border p-1 rounded text-sm text-gray-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-100"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={uploading}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  {uploading ? 'Guardando...' : 'Guardar Transacción'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
