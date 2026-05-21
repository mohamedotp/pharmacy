"use client";

import { useState, useRef, useEffect } from "react";
import {
  Search,
  Eye,
  AlertTriangle,
  Info,
  Pill,
  FlaskConical,
  ShieldAlert,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Loader2,
  X,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface OpenFDAMeta {
  brand_name?: string[];
  generic_name?: string[];
  manufacturer_name?: string[];
  product_type?: string[];
  route?: string[];
  substance_name?: string[];
}

interface DrugLabel {
  openfda?: OpenFDAMeta;
  // top-level fields also possible
  brand_name?: string[];
  generic_name?: string[];
  manufacturer_name?: string[];
  product_type?: string[];
  route?: string[];
  substance_name?: string[];
  purpose?: string[];
  indications_and_usage?: string[];
  warnings?: string[];
  warnings_and_cautions?: string[];
  contraindications?: string[];
  dosage_and_administration?: string[];
  adverse_reactions?: string[];
  drug_interactions?: string[];
  how_supplied?: string[];
  storage_and_handling?: string[];
  active_ingredient?: string[];
  inactive_ingredient?: string[];
  pharmacodynamics?: string[];
  clinical_pharmacology?: string[];
  mechanism_of_action?: string[];
}

interface DrugResult {
  meta: { results: { total: number } };
  results: DrugLabel[];
}

interface Section {
  key: keyof DrugLabel;
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
}

const sections: Section[] = [
  { key: "indications_and_usage", label: "الاستخدامات والمؤشرات", icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
  { key: "dosage_and_administration", label: "الجرعة وطريقة الاستخدام", icon: Pill, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
  { key: "warnings", label: "التحذيرات", icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
  { key: "warnings_and_cautions", label: "تحذيرات وتنبيهات", icon: ShieldAlert, color: "text-orange-600", bg: "bg-orange-50 border-orange-200" },
  { key: "contraindications", label: "موانع الاستخدام", icon: AlertCircle, color: "text-rose-600", bg: "bg-rose-50 border-rose-200" },
  { key: "adverse_reactions", label: "الآثار الجانبية", icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50 border-red-200" },
  { key: "drug_interactions", label: "التفاعلات الدوائية", icon: FlaskConical, color: "text-purple-600", bg: "bg-purple-50 border-purple-200" },
  { key: "active_ingredient", label: "المواد الفعالة", icon: FlaskConical, color: "text-cyan-600", bg: "bg-cyan-50 border-cyan-200" },
  { key: "clinical_pharmacology", label: "الصيدلانية السريرية", icon: BookOpen, color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-200" },
  { key: "storage_and_handling", label: "التخزين والتداول", icon: Info, color: "text-slate-600", bg: "bg-slate-50 border-slate-200" },
];

function SectionCard({ section, data }: { section: Section; data: string[] }) {
  const [open, setOpen] = useState(false);
  const Icon = section.icon;
  const text = data.join(" ").replace(/<[^>]*>/g, "").trim();

  return (
    <div className={`border rounded-2xl overflow-hidden ${section.bg}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-right"
      >
        <div className="flex items-center gap-3">
          <Icon size={20} className={section.color} />
          <span className={`font-bold text-sm ${section.color}`}>{section.label}</span>
        </div>
        {open ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
      </button>
      {open && (
        <div className="px-5 pb-5 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap border-t border-white/60">
          <p className="mt-3">{text}</p>
        </div>
      )}
    </div>
  );
}

function DrugCard({ drug, index }: { drug: DrugLabel; index: number }) {
  // OpenFDA nests identifiers under drug.openfda
  const brandName =
    drug.openfda?.brand_name?.[0] ??
    drug.brand_name?.[0] ??
    drug.openfda?.generic_name?.[0] ??
    drug.generic_name?.[0] ??
    "غير معروف";
  const genericName =
    drug.openfda?.generic_name?.[0] ?? drug.generic_name?.[0];
  const manufacturer =
    drug.openfda?.manufacturer_name?.[0] ?? drug.manufacturer_name?.[0];
  const route = drug.openfda?.route?.[0] ?? drug.route?.[0];
  const type = drug.openfda?.product_type?.[0] ?? drug.product_type?.[0];


  const availableSections = sections.filter((s) => drug[s.key] && (drug[s.key] as string[]).length > 0);

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-l from-[#002B5B] to-[#0a4a8a] p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
              <Eye size={22} className="text-white" />
            </div>
            <div>
              <p className="text-blue-200 text-xs font-semibold uppercase tracking-wider">نتيجة {index + 1}</p>
              <h2 className="text-white font-black text-xl leading-tight">{brandName}</h2>
              {genericName && genericName !== brandName && (
                <p className="text-blue-200 text-sm mt-0.5">{genericName}</p>
              )}
            </div>
          </div>
          {route && (
            <span className="bg-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-full">
              {route}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          {manufacturer && (
            <span className="bg-white/10 text-blue-100 text-xs px-3 py-1 rounded-lg">
              🏭 {manufacturer}
            </span>
          )}
          {type && (
            <span className="bg-white/10 text-blue-100 text-xs px-3 py-1 rounded-lg">
              💊 {type}
            </span>
          )}
        </div>
      </div>

      {/* Sections */}
      {availableSections.length > 0 ? (
        <div className="p-5 space-y-3">
          {availableSections.map((section) => (
            <SectionCard
              key={section.key}
              section={section}
              data={(drug[section.key] as string[])}
            />
          ))}
        </div>
      ) : (
        <div className="p-8 text-center text-slate-400">
          <Info size={32} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">لا توجد تفاصيل إضافية لهذا الدواء</p>
        </div>
      )}
    </div>
  );
}

export default function DrugEyePage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DrugLabel[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const searchDrug = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const term = query.trim();
    if (!term) return;

    setLoading(true);
    setError(null);
    setSearched(false);
    setResults([]);

    try {
      const url = `https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${encodeURIComponent(term)}"+openfda.generic_name:"${encodeURIComponent(term)}"&limit=5`;
      const res = await fetch(url);

      if (res.status === 404) {
        // Try broader search
        const url2 = `https://api.fda.gov/drug/label.json?search=${encodeURIComponent(term)}&limit=5`;
        const res2 = await fetch(url2);
        if (!res2.ok) throw new Error("لم يتم العثور على نتائج");
        const data2: DrugResult = await res2.json();
        setResults(data2.results ?? []);
        setTotal(data2.meta?.results?.total ?? 0);
      } else if (!res.ok) {
        throw new Error("حدث خطأ في الاتصال بالخادم");
      } else {
        const data: DrugResult = await res.json();
        setResults(data.results ?? []);
        setTotal(data.meta?.results?.total ?? 0);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    setSearched(false);
    setError(null);
    inputRef.current?.focus();
  };

  const suggestions = ["Paracetamol", "Amoxicillin", "Ibuprofen", "Metformin", "Atorvastatin", "Omeprazole"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100" dir="rtl">
      {/* Hero Header */}
      <div className="bg-gradient-to-l from-[#001f42] via-[#002B5B] to-[#0a4a8a] px-8 py-12 shadow-2xl">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center shadow-xl">
              <Eye size={32} className="text-white" />
            </div>
            <div className="text-right">
              <h1 className="text-3xl font-black text-white tracking-tight">Drug Eye</h1>
              <p className="text-blue-200 text-sm font-medium">محرك بحث دوائي متكامل</p>
            </div>
          </div>
          <p className="text-blue-200/80 text-sm mb-8 max-w-xl mx-auto leading-relaxed">
            ابحث عن أي دواء وشاهد معلوماته الكاملة من الاستخدامات، الجرعات، التحذيرات، والتفاعلات الدوائية
          </p>

          {/* Search Form */}
          <form onSubmit={searchDrug} className="relative">
            <div className="relative flex items-center">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث باسم الدواء بالإنجليزية... (مثال: Paracetamol)"
                className="w-full bg-white/95 backdrop-blur text-slate-800 placeholder-slate-400 text-base font-medium px-6 py-5 pr-6 pl-36 rounded-2xl border-0 shadow-2xl focus:outline-none focus:ring-4 focus:ring-blue-300/50"
                style={{ direction: "ltr", textAlign: "left" }}
              />
              {query && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute left-24 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={18} />
                </button>
              )}
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="absolute left-2 bg-[#002B5B] hover:bg-[#003d82] disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-3 rounded-xl font-bold text-sm flex items-center gap-2 transition-all duration-200 shadow-lg"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                بحث
              </button>
            </div>
          </form>

          {/* Suggestions */}
          {!searched && (
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              <span className="text-blue-300/70 text-xs ml-1">جرب:</span>
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => { setQuery(s); }}
                  className="bg-white/10 hover:bg-white/20 text-blue-100 text-xs px-3 py-1.5 rounded-lg transition-colors font-medium"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Results Area */}
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center animate-pulse">
              <Eye size={28} className="text-[#002B5B]" />
            </div>
            <p className="text-slate-500 font-semibold">جاري البحث عن معلومات الدواء...</p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center">
            <AlertTriangle size={32} className="text-rose-400 mx-auto mb-3" />
            <p className="text-rose-600 font-bold">{error}</p>
            <p className="text-rose-400 text-sm mt-1">تأكد من كتابة اسم الدواء باللغة الإنجليزية</p>
          </div>
        )}

        {/* No Results */}
        {searched && !loading && !error && results.length === 0 && (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Search size={36} className="text-slate-300" />
            </div>
            <h3 className="text-slate-600 font-bold text-lg mb-1">لا توجد نتائج</h3>
            <p className="text-slate-400 text-sm">حاول البحث باسم مختلف أو تأكد من الإملاء</p>
          </div>
        )}

        {/* Results */}
        {!loading && results.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-black text-slate-800">نتائج البحث</h2>
                <p className="text-slate-400 text-sm mt-0.5">
                  تم العثور على <span className="font-bold text-[#002B5B]">{total.toLocaleString()}</span> نتيجة — يعرض أفضل {results.length}
                </p>
              </div>
              <div className="bg-[#002B5B]/5 text-[#002B5B] text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-2">
                <Eye size={14} />
                OpenFDA
              </div>
            </div>

            <div className="space-y-6">
              {results.map((drug, i) => (
                <DrugCard key={i} drug={drug} index={i} />
              ))}
            </div>

            <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex gap-3">
              <AlertTriangle size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-amber-700 text-xs leading-relaxed">
                <strong>تنبيه طبي:</strong> المعلومات المعروضة مصدرها قاعدة بيانات FDA الأمريكية وهي للأغراض المهنية فقط. 
                لا تُستخدم هذه المعلومات كبديل عن الاستشارة الطبية أو الصيدلانية المتخصصة.
              </p>
            </div>
          </>
        )}

        {/* Initial State */}
        {!searched && !loading && (
          <div className="py-16 text-center">
            <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto mb-8">
              {[
                { icon: Pill, label: "الجرعات", color: "text-blue-500", bg: "bg-blue-50" },
                { icon: AlertTriangle, label: "التحذيرات", color: "text-amber-500", bg: "bg-amber-50" },
                { icon: FlaskConical, label: "التفاعلات", color: "text-purple-500", bg: "bg-purple-50" },
              ].map((item) => (
                <div key={item.label} className={`${item.bg} rounded-2xl p-4 flex flex-col items-center gap-2`}>
                  <item.icon size={24} className={item.color} />
                  <span className={`text-xs font-bold ${item.color}`}>{item.label}</span>
                </div>
              ))}
            </div>
            <p className="text-slate-400 text-sm">ابدأ البحث للحصول على معلومات شاملة عن أي دواء</p>
          </div>
        )}
      </div>
    </div>
  );
}
