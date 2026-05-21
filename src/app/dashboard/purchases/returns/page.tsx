"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { Plus, Trash2, Search, Calendar as CalendarIcon, Save, ArrowRight, Building2, RefreshCw, AlertTriangle, CheckCircle, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth-store";
import Link from "next/link";
import { useRouter } from "next/navigation";

type ReturnItem = {
  id: string; // temp id
  product: any;
  batch_id: string | null;
  batch_number: string;
  expiry_date: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  reason: string; // 'expired', 'slow_moving', 'damaged'
};

const REASONS = [
  { value: "expired", label: "أدوية منتهية الصلاحية 📅" },
  { value: "slow_moving", label: "أدوية راكدة / فائضة 📦" },
  { value: "damaged", label: "أدوية تالفة ⚠️" }
];

function ReturnsContent() {
  const { user } = useAuthStore();
  const router = useRouter();

  const [invoiceNumber, setInvoiceNumber] = useState(`RET-${Date.now().toString().slice(-6)}`);
  const [supplierId, setSupplierId] = useState("");
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [notes, setNotes] = useState("");

  const [products, setProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);

  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [returnQty, setReturnQty] = useState(1);
  const [unitCost, setUnitCost] = useState(0);
  const [returnReason, setReturnReason] = useState("expired");

  const [items, setItems] = useState<ReturnItem[]>([]);

  useEffect(() => {
    fetchSuppliers();
    fetchProducts();
  }, []);

  const fetchSuppliers = async () => {
    const { data } = await supabase.from("suppliers").select("*").order("name");
    if (data) setSuppliers(data);
  };

  const fetchProducts = async () => {
    const { data } = await supabase.from("products").select("*").order("name");
    if (data) setProducts(data);
  };

  const filteredProducts = useMemo(() => {
    if (!searchQuery) return [];
    const q = searchQuery.toLowerCase();
    return products.filter(p => 
      p.name?.toLowerCase().includes(q) || 
      p.barcode?.toLowerCase().includes(q)
    ).slice(0, 5);
  }, [searchQuery, products]);

  const selectProduct = async (p: any) => {
    setSelectedProduct(p);
    setSearchQuery(p.name);
    setShowProductDropdown(false);
    setUnitCost(p.purchase_price || 0);
    setReturnQty(1);

    // Fetch batches for this product
    const { data: pBatches } = await supabase
      .from("product_batches")
      .select("*")
      .eq("product_id", p.id)
      .gt("quantity", 0)
      .order("expiry_date", { ascending: true });

    if (pBatches) {
      setBatches(pBatches);
      if (pBatches.length > 0) {
        setSelectedBatchId(pBatches[0].id);
      } else {
        setSelectedBatchId("");
      }
    } else {
      setBatches([]);
      setSelectedBatchId("");
    }
  };

  const activeBatch = useMemo(() => {
    return batches.find(b => b.id === selectedBatchId) || null;
  }, [selectedBatchId, batches]);

  const handleAddItem = () => {
    if (!selectedProduct) return alert("الرجاء اختيار منتج");
    if (returnQty <= 0) return alert("الكمية المرتجعة يجب أن تكون أكبر من صفر");
    
    if (activeBatch && returnQty > activeBatch.quantity) {
      return alert(`الكمية المرتجعة لا يمكن أن تتجاوز الكمية المتاحة في هذه التشغيلة (${activeBatch.quantity})`);
    }

    const itemTotal = returnQty * unitCost;

    const newItem: ReturnItem = {
      id: Math.random().toString(),
      product: selectedProduct,
      batch_id: activeBatch?.id || null,
      batch_number: activeBatch?.batch_number || "يدوي / بدون تشغيلة",
      expiry_date: activeBatch?.expiry_date || "غير محدد",
      quantity: returnQty,
      unit_cost: unitCost,
      total_cost: itemTotal,
      reason: returnReason
    };

    setItems([newItem, ...items]);

    // Reset fields
    setSelectedProduct(null);
    setSearchQuery("");
    setBatches([]);
    setSelectedBatchId("");
    setReturnQty(1);
    setUnitCost(0);
    setReturnReason("expired");
  };

  const removeItem = (id: string) => {
    setItems(items.filter(i => i.id !== id));
  };

  const subtotal = items.reduce((acc, item) => acc + item.total_cost, 0);
  const total = subtotal; // returns typically don't have separate taxes, just simple invoice matching

  const handleSaveReturn = async () => {
    if (!supplierId) return alert("الرجاء اختيار المورد");
    if (items.length === 0) return alert("سلة المرتجعات فارغة");

    // 1. Create supplier return session
    const { data: returnData, error: returnError } = await supabase
      .from("supplier_returns")
      .insert({
        invoice_number: invoiceNumber,
        supplier_id: supplierId,
        subtotal: subtotal,
        tax: 0,
        total: total,
        notes: notes,
        status: "completed",
        pharmacy_id: user?.pharmacy_id
      })
      .select("id")
      .single();

    if (returnError) return alert("خطأ في حفظ المرتجع للمورد: " + returnError.message);
    const returnId = returnData.id;

    // 2. Insert items, update physical stock & log inventory moves
    for (const item of items) {
      await supabase.from("supplier_return_items").insert({
        return_id: returnId,
        product_id: item.product.id,
        batch_id: item.batch_id,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        total_cost: item.total_cost,
        reason: item.reason,
        pharmacy_id: user?.pharmacy_id
      });

      // Update product batch stock if batch_id is linked
      if (item.batch_id) {
        const { data: batch } = await supabase.from("product_batches").select("quantity").eq("id", item.batch_id).single();
        const currentQty = batch?.quantity || 0;
        await supabase
          .from("product_batches")
          .update({ quantity: Math.max(0, currentQty - item.quantity) })
          .eq("id", item.batch_id);
      }

      // Update product overall stock
      const { data: prod } = await supabase.from("products").select("stock_quantity").eq("id", item.product.id).single();
      const currentStock = prod?.stock_quantity || 0;
      await supabase
        .from("products")
        .update({ stock_quantity: Math.max(0, currentStock - item.quantity) })
        .eq("id", item.product.id);

      // Log stock move
      await supabase.from("stock_moves").insert({
        product_id: item.product.id,
        batch_id: item.batch_id,
        quantity_changed: -item.quantity,
        type: "supplier_return",
        reference_id: returnId,
        reference_name: `مرتجع مورد فاتورة #${invoiceNumber}`,
        user_id: user?.id,
        pharmacy_id: user?.pharmacy_id
      });
    }

    // 3. Decrement supplier total debt
    const { data: sup } = await supabase.from("suppliers").select("total_debt").eq("id", supplierId).single();
    if (sup) {
      await supabase
        .from("suppliers")
        .update({ total_debt: Math.max(0, (sup.total_debt || 0) - total) })
        .eq("id", supplierId);
    }

    alert("تم حفظ جلسة مرتجعات المورد وتسوية المديونية وتعديل المخزون بنجاح!");
    
    // Reset Form
    setInvoiceNumber(`RET-${Date.now().toString().slice(-6)}`);
    setItems([]);
    setNotes("");
    setSupplierId("");
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <RefreshCw className="text-rose-500 animate-spin-slow" />
            مرتجع بضاعة إلى المورد
          </h1>
          <p className="text-slate-500 font-medium">جلسة إرجاع الأدوية التالفة، منتهية الصلاحية أو الراكدة وتسوية حساب المورد المالي</p>
        </div>
        <div>
          <Link href="/dashboard/purchases/list">
            <Button variant="outline" className="bg-white text-slate-600 border-slate-200">
              <FileText size={16} className="ml-2" />
              سجل الفواتير السابقة
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Side: Supplier & Totals */}
        <Card className="md:col-span-1 border-0 shadow-sm bg-white">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
            <CardTitle className="text-base text-slate-700 flex items-center gap-2">
              <Building2 size={18} className="text-rose-500" /> بيانات الجلسة والمالية
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">رقم فاتورة المرتجع</label>
              <Input value={invoiceNumber} readOnly className="bg-slate-100 text-slate-500 cursor-not-allowed font-mono text-center" />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">المورد المستلم</label>
              <select 
                className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm"
                value={supplierId}
                onChange={e => setSupplierId(e.target.value)}
              >
                <option value="">اختر المورد...</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} (المديونية الحالية: {Number(s.total_debt || 0).toFixed(2)} ج.م)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">ملاحظات تسوية المرتجع</label>
              <textarea 
                className="w-full p-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-1 focus:ring-rose-500"
                rows={3}
                placeholder="أسباب التلف، الاتفاق مع المندوب، إلخ..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>

            {/* Totals Summary */}
            <Card className="bg-slate-900 border-0 text-white rounded-xl overflow-hidden mt-6">
              <CardContent className="p-5 space-y-4">
                <div className="flex justify-between items-center text-slate-400 text-sm">
                  <span>إجمالي المرتجعات المضافة:</span>
                  <span className="font-mono">{items.length} أصناف</span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-800 pt-3">
                  <span className="text-slate-300 text-sm">إجمالي المبلغ الدائن:</span>
                  <span className="text-rose-400 text-xl font-bold font-mono">{total.toFixed(2)} ج.م</span>
                </div>
                {supplierId && (
                  <div className="bg-rose-950/40 p-3 rounded-lg border border-rose-900/30 flex gap-2 items-start text-xs text-rose-300">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <p>سيتم خصم هذا الإجمالي مباشرة من مديونية المورد المالية بعد تأكيد العملية.</p>
                  </div>
                )}
                <Button 
                  className="w-full bg-rose-500 hover:bg-rose-600 text-white py-6 text-base font-bold shadow-lg shadow-rose-500/20" 
                  onClick={handleSaveReturn}
                >
                  <Save size={18} className="ml-2" />
                  تأكيد وإرسال المرتجع
                </Button>
              </CardContent>
            </Card>
          </CardContent>
        </Card>

        {/* Right Side: Product search, select batch, details */}
        <div className="md:col-span-2 space-y-6">
          <Card className="border-0 shadow-sm bg-white overflow-visible">
            <CardContent className="p-4 space-y-4">
              <div className="relative">
                <label className="text-xs font-bold text-slate-500 mb-1 block">البحث عن دواء لإرجاعه</label>
                <div className="relative">
                  <Search size={16} className="absolute right-3 top-3 text-slate-400" />
                  <Input 
                    placeholder="ابحث بالاسم أو الباركود..." 
                    className="pr-9"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowProductDropdown(true);
                      setSelectedProduct(null);
                    }}
                    onFocus={() => setShowProductDropdown(true)}
                  />
                </div>
                {showProductDropdown && filteredProducts.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                    {filteredProducts.map(p => (
                      <div 
                        key={p.id} 
                        className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
                        onClick={() => selectProduct(p)}
                      >
                        <p className="font-bold text-sm text-slate-800">{p.name}</p>
                        <p className="text-xs text-slate-500">{p.barcode}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedProduct && (
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="col-span-2 md:col-span-3">
                    <label className="text-xs font-bold text-slate-500 mb-1 block">التشغيلة المتاحة (Batch)</label>
                    {batches.length > 0 ? (
                      <select
                        className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm font-semibold"
                        value={selectedBatchId}
                        onChange={e => setSelectedBatchId(e.target.value)}
                      >
                        {batches.map(b => (
                          <option key={b.id} value={b.id}>
                            رقم: {b.batch_number} - المتاح: {b.quantity} علبة (انتهاء: {b.expiry_date})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="h-10 px-3 flex items-center bg-amber-50 text-amber-700 font-bold border border-amber-200 rounded-md text-xs">
                        <AlertTriangle size={14} className="ml-1" />
                        لا يوجد دفعات مخزنة! سيتم الخصم يدوياً.
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-1">
                    <label className="text-xs font-bold text-slate-500 mb-1 block">الكمية المرتجعة</label>
                    <Input 
                      type="number" 
                      min={1}
                      max={activeBatch ? activeBatch.quantity : undefined}
                      value={returnQty} 
                      onChange={e => setReturnQty(Number(e.target.value))} 
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-xs font-bold text-slate-500 mb-1 block">سعر الإرجاع (للعلبة)</label>
                    <Input 
                      type="number" 
                      value={unitCost} 
                      onChange={e => setUnitCost(Number(e.target.value))} 
                    />
                  </div>

                  <div className="col-span-2 md:col-span-4">
                    <label className="text-xs font-bold text-slate-500 mb-1 block">سبب الإرجاع</label>
                    <select
                      className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm"
                      value={returnReason}
                      onChange={e => setReturnReason(e.target.value)}
                    >
                      {REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>

                  <div className="col-span-2 md:col-span-2 flex items-end">
                    <Button onClick={handleAddItem} className="w-full bg-rose-500 hover:bg-rose-600 text-white font-bold h-10">
                      إضافة للمرتجع <ArrowRight size={16} className="mr-2" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Return items table */}
          <Card className="border-0 shadow-sm bg-white">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="text-right">المنتج</TableHead>
                    <TableHead className="text-right">التشغيلة / الصلاحية</TableHead>
                    <TableHead className="text-center">سبب الإرجاع</TableHead>
                    <TableHead className="text-center">الكمية</TableHead>
                    <TableHead className="text-center">سعر الإرجاع</TableHead>
                    <TableHead className="text-center">الإجمالي</TableHead>
                    <TableHead className="text-center"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                        لم يتم إضافة بنود مرتجعة لهذه الجلسة بعد.
                      </TableCell>
                    </TableRow>
                  ) : items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <p className="font-bold text-slate-800 text-sm">{item.product.name}</p>
                        <p className="text-xs text-slate-500 font-mono">{item.product.barcode}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-semibold text-slate-700">{item.batch_number}</p>
                        <p className="text-xs text-red-500 font-mono">{item.expiry_date}</p>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                          item.reason === 'expired' ? 'bg-amber-100 text-amber-800' :
                          item.reason === 'damaged' ? 'bg-rose-100 text-rose-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {REASONS.find(r => r.value === item.reason)?.label.split(" ")[0] || item.reason}
                        </span>
                      </TableCell>
                      <TableCell className="text-center font-bold font-mono">{item.quantity} علبة</TableCell>
                      <TableCell className="text-center font-mono">{item.unit_cost.toFixed(2)} ج.م</TableCell>
                      <TableCell className="text-center font-bold text-rose-500 font-mono">{item.total_cost.toFixed(2)} ج.م</TableCell>
                      <TableCell className="text-center">
                        <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50" onClick={() => removeItem(item.id)}>
                          <Trash2 size={16} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function ReturnsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">جاري التحميل...</div>}>
      <ReturnsContent />
    </Suspense>
  );
}
