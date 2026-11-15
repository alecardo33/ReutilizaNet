import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface CompanySettings {
  id: number
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
  initial_capital?: number
}

export default function Settings() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const [form, setForm] = useState<CompanySettings>({
    id: 1,
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
    initial_capital: 0
  })

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('company_settings')
      .select('*')
      .eq('id', 1)
      .single()

    if (!error && data) {
      setForm({
        ...form,
        ...data,
        initial_capital: Number(data.initial_capital) || 0
      })
    }
    setLoading(false)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setForm(prev => ({
      ...prev,
      [name]: name === 'initial_capital' ? Number(value) : value
    }))
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'logo_url' | 'qr_image_url') => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      setForm(prev => ({ ...prev, [field]: reader.result as string }))
    }
    reader.readAsDataURL(file)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    const payload = {
      id: 1,
      company_name: form.company_name,
      nit: form.nit,
      address: form.address,
      phone: form.phone,
      currency: form.currency,
      logo_url: form.logo_url,
      bank_name: form.bank_name,
      account_holder: form.account_holder,
      account_number: form.account_number,
      account_type: form.account_type,
      qr_image_url: form.qr_image_url,
      warranty_notes: form.warranty_notes,
      initial_capital: Number(form.initial_capital) || 0
    }

    const { error } = await supabase
      .from('company_settings')
      .upsert(payload, { onConflict: 'id' })

    if (error) {
      // Respaldo si aún no agregaron la columna initial_capital en Supabase
      if (error.message.includes('initial_capital') || error.message.includes('column')) {
        const { initial_capital, ...fallbackPayload } = payload
        const retry = await supabase
          .from('company_settings')
          .upsert(fallbackPayload, { onConflict: 'id' })
        if (retry.error) {
          alert('Error al guardar configuración: ' + retry.error.message)
        } else {
          setMessage('Datos guardados (Nota: ejecuta el SQL de capital inicial en Supabase para activar el campo Capital Inicial).')
        }
      } else {
        alert('Error al guardar configuración: ' + error.message)
      }
    } else {
      setMessage('Configuración y Capital Inicial guardados correctamente.')
    }
    setSaving(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-lg shadow mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Configuración General y Capital</h1>
            <p className="text-sm text-gray-500">Identidad de empresa, moneda, capital inicial, QR bancario y garantías</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => navigate('/')} className="bg-gray-600 text-white px-4 py-2 rounded text-sm hover:bg-gray-700">
              Inicio
            </button>
            <button onClick={() => navigate('/inventory')} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
              Inventario
            </button>
            <button onClick={() => navigate('/cashbox')} className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700">
              Caja
            </button>
            <button onClick={() => navigate('/reports')} className="bg-purple-600 text-white px-4 py-2 rounded text-sm hover:bg-purple-700">
              Reportes
            </button>
            <button onClick={() => navigate('/admin/users')} className="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700">
              Usuarios
            </button>
            <button onClick={handleLogout} className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700">
              Cerrar Sesión
            </button>
          </div>
        </div>

        {loading ? (
          <div className="bg-white p-6 rounded-lg shadow text-gray-500 text-sm">Cargando configuración...</div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {message && (
              <div className="bg-green-50 border border-green-300 text-green-800 px-4 py-3 rounded-lg text-sm font-medium">
                {message}
              </div>
            )}

            {/* Tarjeta de Capital Inicial del Negocio */}
            <div className="bg-white p-6 rounded-lg shadow border-l-4 border-emerald-600">
              <h2 className="text-lg font-bold text-gray-800 mb-1">Capital Inicial de Operaciones</h2>
              <p className="text-xs text-gray-500 mb-4">
                Define el fondo de capital inicial de tu negocio. Cada compra de equipos, repuestos o periféricos registrada en Inventario se descontará automáticamente de este fondo, y tus ventas cobradas lo incrementarán.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Monto de Capital Inicial ({form.currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="initial_capital"
                    value={form.initial_capital ?? 0}
                    onChange={handleChange}
                    className="w-full border border-emerald-400 bg-emerald-50/40 p-2.5 rounded text-lg font-bold text-emerald-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Moneda del Sistema</label>
                  <select
                    name="currency"
                    value={form.currency}
                    onChange={handleChange}
                    className="w-full border border-gray-300 p-2.5 rounded text-sm bg-white"
                  >
                    <option value="Bs.">Bolivianos (Bs.)</option>
                    <option value="$us">Dólares ($us)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Datos de la Empresa */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Datos de la Empresa</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Comercial</label>
                  <input
                    type="text"
                    name="company_name"
                    value={form.company_name}
                    onChange={handleChange}
                    required
                    className="w-full border border-gray-300 p-2 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">NIT / Identificación Tributaria</label>
                  <input
                    type="text"
                    name="nit"
                    value={form.nit}
                    onChange={handleChange}
                    placeholder="Ej: 1234567019"
                    className="w-full border border-gray-300 p-2 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dirección / Ciudad</label>
                  <input
                    type="text"
                    name="address"
                    value={form.address}
                    onChange={handleChange}
                    className="w-full border border-gray-300 p-2 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono / WhatsApp</label>
                  <input
                    type="text"
                    name="phone"
                    value={form.phone}
                    onChange={handleChange}
                    placeholder="Ej: +591 70000000"
                    className="w-full border border-gray-300 p-2 rounded text-sm"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Logotipo de la Empresa (Subir imagen o pegar URL)</label>
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => handleFileUpload(e, 'logo_url')}
                      className="text-xs text-gray-600"
                    />
                    <input
                      type="text"
                      name="logo_url"
                      value={form.logo_url}
                      onChange={handleChange}
                      placeholder="https://..."
                      className="flex-1 border border-gray-300 p-2 rounded text-sm"
                    />
                    {form.logo_url && (
                      <img src={form.logo_url} alt="Vista previa logo" className="w-12 h-12 object-contain border rounded p-1" />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Datos Bancarios y QR */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Cobros por Transferencia y QR Simple</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Banco</label>
                  <input
                    type="text"
                    name="bank_name"
                    value={form.bank_name}
                    onChange={handleChange}
                    placeholder="Ej: Banco Unión / BNB / Mercantil"
                    className="w-full border border-gray-300 p-2 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Titular de la Cuenta</label>
                  <input
                    type="text"
                    name="account_holder"
                    value={form.account_holder}
                    onChange={handleChange}
                    className="w-full border border-gray-300 p-2 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número de Cuenta</label>
                  <input
                    type="text"
                    name="account_number"
                    value={form.account_number}
                    onChange={handleChange}
                    className="w-full border border-gray-300 p-2 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Cuenta</label>
                  <select
                    name="account_type"
                    value={form.account_type}
                    onChange={handleChange}
                    className="w-full border border-gray-300 p-2 rounded text-sm bg-white"
                  >
                    <option value="Caja de Ahorro">Caja de Ahorro</option>
                    <option value="Cuenta Corriente">Cuenta Corriente</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Imagen QR Bancario Propio (Opcional)</label>
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => handleFileUpload(e, 'qr_image_url')}
                      className="text-xs text-gray-600"
                    />
                    <input
                      type="text"
                      name="qr_image_url"
                      value={form.qr_image_url}
                      onChange={handleChange}
                      placeholder="URL de imagen QR..."
                      className="flex-1 border border-gray-300 p-2 rounded text-sm"
                    />
                    {form.qr_image_url && (
                      <img src={form.qr_image_url} alt="Vista previa QR" className="w-16 h-16 object-contain border rounded p-1" />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Garantías */}
            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-bold text-gray-800 mb-2">Cláusula de Garantía Predeterminada</h2>
              <textarea
                name="warranty_notes"
                rows={3}
                value={form.warranty_notes}
                onChange={handleChange}
                className="w-full border border-gray-300 p-2 rounded text-sm"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 text-white font-semibold px-6 py-2.5 rounded-lg hover:bg-blue-700 shadow transition"
              >
                {saving ? 'Guardando...' : 'Guardar Toda la Configuración'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
