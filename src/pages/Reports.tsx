import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Reports() {
  const navigate = useNavigate();
  const [sales, setSales] = useState<any[]>([]);
  const [cashMovements, setCashMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      // Carga segura desde localStorage con respaldo de array vacío
      const savedSales = JSON.parse(localStorage.getItem('reutilizanet_sales') || '[]');
      const savedCash = JSON.parse(localStorage.getItem('reutilizanet_cash') || '[]');
      
      setSales(Array.isArray(savedSales) ? savedSales : []);
      setCashMovements(Array.isArray(savedCash) ? savedCash : []);
    } catch (error) {
      console.error('Error al cargar datos de reportes:', error);
      setSales([]);
      setCashMovements([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Función auxiliar súper segura para evitar errores de .replace() o tipos nulos
  const formatMoney = (value: any) => {
    const num = Number(value);
    return isNaN(num) ? '0.00' : num.toFixed(2);
  };

  // Cálculos seguros
  const totalSalesAmount = sales.reduce((acc, item) => acc + (Number(item?.total) || 0), 0);

  return (
    <div className="min-h-screen bg-gray-100 p-6 font-sans">
      <div className="max-w-5xl mx-auto bg-white p-6 rounded-lg shadow">
        
        {/* Cabecera del Módulo */}
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">📊 Panel de Reportes — ReutilizaNet</h1>
            <p className="text-sm text-gray-500">Historial de ventas, márgenes y movimientos de caja</p>
          </div>
          <button 
            onClick={() => navigate('/')} 
            className="bg-gray-800 text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-900 transition"
          >
            Volver al Dashboard
          </button>
        </div>

        {loading ? (
          <p className="text-center py-8 text-gray-500">Cargando reportes...</p>
        ) : (
          <div className="space-y-6">
            {/* Tarjetas de Resumen */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded shadow-sm">
                <h3 className="text-sm font-semibold text-blue-800 uppercase">Total Ventas Registradas</h3>
                <p className="text-2xl font-bold text-blue-900 mt-1">{sales.length} transacciones</p>
                <p className="text-sm text-blue-700 mt-1">Monto acumulado: Bs. {formatMoney(totalSalesAmount)}</p>
              </div>

              <div className="bg-green-50 border-l-4 border-green-600 p-4 rounded shadow-sm">
                <h3 className="text-sm font-semibold text-green-800 uppercase">Movimientos de Caja</h3>
                <p className="text-2xl font-bold text-green-900 mt-1">{cashMovements.length} registros</p>
                <p className="text-sm text-green-700 mt-1">Sincronizado con módulo de caja</p>
              </div>
            </div>

            {/* Tabla de últimas ventas */}
            <div className="mt-6">
              <h3 className="text-lg font-bold text-gray-800 mb-3">Historial Reciente de Ventas</h3>
              {sales.length === 0 ? (
                <div className="bg-gray-50 p-6 rounded text-center text-gray-500 border">
                  No hay ventas registradas todavía para mostrar en el reporte.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 border">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cliente / Detalle</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total (Bs)</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {sales.slice(-10).reverse().map((sale, index) => {
                        // Limpieza segura de textos por si vienen con null o undefined
                        const saleDate = typeof sale?.date === 'string' ? sale.date : (sale?.date ? String(sale.date) : 'Fecha no registrada');
                        const saleClient = typeof sale?.client === 'string' ? sale.client : (sale?.description || 'Venta general');
                        const saleTotal = formatMoney(sale?.total);

                        return (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-sm text-gray-600">{saleDate}</td>
                            <td className="px-4 py-2 text-sm text-gray-800">{saleClient}</td>
                            <td className="px-4 py-2 text-sm text-right font-semibold text-gray-900">
                              Bs. {saleTotal}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Botones de acción rápida */}
            <div className="flex gap-3 pt-4 border-t">
              <button 
                onClick={() => navigate('/cashbox')} 
                className="bg-emerald-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-emerald-700 transition"
              >
                Ir a Caja
              </button>
              <button 
                onClick={() => navigate('/inventory')} 
                className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 transition"
              >
                Ir a Inventario
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}