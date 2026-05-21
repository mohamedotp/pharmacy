"use client";

import React, { useState, useEffect, Suspense } from "react";
import { Search, UserPlus, Phone, MessageCircle, Edit, Trash2, FileText, ShoppingBag, Award, HeartPulse, User, AlertTriangle, CheckCircle2, Clock, ChevronRight, ReceiptText, Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth-store";
import Link from "next/link";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";

type Patient = {
  id: string;
  name: string;
  phone: string;
  medical_history: string;
  file_number: string;
  gender: string;
  age: number;
  blood_type: string;
  status: string;
  points: number;
  total_purchases: number;
  balance: number;
  created_at: string;
  updated_at?: string;
  next_refill_date?: string | null;
  refill_notes?: string | null;
};

function PatientDetailTabs({ selectedPatient, patientSales, isSalesLoading, urgentRequests, onEdit, onUrgent, onCompleteUrgent, onViewSaleDetail, onRefillEdit, onCompleteRefill, openWhatsAppModal, onPayDebt }: {
  selectedPatient: Patient; patientSales: any[]; isSalesLoading: boolean; urgentRequests: any[];
  onEdit: () => void; onUrgent: () => void; onCompleteUrgent: (id: string) => void; onViewSaleDetail: (sale: any) => void;
  onRefillEdit: () => void; onCompleteRefill: () => void; openWhatsAppModal: (patient: Patient) => void;
  onPayDebt: () => void;
}) {
  const [activeTab, setTab] = useState<'profile' | 'invoices'>('profile');
  return (
    <div className="flex flex-col h-full min-h-0 gap-3">
      {/* Tab Bar */}
      <div className="grid grid-cols-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden shrink-0">
        <button onClick={() => setTab('profile')} className={`py-2.5 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'profile' ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
          <User size={14} /> الملف الشخصي
        </button>
        <button onClick={() => setTab('invoices')} className={`py-2.5 text-sm font-bold flex items-center justify-center gap-2 transition-colors relative ${activeTab === 'invoices' ? 'bg-primary text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
          <ReceiptText size={14} /> الفواتير
          {patientSales.length > 0 && <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${activeTab === 'invoices' ? 'bg-white/25 text-white' : 'bg-primary/10 text-primary'}`}>{patientSales.length}</span>}
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-3 min-h-0">
        {activeTab === 'profile' ? (
          <>
            <Card className="border border-slate-100 shadow-sm shrink-0">
              <CardContent className="p-5">
                <div className="flex items-center gap-4 mb-4">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black shrink-0 shadow-md border-4 border-white ${selectedPatient.gender === 'ذكر' ? 'bg-gradient-to-br from-blue-400 to-blue-600 text-white' : 'bg-gradient-to-br from-pink-400 to-pink-600 text-white'}`}>
                    {selectedPatient.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-bold text-slate-800 truncate">{selectedPatient.name}</h2>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <span>{selectedPatient.gender}</span> • <span>{selectedPatient.age} عام</span> • <span className="text-rose-500 flex items-center gap-1"><HeartPulse size={10}/> {selectedPatient.blood_type}</span>
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1 font-mono">{selectedPatient.file_number}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" className="w-full text-xs" onClick={onEdit}><Edit size={12} className="ml-1.5" /> تعديل</Button>
                  <Button size="sm" className="w-full bg-red-600 hover:bg-red-700 text-xs" onClick={onUrgent}><AlertTriangle size={12} className="ml-1.5" /> طلب عاجل</Button>
                </div>
              </CardContent>
            </Card>
            
            {/* Balance / Debt Card */}
            <Card className={`border shadow-sm shrink-0 overflow-hidden ${Number(selectedPatient.balance || 0) > 0 ? 'border-rose-200 bg-rose-50/20' : 'border-slate-100'}`}>
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-xs text-slate-500 flex items-center gap-1.5 mb-1">
                    <ReceiptText size={14} className="text-rose-500" /> حساب الآجل
                  </h3>
                  <p className="text-lg font-black text-slate-800">
                    {Number(selectedPatient.balance || 0).toFixed(2)} <span className="text-xs font-bold text-slate-500">ج.م</span>
                  </p>
                </div>
                {Number(selectedPatient.balance || 0) > 0 && (
                  <Button 
                    size="sm" 
                    className="bg-emerald-600 hover:bg-emerald-700 text-xs font-bold rounded-xl text-white px-4 h-9"
                    onClick={onPayDebt}
                  >
                    تسديد مديونية
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card className="border border-slate-100 shadow-sm shrink-0 bg-gradient-to-l from-[#002B5B] to-blue-900 text-white overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold flex items-center gap-2 text-sm"><Award size={14} className="text-amber-400" /> برنامج الولاء</h3>
                  <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full">VIP</span>
                </div>
                <div className="flex justify-between text-xs mb-1.5"><span className="text-blue-200">النقاط</span><span className="font-bold">{selectedPatient.points} نقطة</span></div>
                <div className="h-1.5 bg-black/20 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-l from-amber-300 to-amber-500 w-[65%] rounded-full"></div></div>
                <div className="mt-3 text-xs flex justify-between"><span className="text-blue-200">إجمالي المشتريات</span><span className="font-bold">{selectedPatient.total_purchases} ج.م</span></div>
              </CardContent>
            </Card>

            {/* Refill Alarm Card */}
            <Card className="border border-slate-100 shadow-sm shrink-0 overflow-hidden">
              <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h3 className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                  <Clock size={13} className="text-[#002B5B]" />
                  تنبيه صرف الدواء المزمن (Refill Alarm)
                </h3>
                <button
                  onClick={onRefillEdit}
                  className="text-[10px] font-black text-[#002B5B] hover:underline"
                >
                  {selectedPatient.next_refill_date ? 'تعديل التنبيه' : 'ضبط التنبيه'}
                </button>
              </div>
              <div className="p-4">
                {selectedPatient.next_refill_date ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 font-bold">تاريخ الصرف القادم:</span>
                      <span className="text-xs font-black text-slate-800 font-mono">
                        {new Date(selectedPatient.next_refill_date).toLocaleDateString('ar-EG', {
                          year: 'numeric', month: 'long', day: 'numeric'
                        })}
                      </span>
                    </div>

                    {/* Status Badge */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 font-bold">حالة الصرف:</span>
                      {(() => {
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const refillDate = new Date(selectedPatient.next_refill_date);
                        refillDate.setHours(0, 0, 0, 0);
                        const diffTime = refillDate.getTime() - today.getTime();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                        if (diffDays < 0) {
                          return (
                            <Badge className="bg-rose-500 text-white hover:bg-rose-600 font-black text-[10px] animate-pulse">
                              متأخر منذ {-diffDays} يوم
                            </Badge>
                          );
                        } else if (diffDays === 0) {
                          return (
                            <Badge className="bg-amber-500 text-white hover:bg-amber-600 font-black text-[10px]">
                              اليوم!
                            </Badge>
                          );
                        } else {
                          return (
                            <Badge className="bg-teal-500 text-white hover:bg-teal-600 font-black text-[10px]">
                              متبقي {diffDays} يوم
                            </Badge>
                          );
                        }
                      })()}
                    </div>

                    {/* Refill Notes */}
                    {selectedPatient.refill_notes && (
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs">
                        <p className="font-bold text-slate-500 mb-1">الأدوية المجدولة:</p>
                        <p className="text-slate-700 font-medium whitespace-pre-wrap">{selectedPatient.refill_notes}</p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-[11px] font-bold border-green-200 text-green-700 bg-green-50 hover:bg-green-100 h-9 rounded-xl"
                        onClick={() => openWhatsAppModal(selectedPatient)}
                      >
                        <MessageCircle size={12} className="ml-1" />
                        تذكير واتساب
                      </Button>
                      <Button
                        size="sm"
                        className="w-full bg-[#002B5B] hover:bg-[#001f42] text-[11px] font-bold text-white h-9 rounded-xl"
                        onClick={onCompleteRefill}
                      >
                        <CheckCircle2 size={12} className="ml-1" />
                        تم الصرف وتجديد
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-3 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                    <Clock size={24} className="mx-auto text-slate-400 mb-1.5" />
                    <p className="text-[11px] text-slate-400 mb-2 font-bold">لا يوجد تنبيه صرف مفعّل لهذا المريض</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs font-bold h-8 px-4 rounded-lg"
                      onClick={onRefillEdit}
                    >
                      تفعيل تنبيه الصرف
                    </Button>
                  </div>
                )}
              </div>
            </Card>

            <Card className={`border shadow-sm shrink-0 overflow-hidden ${urgentRequests.filter((r: any) => r.status === 'pending').length > 0 ? 'border-red-200 bg-red-50/30' : 'border-slate-100'}`}>
              <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h3 className="font-bold text-slate-700 text-xs flex items-center gap-1.5"><AlertTriangle size={13} className={urgentRequests.filter((r: any) => r.status === 'pending').length > 0 ? 'text-red-500' : 'text-slate-400'} /> الطلبات العاجلة</h3>
                <Link href="/dashboard/urgent-requests" className="text-[10px] font-bold text-red-600 hover:underline">الكل ›</Link>
              </div>
              <div className="divide-y divide-slate-100 max-h-32 overflow-y-auto">
                {urgentRequests.length === 0 ? <div className="p-3 text-center text-slate-400 text-[10px]">لا توجد طلبات عاجلة</div> :
                  urgentRequests.map((req: any) => (
                    <div key={req.id} className="px-3 py-2 flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0"><p className="text-xs font-bold text-slate-700 truncate">{req.title}</p></div>
                      {req.status === 'pending' ? <button onClick={() => onCompleteUrgent(req.id)} className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 hover:bg-emerald-100">✓ تم</button>
                        : <span className="text-[10px] text-emerald-500">✓ مكتمل</span>}
                    </div>
                  ))}
              </div>
            </Card>
            {selectedPatient.medical_history && (
              <Card className="border border-slate-100 shadow-sm shrink-0 overflow-hidden">
                <div className="p-3 border-b border-slate-100 bg-slate-50"><h3 className="font-bold text-slate-700 text-xs flex items-center gap-1.5"><FileText size={13} className="text-primary" /> السجل الطبي</h3></div>
                <div className="p-3"><p className="text-xs text-slate-600 whitespace-pre-wrap">{selectedPatient.medical_history}</p></div>
              </Card>
            )}
          </>
        ) : (
          /* Invoices Tab */
          <Card className="border border-slate-100 shadow-sm overflow-hidden flex flex-col flex-1">
            <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
              <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2"><ReceiptText size={15} className="text-primary" /> الفواتير السابقة</h3>
              <span className="text-xs text-slate-400 font-bold">{isSalesLoading ? '...' : `${patientSales.length} فاتورة`}</span>
            </div>
            <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
              {isSalesLoading ? (
                <div className="flex justify-center p-8"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div></div>
              ) : patientSales.length === 0 ? (
                <div className="p-8 text-center text-slate-400 flex flex-col items-center">
                  <ReceiptText size={40} className="opacity-20 mb-3" />
                  <p className="text-sm font-medium">لا توجد فواتير سابقة</p>
                  <p className="text-[10px] mt-1 text-slate-300">ستظهر هنا بعد إتمام بيع مرتبط بهذا المريض</p>
                </div>
              ) : patientSales.map((sale: any) => (
                <div key={sale.id} className="p-3.5 flex items-start gap-3 hover:bg-slate-50 transition-colors">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5"><ReceiptText size={16} className="text-primary" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-bold text-slate-800 font-mono">{sale.invoice_number}</p>
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{sale.payment_method === 'cash' ? 'كاش' : sale.payment_method === 'visa' ? 'فيزا' : sale.payment_method}</Badge>
                    </div>
                    <p className="text-xs text-slate-500 mb-1 truncate">{sale.sale_items?.map((i: any) => `${i.quantity}× ${i.products?.name}`).join('، ')}</p>
                    <p className="text-[10px] text-slate-400"><Clock size={9} className="inline ml-1" />{new Date(sale.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  </div>
                  <div className="shrink-0 text-left flex flex-col items-end gap-1.5">
                    <p className="text-base font-black text-slate-800">{sale.total}<span className="text-[10px] font-normal"> ج.م</span></p>
                    <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs rounded-full hover:text-primary hover:border-primary/30" onClick={() => onViewSaleDetail(sale)}>
                      <Eye size={12} className="ml-1" /> تفاصيل
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function normalizeArabic(text: string): string {
  if (!text) return "";
  return text
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .toLowerCase()
    .trim();
}

const initialPatient = {
  name: "",
  phone: "",
  medical_history: "",
  file_number: "",
  gender: "ذكر",
  age: 30,
  blood_type: "O+",
  status: "عضو جديد",
  points: 0,
  total_purchases: 0,
  next_refill_date: "",
  refill_notes: "",
};

function PatientsContent() {
  const { user } = useAuthStore();
  const searchParams = useSearchParams();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("الكل");
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>(initialPatient);

  // Urgent Requests State
  const [urgentRequests, setUrgentRequests] = useState<any[]>([]);
  const [isUrgentModalOpen, setIsUrgentModalOpen] = useState(false);
  const [urgentDrug, setUrgentDrug] = useState("");
  const [urgentNotes, setUrgentNotes] = useState("");
  const [urgentLoading, setUrgentLoading] = useState(false);

  // WhatsApp Quick Message State
  const [isWaModalOpen, setIsWaModalOpen] = useState(false);
  const [waMessage, setWaMessage] = useState("");

  // Patient Sales State
  const [patientSales, setPatientSales] = useState<any[]>([]);
  const [isSalesLoading, setIsSalesLoading] = useState(false);
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<any | null>(null);
  const [isSaleDetailModalOpen, setIsSaleDetailModalOpen] = useState(false);

  // Refill Alarm Modal State
  const [isRefillModalOpen, setIsRefillModalOpen] = useState(false);
  const [refillDate, setRefillDate] = useState("");
  const [refillNotes, setRefillNotes] = useState("");
  const [refillLoading, setRefillLoading] = useState(false);

  // Pay Debt Modal State
  const [isPayDebtModalOpen, setIsPayDebtModalOpen] = useState(false);
  const [debtPaymentAmount, setDebtPaymentAmount] = useState<number>(0);
  const [debtPaymentMethod, setDebtPaymentMethod] = useState<string>("cash");
  const [debtPaymentLoading, setDebtPaymentLoading] = useState(false);

  const handleConfirmPayDebt = async () => {
    if (!selectedPatient || !debtPaymentAmount || debtPaymentAmount <= 0) return;
    setDebtPaymentLoading(true);

    try {
      const currentBalance = Number(selectedPatient.balance || 0);
      const newBalance = Math.max(0, currentBalance - debtPaymentAmount);

      // 1. Update patient balance
      const { error: patientErr } = await supabase
        .from("patients")
        .update({ balance: newBalance })
        .eq("id", selectedPatient.id);

      if (patientErr) throw patientErr;

      // 2. Insert invoice of type payment to record cash/visa inflow in system
      const invoiceNumber = `REC-${Date.now().toString().slice(-8)}`;
      const { error: saleErr } = await supabase
        .from("sales")
        .insert({
          invoice_number: invoiceNumber,
          pharmacy_id: user?.pharmacy_id,
          subtotal: 0,
          discount: 0,
          tax: 0,
          delivery_fee: 0,
          total: debtPaymentAmount,
          payment_method: debtPaymentMethod,
          cash_paid: debtPaymentMethod === 'cash' ? debtPaymentAmount : 0,
          visa_paid: debtPaymentMethod === 'visa' ? debtPaymentAmount : 0,
          patient_id: selectedPatient.id,
          patient_name: selectedPatient.name,
          notes: `سداد مديونية آجل بقيمة ${debtPaymentAmount} ج.م`
        });

      if (saleErr) throw saleErr;

      toast.success("تم تسجيل عملية السداد بنجاح!");
      setIsPayDebtModalOpen(false);
      setDebtPaymentAmount(0);

      // Refresh data
      await fetchPatients();
      setSelectedPatient({
        ...selectedPatient,
        balance: newBalance
      });
    } catch (err: any) {
      toast.error("خطأ أثناء تسجيل السداد: " + err.message);
    } finally {
      setDebtPaymentLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, [user]);

  useEffect(() => {
    if (selectedPatient) {
      fetchPatientUrgentRequests(selectedPatient.id);
      fetchPatientSales(selectedPatient.id);
    }
  }, [selectedPatient]);

  const targetId = searchParams.get("id");

  useEffect(() => {
    if (targetId && patients.length > 0) {
      const matched = patients.find(p => p.id === targetId);
      if (matched) {
        setSelectedPatient(matched);
      }
    }
  }, [targetId, patients]);

  const fetchPatientSales = async (patientId: string) => {
    setIsSalesLoading(true);
    const { data, error } = await supabase
      .from('sales')
      .select('id, invoice_number, total, payment_method, created_at, discount, sale_items(id, quantity, unit_price, total_price, products(name))')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });
    console.log('[PatientSales] patientId:', patientId, '| count:', data?.length, '| error:', error?.message);
    setPatientSales(data || []);
    setIsSalesLoading(false);
  };

  const fetchPatientUrgentRequests = async (patientId: string) => {
    const { data } = await supabase
      .from('urgent_requests')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(5);
    setUrgentRequests(data || []);
  };

  const handleSendUrgentRequest = async () => {
    if (!urgentDrug.trim() || !selectedPatient) return;
    setUrgentLoading(true);
    const { error } = await supabase.from('urgent_requests').insert({
      type: 'missing_drug',
      title: urgentDrug,
      priority: 'critical',
      status: 'pending',
      patient_id: selectedPatient.id,
      patient_name: selectedPatient.name,
      metadata: { patient: selectedPatient.name, notes: urgentNotes },
    });
    setUrgentLoading(false);
    if (!error) {
      setUrgentDrug("");
      setUrgentNotes("");
      setIsUrgentModalOpen(false);
      fetchPatientUrgentRequests(selectedPatient.id);
    } else {
      alert("خطأ في إرسال الطلب: " + error.message);
    }
  };

  const handleCompleteUrgentRequest = async (id: string) => {
    await supabase.from('urgent_requests').update({ status: 'completed' }).eq('id', id);
    if (selectedPatient) fetchPatientUrgentRequests(selectedPatient.id);
  };

  const handleOpenRefillModal = (patient: Patient) => {
    setRefillDate(patient.next_refill_date || "");
    setRefillNotes(patient.refill_notes || "");
    setIsRefillModalOpen(true);
  };

  const handleSaveRefill = async () => {
    if (!selectedPatient) return;
    setRefillLoading(true);
    const { error } = await supabase
      .from('patients')
      .update({
        next_refill_date: refillDate || null,
        refill_notes: refillNotes || null
      })
      .eq('id', selectedPatient.id);
    
    setRefillLoading(false);
    if (!error) {
      toast.success("تم تحديث تنبيه صرف الدواء بنجاح");
      setIsRefillModalOpen(false);
      fetchPatients();
      setSelectedPatient({
        ...selectedPatient,
        next_refill_date: refillDate || undefined,
        refill_notes: refillNotes || undefined
      });
    } else {
      toast.error("خطأ أثناء حفظ التنبيه: " + error.message);
    }
  };

  const handleQuickCompleteRefill = async (patient: Patient) => {
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + 30);
    const yyyy = nextDate.getFullYear();
    const mm = String(nextDate.getMonth() + 1).padStart(2, '0');
    const dd = String(nextDate.getDate()).padStart(2, '0');
    const formattedDate = `${yyyy}-${mm}-${dd}`;

    const { error } = await supabase
      .from('patients')
      .update({
        next_refill_date: formattedDate
      })
      .eq('id', patient.id);

    if (!error) {
      toast.success("تم تسجيل الصرف وتجديد الموعد التلقائي بعد 30 يوم!");
      fetchPatients();
      setSelectedPatient({
        ...patient,
        next_refill_date: formattedDate
      });
    } else {
      toast.error("خطأ أثناء تسجيل الصرف: " + error.message);
    }
  };

  const openWhatsAppModal = (patient: Patient | null) => {
    if (!patient) {
      toast.error("يرجى تحديد مريض أولاً");
      return;
    }
    if (!patient.phone) {
      toast.error(`لا يوجد رقم هاتف مسجل للمريض ${patient.name}`);
      return;
    }
    // Set default reminder message
    if (patient.next_refill_date) {
      setWaMessage(`السلام عليكم أ. ${patient.name}،
 
نود تذكيركم بموعد صرف علاجكم المزمن${patient.refill_notes ? ` (${patient.refill_notes})` : ''} القادم والمستحق بتاريخ ${new Date(patient.next_refill_date).toLocaleDateString('ar-EG')}.
 
نتمنى لكم وافر الصحة والعافية ❤️
صيدلية الشفاء`);
      setIsWaModalOpen(true);
      return;
    }
    setWaMessage(`السلام عليكم أ. ${patient.name}،

هذا تذكير من صيدلية الشفاء بأن دواءك أصبح جاهزاً للاستلام ، نرجو التواصل معنا في أقرب وقت.

شكراً لثقتكم بنا ❤️`);
    setIsWaModalOpen(true);
  };

  const sendWhatsApp = () => {
    if (!selectedPatient?.phone) return;
    let phone = selectedPatient.phone.replace(/\s|-/g, "");
    if (phone.startsWith("0")) phone = "20" + phone.slice(1);
    else if (!phone.startsWith("20")) phone = "20" + phone;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(waMessage)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setIsWaModalOpen(false);
  };

  const fetchPatients = async () => {
    setLoading(true);
    let query = supabase.from('patients').select('*').order('created_at', { ascending: false });
    
    // RLS will handle pharmacy isolation if pharmacy_id is used, but assuming users see all or we use auth context
    if (user?.pharmacy_id) {
      query = query.eq('pharmacy_id', user.pharmacy_id);
    }
    
    const { data, error } = await query;
    if (!error && data) {
      setPatients(data);
      if (data.length > 0) {
        const targetId = searchParams.get("id");
        const matched = targetId ? data.find(p => p.id === targetId) : null;
        setSelectedPatient(matched || data[0]);
      }
    }
    setLoading(false);
  };

  const handleOpenAdd = () => {
    setFormData({
      ...initialPatient,
      file_number: `#${Math.floor(100000 + Math.random() * 900000)}`
    });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (patient: Patient) => {
    setFormData(patient);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("هل أنت متأكد من حذف هذا المريض؟")) return;
    
    const { error } = await supabase.from('patients').delete().eq('id', id);
    if (error) {
      alert("خطأ أثناء الحذف: " + error.message);
    } else {
      const newPatients = patients.filter(p => p.id !== id);
      setPatients(newPatients);
      if (selectedPatient?.id === id) {
        setSelectedPatient(newPatients[0] || null);
      }
    }
  };

  const handleSave = async () => {
    if (!formData.name) return alert("يرجى إدخال اسم المريض");

    const payload = {
      ...formData,
      pharmacy_id: user?.pharmacy_id,
    };

    if (isEditing) {
      const { data, error } = await supabase
        .from('patients')
        .update(payload)
        .eq('id', formData.id)
        .select()
        .single();
        
      if (error) return alert("خطأ في التعديل: " + error.message);
      setPatients(patients.map(p => p.id === formData.id ? data : p));
      if (selectedPatient?.id === formData.id) setSelectedPatient(data);
    } else {
      const { data, error } = await supabase
        .from('patients')
        .insert(payload)
        .select()
        .single();
        
      if (error) return alert("خطأ في الإضافة: " + error.message);
      setPatients([data, ...patients]);
    }
    setIsModalOpen(false);
  };

  const filteredPatients = patients.filter(p => {
    const normSearch = normalizeArabic(searchQuery);
    const normName = normalizeArabic(p.name);
    const matchesSearch = normName.includes(normSearch) || p.file_number?.includes(searchQuery) || p.phone?.includes(searchQuery);
    if (!matchesSearch) return false;
    
    if (activeTab === "نشط حالياً") return p.status.includes("نشط");
    if (activeTab === "أصحاب الحالات المزمنة") return p.status.includes("VIP") || p.medical_history;
    if (activeTab === "قيد الانتظار") return p.status === "قيد الانتظار";
    return true; // "الكل"
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto h-[calc(100vh-8rem)] flex flex-col">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">دليل المرضى</h1>
          <p className="text-slate-500">إدارة بيانات العملاء وسجلاتهم الطبية</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative w-full md:w-64">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <Input 
              placeholder="بحث باسم المريض، رقم الملف..." 
              className="pl-3 pr-10 rounded-full bg-slate-50 border-slate-200"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            className="rounded-full border-green-200 text-green-700 bg-green-50 hover:bg-green-100 hidden md:flex gap-2 transition-all"
            onClick={() => openWhatsAppModal(selectedPatient)}
            title={selectedPatient?.phone ? `واتساب: ${selectedPatient.phone}` : 'اختر مريضاً لفتح واتساب'}
          >
            <MessageCircle size={16} />
            واتساب المريض
          </Button>
          <Button onClick={handleOpenAdd} className="rounded-full bg-primary text-white hover:bg-primary/90 shadow-md">
            <UserPlus size={16} className="ml-2" />
            إضافة مريض جديد
          </Button>
        </div>
      </div>

      {/* Main Layout Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0 overflow-hidden">
        
        {/* Right Side: Patients Grid (col-span-8) */}
        <div className="lg:col-span-8 flex flex-col min-h-0 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {/* Tabs */}
          <div className="flex items-center gap-6 px-6 pt-4 border-b border-slate-100 shrink-0 overflow-x-auto">
            {["الكل", "نشط حالياً", "أصحاب الحالات المزمنة", "قيد الانتظار"].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-3 text-sm font-bold whitespace-nowrap transition-colors border-b-2 ${
                  activeTab === tab 
                    ? 'border-primary text-primary' 
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Cards Grid */}
          <div className="p-6 overflow-y-auto flex-1 bg-slate-50/50">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : filteredPatients.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <User size={48} className="mb-4 opacity-20" />
                <p>لا يوجد مرضى مطابقين</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredPatients.map(patient => (
                  <Card 
                    key={patient.id} 
                    className={`cursor-pointer transition-all border-2 overflow-hidden group ${
                      selectedPatient?.id === patient.id 
                        ? 'border-primary/50 shadow-md bg-primary/5' 
                        : 'border-slate-100 hover:border-slate-200 hover:shadow-sm bg-white'
                    }`}
                    onClick={() => setSelectedPatient(patient)}
                  >
                    <CardContent className="p-0">
                      <div className="p-4 flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0 ${
                            patient.gender === 'ذكر' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'
                          }`}>
                            {patient.name.charAt(0)}
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-800 text-base mb-1">{patient.name}</h3>
                            <div className="flex items-center text-xs text-slate-500 gap-1 font-mono">
                              <span className="text-slate-400">ID:</span>
                              {patient.file_number}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge variant="outline" className={`font-bold ${
                            patient.status.includes('VIP') 
                              ? 'bg-amber-100 text-amber-700 border-amber-200' 
                              : patient.status.includes('نشط')
                                ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                : 'bg-blue-100 text-blue-700 border-blue-200'
                          }`}>
                            {patient.status}
                          </Badge>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="text-slate-400 hover:text-amber-500 p-1" onClick={(e) => { e.stopPropagation(); handleOpenEdit(patient); }}>
                              <Edit size={14} />
                            </button>
                            <button className="text-slate-400 hover:text-rose-500 p-1" onClick={(e) => { e.stopPropagation(); handleDelete(patient.id); }}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      {/* Stats row */}
                      <div className="grid grid-cols-3 divide-x divide-x-reverse border-t border-slate-50 bg-slate-50/50">
                        <div className="p-3 text-center">
                          <p className="text-[10px] font-bold text-slate-400 mb-1">النقاط</p>
                          <p className="font-black text-slate-700 text-sm">{patient.points}</p>
                        </div>
                        <div className="p-3 text-center">
                          <p className="text-[10px] font-bold text-slate-400 mb-1">آخر زيارة</p>
                          <p className="font-bold text-slate-700 text-xs mt-1.5 truncate">
                            {new Date(patient.updated_at || patient.created_at).toLocaleDateString('ar-EG')}
                          </p>
                        </div>
                        <div className="p-3 text-center">
                          <p className="text-[10px] font-bold text-slate-400 mb-1">الوصفات</p>
                          <p className="font-black text-slate-700 text-sm">0</p>
                        </div>
                      </div>
                      
                      {/* Footer total purchases */}
                      <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium flex items-center gap-1">
                          <ShoppingBag size={12} /> مشتريات: {patient.total_purchases} ج.م
                        </span>
                        {Number(patient.balance || 0) > 0 ? (
                          <span className="font-bold text-rose-600 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded text-[10px]">
                            الشكك: {Number(patient.balance).toFixed(2)} ج.م ⚠️
                          </span>
                        ) : (
                          <span className="text-slate-400 font-bold text-[10px]">لا توجد مديونية</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Left Side: Patient Details Panel (col-span-4) */}
        <div className="lg:col-span-4 flex flex-col min-h-0 overflow-hidden">
          {selectedPatient ? (
            <PatientDetailTabs
              selectedPatient={selectedPatient}
              patientSales={patientSales}
              isSalesLoading={isSalesLoading}
              urgentRequests={urgentRequests}
              onEdit={() => handleOpenEdit(selectedPatient)}
              onUrgent={() => { setUrgentDrug(""); setUrgentNotes(""); setIsUrgentModalOpen(true); }}
              onCompleteUrgent={handleCompleteUrgentRequest}
              onViewSaleDetail={(sale: any) => { setSelectedSaleDetail(sale); setIsSaleDetailModalOpen(true); }}
              onRefillEdit={() => handleOpenRefillModal(selectedPatient)}
              onCompleteRefill={() => handleQuickCompleteRefill(selectedPatient)}
              openWhatsAppModal={openWhatsAppModal}
              onPayDebt={() => { setDebtPaymentAmount(0); setDebtPaymentMethod("cash"); setIsPayDebtModalOpen(true); }}
            />
          ) : (
            <div className="h-full bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400">
              <User size={64} className="opacity-20 mb-4" />
              <p className="font-medium">اختر مريضاً لعرض تفاصيله</p>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[600px]" dir="rtl">
          <DialogHeader>
            <DialogTitle>{isEditing ? "تعديل بيانات المريض" : "إضافة مريض جديد"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="col-span-2">
              <label className="text-xs font-bold text-slate-500 mb-1 block">اسم المريض</label>
              <Input 
                value={formData.name || ""} 
                onChange={(e) => setFormData({...formData, name: e.target.value})} 
                placeholder="الاسم الثلاثي..."
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">رقم الهاتف</label>
              <Input 
                value={formData.phone || ""} 
                onChange={(e) => setFormData({...formData, phone: e.target.value})} 
                placeholder="05xxxxxxx"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">رقم الملف (ID)</label>
              <Input 
                value={formData.file_number || ""} 
                onChange={(e) => setFormData({...formData, file_number: e.target.value})} 
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">الجنس</label>
              <select 
                className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm"
                value={formData.gender || "ذكر"}
                onChange={(e) => setFormData({...formData, gender: e.target.value})}
              >
                <option value="ذكر">ذكر</option>
                <option value="أنثى">أنثى</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">العمر</label>
              <Input 
                type="number"
                value={formData.age ?? 30} 
                onChange={(e) => setFormData({...formData, age: Number(e.target.value)})} 
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">فصيلة الدم</label>
              <select 
                className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm"
                value={formData.blood_type || "O+"}
                onChange={(e) => setFormData({...formData, blood_type: e.target.value})}
              >
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="غير معروف">غير معروف</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">الحالة (التصنيف)</label>
              <select 
                className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm"
                value={formData.status || "عضو جديد"}
                onChange={(e) => setFormData({...formData, status: e.target.value})}
              >
                <option value="عضو جديد">عضو جديد</option>
                <option value="عضو نشط">عضو نشط</option>
                <option value="عضو VIP">عضو VIP</option>
                <option value="قيد الانتظار">قيد الانتظار</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">تاريخ صرف الدواء القادم (تنبيه)</label>
              <Input 
                type="date"
                value={formData.next_refill_date || ""} 
                onChange={(e) => setFormData({...formData, next_refill_date: e.target.value})} 
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block">ملاحظات الصرف / الأدوية المزمنة</label>
              <Input 
                value={formData.refill_notes || ""} 
                onChange={(e) => setFormData({...formData, refill_notes: e.target.value})} 
                placeholder="أماريل 2ملج، جلوكوفاج..."
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-bold text-slate-500 mb-1 block">التاريخ الطبي / ملاحظات</label>
              <textarea 
                className="w-full h-24 p-3 rounded-md border border-slate-200 bg-white text-sm resize-none"
                value={formData.medical_history || ""} 
                onChange={(e) => setFormData({...formData, medical_history: e.target.value})} 
                placeholder="أية أمراض مزمنة أو حساسية..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave} className="bg-primary">حفظ البيانات</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Urgent Request Modal */}
      <Dialog open={isUrgentModalOpen} onOpenChange={setIsUrgentModalOpen}>
        <DialogContent className="sm:max-w-[480px]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle size={20} className="text-red-500" />
              طلب عاجل — {selectedPatient?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700 font-medium">
              سيتم إرسال هذا الطلب فوراً لمسؤول المشتريات في صفحة الطلبات العاجلة
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">اسم الدواء / المستلزم المطلوب *</label>
              <Input
                placeholder="مثال: أموكسيسيلين 500mg ..."
                value={urgentDrug}
                onChange={e => setUrgentDrug(e.target.value)}
                className="border-red-200 focus:ring-red-300"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">ملاحظات إضافية (اختياري)</label>
              <textarea
                className="w-full h-20 p-3 rounded-md border border-slate-200 bg-white text-sm resize-none"
                placeholder="أي تفاصيل إضافية عن الحالة..."
                value={urgentNotes}
                onChange={e => setUrgentNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUrgentModalOpen(false)}>إلغاء</Button>
            <Button
              onClick={handleSendUrgentRequest}
              className="bg-red-600 hover:bg-red-700"
              disabled={!urgentDrug.trim() || urgentLoading}
            >
              {urgentLoading ? "جارٍ الإرسال..." : "إرسال الطلب العاجل"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* WhatsApp Quick Message Modal */}
      <Dialog open={isWaModalOpen} onOpenChange={setIsWaModalOpen}>
        <DialogContent className="sm:max-w-[500px]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              <MessageCircle size={20} className="text-green-500" />
              رسالة واتساب — {selectedPatient?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {/* Quick Templates */}
            <div>
              <p className="text-xs font-bold text-slate-500 mb-2">قوالب سريعة</p>
              <div className="flex flex-wrap gap-2">
                {[
                  ...(selectedPatient?.next_refill_date ? [{
                    label: "تذكير موعد الصرف",
                    msg: `السلام عليكم أ. ${selectedPatient?.name}،\n\nنود تذكيركم بموعد صرف علاجكم المزمن${selectedPatient?.refill_notes ? ` (${selectedPatient.refill_notes})` : ''} القادم والمستحق بتاريخ ${new Date(selectedPatient.next_refill_date).toLocaleDateString('ar-EG')}.\n\nنتمنى لكم وافر الصحة والعافية ❤️\nصيدلية الشفاء`
                  }] : []),
                  { label: "دواء جاهز", msg: `السلام عليكم أ. ${selectedPatient?.name}،\n\nنحيطكم علماً بأن دوائكم أصبح جاهزاً ويمكن الاستلام من الصيدلية في أي وقت.\nنتمنى لكم دوام الصحة ♥️\nصيدلية الشفاء` },
                  { label: "تذكير جرعة", msg: `السلام عليكم أ. ${selectedPatient?.name}،

هذا تذكير بموعد جرعة دوائكم اليوم، يرجى عدم التأخر في الجرعة للحفاظ على فعالية العلاج.
صيدلية الشفاء ❤️` },
                  { label: "تجديد وصفة", msg: `السلام عليكم أ. ${selectedPatient?.name}،

وصفتكم الطبية على وشك الانتهاء، نرجو التواصل معنا لتجديدها قبل نفادها.
صيدلية الشفاء ♥️` },
                  { label: "عرض خاص", msg: `السلام عليكم أ. ${selectedPatient?.name}،

لدينا عرض خاص لكم هذا الشهر على دوائكم، لا تفوتوا الفرصة.
صيدلية الشفاء ❤️` },
                ].map(t => (
                  <button
                    key={t.label}
                    onClick={() => setWaMessage(t.msg)}
                    className="px-3 py-1.5 text-xs font-bold bg-green-50 border border-green-200 text-green-700 rounded-full hover:bg-green-100 transition-colors"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Message Editor */}
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">
                نص الرسالة <span className="text-slate-400 font-normal">(يمكنك التعديل)</span>
              </label>
              <textarea
                className="w-full h-36 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-300 focus:border-green-300 leading-relaxed"
                value={waMessage}
                onChange={e => setWaMessage(e.target.value)}
                dir="rtl"
              />
            </div>

            {/* Patient info */}
            <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-500">
              <Phone size={14} className="text-green-600" />
              <span>سيتم الإرسال للرقم:</span>
              <span className="font-bold text-slate-700 font-mono">{selectedPatient?.phone}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsWaModalOpen(false)}>إلغاء</Button>
            <Button
              onClick={sendWhatsApp}
              className="bg-green-600 hover:bg-green-700 text-white gap-2"
              disabled={!waMessage.trim()}
            >
              <MessageCircle size={16} />
              فتح واتساب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Sale Details Modal ===== */}
      {isSaleDetailModalOpen && selectedSaleDetail && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" dir="rtl">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
              <div>
                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                  <ReceiptText size={22} className="text-primary" />
                  تفاصيل الفاتورة
                </h2>
                <p className="text-xs text-slate-400 mt-0.5 font-mono">{selectedSaleDetail.invoice_number}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-2xl font-black text-primary">{selectedSaleDetail.total}</p>
                  <p className="text-[10px] text-slate-400 font-bold">ج.م</p>
                </div>
                <button onClick={() => setIsSaleDetailModalOpen(false)} className="text-slate-400 hover:text-slate-600 bg-slate-100 rounded-xl p-2">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-xs text-slate-500 mb-1">تاريخ الفاتورة</p>
                  <p className="font-bold text-slate-800">{new Date(selectedSaleDetail.created_at).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-xs text-slate-500 mb-1">طريقة الدفع</p>
                  <p className="font-bold text-slate-800">{selectedSaleDetail.payment_method === 'cash' ? 'نقدي (كاش)' : 'فيزا / إلكتروني'}</p>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-slate-800 text-sm mb-3 border-b border-slate-100 pb-2">الأصناف المشتراة</h3>
                <div className="space-y-2">
                  {selectedSaleDetail.sale_items?.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">تم استرجاع جميع الأصناف</p>
                  ) : (
                    selectedSaleDetail.sale_items?.map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between bg-white border border-slate-100 rounded-xl p-3 shadow-sm">
                        <div className="flex-1">
                          <p className="text-sm font-bold text-slate-800">{item.products?.name}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            الكمية: {item.quantity} × {item.unit_price} ج.م
                          </p>
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-black text-slate-800">{item.total_price} ج.م</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-3xl shrink-0 flex justify-end">
              <Button onClick={() => setIsSaleDetailModalOpen(false)} className="px-6 font-bold">
                إغلاق
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* ===== Refill Alarm Modal ===== */}
      <Dialog open={isRefillModalOpen} onOpenChange={setIsRefillModalOpen}>
        <DialogContent className="sm:max-w-[480px]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#002B5B]">
              <Clock size={20} className="text-[#002B5B]" />
              تنبيه صرف الدواء — {selectedPatient?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">تاريخ الصرف القادم *</label>
              <Input
                type="date"
                value={refillDate}
                onChange={e => setRefillDate(e.target.value)}
                className="border-slate-200 focus:ring-[#002B5B]"
              />
            </div>

            {/* Quick Presets */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 mb-1.5 block">جدولة سريعة (من اليوم)</label>
              <div className="flex gap-2">
                {[
                  { label: "بعد أسبوع (+7)", days: 7 },
                  { label: "بعد أسبوعين (+14)", days: 14 },
                  { label: "بعد شهر (+30)", days: 30 },
                  { label: "بعد 3 أشهر (+90)", days: 90 },
                ].map(p => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + p.days);
                      const y = d.getFullYear();
                      const m = String(d.getMonth() + 1).padStart(2, '0');
                      const dd = String(d.getDate()).padStart(2, '0');
                      setRefillDate(`${y}-${m}-${dd}`);
                    }}
                    className="flex-1 py-1.5 text-[10px] font-bold bg-slate-50 hover:bg-slate-100 text-[#002B5B] border border-slate-200 rounded-lg transition-colors"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">قائمة الأدوية المزمنة والملاحظات</label>
              <textarea
                className="w-full h-24 p-3 rounded-xl border border-slate-200 bg-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#002B5B]/20"
                placeholder="أدخل أسماء الأدوية أو الجرعات المطلوبة..."
                value={refillNotes}
                onChange={e => setRefillNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="flex justify-between items-center w-full">
            {selectedPatient?.next_refill_date && (
              <Button
                variant="ghost"
                onClick={async () => {
                  if (!window.confirm("هل تريد إلغاء تنبيه صرف الدواء لهذا المريض؟")) return;
                  setRefillLoading(true);
                  const { error } = await supabase
                    .from('patients')
                    .update({ next_refill_date: null, refill_notes: null })
                    .eq('id', selectedPatient.id);
                  setRefillLoading(false);
                  if (!error) {
                    toast.success("تم إلغاء التنبيه");
                    setIsRefillModalOpen(false);
                    fetchPatients();
                    setSelectedPatient({
                      ...selectedPatient,
                      next_refill_date: undefined,
                      refill_notes: undefined
                    });
                  }
                }}
                className="text-red-500 hover:text-red-700 hover:bg-red-50 text-xs font-bold"
              >
                إلغاء التنبيه
              </Button>
            )}
            <div className="flex gap-2 mr-auto">
              <Button variant="outline" onClick={() => setIsRefillModalOpen(false)}>إلغاء</Button>
              <Button
                onClick={handleSaveRefill}
                className="bg-[#002B5B] hover:bg-[#001f42] text-white"
                disabled={refillLoading}
              >
                {refillLoading ? "جارٍ الحفظ..." : "حفظ التنبيه"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settle Debt Modal */}
      <Dialog open={isPayDebtModalOpen} onOpenChange={setIsPayDebtModalOpen}>
        <DialogContent className="sm:max-w-[450px]" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 size={20} className="text-emerald-500" />
              تسجيل دفعة سداد — {selectedPatient?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex justify-between text-xs font-bold text-slate-500">
              <span>المديونية الحالية:</span>
              <span className="text-rose-600 font-black text-sm">{Number(selectedPatient?.balance || 0).toFixed(2)} ج.م</span>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">المبلغ المراد سداده *</label>
              <Input
                type="number"
                min="0.01"
                max={Number(selectedPatient?.balance || 0)}
                step="0.01"
                value={debtPaymentAmount || ""}
                onChange={e => setDebtPaymentAmount(Number(e.target.value))}
                placeholder="أدخل المبلغ..."
                className="border-slate-200 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">طريقة الدفع *</label>
              <select
                className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm"
                value={debtPaymentMethod}
                onChange={e => setDebtPaymentMethod(e.target.value)}
              >
                <option value="cash">كاش 💵</option>
                <option value="visa">فيزا 💳</option>
                <option value="instapay">إنستاباي / فودافون كاش 📱</option>
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPayDebtModalOpen(false)}>إلغاء</Button>
            <Button
              onClick={handleConfirmPayDebt}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={debtPaymentLoading || !debtPaymentAmount || debtPaymentAmount <= 0}
            >
              {debtPaymentLoading ? "جاري التسجيل..." : "تأكيد السداد"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

export default function PatientsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <PatientsContent />
    </Suspense>
  );
}
