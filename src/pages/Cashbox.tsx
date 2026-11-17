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

export default function Cashbox() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [amountPaid, setAmountPaid] = useState('');
  const [clientName, setClientName] = useState('');
  const [loading, setLoading] = useState(false);

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
  const numericAmountPaid = Number(amountPaid) || 0;
  const changeAmount = Math.max(0, numericAmountPaid - totalAmount);

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
      // Insertar la venta en Supabase sin incluir campos que no existan en el esquema
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert([
          {
            total: totalAmount,
            amount_paid: numericAmountPaid,
            change_amount: changeAmount,
            payment_method: paymentMethod,
            client_name: clientName.trim() || 'Cliente General',
            created_at: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (saleError) throw saleError;

      // Éxito: Limpiamos el carrito y reseteamos el formulario
      setCart([]);
      setAmountPaid('');
      setClientName('');
      alert('¡Venta procesada con éxito!');
      fetchProducts();

    } catch (err: any) {
      // El carrito NO se borra si hay un error, permitiendo corregir o reintentar
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
        <h2 className="text-xl font-bold mb-4">Catálogo de Productos</h2>
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
    </div>
  );
}
