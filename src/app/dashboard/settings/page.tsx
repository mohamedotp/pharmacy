"use client";

import { useState, useEffect } from "react";
import {
  Settings, Building2, Bell, Printer, Save, X,
  CheckCircle2, AlertTriangle, Info, Database,
  ToggleLeft, ToggleRight, ChevronLeft,
  Users, ShieldCheck, Key, Edit, RefreshCw, Filter, Check, XCircle,
  Truck, Plus, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth-store";
import { usePosStore } from "@/store/pos-store";
import { UsersSection } from "@/components/settings/users-section";


type Section = "general" | "printer" | "notifications" | "users" | "backup" | "delivery_analytics" | "insurance";

const sections: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: "general", label: "إعدادات عامة", icon: Settings },
  { id: "printer", label: "الطابعة والباركود", icon: Printer },
  { id: "notifications", label: "التنبيهات", icon: Bell },
  { id: "users", label: "المستخدمين والأدوار", icon: Users },
  { id: "insurance", label: "عقود التأمين الصحي", icon: ShieldCheck },
  { id: "delivery_analytics", label: "تحليلات التوصيل", icon: Truck },
  { id: "backup", label: "النسخ الاحتياطي", icon: Database },
];

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
        checked ? "bg-[#002B5B]" : "bg-slate-200"
      }`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
          checked ? "-translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export default function SettingsPage() {
  const { user, pharmacy, fetchProfile } = useAuthStore();
  const posStore = usePosStore();

  const [activeSection, setActiveSection] = useState<Section>("general");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Insurance Contracts State
  const [contracts, setContracts] = useState<any[]>([]);
  const [loadingContracts, setLoadingContracts] = useState(false);
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [editingContractId, setEditingContractId] = useState<string | null>(null);
  const [contractForm, setContractForm] = useState({
    name: "",
    discount_percent: 0,
    patient_copay_percent: 100,
    notes: "",
    is_active: true,
  });

  // General settings
  const [pharmacyName, setPharmacyName] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [clinicNumbers, setClinicNumbers] = useState("");
  const [address, setAddress] = useState("");

  // Printer settings
  const [printerType, setPrinterType] = useState("TM-T88VI (Thermal)");
  const [paperSize, setPaperSize] = useState("80mm Standard");
  const [receiptHeader, setReceiptHeader] = useState("");
  const [receiptFooterAr, setReceiptFooterAr] = useState("شكراً لزيارتكم، نتمنى لكم دوام الصحة والعافية");
  const [receiptFooterEn, setReceiptFooterEn] = useState("Thank you for your visit, we wish you a speedy recovery");

  // Notification settings
  const [notifyExpiry, setNotifyExpiry] = useState(true);
  const [notifyLowStock, setNotifyLowStock] = useState(true);
  const [notifyDailyReport, setNotifyDailyReport] = useState(false);
  const [lowStockDays, setLowStockDays] = useState("30");

  // Delivery analytics state
  const [driversList, setDriversList] = useState<any[]>([]);
  const [deliveryStats, setDeliveryStats] = useState<any[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string>("all");
  const [loadingDrivers, setLoadingDrivers] = useState(false);
  const [settleDriver, setSettleDriver] = useState<any | null>(null);

  const fetchDeliveryAnalytics = async () => {
    setLoadingDrivers(true);
    try {
      const { data: usersData, error: usersErr } = await supabase
        .from('users')
        .select('id, full_name, is_active, role:roles(name)')
        .eq('is_active', true);
        
      if (usersErr) throw usersErr;
      
      const drivers = (usersData || []).filter((u: any) => {
        const roleArr = u.role as any;
        const roleName = Array.isArray(roleArr) ? roleArr[0]?.name : roleArr?.name;
        return roleName === 'delivery';
      });
      
      setDriversList(drivers);

      const { data: salesData, error: salesErr } = await supabase
        .from('sales')
        .select('id, invoice_number, total, payment_method, delivery_fee, created_at, delivery_id, cash_paid, visa_paid')
        .not('delivery_id', 'is', null)
        .eq('delivery_settled', false);

      if (salesErr) throw salesErr;

      const stats = drivers.map(d => {
        const dSales = (salesData || []).filter((s: any) => s.delivery_id === d.id);
        const totalDelivered = dSales.length;
        const totalFees = dSales.reduce((sum: number, s: any) => sum + Number(s.delivery_fee || 0), 0);
        const cashCollected = dSales.filter(s => s.payment_method === 'cash' || s.payment_method === 'mixed').reduce((sum: number, s: any) => {
          if (s.payment_method === 'mixed') return sum + Number(s.cash_paid || 0);
          return sum + Number(s.total || 0);
        }, 0);
        const visaCollected = dSales.filter(s => s.payment_method === 'visa' || s.payment_method === 'mixed').reduce((sum: number, s: any) => {
          if (s.payment_method === 'mixed') return sum + Number(s.visa_paid || 0);
          return sum + Number(s.total || 0);
        }, 0);

        return {
          driverId: d.id,
          driverName: d.full_name,
          totalDelivered,
          totalFees,
          cashCollected,
          visaCollected,
          sales: dSales
        };
      });

      setDeliveryStats(stats);
    } catch (err) {
      console.error("Error fetching delivery analytics:", err);
    } finally {
      setLoadingDrivers(false);
    }
  };

  useEffect(() => {
    if (activeSection === "delivery_analytics") {
      fetchDeliveryAnalytics();
    }
  }, [activeSection]);

  // Load initial data
  useEffect(() => {
    const p = pharmacy ?? user?.pharmacy;
    if (p) {
      setPharmacyName(p.name || "");
      setLicenseNumber(p.license_number || "");
      setEmail(p.email || user?.email || "");
      setPhone(p.phone || "");
      setClinicNumbers(p.clinic_numbers || "");
      setAddress(p.address || "");
      setPrinterType(p.printer_type || "TM-T88VI (Thermal)");
      setPaperSize(p.paper_size || "80mm Standard");
      setReceiptHeader(p.receipt_header || "");
      setReceiptFooterAr(p.receipt_footer_ar || "شكراً لزيارتكم، نتمنى لكم دوام الصحة والعافية");
      setReceiptFooterEn(p.receipt_footer_en || "Thank you for your visit, we wish you a speedy recovery");
      setNotifyExpiry(p.notify_expiry !== undefined ? p.notify_expiry : true);
      setNotifyLowStock(p.notify_low_stock !== undefined ? p.notify_low_stock : true);
      setNotifyDailyReport(p.notify_daily_report !== undefined ? p.notify_daily_report : false);
      setLowStockDays(p.low_stock_days !== undefined ? p.low_stock_days.toString() : "30");
    } else if (user) {
      setEmail(user.email || "");
    }
  }, [pharmacy, user]);

  const markChanged = () => { setHasChanges(true); setSaved(false); setError(null); };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const pharmacyId = pharmacy?.id ?? user?.pharmacy?.id;
      if (pharmacyId) {
        const { error: updateError } = await supabase.from("pharmacies").update({
          name: pharmacyName,
          license_number: licenseNumber,
          email: email,
          phone,
          clinic_numbers: clinicNumbers,
          address,
          printer_type: printerType,
          paper_size: paperSize,
          receipt_header: receiptHeader,
          receipt_footer_ar: receiptFooterAr,
          receipt_footer_en: receiptFooterEn,
          notify_expiry: notifyExpiry,
          notify_low_stock: notifyLowStock,
          notify_daily_report: notifyDailyReport,
          low_stock_days: parseInt(lowStockDays) || 30,
        }).eq("id", pharmacyId);
        
        if (updateError) throw updateError;
        
        await fetchProfile();
      }
      setSaved(true);
      setHasChanges(false);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "حدث خطأ أثناء حفظ التغييرات");
    } finally {
      setSaving(false);
    }
  };

  const handleTestPrint = () => {
    window.print();
  };

  const handleBackup = () => {
    const data = JSON.stringify({
      pharmacy: { name: pharmacyName, phone, address },
      settings: { notifyExpiry, notifyLowStock, lowStockDays },
      exportedAt: new Date().toISOString(),
    }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pharmacy_backup_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRestoreBackup = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (json.pharmacy) {
          if (json.pharmacy.name) setPharmacyName(json.pharmacy.name);
          if (json.pharmacy.phone) setPhone(json.pharmacy.phone);
          if (json.pharmacy.address) setAddress(json.pharmacy.address);
        }
        if (json.settings) {
          if (json.settings.notifyExpiry !== undefined) setNotifyExpiry(json.settings.notifyExpiry);
          if (json.settings.notifyLowStock !== undefined) setNotifyLowStock(json.settings.notifyLowStock);
          if (json.settings.lowStockDays !== undefined) setLowStockDays(json.settings.lowStockDays.toString());
        }
        markChanged();
        alert("تم استيراد الإعدادات من ملف النسخة الاحتياطية بنجاح! من فضلك اضغط على زر 'حفظ كافة التغييرات' في الأسفل لتأكيد الحفظ.");
      } catch (err) {
        alert("خطأ في قراءة ملف النسخة الاحتياطية. يرجى التأكد من اختيار ملف JSON صحيح وصالح.");
      }
    };
    reader.readAsText(file);
  };
  const fetchContracts = async () => {
    setLoadingContracts(true);
    try {
      const { data, error } = await supabase
        .from('insurance_contracts')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        setContracts(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingContracts(false);
    }
  };

  useEffect(() => {
    if (activeSection === "insurance") {
      fetchContracts();
    }
  }, [activeSection]);

  const handleOpenAddContract = () => {
    setContractForm({
      name: "",
      discount_percent: 0,
      patient_copay_percent: 100,
      notes: "",
      is_active: true,
    });
    setEditingContractId(null);
    setIsContractModalOpen(true);
  };

  const handleOpenEditContract = (c: any) => {
    setContractForm({
      name: c.name,
      discount_percent: Number(c.discount_percent || 0),
      patient_copay_percent: Number(c.patient_copay_percent || 0),
      notes: c.notes || "",
      is_active: c.is_active,
    });
    setEditingContractId(c.id);
    setIsContractModalOpen(true);
  };

  const handleSaveContract = async () => {
    if (!contractForm.name.trim()) {
      alert("الرجاء إدخال اسم الجهة المتعاقدة");
      return;
    }

    const pharmId = pharmacy?.id ?? user?.pharmacy?.id;
    if (!pharmId) {
      alert("لم يتم تحديد معرّف الصيدلية الخاص بك");
      return;
    }

    const payload = {
      name: contractForm.name.trim(),
      discount_percent: Number(contractForm.discount_percent),
      patient_copay_percent: Number(contractForm.patient_copay_percent),
      notes: contractForm.notes.trim() || null,
      is_active: contractForm.is_active,
      pharmacy_id: pharmId,
    };

    try {
      if (editingContractId) {
        const { error } = await supabase
          .from('insurance_contracts')
          .update(payload)
          .eq('id', editingContractId);
        if (error) throw error;
        alert("تم تعديل العقد بنجاح!");
      } else {
        const { error } = await supabase
          .from('insurance_contracts')
          .insert(payload);
        if (error) throw error;
        alert("تمت إضافة العقد بنجاح!");
      }
      setIsContractModalOpen(false);
      fetchContracts();
    } catch (err: any) {
      alert("حدث خطأ أثناء حفظ عقد التأمين: " + err.message);
    }
  };

  const handleDeleteContract = async (id: string) => {
    if (!window.confirm("هل أنت متأكد من حذف عقد التأمين هذا؟")) return;
    try {
      const { error } = await supabase
        .from('insurance_contracts')
        .delete()
        .eq('id', id);
      if (error) throw error;
      fetchContracts();
    } catch (err: any) {
      alert("حدث خطأ أثناء الحذف: " + err.message);
    }
  };

  const handleToggleContractActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('insurance_contracts')
        .update({ is_active: !currentStatus })
        .eq('id', id);
      if (error) throw error;
      fetchContracts();
    } catch (err: any) {
      alert("حدث خطأ أثناء التعديل: " + err.message);
    }
  };
  return (
    <div className="space-y-6 pb-12" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-[#002B5B]">الإعدادات الشاملة</h1>
          <p className="text-slate-400 text-xs mt-0.5">إدارة إعدادات وتفضيلات النظام</p>
        </div>
        {hasChanges && (
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold text-amber-600 flex items-center gap-1">
              <Info size={14} /> لديك تعديلات غير محفوظة
            </p>
            <Button
              onClick={() => { setHasChanges(false); setSaved(false); setError(null); }}
              variant="outline"
              className="text-xs font-bold h-9 px-4 rounded-xl"
            >
              <X size={14} className="ml-1" /> إلغاء
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="text-xs font-bold h-9 px-4 rounded-xl bg-[#002B5B] hover:bg-[#001f42] text-white gap-1"
            >
              <Save size={14} />
              {saving ? "جاري الحفظ..." : "حفظ كافة التغييرات"}
            </Button>
          </div>
        )}
        {saved && (
          <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2">
            <CheckCircle2 size={16} /> تم الحفظ بنجاح
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 text-red-600 font-bold text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-2">
            <AlertTriangle size={16} /> {error}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Nav */}
        <div className="lg:col-span-1">
          <Card className="border-0 shadow-sm bg-white rounded-2xl overflow-hidden">
            <CardContent className="p-2">
              {sections.map((s) => {
                const Icon = s.icon;
                const active = activeSection === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setActiveSection(s.id)}
                    className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-bold transition-all mb-1 ${
                      active
                        ? "bg-[#002B5B]/5 text-[#002B5B] border-r-4 border-[#002B5B]"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={18} className={active ? "text-[#002B5B]" : "text-slate-400"} />
                      {s.label}
                    </div>
                    {active && <ChevronLeft size={14} />}
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* Help Card */}
          <Card className="border-0 shadow-sm bg-[#002B5B] rounded-2xl mt-4">
            <CardContent className="p-5 text-white text-center">
              <h3 className="font-black text-sm mb-1">تحتاج مساعدة؟</h3>
              <p className="text-xs text-blue-200 mb-4">فريق الدعم الفني جاهز لمساعدتك في إعداد كل شيء</p>
              <Button 
                onClick={() => window.open("https://wa.me/201551361330?text=مرحباً،%20أحتاج%20إلى%20دعم%20فني%20لنظام%20الصيدلية", "_blank")}
                className="w-full bg-white text-[#002B5B] hover:bg-blue-50 font-bold text-xs h-9 rounded-xl"
              >
                تواصل معنا (واتساب)
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Content */}
        <div className="lg:col-span-3 space-y-4">

          {/* ===== GENERAL ===== */}
          {activeSection === "general" && (
            <>
              <Card className="border-0 shadow-sm bg-white rounded-2xl">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-9 h-9 bg-[#002B5B]/10 rounded-xl flex items-center justify-center">
                      <Building2 size={18} className="text-[#002B5B]" />
                    </div>
                    <h2 className="font-black text-slate-800">المعلومات الأساسية</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">اسم الصيدلية</label>
                      <Input
                        value={pharmacyName}
                        onChange={e => { setPharmacyName(e.target.value); markChanged(); }}
                        className="h-10 text-sm font-bold border-slate-200 rounded-xl bg-slate-50 focus-visible:ring-[#002B5B]/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">رقم الترخيص الطبي</label>
                      <Input
                        value={licenseNumber}
                        onChange={e => { setLicenseNumber(e.target.value); markChanged(); }}
                        placeholder="PHA-2023-XXXX"
                        className="h-10 text-sm font-mono border-slate-200 rounded-xl bg-slate-50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">البريد الإلكتروني للتقارير</label>
                      <Input
                        type="email"
                        value={email}
                        onChange={e => { setEmail(e.target.value); markChanged(); }}
                        className="h-10 text-sm border-slate-200 rounded-xl bg-slate-50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">رقم الهاتف</label>
                      <Input
                        value={phone}
                        onChange={e => { setPhone(e.target.value); markChanged(); }}
                        className="h-10 text-sm border-slate-200 rounded-xl bg-slate-50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">أرقام العيادة (للفاتورة)</label>
                      <Input
                        value={clinicNumbers}
                        onChange={e => { setClinicNumbers(e.target.value); markChanged(); }}
                        placeholder="مثال: 0101234567, 0111234567"
                        className="h-10 text-sm border-slate-200 rounded-xl bg-slate-50"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">العنوان</label>
                      <Input
                        value={address}
                        onChange={e => { setAddress(e.target.value); markChanged(); }}
                        className="h-10 text-sm border-slate-200 rounded-xl bg-slate-50"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm bg-emerald-50 border border-emerald-100 rounded-2xl">
                <CardContent className="p-5 flex items-center gap-3">
                  <CheckCircle2 size={20} className="text-emerald-500 shrink-0" />
                  <div>
                    <p className="text-sm font-black text-emerald-800">الضرائب (VAT) مُعطَّلة</p>
                    <p className="text-xs text-emerald-600 mt-0.5">لن يتم احتساب أي ضرائب على المبيعات — الأسعار المعروضة هي الأسعار النهائية</p>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* ===== PRINTER ===== */}
          {activeSection === "printer" && (
            <Card className="border-0 shadow-sm bg-white rounded-2xl">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-9 h-9 bg-[#002B5B]/10 rounded-xl flex items-center justify-center">
                    <Printer size={18} className="text-[#002B5B]" />
                  </div>
                  <h2 className="font-black text-slate-800">إعدادات الطابعة والباركود</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">نوع الطابعة</label>
                    <select
                      value={printerType}
                      onChange={e => { setPrinterType(e.target.value); markChanged(); }}
                      className="w-full h-10 px-3 text-sm font-bold border border-slate-200 rounded-xl bg-slate-50 text-slate-700"
                    >
                      <option>TM-T88VI (Thermal)</option>
                      <option>TM-T20III (Thermal)</option>
                      <option>Generic Thermal</option>
                      <option>طابعة A4 عادية</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">حجم الورق</label>
                    <select
                      value={paperSize}
                      onChange={e => { setPaperSize(e.target.value); markChanged(); }}
                      className="w-full h-10 px-3 text-sm font-bold border border-slate-200 rounded-xl bg-slate-50 text-slate-700"
                    >
                      <option>80mm Standard</option>
                      <option>58mm Compact</option>
                      <option>A4</option>
                    </select>
                  </div>
                </div>

                {/* Receipt Preview */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">تخصيص الفاتورة (عربي)</label>
                    <textarea
                      value={receiptFooterAr}
                      onChange={e => { setReceiptFooterAr(e.target.value); markChanged(); }}
                      rows={3}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 resize-none"
                      dir="rtl"
                    />
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 mt-3">Footer (English)</label>
                    <textarea
                      value={receiptFooterEn}
                      onChange={e => { setReceiptFooterEn(e.target.value); markChanged(); }}
                      rows={2}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 resize-none"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">معاينة الفاتورة</label>
                    <div className="bg-white border border-dashed border-slate-200 rounded-xl p-4 text-center min-h-[160px] flex flex-col items-center justify-center gap-2">
                      <div className="w-16 h-16 bg-[#002B5B] rounded-xl flex items-center justify-center text-white font-black text-2xl">
                        {pharmacyName?.charAt(0) || "ص"}
                      </div>
                      <p className="font-black text-sm text-slate-800">{pharmacyName || "اسم الصيدلية"}</p>
                      <p className="text-[10px] text-slate-400">{receiptFooterAr}</p>
                      <p className="text-[10px] text-slate-400 text-left w-full">{receiptFooterEn}</p>
                    </div>
                    <Button
                      onClick={handleTestPrint}
                      className="w-full mt-3 bg-[#002B5B] hover:bg-[#001f42] text-white font-bold text-sm h-10 rounded-xl gap-2"
                    >
                      <Printer size={16} /> اختبار الطباعة
                    </Button>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-2">
                  <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs font-bold text-amber-700">
                    طابعة حرارية متصلة — تأكد من توصيل الطابعة قبل الاختبار
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ===== NOTIFICATIONS ===== */}
          {activeSection === "notifications" && (
            <Card className="border-0 shadow-sm bg-white rounded-2xl">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-9 h-9 bg-[#002B5B]/10 rounded-xl flex items-center justify-center">
                    <Bell size={18} className="text-[#002B5B]" />
                  </div>
                  <h2 className="font-black text-slate-800">نظام التنبيهات</h2>
                </div>

                <div className="space-y-5">
                  {/* Expiry */}
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <p className="font-black text-sm text-slate-800">تنبيه انتهاء الصلاحية</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        تنبيه قبل {lowStockDays} يوم من الانتهاء
                      </p>
                    </div>
                    <Toggle checked={notifyExpiry} onChange={v => { setNotifyExpiry(v); markChanged(); }} />
                  </div>

                  {notifyExpiry && (
                    <div className="pr-4 pt-1">
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">عدد الأيام قبل الانتهاء</label>
                      <div className="flex items-center gap-3">
                        <Input
                          type="number"
                          value={lowStockDays}
                          onChange={e => { setLowStockDays(e.target.value); markChanged(); }}
                          className="w-32 h-9 text-center font-bold border-slate-200 rounded-xl"
                          min="1"
                          max="365"
                        />
                        <span className="text-xs font-bold text-slate-500">يوم</span>
                      </div>
                    </div>
                  )}

                  {/* Low Stock */}
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <p className="font-black text-sm text-slate-800">تنبيه نقص المخزون</p>
                      <p className="text-xs text-slate-500 mt-0.5">عند وصول الكمية للحد الأدنى</p>
                    </div>
                    <Toggle checked={notifyLowStock} onChange={v => { setNotifyLowStock(v); markChanged(); }} />
                  </div>

                  {/* Daily Report */}
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <p className="font-black text-sm text-slate-800">تقارير الإغلاق اليومي</p>
                      <p className="text-xs text-slate-500 mt-0.5">إرسال تلقائي عبر البريد</p>
                    </div>
                    <Toggle checked={notifyDailyReport} onChange={v => { setNotifyDailyReport(v); markChanged(); }} />
                  </div>
                </div>

                <Button
                  onClick={handleSave}
                  disabled={saving || !hasChanges}
                  className="mt-6 bg-[#002B5B] hover:bg-[#001f42] text-white font-bold text-sm h-10 rounded-xl gap-2 px-6 disabled:opacity-40"
                >
                  <Save size={15} />
                  {saving ? "جاري الحفظ..." : "حفظ إعدادات التنبيهات"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* ===== USERS ===== */}
          {activeSection === "users" && <UsersSection />}

          {/* ===== BACKUP ===== */}
          {activeSection === "backup" && (
            <Card className="border-0 shadow-sm bg-white rounded-2xl">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-9 h-9 bg-[#002B5B]/10 rounded-xl flex items-center justify-center">
                    <Database size={18} className="text-[#002B5B]" />
                  </div>
                  <h2 className="font-black text-slate-800">النسخ الاحتياطي</h2>
                </div>

                {/* Last Backup Info */}
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 mb-5 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-500">آخر نسخة احتياطية</span>
                    <span className="text-xs font-black text-slate-700">
                      {new Date().toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric" })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-500">وقت آخر نسخة</span>
                    <span className="text-xs font-black text-slate-700">
                      {new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-500">المكان</span>
                    <span className="text-xs font-black text-slate-700">Supabase Cloud</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button
                    onClick={handleBackup}
                    className="bg-[#002B5B] hover:bg-[#001f42] text-white font-bold h-12 rounded-xl gap-2"
                  >
                    <Database size={16} /> نسخ الآن
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept = ".json";
                      input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file) handleRestoreBackup(file);
                      };
                      input.click();
                    }}
                    className="border-slate-200 text-slate-700 font-bold h-12 rounded-xl gap-2 hover:bg-slate-50"
                  >
                    <Save size={16} /> استيراد نسخة احتياطية
                  </Button>
                </div>

                {/* <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-2">
                  <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-xs font-bold text-blue-700">
                    يتم حفظ بيانات الصيدلية تلقائياً على Supabase Cloud. النسخة المحلية للإعدادات فقط.
                  </p>
                </div> */}
              </CardContent>
            </Card>
          )}

          {/* ===== DELIVERY ANALYTICS ===== */}
          {activeSection === "delivery_analytics" && (
            <Card className="border-0 shadow-sm bg-white rounded-2xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                      <Truck size={18} />
                    </div>
                    <div>
                      <h2 className="font-black text-slate-800">تحليلات وتصفية حسابات مناديب التوصيل</h2>
                      <p className="text-slate-400 text-xs mt-0.5">متابعة عمولات التوصيل والمبالغ المحصلة مع المناديب</p>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={fetchDeliveryAnalytics} 
                    className="h-9 px-3 rounded-xl text-xs font-bold gap-1.5"
                    disabled={loadingDrivers}
                  >
                    <RefreshCw size={12} className={loadingDrivers ? "animate-spin" : ""} />
                    تحديث البيانات
                  </Button>
                </div>

                {loadingDrivers ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 text-right">
                        <p className="text-xs font-bold text-slate-500 mb-1">إجمالي طلبات التوصيل</p>
                        <p className="text-2xl font-black text-[#002B5B]">
                          {deliveryStats.reduce((sum, d) => sum + d.totalDelivered, 0)} <span className="text-xs font-bold text-slate-400">طلب</span>
                        </p>
                      </div>
                      <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 text-right">
                        <p className="text-xs font-bold text-slate-500 mb-1">إجمالي قيمة التوصيل المحصلة</p>
                        <p className="text-2xl font-black text-emerald-600">
                          {deliveryStats.reduce((sum, d) => sum + d.totalFees, 0).toFixed(2)} <span className="text-xs font-bold text-slate-400">ج.م</span>
                        </p>
                      </div>
                      <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4 text-right">
                        <p className="text-xs font-bold text-slate-500 mb-1">كاش بأيدي المناديب (غير مصفي)</p>
                        <p className="text-2xl font-black text-amber-600">
                          {deliveryStats.reduce((sum, d) => sum + d.cashCollected, 0).toFixed(2)} <span className="text-xs font-bold text-slate-400">ج.م</span>
                        </p>
                      </div>
                    </div>

                    {/* Drivers List */}
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm mb-3">حسابات المناديب</h3>
                      <div className="border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-100">
                        {deliveryStats.length === 0 ? (
                          <div className="p-8 text-center text-slate-400 text-xs font-bold bg-slate-50/30">
                            لا يوجد مناديب توصيل مسجلين في النظام حالياً
                          </div>
                        ) : (
                          deliveryStats.map(d => (
                            <div key={d.driverId} className="p-4 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-[#002B5B] font-black text-base">
                                  {d.driverName.charAt(0)}
                                </div>
                                <div>
                                  <h4 className="font-bold text-sm text-slate-800">{d.driverName}</h4>
                                  <p className="text-xs text-slate-400 font-medium">عدد الأوردرات: {d.totalDelivered}</p>
                                </div>
                              </div>

                              <div className="grid grid-cols-3 gap-6 text-right md:min-w-[300px]">
                                <div>
                                  <p className="text-[10px] font-bold text-slate-400 mb-0.5">رسوم التوصيل</p>
                                  <p className="text-sm font-black text-slate-700">{d.totalFees.toFixed(1)} ج.م</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold text-slate-400 mb-0.5">كاش محصل</p>
                                  <p className="text-sm font-black text-amber-600">{d.cashCollected.toFixed(1)} ج.م</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold text-slate-400 mb-0.5">فيزا محصلة</p>
                                  <p className="text-sm font-black text-indigo-600">{d.visaCollected.toFixed(1)} ج.م</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <Button 
                                  size="sm" 
                                  variant="outline" 
                                  className="h-8 rounded-lg text-xs font-bold border-indigo-100 text-indigo-600 hover:bg-indigo-50"
                                  onClick={() => setSelectedDriverId(d.driverId)}
                                >
                                  عرض التفاصيل
                                </Button>
                                {d.cashCollected > 0 && (
                                  <Button 
                                    size="sm" 
                                    className="h-8 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                                    onClick={() => {
                                      setSettleDriver(d);
                                    }}
                                  >
                                    تصفية النقدية
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Detailed Invoice History for Selected Driver */}
                    {selectedDriverId !== "all" && (
                      <div className="border-t border-slate-100 pt-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-bold text-slate-800 text-sm">
                            تفاصيل تسليمات: {deliveryStats.find(d => d.driverId === selectedDriverId)?.driverName}
                          </h3>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setSelectedDriverId("all")} 
                            className="text-xs font-bold text-slate-400 hover:text-slate-600"
                          >
                            إغلاق التفاصيل ×
                          </Button>
                        </div>
                        <div className="border border-slate-100 rounded-2xl overflow-hidden text-right">
                          <table className="w-full text-right text-xs">
                            <thead className="bg-slate-50 border-b border-slate-100 font-bold text-slate-500 text-right">
                              <tr>
                                <th className="p-3 text-right">رقم الفاتورة</th>
                                <th className="p-3 text-right">التاريخ</th>
                                <th className="p-3 text-right">إجمالي الفاتورة</th>
                                <th className="p-3 text-right">رسوم التوصيل</th>
                                <th className="p-3 text-right">طريقة الدفع</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {(deliveryStats.find(d => d.driverId === selectedDriverId)?.sales || []).length === 0 ? (
                                <tr>
                                  <td colSpan={5} className="p-8 text-center text-slate-400 font-bold">
                                    لا توجد أوردرات مسجلة لهذا المندوب
                                  </td>
                                </tr>
                              ) : (
                                (deliveryStats.find(d => d.driverId === selectedDriverId)?.sales || []).map((s: any) => (
                                  <tr key={s.id} className="hover:bg-slate-50/50">
                                    <td className="p-3 font-mono font-bold text-slate-800">{s.invoice_number}</td>
                                    <td className="p-3 text-slate-500">
                                      {new Date(s.created_at).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })}
                                    </td>
                                    <td className="p-3 font-bold text-slate-700">{s.total.toFixed(2)} ج.م</td>
                                    <td className="p-3 font-bold text-emerald-600">+{s.delivery_fee.toFixed(2)} ج.م</td>
                                    <td className="p-3">
                                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                        s.payment_method === 'cash' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                                      }`}>
                                        {s.payment_method === 'cash' ? 'كاش' : s.payment_method === 'visa' ? 'فيزا' : s.payment_method}
                                      </span>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          {/* ===== INSURANCE ===== */}
          {activeSection === "insurance" && (
            <Card className="border-0 shadow-sm bg-white rounded-2xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 bg-teal-50 rounded-xl flex items-center justify-center text-teal-600">
                      <ShieldCheck size={18} />
                    </div>
                    <div>
                      <h2 className="font-black text-slate-800">عقود التأمين الصحي والجهات المتعاقدة</h2>
                      <p className="text-slate-400 text-xs mt-0.5">إدارة الجهات المتعاقدة، ونسب الخصومات، وتحمل المرضى</p>
                    </div>
                  </div>
                  <Button 
                    onClick={handleOpenAddContract} 
                    className="h-9 px-4 rounded-xl text-xs font-bold gap-1 bg-[#002B5B] hover:bg-[#001f42] text-white"
                  >
                    <Plus size={14} className="ml-1" />
                    إضافة جهة تعاقد
                  </Button>
                </div>

                {loadingContracts ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="border border-slate-100 rounded-2xl overflow-hidden text-right">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-50 border-b border-slate-100 font-bold text-slate-500 text-right">
                          <tr>
                            <th className="p-4 text-right">الجهة المتعاقدة / الشركة</th>
                            <th className="p-4 text-center">خصم شركة التأمين</th>
                            <th className="p-4 text-center">نسبة تحمل المريض</th>
                            <th className="p-4 text-right">ملاحظات</th>
                            <th className="p-4 text-center">الحالة</th>
                            <th className="p-4 text-left">الإجراءات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {contracts.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="p-8 text-center text-slate-400 font-bold bg-slate-50/30">
                                لا توجد عقود تأمين مسجلة حالياً. قم بإضافة أول عقد لبدء التشغيل.
                              </td>
                            </tr>
                          ) : (
                            contracts.map((c) => (
                              <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-4 font-bold text-slate-800 text-sm">{c.name}</td>
                                <td className="p-4 text-center font-extrabold text-teal-600 text-sm">{c.discount_percent}%</td>
                                <td className="p-4 text-center font-extrabold text-blue-600 text-sm">{c.patient_copay_percent}%</td>
                                <td className="p-4 text-right text-slate-500 font-medium max-w-[200px] truncate">{c.notes || '-'}</td>
                                <td className="p-4 text-center">
                                  <button
                                    onClick={() => handleToggleContractActive(c.id, c.is_active)}
                                    className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-all ${
                                      c.is_active 
                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100/50' 
                                        : 'bg-red-50 text-red-500 border-red-100 hover:bg-red-100/50'
                                    }`}
                                  >
                                    {c.is_active ? 'نشط' : 'معطل'}
                                  </button>
                                </td>
                                <td className="p-4 text-left flex justify-end gap-2">
                                  <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="w-7 h-7 text-slate-400 hover:text-blue-600 rounded-md"
                                    onClick={() => handleOpenEditContract(c)}
                                  >
                                    <Edit size={14} />
                                  </Button>
                                  <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="w-7 h-7 text-slate-400 hover:text-red-500 rounded-md"
                                    onClick={() => handleDeleteContract(c.id)}
                                  >
                                    <Trash2 size={14} />
                                  </Button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

        </div>
      </div>

      {/* Settle Driver Cash Modal Overlay */}
      {settleDriver && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[99] flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl p-6 border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-2">
              <CheckCircle2 className="text-emerald-500" />
              تصفية نقدية: {settleDriver.driverName}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-4 text-right">
              سيتم تسجيل استلام النقدية المحصلة من المندوب وإفراغ ذمته المالية لطلبات الكاش الحالية.
            </p>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2 mb-5">
              <div className="flex justify-between text-xs font-bold text-slate-500">
                <span>المبلغ الكاش المطالب به:</span>
                <span className="text-slate-800 font-black">{settleDriver.cashCollected.toFixed(2)} ج.م</span>
              </div>
              <div className="flex justify-between text-xs font-bold text-slate-500">
                <span>إجمالي عمولات التوصيل:</span>
                <span className="text-indigo-600 font-black">{settleDriver.totalFees.toFixed(2)} ج.م</span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1 rounded-xl h-10 text-xs font-bold" 
                onClick={() => setSettleDriver(null)}
              >
                إلغاء
              </Button>
              <Button 
                className="flex-1 rounded-xl h-10 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white" 
                onClick={async () => {
                  try {
                    const salesToUpdate = settleDriver.sales.map((s: any) => s.id);
                    if (salesToUpdate.length > 0) {
                      const { error } = await supabase
                        .from('sales')
                        .update({ delivery_settled: true })
                        .in('id', salesToUpdate);
                      if (error) throw error;
                    }

                    alert(`تم تسوية الحساب بنجاح! تم استلام مبلغ ${settleDriver.cashCollected.toFixed(2)} ج.م نقداً من المندوب.`);
                    setSettleDriver(null);
                    fetchDeliveryAnalytics();
                  } catch (err: any) {
                    alert("خطأ أثناء تصفية الحساب: " + err.message);
                  }
                }}
              >
                تأكيد التسوية
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Contract Modal Overlay */}
      {isContractModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[99] flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl p-6 border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 mb-4">
              <ShieldCheck className="text-teal-600" />
              {editingContractId ? "تعديل جهة التعاقد" : "إضافة جهة تعاقد جديدة"}
            </h3>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">اسم الجهة المتعاقدة / الشركة *</label>
                <Input
                  value={contractForm.name}
                  onChange={e => setContractForm({ ...contractForm, name: e.target.value })}
                  placeholder="مثال: شركة الأهلي للخدمات الطبية"
                  className="h-10 text-sm font-bold border-slate-200 rounded-xl bg-slate-50 focus-visible:ring-[#002B5B]/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">نسبة خصم التعاقد (%)</label>
                  <Input
                    type="number"
                    value={contractForm.discount_percent}
                    onChange={e => setContractForm({ ...contractForm, discount_percent: Number(e.target.value) })}
                    placeholder="0"
                    min="0"
                    max="100"
                    className="h-10 text-sm font-bold border-slate-200 rounded-xl bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">نسبة تحمل المريض (%)</label>
                  <Input
                    type="number"
                    value={contractForm.patient_copay_percent}
                    onChange={e => setContractForm({ ...contractForm, patient_copay_percent: Number(e.target.value) })}
                    placeholder="100"
                    min="0"
                    max="100"
                    className="h-10 text-sm font-bold border-slate-200 rounded-xl bg-slate-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">ملاحظات / شروط التعاقد</label>
                <textarea
                  value={contractForm.notes}
                  onChange={e => setContractForm({ ...contractForm, notes: e.target.value })}
                  placeholder="أكتب أي شروط أو تفاصيل إضافية هنا..."
                  rows={3}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 resize-none font-bold text-slate-600 focus:outline-none focus:border-[#002B5B]"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <p className="font-bold text-xs text-slate-800">حالة العقد</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">تنشيط أو تعطيل هذا العقد في نظام الـ POS</p>
                </div>
                <Toggle 
                  checked={contractForm.is_active} 
                  onChange={v => setContractForm({ ...contractForm, is_active: v })} 
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1 rounded-xl h-10 text-xs font-bold" 
                onClick={() => setIsContractModalOpen(false)}
              >
                إلغاء
              </Button>
              <Button 
                className="flex-1 rounded-xl h-10 text-xs font-bold bg-[#002B5B] hover:bg-[#001f42] text-white" 
                onClick={handleSaveContract}
              >
                حفظ العقد
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Footer save bar */}
      <div className="fixed bottom-0 left-0 md:right-64 right-0 bg-white border-t border-slate-200 px-8 py-4 flex items-center justify-between z-40 shadow-lg no-print">
        <p className="text-xs font-bold text-slate-400 flex items-center gap-2">
          <Info size={14} />
          {error ? (
            <span className="text-red-600">فشل الحفظ: {error}</span>
          ) : hasChanges ? (
            <span className="text-amber-600">لديك تعديلات غير محفوظة</span>
          ) : saved ? (
            <span className="text-emerald-600">تم حفظ كافة التغييرات ✓</span>
          ) : "جميع الإعدادات محفوظة"}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => { setHasChanges(false); setSaved(false); setError(null); }}
            className="text-xs font-bold h-9 px-5 rounded-xl border-slate-200"
          >
            إلغاء
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="text-xs font-bold h-9 px-5 rounded-xl bg-[#002B5B] hover:bg-[#001f42] text-white gap-1 disabled:opacity-40"
          >
            <Save size={14} />
            {saving ? "جاري الحفظ..." : "حفظ كافة التغييرات"}
          </Button>
        </div>
      </div>
      <div className="h-16" />
    </div>
  );
}
