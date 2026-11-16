import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
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
  const [exporting, setExporting] = useState(false)
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

  const getSalePaidAmount = (sale: any): number => {
    if (typeof sale.amount_paid === 'number' && !isNaN(sale.amount_paid)) {
      return Number(sale.amount_paid)
    }
    const match = sale.payment_method?.match(/Pagado:\s*([0-9]+(?:\.[0-9]+)?)/i)
    if (match) return Number(match[1])
    if (sale.payment_method?.toLowerCase().includes('crédito') || sale.payment_method?.toLowerCase().includes('credito')) {
      return 0
    }
    return Number(sale.total_amount) || 0
  }

  const getPurchasePaidAmount = (p: any): number => {
    if (typeof p.amount_paid === 'number' && !isNaN(p.amount_paid)) {
      return Number(p.amount_paid)
    }
    const match = p.supplier?.match(/Pagado:\s*([0-9]+(?:\.[0-9]+)?)/i)
    if (match) return Number(match[1])
    if (p.payment_status === 'Pendiente' || p.supplier?.toLowerCase().includes('[crédito')) {
      return 0
    }
    return Number(p.total_cost) || 0
  }

  const cleanSupplierName = (supplierStr?: string): string => {
    if (!supplierStr) return 'Proveedor General'
    return supplierStr.replace(/\s*\[Crédito[^\]]*\]/i, '').trim() || 'Proveedor General'
  }

  const extractSerial = (sale: any): string => {
    if (sale.serial_number && sale.serial_number.trim() !== '') {
      return sale.serial_number.trim()
    }
    const match = sale.product_name?.match(/\[S\/N:\s*([^\]]+)\]/i)
    return match ? match[1].trim() : ''
  }

  const cleanProductName = (name: string): string => {
    return (name || '').replace(/\s*\[S\/N:\s*[^\]]+\]/i, '').trim()
  }

  const handleExportFullExcelBackup = async () => {
    setExporting(true)
    setMessage('')

    try {
      const [invRes, salesRes, purchasesRes, expensesRes, profilesRes, settingsRes] = await Promise.all([
        supabase.from('inventory').select('*').order('created_at', { ascending: false }),
        supabase.from('sales').select('*').order('created_at', { ascending: false }),
        supabase.from('purchases').select('*').order('created_at', { ascending: false }),
        supabase.from('expenses').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('*').order('email', { ascending: true }),
        supabase.from('company_settings').select('*').eq('id', 1).single()
      ])

      const invData = invRes.data || []
      const salesData = salesRes.data || []
      const purchasesData = purchasesRes.data || []
      const expensesData = expensesRes.data || []
      const profilesData = profilesRes.data || []
      const cfg = settingsRes.data || form

      const cur = cfg.currency || 'Bs.'
      const capInicial = Number(cfg.initial_capital) || 0
      const totalComprasRegistradas = purchasesData.reduce((s, p) => s + Number(p.total_cost || 0), 0)
      const totalComprasPagadas = purchasesData.reduce((s, p) => s + getPurchasePaidAmount(p), 0)
      const totalCuentasPorPagar = Math.max(0, totalComprasRegistradas - totalComprasPagadas)

      const totalFacturado = salesData.reduce((s, v) => s + Number(v.total_amount || 0), 0)
      const totalCobrado = salesData.reduce((s, v) => s + getSalePaidAmount(v), 0)
      const totalPorCobrar = Math.max(0, totalFacturado - totalCobrado)
      const totalCostoVendido = salesData.reduce((s, v) => s + (Number(v.unit_cost || 0) * Number(v.quantity || 0)), 0)
      const margenBrutoVentas = totalFacturado - totalCostoVendido

      const totalGastosOperativos = expensesData.reduce((s, g) => s + Number(g.amount || 0), 0)
      const utilidadNetaReal = margenBrutoVentas - totalGastosOperativos

      const valorStock = invData.reduce((s, i) => s + (Number(i.cost || 0) * Number(i.stock || 0)), 0)
      const liquidezCaja = capInicial - totalComprasPagadas + totalCobrado - totalGastosOperativos

      const wb = XLSX.utils.book_new()

      // Hoja 1: Resumen Gerencial y Configuración
      const summaryRows = [
        { Concepto: 'Empresa', Valor: cfg.company_name || 'REUTILIZANET' },
        { Concepto: 'NIT', Valor: cfg.nit || '' },
        { Concepto: 'Dirección', Valor: cfg.address || '' },
        { Concepto: 'Teléfono', Valor: cfg.phone || '' },
        { Concepto: 'Fecha y Hora de Respaldo', Valor: new Date().toLocaleString() },
        { Concepto: 'Moneda', Valor: cur },
        { Concepto: `Capital Inicial (${cur})`, Valor: capInicial },
        { Concepto: `Total Compras Pagadas (${cur})`, Valor: totalComprasPagadas },
        { Concepto: `Cuentas por Pagar Proveedores (${cur})`, Valor: totalCuentasPorPagar },
        { Concepto: `Saldo Remanente de Capital (${cur})`, Valor: capInicial - totalComprasPagadas },
        { Concepto: `Total Facturado en Ventas (${cur})`, Valor: totalFacturado },
        { Concepto: `Efectivo Real Cobrado en Ventas (${cur})`, Valor: totalCobrado },
        { Concepto: `Cuentas por Cobrar Clientes (${cur})`, Valor: totalPorCobrar },
        { Concepto: `Costo Base de Equipos Vendidos (${cur})`, Valor: totalCostoVendido },
        { Concepto: `Margen Bruto de Ventas (${cur})`, Valor: margenBrutoVentas },
        { Concepto: `Gastos Operativos y Salarios (${cur})`, Valor: totalGastosOperativos },
        { Concepto: `Utilidad Neta Real (${cur})`, Valor: utilidadNetaReal },
        { Concepto: `Liquidez Real Disponible en Caja (${cur})`, Valor: liquidezCaja },
        { Concepto: `Valorización de Stock Actual (${cur})`, Valor: valorStock },
        { Concepto: 'Banco', Valor: cfg.bank_name || '' },
        { Concepto: 'Titular Cuenta', Valor: cfg.account_holder || '' },
        { Concepto: 'Número de Cuenta', Valor: cfg.account_number || '' },
        { Concepto: 'Cláusula de Garantía', Valor: cfg.warranty_notes || '' }
      ]
      const wsSummary = XLSX.utils.json_to_sheet(summaryRows)
      wsSummary['!cols'] = [{ wch: 42 }, { wch: 45 }]
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen_y_Config')

      // Hoja 2: Inventario Actual
      const inventoryRows = invData.map(item => ({
        ID: item.id,
        Equipo_o_Pieza: item.name,
        Categoria: item.category,
        Estado_Condicion: item.condition,
        Costo_Unitario: Number(item.cost || 0),
        Precio_Venta: Number(item.price || 0),
        Stock_Actual: Number(item.stock || 0),
        Valorizacion_Costo: Number((Number(item.cost || 0) * Number(item.stock || 0)).toFixed(2)),
        Fecha_Registro: item.created_at ? new Date(item.created_at).toLocaleString() : ''
      }))
      const wsInventory = XLSX.utils.json_to_sheet(
        inventoryRows.length > 0 ? inventoryRows : [{ Mensaje: 'Sin registros en inventario' }]
      )
      wsInventory['!cols'] = [
        { wch: 36 }, { wch: 34 }, { wch: 18 }, { wch: 24 },
        { wch: 15 }, { wch: 15 }, { wch: 14 }, { wch: 18 }, { wch: 22 }
      ]
      XLSX.utils.book_append_sheet(wb, wsInventory, 'Inventario')

      // Hoja 3: Ventas y Créditos
      const salesRows = salesData.map(sale => {
        const total = Number(sale.total_amount || 0)
        const paid = getSalePaidAmount(sale)
        const pending = Math.max(0, Number((total - paid).toFixed(2)))
        const costTotal = Number(sale.unit_cost || 0) * Number(sale.quantity || 0)
        return {
          ID_Venta: sale.id,
          Fecha: sale.created_at ? new Date(sale.created_at).toLocaleString() : '',
          Producto_Servicio: cleanProductName(sale.product_name),
          Numero_Serie: extractSerial(sale),
          Cliente: sale.customer || 'Cliente Mostrador',
          Cantidad: Number(sale.quantity || 0),
          Total_Venta: total,
          Monto_Cobrado: paid,
          Saldo_Pendiente: pending,
          Estado_Pago: pending > 0.009 ? 'Pendiente' : 'Pagado',
          Detalle_Metodo_Pago: sale.payment_method || '',
          Costo_Base_Total: Number(costTotal.toFixed(2)),
          Margen_Venta: Number((total - costTotal).toFixed(2))
        }
      })
      const wsSales = XLSX.utils.json_to_sheet(
        salesRows.length > 0 ? salesRows : [{ Mensaje: 'Sin ventas registradas' }]
      )
      wsSales['!cols'] = [
        { wch: 36 }, { wch: 22 }, { wch: 32 }, { wch: 18 }, { wch: 24 },
        { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 15 }, { wch: 14 },
        { wch: 34 }, { wch: 16 }, { wch: 14 }
      ]
      XLSX.utils.book_append_sheet(wb, wsSales, 'Ventas_y_Creditos')

      // Hoja 4: Compras de Equipos y Periféricos (Contado y Crédito)
      const purchaseRows = purchasesData.map(p => {
        const total = Number(p.total_cost || 0)
        const paid = getPurchasePaidAmount(p)
        const debt = Math.max(0, Number((total - paid).toFixed(2)))
        return {
          ID_Compra: p.id,
          Fecha: p.created_at ? new Date(p.created_at).toLocaleString() : '',
          Equipo_Periferico: p.item_name,
          Categoria: p.category,
          Proveedor: cleanSupplierName(p.supplier),
          Cantidad: Number(p.quantity || 0),
          Costo_Unitario: Number(p.unit_cost || 0),
          Total_Compra: total,
          Pagado_Capital: paid,
          Saldo_Deuda: debt,
          Estado: debt > 0.009 ? 'Crédito Pendiente' : 'Pagado'
        }
      })
      const wsPurchases = XLSX.utils.json_to_sheet(
        purchaseRows.length > 0 ? purchaseRows : [{ Mensaje: 'Sin compras registradas' }]
      )
      wsPurchases['!cols'] = [
        { wch: 36 }, { wch: 22 }, { wch: 32 }, { wch: 18 },
        { wch: 24 }, { wch: 10 }, { wch: 15 }, { wch: 15 },
        { wch: 15 }, { wch: 15 }, { wch: 18 }
      ]
      XLSX.utils.book_append_sheet(wb, wsPurchases, 'Compras')

      // Hoja 5: Gastos Operativos y Salarios
      const expenseRows = expensesData.map(exp => ({
        ID_Gasto: exp.id,
        Fecha_Hora: exp.created_at ? new Date(exp.created_at).toLocaleString() : '',
        Categoria: exp.category,
        Descripcion: exp.description,
        Observacion_Beneficiario: exp.notes || '',
        Metodo_Pago: exp.payment_method || 'Efectivo (Caja)',
        Monto: Number(exp.amount || 0)
      }))
      const wsExpenses = XLSX.utils.json_to_sheet(
        expenseRows.length > 0 ? expenseRows : [{ Mensaje: 'Sin gastos operativos registrados' }]
      )
      wsExpenses['!cols'] = [
        { wch: 36 }, { wch: 22 }, { wch: 26 }, { wch: 34 },
        { wch: 30 }, { wch: 18 }, { wch: 15 }
      ]
      XLSX.utils.book_append_sheet(wb, wsExpenses, 'Gastos_y_Salarios')

      // Hoja 6: Kardex Consolidado (Entradas y Salidas)
      const rawKardex: any[] = []
      purchasesData.forEach(p => {
        rawKardex.push({
          rawDate: p.created_at,
          Tipo: 'ENTRADA (Compra)',
          Item: p.item_name,
          Detalle_Serie: `Proveedor: ${cleanSupplierName(p.supplier)}`,
          Entrada: Number(p.quantity || 0),
          Salida: 0,
          Monto: Number(p.total_cost || 0)
        })
      })
      salesData.forEach(s => {
        const sn = extractSerial(s)
        rawKardex.push({
          rawDate: s.created_at,
          Tipo: 'SALIDA (Venta)',
          Item: cleanProductName(s.product_name),
          Detalle_Serie: `Cliente: ${s.customer || 'Mostrador'}${sn ? ' | S/N: ' + sn : ''}`,
          Entrada: 0,
          Salida: Number(s.quantity || 0),
          Monto: Number(s.total_amount || 0)
        })
      })
      rawKardex.sort((a, b) => new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime())
      const balances: Record<string, number> = {}
      const kardexRows = rawKardex.map(k => {
        const key = (k.Item || '').toLowerCase()
        const nextBal = (balances[key] || 0) + k.Entrada - k.Salida
        balances[key] = nextBal
        return {
          Fecha_Hora: k.rawDate ? new Date(k.rawDate).toLocaleString() : '',
          Tipo_Movimiento: k.Tipo,
          Item_Equipo: k.Item,
          Detalle_y_Serie: k.Detalle_Serie,
          Entrada: k.Entrada,
          Salida: k.Salida,
          Saldo_Acumulado: nextBal,
          Monto_Operacion: k.Monto
        }
      })
      const wsKardex = XLSX.utils.json_to_sheet(
        kardexRows.length > 0 ? kardexRows : [{ Mensaje: 'Sin movimientos de Kardex' }]
      )
      wsKardex['!cols'] = [
        { wch: 22 }, { wch: 18 }, { wch: 30 }, { wch: 36 },
        { wch: 10 }, { wch: 10 }, { wch: 16 }, { wch: 16 }
      ]
      XLSX.utils.book_append_sheet(wb, wsKardex, 'Kardex')

      // Hoja 7: Usuarios y Roles
      const userRows = profilesData.map(u => ({
        ID_Usuario: u.id,
        Nombre_Completo: u.full_name || '',
        Correo: u.email || '',
        Rol: u.role || ''
      }))
      const wsUsers = XLSX.utils.json_to_sheet(
        userRows.length > 0 ? userRows : [{ Mensaje: 'Sin usuarios registrados' }]
      )
      wsUsers['!cols'] = [{ wch: 36 }, { wch: 28 }, { wch: 30 }, { wch: 16 }]
      XLSX.utils.book_append_sheet(wb, wsUsers, 'Usuarios')

      const dateStr = new Date().toISOString().split('T')[0]
      const safeName = (cfg.company_name || 'ReutilizaNet').replace(/[^a-zA-Z0-9_-]/g, '_')
      XLSX.writeFile(wb, `Respaldo_${safeName}_${dateStr}.xlsx`)

      setMessage(`¡Respaldo completo generado y descargado (Respaldo_${safeName}_${dateStr}.xlsx)!`)
    } catch (err: any) {
      alert('Error al generar el respaldo en Excel: ' + err.message)
    } finally {
      setExporting(false)
    }
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
            <h1 className="text-2xl font-bold text-gray-800">Configuración General, Capital y Respaldos</h1>
            <p className="text-sm text-gray-500">Identidad de empresa, moneda, capital inicial, QR bancario y copia de seguridad en Excel</p>
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
          <div className="space-y-6">
            {message && (
              <div className="bg-green-50 border border-green-300 text-green-800 px-4 py-3 rounded-lg text-sm font-medium">
                {message}
              </div>
            )}

            {/* Tarjeta de Copia de Seguridad / Respaldo Completo en Excel */}
            <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-600 flex flex-wrap justify-between items-center gap-4">
              <div className="max-w-2xl">
                <h2 className="text-lg font-bold text-gray-800">Copia de Seguridad Completa (Excel .xlsx)</h2>
                <p className="text-xs text-gray-600 mt-1">
                  Descarga un archivo Excel con 7 pestañas organizadas: <span className="font-semibold">Resumen y Capital</span>,{' '}
                  <span className="font-semibold">Inventario</span>, <span className="font-semibold">Ventas y Créditos</span>,{' '}
                  <span className="font-semibold">Compras</span>, <span className="font-semibold">Gastos y Salarios</span>,{' '}
                  <span className="font-semibold">Kardex</span> y <span className="font-semibold">Usuarios</span>.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportFullExcelBackup}
                disabled={exporting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-3 rounded-lg text-sm shadow transition flex items-center gap-2 shrink-0 disabled:opacity-50"
              >
                <span>{exporting ? 'Generando Excel...' : 'Descargar Respaldo Completo (.xlsx)'}</span>
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
              {/* Tarjeta de Capital Inicial del Negocio */}
              <div className="bg-white p-6 rounded-lg shadow border-l-4 border-emerald-600">
                <h2 className="text-lg font-bold text-gray-800 mb-1">Capital Inicial de Operaciones</h2>
                <p className="text-xs text-gray-500 mb-4">
                  Define el fondo de capital inicial de tu negocio. Cada compra pagada se descontará de este fondo, mientras que las compras a crédito no lo afectarán hasta que registres el pago.
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
          </div>
        )}
      </div>
    </div>
  )
}
