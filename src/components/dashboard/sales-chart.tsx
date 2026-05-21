"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, XAxis, Tooltip, Line, ComposedChart } from "recharts";
import { supabase } from "@/lib/supabase";

const DAY_NAMES = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

interface SalesChartProps {
  days?: number;
}

export function SalesChart({ days = 7 }: SalesChartProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const from = new Date();
      from.setDate(from.getDate() - (days - 1));
      from.setHours(0, 0, 0, 0);

      const { data: sales } = await supabase
        .from("sales")
        .select("total, created_at")
        .gte("created_at", from.toISOString());

      // Build daily buckets
      const buckets: Record<string, { name: string; total: number; count: number }> = {};
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split("T")[0];
        buckets[key] = { name: DAY_NAMES[d.getDay()], total: 0, count: 0 };
      }

      (sales || []).forEach((s) => {
        const key = new Date(s.created_at).toISOString().split("T")[0];
        if (buckets[key]) {
          buckets[key].total += Number(s.total);
          buckets[key].count += 1;
        }
      });

      setData(Object.values(buckets));
      setLoading(false);
    }
    load();
  }, [days]);

  if (loading) {
    return (
      <div className="h-[280px] flex items-center justify-center text-slate-300 text-sm font-bold">
        جاري التحميل...
      </div>
    );
  }

  if (data.every((d) => d.total === 0)) {
    return (
      <div className="h-[280px] flex items-center justify-center text-slate-300 text-sm font-bold">
        لا توجد مبيعات في هذه الفترة
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
        <XAxis dataKey="name" stroke="#888" fontSize={11} tickLine={false} axisLine={false} tick={{ fill: "#94a3b8" }} />
        <Tooltip
          cursor={{ fill: "rgba(0,43,91,0.04)" }}
          contentStyle={{ borderRadius: "10px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", fontSize: 12 }}
          formatter={(v: any) => [`${Number(v).toLocaleString("ar-EG")} ج.م`, "المبيعات"]}
        />
        <Bar dataKey="total" fill="#e2e8f0" radius={[6, 6, 0, 0]} barSize={36} />
        <Line type="monotone" dataKey="total" stroke="#002B5B" strokeWidth={2.5} dot={{ fill: "#002B5B", r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
