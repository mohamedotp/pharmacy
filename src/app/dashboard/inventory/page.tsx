"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Download, Filter, Edit, Trash2, ArrowUpRight, Clock, AlertTriangle, CheckCircle2, Eye, Calendar, Building2, PackageCheck, Printer, Receipt, TrendingUp, TrendingDown, ClipboardCheck, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth-store";
import Link from "next/link";
import { toast } from "sonner";

const initialForm = {
  name: "",
  barcode: "",
  active_ingredient: "",
  category_id: "",
  purchase_price: 0,
  selling_price: 0,
  stock_quantity: 0,
  min_stock_alert: 10,
  strips_per_box: 1,
  pills_per_strip: 1,
  image_url: "",
  strip_barcode: "",
  pill_barcode: "",
};

export default function InventoryPage() {
  const { user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "available" | "low" | "out">("all");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [categories, setCategories] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  // CRUD State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(initialForm);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  // Details Modal State
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedProductDetails, setSelectedProductDetails] = useState<any>(null);
  const [productPurchaseHistory, setProductPurchaseHistory] = useState<any[]>([]);
  const [productBatches, setProductBatches] = useState<any[]>([]);
  const [productStockMoves, setProductStockMoves] = useState<any[]>([]);
  const [detailsTab, setDetailsTab] = useState<'purchases' | 'batches' | 'moves'>('batches');

  // Barcode Modal State
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [barcodeProduct, setBarcodeProduct] = useState<any>(null);

  // Bulk Barcode Print State
  const [isBulkBarcodeOpen, setIsBulkBarcodeOpen] = useState(false);
  const [bulkPrintQty, setBulkPrintQty] = useState<Record<string, number>>({});

  // CSV Import State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [parsedProducts, setParsedProducts] = useState<any[]>([]);
  const [importLoading, setImportLoading] = useState(false);

  // Inventory Adjustment State
  const [isAdjustmentOpen, setIsAdjustmentOpen] = useState(false);
  const [adjustmentProduct, setAdjustmentProduct] = useState<any>(null);
  const [adjustmentBatches, setAdjustmentBatches] = useState<any[]>([]);
  const [adjustmentItems, setAdjustmentItems] = useState<Array<{
    product_id: string;
    batch_id: string | null;
    batch_number: string;
    system_quantity: number;
    real_quantity: number;
    reason: string;
  }>>([]);
  const [adjustmentNote, setAdjustmentNote] = useState("");
  const [adjustmentSaving, setAdjustmentSaving] = useState(false);

  // Adjustment History
  const [isAdjHistoryOpen, setIsAdjHistoryOpen] = useState(false);
  const [adjHistory, setAdjHistory] = useState<any[]>([]);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch categories for filter
    const { data: catsData } = await supabase.from('categories').select('*');
    if (catsData) setCategories(catsData);

    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        categories (name),
        product_batches (id, expiry_date, quantity)
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setProducts(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Barcode keyboard listener for inventory page search
  useEffect(() => {
    let buffer = "";
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || activeEl.tagName === "SELECT")) {
        return;
      }

      const currentTime = Date.now();
      if (currentTime - lastKeyTime > 100) {
        buffer = "";
      }
      lastKeyTime = currentTime;

      if (e.key === "Enter") {
        if (buffer.trim().length > 3) {
          e.preventDefault();
          setSearchQuery(buffer.trim());
          toast.success(`تم قراءة الباركود: ${buffer.trim()}`);
          buffer = "";
        }
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, categoryFilter]);

  const filteredProducts = useMemo(() => {
    let result = products;

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.name?.toLowerCase().includes(q) || 
        p.barcode?.toLowerCase().includes(q) || 
        p.strip_barcode?.toLowerCase().includes(q) || 
        p.pill_barcode?.toLowerCase().includes(q) || 
        p.categories?.name?.toLowerCase().includes(q)
      );
    }

    // Status Filter
    if (statusFilter === 'available') {
      result = result.filter(p => p.stock_quantity > (p.min_stock_alert || 0));
    } else if (statusFilter === 'low') {
      result = result.filter(p => p.stock_quantity > 0 && p.stock_quantity <= (p.min_stock_alert || 0));
    } else if (statusFilter === 'out') {
      result = result.filter(p => p.stock_quantity <= 0);
    }

    // Category Filter
    if (categoryFilter !== 'all') {
      result = result.filter(p => p.category_id === categoryFilter);
    }

    return result;
  }, [products, searchQuery, statusFilter, categoryFilter]);

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE) || 1;
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const totalItemsCount = products.length;
  const outOfStockCount = products.filter(p => p.stock_quantity <= 0).length;
  const lowStockCount = products.filter(p => p.stock_quantity > 0 && p.stock_quantity <= (p.min_stock_alert || 0)).length;
  const totalInventoryValue = products.reduce((acc, p) => acc + ((p.stock_quantity || 0) * (p.purchase_price || 0)), 0);

  const exportToCSV = () => {
    const headers = ["Barcode", "Name", "Category", "Stock", "Price"];
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + 
      headers.join(",") + "\n" + 
      filteredProducts.map(p => 
        `${p.barcode},${p.name},${p.categories?.name || ''},${p.stock_quantity},${p.selling_price}`
      ).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "inventory_report.csv");
    document.body.appendChild(link);
    link.click();
  };

  const handleDownloadTemplate = () => {
    const headers = ["Barcode", "Name", "CategoryName", "SellingPrice", "PurchasePrice", "StockQuantity", "MinStockAlert"];
    const demoRow = ["6221000123456", "Panadol Extra 24 Tab", "Analgesics", "35.00", "28.00", "100", "10"];
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + 
      headers.join(",") + "\n" + demoRow.join(",");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "pharmacy_products_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/);
      if (lines.length < 2) {
        toast.error("الملف فارغ أو غير صالح");
        return;
      }

      const headers = lines[0].split(",").map(h => h.trim().replace(/^["']|["']$/g, ""));
      const required = ["Barcode", "Name", "CategoryName", "SellingPrice", "PurchasePrice", "StockQuantity"];
      
      const missing = required.filter(r => !headers.includes(r));
      if (missing.length > 0) {
        toast.error(`رؤوس الأعمدة التالية مفقودة: ${missing.join(", ")}`);
        return;
      }

      const productsList: any[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const row = parseCSVRow(line);
        if (row.length < headers.length) continue;

        const record: Record<string, string> = {};
        headers.forEach((header, index) => {
          record[header] = row[index]?.trim().replace(/^["']|["']$/g, "") || "";
        });

        if (!record.Name || !record.Barcode) {
          continue;
        }

        productsList.push({
          barcode: record.Barcode,
          name: record.Name,
          category_name: record.CategoryName || "أخرى",
          selling_price: parseFloat(record.SellingPrice) || 0,
          purchase_price: parseFloat(record.PurchasePrice) || 0,
          stock_quantity: parseInt(record.StockQuantity) || 0,
          min_stock_alert: parseInt(record.MinStockAlert) || 10,
        });
      }

      setParsedProducts(productsList);
      toast.success(`تم العثور على ${productsList.length} منتج في الملف`);
    };

    reader.readAsText(file, "UTF-8");
  };

  const parseCSVRow = (text: string): string[] => {
    const result: string[] = [];
    let insideQuote = false;
    let entry = "";
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"' || char === "'") {
        insideQuote = !insideQuote;
      } else if (char === ',' && !insideQuote) {
        result.push(entry);
        entry = "";
      } else {
        entry += char;
      }
    }
    result.push(entry);
    return result;
  };

  const handleSaveImport = async () => {
    if (parsedProducts.length === 0) {
      toast.error("لا توجد منتجات صالحة للاستيراد");
      return;
    }

    setImportLoading(true);

    try {
      const uniqueCategoryNames = Array.from(new Set(parsedProducts.map(p => p.category_name)));
      const { data: existingCats } = await supabase.from('categories').select('*');
      
      const catMap: Record<string, string> = {};
      existingCats?.forEach(c => {
        catMap[c.name.toLowerCase()] = c.id;
      });

      for (const catName of uniqueCategoryNames) {
        const lowerName = catName.toLowerCase();
        if (!catMap[lowerName]) {
          const { data: newCat, error: catErr } = await supabase
            .from('categories')
            .insert({ name: catName })
            .select()
            .single();
          
          if (!catErr && newCat) {
            catMap[lowerName] = newCat.id;
          }
        }
      }

      const finalProducts = parsedProducts.map(p => ({
        barcode: p.barcode,
        name: p.name,
        category_id: catMap[p.category_name.toLowerCase()] || null,
        selling_price: p.selling_price,
        purchase_price: p.purchase_price,
        stock_quantity: p.stock_quantity,
        min_stock_alert: p.min_stock_alert,
      }));

      const { error } = await supabase.from('products').insert(finalProducts);

      if (error) {
        throw error;
      }

      toast.success("تم استيراد كافة المنتجات وحفظها بالمخزون بنجاح!");
      setIsImportModalOpen(false);
      setParsedProducts([]);
      fetchData();
    } catch (err: any) {
      toast.error("حدث خطأ أثناء الاستيراد: " + err.message);
    } finally {
      setImportLoading(false);
    }
  };

  const generateBarcode = () => {
    return Math.floor(1000000000000 + Math.random() * 9000000000000).toString();
  };

  // CRUD Handlers
  const handleOpenAdd = () => {
    setFormData({
      ...initialForm,
      barcode: generateBarcode()
    });
    setEditingId(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (product: any) => {
    setFormData({
      name: product.name || "",
      barcode: product.barcode || "",
      active_ingredient: product.active_ingredient || "",
      category_id: product.category_id || "",
      purchase_price: product.purchase_price || 0,
      selling_price: product.selling_price || 0,
      stock_quantity: product.stock_quantity || 0,
      min_stock_alert: product.min_stock_alert || 10,
      strips_per_box: product.strips_per_box || 1,
      pills_per_strip: product.pills_per_strip || 1,
      image_url: product.image_url || "",
      strip_barcode: product.strip_barcode || "",
      pill_barcode: product.pill_barcode || "",
    });
    setEditingId(product.id);
    setIsModalOpen(true);
  };

  const handleOpenDetails = async (product: any) => {
    setSelectedProductDetails(product);
    setIsDetailsModalOpen(true);
    setDetailsTab('batches');
    setProductBatches([]);
    setProductPurchaseHistory([]);
    setProductStockMoves([]);
    
    // Fetch batches
    const { data: batches } = await supabase
      .from('product_batches')
      .select('*')
      .eq('product_id', product.id)
      .order('expiry_date', { ascending: true });
    
    if (batches) setProductBatches(batches);

    // Fetch purchase history
    const { data: history } = await supabase
      .from('purchase_items')
      .select(`
        id,
        quantity,
        unit_cost,
        purchases (
          created_at,
          invoice_number,
          suppliers ( name )
        )
      `)
      .eq('product_id', product.id);
    
    if (history) {
      const sortedHistory = history.sort((a: any, b: any) => {
        const dateA = a.purchases?.created_at ? new Date(a.purchases.created_at).getTime() : 0;
        const dateB = b.purchases?.created_at ? new Date(b.purchases.created_at).getTime() : 0;
        return dateB - dateA;
      });
      setProductPurchaseHistory(sortedHistory);
    }

    // Fetch stock moves
    const { data: moves } = await supabase
      .from('stock_moves')
      .select('*, users(full_name)')
      .eq('product_id', product.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (moves) setProductStockMoves(moves);
  };

  const handleOpenAdjustment = async (product: any) => {
    setAdjustmentProduct(product);
    setAdjustmentNote("");
    const { data: batches } = await supabase
      .from('product_batches')
      .select('*')
      .eq('product_id', product.id)
      .order('expiry_date', { ascending: true });
    const batchList = batches || [];
    setAdjustmentBatches(batchList);
    if (batchList.length > 0) {
      setAdjustmentItems(batchList.map((b: any) => ({
        product_id: product.id,
        batch_id: b.id,
        batch_number: b.batch_number,
        system_quantity: b.quantity,
        real_quantity: b.quantity,
        reason: 'reconciliation',
      })));
    } else {
      setAdjustmentItems([{
        product_id: product.id,
        batch_id: null,
        batch_number: 'مخزون عام',
        system_quantity: product.stock_quantity || 0,
        real_quantity: product.stock_quantity || 0,
        reason: 'reconciliation',
      }]);
    }
    setIsAdjustmentOpen(true);
  };

  const handleSaveAdjustment = async () => {
    if (!adjustmentProduct) return;
    setAdjustmentSaving(true);
    try {
      // Create adjustment session
      const { data: adjData } = await supabase.from('inventory_adjustments').insert({
        adjusted_by: user?.id,
        notes: adjustmentNote,
        status: 'completed',
        pharmacy_id: user?.pharmacy_id,
      }).select('id').single();
      if (!adjData) throw new Error('Failed to create adjustment');

      const adjId = adjData.id;
      for (const item of adjustmentItems) {
        const diff = item.real_quantity - item.system_quantity;
        if (diff === 0) continue;

        // Insert adjustment item record
        await supabase.from('inventory_adjustment_items').insert({
          adjustment_id: adjId,
          product_id: item.product_id,
          batch_id: item.batch_id,
          system_quantity: item.system_quantity,
          real_quantity: item.real_quantity,
          difference: diff,
          reason: item.reason,
          pharmacy_id: user?.pharmacy_id,
        });

        // Update batch quantity if applicable
        if (item.batch_id) {
          await supabase.from('product_batches')
            .update({ quantity: item.real_quantity })
            .eq('id', item.batch_id);
        }

        // Update product total stock
        const { data: prod } = await supabase.from('products').select('stock_quantity').eq('id', item.product_id).single();
        if (prod) {
          await supabase.from('products').update({
            stock_quantity: Math.max(0, (prod.stock_quantity || 0) + diff)
          }).eq('id', item.product_id);
        }

        // Log stock move
        await supabase.from('stock_moves').insert({
          product_id: item.product_id,
          batch_id: item.batch_id,
          quantity_changed: diff,
          type: 'adjustment',
          reference_id: adjId,
          reference_name: `تسوية جرد - ${item.reason === 'damaged' ? 'تالف' : item.reason === 'expired' ? 'منتهي الصلاحية' : item.reason === 'lost' ? 'مفقود' : item.reason === 'found' ? 'وجد' : 'تسوية عامة'}`,
          user_id: user?.id,
          pharmacy_id: user?.pharmacy_id,
        });
      }

      toast.success('تم حفظ تسوية الجرد بنجاح!');
      setIsAdjustmentOpen(false);
      fetchData();
    } catch (e: any) {
      toast.error('حدث خطأ: ' + e.message);
    } finally {
      setAdjustmentSaving(false);
    }
  };

  const handleOpenAdjHistory = async () => {
    const { data } = await supabase
      .from('inventory_adjustments')
      .select('*, users(full_name), inventory_adjustment_items(*, products(name))')
      .order('created_at', { ascending: false })
      .limit(20);
    setAdjHistory(data || []);
    setIsAdjHistoryOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.barcode || !formData.selling_price) {
      alert("الرجاء تعبئة الحقول الإلزامية (الاسم، الباركود، سعر البيع)");
      return;
    }

    const payload = {
      name: formData.name,
      barcode: formData.barcode,
      active_ingredient: formData.active_ingredient || null,
      category_id: formData.category_id || null,
      selling_price: formData.selling_price,
      min_stock_alert: formData.min_stock_alert,
      strips_per_box: formData.strips_per_box,
      pills_per_strip: formData.pills_per_strip,
      image_url: formData.image_url,
      strip_barcode: formData.strip_barcode || null,
      pill_barcode: formData.pill_barcode || null,
      // NOTE: purchase_price and stock_quantity are updated via Purchases
    };

    if (editingId) {
      const { error } = await supabase.from('products').update(payload).eq('id', editingId);
      if (!error) {
        setIsModalOpen(false);
        fetchData();
      } else {
        alert("خطأ أثناء التعديل: " + error.message);
      }
    } else {
      const { error } = await supabase.from('products').insert(payload);
      if (!error) {
        setIsModalOpen(false);
        fetchData();
      } else {
        alert("خطأ أثناء الإضافة: " + error.message);
      }
    }
  };

  const handleDelete = async (ids: string[]) => {
    if (!window.confirm(`هل أنت متأكد من حذف ${ids.length} منتج؟`)) return;
    const { error } = await supabase.from('products').delete().in('id', ids);
    if (!error) {
      setProducts(products.filter(p => !ids.includes(p.id)));
      setSelectedProducts([]);
    } else {
      alert("حدث خطأ أثناء الحذف: " + error.message);
    }
  };

  const toggleSelectAll = () => {
    if (selectedProducts.length === paginatedProducts.length && paginatedProducts.length > 0) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(paginatedProducts.map(p => p.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedProducts(prev => 
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  };

  const handleAddCategory = async () => {
    const newCatName = window.prompt("أدخل اسم الفئة الجديدة:");
    if (!newCatName || !newCatName.trim()) return;

    const { data, error } = await supabase.from('categories').insert({ name: newCatName.trim() }).select('*').single();
    if (error) {
      alert("خطأ أثناء إضافة الفئة: " + error.message);
    } else if (data) {
      setCategories([...categories, data]);
      setFormData({ ...formData, category_id: data.id });
    }
  };

  const handleOpenBarcode = (product: any) => {
    setBarcodeProduct(product);
    setIsBarcodeModalOpen(true);
  };

  const handlePrintBarcode = () => {
    const printContent = document.getElementById('barcode-print-area');
    if (!printContent) return;
    const win = window.open('', '', 'width=400,height=300');
    if (!win) return;
    win.document.write('<html><head><title>طباعة الباركود</title><style>body { text-align: center; margin-top: 20px; font-family: sans-serif; }</style></head><body>');
    win.document.write(printContent.innerHTML);
    win.document.write('</body></html>');
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  const handleOpenBulkBarcode = () => {
    const selected = products.filter(p => selectedProducts.includes(p.id));
    const initQty: Record<string, number> = {};
    selected.forEach(p => { initQty[p.id] = 1; });
    setBulkPrintQty(initQty);
    setIsBulkBarcodeOpen(true);
  };

  const handleBulkPrint = () => {
    const selected = products.filter(p => selectedProducts.includes(p.id));
    const win = window.open('', '', 'width=600,height=800');
    if (!win) return;

    let html = `<html><head><title>طباعة باركود</title><style>
      @page { size: 58mm auto; margin: 2mm; }
      body { margin: 0; padding: 0; font-family: Arial, sans-serif; background: white; }
      .label { 
        width: 54mm; 
        text-align: center; 
        padding: 3mm 2mm; 
        page-break-after: always;
        border-bottom: 1px dashed #ccc;
        margin-bottom: 2mm;
      }
      .label:last-child { page-break-after: avoid; border-bottom: none; }
      .name { font-size: 9pt; font-weight: bold; margin-bottom: 2mm; line-height: 1.2; }
      .price { font-size: 10pt; font-weight: bold; margin-top: 2mm; }
      .barcode-num { font-size: 7pt; color: #666; margin-top: 1mm; font-family: monospace; }
      img { max-width: 50mm; height: 16mm; }
    </style></head><body>`;

    selected.forEach(product => {
      const qty = bulkPrintQty[product.id] || 1;
      for (let i = 0; i < qty; i++) {
        html += `<div class="label">
          <div class="name">${product.name}</div>
          <img src="https://barcode.tec-it.com/barcode.ashx?data=${product.barcode}&code=Code128&translate-esc=on&dpi=200" />
          <div class="barcode-num">${product.barcode}</div>
          <div class="price">${product.selling_price} ج.م</div>
        </div>`;
      }
    });

    html += '</body></html>';
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 800);
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">إدارة المنتجات والمخزون</h1>
          <p className="text-slate-500">عرض وتعديل وتتبع حركة المخزون مع جرد دوري موثق</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/dashboard/sales/list">
            <Button variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100">
              <Receipt size={16} className="ml-2" />
              فواتير المبيعات
            </Button>
          </Link>
          <Link href="/dashboard/purchases/list">
            <Button variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100 font-bold">
              <Building2 size={16} className="ml-2" />
              إدارة الموردين
            </Button>
          </Link>
          <Button variant="outline" className="bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100 font-bold" onClick={handleOpenAdjHistory}>
            <History size={16} className="ml-2" />
            سجل الجرد
          </Button>
          <Button variant="outline" className="bg-white text-slate-600" onClick={exportToCSV}>
            <Download size={16} className="ml-2" />
            تصدير التقرير
          </Button>
          <Button variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100 font-bold" onClick={() => setIsImportModalOpen(true)}>
            <Plus size={16} className="ml-2" />
            استيراد CSV
          </Button>
          <Button className="bg-primary text-white" onClick={handleOpenAdd}>
            <Plus size={16} className="ml-2" />
            إضافة منتج جديد
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card 
          onClick={() => setStatusFilter('all')} 
          className={`border transition-all cursor-pointer hover:shadow-md hover:border-primary/40 active:scale-[0.98] ${
            statusFilter === 'all' ? 'border-primary ring-2 ring-primary/10 bg-primary/5' : 'border-slate-100 bg-white'
          }`}
        >
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 mb-1">إجمالي الأصناف</p>
              <h3 className="text-xl font-extrabold text-slate-800">{totalItemsCount.toLocaleString()}</h3>
            </div>
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
              <CheckCircle2 size={20} />
            </div>
          </CardContent>
        </Card>

        <Card 
          onClick={() => setStatusFilter('low')} 
          className={`border transition-all cursor-pointer hover:shadow-md hover:border-amber-400 active:scale-[0.98] ${
            statusFilter === 'low' ? 'border-amber-500 ring-2 ring-amber-100 bg-amber-50/50' : 'border-slate-100 bg-white'
          }`}
        >
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 mb-1">أصناف منخفضة</p>
              <h3 className="text-xl font-extrabold text-amber-600">{lowStockCount.toLocaleString()}</h3>
            </div>
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600">
              <AlertTriangle size={20} />
            </div>
          </CardContent>
        </Card>

        <Card 
          onClick={() => setStatusFilter('out')} 
          className={`border transition-all cursor-pointer hover:shadow-md hover:border-red-400 active:scale-[0.98] ${
            statusFilter === 'out' ? 'border-red-500 ring-2 ring-red-100 bg-red-50/50' : 'border-slate-100 bg-white'
          }`}
        >
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 mb-1">أصناف منتهية</p>
              <h3 className="text-xl font-extrabold text-red-600">{outOfStockCount.toLocaleString()}</h3>
            </div>
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-red-600">
              <Clock size={20} />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-100 shadow-sm bg-white">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 mb-1">قيمة المخزون (بالتكلفة)</p>
              <h3 className="text-xl font-extrabold text-slate-800">{totalInventoryValue.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} <span className="text-xs text-slate-500">ج.م</span></h3>
            </div>
            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600">
              <ArrowUpRight size={20} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Table Card */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-4 justify-between items-center bg-white">
          <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
            <Button 
              variant="outline" 
              className={statusFilter === 'all' ? "bg-primary/10 text-primary border-primary/20" : "bg-slate-50"}
              onClick={() => setStatusFilter('all')}
            >الكل</Button>
            <Button 
              variant="outline" 
              className={statusFilter === 'available' ? "bg-primary/10 text-primary border-primary/20" : "bg-slate-50"}
              onClick={() => setStatusFilter('available')}
            >متوفر</Button>
            <Button 
              variant="outline" 
              className={statusFilter === 'low' ? "bg-primary/10 text-primary border-primary/20" : "bg-slate-50"}
              onClick={() => setStatusFilter('low')}
            >منخفض</Button>
            <Button 
              variant="outline" 
              className={statusFilter === 'out' ? "bg-primary/10 text-primary border-primary/20" : "bg-slate-50"}
              onClick={() => setStatusFilter('out')}
            >منتهي</Button>
            <Button 
              variant="outline" 
              className={`mr-4 ${showAdvanced ? "bg-primary text-white border-primary" : "bg-slate-50"}`}
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <Filter size={16} className="ml-2" />
              فلترة متقدمة
            </Button>
          </div>
          <div className="w-full md:w-64">
            <Input 
              placeholder="بحث عن منتج، رمز شريطي، فئة..." 
              className="bg-slate-50"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Advanced Filters */}
        {showAdvanced && (
          <div className="p-4 bg-slate-50 border-b border-slate-100 flex gap-4 items-center">
            <div className="w-64">
              <label className="block text-xs text-slate-500 mb-1">الفئة</label>
              <select 
                className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="all">جميع الفئات</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Bulk Actions */}
        <div className="bg-slate-50 p-3 px-4 border-b border-slate-100 flex justify-between items-center text-sm">
          <div className="flex items-center gap-4 text-slate-600">
            <Checkbox 
              id="selectAll" 
              checked={selectedProducts.length > 0 && selectedProducts.length === paginatedProducts.length}
              onCheckedChange={toggleSelectAll}
            />
            <label htmlFor="selectAll" className="cursor-pointer">تم اختيار {selectedProducts.length} منتجات</label>
            <div className="flex gap-2 mr-4">
              <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500" disabled={selectedProducts.length !== 1} onClick={() => {
                const product = products.find(p => p.id === selectedProducts[0]);
                if (product) handleOpenEdit(product);
              }}><Edit size={16}/></Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" disabled={selectedProducts.length === 0} onClick={() => handleDelete(selectedProducts)}><Trash2 size={16}/></Button>
              {/* Bulk Barcode Print Button */}
              {selectedProducts.length >= 2 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-bold gap-1.5 border-[#002B5B] text-[#002B5B] hover:bg-[#002B5B] hover:text-white transition-all"
                  onClick={handleOpenBulkBarcode}
                >
                  <Printer size={14} />
                  طباعة باركود ({selectedProducts.length} منتجات)
                </Button>
              )}
            </div>
          </div>
          <div className="text-slate-500">
            فرز حسب: <span className="font-bold text-slate-700 cursor-pointer">تاريخ الإضافة</span>
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
                <TableHead className="w-12 text-center"></TableHead>
                <TableHead className="text-right">الصورة</TableHead>
                <TableHead className="text-right">اسم المنتج</TableHead>
                <TableHead className="text-right">الفئة</TableHead>
                <TableHead className="text-right">الباركود</TableHead>
                <TableHead className="text-right">السعر</TableHead>
                <TableHead className="text-right">التكلفة</TableHead>
                <TableHead className="text-right">المخزون</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-left">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="bg-white">
              {paginatedProducts.length === 0 && !loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-24 text-center text-slate-500">
                    لا توجد منتجات مطابقة للبحث
                  </TableCell>
                </TableRow>
              ) : (
                paginatedProducts.map((product) => {
                  const isOut = product.stock_quantity <= 0;
                  const isLow = product.stock_quantity > 0 && product.stock_quantity <= (product.min_stock_alert || 0);
                  const statusColor = isOut ? "text-red-600 bg-red-100" : (isLow ? "text-orange-600 bg-orange-100" : "text-teal-600 bg-teal-100");
                  
                  const expiryInfo = (() => {
                    if (!product.product_batches || product.product_batches.length === 0) return null;
                    const today = new Date();
                    const next30Days = new Date();
                    next30Days.setDate(today.getDate() + 30);
                    
                    const expiringBatches = product.product_batches.filter((b: any) => {
                      if (!b.expiry_date || b.quantity <= 0) return false;
                      const exp = new Date(b.expiry_date);
                      return exp > today && exp <= next30Days;
                    });
                    
                    if (expiringBatches.length > 0) {
                      expiringBatches.sort((a: any, b: any) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime());
                      return {
                        count: expiringBatches.length,
                        earliest: expiringBatches[0].expiry_date
                      };
                    }
                    return null;
                  })();

                  return (
                    <TableRow key={product.id} className="hover:bg-slate-50/50">
                      <TableCell className="text-center">
                        <Checkbox 
                          id={`product-${product.id}`} 
                          checked={selectedProducts.includes(product.id)}
                          onCheckedChange={() => toggleSelect(product.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden ${statusColor}`}>
                          {product.image_url ? (
                            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                          ) : (
                            <Plus size={20} />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-800 text-sm">{product.name}</p>
                          {expiryInfo && (
                            <span 
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 border border-rose-200 text-rose-600 animate-pulse cursor-help"
                              title={`هناك تشغيلة ستنتهي قريباً بتاريخ ${new Date(expiryInfo.earliest).toLocaleDateString('ar-EG')}`}
                            >
                              <AlertTriangle size={10} />
                              صلاحية قريبة
                            </span>
                          )}
                        </div>
                        <p className={`text-xs mt-1 ${isOut ? 'text-red-500' : (isLow ? 'text-orange-500' : 'text-slate-500')}`}>
                          {isOut ? 'منتهي' : (isLow ? `مخزون منخفض` : `متوفر`)}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-normal">
                          {product.categories?.name || 'أخرى'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-600 font-mono text-sm">{product.barcode}</TableCell>
                      <TableCell className="font-bold text-slate-800">{(product.selling_price || 0).toFixed(2)} <span className="text-xs text-slate-500">ج.م</span></TableCell>
                      <TableCell className="font-bold text-slate-800">{(product.purchase_price || 0).toFixed(2)} <span className="text-xs text-slate-500">ج.م</span></TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 w-24">
                          <div className="flex justify-between items-center text-xs font-bold">
                            <span className={isOut ? "text-red-600" : (isLow ? "text-orange-600" : "text-slate-700")}>{product.stock_quantity}</span>
                            <span className="text-[10px] text-slate-400 font-normal">الحد: {product.min_stock_alert || 0}</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all ${
                                isOut ? 'bg-red-500 w-0' : 
                                isLow ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                              style={{
                                width: isOut ? '0%' : 
                                       isLow ? `${Math.max(10, Math.min(100, (product.stock_quantity / (product.min_stock_alert || 10)) * 100))}%` : 
                                       '100%'
                              }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          {isOut || isLow ? <AlertTriangle size={14} className={isOut ? "text-red-500" : "text-orange-500"} /> : <div className="w-2 h-2 rounded-full bg-green-500"></div>}
                          <span className={isOut ? "text-red-600 font-medium" : (isLow ? "text-orange-600 font-medium" : "text-teal-600 font-medium")}>
                            {isOut ? 'منتهي' : (isLow ? 'منخفض' : 'متوفر')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-left">
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-600" onClick={() => handleOpenBarcode(product)} title="طباعة الباركود">
                            <Printer size={18} />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-blue-500" onClick={() => handleOpenDetails(product)} title="تفاصيل وحركة المخزون">
                            <Eye size={18} />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-purple-500" onClick={() => handleOpenAdjustment(product)} title="تسوية الجرد">
                            <ClipboardCheck size={18} />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-primary" onClick={() => handleOpenEdit(product)}>
                            <Edit size={18} />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-500" onClick={() => handleDelete([product.id])}>
                            <Trash2 size={18} />
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
        
        {/* Pagination */}
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between bg-white text-sm text-slate-500 gap-4">
          <p>عرض {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, filteredProducts.length || 1)}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredProducts.length)} من أصل {filteredProducts.length} منتج</p>
          <div className="flex gap-1">
            <Button 
              variant="outline" 
              size="icon" 
              className="w-8 h-8 rounded-md bg-slate-50"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >«</Button>
            <Button 
              variant="outline" 
              size="icon" 
              className="w-8 h-8 rounded-md bg-slate-50"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >‹</Button>
            
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum = currentPage;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }

              if (pageNum < 1 || pageNum > totalPages) return null;

              return (
                <Button 
                  key={pageNum}
                  variant="outline" 
                  size="icon" 
                  className={`w-8 h-8 rounded-md ${currentPage === pageNum ? "bg-primary text-white border-primary" : "bg-slate-50"}`}
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            })}

            <Button 
              variant="outline" 
              size="icon" 
              className="w-8 h-8 rounded-md bg-slate-50"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >›</Button>
            <Button 
              variant="outline" 
              size="icon" 
              className="w-8 h-8 rounded-md bg-slate-50"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
            >»</Button>
          </div>
        </div>
      </Card>

      {/* Add / Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[600px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingId ? "تعديل منتج" : "إضافة منتج جديد"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[70vh] overflow-y-auto px-1">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">اسم المنتج *</label>
                <Input 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                  placeholder="اسم المنتج"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">المادة الفعالة (البديل)</label>
                <Input 
                  value={formData.active_ingredient} 
                  onChange={e => setFormData({...formData, active_ingredient: e.target.value})} 
                  placeholder="مثال: Paracetamol"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">الباركود *</label>
                <div className="flex gap-2">
                  <Input 
                    value={formData.barcode} 
                    onChange={e => setFormData({...formData, barcode: e.target.value})} 
                    placeholder="الباركود"
                  />
                  <Button variant="outline" size="icon" className="shrink-0 px-2 w-auto h-10 text-xs" onClick={() => setFormData({...formData, barcode: generateBarcode()})}>
                    توليد
                  </Button>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">سعر البيع *</label>
                <Input 
                  type="number"
                  value={formData.selling_price} 
                  onChange={e => setFormData({...formData, selling_price: Number(e.target.value)})} 
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">تنبيه المخزون المنخفض</label>
                <Input 
                  type="number"
                  value={formData.min_stock_alert} 
                  onChange={e => setFormData({...formData, min_stock_alert: Number(e.target.value)})} 
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">عدد الأشرطة في العلبة</label>
                <Input 
                  type="number"
                  value={formData.strips_per_box} 
                  onChange={e => setFormData({...formData, strips_per_box: Number(e.target.value)})} 
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">عدد الحبات في الشريط</label>
                <Input 
                  type="number"
                  value={formData.pills_per_strip} 
                  onChange={e => setFormData({...formData, pills_per_strip: Number(e.target.value)})} 
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">باركود الشريط (تجزئة)</label>
                <Input 
                  value={formData.strip_barcode} 
                  onChange={e => setFormData({...formData, strip_barcode: e.target.value})} 
                  placeholder="باركود الشريط للبيع الفرعي"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">باركود الحبة (تجزئة)</label>
                <Input 
                  value={formData.pill_barcode} 
                  onChange={e => setFormData({...formData, pill_barcode: e.target.value})} 
                  placeholder="باركود الحبة للبيع الفرعي"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">الفئة</label>
              <div className="flex gap-2">
                <select 
                  className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white"
                  value={formData.category_id}
                  onChange={(e) => setFormData({...formData, category_id: e.target.value})}
                >
                  <option value="">بدون فئة</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <Button variant="outline" size="icon" className="shrink-0 w-10 h-10" onClick={handleAddCategory}>
                  <Plus size={16} />
                </Button>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">صورة المنتج</label>
              <div className="flex items-center gap-4">
                {formData.image_url && (
                  <img src={formData.image_url} alt="Product" className="w-16 h-16 object-cover rounded-lg border border-slate-200" />
                )}
                <div className="flex-1">
                  <Input 
                    type="file"
                    accept="image/*"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setFormData({...formData, image_url: reader.result as string});
                        };
                        reader.readAsDataURL(file);
                      }
                    }} 
                  />
                  {formData.image_url && (
                    <Button variant="ghost" size="sm" className="text-red-500 mt-1 h-8 text-xs" onClick={() => setFormData({...formData, image_url: ""})}>
                      إزالة الصورة
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave}>حفظ التغييرات</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product Details Modal */}
      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className="sm:max-w-[750px]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackageCheck className="text-primary" size={20} />
              {selectedProductDetails?.name} — تفاصيل المخزون
            </DialogTitle>
          </DialogHeader>
          
          {selectedProductDetails && (
            <div className="space-y-4 py-2 max-h-[78vh] overflow-y-auto px-1">
              {/* Product Header Info */}
              <div className="bg-gradient-to-r from-slate-50 to-blue-50/30 p-4 rounded-xl border border-slate-100 grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <p className="text-xs text-slate-500 font-bold mb-1">المادة الفعالة</p>
                  <p className="font-bold text-slate-700 text-sm">{selectedProductDetails.active_ingredient || "غير محددة"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-bold mb-1">الباركود</p>
                  <p className="font-mono text-sm text-slate-600">{selectedProductDetails.barcode}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-bold mb-1">سعر الشراء</p>
                  <p className="font-bold text-rose-600">{selectedProductDetails.purchase_price} ج.م</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-bold mb-1">سعر البيع</p>
                  <p className="font-bold text-teal-600">{selectedProductDetails.selling_price} ج.م</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-bold mb-1">رصيد المخزون</p>
                  <p className="font-extrabold text-blue-700 text-lg">{selectedProductDetails.stock_quantity} <span className="text-xs font-normal text-slate-500">علبة</span></p>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                {[{id:'batches',label:'الدفعات والصلاحية',icon:<Calendar size={14}/>},{id:'moves',label:'حركة المخزون',icon:<History size={14}/>},{id:'purchases',label:'تاريخ الشراء',icon:<Building2 size={14}/>}].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setDetailsTab(tab.id as any)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold transition-all ${
                      detailsTab === tab.id ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {tab.icon}{tab.label}
                  </button>
                ))}
              </div>

              {/* Tab: Batches */}
              {detailsTab === 'batches' && (
                <div className="space-y-3">
                  {productBatches.length === 0 ? (
                    <p className="text-sm text-slate-500 italic text-center py-6 bg-slate-50 rounded-lg">لا توجد دفعات مسجلة لهذا المنتج.</p>
                  ) : (
                    <div className="border border-slate-100 rounded-xl overflow-hidden">
                      <Table>
                        <TableHeader className="bg-slate-50">
                          <TableRow>
                            <TableHead className="text-right">رقم التشغيلة</TableHead>
                            <TableHead className="text-center">تاريخ الصلاحية</TableHead>
                            <TableHead className="text-center">الكمية المتبقية</TableHead>
                            <TableHead className="text-center">الحالة</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {productBatches.map((batch, idx) => {
                            const isExpired = new Date(batch.expiry_date) < new Date();
                            const isLowBatch = batch.quantity > 0 && batch.quantity <= 5;
                            return (
                              <TableRow key={idx} className={isExpired ? "bg-red-50/60" : "hover:bg-slate-50/50"}>
                                <TableCell className="text-sm font-bold text-slate-700 font-mono">{batch.batch_number}</TableCell>
                                <TableCell className={`text-center text-sm font-bold ${isExpired ? 'text-red-600' : 'text-slate-600'}`}>
                                  {new Date(batch.expiry_date).toLocaleDateString('ar-EG')}
                                </TableCell>
                                <TableCell className={`text-center font-extrabold text-lg ${isExpired ? 'text-red-500' : isLowBatch ? 'text-amber-600' : 'text-slate-800'}`}>{batch.quantity}</TableCell>
                                <TableCell className="text-center">
                                  {isExpired ? <Badge className="bg-red-100 text-red-600 border-0">منتهي الصلاحية</Badge>
                                    : batch.quantity <= 0 ? <Badge className="bg-slate-100 text-slate-500 border-0">نفد</Badge>
                                    : isLowBatch ? <Badge className="bg-amber-100 text-amber-700 border-0">منخفض</Badge>
                                    : <Badge className="bg-emerald-100 text-emerald-700 border-0">متوفر</Badge>}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Stock Moves */}
              {detailsTab === 'moves' && (
                <div className="space-y-3">
                  {productStockMoves.length === 0 ? (
                    <p className="text-sm text-slate-500 italic text-center py-6 bg-slate-50 rounded-lg">لا توجد حركات مخزون مسجلة لهذا المنتج بعد.</p>
                  ) : (
                    <div className="border border-slate-100 rounded-xl overflow-hidden max-h-[350px] overflow-y-auto">
                      <Table>
                        <TableHeader className="bg-slate-50 sticky top-0">
                          <TableRow>
                            <TableHead className="text-right">التاريخ</TableHead>
                            <TableHead className="text-right">نوع الحركة</TableHead>
                            <TableHead className="text-right">المرجع</TableHead>
                            <TableHead className="text-center">الكمية</TableHead>
                            <TableHead className="text-right">المسؤول</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {productStockMoves.map((move, idx) => {
                            const isIn = move.quantity_changed > 0;
                            const typeLabel: Record<string,string> = {sale:'بيع', purchase:'شراء', adjustment:'تسوية جرد', return:'مرتجع'};
                            return (
                              <TableRow key={idx} className="hover:bg-slate-50/50">
                                <TableCell className="text-xs text-slate-500">{new Date(move.created_at).toLocaleString('ar-EG',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</TableCell>
                                <TableCell>
                                  <Badge className={`text-xs border-0 ${
                                    move.type==='sale'?'bg-red-50 text-red-600':
                                    move.type==='purchase'?'bg-emerald-50 text-emerald-700':
                                    move.type==='adjustment'?'bg-purple-50 text-purple-700':
                                    'bg-blue-50 text-blue-700'
                                  }`}>
                                    {typeLabel[move.type] || move.type}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-slate-600 max-w-[150px] truncate">{move.reference_name || '-'}</TableCell>
                                <TableCell className="text-center">
                                  <span className={`font-extrabold text-base flex items-center justify-center gap-1 ${
                                    isIn ? 'text-emerald-600':'text-red-500'
                                  }`}>
                                    {isIn ? <TrendingUp size={14}/> : <TrendingDown size={14}/>}
                                    {isIn ? '+':''}{move.quantity_changed}
                                  </span>
                                </TableCell>
                                <TableCell className="text-xs text-slate-600">{move.users?.full_name || '-'}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Purchase History */}
              {detailsTab === 'purchases' && (
                <div className="space-y-3">
                  {productPurchaseHistory.length === 0 ? (
                    <p className="text-sm text-slate-500 italic text-center py-6 bg-slate-50 rounded-lg">لم يتم شراء هذا المنتج عبر فواتير المشتريات بعد.</p>
                  ) : (
                    <div className="border border-slate-100 rounded-xl overflow-hidden">
                      <Table>
                        <TableHeader className="bg-slate-50">
                          <TableRow>
                            <TableHead className="text-right">التاريخ</TableHead>
                            <TableHead className="text-right">رقم الفاتورة</TableHead>
                            <TableHead className="text-right">المورد</TableHead>
                            <TableHead className="text-center">الكمية</TableHead>
                            <TableHead className="text-center">سعر الشراء</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {productPurchaseHistory.map((hist, idx) => (
                            <TableRow key={idx} className="hover:bg-slate-50/50">
                              <TableCell className="text-sm">
                                {hist.purchases?.created_at ? new Date(hist.purchases.created_at).toLocaleDateString('ar-EG') : '-'}
                              </TableCell>
                              <TableCell className="text-sm font-mono text-slate-600">{hist.purchases?.invoice_number || '-'}</TableCell>
                              <TableCell className="text-sm font-medium">{hist.purchases?.suppliers?.name || 'مورد غير معروف'}</TableCell>
                              <TableCell className="text-center font-bold">{hist.quantity}</TableCell>
                              <TableCell className="text-center font-bold text-rose-600">{hist.unit_cost} ج.م</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            {selectedProductDetails && (
              <Button variant="outline" className="text-purple-600 border-purple-200 hover:bg-purple-50" onClick={() => { setIsDetailsModalOpen(false); handleOpenAdjustment(selectedProductDetails); }}>
                <ClipboardCheck size={16} className="ml-2"/> تسوية جرد
              </Button>
            )}
            <Button onClick={() => setIsDetailsModalOpen(false)}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Inventory Adjustment Modal ===== */}
      <Dialog open={isAdjustmentOpen} onOpenChange={setIsAdjustmentOpen}>
        <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-purple-700">
              <ClipboardCheck size={20} />
              تسوية جرد — {adjustmentProduct?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-xs text-slate-500 bg-purple-50 p-3 rounded-xl border border-purple-100">
              قارن الكمية الفعلية على الرف بكمية النظام وأدخل التعديلات. سيتم تسجيل كل فرق تلقائياً في سجل حركة المخزون.
            </p>
            <div className="border border-slate-100 rounded-xl overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="text-right">الدفعة / المخزون</TableHead>
                    <TableHead className="text-center">كمية النظام</TableHead>
                    <TableHead className="text-center">الكمية الفعلية</TableHead>
                    <TableHead className="text-center">الفرق</TableHead>
                    <TableHead className="text-right">السبب</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adjustmentItems.map((item, idx) => {
                    const diff = item.real_quantity - item.system_quantity;
                    return (
                      <TableRow key={idx}>
                        <TableCell className="font-bold text-sm text-slate-700 font-mono">{item.batch_number}</TableCell>
                        <TableCell className="text-center font-bold text-slate-500">{item.system_quantity}</TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            min={0}
                            value={item.real_quantity}
                            onChange={e => setAdjustmentItems(prev => prev.map((it,i) => i===idx ? {...it, real_quantity: Math.max(0,Number(e.target.value))} : it))}
                            className="w-20 mx-auto text-center font-bold h-8"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`font-extrabold text-base ${diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                            {diff > 0 ? '+':''}{diff}
                          </span>
                        </TableCell>
                        <TableCell>
                          <select
                            className="w-full h-8 px-2 rounded-md border border-slate-200 bg-white text-xs"
                            value={item.reason}
                            onChange={e => setAdjustmentItems(prev => prev.map((it,i) => i===idx ? {...it, reason: e.target.value} : it))}
                          >
                            <option value="reconciliation">تسوية عامة</option>
                            <option value="damaged">تالف</option>
                            <option value="expired">منتهي الصلاحية</option>
                            <option value="lost">مفقود</option>
                            <option value="found">وجد زيادة</option>
                          </select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">ملاحظات الجرد (اختياري)</label>
              <Input placeholder="مثال: جرد شهر مايو 2026" value={adjustmentNote} onChange={e => setAdjustmentNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsAdjustmentOpen(false)}>إلغاء</Button>
            <Button onClick={handleSaveAdjustment} disabled={adjustmentSaving} className="bg-purple-600 hover:bg-purple-700 text-white">
              {adjustmentSaving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin ml-2"/> : <ClipboardCheck size={16} className="ml-2"/>}
              حفظ تسوية الجرد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Adjustment History Modal ===== */}
      <Dialog open={isAdjHistoryOpen} onOpenChange={setIsAdjHistoryOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-purple-700">
              <History size={20} />
              سجل تسويات الجرد السابقة
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-3">
            {adjHistory.length === 0 ? (
              <p className="text-center text-slate-500 py-8">لا توجد تسويات جرد مسجلة بعد.</p>
            ) : adjHistory.map((adj: any) => (
              <div key={adj.id} className="border border-slate-100 rounded-xl p-4 space-y-3 bg-white hover:border-purple-200 transition-colors">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-slate-800 text-sm">{new Date(adj.created_at).toLocaleString('ar-EG')}</p>
                    <p className="text-xs text-slate-500">بواسطة: {adj.users?.full_name || 'غير محدد'}</p>
                    {adj.notes && <p className="text-xs text-purple-600 mt-1 italic">{adj.notes}</p>}
                  </div>
                  <Badge className="bg-purple-50 text-purple-700 border-0">{adj.inventory_adjustment_items?.length || 0} صنف</Badge>
                </div>
                {adj.inventory_adjustment_items?.length > 0 && (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="text-right text-xs">المنتج</TableHead>
                          <TableHead className="text-center text-xs">كمية النظام</TableHead>
                          <TableHead className="text-center text-xs">الكمية الفعلية</TableHead>
                          <TableHead className="text-center text-xs">الفرق</TableHead>
                          <TableHead className="text-right text-xs">السبب</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {adj.inventory_adjustment_items.map((item: any, i: number) => {
                          const reasonLabels: Record<string,string> = {reconciliation:'تسوية عامة', damaged:'تالف', expired:'منتهي', lost:'مفقود', found:'وجد زيادة'};
                          return (
                            <TableRow key={i} className="hover:bg-slate-50/50">
                              <TableCell className="text-xs font-bold">{item.products?.name || '-'}</TableCell>
                              <TableCell className="text-center text-xs">{item.system_quantity}</TableCell>
                              <TableCell className="text-center text-xs">{item.real_quantity}</TableCell>
                              <TableCell className="text-center">
                                <span className={`text-xs font-bold ${item.difference > 0 ? 'text-emerald-600' : item.difference < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                                  {item.difference > 0 ? '+':''}{item.difference}
                                </span>
                              </TableCell>
                              <TableCell className="text-xs text-slate-500">{reasonLabels[item.reason] || item.reason}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setIsAdjHistoryOpen(false)}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Barcode Print Modal */}
      <Dialog open={isBarcodeModalOpen} onOpenChange={setIsBarcodeModalOpen}>
        <DialogContent className="sm:max-w-[400px]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="text-primary" size={20} />
              طباعة الباركود
            </DialogTitle>
          </DialogHeader>
          
          {barcodeProduct && (
            <div className="py-6 flex flex-col items-center justify-center">
              <div id="barcode-print-area" className="text-center p-4 border border-dashed border-slate-300 rounded-lg bg-white">
                <p className="font-bold text-sm mb-2 text-slate-800">{barcodeProduct.name}</p>
                <img 
                  src={`https://barcode.tec-it.com/barcode.ashx?data=${barcodeProduct.barcode}&code=Code128&translate-esc=on`} 
                  alt={barcodeProduct.barcode}
                  className="mx-auto"
                />
                <p className="mt-2 font-bold">{barcodeProduct.selling_price} ج.م</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBarcodeModalOpen(false)}>إغلاق</Button>
            <Button onClick={handlePrintBarcode}>
              <Printer size={16} className="ml-2" />
              طباعة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Bulk Barcode Print Dialog ===== */}
      <Dialog open={isBulkBarcodeOpen} onOpenChange={setIsBulkBarcodeOpen}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#002B5B]">
              <Printer size={20} />
              طباعة باركود للمنتجات المحددة
            </DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100">
              حدد عدد النسخ المراد طباعتها لكل منتج، ثم اضغط "طباعة الكل".
              الطباعة ستكون على ورق ملصقات 58mm أو 80mm.
            </p>

            {products.filter(p => selectedProducts.includes(p.id)).map((product) => (
              <div
                key={product.id}
                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 hover:border-[#002B5B]/30 transition-colors"
              >
                {/* Barcode preview */}
                <img
                  src={`https://barcode.tec-it.com/barcode.ashx?data=${product.barcode}&code=Code128&translate-esc=on&dpi=150`}
                  alt={product.barcode}
                  className="h-10 shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 text-sm truncate">{product.name}</p>
                  <p className="text-[10px] font-mono text-slate-400">{product.barcode}</p>
                  <p className="text-[11px] text-emerald-600 font-bold">{product.selling_price} ج.م</p>
                </div>
                {/* Quantity input */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 flex items-center justify-center transition-colors"
                    onClick={() => setBulkPrintQty(prev => ({ ...prev, [product.id]: Math.max(1, (prev[product.id] || 1) - 1) }))}
                  >−</button>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={bulkPrintQty[product.id] || 1}
                    onChange={e => setBulkPrintQty(prev => ({ ...prev, [product.id]: Math.max(1, parseInt(e.target.value) || 1) }))}
                    className="w-12 h-7 text-center text-sm font-bold border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:border-[#002B5B]"
                  />
                  <button
                    className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 flex items-center justify-center transition-colors"
                    onClick={() => setBulkPrintQty(prev => ({ ...prev, [product.id]: (prev[product.id] || 1) + 1 }))}
                  >+</button>
                  <span className="text-xs text-slate-400 mr-1">نسخة</span>
                </div>
              </div>
            ))}

            <div className="text-xs text-slate-400 text-left pt-1">
              الإجمالي: {Object.values(bulkPrintQty).reduce((a, b) => a + b, 0)} ملصق
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsBulkBarcodeOpen(false)}>إلغاء</Button>
            <Button
              onClick={handleBulkPrint}
              className="bg-[#002B5B] hover:bg-[#001f42] text-white gap-2"
            >
              <Printer size={16} />
              طباعة الكل ({Object.values(bulkPrintQty).reduce((a, b) => a + b, 0)} ملصق)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== CSV Import Dialog ===== */}
      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600 font-bold">
              <Download size={20} />
              استيراد المنتجات من ملف CSV
            </DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {/* Step 1: Info and download template */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-slate-800 text-sm mb-1">تحميل نموذج ملف الاستيراد القياسي</h4>
                <p className="text-xs text-slate-500">قم بتحميل ملف النموذج وملئه ببيانات منتجاتك ثم رفعه هنا.</p>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                className="bg-white border-emerald-200 text-emerald-600 hover:bg-emerald-50 text-xs gap-1 shrink-0 font-bold"
                onClick={handleDownloadTemplate}
              >
                <Download size={14} />
                تحميل النموذج (CSV)
              </Button>
            </div>

            {/* Step 2: Upload input */}
            <div className="border-2 border-dashed border-slate-200 hover:border-emerald-500/50 rounded-xl p-6 text-center transition-all bg-slate-50/50">
              <input
                type="file"
                accept=".csv"
                id="csv-file-input"
                className="hidden"
                onChange={handleCSVUpload}
              />
              <label htmlFor="csv-file-input" className="cursor-pointer block space-y-2">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Download size={24} />
                </div>
                <span className="font-bold text-slate-800 text-sm block">اختر ملف CSV من جهازك</span>
                <span className="text-xs text-slate-400 block">يدعم فقط امتداد .csv</span>
              </label>
            </div>

            {/* Step 3: Preview */}
            {parsedProducts.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-bold text-slate-700 text-sm">معاينة المنتجات المكتشفة ({parsedProducts.length} منتج)</h4>
                <div className="border border-slate-100 rounded-xl overflow-hidden max-h-[250px] overflow-y-auto">
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0 z-10">
                      <TableRow>
                        <TableHead className="text-right">الاسم</TableHead>
                        <TableHead className="text-right">الباركود</TableHead>
                        <TableHead className="text-right">الفئة</TableHead>
                        <TableHead className="text-center font-bold">سعر البيع</TableHead>
                        <TableHead className="text-center font-bold">سعر الشراء</TableHead>
                        <TableHead className="text-center font-bold">الكمية</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedProducts.slice(0, 50).map((prod, idx) => (
                        <TableRow key={idx} className="hover:bg-slate-50/50">
                          <TableCell className="text-sm font-bold text-slate-800">{prod.name}</TableCell>
                          <TableCell className="text-sm font-mono text-slate-500">{prod.barcode}</TableCell>
                          <TableCell className="text-sm">
                            <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-normal">
                              {prod.category_name}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center font-bold text-teal-600">{prod.selling_price} ج.م</TableCell>
                          <TableCell className="text-center font-bold text-rose-600">{prod.purchase_price} ج.م</TableCell>
                          <TableCell className="text-center font-bold">{prod.stock_quantity}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {parsedProducts.length > 50 && (
                  <p className="text-[10px] text-slate-400 text-left">يتم عرض أول 50 منتجاً فقط للمعاينة...</p>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setIsImportModalOpen(false); setParsedProducts([]); }}>إلغاء</Button>
            <Button
              onClick={handleSaveImport}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-bold"
              disabled={parsedProducts.length === 0 || importLoading}
            >
              {importLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  جاري الحفظ...
                </>
              ) : (
                <>
                  حفظ واستيراد ({parsedProducts.length} منتج)
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
