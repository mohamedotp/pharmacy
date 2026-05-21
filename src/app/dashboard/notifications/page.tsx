"use client";

import { useEffect, useState, useCallback } from "react";
import {
  AlertTriangle, Package, Clock, RefreshCw, ChevronDown, ChevronUp,
  ShoppingCart, TrendingDown, CalendarX2, Bell, CheckCircle2, Filter, X
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth-store";
import Link from "next/link";

type LowStockProduct = {
  id: string;
  name: string;
  barcode: string;
  stock_quantity: number;
  min_stock_alert: number;
  selling_price: number;
  category_name?: string;
};

type ExpiringBatch = {
  id: string;
  batch_number: string;
  expiry_date: string;
  quantity: number;
  daysLeft: number;
  product_id: string;
  product_name: string;
  product_barcode: string;
};

type FilterTab = "all" | "low_stock" | "expiring";

export default function NotificationsPage() {
  const { pharmacy, user } = useAuthStore();
  const pharmacyId = pharmacy?.id ?? user?.pharmacy?.id;

  const [lowStockProducts, setLowStockProducts] = useState<LowStockProduct[]>([]);
  const [expiringBatches, setExpiringBatches] = useState<ExpiringBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchAlerts = useCallback(async () => {
    if (!pharmacyId) return;
    setLoading(true);

    // 1. Low stock products (stock <= min_stock_alert)
    const { data: lowStock } = await supabase
      .from("products")
      .select(`
        id, name, barcode, stock_quantity, min_stock_alert, selling_price,
        category:categories(name)
      `)
      .eq("pharmacy_id", pharmacyId)
      .filter("stock_quantity", "lte", supabase.rpc)
      // Use a raw filter via lte - compare two columns
    ;

    // Workaround: fetch all products and filter in JS
    const { data: allProducts } = await supabase
      .from("products")
      .select("id, name, barcode, stock_quantity, min_stock_alert, selling_price, category:categories(name)")
      .eq("pharmacy_id", pharmacyId);

    const filtered = (allProducts || []).filter(
      (p) => p.stock_quantity <= (p.min_stock_alert ?? 10)
    );

    setLowStockProducts(
      filtered.map((p) => ({
        id: p.id,
        name: p.name,
        barcode: p.barcode,
        stock_quantity: p.stock_quantity,
        min_stock_alert: p.min_stock_alert ?? 10,
        selling_price: p.selling_price,
        category_name: Array.isArray(p.category)
          ? p.category[0]?.name
          : (p.category as any)?.name,
      }))
    );

    // 2. Expiring batches within 30 days
    const today = new Date();
    const in30Days = new Date();
    in30Days.setDate(today.getDate() + 30);

    const { data: batches } = await supabase
      .from("product_batches")
      .select(`
        id, batch_number, expiry_date, quantity, product_id,
        product:products(id, name, barcode)
      `)
      .lte("expiry_date", in30Days.toISOString().split("T")[0])
      .gt("quantity", 0)
      .order("expiry_date", { ascending: true });

    const expiringList = (batches || []).map((b) => {
      const expiry = new Date(b.expiry_date);
      const diffMs = expiry.getTime() - today.getTime();
      const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      const product = Array.isArray(b.product) ? b.product[0] : b.product as any;
      return {
        id: b.id,
        batch_number: b.batch_number,
        expiry_date: b.expiry_date,
        quantity: b.quantity,
        daysLeft,
        product_id: b.product_id,
        product_name: product?.name ?? "—",
        product_barcode: product?.barcode ?? "—",
      };
    });

    setExpiringBatches(expiringList);
    setLastRefreshed(new Date());
    setLoading(false);
  }, [pharmacyId]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const getSeverity = (stock: number, min: number) => {
    if (stock === 0) return { label: "نفذ", color: "bg-red-100 text-red-700 border-red-200", dot: "bg-red-500" };
    if (stock <= Math.ceil(min * 0.5)) return { label: "حرج", color: "bg-orange-100 text-orange-700 border-orange-200", dot: "bg-orange-500" };
    return { label: "منخفض", color: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-400" };
  };

  const getExpirySeverity = (days: number) => {
    if (days <= 0) return { label: "منتهي", color: "bg-red-100 text-red-700 border-red-200", dot: "bg-red-500" };
    if (days <= 7) return { label: `${days} يوم`, color: "bg-red-100 text-red-700 border-red-200", dot: "bg-red-500" };
    if (days <= 14) return { label: `${days} يوم`, color: "bg-orange-100 text-orange-700 border-orange-200", dot: "bg-orange-500" };
    return { label: `${days} يوم`, color: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-400" };
  };

  const totalAlerts = lowStockProducts.length + expiringBatches.length;
  const criticalCount = lowStockProducts.filter((p) => p.stock_quantity === 0).length
    + expiringBatches.filter((b) => b.daysLeft <= 7).length;

  const showLowStock = activeFilter === "all" || activeFilter === "low_stock";
  const showExpiring = activeFilter === "all" || activeFilter === "expiring";

  return (
    <div className="space-y-6 pb-12" dir="rtl">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#002B5B] flex items-center gap-2">
            <Bell size={24} />
            التنبيهات والتحذيرات
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            آخر تحديث: {lastRefreshed.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <Button
          onClick={fetchAlerts}
          disabled={loading}
          variant="outline"
          className="h-9 text-xs font-bold gap-2 rounded-xl border-slate-200"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          تحديث
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardContent className="p-5 text-center">
            <div className="w-11 h-11 bg-red-50 rounded-xl flex items-center justify-center text-red-500 mx-auto mb-2">
              <Bell size={22} />
            </div>
            <p className="text-2xl font-black text-slate-800">{loading ? "—" : totalAlerts}</p>
            <p className="text-xs font-bold text-slate-500 mt-0.5">إجمالي التنبيهات</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardContent className="p-5 text-center">
            <div className="w-11 h-11 bg-orange-50 rounded-xl flex items-center justify-center text-orange-500 mx-auto mb-2">
              <AlertTriangle size={22} />
            </div>
            <p className="text-2xl font-black text-red-600">{loading ? "—" : criticalCount}</p>
            <p className="text-xs font-bold text-slate-500 mt-0.5">حرجة / عاجلة</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardContent className="p-5 text-center">
            <div className="w-11 h-11 bg-amber-50 rounded-xl flex items-center justify-center text-amber-500 mx-auto mb-2">
              <TrendingDown size={22} />
            </div>
            <p className="text-2xl font-black text-slate-800">{loading ? "—" : lowStockProducts.length}</p>
            <p className="text-xs font-bold text-slate-500 mt-0.5">منتجات منخفضة المخزون</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardContent className="p-5 text-center">
            <div className="w-11 h-11 bg-purple-50 rounded-xl flex items-center justify-center text-purple-500 mx-auto mb-2">
              <CalendarX2 size={22} />
            </div>
            <p className="text-2xl font-black text-slate-800">{loading ? "—" : expiringBatches.length}</p>
            <p className="text-xs font-bold text-slate-500 mt-0.5">دفعات قاربت الانتهاء</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl w-fit">
        {[
          { id: "all", label: "الكل", count: totalAlerts },
          { id: "low_stock", label: "مخزون منخفض", count: lowStockProducts.length },
          { id: "expiring", label: "قرب الانتهاء", count: expiringBatches.length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveFilter(tab.id as FilterTab)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeFilter === tab.id
                ? "bg-white text-[#002B5B] shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
              activeFilter === tab.id ? "bg-[#002B5B]/10 text-[#002B5B]" : "bg-slate-200 text-slate-500"
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-10 h-10 border-4 border-[#002B5B] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : totalAlerts === 0 ? (
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardContent className="p-16 text-center">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={40} className="text-emerald-500" />
            </div>
            <h3 className="font-black text-slate-800 text-lg mb-1">لا توجد تنبيهات!</h3>
            <p className="text-slate-400 text-sm">جميع المنتجات بحالة ممتازة 🎉</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">

          {/* ===== Low Stock Section ===== */}
          {showLowStock && lowStockProducts.length > 0 && (
            <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-l from-amber-50 to-orange-50 border-b border-orange-100">
                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600">
                  <TrendingDown size={20} />
                </div>
                <div>
                  <h2 className="font-black text-slate-800">تحذير: مخزون منخفض</h2>
                  <p className="text-xs text-slate-500">{lowStockProducts.length} منتج يحتاج إعادة توريد</p>
                </div>
                <span className="mr-auto bg-orange-100 text-orange-700 font-black text-sm px-3 py-1 rounded-full border border-orange-200">
                  {lowStockProducts.length} منتج
                </span>
              </div>
              <div className="divide-y divide-slate-100">
                {lowStockProducts.map((product) => {
                  const sev = getSeverity(product.stock_quantity, product.min_stock_alert);
                  const pct = product.min_stock_alert > 0
                    ? Math.min(100, (product.stock_quantity / product.min_stock_alert) * 100)
                    : 0;
                  return (
                    <div key={product.id} className="p-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${sev.dot}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-slate-800 text-sm">{product.name}</p>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${sev.color}`}>
                              {sev.label}
                            </span>
                            {product.category_name && (
                              <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full">
                                {product.category_name}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5 font-mono">{product.barcode}</p>

                          {/* Stock bar */}
                          <div className="mt-2 flex items-center gap-2">
                            <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  product.stock_quantity === 0 ? "bg-red-500"
                                  : pct <= 50 ? "bg-orange-400"
                                  : "bg-amber-400"
                                }`}
                                style={{ width: `${Math.max(pct, 2)}%` }}
                              />
                            </div>
                            <span className="text-[11px] text-slate-500 font-bold whitespace-nowrap">
                              {product.stock_quantity} / {product.min_stock_alert} علبة
                            </span>
                          </div>
                        </div>
                        <Link href="/dashboard/inventory">
                          <Button size="sm" className="h-8 text-xs font-bold bg-[#002B5B] hover:bg-[#001f42] text-white gap-1 shrink-0">
                            <ShoppingCart size={12} />
                            طلب توريد
                          </Button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* ===== Expiry Section ===== */}
          {showExpiring && expiringBatches.length > 0 && (
            <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-l from-red-50 to-pink-50 border-b border-red-100">
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-red-600">
                  <CalendarX2 size={20} />
                </div>
                <div>
                  <h2 className="font-black text-slate-800">تحذير: انتهاء الصلاحية قريب</h2>
                  <p className="text-xs text-slate-500">دفعات تنتهي خلال الـ 30 يوم القادمة</p>
                </div>
                <span className="mr-auto bg-red-100 text-red-700 font-black text-sm px-3 py-1 rounded-full border border-red-200">
                  {expiringBatches.length} دفعة
                </span>
              </div>
              <div className="divide-y divide-slate-100">
                {expiringBatches.map((batch) => {
                  const sev = getExpirySeverity(batch.daysLeft);
                  const expiryFormatted = new Date(batch.expiry_date).toLocaleDateString("ar-EG", {
                    year: "numeric", month: "long", day: "numeric"
                  });
                  return (
                    <div key={batch.id} className="p-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${sev.dot}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-slate-800 text-sm">{batch.product_name}</p>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${sev.color}`}>
                              {batch.daysLeft <= 0 ? "منتهي الصلاحية" : `ينتهي خلال ${sev.label}`}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Clock size={10} />
                              تاريخ الانتهاء: <span className="font-bold text-slate-700">{expiryFormatted}</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <Package size={10} />
                              الكمية المتبقية: <span className="font-bold text-slate-700">{batch.quantity} علبة</span>
                            </span>
                            <span className="font-mono text-slate-400">دفعة: {batch.batch_number}</span>
                          </div>
                        </div>

                        {/* Urgency indicator */}
                        <div className={`text-center shrink-0 px-3 py-2 rounded-xl border ${sev.color}`}>
                          <p className="text-lg font-black leading-none">
                            {batch.daysLeft <= 0 ? "!" : batch.daysLeft}
                          </p>
                          <p className="text-[9px] font-bold mt-0.5">
                            {batch.daysLeft <= 0 ? "منتهي" : "يوم"}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
