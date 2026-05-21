"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { Plus, Trash2, Search, Calendar as CalendarIcon, Save, ArrowRight, Building2, Receipt, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth-store";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

type PurchaseItem = {
  id: string; // temp id
  product: any;
  quantity: number;
  unit_cost: number;
  bonus_quantity: number;
  extra_discount_percent: number;
  effective_unit_cost: number;
  selling_price: number;
  total_cost: number;
  batch_number: string;
  expiry_date: string;
};

// Helper for parsing CSV
const parseCSV = (text: string) => {
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  return lines.map(line => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  });
};

function PurchasesContent() {
  const { user } = useAuthStore();
  const searchParams = useSearchParams();
  const router = useRouter();
  const editId = searchParams.get('edit');
  const [isEditing, setIsEditing] = useState(false);
  const [oldItems, setOldItems] = useState<any[]>([]);

  const [invoiceNumber, setInvoiceNumber] = useState(`PUR-${Date.now().toString().slice(-6)}`);
  const [supplierId, setSupplierId] = useState("");
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState("cash");

  const [products, setProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);

  const [currentItem, setCurrentItem] = useState({
    quantity: 1,
    unit_cost: 0,
    bonus_quantity: 0,
    extra_discount_percent: 0,
    selling_price: 0,
    batch_number: "",
    expiry_date: "",
  });

  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);

  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");

  // States for CSV Smart Import Wizard
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
  const [mapping, setMapping] = useState({
    product_name: "",
    barcode: "",
    quantity: "",
    unit_cost: "",
    selling_price: "",
    bonus_quantity: "",
    extra_discount_percent: "",
    batch_number: "",
    expiry_date: "",
  });

  useEffect(() => {
    fetchSuppliers();
    fetchProducts();
    if (editId) {
      setIsEditing(true);
      loadPurchase(editId);
    }
  }, [editId]);

  const loadPurchase = async (id: string) => {
    const { data: purchase } = await supabase.from('purchases').select('*').eq('id', id).single();
    if (purchase) {
      setInvoiceNumber(purchase.invoice_number);
      setSupplierId(purchase.supplier_id);
      setPaymentMethod(purchase.status === 'paid' ? 'cash' : 'deferred');
      setDate(purchase.created_at.split('T')[0]);

      const { data: pItems } = await supabase.from('purchase_items').select('*, products(*)').eq('purchase_id', id);
      if (pItems) {
        const loadedItems = pItems.map((item: any) => ({
          id: item.id,
          product: item.products,
          quantity: item.quantity,
          unit_cost: item.unit_cost,
          bonus_quantity: item.bonus_quantity || 0,
          extra_discount_percent: item.extra_discount_percent || 0,
          effective_unit_cost: item.effective_unit_cost || item.unit_cost,
          selling_price: item.products?.selling_price || 0,
          total_cost: item.total_cost,
          batch_number: "", // difficult to map batch accurately for editing
          expiry_date: "",
        }));
        setItems(loadedItems);
        setOldItems(loadedItems);
      }
    }
  };

  const fetchSuppliers = async () => {
    const { data } = await supabase.from('suppliers').select('*').order('name');
    if (data) setSuppliers(data);
  };

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').order('name');
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

  const selectProduct = (p: any) => {
    setSelectedProduct(p);
    setCurrentItem({
      quantity: 1,
      unit_cost: p.purchase_price || 0,
      bonus_quantity: 0,
      extra_discount_percent: 0,
      selling_price: p.selling_price || 0,
      batch_number: "",
      expiry_date: "",
    });
    setSearchQuery(p.name);
    setShowProductDropdown(false);
  };

  const handleAddItem = () => {
    if (!selectedProduct) return alert("الرجاء اختيار منتج");
    if (currentItem.quantity <= 0) return alert("الكمية يجب أن تكون أكبر من صفر");
    if (currentItem.unit_cost < 0) return alert("سعر الشراء غير صحيح");
    if (!currentItem.batch_number) return alert("الرجاء إدخال رقم التشغيلة (Batch)");
    if (!currentItem.expiry_date) return alert("الرجاء إدخال تاريخ الصلاحية");

    const extraDiscount = currentItem.extra_discount_percent || 0;
    const bonusQty = currentItem.bonus_quantity || 0;
    const totalCost = currentItem.quantity * currentItem.unit_cost * (1 - extraDiscount / 100);
    const effectiveUnitCost = (currentItem.quantity + bonusQty) > 0 ? totalCost / (currentItem.quantity + bonusQty) : 0;

    const newItem: PurchaseItem = {
      id: Math.random().toString(),
      product: selectedProduct,
      quantity: currentItem.quantity,
      unit_cost: currentItem.unit_cost,
      bonus_quantity: bonusQty,
      extra_discount_percent: extraDiscount,
      effective_unit_cost: effectiveUnitCost,
      selling_price: currentItem.selling_price,
      total_cost: totalCost,
      batch_number: currentItem.batch_number,
      expiry_date: currentItem.expiry_date,
    };

    setItems([newItem, ...items]);
    
    // Reset inputs
    setSelectedProduct(null);
    setSearchQuery("");
    setCurrentItem({
      quantity: 1,
      unit_cost: 0,
      bonus_quantity: 0,
      extra_discount_percent: 0,
      selling_price: 0,
      batch_number: "",
      expiry_date: "",
    });
  };

  const removeItem = (id: string) => {
    setItems(items.filter(i => i.id !== id));
  };

  const subtotal = items.reduce((acc, item) => acc + item.total_cost, 0);
  const total = subtotal - discount + tax;

  const handleSavePurchase = async () => {
    if (!supplierId) return alert("الرجاء اختيار المورد");
    if (items.length === 0) return alert("الفاتورة فارغة");

    const isPaid = paymentMethod !== "deferred";
    const amountPaid = isPaid ? total : 0;
    const status = isPaid ? "paid" : "pending";

    let purchaseId = editId;

    if (isEditing && editId) {
      // Revert old stock
      for (const old of oldItems) {
        const { data: prod } = await supabase.from('products').select('stock_quantity').eq('id', old.product.id).single();
        if (prod) {
          await supabase.from('products').update({ 
            stock_quantity: Math.max(0, (prod.stock_quantity || 0) - (old.quantity + (old.bonus_quantity || 0))) 
          }).eq('id', old.product.id);
        }
      }
      // Delete old batches linked to this purchase
      await supabase.from('product_batches').delete().eq('purchase_id', editId);
      // Delete old items
      await supabase.from('purchase_items').delete().eq('purchase_id', editId);
      // Delete old stock moves linked to this purchase
      await supabase.from('stock_moves').delete().eq('reference_id', editId);

      // Revert old supplier debt if old invoice was deferred
      const { data: oldPurchase } = await supabase.from('purchases').select('status, total_amount, supplier_id').eq('id', editId).single();
      if (oldPurchase && oldPurchase.status === 'pending') {
        const { data: oldSup } = await supabase.from('suppliers').select('total_debt').eq('id', oldPurchase.supplier_id).single();
        if (oldSup) {
          await supabase.from('suppliers').update({ total_debt: Math.max(0, (oldSup.total_debt || 0) - oldPurchase.total_amount) }).eq('id', oldPurchase.supplier_id);
        }
      }
      
      // Update purchase record
      const { error: updateError } = await supabase.from('purchases').update({
        supplier_id: supplierId,
        total_amount: total,
        amount_paid: amountPaid,
        status: status,
      }).eq('id', editId);

      if (updateError) return alert("خطأ في تعديل الفاتورة: " + updateError.message);

      // Add new debt if new invoice is deferred
      if (!isPaid) {
        const { data: sup } = await supabase.from('suppliers').select('total_debt').eq('id', supplierId).single();
        if (sup) {
          await supabase.from('suppliers').update({ total_debt: (sup.total_debt || 0) + total }).eq('id', supplierId);
        }
      }
    } else {
      // 1. Insert Purchase
      const { data: purchaseData, error: purchaseError } = await supabase
        .from('purchases')
        .insert({
          invoice_number: invoiceNumber,
          supplier_id: supplierId,
          user_id: user?.id,
          pharmacy_id: user?.pharmacy_id,
          total_amount: total,
          amount_paid: amountPaid,
          status: status,
        })
        .select('id')
        .single();

      if (purchaseError) return alert("خطأ في حفظ الفاتورة: " + purchaseError.message);
      purchaseId = purchaseData.id;
    }

    // 2. Insert Purchase Items & Update Stock/Batches & Log Stock Moves
    for (const item of items) {
      // Insert item
      await supabase.from('purchase_items').insert({
        purchase_id: purchaseId,
        product_id: item.product.id,
        pharmacy_id: user?.pharmacy_id,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        bonus_quantity: item.bonus_quantity || 0,
        extra_discount_percent: item.extra_discount_percent || 0,
        effective_unit_cost: item.effective_unit_cost || item.unit_cost,
        total_cost: item.total_cost,
      });

      // Insert Batch if provided
      let batchId = null;
      if (item.batch_number) {
        const { data: batchData } = await supabase.from('product_batches').insert({
          product_id: item.product.id,
          pharmacy_id: user?.pharmacy_id,
          purchase_id: purchaseId,
          batch_number: item.batch_number,
          expiry_date: item.expiry_date,
          quantity: item.quantity + (item.bonus_quantity || 0),
        }).select('id').single();
        if (batchData) batchId = batchData.id;
      }

      // Update Product Stock, Purchase Price AND Selling Price
      const { data: prod } = await supabase.from('products').select('stock_quantity').eq('id', item.product.id).single();
      const currentStock = prod?.stock_quantity || 0;
      await supabase.from('products').update({
        stock_quantity: currentStock + item.quantity + (item.bonus_quantity || 0),
        purchase_price: item.effective_unit_cost || item.unit_cost,
        selling_price: item.selling_price
      }).eq('id', item.product.id);

      // Log stock move
      await supabase.from('stock_moves').insert({
        product_id: item.product.id,
        batch_id: batchId,
        quantity_changed: item.quantity + (item.bonus_quantity || 0),
        type: 'purchase',
        reference_id: purchaseId,
        reference_name: `فاتورة شراء #${invoiceNumber}`,
        user_id: user?.id,
        pharmacy_id: user?.pharmacy_id
      });
    }

    // Update supplier total_debt if purchase is deferred (for new purchases only)
    if (!isEditing && !isPaid) {
      const { data: sup } = await supabase.from('suppliers').select('total_debt').eq('id', supplierId).single();
      if (sup) {
        await supabase.from('suppliers').update({ total_debt: (sup.total_debt || 0) + total }).eq('id', supplierId);
      }
    }

    alert(isEditing ? "تم تعديل الفاتورة بنجاح" : "تم حفظ فاتورة المشتريات بنجاح وإضافة الكميات للمخزون");
    
    if (isEditing) {
      router.push('/dashboard/purchases/list');
    } else {
      // Reset Form
      setInvoiceNumber(`PUR-${Date.now().toString().slice(-6)}`);
      setItems([]);
      setDiscount(0);
      setTax(0);
    }
  };

  const handleAddSupplier = async () => {
    if (!newSupplierName.trim()) return;
    const { data, error } = await supabase.from('suppliers').insert({ 
      name: newSupplierName.trim(),
      pharmacy_id: user?.pharmacy_id
    }).select('*').single();
    if (error) {
      alert("خطأ أثناء إضافة المورد: " + error.message);
    } else if (data) {
      setSuppliers([...suppliers, data]);
      setSupplierId(data.id);
      setIsSupplierModalOpen(false);
      setNewSupplierName("");
    }
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const parsed = parseCSV(text);
      if (parsed.length < 2) {
        alert("ملف الـ CSV فارغ أو يحتوي على رأس الجدول فقط");
        return;
      }

      const headers = parsed[0];
      const dataRows = parsed.slice(1);

      setCsvHeaders(headers);
      setCsvData(dataRows);
      
      const newMapping = {
        product_name: "",
        barcode: "",
        quantity: "",
        unit_cost: "",
        selling_price: "",
        bonus_quantity: "",
        extra_discount_percent: "",
        batch_number: "",
        expiry_date: "",
      };

      headers.forEach((header) => {
        const h = header.toLowerCase().trim();
        if (h.includes("اسم") || h.includes("الاسم") || h.includes("name") || h.includes("product")) {
          newMapping.product_name = header;
        } else if (h.includes("باركود") || h.includes("كود") || h.includes("barcode") || h.includes("code")) {
          newMapping.barcode = header;
        } else if (h.includes("كمية") || h.includes("الكمية") || h.includes("qty") || h.includes("quantity")) {
          newMapping.quantity = header;
        } else if (h.includes("شراء") || h.includes("تكلفة") || h.includes("cost") || h.includes("purchase_price")) {
          newMapping.unit_cost = header;
        } else if (h.includes("بيع") || h.includes("سعر البيع") || h.includes("price") || h.includes("selling_price")) {
          newMapping.selling_price = header;
        } else if (h.includes("بونص") || h.includes("مجاني") || h.includes("bonus")) {
          newMapping.bonus_quantity = header;
        } else if (h.includes("خصم") || h.includes("discount")) {
          newMapping.extra_discount_percent = header;
        } else if (h.includes("تشغيلة") || h.includes("batch")) {
          newMapping.batch_number = header;
        } else if (h.includes("صلاحية") || h.includes("expiry") || h.includes("date")) {
          newMapping.expiry_date = header;
        }
      });

      setMapping(newMapping);
      setIsMappingModalOpen(true);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleConfirmMapping = () => {
    if (!mapping.product_name && !mapping.barcode) {
      return alert("يجب تحديد حقل الاسم أو الباركود على الأقل لربط المنتجات");
    }
    if (!mapping.quantity) {
      return alert("يجب تحديد حقل الكمية");
    }
    if (!mapping.unit_cost) {
      return alert("يجب تحديد حقل سعر الشراء");
    }

    const importedItems: PurchaseItem[] = [];
    let matchCount = 0;
    let failCount = 0;

    csvData.forEach((row) => {
      const getName = () => {
        const idx = csvHeaders.indexOf(mapping.product_name);
        return idx !== -1 ? row[idx] : "";
      };
      const getBarcode = () => {
        const idx = csvHeaders.indexOf(mapping.barcode);
        return idx !== -1 ? row[idx] : "";
      };
      const getQuantity = () => {
        const idx = csvHeaders.indexOf(mapping.quantity);
        return idx !== -1 ? Number(row[idx]) || 0 : 0;
      };
      const getUnitCost = () => {
        const idx = csvHeaders.indexOf(mapping.unit_cost);
        return idx !== -1 ? Number(row[idx]) || 0 : 0;
      };
      const getSellingPrice = () => {
        const idx = csvHeaders.indexOf(mapping.selling_price);
        return idx !== -1 ? Number(row[idx]) || 0 : 0;
      };
      const getBonus = () => {
        const idx = csvHeaders.indexOf(mapping.bonus_quantity);
        return idx !== -1 ? Number(row[idx]) || 0 : 0;
      };
      const getDiscount = () => {
        const idx = csvHeaders.indexOf(mapping.extra_discount_percent);
        return idx !== -1 ? Number(row[idx]) || 0 : 0;
      };
      const getBatch = () => {
        const idx = csvHeaders.indexOf(mapping.batch_number);
        return idx !== -1 ? row[idx] : "";
      };
      const getExpiry = () => {
        const idx = csvHeaders.indexOf(mapping.expiry_date);
        return idx !== -1 ? row[idx] : "";
      };

      const rowBarcode = getBarcode();
      const rowName = getName();

      let matchedProd = null;
      if (rowBarcode) {
        matchedProd = products.find(p => p.barcode === rowBarcode);
      }
      if (!matchedProd && rowName) {
        const cleanRowName = rowName.toLowerCase().trim();
        matchedProd = products.find(p => p.name?.toLowerCase().trim() === cleanRowName);
      }

      if (matchedProd) {
        matchCount++;
        const qty = getQuantity();
        const cost = getUnitCost();
        const bonus = getBonus();
        const disc = getDiscount();
        const sell = getSellingPrice() || matchedProd.selling_price || 0;
        const batch = getBatch() || `B-${Date.now().toString().slice(-4)}`;
        const expiry = getExpiry() || new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0];

        const totalCost = qty * cost * (1 - disc / 100);
        const effectiveUnitCost = (qty + bonus) > 0 ? totalCost / (qty + bonus) : 0;

        importedItems.push({
          id: Math.random().toString(),
          product: matchedProd,
          quantity: qty,
          unit_cost: cost,
          bonus_quantity: bonus,
          extra_discount_percent: disc,
          effective_unit_cost: effectiveUnitCost,
          selling_price: sell,
          total_cost: totalCost,
          batch_number: batch,
          expiry_date: expiry
        });
      } else {
        failCount++;
      }
    });

    if (importedItems.length > 0) {
      setItems(prev => [...importedItems, ...prev]);
      alert(`تم استيراد ${matchCount} من المنتجات بنجاح. ${failCount > 0 ? `فشل مطابقة ${failCount} صنف.` : ""}`);
    } else {
      alert("فشل مطابقة أي منتج من الملف مع المنتجات المسجلة في النظام.");
    }

    setIsMappingModalOpen(false);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Hidden file input for CSV imports */}
      <input 
        type="file" 
        id="csv-file-uploader" 
        accept=".csv" 
        className="hidden" 
        onChange={handleImportCSV} 
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Receipt className="text-primary" />
            {isEditing ? "تعديل فاتورة مشتريات" : "إضافة فاتورة مشتريات"}
          </h1>
          <p className="text-slate-500">إدخال بضاعة جديدة للمخزن وتسجيل التكلفة</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            className="bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700" 
            onClick={() => document.getElementById('csv-file-uploader')?.click()}
          >
            <Receipt size={16} className="ml-2" />
            استيراد فاتورة إلكترونية (CSV)
          </Button>

          <Link href="/dashboard/purchases/list">
            <Button variant="outline" className="bg-white text-slate-600 border-slate-200">
              <FileText size={16} className="ml-2" />
              سجل الفواتير السابقة
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Col: Invoice details */}
        <Card className="md:col-span-1 shadow-sm border-0 bg-white">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
            <CardTitle className="text-base text-slate-700 flex items-center gap-2">
              <Building2 size={18} className="text-primary"/> بيانات الفاتورة
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">رقم الفاتورة</label>
              <Input value={invoiceNumber} readOnly className="bg-slate-100 text-slate-500 cursor-not-allowed" />
            </div>
            
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">المورد</label>
              <div className="flex gap-2">
                <select 
                  className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm"
                  value={supplierId}
                  onChange={e => setSupplierId(e.target.value)}
                >
                  <option value="">اختر المورد...</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <Button variant="outline" size="icon" onClick={() => setIsSupplierModalOpen(true)}><Plus size={16}/></Button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">تاريخ الشراء</label>
              <div className="relative">
                <CalendarIcon size={16} className="absolute right-3 top-3 text-slate-400" />
                <Input type="date" className="pr-9" value={date} onChange={e => setDate(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">طريقة الدفع</label>
              <select 
                className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm"
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
              >
                <option value="cash">كاش</option>
                <option value="visa">فيزا</option>
                <option value="deferred">آجل</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Right Col: Add Items & Items List */}
        <div className="md:col-span-2 space-y-6">
          {/* Add Item Card */}
          <Card className="shadow-sm border-0 bg-white overflow-visible">
            <CardContent className="p-4 space-y-4">
              <div className="relative">
                <label className="text-xs font-bold text-slate-500 mb-1 block">البحث عن منتج</label>
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
                  <div className="md:col-span-2">
                    <label className="text-xs font-bold text-slate-500 mb-1 block">الكمية المدفوعة (علبة)</label>
                    <Input 
                      type="number" 
                      value={currentItem.quantity} 
                      onChange={e => setCurrentItem({...currentItem, quantity: Number(e.target.value)})} 
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs font-bold text-slate-500 mb-1 block">الكمية المجانية (البونص)</label>
                    <Input 
                      type="number" 
                      value={currentItem.bonus_quantity} 
                      onChange={e => setCurrentItem({...currentItem, bonus_quantity: Number(e.target.value)})} 
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs font-bold text-slate-500 mb-1 block">الخصم الإضافي (%)</label>
                    <Input 
                      type="number" 
                      value={currentItem.extra_discount_percent} 
                      onChange={e => setCurrentItem({...currentItem, extra_discount_percent: Number(e.target.value)})} 
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs font-bold text-slate-500 mb-1 block">سعر الشراء (للعلبة)</label>
                    <Input 
                      type="number" 
                      value={currentItem.unit_cost} 
                      onChange={e => setCurrentItem({...currentItem, unit_cost: Number(e.target.value)})} 
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs font-bold text-slate-500 mb-1 block">التكلفة الفعلية للعلبة</label>
                    <div className="h-10 px-3 flex items-center bg-slate-100 text-slate-700 font-bold border border-slate-200 rounded-md text-sm">
                      {((currentItem.quantity * currentItem.unit_cost * (1 - (currentItem.extra_discount_percent || 0) / 100)) / (currentItem.quantity + (currentItem.bonus_quantity || 0) || 1)).toFixed(2)} ج.م
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs font-bold text-slate-500 mb-1 block">سعر البيع المقترح</label>
                    <Input 
                      type="number" 
                      value={currentItem.selling_price} 
                      onChange={e => setCurrentItem({...currentItem, selling_price: Number(e.target.value)})} 
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="text-xs font-bold text-slate-500 mb-1 block">رقم التشغيلة (Batch)</label>
                    <Input 
                      value={currentItem.batch_number} 
                      onChange={e => setCurrentItem({...currentItem, batch_number: e.target.value})} 
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="text-xs font-bold text-slate-500 mb-1 block">تاريخ الصلاحية</label>
                    <Input 
                      type="date"
                      value={currentItem.expiry_date} 
                      onChange={e => setCurrentItem({...currentItem, expiry_date: e.target.value})} 
                    />
                  </div>
                  <div className="col-span-2 md:col-span-6 flex justify-end">
                    <Button onClick={handleAddItem} className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 text-white">
                      إضافة للفاتورة <ArrowRight size={16} className="mr-2"/>
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Items Table */}
          <Card className="shadow-sm border-0 bg-white">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="text-right">المنتج</TableHead>
                    <TableHead className="text-right">التشغيلة / الصلاحية</TableHead>
                    <TableHead className="text-center">الكمية (المدفوعة + البونص)</TableHead>
                    <TableHead className="text-center">سعر الشراء</TableHead>
                    <TableHead className="text-center">الخصم الإضافي</TableHead>
                    <TableHead className="text-center">التكلفة الفعلية</TableHead>
                    <TableHead className="text-center">سعر البيع</TableHead>
                    <TableHead className="text-center">الإجمالي</TableHead>
                    <TableHead className="text-center"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-slate-500">
                        لم يتم إضافة منتجات للفاتورة
                      </TableCell>
                    </TableRow>
                  ) : items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <p className="font-bold text-slate-800 text-sm">{item.product.name}</p>
                        <p className="text-xs text-slate-500 font-mono">{item.product.barcode}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium text-slate-700">{item.batch_number || 'N/A'}</p>
                        <p className="text-xs text-red-500">{item.expiry_date || 'N/A'}</p>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-bold text-slate-800">{item.quantity}</span>
                        {item.bonus_quantity > 0 && (
                          <span className="text-xs text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded mr-1 font-semibold">
                            +{item.bonus_quantity} بونص
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-mono">{item.unit_cost.toFixed(2)} ج.م</TableCell>
                      <TableCell className="text-center text-rose-500 font-mono">
                        {item.extra_discount_percent > 0 ? `${item.extra_discount_percent}%` : '-'}
                      </TableCell>
                      <TableCell className="text-center text-emerald-600 font-bold font-mono bg-emerald-50/50">
                        {(item.effective_unit_cost || item.unit_cost).toFixed(2)} ج.م
                      </TableCell>
                      <TableCell className="text-center text-teal-600 font-mono">{item.selling_price.toFixed(2)} ج.م</TableCell>
                      <TableCell className="text-center font-bold text-primary font-mono">{item.total_cost.toFixed(2)} ج.م</TableCell>
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

          {/* Totals & Save */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="shadow-sm border-0 bg-white">
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">الخصم (ج.م)</label>
                    <Input type="number" value={discount} onChange={e => setDiscount(Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">الضريبة (ج.م)</label>
                    <Input type="number" value={tax} onChange={e => setTax(Number(e.target.value))} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-0 bg-slate-900 text-white">
              <CardContent className="p-6">
                <div className="space-y-3 mb-6 text-sm">
                  <div className="flex justify-between items-center text-slate-300">
                    <span>الإجمالي الفرعي:</span>
                    <span className="font-mono">{subtotal.toFixed(2)} ج.م</span>
                  </div>
                  <div className="flex justify-between items-center text-rose-400">
                    <span>الخصم:</span>
                    <span className="font-mono">-{discount.toFixed(2)} ج.م</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-300 border-b border-slate-700 pb-3">
                    <span>الضرائب:</span>
                    <span className="font-mono">+{tax.toFixed(2)} ج.م</span>
                  </div>
                  <div className="flex justify-between items-center text-xl font-bold pt-1">
                    <span>الصافي:</span>
                    <span className="text-emerald-400 font-mono">{total.toFixed(2)} ج.م</span>
                  </div>
                </div>

                <Button className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-6 text-lg font-bold shadow-lg shadow-emerald-500/20" onClick={handleSavePurchase}>
                  <Save size={20} className="ml-2" />
                  {isEditing ? "حفظ التعديلات" : "حفظ الفاتورة"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={isSupplierModalOpen} onOpenChange={setIsSupplierModalOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة مورد جديد</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <label className="text-xs font-bold text-slate-500 mb-1 block">اسم المورد</label>
            <Input value={newSupplierName} onChange={e => setNewSupplierName(e.target.value)} placeholder="شركة الأدوية..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSupplierModalOpen(false)}>إلغاء</Button>
            <Button onClick={handleAddSupplier}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isMappingModalOpen} onOpenChange={setIsMappingModalOpen}>
        <DialogContent className="max-w-xl bg-white border border-slate-200 shadow-2xl rounded-2xl p-6" dir="rtl">
          <DialogHeader className="border-b border-slate-100 pb-4 mb-4">
            <DialogTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Receipt className="text-emerald-500" />
              مطابقة أعمدة فاتورة الشراء الإلكترونية (Mapping Wizard)
            </DialogTitle>
          </DialogHeader>
          
          <p className="text-sm text-slate-500 mb-4">
            الرجاء ربط حقول النظام مع أعمدة ملف الـ CSV الذي قمت برفعه لتنزيل البيانات بشكل آلي ودقيق.
          </p>

          <div className="grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto p-1">
            {/* Left side: Required fields */}
            <div className="col-span-2 font-bold text-sm text-slate-700 border-b border-slate-100 pb-2 mb-2">الحقول الأساسية</div>
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 block">اسم المنتج</label>
              <select 
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm"
                value={mapping.product_name}
                onChange={e => setMapping({...mapping, product_name: e.target.value})}
              >
                <option value="">-- اختر العمود --</option>
                {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 block">الباركود</label>
              <select 
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm"
                value={mapping.barcode}
                onChange={e => setMapping({...mapping, barcode: e.target.value})}
              >
                <option value="">-- اختر العمود --</option>
                {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 block">الكمية المدفوعة *</label>
              <select 
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm"
                value={mapping.quantity}
                onChange={e => setMapping({...mapping, quantity: e.target.value})}
              >
                <option value="">-- اختر العمود --</option>
                {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 block">سعر الشراء (للعلبة) *</label>
              <select 
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm"
                value={mapping.unit_cost}
                onChange={e => setMapping({...mapping, unit_cost: e.target.value})}
              >
                <option value="">-- اختر العمود --</option>
                {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>

            <div className="col-span-2 font-bold text-sm text-slate-700 border-b border-slate-100 pb-2 mt-4 mb-2">الحقول الإضافية والمتقدمة (اختياري)</div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 block">سعر البيع</label>
              <select 
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm"
                value={mapping.selling_price}
                onChange={e => setMapping({...mapping, selling_price: e.target.value})}
              >
                <option value="">-- اختر العمود --</option>
                {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 block">الكمية المجانية (البونص)</label>
              <select 
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm"
                value={mapping.bonus_quantity}
                onChange={e => setMapping({...mapping, bonus_quantity: e.target.value})}
              >
                <option value="">-- اختر العمود --</option>
                {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 block">الخصم الإضافي %</label>
              <select 
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm"
                value={mapping.extra_discount_percent}
                onChange={e => setMapping({...mapping, extra_discount_percent: e.target.value})}
              >
                <option value="">-- اختر العمود --</option>
                {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 block">رقم التشغيلة (Batch)</label>
              <select 
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm"
                value={mapping.batch_number}
                onChange={e => setMapping({...mapping, batch_number: e.target.value})}
              >
                <option value="">-- اختر العمود --</option>
                {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>

            <div className="space-y-2 col-span-2">
              <label className="text-xs font-bold text-slate-600 block">تاريخ الصلاحية</label>
              <select 
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm"
                value={mapping.expiry_date}
                onChange={e => setMapping({...mapping, expiry_date: e.target.value})}
              >
                <option value="">-- اختر العمود --</option>
                {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>

          <DialogFooter className="mt-6 border-t border-slate-100 pt-4 flex gap-2 justify-end">
            <Button variant="outline" className="border-slate-200 text-slate-600 hover:bg-slate-50" onClick={() => setIsMappingModalOpen(false)}>
              إلغاء
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold" onClick={handleConfirmMapping}>
              استيراد بنود الفاتورة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function PurchasesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">جاري التحميل...</div>}>
      <PurchasesContent />
    </Suspense>
  );
}
