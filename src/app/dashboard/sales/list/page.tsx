"use client";

import { useState, useEffect } from "react";
import { Search, Eye, Calendar, User, Receipt, CreditCard, Banknote, Clock, Undo2, Trash2, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { usePosStore } from "@/store/pos-store";

export default function SalesListPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  
  const [cashiers, setCashiers] = useState<any[]>([]);
  const store = usePosStore();

  useEffect(() => {
    fetchSales();
    supabase.from('users').select('id, full_name, is_active, role:roles(name)').eq('is_active', true).then(({ data }) => {
      if (data) setCashiers(data);
    });
  }, [user]);

  const fetchSales = async () => {
    if (!user) return;
    setLoading(true);
    // Fetch sales along with cashier (user) and shift info
    const { data, error } = await supabase
      .from('sales')
      .select(`
        *,
        users!cashier_id (full_name),
        shifts (id, start_time, end_time, status)
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setSales(data);
    }
    setLoading(false);
  };

  const handleOpenDetails = async (sale: any) => {
    setSelectedSale(sale);
    setIsDetailsOpen(true);
    setSaleItems([]);

    const { data } = await supabase
      .from('sale_items')
      .select(`
        *,
        products (id, name, barcode, selling_price, strips_per_box, pills_per_strip)
      `)
      .eq('sale_id', sale.id);

    if (data) setSaleItems(data);
  };

  const handleReturnOrder = async (saleId: string) => {
    if (!confirm('هل أنت متأكد من استرجاع الفاتورة بالكامل؟ (سيتم استرداد المخزون وإلغاء الفاتورة)')) return;
    setOrdersLoading(true);
    try {
      const { data: items } = await supabase.from('sale_items').select('product_id, quantity').eq('sale_id', saleId);
      if (items) {
        for (const item of items) {
          const { data: prod } = await supabase.from('products').select('stock_quantity').eq('id', item.product_id).single();
          if (prod) {
            await supabase.from('products').update({ stock_quantity: prod.stock_quantity + item.quantity }).eq('id', item.product_id);
          }
        }
      }
      await supabase.from('sales').delete().eq('id', saleId);
      
      if (selectedSale?.id === saleId) setIsDetailsOpen(false);
      
      fetchSales();
      store.fetchProducts();
    } catch (e) {
      console.error(e);
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleReturnItem = async (itemId: string) => {
    if (!confirm('هل أنت متأكد من استرجاع هذا الصنف؟')) return;
    setOrdersLoading(true);
    try {
      const item = saleItems.find((i: any) => i.id === itemId);
      if (!item) return;

      const { data: prod } = await supabase.from('products').select('stock_quantity').eq('id', item.product_id).single();
      if (prod) {
        await supabase.from('products').update({ stock_quantity: prod.stock_quantity + item.quantity }).eq('id', item.product_id);
      }
      await supabase.from('sale_items').delete().eq('id', itemId);

      const newSubtotal = selectedSale.subtotal - item.total_price;
      const newTotal = Math.max(0, newSubtotal - selectedSale.discount);
      
      if (saleItems.length <= 1) {
        await supabase.from('sales').delete().eq('id', selectedSale.id);
        setIsDetailsOpen(false);
      } else {
        await supabase.from('sales').update({ subtotal: newSubtotal, tax: 0, total: newTotal }).eq('id', selectedSale.id);
        setSelectedSale({ ...selectedSale, subtotal: newSubtotal, tax: 0, total: newTotal });
        setSaleItems(saleItems.filter((i: any) => i.id !== itemId));
      }
      
      fetchSales();
      store.fetchProducts();
    } catch (e) {
      console.error(e);
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleUpdateItemQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) return handleReturnItem(itemId);
    setOrdersLoading(true);
    try {
      const item = saleItems.find((i: any) => i.id === itemId);
      if (!item) return;

      const diff = newQuantity - item.quantity;
      
      let unit = "box";
      const product = item.products;
      if (product) {
        if (product.strips_per_box && Math.abs(item.unit_price - (product.selling_price / product.strips_per_box)) < 0.01) {
          unit = "strip";
        } else if (product.strips_per_box && product.pills_per_strip && Math.abs(item.unit_price - (product.selling_price / (product.strips_per_box * product.pills_per_strip))) < 0.01) {
          unit = "pill";
        }
      }

      let boxesConsumedDiff = diff;
      if (unit === "strip" && product?.strips_per_box) boxesConsumedDiff = diff / product.strips_per_box;
      if (unit === "pill" && product?.strips_per_box && product?.pills_per_strip) boxesConsumedDiff = diff / (product.strips_per_box * product.pills_per_strip);

      if (diff > 0) {
        const { data: prod } = await supabase.from('products').select('stock_quantity').eq('id', item.product_id).single();
        if (prod && prod.stock_quantity < Math.ceil(boxesConsumedDiff)) {
          alert("الكمية غير كافية في المخزن");
          setOrdersLoading(false);
          return;
        }
      }

      if (boxesConsumedDiff !== 0) {
        const { data: prod } = await supabase.from('products').select('stock_quantity').eq('id', item.product_id).single();
        if (prod) {
          await supabase.from('products').update({ stock_quantity: prod.stock_quantity - Math.ceil(boxesConsumedDiff) }).eq('id', item.product_id);
        }
      }

      const newTotalPrice = item.unit_price * newQuantity;
      await supabase.from('sale_items').update({ quantity: newQuantity, total_price: newTotalPrice }).eq('id', itemId);

      const newSubtotal = selectedSale.subtotal - item.total_price + newTotalPrice;
      const newTotal = Math.max(0, newSubtotal - selectedSale.discount);

      await supabase.from('sales').update({ subtotal: newSubtotal, tax: 0, total: newTotal }).eq('id', selectedSale.id);

      setSelectedSale({ ...selectedSale, subtotal: newSubtotal, tax: 0, total: newTotal });
      setSaleItems(saleItems.map((i: any) => i.id === itemId ? { ...i, quantity: newQuantity, total_price: newTotalPrice } : i));

      fetchSales();
      store.fetchProducts();
    } catch (e) {
      console.error(e);
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleUpdateItemUnit = async (itemId: string, newUnit: "box" | "strip" | "pill") => {
    setOrdersLoading(true);
    try {
      const item = saleItems.find((i: any) => i.id === itemId);
      if (!item) return;

      const product = item.products;
      if (!product) return;

      let oldUnit = "box";
      if (product.strips_per_box && Math.abs(item.unit_price - (product.selling_price / product.strips_per_box)) < 0.01) {
        oldUnit = "strip";
      } else if (product.strips_per_box && product.pills_per_strip && Math.abs(item.unit_price - (product.selling_price / (product.strips_per_box * product.pills_per_strip))) < 0.01) {
        oldUnit = "pill";
      }

      if (oldUnit === newUnit) {
        setOrdersLoading(false);
        return;
      }

      let newUnitPrice = product.selling_price;
      if (newUnit === "strip" && product.strips_per_box) newUnitPrice = product.selling_price / product.strips_per_box;
      if (newUnit === "pill" && product.strips_per_box && product.pills_per_strip) newUnitPrice = product.selling_price / (product.strips_per_box * product.pills_per_strip);

      let oldBoxesConsumed = item.quantity;
      if (oldUnit === "strip" && product.strips_per_box) oldBoxesConsumed = item.quantity / product.strips_per_box;
      if (oldUnit === "pill" && product.strips_per_box && product.pills_per_strip) oldBoxesConsumed = item.quantity / (product.strips_per_box * product.pills_per_strip);

      let newBoxesConsumed = item.quantity;
      if (newUnit === "strip" && product.strips_per_box) newBoxesConsumed = item.quantity / product.strips_per_box;
      if (newUnit === "pill" && product.strips_per_box && product.pills_per_strip) newBoxesConsumed = item.quantity / (product.strips_per_box * product.pills_per_strip);

      const diff = newBoxesConsumed - oldBoxesConsumed;
      if (diff > 0) {
        const { data: prod } = await supabase.from('products').select('stock_quantity').eq('id', item.product_id).single();
        if (prod && prod.stock_quantity < Math.ceil(diff)) {
          alert("الكمية غير كافية في المخزن لتحويل الوحدة");
          setOrdersLoading(false);
          return;
        }
      }

      if (diff !== 0) {
        const { data: prod } = await supabase.from('products').select('stock_quantity').eq('id', item.product_id).single();
        if (prod) {
          await supabase.from('products').update({ stock_quantity: prod.stock_quantity - Math.ceil(diff) }).eq('id', item.product_id);
        }
      }

      const newTotalPrice = newUnitPrice * item.quantity;
      await supabase.from('sale_items').update({ unit_price: newUnitPrice, total_price: newTotalPrice }).eq('id', itemId);

      const newSubtotal = selectedSale.subtotal - item.total_price + newTotalPrice;
      const newTotal = Math.max(0, newSubtotal - selectedSale.discount);

      await supabase.from('sales').update({ subtotal: newSubtotal, tax: 0, total: newTotal }).eq('id', selectedSale.id);

      setSelectedSale({ ...selectedSale, subtotal: newSubtotal, tax: 0, total: newTotal });
      setSaleItems(saleItems.map((i: any) => i.id === itemId ? { ...i, unit_price: newUnitPrice, total_price: newTotalPrice } : i));

      fetchSales();
      store.fetchProducts();
    } catch (e) {
      console.error(e);
    } finally {
      setOrdersLoading(false);
    }
  };

  const deliveryDrivers = cashiers.filter(u => {
    const roleArr = u.role as any;
    const roleName = Array.isArray(roleArr) ? roleArr[0]?.name : roleArr?.name;
    return roleName === 'delivery';
  });

  const cashierUsers = cashiers.filter(u => {
    const roleArr = u.role as any;
    const roleName = Array.isArray(roleArr) ? roleArr[0]?.name : roleArr?.name;
    return roleName !== 'delivery';
  });

  const filteredSales = sales.filter(s => 
    s.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.users?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.payment_method?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">فواتير المبيعات</h1>
          <p className="text-slate-500">عرض جميع فواتير المبيعات مرتبة حسب اليوم والوردية</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/pos">
            <Button className="bg-primary text-white">
              <Receipt size={16} className="ml-2" />
              نقطة البيع (POS)
            </Button>
          </Link>
        </div>
      </div>

      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white">
          <div className="relative w-full md:w-80">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <Input 
              placeholder="بحث برقم الفاتورة أو الكاشير..." 
              className="pl-3 pr-10 bg-slate-50"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto relative min-h-[300px]">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 backdrop-blur-sm">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow className="bg-white">
                <TableHead className="text-right">رقم الفاتورة</TableHead>
                <TableHead className="text-right">التاريخ والوقت</TableHead>
                <TableHead className="text-right">الكاشير / الوردية</TableHead>
                <TableHead className="text-center">طريقة الدفع</TableHead>
                <TableHead className="text-center">إجمالي الفاتورة</TableHead>
                <TableHead className="text-left">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="bg-white">
              {filteredSales.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-slate-500">
                    لا توجد فواتير مطابقة
                  </TableCell>
                </TableRow>
              ) : (
                filteredSales.map((sale) => {
                  let saleDeliveryId = undefined;
                  if (sale.notes && sale.notes.includes("مندوب: ")) {
                    const match = sale.notes.match(/مندوب:\s*([a-f0-9-]+)/);
                    if (match) saleDeliveryId = match[1];
                  }
                  const saleDeliveryPerson = saleDeliveryId ? cashiers.find(c => c.id === saleDeliveryId) : null;

                  return (
                    <TableRow key={sale.id} className="hover:bg-slate-50/50">
                    <TableCell className="font-mono font-bold text-slate-700">{sale.invoice_number}</TableCell>
                    <TableCell>
                      <div className="flex flex-col text-sm text-slate-600">
                        <div className="flex items-center gap-1 font-medium">
                          <Calendar size={14} className="text-slate-400" />
                          {new Date(sale.created_at).toLocaleDateString('ar-EG')}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                          <Clock size={12} className="text-slate-400" />
                          {new Date(sale.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-sm text-slate-700">
                        <div className="flex items-center gap-1 font-bold">
                          <User size={14} className="text-slate-400" />
                          {sale.users?.full_name || 'غير معروف'}
                        </div>
                        {sale.shifts && (
                           <div className="text-xs text-slate-500 mt-1">
                             وردية: {new Date(sale.shifts.start_time).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                             {sale.shifts.status === 'open' ? ' (مفتوحة)' : ' (مغلقة)'}
                           </div>
                        )}
                        {saleDeliveryPerson && (
                           <div className="text-xs text-amber-600 font-bold mt-1">
                             🚴 المندوب: {saleDeliveryPerson.full_name}
                           </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={
                        sale.payment_method === 'cash' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                        sale.payment_method === 'visa' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                        'bg-purple-50 text-purple-700 border-purple-200'
                      }>
                        {sale.payment_method === 'cash' ? <><Banknote size={12} className="mr-1 ml-1" /> نقدي</> : 
                         sale.payment_method === 'visa' ? <><CreditCard size={12} className="mr-1 ml-1" /> فيزا</> : 
                         'مختلط'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-black text-primary">
                      {sale.total?.toFixed(2)} <span className="text-xs font-normal text-slate-500">ج.م</span>
                    </TableCell>
                    <TableCell className="text-left">
                      <div className="flex gap-2 justify-end">
                        <Button variant="ghost" size="icon" className="text-slate-400 hover:text-blue-500" onClick={() => handleOpenDetails(sale)} disabled={ordersLoading}>
                          <Eye size={18} />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-500" onClick={() => handleReturnOrder(sale.id)} disabled={ordersLoading}>
                          <Undo2 size={18} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Details Modal */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-[700px]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="text-primary" size={20} />
              تفاصيل فاتورة البيع: {selectedSale?.invoice_number}
            </DialogTitle>
          </DialogHeader>
          
          {selectedSale && (
            <div className="space-y-6 py-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <p className="text-xs text-slate-500 font-bold mb-1">الكاشير</p>
                  <select
                    className="w-full text-sm font-bold text-slate-800 bg-transparent border-b border-slate-200 outline-none pb-1 cursor-pointer hover:border-primary transition-colors"
                    value={selectedSale.cashier_id || ""}
                    onChange={async (e) => {
                       const newId = e.target.value;
                       const { error } = await supabase.from('sales').update({ cashier_id: newId }).eq('id', selectedSale.id);
                       if (!error) {
                          const newCashier = cashiers.find(c => c.id === newId);
                          setSelectedSale({ ...selectedSale, cashier_id: newId, users: { full_name: newCashier?.full_name } });
                          setSales(sales.map(s => s.id === selectedSale.id ? { ...s, cashier_id: newId, users: { full_name: newCashier?.full_name } } : s));
                       } else {
                          alert("خطأ أثناء تعديل الكاشير");
                       }
                    }}
                  >
                    <option value="">غير محدد</option>
                    {cashierUsers.map(c => (
                      <option key={c.id} value={c.id}>{c.full_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-bold mb-1">المندوب</p>
                  <select
                    className="w-full text-sm font-bold text-slate-800 bg-transparent border-b border-slate-200 outline-none pb-1 cursor-pointer hover:border-primary transition-colors"
                    value={(() => {
                      if (selectedSale.notes && selectedSale.notes.includes("مندوب: ")) {
                        const match = selectedSale.notes.match(/مندوب:\s*([a-f0-9-]+)/);
                        return match ? match[1] : "";
                      }
                      return "";
                    })()}
                    onChange={async (e) => {
                       const newDeliveryId = e.target.value;
                       let baseNotes = selectedSale.notes || "";
                       baseNotes = baseNotes.replace(/-?\s*مندوب:\s*[a-f0-9-]+/g, "").trim();
                       
                       let newNotes = baseNotes;
                       if (newDeliveryId) {
                         newNotes = [baseNotes, `مندوب: ${newDeliveryId}`].filter(Boolean).join(' - ');
                       }
                       
                       const { error } = await supabase.from('sales').update({ notes: newNotes || null }).eq('id', selectedSale.id);
                       if (!error) {
                          setSelectedSale({ ...selectedSale, notes: newNotes || null });
                          setSales(sales.map(s => s.id === selectedSale.id ? { ...s, notes: newNotes || null } : s));
                       } else {
                          alert("خطأ أثناء تعديل المندوب");
                       }
                    }}
                  >
                    <option value="">لا يوجد</option>
                    {deliveryDrivers.map(d => (
                      <option key={d.id} value={d.id}>{d.full_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-bold mb-1">التاريخ</p>
                  <p className="font-medium text-slate-700">
                    {new Date(selectedSale.created_at).toLocaleDateString('ar-EG')} - {new Date(selectedSale.created_at).toLocaleTimeString('ar-EG')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-bold mb-1">طريقة الدفع</p>
                  <p className="font-bold text-slate-700">
                    {selectedSale.payment_method === 'cash' ? 'نقدي' : 
                     selectedSale.payment_method === 'visa' ? 'فيزا' : 'مختلط'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-bold mb-1">الإجمالي</p>
                  <p className="font-bold text-primary">{selectedSale.total?.toFixed(2)} ج.م</p>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-slate-700 mb-3 text-sm">الأصناف المباعة</h3>
                <div className="border border-slate-100 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0">
                      <TableRow>
                        <TableHead className="text-right">المنتج</TableHead>
                        <TableHead className="text-center">الكمية</TableHead>
                        <TableHead className="text-center">سعر الوحدة</TableHead>
                        <TableHead className="text-center">الإجمالي</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {saleItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-slate-500 py-4">جاري التحميل...</TableCell>
                        </TableRow>
                      ) : (
                        saleItems.map((item, idx) => {
                          const product = item.products;
                          let currentUnit = "box";
                          if (product) {
                            if (product.strips_per_box && Math.abs(item.unit_price - (product.selling_price / product.strips_per_box)) < 0.01) {
                              currentUnit = "strip";
                            } else if (product.strips_per_box && product.pills_per_strip && Math.abs(item.unit_price - (product.selling_price / (product.strips_per_box * product.pills_per_strip))) < 0.01) {
                              currentUnit = "pill";
                            }
                          }
                          
                          return (
                          <TableRow key={idx} className="hover:bg-slate-50/50">
                            <TableCell className="font-medium text-slate-800 text-sm">
                              <div>{product?.name}</div>
                              {product && (product.strips_per_box || product.pills_per_strip) && (
                                <div className="flex gap-1 mt-1">
                                  <Badge variant={currentUnit === "box" ? "default" : "outline"} className={`text-[9px] px-1 py-0 cursor-pointer ${currentUnit === "box" ? "bg-primary" : "text-slate-500"}`} onClick={() => handleUpdateItemUnit(item.id, "box")}>علبة</Badge>
                                  {product.strips_per_box && <Badge variant={currentUnit === "strip" ? "default" : "outline"} className={`text-[9px] px-1 py-0 cursor-pointer ${currentUnit === "strip" ? "bg-primary" : "text-slate-500"}`} onClick={() => handleUpdateItemUnit(item.id, "strip")}>شريط</Badge>}
                                  {product.pills_per_strip && <Badge variant={currentUnit === "pill" ? "default" : "outline"} className={`text-[9px] px-1 py-0 cursor-pointer ${currentUnit === "pill" ? "bg-primary" : "text-slate-500"}`} onClick={() => handleUpdateItemUnit(item.id, "pill")}>حبة</Badge>}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center bg-slate-100 rounded-lg border border-slate-200 p-0.5 w-fit mx-auto">
                                <button disabled={ordersLoading} className="w-6 h-6 flex items-center justify-center text-slate-500 hover:bg-white hover:text-primary rounded-md disabled:opacity-50" onClick={() => handleUpdateItemQuantity(item.id, item.quantity - 1)}><Minus size={12} /></button>
                                <span className="w-6 text-center text-xs font-bold">{item.quantity}</span>
                                <button disabled={ordersLoading} className="w-6 h-6 flex items-center justify-center text-slate-500 hover:bg-white hover:text-primary rounded-md disabled:opacity-50" onClick={() => handleUpdateItemQuantity(item.id, item.quantity + 1)}><Plus size={12} /></button>
                              </div>
                            </TableCell>
                            <TableCell className="text-center text-slate-600">{item.unit_price?.toFixed(2)} ج.م</TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-black flex-1 text-right">{item.total_price?.toFixed(2)} ج.م</span>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-300 hover:text-red-500" onClick={() => handleReturnItem(item.id)} disabled={ordersLoading}>
                                  <Trash2 size={14} />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )})
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
              
              {(selectedSale.discount > 0 || (selectedSale.delivery_fee && selectedSale.delivery_fee > 0)) && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex justify-between">
                  <div className="flex gap-8">
                    {selectedSale.discount > 0 && (
                      <div>
                        <p className="text-xs text-slate-500 font-bold">الخصم</p>
                        <p className="font-bold text-red-500">{selectedSale.discount?.toFixed(2)} ج.م</p>
                      </div>
                    )}
                    {selectedSale.delivery_fee > 0 && (
                      <div>
                        <p className="text-xs text-slate-500 font-bold">خدمة التوصيل</p>
                        <p className="font-bold text-slate-700">{selectedSale.delivery_fee?.toFixed(2)} ج.م</p>
                      </div>
                    )}
                  </div>
                  <div className="text-left">
                     <p className="text-xs text-slate-500 font-bold">المجموع الفرعي</p>
                     <p className="font-bold text-slate-700">{selectedSale.subtotal?.toFixed(2)} ج.م</p>
                  </div>
                </div>
              )}

            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsDetailsOpen(false)}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
