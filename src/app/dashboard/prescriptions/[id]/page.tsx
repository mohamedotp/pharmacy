"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  Sparkles, Edit2, AlertTriangle, Printer, RotateCw, ZoomIn, ZoomOut, 
  User, CheckCircle2, Save, FileText, ArrowRight, Trash2, Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { toast } from "sonner";

export default function PrescriptionReviewPage() {
  const { id } = useParams();
  const router = useRouter();
  const [prescription, setPrescription] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formData, setFormData] = useState({
    drug_name: "",
    dosage: "",
    unit_price: 0,
    quantity: 1,
    warning_note: ""
  });

  useEffect(() => {
    if (id) fetchPrescriptionData();
  }, [id]);

  async function fetchPrescriptionData() {
    const { data: presData, error: presError } = await supabase
      .from('prescriptions')
      .select('*, patients(*)')
      .eq('id', id)
      .single();

    if (presError) {
      console.error(presError);
      toast.error("خطأ في جلب بيانات الوصفة");
      return;
    }

    const { data: itemsData, error: itemsError } = await supabase
      .from('prescription_items')
      .select('*')
      .eq('prescription_id', id)
      .order('created_at', { ascending: true });

    if (!itemsError) {
      setItems(itemsData || []);
    }

    setPrescription(presData);
    setLoading(false);
  }

  // Recalculate totals when items change
  useEffect(() => {
    if (!prescription || items.length === 0) return;
    const newTotal = items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
    const newTax = newTotal * 0.15;
    
    if (newTotal !== prescription.total_amount) {
      setPrescription({ ...prescription, total_amount: newTotal, tax_amount: Number(newTax.toFixed(2)) });
    }
  }, [items]);

  const handleApprove = async () => {
    // 1. Update prescription status and new totals
    const { error: presError } = await supabase
      .from('prescriptions')
      .update({ 
        status: 'approved',
        total_amount: prescription.total_amount,
        tax_amount: prescription.tax_amount,
        net_amount: prescription.total_amount + prescription.tax_amount
      })
      .eq('id', id);
    
    if (presError) {
      toast.error("خطأ أثناء الاعتماد");
    } else {
      toast.success("تم اعتماد وصرف الوصفة بنجاح");
      fetchPrescriptionData();
    }
  };

  const handleSaveDraft = async () => {
    const { error } = await supabase
      .from('prescriptions')
      .update({ 
        total_amount: prescription.total_amount,
        tax_amount: prescription.tax_amount,
        net_amount: prescription.total_amount + prescription.tax_amount
      })
      .eq('id', id);
    if (!error) toast.success("تم حفظ المسودة بنجاح");
  };

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({ drug_name: "", dosage: "", unit_price: 0, quantity: 1, warning_note: "" });
    setIsModalOpen(true);
  };

  const openEditModal = (item: any) => {
    setEditingItem(item);
    setFormData({
      drug_name: item.drug_name,
      dosage: item.dosage || "",
      unit_price: item.unit_price,
      quantity: item.quantity,
      warning_note: item.warning_note || ""
    });
    setIsModalOpen(true);
  };

  const handleSaveItem = async () => {
    if (!formData.drug_name) {
      toast.error("الرجاء إدخال اسم الدواء");
      return;
    }

    const payload = {
      prescription_id: id,
      drug_name: formData.drug_name,
      dosage: formData.dosage,
      unit_price: formData.unit_price,
      quantity: formData.quantity,
      warning_note: formData.warning_note || null,
      total_price: formData.unit_price * formData.quantity
    };

    if (editingItem) {
      // Update
      const { data, error } = await supabase
        .from('prescription_items')
        .update(payload)
        .eq('id', editingItem.id)
        .select()
        .single();
      
      if (!error && data) {
        setItems(items.map(i => i.id === data.id ? data : i));
        toast.success("تم تعديل الصنف بنجاح");
      }
    } else {
      // Insert
      const { data, error } = await supabase
        .from('prescription_items')
        .insert(payload)
        .select()
        .single();
      
      if (!error && data) {
        setItems([...items, data]);
        toast.success("تمت إضافة الصنف بنجاح");
      }
    }
    setIsModalOpen(false);
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm("هل أنت متأكد من حذف هذا الدواء من الوصفة؟")) return;
    const { error } = await supabase.from('prescription_items').delete().eq('id', itemId);
    if (!error) {
      setItems(items.filter(i => i.id !== itemId));
      toast.success("تم حذف الدواء بنجاح");
    }
  };

  if (loading) return <div className="p-10 text-center text-slate-500 font-bold">جاري تحميل تفاصيل الوصفة...</div>;
  if (!prescription) return <div className="p-10 text-center text-red-500 font-bold">لم يتم العثور على الوصفة الطبية</div>;

  const patient = prescription.patients;

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center gap-4 border-b border-slate-200 pb-4 justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/prescriptions">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowRight size={20} className="text-slate-600" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-slate-800">مراجعة الوصفة الذكية</h1>
          <div className="hidden md:flex gap-4 mr-10 text-sm font-medium">
            <Link href="/dashboard" className="text-slate-400 hover:text-blue-600 transition-colors">الرئيسية</Link>
            <Link href="/dashboard/urgent-requests" className="text-slate-400 hover:text-blue-600 transition-colors">الطلبات العاجلة</Link>
            <span className="text-slate-400">التنبيهات <Badge className="bg-red-500 text-white hover:bg-red-600 px-1.5 ml-1">3</Badge></span>
          </div>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" className="border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 font-bold">
            <FileText size={16} className="mr-2"/> تعديل الوثيقة
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Sidebar - 4 columns */}
        <div className="lg:col-span-4 space-y-6 sticky top-24">
          
          {/* Patient Info Card */}
          <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden">
            <CardContent className="p-5 relative">
              <Badge className="absolute top-4 left-4 bg-slate-100 text-slate-600 hover:bg-slate-200 border-0 pointer-events-none">
                {patient?.status || 'ملف نشط'}
              </Badge>
              
              <div className="flex flex-col items-center mt-2 mb-6">
                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-3">
                  <User size={32} />
                </div>
                <h2 className="text-xl font-bold text-slate-800">{patient?.name || 'مريض غير مسجل'}</h2>
                <div className="text-sm text-slate-500 mt-1 flex gap-2 items-center">
                  <span>{patient?.age ? `${patient.age} عاماً` : '-'}</span>
                  <span>•</span>
                  <span className="text-red-500 font-bold" dir="ltr">{patient?.blood_type || '-'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <p className="text-xs text-slate-400 mb-1">آخر زيارة</p>
                  <p className="font-bold text-slate-700 text-sm">12 سبتمبر 2023</p>
                </div>
                <div className="bg-red-50/50 rounded-xl p-3 border border-red-100">
                  <p className="text-xs text-slate-400 mb-1">حساسية</p>
                  <p className="font-bold text-red-600 text-sm">{patient?.medical_history?.includes('حساسية') ? patient.medical_history.replace('حساسية:', '') : 'لا يوجد'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Extraction Results */}
          <Card className="border-blue-200 shadow-sm rounded-2xl overflow-hidden flex flex-col max-h-[500px]">
            <div className="bg-[#1e3a8a] text-white p-4 flex justify-between items-center shrink-0">
              <Badge className="bg-blue-700/50 text-blue-100 border-blue-500/50 pointer-events-none px-3 py-1 font-mono">دقة {prescription.ai_accuracy}%</Badge>
              <h3 className="font-bold flex items-center gap-2">
                نتائج الاستخراج الذكي (AI) <Sparkles size={18} className="text-blue-200" />
              </h3>
            </div>
            
            <div className="p-4 space-y-4 bg-slate-50/80 overflow-y-auto flex-1">
              {items.map((item, index) => (
                <div key={item.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm relative group hover:border-blue-300 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 pr-2">
                      <div className="flex items-center gap-2">
                        {item.warning_note && <AlertTriangle size={16} className="text-red-500 shrink-0" />}
                        <h4 className="font-bold text-slate-800 text-base leading-tight">{item.drug_name}</h4>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1.5">تمت المطابقة مع: <span className="font-mono text-slate-500">{item.drug_name.split(' ')[0]} {item.drug_name.split(' ')[1]}</span></p>
                    </div>
                    <div className="text-left shrink-0 ml-2">
                      <p className="font-bold text-blue-700 text-sm">{item.unit_price.toFixed(2)} ر.س</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">المخزون: <span className="font-mono">{item.quantity * 10}</span> علبة</p>
                    </div>
                  </div>

                  {item.warning_note && (
                    <div className="mb-3 bg-red-50/50 p-2 rounded-lg border border-red-100/50">
                      <p className="text-xs text-slate-600">ملاحظة: <span className="text-slate-800 font-medium">{item.warning_note}</span></p>
                      <button className="text-[11px] text-blue-600 underline font-medium mt-1">عرض البديل</button>
                    </div>
                  )}

                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEditModal(item)} className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors p-1.5 rounded-md">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDeleteItem(item.id)} className="text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors p-1.5 rounded-md">
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg mr-auto">
                      <span className="text-xs text-slate-500 mr-1">الجرعة:</span>
                      <span className="text-xs font-bold text-slate-700">{item.dosage}</span>
                    </div>
                  </div>
                </div>
              ))}
              <Button variant="outline" className="w-full border-dashed border-2 border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 h-12" onClick={openAddModal}>
                <Plus size={18} className="mr-2" /> إضافة دواء للوصفة
              </Button>
            </div>
          </Card>

          {/* Summary Box */}
          <Card className="border-slate-200 shadow-sm rounded-2xl bg-white">
            <CardContent className="p-5">
              <div className="flex justify-between items-end mb-6">
                <div className="text-left">
                  <p className="text-[11px] text-slate-500 mb-1">ضريبة القيمة المضافة (15%)</p>
                  <p className="font-bold text-slate-700">{prescription.tax_amount.toFixed(2)} ر.س</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500 mb-1">إجمالي الوصفة ({items.length} أصناف)</p>
                  <p className="font-bold text-2xl text-slate-800">{prescription.total_amount.toFixed(2)} <span className="text-sm text-slate-500">ر.س</span></p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 bg-white border-slate-200 text-slate-700 hover:bg-slate-50 h-12 font-bold shadow-sm" onClick={handleSaveDraft}>
                  <Save size={18} className="ml-2 text-slate-400" /> حفظ كمسودة
                </Button>
                <Button className="flex-[1.5] bg-[#002B5B] hover:bg-blue-900 text-white h-12 font-bold shadow-md" onClick={handleApprove} disabled={prescription.status === 'approved'}>
                  <CheckCircle2 size={18} className="ml-2" /> {prescription.status === 'approved' ? 'تم الاعتماد' : 'اعتماد وصرف الوصفة'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Document Viewer - 8 columns */}
        <div className="lg:col-span-8 h-full">
          <Card className="h-full border-slate-200 shadow-sm rounded-2xl bg-slate-50/50 flex flex-col min-h-[800px]">
            <div className="p-4 flex justify-between items-center border-b border-slate-200 bg-white rounded-t-2xl shrink-0">
              <div className="flex gap-1.5">
                <Button variant="ghost" size="icon" className="text-slate-500 hover:text-slate-800 h-9 w-9 bg-slate-50 border border-slate-100 shadow-sm"><Printer size={16} /></Button>
                <div className="w-px h-6 bg-slate-200 my-auto mx-1"></div>
                <Button variant="ghost" size="icon" className="text-slate-500 hover:text-slate-800 h-9 w-9 hover:bg-slate-100"><RotateCw size={16} /></Button>
                <Button variant="ghost" size="icon" className="text-slate-500 hover:text-slate-800 h-9 w-9 hover:bg-slate-100"><ZoomIn size={16} /></Button>
                <Button variant="ghost" size="icon" className="text-slate-500 hover:text-slate-800 h-9 w-9 hover:bg-slate-100"><ZoomOut size={16} /></Button>
              </div>
              <div className="flex items-center gap-2 text-slate-700 font-bold bg-slate-50 px-4 py-1.5 rounded-lg border border-slate-100">
                <span className="font-mono text-sm">{prescription.rx_number}</span> :وصفة طبية رقم <FileText size={18} className="text-blue-600 ml-1" />
              </div>
            </div>

            <div className="flex-1 p-6 flex items-center justify-center relative overflow-hidden pattern-dots pattern-slate-200 pattern-bg-transparent pattern-size-4 pattern-opacity-100">
              {/* Document Sheet */}
              <div className="bg-white w-full max-w-2xl min-h-[600px] shadow-xl rounded p-10 relative flex flex-col z-10 mx-auto border border-slate-100 transition-transform hover:scale-[1.01] duration-300">
                {/* Rx Watermark */}
                <div className="absolute right-12 top-40 text-[180px] font-serif text-slate-100 font-bold select-none pointer-events-none opacity-40">
                  Rx
                </div>

                {/* Header */}
                <div className="flex justify-between items-start border-b-2 border-slate-100 pb-6 mb-8 relative z-20">
                  <div className="text-left text-sm text-slate-500 font-mono">
                    <p>Date: <span className="text-slate-700 font-sans">{new Date(prescription.prescription_date).toLocaleDateString('en-US')}</span></p>
                    <p>Clinic: <span className="text-slate-700 font-sans">{prescription.clinic_name}</span></p>
                  </div>
                  <div className="text-right">
                    <h3 className="font-bold text-xl text-slate-800">{prescription.doctor_name}</h3>
                    <p className="text-sm text-slate-500">Consultant Cardiologist</p>
                  </div>
                </div>

                {/* Lines / Extraction Overlays */}
                <div className="flex-1 space-y-6 relative z-20 mt-8">
                  {items.map((item, idx) => (
                    <div 
                      key={item.id} 
                      className={`relative rounded-md p-4 text-right transition-all cursor-crosshair ${
                        idx === 1 
                          ? "border-2 border-blue-300 bg-blue-50/40 shadow-[0_0_15px_rgba(59,130,246,0.1)]" 
                          : "border border-slate-200 bg-slate-50/50 hover:border-blue-200 hover:bg-slate-50"
                      }`}
                    >
                      {idx === 1 && (
                        <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_8px_rgba(59,130,246,0.8)] -translate-y-1/2 opacity-70 pointer-events-none"></div>
                      )}
                      <p className="font-serif italic text-2xl text-slate-800">{item.drug_name.split(' (')[0]}</p>
                      <p className="text-slate-500 text-sm mt-2 font-mono">tab {item.dosage.includes('صباح') ? 'in the morning' : item.dosage.includes('غداء') ? 'after lunch' : 'daily at bedtime'} {item.quantity}</p>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div className="mt-16 pt-8 border-t border-slate-100 flex justify-between items-end relative z-20">
                  <div className="text-slate-300 opacity-60">
                    <svg width="80" height="40" viewBox="0 0 100 50" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10,40 Q30,10 50,30 T90,20" />
                      <path d="M40,20 L60,40" />
                      <path d="M15,35 Q25,15 45,35 T85,25" />
                    </svg>
                  </div>
                  <div className="text-right text-xs text-slate-500 uppercase tracking-wider font-mono">
                    <p className="mb-1">Patient: <span className="font-sans font-bold text-slate-700">{patient?.name || 'Yasser Mohamed'}</span></p>
                    <p>ID: 290110294</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* CRUD Dialog for Items */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-right">{editingItem ? "تعديل الدواء الموصوف" : "إضافة دواء جديد"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2 text-right">
              <Label>اسم الدواء</Label>
              <Input 
                value={formData.drug_name} 
                onChange={(e) => setFormData({...formData, drug_name: e.target.value})} 
                className="text-right" 
                placeholder="مثال: Concor 5mg"
              />
            </div>
            <div className="space-y-2 text-right">
              <Label>الجرعة</Label>
              <Input 
                value={formData.dosage} 
                onChange={(e) => setFormData({...formData, dosage: e.target.value})} 
                className="text-right" 
                placeholder="مثال: قرص واحد قبل النوم"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 text-right">
                <Label>السعر (ر.س)</Label>
                <Input 
                  type="number" 
                  value={formData.unit_price} 
                  onChange={(e) => setFormData({...formData, unit_price: parseFloat(e.target.value) || 0})} 
                  className="text-right" 
                />
              </div>
              <div className="space-y-2 text-right">
                <Label>الكمية (العلب)</Label>
                <Input 
                  type="number" 
                  value={formData.quantity} 
                  onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value) || 1})} 
                  className="text-right" 
                />
              </div>
            </div>
            <div className="space-y-2 text-right">
              <Label>ملاحظة / بديل (اختياري)</Label>
              <Input 
                value={formData.warning_note} 
                onChange={(e) => setFormData({...formData, warning_note: e.target.value})} 
                className="text-right" 
                placeholder="مثال: يتوفر بديل محلي..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>إلغاء</Button>
            <Button onClick={handleSaveItem} className="bg-blue-600 hover:bg-blue-700">حفظ التعديلات</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
