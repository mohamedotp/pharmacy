"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SalesChart } from "@/components/dashboard/sales-chart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Eye, ShoppingCart, AlertTriangle, Clock, TrendingUp, TrendingDown,
  Package, Wallet, RefreshCw, Receipt, Users, ArrowLeft
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth-store";
import Link from "next/link";

function fmt(n: number) {
  return n.toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const CHART_RANGES = [
  { label: "7 أيام", days: 7 },
  { label: "14 يوم", days: 14 },
  { label: "30 يوم", days: 30 },
];

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [chartRange, setChartRange] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");

  // KPIs
  const [todayRevenue, setTodayRevenue] = useState(0);
  const [todaySalesCount, setTodaySalesCount] = useState(0);
  const [yesterdayRevenue, setYesterdayRevenue] = useState(0);
  const [monthRevenue, setMonthRevenue] = useState(0);
  const [monthExpenses, setMonthExpenses] = useState(0);
  const [totalPatients, setTotalPatients] = useState(0);

  // Invoice Details Modal State
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [invoiceItems, setInvoiceItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const handleViewInvoice = async (invoice: any) => {
    setSelectedInvoice(invoice);
    setIsInvoiceModalOpen(true);
    setLoadingItems(true);
    try {
      const { data, error } = await supabase
        .from("sale_items")
        .select(`
          id,
          quantity,
          unit_price,
          total_price,
          products (
            name
          )
        `)
        .eq("sale_id", invoice.id);
      if (!error && data) {
        setInvoiceItems(data);
      } else {
        setInvoiceItems([]);
      }
    } catch (err) {
      console.error("Failed to fetch sale items:", err);
      setInvoiceItems([]);
    } finally {
      setLoadingItems(false);
    }
  };

  // Lists
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [expiringBatches, setExpiringBatches] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const in30Days = new Date(); in30Days.setDate(in30Days.getDate() + 30);

    const [
      { data: todaySales },
      { data: yesterdaySales },
      { data: monthSales },
      { data: expenses },
      { data: allProducts },
      { data: recent },
      { data: batches },
      { data: patients },
      { data: saleItems },
    ] = await Promise.all([
      supabase.from("sales").select("total").gte("created_at", todayStart.toISOString()),
      supabase.from("sales").select("total").gte("created_at", yesterdayStart.toISOString()).lt("created_at", todayStart.toISOString()),
      supabase.from("sales").select("total").gte("created_at", monthStart.toISOString()),
      supabase.from("expenses").select("amount").gte("created_at", monthStart.toISOString()),
      supabase.from("products").select("id, name, barcode, stock_quantity, min_stock_alert"),
      supabase.from("sales").select("id, invoice_number, total, payment_method, created_at").order("created_at", { ascending: false }).limit(8),
      supabase.from("product_batches").select("*, products(name)").lte("expiry_date", in30Days.toISOString().split("T")[0]).order("expiry_date").limit(5),
      supabase.from("patients").select("id"),
      supabase.from("sale_items").select("quantity, total_price, product_id, products(name)").gte("created_at", monthStart.toISOString()),
    ]);

    // KPIs
    const tRev = (todaySales || []).reduce((s, x) => s + Number(x.total), 0);
    const yRev = (yesterdaySales || []).reduce((s, x) => s + Number(x.total), 0);
    const mRev = (monthSales || []).reduce((s, x) => s + Number(x.total), 0);
    const mExp = (expenses || []).reduce((s, x) => s + Number(x.amount), 0);
    setTodayRevenue(tRev);
    setTodaySalesCount((todaySales || []).length);
    setYesterdayRevenue(yRev);
    setMonthRevenue(mRev);
    setMonthExpenses(mExp);
    setTotalPatients((patients || []).length);

    // Low stock
    const low = (allProducts || []).filter(p => p.stock_quantity <= p.min_stock_alert);
    setLowStockProducts(low.slice(0, 4));

    // Recent sales
    setRecentSales(recent || []);

    // Expiring batches
    setExpiringBatches(batches || []);

    // Top products this month
    const prodMap: Record<string, { name: string; qty: number; value: number }> = {};
    (saleItems || []).forEach((item: any) => {
      const pid = item.product_id;
      if (!prodMap[pid]) prodMap[pid] = { name: item.products?.name || "—", qty: 0, value: 0 };
      prodMap[pid].qty += item.quantity;
      prodMap[pid].value += Number(item.total_price);
    });
    const sorted = Object.values(prodMap).sort((a, b) => b.qty - a.qty).slice(0, 4);
    const maxQty = sorted[0]?.qty || 1;
    setTopProducts(sorted.map(p => ({ ...p, pct: Math.round((p.qty / maxQty) * 100) })));

    setLastUpdated(new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" }));
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const todayChange = yesterdayRevenue > 0 ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 : 0;
  const netProfit = monthRevenue - monthExpenses;
  const lowStockCount = lowStockProducts.length;

  return (
    <div className="space-y-6 pb-8" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-[#002B5B]">لوحة التحكم</h1>
          <p className="text-slate-400 text-xs mt-0.5">
            {loading ? "جاري التحميل..." : `آخر تحديث: ${lastUpdated}`}
          </p>
        </div>
        <Button
          onClick={fetchAll}
          variant="outline"
          className="self-start sm:self-auto gap-2 text-xs font-bold rounded-xl h-9 px-4 bg-white border-slate-200"
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          تحديث
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today Revenue */}
        <Card className="border-0 shadow-sm bg-white rounded-2xl overflow-hidden relative">
          <div className="absolute top-0 right-0 w-1 h-full bg-[#002B5B]" />
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs font-bold text-slate-500">إيرادات اليوم</p>
              <div className="w-8 h-8 bg-[#002B5B]/10 rounded-lg flex items-center justify-center">
                <TrendingUp size={15} className="text-[#002B5B]" />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-800">{fmt(todayRevenue)}</p>
            <p className="text-[10px] text-slate-400 font-bold mt-0.5">ج.م</p>
            <div className={`flex items-center gap-1 text-[11px] font-bold mt-2 ${todayChange >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
              {todayChange >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              <span>{Math.abs(todayChange).toFixed(1)}% عن أمس</span>
            </div>
          </CardContent>
        </Card>

        {/* Today Sales Count */}
        <Card className="border-0 shadow-sm bg-white rounded-2xl overflow-hidden relative">
          <div className="absolute top-0 right-0 w-1 h-full bg-blue-400" />
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs font-bold text-slate-500">مبيعات اليوم</p>
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                <ShoppingCart size={15} className="text-blue-500" />
              </div>
            </div>
            <p className="text-2xl font-black text-slate-800">{todaySalesCount}</p>
            <p className="text-[10px] text-slate-400 font-bold mt-0.5">فاتورة</p>
            <p className="text-[11px] font-bold text-slate-400 mt-2">
              متوسط: {todaySalesCount ? fmt(todayRevenue / todaySalesCount) : "0.00"} ج.م
            </p>
          </CardContent>
        </Card>

        {/* Net Profit */}
        <Card className="border-0 shadow-sm bg-white rounded-2xl overflow-hidden relative">
          <div className="absolute top-0 right-0 w-1 h-full bg-emerald-400" />
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs font-bold text-slate-500">صافي الربح (الشهر)</p>
              <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                <Wallet size={15} className="text-emerald-500" />
              </div>
            </div>
            <p className={`text-2xl font-black ${netProfit >= 0 ? "text-slate-800" : "text-rose-600"}`}>
              {fmt(Math.abs(netProfit))}
            </p>
            <p className="text-[10px] text-slate-400 font-bold mt-0.5">ج.م</p>
            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
              <div
                className="bg-emerald-400 h-full rounded-full"
                style={{ width: monthRevenue > 0 ? `${Math.min(100, (netProfit / monthRevenue) * 100)}%` : "0%" }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Low Stock Alert */}
        <Card className={`border-0 shadow-sm rounded-2xl overflow-hidden relative ${lowStockCount > 0 ? "bg-rose-50" : "bg-white"}`}>
          <div className={`absolute top-0 right-0 w-1 h-full ${lowStockCount > 0 ? "bg-rose-500" : "bg-slate-200"}`} />
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs font-bold text-slate-500">مخزون منخفض</p>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${lowStockCount > 0 ? "bg-rose-100" : "bg-slate-100"}`}>
                <AlertTriangle size={15} className={lowStockCount > 0 ? "text-rose-500" : "text-slate-400"} />
              </div>
            </div>
            <p className={`text-2xl font-black ${lowStockCount > 0 ? "text-rose-600" : "text-slate-800"}`}>{lowStockCount}</p>
            <p className="text-[10px] text-slate-400 font-bold mt-0.5">صنف</p>
            {lowStockCount > 0 ? (
              <Badge className="mt-2 bg-rose-100 text-rose-600 hover:bg-rose-100 border-0 text-[10px] font-bold">يحتاج توريد</Badge>
            ) : (
              <p className="text-[11px] font-bold text-emerald-500 mt-2">المخزون جيد ✓</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/dashboard/pos">
          <Card className="border-0 shadow-sm bg-gradient-to-br from-blue-50 to-blue-100/30 hover:bg-gradient-to-br hover:from-blue-100 hover:to-blue-200/30 transition-all rounded-2xl cursor-pointer p-4 group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-110 transition-transform">
                <ShoppingCart size={18} />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-800">نقطة البيع (POS)</h3>
                <p className="text-[10px] text-slate-500 font-bold mt-0.5">فتح شاشة بيع جديدة</p>
              </div>
            </div>
          </Card>
        </Link>

        <Link href="/dashboard/inventory">
          <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100/30 hover:bg-gradient-to-br hover:from-amber-100 hover:to-amber-200/30 transition-all rounded-2xl cursor-pointer p-4 group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-white shadow-md shadow-amber-500/20 group-hover:scale-110 transition-transform">
                <Package size={18} />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-800">المخزون والمنتجات</h3>
                <p className="text-[10px] text-slate-500 font-bold mt-0.5">إضافة وإدارة الأدوية</p>
              </div>
            </div>
          </Card>
        </Link>

        <Link href="/dashboard/patients">
          <Card className="border-0 shadow-sm bg-gradient-to-br from-purple-50 to-purple-100/30 hover:bg-gradient-to-br hover:from-purple-100 hover:to-purple-200/30 transition-all rounded-2xl cursor-pointer p-4 group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500 rounded-xl flex items-center justify-center text-white shadow-md shadow-purple-500/20 group-hover:scale-110 transition-transform">
                <Users size={18} />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-800">سجلات المرضى</h3>
                <p className="text-[10px] text-slate-500 font-bold mt-0.5">الملفات والولاء والتنبيهات</p>
              </div>
            </div>
          </Card>
        </Link>

        <Link href="/dashboard/reports">
          <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100/30 hover:bg-gradient-to-br hover:from-emerald-100 hover:to-emerald-200/30 transition-all rounded-2xl cursor-pointer p-4 group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-md shadow-emerald-500/20 group-hover:scale-110 transition-transform">
                <Receipt size={18} />
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-800">التقارير المالية</h3>
                <p className="text-[10px] text-slate-500 font-bold mt-0.5">تحليل المبيعات والأرباح</p>
              </div>
            </div>
          </Card>
        </Link>
      </div>

      {/* Row 2: Chart + Side Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Chart */}
        <Card className="lg:col-span-2 border-0 shadow-sm bg-white rounded-2xl">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="text-base font-black text-slate-800">تحليل المبيعات والنمو</h2>
                <p className="text-xs text-slate-400 font-bold mt-0.5">
                  إجمالي الشهر: {fmt(monthRevenue)} ج.م
                </p>
              </div>
              <div className="flex gap-1.5">
                {CHART_RANGES.map((r, i) => (
                  <Button
                    key={i}
                    onClick={() => setChartRange(i)}
                    variant={chartRange === i ? "default" : "outline"}
                    className={`text-[11px] font-bold h-8 px-3 rounded-lg ${chartRange === i ? "bg-[#002B5B] text-white" : "bg-slate-50 border-slate-200 text-slate-600"}`}
                  >
                    {r.label}
                  </Button>
                ))}
              </div>
            </div>
            <SalesChart days={CHART_RANGES[chartRange].days} />
          </CardContent>
        </Card>

        {/* Side Column */}
        <div className="space-y-4">
          {/* Quick Stats */}
          <Card className="border-0 shadow-sm bg-white rounded-2xl">
            <CardContent className="p-5 space-y-4">
              <h3 className="text-sm font-black text-slate-800">ملخص سريع</h3>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
                    <Users size={14} className="text-purple-500" />
                  </div>
                  <span className="text-xs font-bold text-slate-600">إجمالي المرضى</span>
                </div>
                <span className="text-sm font-black text-[#002B5B]">{totalPatients}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
                    <Package size={14} className="text-amber-500" />
                  </div>
                  <span className="text-xs font-bold text-slate-600">مصروفات الشهر</span>
                </div>
                <span className="text-sm font-black text-amber-600">{fmt(monthExpenses)} ج.م</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                    <Receipt size={14} className="text-emerald-500" />
                  </div>
                  <span className="text-xs font-bold text-slate-600">إيرادات الشهر</span>
                </div>
                <span className="text-sm font-black text-emerald-600">{fmt(monthRevenue)} ج.م</span>
              </div>
            </CardContent>
          </Card>

          {/* Low Stock Alert */}
          <Card className="border-0 shadow-sm bg-white rounded-2xl">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black text-rose-600 flex items-center gap-1.5">
                  <AlertTriangle size={15} /> نواقص المخزون
                </h3>
                <Link href="/dashboard/inventory" className="text-[11px] font-bold text-[#002B5B] hover:underline flex items-center gap-0.5">
                  عرض الكل <ArrowLeft size={11} />
                </Link>
              </div>
              <div className="space-y-3">
                {lowStockProducts.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-3 font-bold">لا توجد نواقص حالياً ✓</p>
                ) : lowStockProducts.map((p, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-slate-50 pb-3 last:border-0 last:pb-0">
                    <div>
                      <p className="font-black text-xs text-slate-800 leading-tight">{p.name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-bold">{p.barcode}</p>
                    </div>
                    <div className="text-left">
                      <p className="font-black text-sm text-rose-600">{p.stock_quantity}</p>
                      <p className="text-[10px] text-slate-400 font-bold">/ {p.min_stock_alert}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Expiry Alerts */}
          <Card className="border-0 shadow-sm bg-white rounded-2xl">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black text-amber-600 flex items-center gap-1.5">
                  <Clock size={15} /> قرب انتهاء الصلاحية
                </h3>
              </div>
              <div className="space-y-3">
                {expiringBatches.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-3 font-bold">لا توجد تنبيهات</p>
                ) : expiringBatches.slice(0, 3).map((batch, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div>
                      <p className="font-black text-xs text-slate-800">{batch.products?.name}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-bold">
                        {new Date(batch.expiry_date).toLocaleDateString("ar-EG")}
                      </p>
                    </div>
                    <Badge className="bg-amber-50 text-amber-600 hover:bg-amber-50 border-0 text-[10px] font-bold">قريب</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Row 3: Top Products + Recent Sales */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Products */}
        <Card className="border-0 shadow-sm bg-white rounded-2xl">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-black text-slate-800">أكثر مبيعاً هذا الشهر</h3>
            </div>
            {topProducts.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6 font-bold">لا توجد مبيعات بعد</p>
            ) : (
              <div className="space-y-4">
                {topProducts.map((p, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-[#002B5B]/10 flex items-center justify-center text-[10px] font-black text-[#002B5B]">{i + 1}</div>
                        <span className="text-xs font-bold text-slate-700 truncate max-w-[130px]">{p.name}</span>
                      </div>
                      <span className="text-[11px] font-black text-[#002B5B]">{p.qty} وحدة</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${i === 0 ? "bg-emerald-500" : i === 1 ? "bg-[#002B5B]" : i === 2 ? "bg-blue-400" : "bg-slate-400"}`}
                        style={{ width: `${p.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Invoices */}
        <div className="lg:col-span-2">
          <Card className="border-0 shadow-sm bg-white rounded-2xl">
            <CardContent className="p-0">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <h3 className="text-sm font-black text-slate-800">أحدث الفواتير</h3>
                <Link href="/dashboard/sales" className="text-xs font-bold text-[#002B5B] hover:underline flex items-center gap-1">
                  عرض الكل <ArrowLeft size={12} />
                </Link>
              </div>
              <Table>
                <TableHeader className="bg-slate-50/60">
                  <TableRow>
                    <TableHead className="text-right text-[11px] font-bold text-slate-500">رقم الفاتورة</TableHead>
                    <TableHead className="text-right text-[11px] font-bold text-slate-500">الوقت</TableHead>
                    <TableHead className="text-right text-[11px] font-bold text-slate-500">الإجمالي</TableHead>
                    <TableHead className="text-right text-[11px] font-bold text-slate-500">الدفع</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentSales.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-slate-400 text-sm font-bold">
                        {loading ? "جاري التحميل..." : "لا توجد فواتير اليوم"}
                      </TableCell>
                    </TableRow>
                  ) : recentSales.map((inv) => (
                    <TableRow key={inv.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-black text-xs text-[#002B5B] font-mono">{inv.invoice_number}</TableCell>
                      <TableCell className="text-xs text-slate-500 font-bold">
                        {new Date(inv.created_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                      </TableCell>
                      <TableCell className="font-black text-xs text-slate-800">{fmt(Number(inv.total))} ج.م</TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          inv.payment_method === "cash" ? "bg-emerald-50 text-emerald-600" :
                          inv.payment_method === "visa" ? "bg-blue-50 text-blue-600" :
                          "bg-purple-50 text-purple-600"
                        }`}>
                          {inv.payment_method === "cash" ? "نقدي" : inv.payment_method === "visa" ? "بطاقة" : "مختلط"}
                        </span>
                      </TableCell>
                      <TableCell className="text-left">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 text-slate-400 hover:text-[#002B5B]"
                          onClick={() => handleViewInvoice(inv)}
                        >
                          <Eye size={15} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Invoice Details Modal */}
      <Dialog open={isInvoiceModalOpen} onOpenChange={setIsInvoiceModalOpen}>
        <DialogContent className="sm:max-w-[550px] p-6 rounded-2xl" dir="rtl">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <DialogTitle className="text-base font-black text-slate-800 flex items-center justify-between">
              <span>تفاصيل الفاتورة</span>
              <span className="text-xs font-mono font-black text-[#002B5B] bg-slate-100 px-2.5 py-1 rounded-full">
                #{selectedInvoice?.invoice_number}
              </span>
            </DialogTitle>
          </DialogHeader>

          {selectedInvoice && (
            <div className="space-y-5 pt-3">
              {/* Header metadata */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 font-bold block mb-1">تاريخ ووقت البيع</span>
                  <span className="font-bold text-slate-700">
                    {new Date(selectedInvoice.created_at).toLocaleString("ar-EG")}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block mb-1">طريقة الدفع</span>
                  <span className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                    selectedInvoice.payment_method === "cash" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                    selectedInvoice.payment_method === "visa" ? "bg-blue-50 text-blue-600 border border-blue-100" :
                    "bg-purple-50 text-purple-600 border border-purple-100"
                  }`}>
                    {selectedInvoice.payment_method === "cash" ? "نقدي (Cash)" : selectedInvoice.payment_method === "visa" ? "بطاقة (Visa)" : "دفع مختلط"}
                  </span>
                </div>
              </div>

              {/* Items List */}
              <div>
                <h4 className="text-xs font-black text-slate-500 mb-2">المنتجات المباعة</h4>
                {loadingItems ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="w-5 h-5 border-2 border-[#002B5B] border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : invoiceItems.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4 font-bold">لا توجد منتجات مسجلة في هذه الفاتورة</p>
                ) : (
                  <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm bg-white">
                    <Table>
                      <TableHeader className="bg-slate-50/50">
                        <TableRow className="hover:bg-transparent border-b border-slate-100">
                          <TableHead className="text-right text-[11px] font-bold py-2">اسم الصنف</TableHead>
                          <TableHead className="text-center text-[11px] font-bold py-2">الكمية</TableHead>
                          <TableHead className="text-left text-[11px] font-bold py-2">سعر الوحدة</TableHead>
                          <TableHead className="text-left text-[11px] font-bold py-2">الإجمالي</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoiceItems.map((item) => (
                          <TableRow key={item.id} className="hover:bg-slate-50/20 border-b border-slate-50 last:border-0">
                            <TableCell className="font-bold text-xs text-slate-700 py-2.5">{item.products?.name || "—"}</TableCell>
                            <TableCell className="text-center font-bold text-xs text-slate-600 py-2.5">{item.quantity}</TableCell>
                            <TableCell className="text-left font-bold text-xs text-slate-500 py-2.5 font-mono">{fmt(Number(item.unit_price))} ج.م</TableCell>
                            <TableCell className="text-left font-black text-xs text-slate-800 py-2.5 font-mono">{fmt(Number(item.total_price))} ج.م</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {/* Total Summary */}
              <div className="border-t border-slate-100 pt-4 flex flex-col gap-2 text-xs">
                <div className="flex justify-between font-bold text-slate-500">
                  <span>إجمالي المنتجات:</span>
                  <span className="font-mono">{fmt(Number(selectedInvoice.total) + (Number(selectedInvoice.discount) || 0))} ج.م</span>
                </div>
                {Number(selectedInvoice.discount) > 0 && (
                  <div className="flex justify-between font-bold text-rose-600">
                    <span>قيمة الخصم:</span>
                    <span className="font-mono">-{fmt(Number(selectedInvoice.discount))} ج.م</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-slate-800 text-sm border-t border-dashed border-slate-100 pt-2">
                  <span>المبلغ المدفوع النهائي:</span>
                  <span className="text-[#002B5B] font-mono text-base">{fmt(Number(selectedInvoice.total))} ج.م</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
