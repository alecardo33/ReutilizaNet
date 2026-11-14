import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Settings() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const [companyName, setCompanyName] = useState('REUTILIZANET')
  const [nit, setNit] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [currency, setCurrency] = useState('Bs.')
  const [logoUrl, setLogoUrl] = useState('')
  const [bankName, setBankName] = useState('')
  const [accountHolder, setAccountHolder] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [accountType, setAccountType] = useState('Caja de Ahorro - Bolivianos (Bs.)')
  const [qrImageUrl, setQrImageUrl] = useState('')
  const [warrantyNotes, setWarrantyNotes] = useState('')

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
      setCompanyName(data.company_name || 'REUTILIZANET')
      setNit(data.nit || '')
      setAddress(data.address || '')
      setPhone(data.phone || '')
      setCurrency(data.currency || 'Bs.')
      setLogoUrl(data.logo_url || '')
      setBankName(data.bank_name || '')
      setAccountHolder(data.account_holder || '')
      setAccountNumber(data.account_number || '')
      setAccountType(data.account_type || 'Caja de Ahorro - Bolivianos (Bs.)')
      setQrImageUrl(data.qr_image_url || '')
      setWarrantyNotes(data.warranty_notes || '')
    }
    setLoading(false)
  }

  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<string>>
  ) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 1024 * 1024) {
      alert('La imagen es muy pesada. Por favor elige una imagen menor a 1 MB.')
      return
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setter(reader.result)
      }
    }
    reader.readAsDataURL(file)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    const { error } = await supabase
      .from('company_settings')
      .upsert({
        id: 1,
        company_name: companyName,
        nit,
        address,
        phone,
        currency,
        logo_url: logoUrl,
        bank_name: bankName,
        account_holder: accountHolder,
        account_number: accountNumber,
        account_type: accountType,
        qr_image_url: qrImageUrl,
        warranty_notes: warrantyNotes,
        updated_at: new Date().toISOString(),
      })

    if (error) {
      alert('Error al guardar configuración: ' + error.message)
    } else {
      setMessage('¡Configuración guardada correctamente! Ya se aplicará en tus notas de venta y reportes.')
    }
    setSaving(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-lg shadow mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Configuración de la Empresa</h1>
            <p className="text-sm text-gray-500">Datos fiscales, logotipo, moneda y cuenta bancaria para cobros por QR</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => navigate('/inventory')} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
              Inventario
            </button>
            <button onClick={() => navigate('/cashbox')} className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700">
              Caja
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
          <div className="bg-green-100 border border-green-400 text-green-800 px-4 py-3 rounded mb-6 text-sm font-medium">
            {message}
          </div>
        )}

        {loading ? (
          <div className="bg-white p-6 rounded-lg shadow text-sm text-gray-500">Cargando configuración...</div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {/* Datos Generales y Logo */}
            <div className="bg-white p-6 rounded-lg shadow space-y-4">
              <h2 className="text-lg font-bold text-gray-800 border-b pb-2">1. Identidad de la Empresa y Moneda</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la Empresa / Negocio</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                    required
                    className="w-full border border-gray-300 p-2 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">NIT / CI del Negocio</label>
                  <input
                    type="text"
                    value={nit}
                    onChange={e => setNit(e.target.value)}
                    placeholder="Ej: 4859632015"
                    className="w-full border border-gray-300 p-2 rounded text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dirección Física</label>
                  <input
                    type="text"
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    placeholder="Ej: Av. Arce N° 1234, Zona Central - La Paz"
                    className="w-full border border-gray-300 p-2 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Números de Contacto / WhatsApp</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="Ej: 71234567 - 22445566"
                    className="w-full border border-gray-300 p-2 rounded text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Moneda Principal del Sistema</label>
                  <select
                    value={currency}
                    onChange={e => setCurrency(e.target.value)}
                    className="w-full border border-gray-300 p-2 rounded text-sm bg-white"
                  >
                    <option value="Bs.">Bolivianos (Bs.)</option>
                    <option value="$us">Dólares Estadounidenses ($us)</option>
                    <option value="$">Pesos / Dólares ($)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Logotipo de la Empresa (PNG/JPG máx 1MB)</label>
                  <div className="flex items-center gap-4">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => handleImageUpload(e, setLogoUrl)}
                      className="text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    {logoUrl && (
                      <div className="relative">
                        <img src={logoUrl} alt="Logo" className="h-12 w-12 object-contain border rounded p-1 bg-gray-50" />
                        <button
                          type="button"
                          onClick={() => setLogoUrl('')}
                          className="text-[10px] text-red-600 block text-center hover:underline"
                        >
                          Quitar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Datos Bancarios y QR */}
            <div className="bg-white p-6 rounded-lg shadow space-y-4">
              <h2 className="text-lg font-bold text-gray-800 border-b pb-2">2. Cuenta Bancaria y Código QR para Cobros</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Banco</label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={e => setBankName(e.target.value)}
                    placeholder="Ej: Banco Nacional de Bolivia (BNB) / Banco Unión"
                    className="w-full border border-gray-300 p-2 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Titular de la Cuenta</label>
                  <input
                    type="text"
                    value={accountHolder}
                    onChange={e => setAccountHolder(e.target.value)}
                    placeholder="Ej: Juan Pérez / ReutilizaNet S.R.L."
                    className="w-full border border-gray-300 p-2 rounded text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número de Cuenta</label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={e => setAccountNumber(e.target.value)}
                    placeholder="Ej: 150-1234567"
                    className="w-full border border-gray-300 p-2 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Cuenta y Moneda</label>
                  <input
                    type="text"
                    value={accountType}
                    onChange={e => setAccountType(e.target.value)}
                    placeholder="Ej: Caja de Ahorro - Bolivianos (Bs.)"
                    className="w-full border border-gray-300 p-2 rounded text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Imagen del Código QR Bancario (Descargado de tu app bancaria)
                </label>
                <div className="flex flex-wrap items-center gap-4 mt-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => handleImageUpload(e, setQrImageUrl)}
                    className="text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                  />
                  {qrImageUrl && (
                    <div className="flex items-center gap-3 bg-gray-50 p-2 rounded border">
                      <img src={qrImageUrl} alt="QR Banco" className="h-24 w-24 object-contain bg-white border p-1" />
                      <button
                        type="button"
                        onClick={() => setQrImageUrl('')}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Eliminar QR
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Condiciones por defecto de Garantía */}
            <div className="bg-white p-6 rounded-lg shadow space-y-3">
              <h2 className="text-lg font-bold text-gray-800 border-b pb-2">3. Texto de Garantía por Defecto en Notas de Venta</h2>
              <textarea
                rows={2}
                value={warrantyNotes}
                onChange={e => setWarrantyNotes(e.target.value)}
                className="w-full border border-gray-300 p-2 rounded text-sm"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 text-white font-semibold px-6 py-2.5 rounded hover:bg-blue-700 transition shadow"
              >
                {saving ? 'Guardando cambios...' : 'Guardar Toda la Configuración'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
