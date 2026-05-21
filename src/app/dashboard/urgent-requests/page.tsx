"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, Truck, Stethoscope, CheckCircle2, Clock, Plus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

export default function UrgentRequestsPage() {
  const [missingDrugInput, setMissingDrugInput] = useState("");
  const [missingPatientInput, setMissingPatientInput] = useState("");
  const [isPatientSelected, setIsPatientSelected] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchRequests();
  }, []);

  async function fetchRequests() {
    setIsLoading(true);
    const { data } = await supabase
      .from('urgent_requests')
      .select('*, patients(id, name, file_number, phone)')
      .order('created_at', { ascending: false });
    
    setRequests(data || []);
    setIsLoading(false);
  }

  useEffect(() => {
    if (missingPatientInput.trim().length > 0 && !isPatientSelected) {
      searchPatients(missingPatientInput);
    } else {
      setPatients([]);
    }
  }, [missingPatientInput, isPatientSelected]);

  async function searchPatients(query: string) {
    console.log("Searching patients for:", query);
    const { data, error } = await supabase
      .rpc('search_patients', { search_query: query });
    if (error) {
      console.error("Error searching patients:", error);
      toast.error("خطأ أثناء البحث عن المرضى: " + error.message);
    } else {
      console.log("Search results:", data);
    }
    setPatients(data || []);
  }

  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  const handleAddMissingDrug = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!missingDrugInput.trim()) return;

    const { error } = await supabase
      .from('urgent_requests')
      .insert({
        type: 'missing_drug',
        title: missingDrugInput,
        priority: 'critical',
        status: 'pending',
        patient_id: selectedPatientId || null,
        patient_name: missingPatientInput.trim() || null,
        metadata: missingPatientInput.trim() ? { patient: missingPatientInput } : null
      });

    if (!error) {
      setMissingDrugInput("");
      setMissingPatientInput("");
      setIsPatientSelected(false);
      setSelectedPatientId(null);
      setPatients([]);
      toast.success("تم تسجيل طلب النقص بنجاح وسيتم إبلاغ الإدارة.");
      fetchRequests();
    }
  };

  const completeRequest = async (id: string) => {
    const { error } = await supabase
      .from('urgent_requests')
      .update({ status: 'completed' })
      .eq('id', id);

    if (!error) {
      toast.success("تم إنجاز الطلب العاجل بنجاح!", {
        icon: <CheckCircle2 className="text-green-500" />
      });
      fetchRequests();
    }
  };

  const missingDrugs = requests.filter(r => r.type === 'missing_drug');
  const deliveries = requests.filter(r => r.type === 'delivery' && r.status === 'pending');
  const clinicRequests = requests.filter(r => r.type === 'clinic' && r.status === 'pending');

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <AlertTriangle className="text-red-500" />
            الطلبات العاجلة والطوارئ
          </h1>
          <p className="text-slate-500 mt-1">
            لوحة التحكم الخاصة بالمهام ذات الأولوية القصوى داخل الصيدلية.
          </p>
        </div>
        <Badge variant="destructive" className="px-4 py-1 text-sm animate-pulse">
          {deliveries.length + clinicRequests.length} طلبات جديدة
        </Badge>
      </div>

      <Tabs defaultValue="missing" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-8 h-14 bg-white border border-slate-200 shadow-sm rounded-xl">
          <TabsTrigger value="missing" className="data-[state=active]:bg-red-50 data-[state=active]:text-red-600 rounded-lg font-bold text-base">
            <AlertTriangle size={18} className="mr-2" />
            نواقص الأدوية الحرجة
          </TabsTrigger>
          <TabsTrigger value="delivery" className="data-[state=active]:bg-orange-50 data-[state=active]:text-orange-600 rounded-lg font-bold text-base">
            <Truck size={18} className="mr-2" />
            توصيل سريع (Express)
          </TabsTrigger>
          <TabsTrigger value="clinic" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600 rounded-lg font-bold text-base">
            <Stethoscope size={18} className="mr-2" />
            طلبات العيادات الداخلية
          </TabsTrigger>
        </TabsList>

        {/* 1. Missing Drugs Tab */}
        <TabsContent value="missing" className="space-y-6 mt-0">
          <Card className="border-red-100 shadow-sm overflow-visible">
            <CardHeader className="bg-red-50/50 border-b border-red-100 pb-4 rounded-t-xl">
              <CardTitle className="text-red-700 text-lg">تسجيل صنف ناقص بشكل حرج</CardTitle>
              <CardDescription className="text-red-600/70">سيتم إرسال إشعار فوري لمسؤول المشتريات لتوفير الدواء.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleAddMissingDrug} className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 flex flex-col sm:flex-row gap-2">
                  <Input 
                    placeholder="اسم الدواء الناقص والتركيز..." 
                    className="flex-[2]"
                    value={missingDrugInput}
                    onChange={(e) => setMissingDrugInput(e.target.value)}
                  />
                  <div className="flex-1 relative">
                    <Input 
                      placeholder="اسم المريض (اختياري)..." 
                      className="w-full"
                      value={missingPatientInput}
                      onChange={(e) => {
                        setMissingPatientInput(e.target.value);
                        setIsPatientSelected(false);
                      }}
                    />
                    {patients.length > 0 && !isPatientSelected && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 shadow-xl rounded-lg overflow-hidden flex flex-col max-h-40 overflow-y-auto z-50">
                        {patients.map(p => (
                          <div 
                            key={p.id} 
                            className="p-3 text-sm border-b border-slate-100 hover:bg-slate-50 cursor-pointer flex items-center justify-between text-slate-800"
                            onClick={() => {
                              setMissingPatientInput(p.name);
                              setSelectedPatientId(p.id);
                              setIsPatientSelected(true);
                              setPatients([]);
                            }}
                          >
                            <span className="font-bold text-slate-800">{p.name}</span>
                            {p.file_number && <span className="text-slate-400 text-xs font-mono">{p.file_number}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <Button type="submit" variant="destructive" className="px-8 shrink-0">
                  إرسال الطلب <Plus size={16} className="mr-2" />
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
              قائمة النواقص المسجلة مسبقاً
            </div>
            <div className="divide-y divide-slate-100">
              {missingDrugs.map((drug) => (
                <div key={drug.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div>
                    <h4 className="font-bold text-slate-800">{drug.title}</h4>
                    {/* Show linked patient - either from patients table join or metadata */}
                    {(drug.patients || drug.metadata?.patient) && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="inline-flex items-center gap-1 bg-blue-50 border border-blue-100 text-blue-700 text-xs font-bold rounded-full px-2.5 py-0.5">
                          👤 {drug.patients?.name || drug.metadata.patient}
                          {drug.patients?.file_number && (
                            <span className="text-blue-400 font-mono text-[10px]">{drug.patients.file_number}</span>
                          )}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-4 mt-1 text-sm">
                      <span className="text-slate-500 flex items-center gap-1"><Clock size={14} /> {new Date(drug.created_at).toLocaleDateString('ar-EG')}</span>
                      <Badge variant="outline" className={drug.status === 'completed' ? 'text-green-600 border-green-200 bg-green-50' : 'text-orange-600 border-orange-200 bg-orange-50'}>
                        {drug.status === 'pending' ? 'تم الطلب' : 'مكتمل'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant="destructive" className="bg-red-100 text-red-700 border-0 hover:bg-red-200 uppercase text-[10px]">
                      {drug.priority === 'critical' ? 'حرجة للغاية' : 'عالية'}
                    </Badge>
                    {drug.status === 'pending' && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-green-600 border-green-200 hover:bg-green-50 h-8 text-xs"
                        onClick={() => completeRequest(drug.id)}
                      >
                        <CheckCircle2 size={14} className="mr-1" /> تم التوفير
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* 2. Express Delivery Tab */}
        <TabsContent value="delivery" className="mt-0 space-y-4">
          {deliveries.map((order) => (
            <Card key={order.id} className="border-orange-200 shadow-sm overflow-hidden border-r-4 border-r-orange-500">
              <CardContent className="p-0 flex flex-col sm:flex-row">
                <div className="p-6 flex-1">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-lg text-slate-800">{order.title}</h3>
                      <p className="text-sm text-slate-500">{order.metadata?.phone} • {order.metadata?.items} منتجات</p>
                    </div>
                    <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-200 border-0">
                      توصيل فوري
                    </Badge>
                  </div>
                  
                  <div className="flex gap-4 items-center text-sm font-medium">
                    <span className="text-primary">{order.metadata?.total?.toFixed(2)} ج.م</span>
                    <span className="text-slate-300">|</span>
                    <span className="text-red-500 flex items-center gap-1"><Clock size={14} /> {new Date(order.created_at).toLocaleTimeString('ar-EG')}</span>
                  </div>
                </div>
                
                <div className="bg-slate-50 p-6 sm:w-48 flex flex-col justify-center border-t sm:border-t-0 sm:border-r border-slate-100">
                  <Button 
                    className="w-full bg-orange-500 hover:bg-orange-600 mb-2"
                    onClick={() => completeRequest(order.id)}
                  >
                    تجهيز الطلب
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {deliveries.length === 0 && <p className="text-center py-12 text-slate-400">لا توجد طلبات توصيل عاجلة</p>}
        </TabsContent>

        {/* 3. Clinic Requests Tab */}
        <TabsContent value="clinic" className="mt-0 space-y-4">
          {clinicRequests.map((req) => (
            <Card key={req.id} className="border-blue-200 shadow-sm overflow-hidden border-r-4 border-r-blue-500">
              <CardContent className="p-0 flex flex-col sm:flex-row">
                <div className="p-6 flex-1">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-lg text-slate-800">{req.title}</h3>
                        <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">حالة طارئة</Badge>
                      </div>
                      <p className="text-sm text-slate-500 mt-1">مطلوب بواسطة: {req.metadata?.doctor} • المريض: {req.metadata?.patient}</p>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 inline-block">
                    <span className="font-bold text-blue-800">الوصف: </span>
                    <span className="text-blue-700">{req.description}</span>
                  </div>
                </div>
                
                <div className="bg-slate-50 p-6 sm:w-48 flex flex-col justify-center border-t sm:border-t-0 sm:border-r border-slate-100 gap-2">
                  <Button 
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    onClick={() => completeRequest(req.id)}
                  >
                    تم التجهيز
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {clinicRequests.length === 0 && <p className="text-center py-12 text-slate-400">لا توجد طلبات عيادات عاجلة</p>}
        </TabsContent>

      </Tabs>
    </div>
  );
}
