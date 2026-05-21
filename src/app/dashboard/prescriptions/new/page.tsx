"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth-store";
import { toast } from "sonner";

export default function NewPrescriptionPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  useEffect(() => {
    async function createNew() {
      if (!user?.pharmacy_id) return;
      
      const rxNumber = `RX-${Math.floor(Math.random() * 90000) + 10000}`;
      
      const { data, error } = await supabase
        .from('prescriptions')
        .insert({
          pharmacy_id: user.pharmacy_id,
          rx_number: rxNumber,
          doctor_name: "طبيب غير محدد",
          clinic_name: "عيادة خارجية",
          prescription_date: new Date().toISOString().split('T')[0],
          ai_accuracy: 100,
          status: 'pending'
        })
        .select()
        .single();
        
      if (error) {
        toast.error("حدث خطأ أثناء إنشاء الوصفة");
        router.push('/dashboard/prescriptions');
      } else {
        toast.success("تم إنشاء وصفة جديدة، يمكنك الآن تعديلها");
        router.push(`/dashboard/prescriptions/${data.id}`);
      }
    }
    
    createNew();
  }, [user]);

  return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-lg font-bold text-slate-700">جاري إنشاء ملف الوصفة الذكية...</p>
      </div>
    </div>
  );
}
