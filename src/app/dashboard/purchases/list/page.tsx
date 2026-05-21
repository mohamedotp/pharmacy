"use client";

import { useState, useEffect } from "react";
import { Search, Plus, Filter, Calendar, User, Phone, MapPin, Mail, Building2, Eye, Trash2, Edit, Receipt, Banknote, Clock, FileText, ArrowRight, Truck, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import Link from "next/link";

export default function SuppliersManagementPage() {
  const { user } = useAuthStore();
  const router = useRouter();

  // State lists
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Stats state
  const [stats, setStats] = useState({
    totalSuppliers: 0,
    totalDebt: 0,
    activeOrders: 0,
    monthInvoices: 0
  });

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isTransactionsModalOpen, setIsTransactionsModalOpen] = useState(false);
  const [isInvoiceDetailsOpen, setIsInvoiceDetailsOpen] = useState(false);
  const [filterType, setFilterType] = useState("all");

  // Selected details
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [supplierTransactions, setSupplierTransactions] = useState<any[]>([]);
  const [selectedPurchase, setSelectedPurchase] = useState<any>(null);
  const [purchaseItems, setPurchaseItems] = useState<any[]>([]);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    contact_person: "",
    phone: "",
    email: "",
    address: "",
    total_debt: 0
  });

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Fetch Suppliers
      const { data: suppliersData, error: supError } = await supabase
        .from("suppliers")
        .select("*")
        .order("name");

      // 2. Fetch Recent Purchases
      const { data: purchasesData, error: purError } = await supabase
        .from("purchases")
        .select(`
          *,
          suppliers (name)
        `)
        .order("created_at", { ascending: false });

      if (supError) throw supError;
      if (purError) throw purError;

      const activeSuppliers = suppliersData || [];
      const allPurchases = purchasesData || [];

      setSuppliers(activeSuppliers);
      setPurchases(allPurchases);

      // Calculate stats
      const totalDebtVal = activeSuppliers.reduce((acc, curr) => acc + Number(curr.total_debt || 0), 0);
      const activeOrdersCount = allPurchases.filter(p => p.status === 'pending').length;
      
      // Calculate current month's invoices count
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0,0,0,0);
      const monthInvoicesCount = allPurchases.filter(p => new Date(p.created_at) >= startOfMonth).length;

      setStats({
        totalSuppliers: activeSuppliers.length,
        totalDebt: totalDebtVal,
        activeOrders: activeOrdersCount,
        monthInvoices: monthInvoicesCount
      });

    } catch (e) {
      console.error("Error fetching data:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setFormData({
      name: "",
      contact_person: "",
      phone: "",
      email: "",
      address: "",
      total_debt: 0
    });
    setIsAddModalOpen(true);
  };

  const handleCreateSupplier = async () => {
    if (!formData.name.trim()) return alert("اسم المورد مطلوب");
    try {
      const { error } = await supabase
        .from("suppliers")
        .insert({
          name: formData.name.trim(),
          contact_person: formData.contact_person.trim(),
          phone: formData.phone.trim(),
          email: formData.email.trim(),
          address: formData.address.trim(),
          total_debt: Number(formData.total_debt || 0),
          pharmacy_id: user?.pharmacy_id
        });

      if (error) throw error;
      setIsAddModalOpen(false);
      fetchData();
    } catch (e: any) {
      alert("خطأ أثناء إضافة المورد: " + e.message);
    }
  };

  const handleOpenEdit = (supplier: any) => {
    setSelectedSupplier(supplier);
    setFormData({
      name: supplier.name || "",
      contact_person: supplier.contact_person || "",
      phone: supplier.phone || "",
      email: supplier.email || "",
      address: supplier.address || "",
      total_debt: Number(supplier.total_debt || 0)
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateSupplier = async () => {
    if (!formData.name.trim()) return alert("اسم المورد مطلوب");
    try {
      const { error } = await supabase
        .from("suppliers")
        .update({
          name: formData.name.trim(),
          contact_person: formData.contact_person.trim(),
          phone: formData.phone.trim(),
          email: formData.email.trim(),
          address: formData.address.trim(),
          total_debt: Number(formData.total_debt || 0)
        })
        .eq("id", selectedSupplier.id);

      if (error) throw error;
      setIsEditModalOpen(false);
      fetchData();
    } catch (e: any) {
      alert("خطأ أثناء تعديل المورد: " + e.message);
    }
  };

  const handleDeleteSupplier = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا المورد نهائياً؟")) return;
    try {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;
      fetchData();
    } catch (e: any) {
      alert("لا يمكن حذف المورد لارتباطه بعمليات توريد سابقة. يمكنك تصفير مديونيته بدلاً من ذلك.");
    }
  };

  const handleOpenTransactions = async (supplier: any) => {
    setSelectedSupplier(supplier);
    setIsTransactionsModalOpen(true);
    setSupplierTransactions([]);

    const { data, error } = await supabase
      .from("purchases")
      .select("*")
      .eq("supplier_id", supplier.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setSupplierTransactions(data);
    }
  };

  const handleOpenInvoiceDetails = async (purchase: any) => {
    setSelectedPurchase(purchase);
    setIsInvoiceDetailsOpen(true);
    setPurchaseItems([]);

    const { data } = await supabase
      .from("purchase_items")
      .select(`
        *,
        products (name, barcode)
      `)
      .eq("purchase_id", purchase.id);

    if (data) setPurchaseItems(data);
  };

  const handleDeleteInvoice = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه الفاتورة؟ لن يتم استرجاع كميات المخزون تلقائياً.")) return;
    try {
      // If invoice was deferred (pending), revert supplier debt
      const { data: purchaseToDelete } = await supabase.from('purchases').select('status, total_amount, supplier_id').eq('id', id).single();
      if (purchaseToDelete && purchaseToDelete.status === 'pending') {
        const { data: sup } = await supabase.from('suppliers').select('total_debt').eq('id', purchaseToDelete.supplier_id).single();
        if (sup) {
          await supabase.from('suppliers').update({ total_debt: Math.max(0, (sup.total_debt || 0) - purchaseToDelete.total_amount) }).eq('id', purchaseToDelete.supplier_id);
        }
      }

      const { error } = await supabase.from("purchases").delete().eq("id", id);
      if (error) throw error;
      fetchData();
      if (isTransactionsModalOpen) {
        setSupplierTransactions(prev => prev.filter(p => p.id !== id));
      }
    } catch (e: any) {
      alert("خطأ أثناء الحذف: " + e.message);
    }
  };

  const handlePayInvoice = async (purchase: any) => {
    if (!confirm(`هل تأكيد تسديد فاتورة ${purchase.invoice_number || purchase.id.slice(0, 6).toUpperCase()} بقيمة ${purchase.total_amount?.toFixed(2)} ج.م؟`)) return;
    try {
      // 1. Update purchase status to paid
      const { error } = await supabase.from('purchases').update({
        status: 'paid',
        amount_paid: purchase.total_amount,
      }).eq('id', purchase.id);
      if (error) throw error;

      // 2. Deduct amount from supplier's total_debt
      const { data: sup } = await supabase.from('suppliers').select('total_debt').eq('id', purchase.supplier_id).single();
      if (sup) {
        const newDebt = Math.max(0, (sup.total_debt || 0) - purchase.total_amount);
        await supabase.from('suppliers').update({ total_debt: newDebt }).eq('id', purchase.supplier_id);
      }

      // Update local state immediately for responsive UX
      setSupplierTransactions(prev => prev.map(p => p.id === purchase.id ? { ...p, status: 'paid', amount_paid: purchase.total_amount } : p));
      setPurchases(prev => prev.map(p => p.id === purchase.id ? { ...p, status: 'paid', amount_paid: purchase.total_amount } : p));
      fetchData();
      alert("تم تسجيل التسديد بنجاح وتم خصم المبلغ من رصيد المورد المستحق ✅");
    } catch (e: any) {
      alert("خطأ أثناء تسديد الفاتورة: " + e.message);
    }
  };

  const filteredSuppliers = suppliers.filter(s => {
    const matchesSearch = s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.contact_person?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.phone?.includes(searchQuery);
    
    if (!matchesSearch) return false;

    if (filterType === 'all') return true;
    if (filterType === 'active') return Number(s.total_debt || 0) <= 4000;
    if (filterType === 'late') return Number(s.total_debt || 0) > 4000;
    if (filterType === 'has_debt') return Number(s.total_debt || 0) > 0;
    
    return true;
  });

  return (
    <div className="space-y-6 pb-12" dir="rtl">
      {/* Title & Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            إدارة الموردين
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">إدارة حسابات شركات الأدوية والمستودعات الطبية</p>
        </div>
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" className="bg-slate-100 hover:bg-slate-200 border-0 text-slate-700 font-bold gap-2">
                  <Filter size={16} />
                  تصفية
                </Button>
              }
            />
            <DropdownMenuContent className="w-56" align="end">
              <DropdownMenuLabel>حالة الموردين</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup value={filterType} onValueChange={setFilterType}>
                <DropdownMenuRadioItem value="all" className="cursor-pointer font-bold text-sm">الكل</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="active" className="cursor-pointer font-bold text-sm text-emerald-600">نشط (المديونية أقل من 4000)</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="late" className="cursor-pointer font-bold text-sm text-red-600">متأخر (تجاوز الحد)</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="has_debt" className="cursor-pointer font-bold text-sm text-amber-600">عليه مديونية (&gt; 0)</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button className="bg-[#002B5B] hover:bg-[#001f42] text-white font-bold gap-2" onClick={handleOpenAdd}>
            <Plus size={18} />
            إضافة مورد جديد
          </Button>
        </div>
      </div>

      {/* Main Grid of Supplier Cards */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[250px]">
          <div className="w-10 h-10 border-4 border-[#002B5B] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {filteredSuppliers.length === 0 ? (
            <div className="col-span-full text-center py-12 text-slate-400 font-bold bg-white rounded-2xl border border-slate-100">
              لا يوجد موردين مضافين حالياً أو مطابقين للبحث
            </div>
          ) : (
            filteredSuppliers.map((supplier) => {
              const firstLetter = supplier.name ? supplier.name.trim().charAt(0) : "م";
              const isLate = Number(supplier.total_debt || 0) > 4000;
              const lastPurchaseDate = purchases.find(p => p.supplier_id === supplier.id)?.created_at;

              return (
                <Card key={supplier.id} className="border-0 shadow-sm hover:shadow-md transition-shadow duration-300 bg-white relative overflow-hidden group">
                  <CardContent className="p-6">
                    {/* Top Header details inside Card */}
                    <div className="flex justify-between items-start mb-5">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-slate-100 group-hover:bg-primary/5 transition-colors rounded-xl flex items-center justify-center font-black text-slate-700 text-lg group-hover:text-primary">
                          {firstLetter}
                        </div>
                        <div>
                          <h3 className="font-black text-slate-800 text-base leading-tight group-hover:text-primary transition-colors">{supplier.name}</h3>
                          <span className="text-[10px] text-slate-400 font-mono">كود: SUP-{supplier.id.slice(0, 4).toUpperCase()}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <Badge className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${isLate ? "bg-rose-50 text-rose-600 hover:bg-rose-50 border-0" : "bg-emerald-50 text-emerald-600 hover:bg-emerald-50 border-0"}`}>
                          {isLate ? "متأخر" : "نشط"}
                        </Badge>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-blue-600" onClick={() => handleOpenEdit(supplier)}>
                            <Edit size={14} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-600" onClick={() => handleDeleteSupplier(supplier.id)}>
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Main details */}
                    <div className="space-y-2.5 border-t border-slate-50 pt-4 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-bold">الرصيد المستحق:</span>
                        <span className={`font-black text-sm ${Number(supplier.total_debt || 0) > 0 ? "text-rose-600" : "text-slate-700"}`}>
                          {Number(supplier.total_debt || 0).toLocaleString("ar-EG", { minimumFractionDigits: 2 })} ج.م
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-bold">آخر عملية شراء:</span>
                        <span className="text-slate-700 font-medium">
                          {lastPurchaseDate ? new Date(lastPurchaseDate).toLocaleDateString("ar-EG", { day: 'numeric', month: 'long', year: 'numeric' }) : "لا يوجد"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-bold">مسؤول التواصل:</span>
                        <span className="text-slate-700 font-medium">{supplier.contact_person || "غير محدد"}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-bold">التواصل:</span>
                        <span className="text-slate-700 font-mono tracking-wide">{supplier.phone || "لا يوجد"}</span>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="grid grid-cols-2 gap-3 mt-6 border-t border-slate-50 pt-4">
                      <Button variant="outline" className="w-full text-slate-600 border-slate-100 hover:bg-slate-50 hover:text-slate-900 font-bold text-xs" onClick={() => handleOpenTransactions(supplier)}>
                        تاريخ المعاملات
                      </Button>
                      <Button className="w-full bg-[#002B5B] hover:bg-[#001f42] text-white font-bold text-xs" onClick={() => router.push(`/dashboard/purchases?supplierId=${supplier.id}`)}>
                        طلب شراء
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Recent Supply Invoices History Section */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm mt-8 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-black text-slate-800">سجل فواتير التوريد الأخيرة</h2>
          <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-blue-500 rounded-full"></span> مكتمل</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-orange-500 rounded-full"></span> قيد المعالجة</span>
            <Link href="/dashboard/purchases" className="text-primary hover:underline">عرض الكل</Link>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                <TableHead className="text-right font-bold text-slate-700">رقم الفاتورة</TableHead>
                <TableHead className="text-right font-bold text-slate-700">المورد</TableHead>
                <TableHead className="text-right font-bold text-slate-700">التاريخ</TableHead>
                <TableHead className="text-center font-bold text-slate-700">المبلغ الإجمالي</TableHead>
                <TableHead className="text-center font-bold text-slate-700">الحالة</TableHead>
                <TableHead className="text-left font-bold text-slate-700">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-400">جاري التحميل...</TableCell>
                </TableRow>
              ) : purchases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-400">لا توجد فواتير توريد سابقة</TableCell>
                </TableRow>
              ) : (
                purchases.slice(0, 5).map((purchase) => (
                  <TableRow key={purchase.id} className="hover:bg-slate-50/50">
                    <TableCell className="font-mono font-bold text-[#002B5B] text-sm">{purchase.invoice_number || `#${purchase.id.slice(0, 6).toUpperCase()}`}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center text-[10px] font-bold text-slate-600">
                          {purchase.suppliers?.name ? purchase.suppliers.name.trim().charAt(0) : "م"}
                        </div>
                        <span className="font-bold text-slate-800 text-xs">{purchase.suppliers?.name || "مورد مجهول"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-600 text-xs">{new Date(purchase.created_at).toLocaleDateString("ar-EG")}</TableCell>
                    <TableCell className="text-center font-black text-slate-800 text-xs">{purchase.total_amount?.toFixed(2)} ج.م</TableCell>
                    <TableCell className="text-center">
                      <Badge className={`text-[10px] font-bold rounded-full border-0 px-2 py-0.5 ${purchase.status === 'paid' ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-50" : "bg-orange-50 text-orange-600 hover:bg-orange-50"}`}>
                        {purchase.status === 'paid' ? "مسدد" : "آجل"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-left">
                      <div className="flex gap-1 justify-end">
                        {purchase.status === 'pending' && (
                          <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold px-2 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700" onClick={() => handlePayInvoice(purchase)}>
                            تسديد
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-[#002B5B]" onClick={() => handleOpenInvoiceDetails(purchase)}>
                          <Eye size={15} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-500" onClick={() => handleDeleteInvoice(purchase.id)}>
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Bottom Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-5 text-center">
            <p className="text-xs font-bold text-slate-400 mb-1">إجمالي الموردين</p>
            <h3 className="text-2xl font-black text-[#002B5B]">{stats.totalSuppliers.toString().padStart(2, '0')}</h3>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-5 text-center">
            <p className="text-xs font-bold text-slate-400 mb-1">المديونية الكلية</p>
            <h3 className="text-2xl font-black text-rose-600">{stats.totalDebt.toLocaleString("ar-EG", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} <span className="text-[10px] font-normal text-slate-400">ج.م</span></h3>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-5 text-center">
            <p className="text-xs font-bold text-slate-400 mb-1">طلبات نشطة</p>
            <h3 className="text-2xl font-black text-amber-500">{stats.activeOrders.toString().padStart(2, '0')}</h3>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-5 text-center">
            <p className="text-xs font-bold text-slate-400 mb-1">فواتير الشهر</p>
            <h3 className="text-2xl font-black text-emerald-500">{stats.monthInvoices}</h3>
          </CardContent>
        </Card>
      </div>

      {/* Add Supplier Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-black text-lg text-slate-800">إضافة مورد جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 text-xs font-bold text-slate-500">
            <div>
              <label className="mb-1 block">اسم الشركة / المورد *</label>
              <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="مثال: مستودع الأدوية المركزي" />
            </div>
            <div>
              <label className="mb-1 block">مسؤول التواصل</label>
              <Input value={formData.contact_person} onChange={e => setFormData({...formData, contact_person: e.target.value})} placeholder="مثال: أحمد محمد" />
            </div>
            <div>
              <label className="mb-1 block">رقم الهاتف</label>
              <Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="مثال: 0501234567" />
            </div>
            <div>
              <label className="mb-1 block">البريد الإلكتروني</label>
              <Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="مثال: contact@supplier.com" />
            </div>
            <div>
              <label className="mb-1 block">العنوان</label>
              <Input value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="مثال: الرياض، حي الملز" />
            </div>
            <div>
              <label className="mb-1 block">الرصيد الافتتاحي المستحق للمورد (ج.م)</label>
              <Input type="number" value={formData.total_debt} onChange={e => setFormData({...formData, total_debt: Number(e.target.value)})} placeholder="0.00" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="font-bold" onClick={() => setIsAddModalOpen(false)}>إلغاء</Button>
            <Button className="bg-[#002B5B] hover:bg-[#001f42] font-bold text-white" onClick={handleCreateSupplier}>إضافة المورد</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Supplier Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-black text-lg text-slate-800">تعديل بيانات المورد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 text-xs font-bold text-slate-500">
            <div>
              <label className="mb-1 block">اسم الشركة / المورد *</label>
              <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            <div>
              <label className="mb-1 block">مسؤول التواصل</label>
              <Input value={formData.contact_person} onChange={e => setFormData({...formData, contact_person: e.target.value})} />
            </div>
            <div>
              <label className="mb-1 block">رقم الهاتف</label>
              <Input value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
            </div>
            <div>
              <label className="mb-1 block">البريد الإلكتروني</label>
              <Input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            </div>
            <div>
              <label className="mb-1 block">العنوان</label>
              <Input value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
            </div>
            <div>
              <label className="mb-1 block">الرصيد المستحق للمورد (ج.م)</label>
              <Input type="number" value={formData.total_debt} onChange={e => setFormData({...formData, total_debt: Number(e.target.value)})} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="font-bold" onClick={() => setIsEditModalOpen(false)}>إلغاء</Button>
            <Button className="bg-[#002B5B] hover:bg-[#001f42] font-bold text-white" onClick={handleUpdateSupplier}>حفظ التعديلات</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transactions History Modal */}
      <Dialog open={isTransactionsModalOpen} onOpenChange={setIsTransactionsModalOpen}>
        <DialogContent dir="rtl" className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-black text-lg text-slate-800 flex items-center gap-2">
              <Receipt size={20} className="text-[#002B5B]" />
              سجل معاملات المورد: {selectedSupplier?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-right font-bold text-slate-700">رقم الفاتورة</TableHead>
                  <TableHead className="text-right font-bold text-slate-700">التاريخ</TableHead>
                  <TableHead className="text-center font-bold text-slate-700">المبلغ</TableHead>
                  <TableHead className="text-center font-bold text-slate-700">الحالة</TableHead>
                  <TableHead className="text-left font-bold text-slate-700">تفاصيل</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supplierTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-slate-400">لا توجد معاملات شراء سابقة لهذا المورد</TableCell>
                  </TableRow>
                ) : (
                  supplierTransactions.map((purchase) => (
                    <TableRow key={purchase.id}>
                      <TableCell className="font-mono font-bold text-xs text-[#002B5B]">{purchase.invoice_number || `#${purchase.id.slice(0,6).toUpperCase()}`}</TableCell>
                      <TableCell className="text-slate-600 text-xs">{new Date(purchase.created_at).toLocaleDateString("ar-EG")}</TableCell>
                      <TableCell className="text-center font-bold text-xs">{purchase.total_amount?.toFixed(2)} ج.م</TableCell>
                      <TableCell className="text-center">
                        <Badge className={`text-[10px] font-bold rounded-full border-0 px-2 py-0.5 ${purchase.status === 'paid' ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-50" : "bg-orange-50 text-orange-600 hover:bg-orange-50"}`}>
                          {purchase.status === 'paid' ? "مسدد" : "آجل"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-left">
                        <div className="flex gap-1">
                          {purchase.status === 'pending' && (
                            <Button variant="ghost" size="sm" className="h-6 text-[10px] font-bold px-2 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700" onClick={() => handlePayInvoice(purchase)}>
                              تسديد
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-[#002B5B]" onClick={() => handleOpenInvoiceDetails(purchase)}>
                            <Eye size={14} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <DialogFooter>
            <Button variant="outline" className="font-bold" onClick={() => setIsTransactionsModalOpen(false)}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Details Modal */}
      <Dialog open={isInvoiceDetailsOpen} onOpenChange={setIsInvoiceDetailsOpen}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-black text-lg text-slate-800">تفاصيل فاتورة التوريد</DialogTitle>
          </DialogHeader>
          {selectedPurchase && (
            <div className="space-y-4 py-4 text-xs">
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 font-bold">
                <div>
                  <span className="text-slate-400 block mb-1">رقم الفاتورة</span>
                  <span className="text-[#002B5B] font-mono text-sm">{selectedPurchase.invoice_number || "تلقائي"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-1">تاريخ المعاملة</span>
                  <span className="text-slate-700">{new Date(selectedPurchase.created_at).toLocaleString("ar-EG")}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-1">المورد</span>
                  <span className="text-slate-700">{selectedPurchase.suppliers?.name || selectedSupplier?.name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-1">إجمالي الفاتورة</span>
                  <span className="text-emerald-600 font-black text-sm">{selectedPurchase.total_amount?.toFixed(2)} ج.م</span>
                </div>
              </div>

              <div>
                <span className="font-bold text-slate-600 block mb-2">الأصناف الموردة:</span>
                <div className="border border-slate-100 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                  <Table>
                    <TableHeader className="bg-slate-50/50">
                      <TableRow>
                        <TableHead className="text-right font-bold text-slate-600">المنتج</TableHead>
                        <TableHead className="text-center font-bold text-slate-600">الكمية</TableHead>
                        <TableHead className="text-center font-bold text-slate-600">سعر الوحدة</TableHead>
                        <TableHead className="text-center font-bold text-slate-600">الإجمالي</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchaseItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-4 text-slate-400">جاري تحميل الأصناف...</TableCell>
                        </TableRow>
                      ) : (
                        purchaseItems.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-bold text-slate-800 text-xs">{item.products?.name}</TableCell>
                            <TableCell className="text-center font-bold text-xs">{item.quantity}</TableCell>
                            <TableCell className="text-center text-xs">{item.unit_cost?.toFixed(2)} ج.م</TableCell>
                            <TableCell className="text-center font-bold text-xs text-primary">{item.total_cost?.toFixed(2)} ج.m</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" className="font-bold" onClick={() => setIsInvoiceDetailsOpen(false)}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
