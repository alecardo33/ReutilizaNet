import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
}

interface CartItem extends Product {
  quantity: number;
}

interface SaleReceipt {
  id: string;
  createdAt: string;
  clientName: string;
  paymentMethod: string;
  items: {
    id: string;
    name: string;
    quantity: number;
    price: number;
    subtotal: number;
  }[];
  total: number;
  amountPaid: number;
  changeAmount: number;
}

export default function Cashbox() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [amountPaid, setAmountPaid] = useState('');
  const [clientName, setClientName] = useState('');
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<SaleReceipt | null>(null);
  const [lastReceipt, setLastReceipt] = useState<SaleReceipt | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const { data, error } = await supabase.from('products').select('*');
    if (error) {
      console.error('Error fetching products:', error);
    } else if (data) {
      setProducts(data);
    }
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const numericAmountPaid =
    paymentMethod === 'efectivo'
      ? (Number(amountPaid) || 0)
      : (Number(amountPaid) || totalAmount);
  const changeAmount =
    paymentMethod === 'efectivo' ? Math.max(0, numericAmountPaid - totalAmount) : 0;

  const handleProcessSale = async () => {
    if (cart.length === 0) {
      alert('El carrito está vacío.');
      return;
    }

    if (paymentMethod === 'efectivo' && numericAmountPaid < totalAmount) {
      alert('El monto pagado es menor al total de la venta.');
      return;
    }

    setLoading(true);
    try {
      const snapshotItems = cart.map(item => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        price: Number(item.price) || 0,
        subtotal: (Number(item.price) || 0) * item.quantity
      }));
      const snapshotClient = clientName.trim() || 'Cliente General';
      const snapshotPayment = paymentMethod;
      const snapshotTotal = totalAmount;
      const snapshotPaid = numericAmountPaid;
      const snapshotChange = changeAmount;
      const nowIso = new Date().toISOString();

      const productSummary = snapshotItems
        .map(i => `${i.quantity}x ${i.name}`)
        .join(', ');

      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert([
          {
            product_name: productSummary,
            quantity: snapshotItems.reduce((acc, i) => acc + i.quantity, 0),
            total: snapshotTotal,
            total_amount: snapshotTotal,
            amount_paid: snapshotPaid,
            change_amount: snapshotChange,
            payment_method: snapshotPayment,
            client_name: snapshotClient,
            customer: snapshotClient,
            created_at: nowIso
          }
        ])
        .select()
        .single();

      if (saleError) throw saleError;

      const generatedReceipt: SaleReceipt = {
        id: saleData?.id ? String(saleData.id) : String(Date.now()),
        createdAt: saleData?.created_at || nowIso,
        clientName: snapshotClient,
        paymentMethod: snapshotPayment,
        items: snapshotItems,
        total: snapshotTotal,
        amountPaid: snapshotPaid,
        changeAmount: snapshotChange
      };

      setReceipt(generatedReceipt);
      setLastReceipt(generatedReceipt);

      setCart([]);
      setAmountPaid('');
      setClientName('');
      fetchProducts();

    } catch (err: any) {
      console.error('Error al procesar la venta:', err);
      alert(`Error al procesar la venta: ${err.message || 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Catálogo de Productos */}
      <div className="lg:col-span-2 bg-white p-4 rounded-xl shadow">
        <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
          <h2 className="text-xl font-bold">Catálogo de Productos</h2>
          {lastReceipt && (
            <button
              type="button"
              onClick={() => setReceipt(lastReceipt)}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
            >
              Ver / Imprimir Última Nota de Venta
            </button>
          )}
        </div>
        <input
          type="text"
          placeholder="Buscar producto..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full p-2 border rounded mb-4"
        />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto">
          {filteredProducts.map(product => (
            <div key={product.id} className="border p-4 rounded-lg flex flex-col justify-between">
              <div>
                <h3 className="font-semibold">{product.name}</h3>
                <p className="text-green-600 font-bold">Bs. {product.price.toFixed(2)}</p>
                <p className="text-xs text-gray-500">Stock: {product.stock}</p>
              </div>
              <button
                onClick={() => addToCart(product)}
                disabled={product.stock <= 0}
                className="mt-3 bg-indigo-600 text-white py-1 px-3 rounded hover:bg-indigo-700 disabled:bg-gray-300"
              >
                + Agregar
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Carrito y Cobro */}
      <div className="bg-white p-4 rounded-xl shadow flex flex-col justify-between">
        <div>
          <h2 className="text-xl font-bold mb-4">Carrito de Venta</h2>
          <div className="space-y-3 max-h-[250px] overflow-y-auto mb-4">
            {cart.length === 0 ? (
              <p className="text-gray-500 text-center py-6">El carrito está vacío</p>
            ) : (
              cart.map(item => (
                <div key={item.id} className="flex justify-between items-center border-b pb-2">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-gray-500">
                      {item.quantity} x Bs. {item.price.toFixed(2)}
                    </p>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    Eliminar
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
              className="w-full p-2 border rounded mt-1"
            >
              <option value="efectivo">Efectivo</option>
              <option value="qr">Pago QR</option>
              <option value="transferencia">Transferencia</option>
            </select>
          </div>
          {paymentMethod === 'efectivo' && (
            <div>
              <label className="text-sm font-medium">Monto Pagado (Bs.)</label>
              <input
                type="number"
                value={amountPaid}
                onChange={e => setAmountPaid(e.target.value)}
                placeholder="0.00"
                className="w-full p-2 border rounded mt-1"
              />
              <p className="text-sm text-gray-600 mt-1">
                Cambio / Vuelto: <span className="font-bold text-indigo-600">Bs. {changeAmount.toFixed(2)}</span>
              </p>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold pt-2 border-t">
            <span>Total:</span>
            <span className="text-green-600">Bs. {totalAmount.toFixed(2)}</span>
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

      {/* Modal Nota de Venta Automática al Completar Venta */}
      {receipt && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-gray-200">
            <style>{`
              @media print {
                body * { visibility: hidden; }
                #cashbox-sale-note, #cashbox-sale-note * { visibility: visible; }
                #cashbox-sale-note { position: absolute; left: 0; top: 0; width: 100%; padding: 16px; }
                .no-print-note { display: none !important; }
              }
            `}</style>

            <div id="cashbox-sale-note" className="space-y-4 text-gray-900">
              <div className="flex justify-between items-start border-b-2 border-gray-800 pb-3">
                <div>
                  <h2 className="text-lg font-extrabold uppercase">Nota de Venta</h2>
                  <p className="text-xs text-gray-500 font-mono">
                    Ref: #{String(receipt.id).slice(0, 8).toUpperCase()}
                  </p>
                </div>
                <div className="text-right text-xs text-gray-600">
                  <p>{new Date(receipt.createdAt).toLocaleString()}</p>
                  <p className="font-semibold uppercase mt-0.5">Pago: {receipt.paymentMethod}</p>
                </div>
              </div>

              <div className="text-xs bg-gray-50 p-2.5 rounded border">
                <span className="font-bold">Cliente:</span> {receipt.clientName}
              </div>

              <table className="w-full text-left border-collapse border border-gray-300 text-xs">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-300 font-bold">
                    <th className="p-2 border-r border-gray-300 text-center">Cant.</th>
                    <th className="p-2 border-r border-gray-300">Producto</th>
                    <th className="p-2 border-r border-gray-300 text-right">P. Unit.</th>
                    <th className="p-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-300">
                  {receipt.items.map((item, idx) => (
                    <tr key={`${item.id}-${idx}`}>
                      <td className="p-2 border-r border-gray-300 text-center font-bold">{item.quantity}</td>
                      <td className="p-2 border-r border-gray-300">{item.name}</td>
                      <td className="p-2 border-r border-gray-300 text-right">Bs. {item.price.toFixed(2)}</td>
                      <td className="p-2 text-right font-semibold">Bs. {item.subtotal.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-bold">
                    <td colSpan={3} className="p-2 border-r border-gray-300 text-right">Pagado:</td>
                    <td className="p-2 text-right text-emerald-700">Bs. {receipt.amountPaid.toFixed(2)}</td>
                  </tr>
                  {receipt.changeAmount > 0 && (
                    <tr className="bg-gray-50 font-bold">
                      <td colSpan={3} className="p-2 border-r border-gray-300 text-right">Cambio / Vuelto:</td>
                      <td className="p-2 text-right text-indigo-700">Bs. {receipt.changeAmount.toFixed(2)}</td>
                    </tr>
                  )}
                  <tr className="bg-gray-100 border-t-2 border-gray-800 font-extrabold text-sm">
                    <td colSpan={3} className="p-2 border-r border-gray-300 text-right uppercase">Total:</td>
                    <td className="p-2 text-right">Bs. {receipt.total.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="flex justify-end gap-2 mt-4 pt-3 border-t no-print-note">
              <button
                type="button"
                onClick={() => window.print()}
                className="bg-gray-900 hover:bg-black text-white px-4 py-2 rounded text-sm font-semibold"
              >
                Imprimir Nota
              </button>
              <button
                type="button"
                onClick={() => setReceipt(null)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-semibold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
