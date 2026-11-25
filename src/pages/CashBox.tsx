import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Product {
  id: string;
  name: string;
  price: number;
  cost: number;
  stock: number;
  sourceTable: 'inventory' | 'products';
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

interface CompanyConfig {
  companyName: string;
  nit: string;
  address: string;
  phone: string;
  logoUrl: string;
  qrUrl: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  warrantyNotes: string;
}

export default function CashBox() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [amountPaid, setAmountPaid] = useState('');
  const [clientName, setClientName] = useState('');
  const [loading, setLoading] = useState(false);
  const [successBanner, setSuccessBanner] = useState('');
  const [receipt, setReceipt] = useState<SaleReceipt | null>(null);
  const [lastReceipt, setLastReceipt] = useState<SaleReceipt | null>(null);
  const [totalIncome, setTotalIncome] = useState<number>(0);
  const [sessionIncome, setSessionIncome] = useState<number>(0);
  const [companyConfig, setCompanyConfig] = useState<CompanyConfig>({
    companyName: 'ReutilizaNet',
    nit: '',
    address: 'La Paz - Bolivia',
    phone: '',
    logoUrl: '',
    qrUrl: '',
    bankName: '',
    accountNumber: '',
    accountHolder: '',
    warrantyNotes: ''
  });

  useEffect(() => {
    fetchProducts();
    fetchSalesIncome();
    fetchCompanyConfig();
  }, []);

  const fetchCompanyConfig = async () => {
    const { data, error } = await supabase
      .from('company_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (!error && data) {
      const row: any = data;
      const qrCandidate =
        row.qr_url ||
        row.qr_image_url ||
        row.qr_code_url ||
        row.qr_image ||
        row.payment_qr_url ||
        '';

      setCompanyConfig({
        companyName: row.company_name || 'ReutilizaNet',
        nit: row.nit || '',
        address: row.address || 'La Paz - Bolivia',
        phone: row.phone || '',
        logoUrl: row.logo_url || '',
        qrUrl: String(qrCandidate || ''),
        bankName: row.bank_name || '',
        accountNumber: row.account_number || '',
        accountHolder: row.account_holder || '',
        warrantyNotes: row.warranty_notes || ''
      });
    }
  };

  const fetchSalesIncome = async () => {
    const { data, error } = await supabase
      .from('sales')
      .select('total, total_amount, amount_paid');
    if (!error && Array.isArray(data)) {
      const sum = data.reduce((acc, row: any) => {
        const val = Number(row?.amount_paid ?? row?.total_amount ?? row?.total ?? 0);
        return acc + (isNaN(val) ? 0 : val);
      }, 0);
      setTotalIncome(sum);
    }
  };

  const fetchProducts = async () => {
    const invRes = await supabase.from('inventory').select('*');
    if (!invRes.error && Array.isArray(invRes.data)) {
      setProducts(
        invRes.data.map((item: any) => ({
          id: String(item.id),
          name: item.name || item.item_name || 'Producto',
          price: Number(item.price ?? item.sale_price ?? 0) || 0,
          cost: Number(item.cost ?? item.unit_cost ?? 0) || 0,
          stock: Number(item.stock ?? item.quantity ?? 0) || 0,
          sourceTable: 'inventory'
        }))
      );
      return;
    }

    const prodRes = await supabase.from('products').select('*');
    if (!prodRes.error && Array.isArray(prodRes.data)) {
      setProducts(
        prodRes.data.map((item: any) => ({
          id: String(item.id),
          name: item.name || 'Producto',
          price: Number(item.price ?? 0) || 0,
          cost: Number(item.cost ?? item.unit_cost ?? 0) || 0,
          stock: Number(item.stock ?? 0) || 0,
          sourceTable: 'products'
        }))
      );
    }
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      const currentQty = existing ? existing.quantity : 0;
      if (currentQty + 1 > product.stock) {
        alert('No hay suficiente stock disponible para este producto.');
        return prev;
      }
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

  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const numericAmountPaid =
    paymentMethod === 'efectivo'
      ? Number(amountPaid) || 0
      : Number(amountPaid) || totalAmount;
  const changeAmount =
    paymentMethod === 'efectivo' ? Math.max(0, numericAmountPaid - totalAmount) : 0;

  const formatPaymentMethodLabel = (method: string) => {
    const m = String(method || '').toLowerCase();
    if (m === 'efectivo') return 'Efectivo';
    if (m === 'qr') return 'Pago QR';
    if (m === 'transferencia') return 'Transferencia';
    return method || 'Efectivo';
  };

  const isQrOrTransfer = (method?: string) => {
    const m = String(method || '').toLowerCase();
    return m === 'qr' || m === 'transferencia';
  };

  const handleProcessSale = async () => {
    if (cart.length === 0) {
      alert('El carrito está vacío.');
      return;
    }

    if (paymentMethod === 'efectivo' && numericAmountPaid < totalAmount) {
      alert('El monto recibido es menor al total de la venta.');
      return;
    }

    setLoading(true);
    setSuccessBanner('');
    try {
      const snapshotItems = cart.map(item => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        price: Number(item.price) || 0,
        cost: Number(item.cost) || 0,
        subtotal: (Number(item.price) || 0) * item.quantity,
        sourceTable: item.sourceTable
      }));
      const snapshotClient = clientName.trim() || 'Cliente General';
      const snapshotPayment = paymentMethod;
      const snapshotTotal = Number(totalAmount.toFixed(2));
      const snapshotPaid = Number(numericAmountPaid.toFixed(2));
      const snapshotChange = Number(changeAmount.toFixed(2));
      const totalUnits = snapshotItems.reduce((acc, i) => acc + i.quantity, 0);
      const weightedUnitCost =
        totalUnits > 0
          ? Number(
              (
                snapshotItems.reduce((acc, i) => acc + i.cost * i.quantity, 0) / totalUnits
              ).toFixed(2)
            )
          : 0;
      const nowIso = new Date().toISOString();
      const saleGroupId = `sale-${Date.now()}`;

      const productSummary = snapshotItems
        .map(i => `${i.quantity}x ${i.name}`)
        .join(', ');

      let saleData: any = null;
      let dbWarning = '';

      const fullPayload: any = {
        product_name: productSummary,
        quantity: totalUnits,
        unit_cost: weightedUnitCost,
        total: snapshotTotal,
        total_amount: snapshotTotal,
        amount_paid: snapshotPaid,
        change_amount: snapshotChange,
        payment_method: snapshotPayment,
        client_name: snapshotClient,
        customer: snapshotClient,
        sale_group_id: saleGroupId,
        created_at: nowIso
      };

      const res1 = await supabase
        .from('sales')
        .insert([fullPayload])
        .select()
        .maybeSingle();

      if (!res1.error) {
        saleData = res1.data;
      } else {
        const fallbackPayload: any = {
          product_name: productSummary,
          quantity: totalUnits,
          unit_cost: weightedUnitCost,
          total_amount: snapshotTotal,
          amount_paid: snapshotPaid,
          change_amount: snapshotChange,
          payment_method: snapshotPayment,
          client_name: snapshotClient,
          customer: snapshotClient,
          sale_group_id: saleGroupId,
          created_at: nowIso
        };
        const res2 = await supabase
          .from('sales')
          .insert([fallbackPayload])
          .select()
          .maybeSingle();
        if (!res2.error) {
          saleData = res2.data;
        } else {
          dbWarning =
            res2.error.message ||
            res1.error.message ||
            'Error al guardar venta en Supabase';
        }
      }

      // Descontar stock de cada ítem vendido en inventory o products
      for (const item of snapshotItems) {
        const currentProduct = products.find(p => p.id === item.id);
        const currentStock = Number(currentProduct?.stock ?? 0);
        const nextStock = Math.max(0, currentStock - Number(item.quantity || 0));
        const targetTable = item.sourceTable || currentProduct?.sourceTable || 'inventory';

        const { error: stockErr } = await supabase
          .from(targetTable)
          .update({ stock: nextStock })
          .eq('id', item.id);

        if (stockErr && !dbWarning) {
          dbWarning = `Venta registrada, pero no se pudo actualizar stock de "${item.name}": ${stockErr.message}`;
        }
      }

      const generatedReceipt: SaleReceipt = {
        id: saleData?.id ? String(saleData.id) : saleGroupId,
        createdAt: saleData?.created_at || nowIso,
        clientName: snapshotClient,
        paymentMethod: snapshotPayment,
        items: snapshotItems.map(({ id, name, quantity, price, subtotal }) => ({
          id,
          name,
          quantity,
          price,
          subtotal
        })),
        total: snapshotTotal,
        amountPaid: snapshotPaid,
        changeAmount: snapshotChange
      };

      const incomeAdded = snapshotPayment === 'efectivo' ? snapshotTotal : snapshotPaid;
      setSessionIncome(prev => Number((prev + incomeAdded).toFixed(2)));
      setTotalIncome(prev => Number((prev + incomeAdded).toFixed(2)));

      setSuccessBanner('¡Venta procesada con éxito!');
      setReceipt(generatedReceipt);
      setLastReceipt(generatedReceipt);

      setCart([]);
      setAmountPaid('');
      setClientName('');
      await Promise.all([fetchProducts(), fetchSalesIncome()]);

      if (dbWarning) {
        alert(`Nota de Venta abierta, pero hubo un aviso: ${dbWarning}`);
      }
    } catch (err: any) {
      console.error('Error al procesar la venta:', err);
      alert(`Error al procesar la venta: ${err.message || 'Error desconocido'}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(
    p => p.stock > 0 && p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4 max-w-7xl mx-auto p-4">
      {successBanner && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-3 rounded-xl flex justify-between items-center font-medium">
          <span>{successBanner}</span>
          <button
            type="button"
            onClick={() => setSuccessBanner('')}
            className="text-xs font-bold underline ml-4"
          >
            Cerrar
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Catálogo de Productos */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow border border-gray-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 bg-emerald-50 border border-emerald-200 p-3 rounded-lg">
            <div>
              <p className="text-xs font-semibold uppercase text-emerald-800">
                Ingresos de esta sesión en Caja
              </p>
              <p className="text-xl font-extrabold text-emerald-700">
                + Bs. {sessionIncome.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-gray-600">
                Total Ingresos Acumulados (Ventas)
              </p>
              <p className="text-xl font-extrabold text-gray-900">
                Bs. {totalIncome.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
            <h2 className="text-xl font-bold text-gray-900">Catálogo de Productos</h2>
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
            className="w-full p-2.5 border border-gray-300 rounded-lg mb-4 text-sm"
          />

          {filteredProducts.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">
              No hay productos con stock disponible.
            </p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto">
              {filteredProducts.map(product => (
                <div
                  key={product.id}
                  className="border border-gray-200 p-4 rounded-lg flex flex-col justify-between"
                >
                  <div>
                    <h3 className="font-semibold text-gray-900">{product.name}</h3>
                    <p className="text-green-600 font-bold mt-1">
                      Bs. {product.price.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">Stock: {product.stock}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => addToCart(product)}
                    className="mt-3 bg-indigo-600 text-white py-1.5 px-3 rounded-lg text-sm font-semibold hover:bg-indigo-700"
                  >
                    + Agregar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Carrito de Venta */}
        <div className="bg-white p-6 rounded-xl shadow border border-gray-100 flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Carrito de Venta</h2>
            <div className="space-y-3 max-h-[250px] overflow-y-auto mb-4">
              {cart.length === 0 ? (
                <p className="text-gray-500 text-center py-8 text-sm">
                  El carrito está vacío
                </p>
              ) : (
                cart.map(item => (
                  <div
                    key={item.id}
                    className="flex justify-between items-center border-b pb-2"
                  >
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{item.name}</p>
                      <p className="text-xs text-gray-500">
                        {item.quantity} x Bs. {item.price.toFixed(2)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.id)}
                      className="text-red-600 hover:text-red-800 text-xs font-semibold"
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
              <label className="text-sm font-semibold text-gray-800">
                Nombre del Cliente (Opcional)
              </label>
              <input
                type="text"
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                placeholder="Ej. Juan Pérez"
                className="w-full p-2.5 border border-gray-300 rounded-lg mt-1 text-sm"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-800">Método de Pago</label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                className="w-full p-2.5 border border-gray-300 rounded-lg mt-1 text-sm bg-white"
              >
                <option value="efectivo">Efectivo</option>
                <option value="qr">Pago QR</option>
                <option value="transferencia">Transferencia</option>
              </select>
            </div>

            {paymentMethod === 'efectivo' && (
              <div>
                <label className="text-sm font-semibold text-gray-800">
                  Monto Recibido (Bs.)
                </label>
                <input
                  type="number"
                  value={amountPaid}
                  onChange={e => setAmountPaid(e.target.value)}
                  placeholder="0.00"
                  className="w-full p-2.5 border border-gray-300 rounded-lg mt-1 text-sm"
                />
                <p className="text-xs text-gray-700 mt-1.5">
                  Cambio / Vuelto:{' '}
                  <span className="font-bold text-indigo-700">
                    Bs. {changeAmount.toFixed(2)}
                  </span>
                </p>
              </div>
            )}

            <div className="flex justify-between items-center text-lg font-extrabold pt-3 border-t">
              <span className="text-gray-900">Total:</span>
              <span className="text-green-600">Bs. {totalAmount.toFixed(2)}</span>
            </div>

            <button
              type="button"
              onClick={handleProcessSale}
              disabled={loading || cart.length === 0}
              className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 disabled:bg-gray-300 transition"
            >
              {loading ? 'Procesando...' : 'Completar Venta'}
            </button>
          </div>
        </div>
      </div>

      {/* Modal Nota de Venta Automática al Completar Venta */}
      {receipt && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-[9999] overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-gray-200 my-8">
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
                <div className="flex items-center gap-2.5">
                  {companyConfig.logoUrl && (
                    <img
                      src={companyConfig.logoUrl}
                      alt="Logo"
                      className="w-11 h-11 object-contain"
                    />
                  )}
                  <div>
                    <h2 className="text-lg font-extrabold uppercase">
                      {companyConfig.companyName}
                    </h2>
                    {companyConfig.nit && (
                      <p className="text-[11px] text-gray-600">NIT: {companyConfig.nit}</p>
                    )}
                    {companyConfig.address && (
                      <p className="text-[11px] text-gray-600">{companyConfig.address}</p>
                    )}
                    {companyConfig.phone && (
                      <p className="text-[11px] text-gray-600">Tel: {companyConfig.phone}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-block bg-gray-900 text-white text-[11px] font-bold px-2.5 py-0.5 rounded uppercase">
                    Nota de Venta
                  </span>
                  <p className="text-xs text-gray-500 font-mono mt-1">
                    Ref: #{String(receipt.id).slice(0, 8).toUpperCase()}
                  </p>
                  <p className="text-[11px] text-gray-600 mt-0.5">
                    {new Date(receipt.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap justify-between gap-2 text-xs bg-gray-50 p-2.5 rounded border">
                <div>
                  <span className="font-bold">Cliente:</span> {receipt.clientName}
                </div>
                <div>
                  <span className="font-bold">Modo de Pago:</span>{' '}
                  <span className="font-semibold uppercase">
                    {formatPaymentMethodLabel(receipt.paymentMethod)}
                  </span>
                </div>
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
                      <td className="p-2 border-r border-gray-300 text-center font-bold">
                        {item.quantity}
                      </td>
                      <td className="p-2 border-r border-gray-300">{item.name}</td>
                      <td className="p-2 border-r border-gray-300 text-right">
                        Bs. {item.price.toFixed(2)}
                      </td>
                      <td className="p-2 text-right font-semibold">
                        Bs. {item.subtotal.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-bold">
                    <td colSpan={3} className="p-2 border-r border-gray-300 text-right">
                      Pagado:
                    </td>
                    <td className="p-2 text-right text-emerald-700">
                      Bs. {receipt.amountPaid.toFixed(2)}
                    </td>
                  </tr>
                  {receipt.changeAmount > 0 && (
                    <tr className="bg-gray-50 font-bold">
                      <td colSpan={3} className="p-2 border-r border-gray-300 text-right">
                        Cambio / Vuelto:
                      </td>
                      <td className="p-2 text-right text-indigo-700">
                        Bs. {receipt.changeAmount.toFixed(2)}
                      </td>
                    </tr>
                  )}
                  <tr className="bg-gray-100 border-t-2 border-gray-800 font-extrabold text-sm">
                    <td
                      colSpan={3}
                      className="p-2 border-r border-gray-300 text-right uppercase"
                    >
                      Total:
                    </td>
                    <td className="p-2 text-right">Bs. {receipt.total.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>

              {(isQrOrTransfer(receipt.paymentMethod) ||
                companyConfig.bankName ||
                companyConfig.accountNumber ||
                companyConfig.qrUrl) && (
                <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-3 text-xs space-y-2">
                  <p className="font-bold text-blue-950 uppercase">
                    Datos de Pago ({formatPaymentMethodLabel(receipt.paymentMethod)})
                  </p>

                  {(companyConfig.bankName ||
                    companyConfig.accountNumber ||
                    companyConfig.accountHolder) && (
                    <div className="text-gray-800 space-y-0.5">
                      {companyConfig.bankName && (
                        <p>
                          <span className="font-semibold">Banco:</span>{' '}
                          {companyConfig.bankName}
                        </p>
                      )}
                      {companyConfig.accountNumber && (
                        <p>
                          <span className="font-semibold">N° Cuenta:</span>{' '}
                          <span className="font-mono">{companyConfig.accountNumber}</span>
                        </p>
                      )}
                      {companyConfig.accountHolder && (
                        <p>
                          <span className="font-semibold">Titular:</span>{' '}
                          {companyConfig.accountHolder}
                        </p>
                      )}
                    </div>
                  )}

                  {String(receipt.paymentMethod || '').toLowerCase() === 'qr' && (
                    <div className="flex flex-col items-center justify-center pt-1">
                      {companyConfig.qrUrl ? (
                        <img
                          src={companyConfig.qrUrl}
                          alt="Código QR de Pago"
                          className="w-36 h-36 object-contain bg-white p-1.5 border rounded"
                        />
                      ) : (
                        <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2.5 py-1">
                          Configura tu imagen QR o datos bancarios en el módulo{' '}
                          <strong>Configuración</strong>.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {companyConfig.warrantyNotes && (
                <div className="border-t pt-2 text-[11px] text-gray-600">
                  <span className="font-bold">Garantía:</span> {companyConfig.warrantyNotes}
                </div>
              )}
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
