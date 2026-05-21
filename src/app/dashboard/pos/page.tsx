"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Minus, Trash2, ShoppingCart, UserPlus, FileText, X, ScanBarcode, PlusSquare, Clock, MessageSquare, Search, ListOrdered, ReceiptText, ChevronDown, ChevronUp, Undo2, Printer, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { usePosStore, PaymentMethod } from "@/store/pos-store";
import { supabase } from "@/lib/supabase";
import ReceiptPrint from "@/components/pos/receipt-print";

export default function POSPage() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showPayModal, setShowPayModal] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [showSuspendedList, setShowSuspendedList] = useState(false);
  const [suspendNote, setSuspendNote] = useState("");
  const [noteItemId, setNoteItemId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [lastInvoice, setLastInvoice] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isShiftLoaded, setIsShiftLoaded] = useState(false);
  const [startingCash, setStartingCash] = useState("");
  const [showCloseShift, setShowCloseShift] = useState(false);
  const [shiftTotals, setShiftTotals] = useState<any>(null);
  const [actualCash, setActualCash] = useState("");
  const [shiftError, setShiftError] = useState<string | null>(null);

  // Patient autocomplete state
  const [patientQuery, setPatientQuery] = useState("");
  const [patientResults, setPatientResults] = useState<any[]>([]);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
  const [patientSearchLoading, setPatientSearchLoading] = useState(false);
  const patientInputRef = useRef<HTMLInputElement>(null);
  const patientDropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Add Patient modal state
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [newPatientName, setNewPatientName] = useState("");
  const [newPatientPhone, setNewPatientPhone] = useState("");
  const [addingPatient, setAddingPatient] = useState(false);

  // Today's Orders modal
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [todayOrders, setTodayOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  // Payment UI state
  const [paymentStep, setPaymentStep] = useState<'method' | 'mixed_details' | 'success'>('method');
  const [receiptData, setReceiptData] = useState<any>(null);
  const [mixedCash, setMixedCash] = useState<number>(0);
  const [mixedVisa, setMixedVisa] = useState<number>(0);

  // Alternatives modal state
  const [showAlternativesModal, setShowAlternativesModal] = useState(false);
  const [selectedAltProduct, setSelectedAltProduct] = useState<any | null>(null);

  // Missing Drug Notepad Modal
  const [showMissingModal, setShowMissingModal] = useState(false);
  const [missingDrugName, setMissingDrugName] = useState("");
  const [missingQty, setMissingQty] = useState(1);
  const [missingNote, setMissingNote] = useState("");
  const [savingMissing, setSavingMissing] = useState(false);

  // Insurance Contract state
  const [insuranceContracts, setInsuranceContracts] = useState<any[]>([]);
  const [selectedInsuranceId, setSelectedInsuranceId] = useState<string | undefined>(undefined);

  // Barcode scanner state
  const [barcodeBuffer, setBarcodeBuffer] = useState("");
  const [scanFlash, setScanFlash] = useState<'success' | 'error' | null>(null);
  const barcodeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastKeyTimeRef = useRef<number>(0);

  const fetchTodayOrders = async () => {
    setOrdersLoading(true);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from('sales')
      .select('id, invoice_number, total, payment_method, created_at, notes, subtotal, discount, tax, delivery_fee, patient_name, sale_items(id, product_id, quantity, unit_price, total_price, products(id, name, selling_price, strips_per_box, pills_per_strip))')
      .gte('created_at', todayStart.toISOString())
      .order('created_at', { ascending: false });
    setTodayOrders(data || []);
    setOrdersLoading(false);
  };

  const handleReturnOrder = async (orderId: string) => {
    if (!confirm('هل أنت متأكد من استرجاع الفاتورة بالكامل؟ (سيتم استرداد المخزون وإلغاء الفاتورة)')) return;
    setOrdersLoading(true);
    try {
      const order = todayOrders.find(o => o.id === orderId);
      if (!order) return;
      for (const item of order.sale_items) {
        const { data: prod } = await supabase.from('products').select('stock_quantity').eq('id', item.product_id).single();
        if (prod) {
          await supabase.from('products').update({ stock_quantity: prod.stock_quantity + item.quantity }).eq('id', item.product_id);
        }
      }
      await supabase.from('sales').delete().eq('id', orderId);
      fetchTodayOrders();
      store.fetchProducts(); // Refresh pos store stock
    } catch (e) {
      console.error(e);
      setOrdersLoading(false);
    }
  };

  const handleReturnItem = async (orderId: string, itemId: string) => {
    if (!confirm('هل أنت متأكد من استرجاع هذا الصنف؟')) return;
    setOrdersLoading(true);
    try {
      const order = todayOrders.find(o => o.id === orderId);
      const item = order?.sale_items.find((i: any) => i.id === itemId);
      if (!order || !item) return;

      let unit = "box";
      const product = item.products;
      if (product) {
        if (product.strips_per_box && Math.abs(item.unit_price - (product.selling_price / product.strips_per_box)) < 0.01) {
          unit = "strip";
        } else if (product.strips_per_box && product.pills_per_strip && Math.abs(item.unit_price - (product.selling_price / (product.strips_per_box * product.pills_per_strip))) < 0.01) {
          unit = "pill";
        }
      }

      let boxesConsumed = item.quantity;
      if (unit === "strip" && product?.strips_per_box) boxesConsumed = item.quantity / product.strips_per_box;
      if (unit === "pill" && product?.strips_per_box && product?.pills_per_strip) boxesConsumed = item.quantity / (product.strips_per_box * product.pills_per_strip);

      const { data: prod } = await supabase.from('products').select('stock_quantity').eq('id', item.product_id).single();
      if (prod) {
        await supabase.from('products').update({ stock_quantity: prod.stock_quantity + Math.ceil(boxesConsumed) }).eq('id', item.product_id);
      }
      await supabase.from('sale_items').delete().eq('id', itemId);

      // Recalculate order total
      const newSubtotal = order.subtotal - item.total_price;
      const newTotal = Math.max(0, newSubtotal - order.discount);
      
      if (order.sale_items.length <= 1) {
        // Was last item
        await supabase.from('sales').delete().eq('id', orderId);
      } else {
        await supabase.from('sales').update({ subtotal: newSubtotal, tax: 0, total: newTotal }).eq('id', orderId);
      }
      
      fetchTodayOrders();
      store.fetchProducts(); // Refresh pos store stock
    } catch (e) {
      console.error(e);
      setOrdersLoading(false);
    }
  };

  const handleUpdateItemQuantity = async (orderId: string, itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) return handleReturnItem(orderId, itemId);
    setOrdersLoading(true);
    try {
      const order = todayOrders.find(o => o.id === orderId);
      const item = order?.sale_items.find((i: any) => i.id === itemId);
      if (!order || !item) return;

      let unit = "box";
      const product = item.products;
      if (product) {
        if (product.strips_per_box && Math.abs(item.unit_price - (product.selling_price / product.strips_per_box)) < 0.01) {
          unit = "strip";
        } else if (product.strips_per_box && product.pills_per_strip && Math.abs(item.unit_price - (product.selling_price / (product.strips_per_box * product.pills_per_strip))) < 0.01) {
          unit = "pill";
        }
      }

      let boxesOld = item.quantity;
      if (unit === "strip" && product?.strips_per_box) boxesOld = item.quantity / product.strips_per_box;
      if (unit === "pill" && product?.strips_per_box && product?.pills_per_strip) boxesOld = item.quantity / (product.strips_per_box * product.pills_per_strip);

      let boxesNew = newQuantity;
      if (unit === "strip" && product?.strips_per_box) boxesNew = newQuantity / product.strips_per_box;
      if (unit === "pill" && product?.strips_per_box && product?.pills_per_strip) boxesNew = newQuantity / (product.strips_per_box * product.pills_per_strip);

      const finalBoxDiff = Math.ceil(boxesNew) - Math.ceil(boxesOld);

      if (finalBoxDiff > 0) {
        const { data: prod } = await supabase.from('products').select('stock_quantity').eq('id', item.product_id).single();
        if (prod && prod.stock_quantity < finalBoxDiff) {
          alert("الكمية غير كافية في المخزن");
          setOrdersLoading(false);
          return;
        }
      }

      if (finalBoxDiff !== 0) {
        const { data: prod } = await supabase.from('products').select('stock_quantity').eq('id', item.product_id).single();
        if (prod) {
          await supabase.from('products').update({ stock_quantity: prod.stock_quantity - finalBoxDiff }).eq('id', item.product_id);
        }
      }

      const newTotalPrice = item.unit_price * newQuantity;
      await supabase.from('sale_items').update({ quantity: newQuantity, total_price: newTotalPrice }).eq('id', itemId);

      const newSubtotal = order.subtotal - item.total_price + newTotalPrice;
      const newTotal = Math.max(0, newSubtotal - order.discount);

      await supabase.from('sales').update({ subtotal: newSubtotal, tax: 0, total: newTotal }).eq('id', orderId);

      fetchTodayOrders();
      store.fetchProducts();
    } catch (e) {
      console.error(e);
      setOrdersLoading(false);
    }
  };

  const handleUpdateItemUnit = async (orderId: string, itemId: string, newUnit: "box" | "strip" | "pill") => {
    setOrdersLoading(true);
    try {
      const order = todayOrders.find(o => o.id === orderId);
      const item = order?.sale_items.find((i: any) => i.id === itemId);
      if (!order || !item) return;

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

      const finalBoxDiff = Math.ceil(newBoxesConsumed) - Math.ceil(oldBoxesConsumed);
      if (finalBoxDiff > 0) {
        const { data: prod } = await supabase.from('products').select('stock_quantity').eq('id', item.product_id).single();
        if (prod && prod.stock_quantity < finalBoxDiff) {
          alert("الكمية غير كافية في المخزن لتحويل الوحدة");
          setOrdersLoading(false);
          return;
        }
      }

      if (finalBoxDiff !== 0) {
        const { data: prod } = await supabase.from('products').select('stock_quantity').eq('id', item.product_id).single();
        if (prod) {
          await supabase.from('products').update({ stock_quantity: prod.stock_quantity - finalBoxDiff }).eq('id', item.product_id);
        }
      }

      const newTotalPrice = newUnitPrice * item.quantity;
      await supabase.from('sale_items').update({ unit_price: newUnitPrice, total_price: newTotalPrice }).eq('id', itemId);

      const newSubtotal = order.subtotal - item.total_price + newTotalPrice;
      const newTotal = Math.max(0, newSubtotal - order.discount);

      await supabase.from('sales').update({ subtotal: newSubtotal, tax: 0, total: newTotal }).eq('id', orderId);

      fetchTodayOrders();
      store.fetchProducts();
    } catch (e) {
      console.error(e);
      setOrdersLoading(false);
    }
  };

  const store = usePosStore();
  const activeTab = store.tabs.find(t => t.id === store.activeTabId);
  const cart = activeTab?.cart ?? [];
  const { subtotal, discountAmount, deliveryFee, total, itemCount } = store.getTotals();
  const discount = activeTab?.discount ?? 0;
  const discountType = activeTab?.discountType ?? "amount";

  const categories = Array.from(new Set(store.products.map(p => p.category)));

  // Cashiers
  const [cashiers, setCashiers] = useState<any[]>([]);
  const [deliveryPersons, setDeliveryPersons] = useState<any[]>([]);
  
  useEffect(() => {
    supabase.from('users').select('id, full_name, is_active, role:roles(name)').eq('is_active', true).then(({ data }) => {
      if (data) {
        setCashiers(data.filter(u => {
          const roleArr = u.role as any;
          const roleName = Array.isArray(roleArr) ? roleArr[0]?.name : roleArr?.name;
          return roleName !== 'delivery';
        }));
        setDeliveryPersons(data.filter(u => {
          const roleArr = u.role as any;
          const roleName = Array.isArray(roleArr) ? roleArr[0]?.name : roleArr?.name;
          return roleName === 'delivery';
        }));
      }
    });
  }, []);

  // Online/Offline State & Sync
  const [isOnline, setIsOnline] = useState(typeof window !== "undefined" ? window.navigator.onLine : true);
  const [syncingOffline, setSyncingOffline] = useState(false);

  const handleSyncOffline = useCallback(async () => {
    if (store.offlineQueue && store.offlineQueue.length > 0) {
      setSyncingOffline(true);
      try {
        await store.syncOfflineOrders();
      } catch (err) {
        console.error("Error syncing offline orders:", err);
      } finally {
        setSyncingOffline(false);
      }
    }
  }, [store]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      handleSyncOffline();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    if (typeof window !== "undefined") {
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      
      // also check online on mount
      setIsOnline(window.navigator.onLine);
      if (window.navigator.onLine) {
        handleSyncOffline();
      }
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      }
    };
  }, [handleSyncOffline]);

  // Search patients from Supabase
  const searchPatients = useCallback(async (q: string) => {
    if (!q.trim() || q.trim().length < 1) {
      setPatientResults([]);
      setShowPatientDropdown(false);
      return;
    }
    setPatientSearchLoading(true);
    const { data } = await supabase
      .from('patients')
      .select('id, name, phone, file_number')
      .or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
      .limit(6);
    setPatientResults(data || []);
    setShowPatientDropdown(true);
    setPatientSearchLoading(false);
  }, []);

  // Debounced effect
  useEffect(() => {
    const t = setTimeout(() => searchPatients(patientQuery), 300);
    return () => clearTimeout(t);
  }, [patientQuery, searchPatients]);

  // Sync patientQuery with the tab's customerName when tab changes or is cleared
  useEffect(() => {
    setPatientQuery(activeTab?.customerName || "");
    setShowPatientDropdown(false);
  }, [store.activeTabId, activeTab?.customerName]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        patientDropdownRef.current && !patientDropdownRef.current.contains(e.target as Node) &&
        patientInputRef.current && !patientInputRef.current.contains(e.target as Node)
      ) {
        setShowPatientDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelectPatient = (patient: any) => {
    store.setCustomerInfo(patient.name, patient.id);
    setPatientQuery(patient.name);
    setShowPatientDropdown(false);
  };

  const handleClearPatient = () => {
    store.setCustomerInfo("", undefined);
    setPatientQuery("");
    setPatientResults([]);
    setShowPatientDropdown(false);
    patientInputRef.current?.focus();
  };

  const handleAddPatient = async () => {
    if (!newPatientName.trim()) return;
    setAddingPatient(true);
    const fileNumber = `#${Math.floor(100000 + Math.random() * 900000)}`;
    const { data, error } = await supabase
      .from('patients')
      .insert({ name: newPatientName.trim(), phone: newPatientPhone.trim() || null, file_number: fileNumber, gender: 'ذكر', age: 30, blood_type: 'O+', status: 'عضو جديد', points: 0, total_purchases: 0 })
      .select()
      .single();
    setAddingPatient(false);
    if (!error && data) {
      handleSelectPatient(data);
      setShowAddPatient(false);
      setNewPatientName("");
      setNewPatientPhone("");
    }
  };

  // Fetch insurance contracts
  useEffect(() => {
    supabase.from('insurance_contracts').select('*').eq('is_active', true).then(({ data }) => {
      if (data) setInsuranceContracts(data);
    });
  }, []);

  // Compute insurance split amounts
  const selectedContract = insuranceContracts.find(c => c.id === selectedInsuranceId);
  const insuranceDiscountPercent = selectedContract?.discount_percent ?? 0;
  const patientCopayPercent = selectedContract?.patient_copay_percent ?? 100;
  const insuranceTotalWithDiscount = selectedContract
    ? Math.max(0, store.getTotals().total * (1 - insuranceDiscountPercent / 100))
    : store.getTotals().total;
  const patientCopayAmount = selectedContract
    ? insuranceTotalWithDiscount * (patientCopayPercent / 100)
    : store.getTotals().total;
  const insurancePaidAmount = selectedContract
    ? insuranceTotalWithDiscount - patientCopayAmount
    : 0;
  const targetMixedTotal = selectedContract ? patientCopayAmount : total;

  const handleSaveMissingDrug = async () => {
    if (!missingDrugName.trim()) return;
    setSavingMissing(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      let pharmacyId = null;
      if (authUser) {
        const { data: profile } = await supabase.from('users').select('pharmacy_id').eq('id', authUser.id).single();
        pharmacyId = profile?.pharmacy_id;
      }
      await supabase.from('urgent_requests').insert({
        type: 'missing_drug',
        drug_name: missingDrugName.trim(),
        quantity: missingQty,
        notes: missingNote.trim() || null,
        status: 'pending',
        pharmacy_id: pharmacyId,
        requested_by: authUser?.id,
      });
      setShowMissingModal(false);
      setMissingDrugName('');
      setMissingQty(1);
      setMissingNote('');
    } catch (e) {
      console.error(e);
    } finally {
      setSavingMissing(false);
    }
  };

  useEffect(() => { 
    store.fetchProducts(); 
    store.fetchCurrentShift().then(() => setIsShiftLoaded(true));
  }, []);

  // ===== Barcode Scanner & POS Shortcuts Listener =====
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle page-wide POS shortcuts first
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (e.key === 'F8') {
        e.preventDefault();
        if (cart.length > 0 && !showPayModal && !showCloseShift) {
          setShowSuspendModal(true);
        }
        return;
      }
      if (e.key === 'F12') {
        e.preventDefault();
        if (cart.length > 0 && !showSuspendModal && !showCloseShift) {
          setCheckoutError(null);
          setLastInvoice(null);
          setPaymentStep('method');
          setShowPayModal(true);
        }
        return;
      }

      // Skip barcode scanner logic if user is typing in an input/textarea/select
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        return;
      }
      // Skip if any modal is open
      if (showPayModal || showSuspendModal || noteItemId || showAddPatient || showCloseShift) return;

      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter') {
        // Fire barcode lookup if buffer has content
        if (barcodeBuffer.length >= 3) {
          const barcode = barcodeBuffer;
          setBarcodeBuffer("");
          if (barcodeTimerRef.current) clearTimeout(barcodeTimerRef.current);

          // Find product by box, strip, or pill barcode in loaded products
          const foundBox = store.products.find(p => p.barcode === barcode);
          const foundStrip = store.products.find(p => p.stripBarcode === barcode);
          const foundPill = store.products.find(p => p.pillBarcode === barcode);

          if (foundBox) {
            store.addToCart(foundBox, 'box');
            setScanFlash('success');
            setTimeout(() => setScanFlash(null), 1200);
          } else if (foundStrip) {
            store.addToCart(foundStrip, 'strip');
            setScanFlash('success');
            setTimeout(() => setScanFlash(null), 1200);
          } else if (foundPill) {
            store.addToCart(foundPill, 'pill');
            setScanFlash('success');
            setTimeout(() => setScanFlash(null), 1200);
          } else {
            setScanFlash('error');
            setTimeout(() => setScanFlash(null), 1200);
          }
        }
        return;
      }

      // Only accumulate printable single characters
      if (e.key.length === 1) {
        // If gap is too large (> 100ms) it's manual typing - reset buffer
        if (timeDiff > 100 && barcodeBuffer.length > 0) {
          setBarcodeBuffer(e.key);
        } else {
          setBarcodeBuffer(prev => prev + e.key);
        }

        // Auto-clear buffer after 300ms of inactivity (safety net)
        if (barcodeTimerRef.current) clearTimeout(barcodeTimerRef.current);
        barcodeTimerRef.current = setTimeout(() => {
          setBarcodeBuffer("");
        }, 300);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (barcodeTimerRef.current) clearTimeout(barcodeTimerRef.current);
    };
  }, [barcodeBuffer, store.products, showPayModal, showSuspendModal, noteItemId, showAddPatient, showCloseShift, cart]);

  const filtered = store.products.filter(p => {
    const catOk = activeCategory === "all" || p.category === activeCategory;
    const q = searchQuery.toLowerCase();
    const searchOk = !q || 
      p.name.toLowerCase().includes(q) || 
      p.barcode?.toLowerCase().includes(q) || 
      (p.stripBarcode && p.stripBarcode.toLowerCase().includes(q)) ||
      (p.pillBarcode && p.pillBarcode.toLowerCase().includes(q)) ||
      (p.activeIngredient && p.activeIngredient.toLowerCase().includes(q));
    return catOk && searchOk;
  });

  const handlePay = async (method: PaymentMethod, cashVal?: number, visaVal?: number) => {
    setIsProcessing(true);
    setCheckoutError(null);
    const res = await store.checkoutOrder(method, cashVal, visaVal, selectedInsuranceId, insurancePaidAmount, patientCopayAmount);
    setIsProcessing(false);
    if (res.success) { 
      setLastInvoice(res.invoiceNumber ?? null);
      setReceiptData(res.receiptData);
      setPaymentStep('success');
    }
    else setCheckoutError(res.error ?? "حدث خطأ");
  };

  const handleReprint = (order: any) => {
    let deliveryId = undefined;
    if (order.notes && order.notes.includes("مندوب: ")) {
      const match = order.notes.match(/مندوب:\s*([a-f0-9-]+)/);
      if (match) deliveryId = match[1];
    }

    const mappedReceiptData = {
      cart: order.sale_items.map((item: any) => {
        let unit = "box";
        const product = item.products;
        if (product) {
          if (product.strips_per_box && Math.abs(item.unit_price - (product.selling_price / product.strips_per_box)) < 0.01) {
            unit = "strip";
          } else if (product.strips_per_box && product.pills_per_strip && Math.abs(item.unit_price - (product.selling_price / (product.strips_per_box * product.pills_per_strip))) < 0.01) {
            unit = "pill";
          }
        }
        return {
          product: {
            id: item.product_id,
            name: item.products?.name || 'صنف غير معروف',
            selling_price: item.products?.selling_price || item.unit_price,
            stripsPerBox: item.products?.strips_per_box,
            pillsPerStrip: item.products?.pills_per_strip,
          },
          quantity: item.quantity,
          unit: unit,
          unitPrice: item.unit_price,
          note: '',
        };
      }),
      subtotal: order.subtotal || order.total,
      discountAmount: order.discount || 0,
      deliveryFee: order.delivery_fee || 0,
      total: order.total,
      paymentMethod: order.payment_method,
      patientName: order.patient_name,
      cashierId: order.cashier_id,
      deliveryId: deliveryId
    };

    setReceiptData(mappedReceiptData);
    setLastInvoice(order.invoice_number);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handleSuspend = () => {
    store.suspendOrder(suspendNote || undefined);
    setSuspendNote(""); setShowSuspendModal(false);
  };

  const payMethods: { id: PaymentMethod; label: string; emoji: string; disabled?: boolean }[] = [
    { id: "cash", label: "كاش", emoji: "💵" },
    { id: "visa", label: "فيزا", emoji: "💳" },
    { id: "instapay", label: "إنستاباي", emoji: "📱" },
    { id: "vodafone_cash", label: "فودافون كاش", emoji: "📲" },
    { id: "mixed", label: "مختلط (كاش + فيزا)", emoji: "🔀" },
    { id: "credit", label: "آجل (مديونية)", emoji: "📝", disabled: !activeTab?.customerId },
  ];

  if (!isShiftLoaded) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center flex-col gap-3 text-slate-400">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="font-bold text-sm">جاري التحقق من الوردية...</p>
      </div>
    );
  }


  if (!store.currentShift) {
    return (
      <div className="flex h-[calc(100vh-4rem)] -m-4 md:-m-6 lg:-m-8 bg-slate-50 items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl border-slate-200 rounded-3xl overflow-hidden">
          <CardContent className="p-8 text-center space-y-6">
            <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary">
              <Clock size={48} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800">بدء وردية جديدة</h2>
              <p className="text-slate-500 mt-2 text-sm">قم بإدخال الكاش الافتتاحي في الدرج لبدء الوردية وتلقي المبيعات</p>
            </div>
            <div className="space-y-2 text-right">
              <label className="text-sm font-bold text-slate-700">الكاش الافتتاحي في الدرج (ج.م)</label>
              <Input 
                type="number" 
                min="0" 
                value={startingCash} 
                onChange={e => setStartingCash(e.target.value)}
                className="text-center text-xl font-bold h-14 bg-slate-50 border-slate-200"
                placeholder="0.00"
              />
            </div>
            {shiftError && <p className="text-red-500 text-sm font-bold text-center mt-2 bg-red-50 p-2 rounded-lg">{shiftError}</p>}
            <Button 
              className="w-full h-14 text-lg font-bold shadow-lg shadow-primary/20 mt-4"
              disabled={startingCash === "" || Number(startingCash) < 0 || isProcessing}
              onClick={async () => {
                setIsProcessing(true);
                setShiftError(null);
                const res = await store.openShift(Number(startingCash));
                setIsProcessing(false);
                if (!res.success) {
                  setShiftError(res.error || "تعذر فتح الوردية.");
                }
              }}
            >
              {isProcessing ? "جاري الفتح..." : "فتح الوردية"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] -m-4 md:-m-6 lg:-m-8 bg-slate-50 relative">

      {/* ===== Barcode Scan Flash Overlay ===== */}
      {scanFlash && (
        <div className={`fixed inset-0 z-[999] pointer-events-none flex items-center justify-center transition-all duration-300 ${
          scanFlash === 'success' ? 'bg-emerald-500/10' : 'bg-red-500/10'
        }`}>
          <div className={`flex flex-col items-center gap-3 p-6 rounded-3xl shadow-2xl backdrop-blur-sm border ${
            scanFlash === 'success'
              ? 'bg-emerald-500/90 border-emerald-400 text-white'
              : 'bg-red-500/90 border-red-400 text-white'
          }`}>
            <ScanBarcode size={40} />
            <p className="font-black text-lg">
              {scanFlash === 'success' ? '✅ تم إضافة المنتج!' : '❌ باركود غير موجود!'}
            </p>
          </div>
        </div>
      )}

      {/* Barcode buffer indicator (shows while scanning) */}
      {barcodeBuffer.length > 0 && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-800/90 text-white text-sm font-mono px-4 py-2 rounded-xl backdrop-blur-sm flex items-center gap-2 shadow-lg">
          <ScanBarcode size={14} className="animate-pulse text-emerald-400" />
          <span className="text-emerald-400">{barcodeBuffer}</span>
        </div>
      )}

      {/* Products Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="p-4 bg-white border-b border-slate-200 shadow-sm z-10">
          
          {/* Connection status and shift details banner */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`} />
              <span className="text-xs font-bold text-slate-600">
                {isOnline ? 'متصل بالشبكة (أونلاين)' : 'منقطع الاتصال (وضع الأوفلاين)'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {store.currentShift && (
                <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 font-bold text-xs py-1 px-3">
                  وردية مفتوحة: {store.currentShift.id.slice(-6)}
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-lg text-xs font-bold border-red-200 hover:border-red-300 text-red-600 hover:text-red-700 bg-red-50/50 hover:bg-red-50 gap-1.5 transition-all"
                onClick={() => {
                  setMissingDrugName("");
                  setMissingQty(1);
                  setMissingNote("");
                  setShowMissingModal(true);
                }}
              >
                <PlusSquare size={13} />
                كشكول النواقص
              </Button>
            </div>
          </div>

          {/* Unsynced Offline Orders Notification Bar */}
          {store.offlineQueue && store.offlineQueue.length > 0 && (
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-2.5 text-right">
                <div className="w-3 h-3 bg-amber-500 rounded-full animate-ping" />
                <div>
                  <p className="text-xs font-black text-amber-800">
                    تنبيه: يوجد {store.offlineQueue.length} فاتورة مسجلة محلياً (أوفلاين) بانتظار المزامنة.
                  </p>
                  <p className="text-[10px] text-amber-600 font-bold mt-0.5">
                    {isOnline ? 'سيتم مزامنتها تلقائياً، أو اضغط على الزر للمزامنة اليدوية فوراً.' : 'يرجى استعادة الاتصال بالإنترنت لبدء مزامنة المبيعات.'}
                  </p>
                </div>
              </div>
              <Button 
                onClick={handleSyncOffline} 
                disabled={syncingOffline || !isOnline}
                size="sm" 
                className="h-9 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black gap-2 disabled:opacity-40"
              >
                {syncingOffline ? (
                  <>
                    <RefreshCw size={12} className="animate-spin" />
                    جاري المزامنة...
                  </>
                ) : (
                  <>
                    <RefreshCw size={12} />
                    مزامنة الفواتير الآن
                  </>
                )}
              </Button>
            </div>
          )}

          <div className="relative max-w-2xl mx-auto mb-4">
            <ScanBarcode className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <Input 
              ref={searchInputRef}
              className="w-full pl-10 pr-10 py-6 text-lg bg-slate-50 border-slate-200 rounded-xl"
              placeholder="امسح الباركود أو ابحث عن المنتج... (F2)"
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            <Button variant={activeCategory === "all" ? "default" : "secondary"}
              className={`rounded-full whitespace-nowrap px-6 ${activeCategory === "all" ? "bg-primary text-white" : "bg-slate-100 text-slate-600"}`}
              onClick={() => setActiveCategory("all")}>الكل</Button>
            {categories.map(cat => (
              <Button key={cat} variant={activeCategory === cat ? "default" : "secondary"}
                className={`rounded-full whitespace-nowrap px-6 ${activeCategory === cat ? "bg-primary text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                onClick={() => setActiveCategory(cat)}>{cat}</Button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 md:p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {filtered.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-4 animate-pulse">
                  <Search size={24} />
                </div>
                <h3 className="font-bold text-slate-700 text-base mb-1">لم يتم العثور على أي منتج</h3>
                <p className="text-sm text-slate-400 max-w-md mb-6">
                  لم نتمكن من العثور على أي منتج يطابق "{searchQuery}". يمكنك تسجيله في كشكول النواقص لطلبه فوراً.
                </p>
                <Button 
                  onClick={() => {
                    setMissingDrugName(searchQuery);
                    setMissingQty(1);
                    setMissingNote("");
                    setShowMissingModal(true);
                  }}
                  className="bg-primary text-white hover:bg-primary/90 rounded-xl px-6 py-2.5 font-bold shadow-lg shadow-primary/20 flex items-center gap-2"
                >
                  <PlusSquare size={18} />
                  تسجيل صنف ناقص في الكشكول
                </Button>
              </div>
            ) : (
              filtered.map(product => {
              const hasAltsInStock = product.stock === 0 && product.activeIngredient && store.products.some(p => 
                p.id !== product.id && 
                p.activeIngredient && 
                p.activeIngredient.trim().toLowerCase() === product.activeIngredient?.trim().toLowerCase() && 
                p.stock > 0
              );
              return (
                <Card key={product.id} className={`overflow-hidden border-slate-100 hover:shadow-xl transition-all duration-300 relative group flex flex-col h-full rounded-2xl bg-white/50 backdrop-blur-sm ${product.stock === 0 ? "opacity-60 grayscale-[30%]" : ""}`}>
                  <div className="absolute top-3 right-3 z-10 flex flex-row-reverse gap-1">
                    <Badge className={`${product.stock === 0 ? "bg-red-50 text-red-600 border-red-100" : product.stock < 5 ? "bg-rose-50 text-rose-600 border-rose-100" : "bg-indigo-50 text-indigo-600 border-indigo-100"} border px-2 py-0.5 text-[10px] font-bold rounded-lg`}>
                      {product.stock === 0 ? "غير متوفر ❌" : `${product.stock} في المخزن`}
                    </Badge>
                    {hasAltsInStock && (
                      <Badge className="bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-0.5 text-[10px] font-bold rounded-lg animate-pulse flex items-center gap-0.5">
                        البديل متوفر 🔄
                      </Badge>
                    )}
                  </div>
                  <CardContent className="p-0 flex flex-col h-full">
                    <div className="h-36 bg-slate-50/50 flex items-center justify-center relative overflow-hidden">
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center text-primary group-hover:scale-110 transition-transform duration-500">
                          <PlusSquare size={28} />
                        </div>
                      )}
                    </div>
                    <div className="p-4 flex-1 flex flex-col">
                      <h3 className="font-bold text-slate-800 text-sm mb-0.5 group-hover:text-primary transition-colors">{product.name}</h3>
                      {product.activeIngredient && (
                        <p className="text-[10px] text-slate-500 font-bold bg-slate-100 px-1.5 py-0.5 rounded-md inline-block max-w-max mb-1">
                          🧪 {product.activeIngredient}
                        </p>
                      )}
                      <p className="text-[10px] text-slate-400 font-medium">{product.category}</p>
                      <div className="mt-auto flex items-center justify-between pt-2">
                        <div className="font-extrabold text-slate-800 text-lg">{product.price.toFixed(2)}<span className="text-[10px] font-bold text-slate-500"> ج.م</span></div>
                        <Button size="icon" 
                          onClick={() => {
                            if (product.stock === 0) {
                              setSelectedAltProduct(product);
                              setShowAlternativesModal(true);
                            } else {
                              store.addToCart(product);
                            }
                          }}
                          className={`h-10 w-10 rounded-xl ${product.stock === 0 ? "bg-amber-50 hover:bg-amber-100 text-amber-500 border border-amber-100 shadow-md shadow-amber-500/5 hover:-translate-y-0.5" : "bg-primary text-white shadow-lg shadow-primary/20 hover:-translate-y-0.5"} transition-all`}
                          title={product.stock === 0 ? "البدائل الدوائية المتاحة" : "إضافة إلى السلة"}
                        >
                          {product.stock === 0 ? <RefreshCw size={18} /> : <Plus size={20} />}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            }))}
            {filtered.length > 0 && <></>}
          </div>
        </div>
      </div>

      {/* Cart Sidebar */}
      <div className="w-80 lg:w-96 bg-white border-r border-slate-200 flex flex-col shadow-xl z-20">
        <div className="bg-slate-800 text-white p-3 flex flex-col gap-3 shadow-sm z-30 relative">
          {/* Row 1: Shift Info & Close Shift */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <Clock size={16} className="text-white" />
              </div>
              <div>
                <p className="text-xs text-slate-300 font-medium">الوردية الحالية</p>
                <p className="text-sm font-bold">{new Date(store.currentShift.start_time).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
            </div>
            
            <Button 
               variant="destructive" 
               size="sm" 
               className="text-xs font-bold h-8"
               onClick={async () => {
                 const totals = await store.getShiftTotals();
                 setShiftTotals(totals);
                 setActualCash("");
                 setShowCloseShift(true);
               }}
            >
              إغلاق الوردية
            </Button>
          </div>

          {/* Row 2: Selectors */}
          <div className="flex items-center gap-2">
             <div className="relative flex-1">
                <select 
                   className="w-full h-8 pl-8 pr-3 text-[11px] bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/10 appearance-none outline-none font-bold cursor-pointer transition-colors"
                   value={store.cashierId || ""}
                   onChange={(e) => store.setCashierId(e.target.value || undefined)}
                >
                   <option value="" className="text-slate-800">الكاشير الافتراضي</option>
                   {cashiers.map(c => (
                      <option key={c.id} value={c.id} className="text-slate-800">{c.full_name}</option>
                   ))}
                </select>
                <ChevronDown size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
             </div>
             
             <div className="relative flex-1">
                <select 
                   className="w-full h-8 pl-8 pr-3 text-[11px] bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/10 appearance-none outline-none font-bold cursor-pointer transition-colors"
                   value={store.deliveryId || ""}
                   onChange={(e) => store.setDeliveryId(e.target.value || undefined)}
                >
                   <option value="" className="text-slate-800">مندوب (لا يوجد)</option>
                   {deliveryPersons.map(d => (
                      <option key={d.id} value={d.id} className="text-slate-800">{d.full_name}</option>
                   ))}
                </select>
                <ChevronDown size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
             </div>
          </div>
        </div>

        {/* Order Tabs */}
        <div className="flex items-center gap-1 p-2 border-b border-slate-100 overflow-x-auto bg-slate-50/80">
          {store.tabs.map(tab => (
            <button key={tab.id} onClick={() => store.setActiveTab(tab.id)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${tab.id === store.activeTabId ? "bg-primary text-white shadow" : "bg-white text-slate-500 border border-slate-200 hover:border-primary/50"}`}>
              {tab.label}
              {tab.cart.length > 0 && (
                <span className={`rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-black ${tab.id === store.activeTabId ? "bg-white/20" : "bg-primary/10 text-primary"}`}>
                  {tab.cart.reduce((s, i) => s + i.quantity, 0)}
                </span>
              )}
              {store.tabs.length > 1 && (
                <X size={10} className="opacity-50 hover:opacity-100 ml-0.5"
                  onClick={e => { e.stopPropagation(); store.removeTab(tab.id); }} />
              )}
            </button>
          ))}
          <button onClick={store.addTab}
            className="p-1.5 rounded-lg bg-white border border-dashed border-slate-300 text-slate-400 hover:border-primary hover:text-primary transition-colors shrink-0">
            <Plus size={14} />
          </button>
          {store.suspendedOrders.length > 0 && (
            <button onClick={() => setShowSuspendedList(true)}
              className="p-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-600 hover:bg-amber-100 transition-colors shrink-0 relative">
              <Clock size={14} />
              <span className="absolute -top-1 -right-1 bg-amber-500 text-white rounded-full w-4 h-4 text-[9px] flex items-center justify-center font-bold">
                {store.suspendedOrders.length}
              </span>
            </button>
          )}
        </div>

        <div className="p-3 border-b border-slate-100 bg-slate-50">
          {/* Patient autocomplete row */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <Input
                ref={patientInputRef}
                placeholder="ابحث عن مريض..."
                value={patientQuery}
                onChange={e => {
                  setPatientQuery(e.target.value);
                  store.setCustomerInfo(e.target.value, undefined);
                }}
                onFocus={() => { if (patientQuery) setShowPatientDropdown(true); }}
                className="pl-8 pr-9 text-sm bg-white border-slate-200 focus-visible:ring-primary/20 h-9"
              />
              {patientQuery && (
                <button
                  onClick={handleClearPatient}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-red-400 transition-colors"
                >
                  <X size={14} />
                </button>
              )}
              {/* Dropdown */}
              {showPatientDropdown && (
                <div
                  ref={patientDropdownRef}
                  className="absolute top-full right-0 left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden"
                >
                  {patientSearchLoading ? (
                    <div className="p-3 text-center text-xs text-slate-400">جاري البحث...</div>
                  ) : patientResults.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-400">لا توجد نتائج</div>
                  ) : (
                    patientResults.map(p => (
                      <button
                        key={p.id}
                        onMouseDown={() => handleSelectPatient(p)}
                        className="w-full text-right px-3 py-2.5 hover:bg-primary/5 transition-colors flex items-center gap-3 border-b border-slate-50 last:border-0"
                      >
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                          {p.name?.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0 text-right">
                          <p className="text-sm font-bold text-slate-800 truncate">{p.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{p.phone || "—"} · {p.file_number}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            {/* Add Patient button */}
            <button
              onClick={() => setShowAddPatient(true)}
              title="إضافة مريض جديد"
              className="h-9 w-9 rounded-lg border border-dashed border-primary/40 text-primary hover:bg-primary/5 hover:border-primary transition-colors flex items-center justify-center shrink-0"
            >
              <UserPlus size={16} />
            </button>
          </div>
          {/* Selected patient chip */}
          {activeTab?.customerId && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px] bg-primary/5 border border-primary/20 rounded-lg px-2.5 py-1.5">
              <div className="w-4 h-4 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[9px] font-bold shrink-0">
                ✓
              </div>
              <span className="font-bold text-primary truncate">{activeTab.customerName}</span>
              <span className="text-slate-400 mr-auto">مريض مرتبط</span>
            </div>
          )}

          {/* Insurance Contract Selector */}
          <div className="mt-2.5 pt-2.5 border-t border-slate-200/50">
            <div className="relative">
              <select
                className="w-full h-9 pl-8 pr-3 text-xs bg-white text-slate-700 rounded-lg border border-slate-200 outline-none font-bold cursor-pointer transition-all hover:border-primary/50 focus:border-primary"
                value={selectedInsuranceId || ""}
                onChange={(e) => setSelectedInsuranceId(e.target.value || undefined)}
              >
                <option value="" className="text-slate-800">📋 عميل نقدي (بدون جهة تعاقد)</option>
                {insuranceContracts.map(contract => (
                  <option key={contract.id} value={contract.id} className="text-slate-800">
                    🏢 {contract.name} (خصم {contract.discount_percent}% / تحمل {contract.patient_copay_percent}%)
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4">
              <FileText size={64} className="opacity-20" /><p className="text-sm font-medium">السلة فارغة</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.cartItemId} className="flex gap-3 bg-white border border-slate-100 rounded-xl p-3 shadow-sm relative">
                <button onClick={() => store.removeFromCart(item.cartItemId)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500 transition-colors"><X size={14} /></button>
                <div className="w-12 h-12 bg-slate-50 rounded-lg flex items-center justify-center text-primary border border-slate-100 shrink-0 mt-1"><PlusSquare size={20} /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 pr-4">
                    <h4 className="font-bold text-slate-800 text-sm truncate flex-1">{item.product.name}</h4>
                    <button onClick={() => { setNoteItemId(item.cartItemId); setNoteText(item.note || ""); }}
                      className={`p-0.5 rounded transition-colors shrink-0 ${item.note ? "text-amber-500 hover:text-amber-600" : "text-slate-300 hover:text-slate-500"}`}
                      title="ملاحظة"><MessageSquare size={13} /></button>
                  </div>
                  {item.note && (
                    <p className="text-[10px] text-amber-600 bg-amber-50 rounded px-1.5 py-0.5 mt-0.5 truncate">{item.note}</p>
                  )}
                  {(item.product.stripsPerBox || item.product.pillsPerStrip) && (
                    <div className="flex gap-1 mt-1">
                      <Badge variant={item.unit === "box" ? "default" : "outline"} className={`text-[10px] cursor-pointer px-1.5 py-0 ${item.unit === "box" ? "bg-primary text-white border-primary" : "text-slate-500"}`} onClick={() => store.updateUnit(item.cartItemId, "box")}>علبة</Badge>
                      {item.product.stripsPerBox && <Badge variant={item.unit === "strip" ? "default" : "outline"} className={`text-[10px] cursor-pointer px-1.5 py-0 ${item.unit === "strip" ? "bg-primary text-white border-primary" : "text-slate-500"}`} onClick={() => store.updateUnit(item.cartItemId, "strip")}>شريط</Badge>}
                      {item.product.pillsPerStrip && <Badge variant={item.unit === "pill" ? "default" : "outline"} className={`text-[10px] cursor-pointer px-1.5 py-0 ${item.unit === "pill" ? "bg-primary text-white border-primary" : "text-slate-500"}`} onClick={() => store.updateUnit(item.cartItemId, "pill")}>حبة</Badge>}
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <div>
                      <div className="font-bold text-slate-800">{(item.unitPrice * item.quantity).toFixed(2)}<span className="text-xs text-slate-500"> ج.م</span></div>
                      {item.quantity > 1 && (
                        <div className="text-[10px] text-slate-400 mt-0.5" dir="rtl">
                          ({item.unitPrice.toFixed(2)} ج.م / {item.unit === 'box' ? 'علبة' : item.unit === 'strip' ? 'شريط' : 'حبة'})
                        </div>
                      )}
                    </div>
                    <div className="flex items-center bg-slate-50 rounded-lg border border-slate-200 p-0.5">
                      <button className="w-6 h-6 flex items-center justify-center text-slate-500 hover:bg-white hover:text-primary rounded-md" onClick={() => store.updateQuantity(item.cartItemId, item.quantity - 1)}><Minus size={14} /></button>
                      <span className="w-6 text-center text-xs font-bold">{item.quantity}</span>
                      <button className="w-6 h-6 flex items-center justify-center text-slate-500 hover:bg-white hover:text-primary rounded-md" onClick={() => store.updateQuantity(item.cartItemId, item.quantity + 1)}><Plus size={14} /></button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Totals */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 space-y-3">
          {/* Orders button */}
          <button
            onClick={() => { fetchTodayOrders(); setShowOrdersModal(true); }}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:border-primary/40 hover:bg-primary/5 transition-all group"
          >
            <div className="flex items-center gap-2 text-slate-600 group-hover:text-primary">
              <ListOrdered size={16} />
              <span className="text-sm font-bold">أوردرات اليوم</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">انظر الكل</span>
            </div>
          </button>

          <div className="flex justify-between items-start text-sm">
            <div>
              <span className="text-slate-500">المجموع الفرعي</span>
              {itemCount > 0 && <div className="text-[10px] text-slate-400 mt-0.5 font-medium">{itemCount} صنف في الفاتورة</div>}
            </div>
            <span className="font-medium text-slate-800">{subtotal.toFixed(2)} ج.م</span>
          </div>

          {discountAmount > 0 && (
            <div className="flex justify-between items-start text-sm text-red-500">
              <span>الخصم</span>
              <span className="font-medium">- {discountAmount.toFixed(2)} ج.م</span>
            </div>
          )}

          {deliveryFee > 0 && (
            <div className="flex justify-between items-start text-sm text-slate-600">
              <span>خدمة التوصيل</span>
              <span className="font-medium">+ {deliveryFee.toFixed(2)} ج.م</span>
            </div>
          )}

          <div className="border-t border-slate-200 pt-3 flex justify-between items-end">
            <span className="font-bold text-slate-800">الإجمالي<br />النهائي</span>
            <div className="text-right"><span className="text-3xl font-black text-primary">{total.toFixed(2)}</span><span className="text-sm font-bold text-primary ml-1">ج.م</span></div>
          </div>

          {selectedContract && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 space-y-1.5 text-xs font-bold text-slate-700 mt-2" dir="rtl">
              <div className="flex justify-between">
                <span className="text-indigo-600">جهة التعاقد:</span>
                <span>{selectedContract.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-indigo-600">خصم التعاقد:</span>
                <span>{selectedContract.discount_percent}%</span>
              </div>
              <div className="flex justify-between">
                <span>الإجمالي بعد الخصم:</span>
                <span>{insuranceTotalWithDiscount.toFixed(2)} ج.م</span>
              </div>
              <div className="flex justify-between border-t border-indigo-100/50 pt-1.5">
                <span className="text-indigo-600">تتحمله جهة التعاقد:</span>
                <span>{insurancePaidAmount.toFixed(2)} ج.م</span>
              </div>
              <div className="flex justify-between font-black text-sm text-indigo-900 pt-1">
                <span>مطلوب من المريض:</span>
                <span>{patientCopayAmount.toFixed(2)} ج.م</span>
              </div>
            </div>
          )}
          {lastInvoice && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
              <p className="text-emerald-700 text-xs font-bold">تم البيع بنجاح!</p>
              <p className="text-emerald-600 text-[10px] mt-0.5">فاتورة: {lastInvoice}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button variant="outline" className="w-full bg-white text-slate-600 border-slate-200" onClick={store.clearCart}>
              <Trash2 size={16} className="mr-2" />إلغاء
            </Button>
            <Button variant="outline" disabled={cart.length === 0}
              className={`w-full bg-white border-slate-200 ${cart.length > 0 ? "text-amber-600 border-amber-200 hover:bg-amber-50" : "text-slate-300"}`}
              onClick={() => cart.length > 0 && setShowSuspendModal(true)}>
              <Clock size={16} className="mr-2" />تعليق (F8)
            </Button>
          </div>
          <Button className="w-full h-14 text-lg font-bold shadow-lg shadow-primary/25" disabled={cart.length === 0}
            onClick={() => { setCheckoutError(null); setLastInvoice(null); setPaymentStep('method'); setShowPayModal(true); }}>
            إتمام الدفع (F12) <ShoppingCart size={20} className="ml-2" />
          </Button>
        </div>
      </div>

      {/* ===== Payment Modal ===== */}
      {showPayModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-200">
            {paymentStep === 'method' ? (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-black text-slate-800">اختر طريقة الدفع</h2>
                  <button onClick={() => setShowPayModal(false)} className="text-slate-400 hover:text-slate-600 bg-slate-100 rounded-xl p-2"><X size={18} /></button>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3 mb-6">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-600"></span>
                    <div className="flex bg-slate-200/50 rounded-lg p-0.5 border border-slate-200">
                      <button onClick={() => store.setDiscountType("amount")} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${discountType === "amount" ? "bg-white text-slate-800 shadow-sm" : "text-slate-400"}`}>ج.م</button>
                      <button onClick={() => store.setDiscountType("percent")} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${discountType === "percent" ? "bg-white text-slate-800 shadow-sm" : "text-slate-400"}`}>%</button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input type="number" min="0" max={discountType === "percent" ? 100 : subtotal}
                      placeholder={discountType === "percent" ? "نسبة الخصم..." : "قيمة الخصم..."}
                      value={discount || ""} onChange={e => store.setDiscount(Math.max(0, Number(e.target.value)))}
                      className="h-10 text-sm font-bold text-red-500 bg-white border-slate-200 text-center rounded-xl" />
                    {discount > 0 && <span className="text-sm font-black text-red-500 whitespace-nowrap">- {discountAmount.toFixed(2)} ج.م</span>}
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3 mb-6">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-600">خدمة التوصيل</span>
                    <span className="text-[10px] text-slate-400 font-bold">ج.م</span>
                  </div>
                  <Input type="number" min="0"
                    placeholder="قيمة التوصيل..."
                    value={deliveryFee || ""} 
                    onChange={e => store.setDeliveryFee(Math.max(0, Number(e.target.value)))}
                    className="h-10 text-sm font-bold text-slate-700 bg-white border-slate-200 text-center rounded-xl" />
                </div>

                <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-2xl p-4 mb-6 text-center">
                  {selectedContract ? (
                    <>
                      <div className="text-3xl font-black text-primary">
                        {patientCopayAmount.toFixed(2)} <span className="text-base font-bold">ج.م</span>
                      </div>
                      <div className="text-slate-500 text-[11px] font-bold mt-1">
                        (المبلغ المطلوب تحصيله من المريض)
                      </div>
                      <div className="mt-2 pt-2 border-t border-primary/10 text-[10px] text-slate-400 font-bold flex justify-around">
                        <span>الإجمالي: {total.toFixed(2)}</span>
                        <span>تحمل التأمين: {insurancePaidAmount.toFixed(2)}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-4xl font-black text-primary">{total.toFixed(2)} <span className="text-lg font-bold">ج.م</span></div>
                      <div className="text-slate-400 text-xs mt-1">{itemCount} صنف</div>
                    </>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {payMethods.map(m => {
                    const isDisabled = m.disabled || isProcessing;
                    return (
                      <button key={m.id} 
                        onClick={() => {
                          if (m.id === 'mixed') {
                            setMixedCash(targetMixedTotal);
                            setMixedVisa(0);
                            setPaymentStep('mixed_details');
                          } else {
                            handlePay(m.id);
                          }
                        }}
                        disabled={isDisabled}
                        className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 border-slate-200 hover:border-primary hover:bg-primary/5 active:scale-95 transition-all ${isDisabled ? "opacity-50 cursor-not-allowed bg-slate-50" : ""}`}
                        title={m.id === 'credit' && isDisabled ? "يجب ربط مريض بالفاتورة لتفعيل الدفع الآجل" : ""}
                      >
                        <span className="text-3xl">{m.emoji}</span>
                        <span className="font-bold text-slate-700 text-xs text-center">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
                {checkoutError && <p className="mt-4 text-red-500 text-xs text-center bg-red-50 rounded-xl p-3">{checkoutError}</p>}
                {isProcessing && <p className="mt-4 text-primary text-xs text-center animate-pulse">جارٍ معالجة الدفع...</p>}
              </>
            ) : paymentStep === 'mixed_details' ? (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-black text-slate-800">تفاصيل الدفع المختلط</h2>
                  <button onClick={() => setPaymentStep('method')} className="text-slate-400 hover:text-slate-600 bg-slate-100 rounded-xl p-2"><X size={18} /></button>
                </div>
                
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">المدفوع نقداً (كاش) *</label>
                    <Input 
                      type="number"
                      min="0"
                      value={mixedCash || ""}
                      onChange={e => {
                        const cashVal = Number(e.target.value);
                        setMixedCash(cashVal);
                        setMixedVisa(Math.max(0, targetMixedTotal - cashVal));
                      }}
                      className="text-lg font-bold text-center h-12 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">المدفوع بالفيزا/الشبكة *</label>
                    <Input 
                      type="number"
                      min="0"
                      value={mixedVisa || ""}
                      onChange={e => {
                        const visaVal = Number(e.target.value);
                        setMixedVisa(visaVal);
                        setMixedCash(Math.max(0, targetMixedTotal - visaVal));
                      }}
                      className="text-lg font-bold text-center h-12 rounded-xl"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl mb-6 space-y-2">
                  <div className="flex justify-between text-xs font-bold text-slate-500">
                    <span>إجمالي المطلوب:</span>
                    <span>{targetMixedTotal.toFixed(2)} ج.م</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-slate-500">
                    <span>إجمالي المدفوع:</span>
                    <span>{(mixedCash + mixedVisa).toFixed(2)} ج.م</span>
                  </div>
                  {mixedCash + mixedVisa > targetMixedTotal && (
                    <div className="flex justify-between text-xs font-black text-emerald-600 border-t border-dashed border-slate-200 pt-2">
                      <span>الباقي للعميل (مرتجع كاش):</span>
                      <span>{(mixedCash + mixedVisa - targetMixedTotal).toFixed(2)} ج.م</span>
                    </div>
                  )}
                  {mixedCash + mixedVisa < targetMixedTotal && (
                    <div className="text-[11px] text-red-500 font-bold bg-red-50 p-2 rounded-lg text-center animate-pulse">
                      المبلغ المدفوع أقل من إجمالي المطلوب بـ {(targetMixedTotal - (mixedCash + mixedVisa)).toFixed(2)} ج.م
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 h-12 rounded-xl text-sm font-bold" onClick={() => setPaymentStep('method')}>
                    رجوع
                  </Button>
                  <Button 
                    className="flex-1 h-12 rounded-xl text-sm font-bold bg-[#002B5B]" 
                    disabled={mixedCash + mixedVisa < targetMixedTotal || isProcessing}
                    onClick={() => handlePay('mixed', mixedCash, mixedVisa)}
                  >
                    {isProcessing ? "جاري الحفظ..." : "تأكيد الدفع"}
                  </Button>
                </div>
                {checkoutError && <p className="mt-4 text-red-500 text-xs text-center bg-red-50 rounded-xl p-3">{checkoutError}</p>}
              </>
            ) : (
              <div className="text-center">
                <div className="w-20 h-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={40} />
                </div>
                <h2 className="text-2xl font-black text-slate-800 mb-2">تم الدفع بنجاح!</h2>
                <p className="text-slate-500 text-sm mb-6">رقم الفاتورة: <span className="font-mono font-bold text-slate-800">{lastInvoice}</span></p>
                <div className="space-y-3">
                  <Button 
                    className="w-full h-12 text-lg font-bold bg-slate-800 hover:bg-slate-900 text-white"
                    onClick={() => {
                      setTimeout(() => window.print(), 100);
                    }}
                  >
                    <Printer size={20} className="mr-2" /> طباعة الفاتورة
                  </Button>
                  <Button 
                    variant="outline"
                    className="w-full h-12 text-lg font-bold border-slate-200 text-slate-600 hover:bg-slate-50"
                    onClick={() => setShowPayModal(false)}
                  >
                    إتمام الدفع بدون فاتورة
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== Suspend Modal ===== */}
      {showSuspendModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-slate-800">تعليق الطلب</h2>
              <button onClick={() => setShowSuspendModal(false)} className="text-slate-400 hover:text-slate-600 bg-slate-100 rounded-xl p-2"><X size={18} /></button>
            </div>
            <p className="text-sm text-slate-500 mb-4">سيتم حفظ الطلب ويمكنك استرجاعه في أي وقت</p>
            <Input placeholder="ملاحظة اختيارية (اسم العميل مثلاً)..." value={suspendNote} onChange={e => setSuspendNote(e.target.value)} className="mb-4" />
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={() => setShowSuspendModal(false)}>إلغاء</Button>
              <Button onClick={handleSuspend} className="bg-amber-500 hover:bg-amber-600 text-white">
                <Clock size={16} className="mr-2" />تعليق الآن
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Suspended Orders List ===== */}
      {showSuspendedList && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-black text-slate-800">الطلبات المعلقة ({store.suspendedOrders.length})</h2>
              <button onClick={() => setShowSuspendedList(false)} className="text-slate-400 hover:text-slate-600 bg-slate-100 rounded-xl p-2"><X size={18} /></button>
            </div>
            <div className="space-y-3 max-h-96 overflow-auto">
              {store.suspendedOrders.length === 0 ? (
                <p className="text-center text-slate-400 text-sm py-10">لا توجد طلبات معلقة</p>
              ) : store.suspendedOrders.map(order => (
                <div key={order.id} className="flex items-center gap-3 p-4 bg-amber-50/50 rounded-2xl border border-amber-200">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 text-sm">{order.label}</p>
                    {order.note && <p className="text-xs text-slate-500 truncate">{order.note}</p>}
                    <p className="text-[10px] text-slate-400 mt-0.5">{order.cart.reduce((s, i) => s + i.quantity, 0)} صنف • {order.suspendedAt.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" onClick={() => { store.resumeOrder(order.id); setShowSuspendedList(false); }} className="bg-amber-500 hover:bg-amber-600 text-white text-xs">استرجاع</Button>
                    <button onClick={() => store.deleteSuspendedOrder(order.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1"><Trash2 size={15} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== Note Modal ===== */}
      {noteItemId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black text-slate-800">ملاحظة على الصنف</h2>
              <button onClick={() => setNoteItemId(null)} className="text-slate-400 hover:text-slate-600 bg-slate-100 rounded-xl p-2"><X size={18} /></button>
            </div>
            <Input placeholder="اكتب ملاحظتك هنا..." value={noteText} onChange={e => setNoteText(e.target.value)} className="mb-4" autoFocus />
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={() => setNoteItemId(null)}>إلغاء</Button>
              <Button onClick={() => { store.updateItemNote(noteItemId, noteText); setNoteItemId(null); setNoteText(""); }}>
                <MessageSquare size={16} className="mr-2" />حفظ الملاحظة
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* ===== Close Shift Modal ===== */}
      {showCloseShift && shiftTotals && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black text-slate-800">إغلاق الوردية (تقفيل الجلسة)</h2>
              <button onClick={() => setShowCloseShift(false)} className="text-slate-400 hover:text-slate-600 bg-slate-100 rounded-xl p-2"><X size={18} /></button>
            </div>
            
            <div className="space-y-3 mb-6">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="flex justify-between items-center text-sm mb-2">
                  <span className="text-slate-500 font-bold">الرصيد الافتتاحي</span>
                  <span className="font-bold text-slate-800">{shiftTotals.startingCash.toFixed(2)} ج.م</span>
                </div>
                <div className="border-t border-slate-100 my-2 pt-2"></div>
                <div className="flex justify-between items-center text-sm mb-2">
                  <span className="text-slate-500 font-bold">مبيعات الكاش</span>
                  <span className="font-bold text-slate-800">{shiftTotals.cashSales.toFixed(2)} ج.م</span>
                </div>
                <div className="flex justify-between items-center text-sm mb-2">
                  <span className="text-slate-500 font-bold">مبيعات الفيزا</span>
                  <span className="font-bold text-slate-800">{shiftTotals.visaSales.toFixed(2)} ج.م</span>
                </div>
                <div className="flex justify-between items-center text-sm mb-2">
                  <span className="text-slate-500 font-bold">إنستاباي / فودافون كاش</span>
                  <span className="font-bold text-slate-800">{(shiftTotals.instapaySales + shiftTotals.vodafoneCashSales).toFixed(2)} ج.م</span>
                </div>
                <div className="border-t border-slate-200 mt-3 pt-3 flex justify-between items-center">
                  <span className="text-slate-600 font-black">إجمالي المبيعات</span>
                  <span className="font-black text-primary text-lg">{shiftTotals.totalSales.toFixed(2)} ج.م</span>
                </div>
              </div>

              <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-amber-700 font-bold">الكاش المتوقع في الدرج</span>
                  <span className="font-black text-amber-600 text-lg">{shiftTotals.expectedCash.toFixed(2)} ج.م</span>
                </div>
                <p className="text-[10px] text-amber-500">يشمل الكاش الافتتاحي + مبيعات الكاش</p>
              </div>

              <div className="pt-2">
                <label className="text-sm font-bold text-slate-700 mb-1 block">الكاش الفعلي الموجود في الدرج (ج.م)</label>
                <Input 
                  type="number" 
                  min="0" 
                  value={actualCash} 
                  onChange={e => setActualCash(e.target.value)}
                  className={`text-center text-lg font-bold h-12 bg-white ${actualCash !== "" && Math.abs(Number(actualCash) - shiftTotals.expectedCash) > 0.01 ? "border-red-500 text-red-600 focus-visible:ring-red-500" : "border-slate-200"}`}
                  placeholder="0.00"
                />
                {actualCash !== "" && (
                  <div className="mt-2 text-center text-xs font-bold">
                    {(() => {
                      const diff = Number(actualCash) - shiftTotals.expectedCash;
                      if (Math.abs(diff) < 0.01) {
                        return <p className="text-emerald-600">✓ المبلغ مطابِق تماماً!</p>;
                      } else if (diff > 0) {
                        return <p className="text-blue-600">هناك زيادة بقيمة +{diff.toFixed(2)} ج.م</p>;
                      } else {
                        return <p className="text-rose-600">هناك عجز بقيمة {diff.toFixed(2)} ج.م</p>;
                      }
                    })()}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={() => setShowCloseShift(false)} className="h-12 font-bold">إلغاء</Button>
              <Button 
                className="h-12 font-bold bg-slate-800 hover:bg-slate-900 text-white disabled:opacity-50"
                disabled={actualCash === "" || isProcessing}
                onClick={async () => {
                  const diff = Number(actualCash) - shiftTotals.expectedCash;
                  if (Math.abs(diff) > 0.01) {
                    const confirmMsg = diff > 0 
                      ? `هناك زيادة في الكاش بقيمة +${diff.toFixed(2)} ج.م. هل تريد تأكيد إغلاق الوردية وتسجيل هذه الزيادة؟`
                      : `هناك عجز في الكاش بقيمة ${diff.toFixed(2)} ج.م. هل تريد تأكيد إغلاق الوردية وتسجيل هذا العجز؟`;
                    if (!confirm(confirmMsg)) return;
                  }
                  setIsProcessing(true);
                  await store.closeShift(shiftTotals.expectedCash, Number(actualCash));
                  setIsProcessing(false);
                  setShowCloseShift(false);
                }}
              >
                {isProcessing ? "جاري الإغلاق..." : "تأكيد الإغلاق"}
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* ===== Add Patient Modal ===== */}
      {showAddPatient && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6" dir="rtl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <UserPlus size={20} className="text-primary" />
                إضافة مريض جديد
              </h2>
              <button onClick={() => setShowAddPatient(false)} className="text-slate-400 hover:text-slate-600 bg-slate-100 rounded-xl p-2">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-xs font-bold text-slate-600 mb-1 block">اسم المريض *</label>
                <Input
                  value={newPatientName}
                  onChange={e => setNewPatientName(e.target.value)}
                  placeholder="الاسم الثلاثي..."
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 mb-1 block">رقم الهاتف (اختياري)</label>
                <Input
                  value={newPatientPhone}
                  onChange={e => setNewPatientPhone(e.target.value)}
                  placeholder="01xxxxxxxxx"
                  dir="ltr"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={() => setShowAddPatient(false)}>إلغاء</Button>
              <Button
                onClick={handleAddPatient}
                disabled={!newPatientName.trim() || addingPatient}
                className="bg-primary"
              >
                {addingPatient ? "جاري الحفظ..." : "إضافة وتحديد"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Today Orders Modal ===== */}
      {showOrdersModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" dir="rtl">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
              <div>
                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <ReceiptText size={22} className="text-primary" />
                  أوردرات اليوم
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">{new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
              <div className="flex items-center gap-3">
                {!ordersLoading && (
                  <div className="text-center">
                    <p className="text-2xl font-black text-primary">{todayOrders.length}</p>
                    <p className="text-[10px] text-slate-400 font-bold">فاتورة</p>
                  </div>
                )}
                {!ordersLoading && todayOrders.length > 0 && (
                  <div className="text-center">
                    <p className="text-2xl font-black text-emerald-600">{todayOrders.reduce((s, o) => s + (o.total || 0), 0).toFixed(0)}</p>
                    <p className="text-[10px] text-slate-400 font-bold">ج.م</p>
                  </div>
                )}
                <button onClick={() => setShowOrdersModal(false)} className="text-slate-400 hover:text-slate-600 bg-slate-100 rounded-xl p-2 mr-2">
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 p-4">
              {ordersLoading ? (
                <div className="flex items-center justify-center h-40">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : todayOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-slate-300">
                  <ReceiptText size={48} className="opacity-20 mb-3" />
                  <p className="font-medium">لا توجد أوردرات اليوم</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {todayOrders.map((order, idx) => {
                    const payLabels: Record<string, { label: string; color: string }> = {
                      cash: { label: 'كاش', color: 'bg-emerald-100 text-emerald-700' },
                      visa: { label: 'فيزا', color: 'bg-blue-100 text-blue-700' },
                      instapay: { label: 'إنستاباي', color: 'bg-purple-100 text-purple-700' },
                      vodafone_cash: { label: 'فودافون', color: 'bg-red-100 text-red-700' },
                    };
                    const pay = payLabels[order.payment_method] || { label: order.payment_method, color: 'bg-slate-100 text-slate-600' };
                    const itemsCount = order.sale_items?.length || 0;
                    const time = new Date(order.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
                    const isExpanded = expandedOrder === order.id;
                    let orderDeliveryId = undefined;
                    if (order.notes && order.notes.includes("مندوب: ")) {
                      const match = order.notes.match(/مندوب:\s*([a-f0-9-]+)/);
                      if (match) orderDeliveryId = match[1];
                    }
                    const orderDeliveryPerson = orderDeliveryId ? deliveryPersons.find(d => d.id === orderDeliveryId) : null;

                    return (
                      <div key={order.id} className="bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-slate-200 transition-all overflow-hidden">
                        <div 
                          className="flex items-center gap-4 p-4 cursor-pointer"
                          onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                        >
                          {/* Number badge */}
                          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-black text-sm shrink-0">
                            #{todayOrders.length - idx}
                          </div>
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-black text-slate-800 text-sm font-mono">{order.invoice_number}</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pay.color}`}>{pay.label}</span>
                              {order.patient_name && (
                                <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                  <UserPlus size={10} />
                                  {order.patient_name}
                                </span>
                              )}
                              {orderDeliveryPerson && (
                                <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-100 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                  🚴 {orderDeliveryPerson.full_name}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-slate-400">
                              <span className="flex items-center gap-1"><Clock size={10} /> {time}</span>
                              <span>{itemsCount} صنف</span>
                              {order.discount > 0 && <span className="text-red-400">خصم: {order.discount.toFixed(2)} ج.م</span>}
                              {order.delivery_fee > 0 && <span className="text-slate-500">توصيل: {order.delivery_fee.toFixed(2)} ج.م</span>}
                            </div>
                          </div>
                          {/* Total & Expand */}
                          <div className="text-right shrink-0 flex items-center gap-4">
                            <div>
                              <p className="text-lg font-black text-slate-800">{order.total?.toFixed(2)}</p>
                              <p className="text-[10px] text-slate-400 font-bold">ج.م</p>
                            </div>
                            <div className="text-slate-300">
                              {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                            </div>
                          </div>
                        </div>

                        {/* Expanded Content */}
                        {isExpanded && (
                          <div className="border-t border-slate-100 bg-slate-50 p-4 animate-in slide-in-from-top-2 duration-200">
                            <div className="flex items-center justify-between mb-3 gap-2">
                              <h4 className="text-sm font-bold text-slate-700">الأصناف المشتراة</h4>
                              <div className="flex gap-2">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-8 text-xs font-bold border-slate-200 text-slate-600 hover:bg-slate-50"
                                  onClick={(e) => { e.stopPropagation(); handleReprint(order); }}
                                >
                                  <Printer size={14} className="mr-1.5" />
                                  إعادة طباعة
                                </Button>
                                <Button 
                                  variant="destructive" 
                                  size="sm" 
                                  className="h-8 text-xs font-bold"
                                  onClick={(e) => { e.stopPropagation(); handleReturnOrder(order.id); }}
                                >
                                  <Undo2 size={14} className="mr-1.5" />
                                  استرجاع الفاتورة بالكامل
                                </Button>
                              </div>
                            </div>
                            <div className="space-y-2">
                              {order.sale_items?.map((item: any) => {
                                let unit = "box";
                                const product = item.products;
                                if (product) {
                                  if (product.strips_per_box && Math.abs(item.unit_price - (product.selling_price / product.strips_per_box)) < 0.01) {
                                    unit = "strip";
                                  } else if (product.strips_per_box && product.pills_per_strip && Math.abs(item.unit_price - (product.selling_price / (product.strips_per_box * product.pills_per_strip))) < 0.01) {
                                    unit = "pill";
                                  }
                                }
                                return (
                                  <div key={item.id} className="flex items-center justify-between bg-white border border-slate-100 rounded-lg p-3 flex-wrap gap-2">
                                    <div className="flex-1 min-w-[200px]">
                                      <p className="text-sm font-bold text-slate-800">{item.products?.name}</p>
                                      <div className="flex items-center gap-2 mt-1">
                                        <p className="text-xs text-slate-500 font-medium">
                                          {item.unit_price.toFixed(2)} ج.م
                                        </p>
                                        <div className="h-3 w-px bg-slate-200"></div>
                                        <div className="flex bg-slate-100 rounded-md p-0.5 border border-slate-200">
                                          <button 
                                            onClick={(e) => { e.stopPropagation(); handleUpdateItemQuantity(order.id, item.id, item.quantity - 1); }}
                                            className="w-5 h-5 flex items-center justify-center text-slate-500 hover:bg-white hover:text-primary hover:shadow-sm rounded transition-all"
                                          >
                                            <Minus size={12} />
                                          </button>
                                          <span className="w-6 text-center text-xs font-bold flex items-center justify-center text-slate-700">
                                            {item.quantity}
                                          </span>
                                          <button 
                                            onClick={(e) => { e.stopPropagation(); handleUpdateItemQuantity(order.id, item.id, item.quantity + 1); }}
                                            className="w-5 h-5 flex items-center justify-center text-slate-500 hover:bg-white hover:text-primary hover:shadow-sm rounded transition-all"
                                          >
                                            <Plus size={12} />
                                          </button>
                                        </div>
                                      </div>
                                      {(product?.strips_per_box || product?.pills_per_strip) && (
                                        <div className="flex gap-1 mt-2">
                                          <Badge 
                                            variant={unit === "box" ? "default" : "outline"} 
                                            className={`text-[10px] cursor-pointer px-1.5 py-0 hover:border-primary ${unit === "box" ? "bg-primary text-white border-primary" : "text-slate-500"}`} 
                                            onClick={(e) => { e.stopPropagation(); handleUpdateItemUnit(order.id, item.id, "box"); }}
                                          >
                                            علبة
                                          </Badge>
                                          {product?.strips_per_box && (
                                            <Badge 
                                              variant={unit === "strip" ? "default" : "outline"} 
                                              className={`text-[10px] cursor-pointer px-1.5 py-0 hover:border-primary ${unit === "strip" ? "bg-primary text-white border-primary" : "text-slate-500"}`} 
                                              onClick={(e) => { e.stopPropagation(); handleUpdateItemUnit(order.id, item.id, "strip"); }}
                                            >
                                              شريط
                                            </Badge>
                                          )}
                                          {product?.pills_per_strip && (
                                            <Badge 
                                              variant={unit === "pill" ? "default" : "outline"} 
                                              className={`text-[10px] cursor-pointer px-1.5 py-0 hover:border-primary ${unit === "pill" ? "bg-primary text-white border-primary" : "text-slate-500"}`} 
                                              onClick={(e) => { e.stopPropagation(); handleUpdateItemUnit(order.id, item.id, "pill"); }}
                                            >
                                              حبة
                                            </Badge>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-4 shrink-0">
                                      <p className="text-sm font-black text-slate-800 w-16 text-left">{item.total_price.toFixed(2)} ج.م</p>
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); handleReturnItem(order.id, item.id); }}
                                        className="text-xs text-red-500 hover:text-white hover:bg-red-500 px-2 py-1.5 rounded-md font-bold transition-all shadow-sm border border-red-100 flex items-center gap-1"
                                      >
                                        <Trash2 size={12} />
                                        حذف
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer summary */}
            {!ordersLoading && todayOrders.length > 0 && (
              <div className="border-t border-slate-100 p-4 bg-slate-50 rounded-b-3xl shrink-0">
                <div className="grid grid-cols-3 gap-3">
                  {['cash', 'visa', 'instapay'].map(method => {
                    const methodOrders = todayOrders.filter(o => o.payment_method === method || (method === 'instapay' && ['instapay', 'vodafone_cash'].includes(o.payment_method)));
                    const methodTotal = methodOrders.reduce((s, o) => s + (o.total || 0), 0);
                    const labels: Record<string, string> = { cash: 'كاش 💵', visa: 'فيزا 💳', instapay: 'إلكتروني 📱' };
                    return (
                      <div key={method} className="text-center bg-white rounded-xl p-2.5 border border-slate-100">
                        <p className="text-xs font-bold text-slate-500 mb-1">{labels[method]}</p>
                        <p className="text-base font-black text-slate-800">{methodTotal.toFixed(0)}</p>
                        <p className="text-[10px] text-slate-400">ج.م</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* ===== Alternatives Modal ===== */}
      {showAlternativesModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[99] flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl flex flex-col max-h-[85vh] border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-rose-50/30">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500">
                  <RefreshCw size={20} className="text-rose-500" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-base">بدائل الدواء: {selectedAltProduct?.name}</h3>
                  <p className="text-slate-400 text-xs mt-0.5">البدائل المتاحة بنفس المادة الفعالة في المخزن</p>
                </div>
              </div>
              <button onClick={() => setShowAlternativesModal(false)} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm font-bold text-slate-600 flex justify-between">
                <span>المادة الفعالة:</span>
                <span className="text-indigo-600 font-black">{selectedAltProduct?.activeIngredient || "غير مححدد"}</span>
              </div>

              {(() => {
                if (!selectedAltProduct?.activeIngredient) {
                  return (
                    <div className="text-center py-8 text-slate-400 text-sm font-bold">
                      ⚠️ هذا المنتج لا يحتوي على مادة فعالة مسجلة. يمكنك إضافتها من صفحة إدارة المخزن.
                    </div>
                  );
                }

                const alts = store.products.filter(p => 
                  p.id !== selectedAltProduct.id &&
                  p.activeIngredient &&
                  p.activeIngredient.trim().toLowerCase() === selectedAltProduct.activeIngredient.trim().toLowerCase() &&
                  p.stock > 0
                );

                if (alts.length === 0) {
                  return (
                    <div className="text-center py-8 text-slate-400 text-sm font-bold">
                      😞 لا توجد منتجات بديلة متوفرة في المخزن حالياً تحمل نفس المادة الفعالة.
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    {alts.map(alt => (
                      <div key={alt.id} className="flex items-center justify-between p-4 rounded-xl bg-indigo-50/30 border border-indigo-100/50 hover:border-indigo-200 transition-colors">
                        <div>
                          <p className="font-bold text-sm text-slate-800">{alt.name}</p>
                          <p className="text-[10px] font-bold text-indigo-600 mt-1">المخزن: {alt.stock} علبة</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-extrabold text-sm text-slate-800">{alt.price.toFixed(2)} ج.م</span>
                          <Button 
                            onClick={() => {
                              store.addToCart(alt);
                              setShowAlternativesModal(false);
                            }}
                            className="bg-[#002B5B] hover:bg-[#001f42] text-white text-xs font-bold rounded-xl h-9 px-4"
                          >
                            إضافة للسلة
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end shrink-0">
              <Button onClick={() => setShowAlternativesModal(false)} variant="outline" className="w-full rounded-xl">
                إغلاق
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Missing Drug Modal ===== */}
      {showMissingModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[99] flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl flex flex-col max-h-[85vh] border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-red-50/30">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-red-50/50 flex items-center justify-center text-red-600">
                  <PlusSquare size={20} />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-base">تسجيل صنف ناقص</h3>
                  <p className="text-slate-400 text-xs mt-0.5">تسجيل الدواء غير المتوفر في كشكول النواقص</p>
                </div>
              </div>
              <button onClick={() => setShowMissingModal(false)} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div className="space-y-1.5 text-right">
                <label className="text-xs font-bold text-slate-600">اسم الدواء / الصنف *</label>
                <Input 
                  placeholder="مثال: Panadol Extra 24 Tab" 
                  value={missingDrugName} 
                  onChange={e => setMissingDrugName(e.target.value)} 
                  className="rounded-xl border-slate-200 text-sm font-bold text-right"
                  dir="rtl"
                />
              </div>

              <div className="space-y-1.5 text-right">
                <label className="text-xs font-bold text-slate-600 block">الكمية المطلوبة</label>
                <div className="flex bg-slate-100 rounded-xl p-1 border border-slate-200 w-32">
                  <button 
                    onClick={() => setMissingQty(q => Math.max(1, q - 1))}
                    className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-white hover:text-primary hover:shadow-sm rounded-lg transition-all"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="flex-1 text-center font-bold flex items-center justify-center text-slate-700 text-sm">
                    {missingQty}
                  </span>
                  <button 
                    onClick={() => setMissingQty(q => q + 1)}
                    className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-white hover:text-primary hover:shadow-sm rounded-lg transition-all"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 text-right">
                <label className="text-xs font-bold text-slate-600">ملاحظات إضافية (اختياري)</label>
                <textarea 
                  placeholder="ملاحظات حول بدائل الدواء أو المورد أو رقم هاتف المريض إذا كان الدواء لطلب خاص..." 
                  value={missingNote} 
                  onChange={e => setMissingNote(e.target.value)} 
                  className="w-full min-h-[100px] text-sm p-3 rounded-xl border border-slate-200 outline-none focus:border-primary transition-colors text-right"
                  dir="rtl"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-2 shrink-0">
              <Button 
                onClick={handleSaveMissingDrug} 
                disabled={savingMissing || !missingDrugName.trim()}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold py-2 shadow-lg shadow-red-500/10 disabled:opacity-50"
              >
                {savingMissing ? "جاري الحفظ..." : "حفظ في الكشكول"}
              </Button>
              <Button onClick={() => setShowMissingModal(false)} variant="outline" className="rounded-xl font-bold">
                إلغاء
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Printable Receipt ===== */}
      <ReceiptPrint 
        receiptData={receiptData} 
        invoiceNumber={lastInvoice} 
        cashiers={cashiers} 
        deliveryPersons={deliveryPersons} 
      />
    </div>
  );
}
