"use client";

import { useState, useEffect } from "react";
import { Plus, Search, FileText, ChevronRight, Eye, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth-store";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function PrescriptionsPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.pharmacy_id) {
      fetchPrescriptions();
    }
  }, [user]);

  async function fetchPrescriptions() {
    const { data, error } = await supabase
      .from('prescriptions')
      .select('*, patients(name)')
      .eq('pharmacy_id', user?.pharmacy_id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error("Error fetching prescriptions:", error);
    } else {
      setPrescriptions(data || []);
    }
    setLoading(false);
  }

  const handleDelete = async (id: string) => {
    if (confirm("هل أنت متأكد من حذف هذه الوصفة؟")) {
      const { error } = await supabase.from('prescriptions').delete().eq('id', id);
      if (!error) {
        setPrescriptions(prescriptions.filter(p => p.id !== id));
      }
    }
  };

  const filteredPrescriptions = prescriptions.filter(p => 
    p.rx_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.patients?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.doctor_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <FileText className="text-blue-600" />
            الوصفات الطبية
          </h1>
          <p className="text-slate-500 mt-1">إدارة الوصفات الطبية ومراجعة نتائج الاستخراج الذكي</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => router.push('/dashboard/prescriptions/new')} className="bg-blue-600 hover:bg-blue-700">
            <Plus size={18} className="mr-2" /> إضافة وصفة جديدة
          </Button>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="relative w-full max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <Input 
              placeholder="البحث برقم الوصفة، اسم المريض، الطبيب..." 
              className="pr-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="font-bold text-slate-700">رقم الوصفة</TableHead>
                  <TableHead className="font-bold text-slate-700">المريض</TableHead>
                  <TableHead className="font-bold text-slate-700">الطبيب المعالج</TableHead>
                  <TableHead className="font-bold text-slate-700">التاريخ</TableHead>
                  <TableHead className="font-bold text-slate-700">الحالة</TableHead>
                  <TableHead className="font-bold text-slate-700 text-left">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-500">جاري التحميل...</TableCell></TableRow>
                ) : filteredPrescriptions.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-500">لا توجد وصفات طبية مطابقة للبحث</TableCell></TableRow>
                ) : (
                  filteredPrescriptions.map((p) => (
                    <TableRow key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="font-mono font-medium text-blue-600">{p.rx_number}</TableCell>
                      <TableCell className="font-bold text-slate-800">{p.patients?.name || 'غير محدد'}</TableCell>
                      <TableCell className="text-slate-600">{p.doctor_name || '-'}</TableCell>
                      <TableCell className="text-slate-500">{new Date(p.prescription_date || p.created_at).toLocaleDateString('ar-EG')}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={p.status === 'pending' ? 'bg-orange-50 text-orange-600 border-orange-200' : p.status === 'approved' ? 'bg-green-50 text-green-600 border-green-200' : ''}>
                          {p.status === 'pending' ? 'قيد المراجعة' : p.status === 'approved' ? 'معتمدة' : p.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-left">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/dashboard/prescriptions/${p.id}`}>
                            <Button variant="outline" size="sm" className="h-8 text-blue-600 border-blue-200 hover:bg-blue-50">
                              <Eye size={14} className="mr-1" /> عرض ومراجعة
                            </Button>
                          </Link>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(p.id)}>
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
