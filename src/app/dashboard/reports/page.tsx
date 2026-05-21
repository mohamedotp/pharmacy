"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Download, FileText, Calendar, Wallet, Receipt,
  TrendingUp, TrendingDown, User, CheckCircle2, Clock,
  RefreshCw, Package, ShoppingCart, Truck, Percent, Coins, DollarSign
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Bar, Line, ResponsiveContainer, ComposedChart,
  PieChart, Pie, Cell, Tooltip, XAxis
} from "recharts";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth-store";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";

const DATE_RANGES = [
  { label: "آخر 7 أيام", days: 7 },
  { label: "آخر 30 يوم", days: 30 },
  { label: "آخر 90 يوم", days: 90 },
  { label: "تاريخ مخصص", days: 0 },
];

const PIE_COLORS = ["#002B5B", "#3b82f6", "#bfdbfe"];

function fmt(n: number) {
  return n.toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function exportCSV(rows: any[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]).map(h => `"${h.replace(/"/g, '""')}"`).join(",");
  const body = rows.map(r => 
    Object.values(r).map(v => {
      const strVal = v === null || v === undefined ? "" : String(v);
      return `"${strVal.replace(/"/g, '""')}"`;
    }).join(",")
  ).join("\n");
  const blob = new Blob(["\uFEFF" + headers + "\n" + body], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const { user } = useAuthStore();
  const [rangeIdx, setRangeIdx] = useState(1);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");

  // Custom Date Range State
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().split("T")[0]);

  // Cashier Breakdown State
  const [cashierSales, setCashierSales] = useState<any[]>([]);

  // Delivery Stats State
  const [driverStats, setDriverStats] = useState<any[]>([]);

  // Monthly target
  const [monthlyTarget, setMonthlyTarget] = useState(50000);

  // KPIs
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [totalCogs, setTotalCogs] = useState(0);
  const [avgSale, setAvgSale] = useState(0);
  const [prevRevenue, setPrevRevenue] = useState(0);
  const [salesCount, setSalesCount] = useState(0);

  // Charts
  const [revenueChart, setRevenueChart] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [paymentDist, setPaymentDist] = useState<any[]>([]);

  // Inventory
  const [lowStock, setLowStock] = useState(0);
  const [totalProducts, setTotalProducts] = useState(0);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    let fromISO = "";
    let toISO = "";
    let diffDays = 30;

    if (rangeIdx === 3) {
      // Custom date range
      fromISO = new Date(customFrom + "T00:00:00").toISOString();
      toISO = new Date(customTo + "T23:59:59").toISOString();
      const diffTime = Math.abs(new Date(customTo).getTime() - new Date(customFrom).getTime());
      diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
    } else {
      diffDays = DATE_RANGES[rangeIdx].days;
      const now = new Date();
      const from = new Date(now);
      from.setDate(from.getDate() - diffDays);
      fromISO = from.toISOString();
    }

    const prevFrom = new Date(rangeIdx === 3 ? fromISO : new Date());
    prevFrom.setDate(prevFrom.getDate() - diffDays);
    const prevFromISO = prevFrom.toISOString();

    // Current period sales query
    let salesQuery = supabase
      .from("sales")
      .select(`
        id, total, subtotal, tax, discount, payment_method, created_at, invoice_number, cashier_id, delivery_id, delivery_fee, delivery_settled, cash_paid, visa_paid,
        cashier:users!sales_cashier_id_fkey(full_name, username)
      `);
    
    if (rangeIdx === 3) {
      salesQuery = salesQuery.gte("created_at", fromISO).lte("created_at", toISO);
    } else {
      salesQuery = salesQuery.gte("created_at", fromISO);
    }
    const { data: sales } = await salesQuery.order("created_at", { ascending: false });

    // Previous period for comparison
    const { data: prevSales } = await supabase
      .from("sales")
      .select("total")
      .gte("created_at", prevFromISO)
      .lt("created_at", fromISO);

    // Expenses
    let expQuery = supabase.from("expenses").select("amount");
    if (rangeIdx === 3) {
      expQuery = expQuery.gte("created_at", fromISO).lte("created_at", toISO);
    } else {
      expQuery = expQuery.gte("created_at", fromISO);
    }
    const { data: expenses } = await expQuery;

    // Top products via sale_items
    let itemsQuery = supabase
      .from("sale_items")
      .select("quantity, total_price, purchase_cost, product_id, products(name, purchase_price, category_id, categories:categories(name))");
    if (rangeIdx === 3) {
      itemsQuery = itemsQuery.gte("created_at", fromISO).lte("created_at", toISO);
    } else {
      itemsQuery = itemsQuery.gte("created_at", fromISO);
    }
    const { data: saleItems } = await itemsQuery;

    // Recent 5 sales
    const { data: recent } = await supabase
      .from("sales")
      .select("id, invoice_number, total, payment_method, created_at")
      .order("created_at", { ascending: false })
      .limit(5);

    // Inventory
    const { data: products } = await supabase
      .from("products")
      .select("id, stock_quantity, min_stock_alert");

    // ---------- Process KPIs ----------
    const rev = (sales || []).reduce((s, x) => s + Number(x.total), 0);
    const exp = (expenses || []).reduce((s, x) => s + Number(x.amount), 0);
    const prev = (prevSales || []).reduce((s, x) => s + Number(x.total), 0);
    
    // Calculate COGS with fallback to product purchase price * quantity
    const cogsVal = (saleItems || []).reduce((s: number, x: any) => {
      const cost = Number(x.purchase_cost);
      if (cost > 0) return s + cost;
      const fallbackCost = Number(x.products?.purchase_price || 0) * Number(x.quantity || 0);
      return s + fallbackCost;
    }, 0);
    
    setTotalRevenue(rev);
    setTotalExpenses(exp);
    setTotalCogs(cogsVal);
    setPrevRevenue(prev);
    setSalesCount((sales || []).length);
    setAvgSale((sales || []).length ? rev / (sales || []).length : 0);

    // ---------- Revenue chart (by day) ----------
    const grouped: Record<string, number> = {};
    (sales || []).forEach(s => {
      const d = new Date(s.created_at).toLocaleDateString("ar-EG", { day: "numeric", month: "numeric" });
      grouped[d] = (grouped[d] || 0) + Number(s.total);
    });
    setRevenueChart(Object.entries(grouped).slice(-14).map(([name, sales]) => ({ name, sales })));

    // ---------- Top products ----------
    const prodMap: Record<string, { name: string; category: string; qty: number; value: number }> = {};
    (saleItems || []).forEach((item: any) => {
      const pid = item.product_id;
      if (!prodMap[pid]) {
        prodMap[pid] = {
          name: item.products?.name || "—",
          category: item.products?.categories?.name || "—",
          qty: 0, value: 0
        };
      }
      prodMap[pid].qty += item.quantity;
      prodMap[pid].value += Number(item.total_price);
    });
    const sorted = Object.values(prodMap).sort((a, b) => b.value - a.value).slice(0, 5);
    const maxVal = sorted[0]?.value || 1;
    setTopProducts(sorted.map(p => ({ ...p, progress: Math.round((p.value / maxVal) * 100) })));

    // ---------- Recent sales ----------
    setRecentSales((recent || []).map(s => ({
      id: s.id,
      invoice: s.invoice_number,
      amount: Number(s.total),
      time: new Date(s.created_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }),
      method: s.payment_method,
    })));

    // ---------- Payment method distribution ----------
    const methods: Record<string, number> = {};
    (sales || []).forEach(s => {
      methods[s.payment_method] = (methods[s.payment_method] || 0) + 1;
    });
    const totalSalesN = (sales || []).length || 1;
    const methodLabels: Record<string, string> = { cash: "نقدي", visa: "بطاقة", mixed: "مختلط" };
    setPaymentDist(Object.entries(methods).map(([k, v], i) => ({
      name: methodLabels[k] || k,
      value: Math.round((v / totalSalesN) * 100),
      color: PIE_COLORS[i % PIE_COLORS.length]
    })));

    // ---------- Cashier Performance ----------
    const cashierMap: Record<string, { name: string; count: number; total: number }> = {};
    (sales || []).forEach((s: any) => {
      const name = s.cashier?.full_name || s.cashier?.username || "صيدلي غير معروف";
      const cid = s.cashier_id || "unknown";
      if (!cashierMap[cid]) {
        cashierMap[cid] = { name, count: 0, total: 0 };
      }
      cashierMap[cid].count += 1;
      cashierMap[cid].total += Number(s.total);
    });
    setCashierSales(Object.values(cashierMap).sort((a, b) => b.total - a.total));

    // ---------- Delivery Drivers Performance ----------
    // Fetch users to map drivers
    const { data: usersData } = await supabase
      .from('users')
      .select('id, full_name, role:roles(name)');
    const drivers = (usersData || []).filter((u: any) => {
      const roleArr = u.role as any;
      const roleName = Array.isArray(roleArr) ? roleArr[0]?.name : roleArr?.name;
      return roleName === 'delivery';
    });

    const driverMap: Record<string, { name: string; count: number; totalSales: number; totalFees: number; unsettledCount: number; unsettledCash: number }> = {};
    drivers.forEach((d: any) => {
      driverMap[d.id] = { name: d.full_name, count: 0, totalSales: 0, totalFees: 0, unsettledCount: 0, unsettledCash: 0 };
    });

    (sales || []).forEach((s: any) => {
      if (s.delivery_id) {
        const did = s.delivery_id;
        if (!driverMap[did]) {
          driverMap[did] = { name: "طيار غير معروف / سابق", count: 0, totalSales: 0, totalFees: 0, unsettledCount: 0, unsettledCash: 0 };
        }
        driverMap[did].count += 1;
        driverMap[did].totalSales += Number(s.total || 0);
        driverMap[did].totalFees += Number(s.delivery_fee || 0);
        if (!s.delivery_settled) {
          driverMap[did].unsettledCount += 1;
          if (s.payment_method === 'cash') {
            driverMap[did].unsettledCash += Number(s.total || 0);
          } else if (s.payment_method === 'mixed') {
            driverMap[did].unsettledCash += Number(s.cash_paid || 0);
          }
        }
      }
    });
    setDriverStats(Object.values(driverMap).sort((a, b) => b.totalSales - a.totalSales));

    // ---------- Inventory ----------
    const prods = products || [];
    setTotalProducts(prods.length);
    setLowStock(prods.filter(p => p.stock_quantity <= p.min_stock_alert).length);

    setLastUpdated(new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }));
    setLoading(false);
  }, [user, rangeIdx, customFrom, customTo]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const revenueChange = prevRevenue ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;
  const grossProfit = totalRevenue - totalCogs;
  const grossProfitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  const netProfit = grossProfit - totalExpenses;

  const handleExport = () => {
    const rangeLabel = rangeIdx === 3 ? `من ${customFrom} إلى ${customTo}` : DATE_RANGES[rangeIdx].label;
    
    let csvContent = "\uFEFF"; // UTF-8 BOM for Excel Arabic support
    
    // 1. Summary Block
    csvContent += `"ملخص التقرير المالي (${rangeLabel})"\n`;
    csvContent += `"إجمالي الإيرادات","تكلفة البضاعة المباعة (COGS)","إجمالي الربح","هامش الربح (%)","إجمالي المصروفات","صافي الربح الفعلي","متوسط قيمة الفاتورة","عدد الفواتير","تاريخ استخراج التقرير"\n`;
    csvContent += `"${totalRevenue.toFixed(2)}","${totalCogs.toFixed(2)}","${grossProfit.toFixed(2)}","${grossProfitMargin.toFixed(1)}%","${totalExpenses.toFixed(2)}","${netProfit.toFixed(2)}","${avgSale.toFixed(2)}","${salesCount}","${new Date().toLocaleDateString('ar-EG')}"\n\n`;
    
    // 2. Daily Sales Trend
    csvContent += `"حركة المبيعات اليومية"\n`;
    csvContent += `"اليوم","قيمة المبيعات (ج.م)"\n`;
    revenueChart.forEach(row => {
      csvContent += `"${row.name}","${(row.sales || 0).toFixed(2)}"\n`;
    });
    csvContent += "\n";
    
    // 3. Top Sold Products
    csvContent += `"أكثر المنتجات مبيعاً"\n`;
    csvContent += `"اسم المنتج","الفئة","الكمية المباعة","إجمالي القيمة (ج.م)"\n`;
    topProducts.forEach(p => {
      csvContent += `"${(p.name || '').replace(/"/g, '""')}","${(p.category || '').replace(/"/g, '""')}","${p.qty}","${(p.value || 0).toFixed(2)}"\n`;
    });
    csvContent += "\n";
    
    // 4. Cashier Performance
    csvContent += `"أداء الصيادلة والكاشير"\n`;
    csvContent += `"الاسم","عدد العمليات","إجمالي المبيعات (ج.م)"\n`;
    cashierSales.forEach(c => {
      csvContent += `"${(c.name || '').replace(/"/g, '""')}","${c.count}","${(c.total || 0).toFixed(2)}"\n`;
    });
    csvContent += "\n";

    // 5. Delivery Performance
    csvContent += `"أداء وتحليلات طياري التوصيل"\n`;
    csvContent += `"اسم الطيار","عدد التوصيلات","إجمالي قيمة الطلبات (ج.م)","إجمالي رسوم التوصيل (ج.م)","الكاش غير المصفي (ج.م)"\n`;
    driverStats.forEach(d => {
      csvContent += `"${(d.name || '').replace(/"/g, '""')}","${d.count}","${(d.totalSales || 0).toFixed(2)}","${(d.totalFees || 0).toFixed(2)}","${(d.unsettledCash || 0).toFixed(2)}"\n`;
    });
    
    // Download File
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `التقرير_الشامل_${rangeLabel.replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 pb-12" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-[#002B5B]">تحليلات الأداء والنمو</h1>
          <p className="text-slate-400 text-sm mt-1">
            {loading ? "جاري التحميل..." : `آخر تحديث: اليوم، ${lastUpdated}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap no-print">
          {DATE_RANGES.map((r, i) => (
            <Button
              key={i}
              onClick={() => setRangeIdx(i)}
              variant={rangeIdx === i ? "default" : "outline"}
              className={`text-xs h-9 px-4 rounded-xl font-bold transition-all ${rangeIdx === i ? "bg-[#002B5B] text-white shadow-md" : "bg-white border-slate-200 text-slate-600"}`}
            >
              <Calendar size={14} className="ml-1.5" />
              {r.label}
            </Button>
          ))}
          <Button onClick={fetchAll} variant="outline" size="icon" className="h-9 w-9 rounded-xl bg-white border-slate-200" disabled={loading}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
          <Button onClick={handleExport} variant="outline" size="icon" className="h-9 w-9 rounded-xl bg-white border-slate-200" title="تصدير CSV">
            <Download size={14} />
          </Button>
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl bg-white border-slate-200" title="طباعة" onClick={() => window.print()}>
            <FileText size={14} />
          </Button>
        </div>
      </div>

      {/* Custom Date Range Selection Bar */}
      {rangeIdx === 3 && (
        <div className="flex flex-wrap items-center gap-3 p-4 bg-white border border-slate-100 shadow-sm rounded-2xl no-print animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">من تاريخ:</span>
            <Input
              type="date"
              value={customFrom}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomFrom(e.target.value)}
              className="h-9 w-36 rounded-xl text-xs font-bold border-slate-200 focus:border-[#002B5B]"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">إلى تاريخ:</span>
            <Input
              type="date"
              value={customTo}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomTo(e.target.value)}
              className="h-9 w-36 rounded-xl text-xs font-bold border-slate-200 focus:border-[#002B5B]"
            />
          </div>
          <Button 
            onClick={fetchAll} 
            className="bg-[#002B5B] hover:bg-[#001f42] text-white h-9 px-4 rounded-xl text-xs font-bold"
            disabled={loading}
          >
            تطبيق الفلترة
          </Button>
        </div>
      )}

      {/* ===== Premium Odoo Financial KPI Summary Row ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Revenue Card */}
        <Card className="border border-slate-100 shadow-sm bg-white rounded-2xl overflow-hidden relative">
          <CardContent className="p-5 flex flex-col justify-between h-full min-h-[110px]">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-slate-400 mb-1">إجمالي المبيعات (الإيرادات)</p>
                <h3 className="text-xl font-extrabold text-slate-800">{fmt(totalRevenue)} <span className="text-[10px] text-slate-400">ج.م</span></h3>
              </div>
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                <Coins size={16} />
              </div>
            </div>
            <p className="text-[9px] text-slate-400 mt-2 font-normal">قيمة المبيعات الإجمالية</p>
          </CardContent>
        </Card>

        {/* COGS Card */}
        <Card className="border border-slate-100 shadow-sm bg-white rounded-2xl overflow-hidden relative">
          <CardContent className="p-5 flex flex-col justify-between h-full min-h-[110px]">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-slate-400 mb-1">تكلفة البضاعة المباعة (COGS)</p>
                <h3 className="text-xl font-extrabold text-slate-800">{fmt(totalCogs)} <span className="text-[10px] text-slate-400">ج.م</span></h3>
              </div>
              <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-500">
                <Package size={16} />
              </div>
            </div>
            <p className="text-[9px] text-slate-400 mt-2 font-normal">تكلفة الشراء الفعلية للكميات المباعة</p>
          </CardContent>
        </Card>

        {/* Gross Profit Card */}
        <Card className="border border-slate-100 shadow-sm bg-white rounded-2xl overflow-hidden relative">
          <CardContent className="p-5 flex flex-col justify-between h-full min-h-[110px]">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-slate-400 mb-1">إجمالي الربح (الهامش)</p>
                <h3 className="text-xl font-extrabold text-slate-800">{fmt(grossProfit)} <span className="text-[10px] text-slate-400">ج.م</span></h3>
              </div>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                <TrendingUp size={16} />
              </div>
            </div>
            <div className="mt-2">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 border border-emerald-100 text-emerald-600">
                {grossProfitMargin.toFixed(1)}% هامش الربح
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Expenses Card */}
        <Card className="border border-slate-100 shadow-sm bg-white rounded-2xl overflow-hidden relative">
          <CardContent className="p-5 flex flex-col justify-between h-full min-h-[110px]">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-slate-400 mb-1">المصروفات التشغيلية</p>
                <h3 className="text-xl font-extrabold text-slate-800">{fmt(totalExpenses)} <span className="text-[10px] text-slate-400">ج.م</span></h3>
              </div>
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
                <TrendingDown size={16} />
              </div>
            </div>
            <p className="text-[9px] text-slate-400 mt-2 font-normal">النفقات والرواتب والمصروفات الإضافية</p>
          </CardContent>
        </Card>

        {/* Net Profit Premium Card */}
        <Card className="border-0 shadow-md bg-gradient-to-br from-[#002B5B] to-[#001c3c] text-white overflow-hidden relative rounded-2xl">
          <div className="absolute -right-4 -bottom-4 text-white/5 pointer-events-none">
            <Wallet size={80} />
          </div>
          <CardContent className="p-5 flex flex-col justify-between h-full min-h-[110px]">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-white/70 mb-1">صافي الربح الفعلي</p>
                <h3 className="text-xl font-extrabold text-white">{fmt(netProfit)} <span className="text-[10px] text-white/70">ج.م</span></h3>
              </div>
              <div className="w-8 h-8 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center text-white">
                <Wallet size={16} />
              </div>
            </div>
            <p className="text-[9px] text-white/60 mt-2 font-medium">الربح الحقيقي بعد خصم البضاعة والمصاريف</p>
          </CardContent>
        </Card>
      </div>

      {/* Row 1: KPIs + Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6 flex flex-col">
          {/* Avg Sale */}
          <Card className="border-0 shadow-sm bg-white flex-1 rounded-2xl">
            <CardContent className="p-6 flex flex-col h-full justify-between min-h-[130px]">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-1">متوسط قيمة الفاتورة</p>
                  <h3 className="text-2xl font-black text-slate-800">{fmt(avgSale)} ج.م</h3>
                </div>
                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-[#002B5B]">
                  <Receipt size={18} />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-4">
                <div className="text-center">
                  <p className="text-lg font-black text-[#002B5B]">{salesCount}</p>
                  <p className="text-[10px] font-bold text-slate-400">فاتورة</p>
                </div>
                <div className="h-8 w-px bg-slate-100" />
                <div className={`flex items-center gap-1 text-xs font-bold ${revenueChange >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                  {revenueChange >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  <span>{Math.abs(revenueChange).toFixed(1)}% عن الفترة السابقة</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Operating Efficiency Card */}
          <Card className="border-0 shadow-sm bg-white flex-1 rounded-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-1.5 h-full bg-amber-500" />
            <CardContent className="p-6 flex flex-col h-full justify-between min-h-[130px]">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-1">الكفاءة ونسبة المصروفات</p>
                  <h3 className="text-2xl font-black text-slate-800">
                    {grossProfit > 0 ? ((totalExpenses / grossProfit) * 100).toFixed(1) : "0.0"}%
                  </h3>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-50/50 flex items-center justify-center text-amber-600">
                  <Percent size={18} />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-[10px] text-slate-400 leading-normal">
                  نسبة نفقات التشغيل إلى إجمالي أرباح البضاعة. كلما انخفضت كانت الكفاءة أعلى وصافي أرباحك أكبر.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Sales Target Card */}
          <Card className="border-0 shadow-sm bg-white flex-1 rounded-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-1.5 h-full bg-emerald-500" />
            <CardContent className="p-6 flex flex-col h-full justify-between min-h-[130px]">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 mb-1">هدف المبيعات الشهري</p>
                  <h3 className="text-2xl font-black text-slate-800">{fmt(monthlyTarget)} ج.م</h3>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <TrendingUp size={18} />
                </div>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-1">
                  <span>تم تحقيق: {monthlyTarget > 0 ? Math.round((totalRevenue / monthlyTarget) * 100) : 0}%</span>
                  <span>المتبقي: {fmt(Math.max(0, monthlyTarget - totalRevenue))} ج.م</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(100, monthlyTarget > 0 ? (totalRevenue / monthlyTarget) * 100 : 0)}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Revenue Chart */}
        <div className="lg:col-span-2">
          <Card className="border-0 shadow-sm bg-white h-full rounded-2xl">
            <CardContent className="p-8 flex flex-col h-full">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-xs font-bold text-[#002B5B] mb-1">إجمالي الإيرادات</p>
                  <h3 className="text-3xl font-black text-[#002B5B]">{fmt(totalRevenue)} ج.م</h3>
                  <div className={`flex items-center gap-1 text-xs font-bold mt-1 ${revenueChange >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                    {revenueChange >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    <span>{Math.abs(revenueChange).toFixed(1)}% منذ الفترة السابقة</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#002B5B]" />
                  المبيعات الفعلية
                </div>
              </div>
              <div className="h-[180px] w-full mt-auto">
                {revenueChart.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={revenueChart} margin={{ top: 10, right: 0, left: 0, bottom: 15 }}>
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} dy={8} />
                      <Tooltip formatter={(v: any) => [`${Number(v).toLocaleString()} ج.م`, "المبيعات"]} />
                      <Bar dataKey="sales" fill="#e2e8f0" radius={[4, 4, 0, 0]} barSize={32} />
                      <Line type="monotone" dataKey="sales" stroke="#002B5B" strokeWidth={3} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-300 text-sm font-bold">
                    لا توجد مبيعات في هذه الفترة
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Row 2: Inventory + Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Inventory */}
        <Card className="border-0 shadow-sm bg-white rounded-2xl">
          <CardContent className="p-6 flex flex-col h-full">
            <h3 className="text-sm font-black text-slate-800 mb-6">حالة المخزون</h3>
            <div className="space-y-5 mb-8">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-600">إجمالي المنتجات</span>
                <span className="px-3 py-1 rounded-lg text-[11px] font-bold bg-blue-50 text-[#002B5B]">{totalProducts} صنف</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-600">تحت الحد الأدنى</span>
                <span className={`px-3 py-1 rounded-lg text-[11px] font-bold ${lowStock > 0 ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}>
                  {lowStock} صنف
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-600">نسبة التغطية</span>
                <span className="px-3 py-1 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-600">
                  {totalProducts ? `${Math.round(((totalProducts - lowStock) / totalProducts) * 100)}%` : "—"}
                </span>
              </div>
            </div>
            <div className="mt-auto grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
              <div className="text-center">
                <div className="w-12 h-12 bg-[#002B5B]/5 rounded-xl flex items-center justify-center mx-auto mb-2">
                  <Package size={20} className="text-[#002B5B]" />
                </div>
                <p className="text-lg font-black text-[#002B5B]">{totalProducts}</p>
                <p className="text-[10px] font-bold text-slate-400">إجمالي الأصناف</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center mx-auto mb-2">
                  <ShoppingCart size={20} className="text-rose-500" />
                </div>
                <p className="text-lg font-black text-rose-500">{lowStock}</p>
                <p className="text-[10px] font-bold text-slate-400">يحتاج توريد</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Products */}
        <div className="lg:col-span-2">
          <Card className="border-0 shadow-sm bg-white rounded-2xl">
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-sm font-black text-slate-800">أكثر المنتجات مبيعاً</h3>
                <span className="text-[10px] font-bold text-slate-400">{DATE_RANGES[rangeIdx].label}</span>
              </div>
              {loading ? (
                <div className="h-40 flex items-center justify-center text-slate-300 text-sm">جاري التحميل...</div>
              ) : topProducts.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-slate-300 text-sm font-bold">لا توجد مبيعات في هذه الفترة</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="pb-3 text-[10px] font-bold text-slate-400 w-2/5">المنتج</th>
                        <th className="pb-3 text-[10px] font-bold text-slate-400 text-center">الفئة</th>
                        <th className="pb-3 text-[10px] font-bold text-slate-400 text-center">الكمية</th>
                        <th className="pb-3 text-[10px] font-bold text-slate-400 text-center">القيمة</th>
                        <th className="pb-3 text-[10px] font-bold text-slate-400 text-left pl-2">الأداء</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topProducts.map((p, i) => (
                        <tr key={i} className="border-b border-slate-50 last:border-0">
                          <td className="py-4 font-black text-xs text-slate-800 truncate max-w-[140px]">{p.name}</td>
                          <td className="py-4 text-[10px] font-bold text-slate-500 text-center">{p.category}</td>
                          <td className="py-4 text-[10px] font-bold text-slate-700 text-center">{p.qty}</td>
                          <td className="py-4 text-[10px] font-black text-slate-800 text-center">{p.value.toFixed(0)} ج.م</td>
                          <td className="py-4 pl-2">
                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden mr-auto">
                              <div
                                className={`h-full rounded-full ${i === 0 ? "bg-emerald-500" : i === 1 ? "bg-[#002B5B]" : "bg-slate-400"}`}
                                style={{ width: `${p.progress}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Row 3: Payment Dist + Recent Sales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Distribution */}
        <Card className="border-0 shadow-sm bg-white rounded-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-1.5 h-full bg-slate-400" />
          <CardContent className="p-8">
            <h3 className="text-sm font-black text-slate-800 mb-6">توزيع طرق الدفع</h3>
            {paymentDist.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-slate-300 text-sm font-bold">
                {loading ? "جاري التحميل..." : "لا توجد بيانات"}
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="w-44 h-44 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={paymentDist} cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={3} dataKey="value" stroke="none">
                        {paymentDist.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-black text-[#002B5B]">{salesCount}</span>
                    <span className="text-[10px] font-bold text-slate-400">فاتورة</span>
                  </div>
                </div>
                <div className="space-y-4 pr-4">
                  {paymentDist.map((item, i) => (
                    <div key={i} className="flex items-center justify-between gap-6">
                      <span className="text-sm font-black text-slate-800">{item.value}%</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500">{item.name}</span>
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Sales */}
        <Card className="border-0 shadow-sm bg-white rounded-2xl">
          <CardContent className="p-8">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-sm font-black text-slate-800">آخر المبيعات</h3>
            </div>
            {loading ? (
              <div className="h-40 flex items-center justify-center text-slate-300 text-sm">جاري التحميل...</div>
            ) : recentSales.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-slate-300 text-sm font-bold">لا توجد مبيعات</div>
            ) : (
              <div className="space-y-3">
                {recentSales.map((sale) => (
                  <div key={sale.id} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-[#002B5B] shadow-sm">
                        <User size={16} />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-800">{sale.invoice}</h4>
                        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 mt-0.5">
                          <Clock size={10} />
                          <span>{sale.time}</span>
                          <span className="w-1 h-1 rounded-full bg-slate-300 mx-1" />
                          <span>{{cash:"نقدي",visa:"بطاقة",mixed:"مختلط"}[sale.method as string] || sale.method}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-left">
                      <h4 className="text-sm font-black text-[#002B5B]">{fmt(sale.amount)} ج.م</h4>
                      <div className="flex items-center justify-end gap-1 text-[10px] font-bold text-emerald-500 mt-0.5">
                        <CheckCircle2 size={10} />
                        <span>مكتمل</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 4: Cashier Performance */}
      <Card className="border-0 shadow-sm bg-white rounded-2xl overflow-hidden">
        <CardContent className="p-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-sm font-black text-slate-800">مبيعات الصيادلة والموظفين (الكاشير)</h3>
              <p className="text-xs text-slate-400 mt-1">تتبع أداء العمليات ونسب المبيعات المحققة بواسطة كل موظف في الفترة المحددة</p>
            </div>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-lg border border-slate-100">{DATE_RANGES[rangeIdx].label}</span>
          </div>
          {cashierSales.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-slate-300 text-sm font-bold">لا توجد عمليات مبيعات مسجلة في هذه الفترة</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="text-right">اسم الموظف / الصيدلي</TableHead>
                    <TableHead className="text-center">عدد العمليات (الفواتير)</TableHead>
                    <TableHead className="text-center">إجمالي قيمة المبيعات</TableHead>
                    <TableHead className="text-center">متوسط قيمة البيع</TableHead>
                    <TableHead className="text-left pl-4">النسبة من إجمالي المبيعات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cashierSales.map((c, i) => {
                    const percentage = totalRevenue > 0 ? Math.round((c.total / totalRevenue) * 100) : 0;
                    return (
                      <TableRow key={i} className="hover:bg-slate-50/50">
                        <TableCell className="font-bold text-slate-800 flex items-center gap-2 py-4">
                          <div className="w-8 h-8 rounded-full bg-blue-50 text-[#002B5B] flex items-center justify-center font-bold text-xs">
                            {c.name.substring(0, 2)}
                          </div>
                          {c.name}
                        </TableCell>
                        <TableCell className="text-center font-bold text-slate-700">{c.count} فاتورة</TableCell>
                        <TableCell className="text-center font-black text-emerald-600">{fmt(c.total)} ج.م</TableCell>
                        <TableCell className="text-center font-bold text-slate-600">{fmt(c.count > 0 ? c.total / c.count : 0)} ج.م</TableCell>
                        <TableCell className="pl-4">
                          <div className="flex items-center gap-3 justify-end">
                            <span className="text-xs font-bold text-slate-500">{percentage}%</span>
                            <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-[#002B5B] rounded-full transition-all duration-75"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Row 5: Delivery Drivers Performance */}
      <Card className="border-0 shadow-sm bg-white rounded-2xl overflow-hidden mt-6">
        <CardContent className="p-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <Truck size={18} className="text-[#002B5B]" />
                أداء وتحليلات طياري التوصيل
              </h3>
              <p className="text-xs text-slate-400 mt-1">متابعة عدد الطلبات الموصلة، إجمالي رسوم التوصيل، والكاش المعلق بذمة كل طيار في الفترة المحددة</p>
            </div>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-lg border border-slate-100">{DATE_RANGES[rangeIdx].label}</span>
          </div>
          
          {/* Summary KPIs for Delivery */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 mb-1">إجمالي التوصيلات</p>
              <h4 className="text-lg font-black text-slate-700">
                {driverStats.reduce((sum, d) => sum + d.count, 0)} طلب
              </h4>
            </div>
            <div className="bg-emerald-50/40 p-4 rounded-xl border border-emerald-100/50">
              <p className="text-[10px] font-bold text-emerald-600 mb-1">إجمالي رسوم التوصيل المحققة</p>
              <h4 className="text-lg font-black text-emerald-600">
                {fmt(driverStats.reduce((sum, d) => sum + d.totalFees, 0))} ج.م
              </h4>
            </div>
            <div className="bg-rose-50/40 p-4 rounded-xl border border-rose-100/50">
              <p className="text-[10px] font-bold text-rose-600 mb-1">إجمالي كاش معلق بذمة الطيارين</p>
              <h4 className="text-lg font-black text-rose-600">
                {fmt(driverStats.reduce((sum, d) => sum + d.unsettledCash, 0))} ج.م
              </h4>
            </div>
          </div>

          {driverStats.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-slate-300 text-sm font-bold">لا توجد عمليات توصيل مسجلة في هذه الفترة</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="text-right">اسم الطيار</TableHead>
                    <TableHead className="text-center">عدد التوصيلات (الأوردرات)</TableHead>
                    <TableHead className="text-center">قيمة الطلبات الموصلة</TableHead>
                    <TableHead className="text-center">رسوم التوصيل</TableHead>
                    <TableHead className="text-center">الكاش المعلق (غير المصفي)</TableHead>
                    <TableHead className="text-left pl-4">النسبة من إجمالي الطلبات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {driverStats.map((d, i) => {
                    const totalDeliveries = driverStats.reduce((sum, x) => sum + x.count, 0) || 1;
                    const percentage = Math.round((d.count / totalDeliveries) * 100);
                    return (
                      <TableRow key={i} className="hover:bg-slate-50/50">
                        <TableCell className="font-bold text-slate-800 flex items-center gap-2 py-4">
                          <div className="w-8 h-8 rounded-full bg-slate-100 text-[#002B5B] flex items-center justify-center font-bold text-xs">
                            {d.name.substring(0, 1)}
                          </div>
                          {d.name}
                        </TableCell>
                        <TableCell className="text-center font-bold text-slate-700">{d.count} طلب</TableCell>
                        <TableCell className="text-center font-bold text-slate-700">{fmt(d.totalSales)} ج.م</TableCell>
                        <TableCell className="text-center font-black text-emerald-600">{fmt(d.totalFees)} ج.م</TableCell>
                        <TableCell className="text-center">
                          <span className={`px-2.5 py-1 rounded-full font-bold text-xs ${
                            d.unsettledCash > 0 
                              ? 'bg-rose-50 text-rose-600 border border-rose-100' 
                              : 'bg-slate-50 text-slate-400'
                          }`}>
                            {fmt(d.unsettledCash)}.م
                          </span>
                        </TableCell>
                        <TableCell className="pl-4">
                          <div className="flex items-center gap-3 justify-end">
                            <span className="text-xs font-bold text-slate-500">{percentage}%</span>
                            <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-[#002B5B] rounded-full transition-all duration-75"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Print Stylesheet */}
      <style>{`
        @media print {
          aside, nav, header, button, .no-print, .bg-slate-50, .shadow-sm {
            display: none !important;
            box-shadow: none !important;
          }
          body, main, .space-y-6 {
            background: white !important;
            color: black !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .grid {
            display: block !important;
          }
          .card {
            border: 1px solid #e2e8f0 !important;
            margin-bottom: 1.5rem !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  );
}
