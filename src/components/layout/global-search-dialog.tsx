"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  Search, 
  Package, 
  User, 
  ArrowRight, 
  FileText, 
  LayoutDashboard, 
  ShoppingBag, 
  ShoppingCart, 
  Settings, 
  AlertCircle,
  Bell
} from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth-store";

interface GlobalSearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ProductResult {
  id: string;
  name: string;
  barcode: string;
  selling_price: number;
  active_ingredient?: string | null;
}

interface PatientResult {
  id: string;
  name: string;
  phone?: string | null;
  file_number?: string | null;
}

export function GlobalSearchDialog({ isOpen, onClose }: GlobalSearchDialogProps) {
  const router = useRouter();
  const { pharmacy, user } = useAuthStore();
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<ProductResult[]>([]);
  const [patients, setPatients] = useState<PatientResult[]>([]);
  const [loading, setLoading] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Predefined quick navigation links
  const quickLinks = [
    {
      title: "الرئيسية (لوحة التحكم)",
      path: "/dashboard",
      icon: LayoutDashboard,
      shortcut: "D",
    },
    {
      title: "المبيعات (نقطة البيع)",
      path: "/dashboard/sales",
      icon: ShoppingBag,
      shortcut: "S",
    },
    {
      title: "المخزون والمنتجات",
      path: "/dashboard/inventory",
      icon: Package,
      shortcut: "I",
    },
    {
      title: "إدارة المرضى",
      path: "/dashboard/patients",
      icon: User,
      shortcut: "P",
    },
    {
      title: "المشتريات والفواتير",
      path: "/dashboard/purchases",
      icon: ShoppingCart,
      shortcut: "B",
    },
    {
      title: "الطلبات العاجلة",
      path: "/dashboard/urgent-requests",
      icon: AlertCircle,
      shortcut: "U",
    },
    {
      title: "التنبيهات والإشعارات",
      path: "/dashboard/notifications",
      icon: Bell,
      shortcut: "N",
    },
  ];

  // Debounced search effect
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setProducts([]);
      setPatients([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const pharmacyId = pharmacy?.id ?? user?.pharmacy?.id;
        
        // 1. Query Products
        let productQuery = supabase
          .from("products")
          .select("id, name, barcode, selling_price, active_ingredient")
          .or(`name.ilike.%${trimmedQuery}%,barcode.ilike.%${trimmedQuery}%,active_ingredient.ilike.%${trimmedQuery}%,strip_barcode.ilike.%${trimmedQuery}%,pill_barcode.ilike.%${trimmedQuery}%`);

        if (pharmacyId) {
          productQuery = productQuery.eq("pharmacy_id", pharmacyId);
        }
        
        const { data: prodData } = await productQuery.limit(5);

        // 2. Query Patients
        let patientQuery = supabase
          .from("patients")
          .select("id, name, phone, file_number")
          .or(`name.ilike.%${trimmedQuery}%,phone.ilike.%${trimmedQuery}%,file_number.ilike.%${trimmedQuery}%`);

        if (pharmacyId) {
          patientQuery = patientQuery.eq("pharmacy_id", pharmacyId);
        }

        const { data: patData } = await patientQuery.limit(5);

        setProducts((prodData || []) as ProductResult[]);
        setPatients((patData || []) as PatientResult[]);
      } catch (err) {
        console.error("Error performing global search:", err);
      } finally {
        setLoading(false);
      }
    }, 250); // 250ms debounce

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, pharmacy, user]);

  const handleSelectRoute = (path: string) => {
    onClose();
    router.push(path);
  };

  const handleSelectProduct = (productId: string) => {
    onClose();
    router.push(`/dashboard/inventory?id=${productId}`);
  };

  const handleSelectPatient = (patientId: string) => {
    onClose();
    router.push(`/dashboard/patients?id=${patientId}`);
  };

  // Keep focus and handle special enter queries (like single barcodes scanned)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading) {
      // If there is a single product match, automatically go to it
      if (products.length === 1 && patients.length === 0) {
        handleSelectProduct(products[0].id);
      } else if (patients.length === 1 && products.length === 0) {
        handleSelectPatient(patients[0].id);
      }
    }
  };

  return (
    <CommandDialog
      open={isOpen}
      onOpenChange={onClose}
      title="البحث الذكي الموحد"
      description="البحث عن المنتجات بالاسم أو الباركود، أو المرضى بالاسم أو الهاتف، والروابط السريعة للوحة التحكم"
      className="max-w-2xl bg-white/95 backdrop-blur-xl border border-slate-200/80 shadow-2xl rounded-2xl overflow-hidden p-0 duration-200"
    >
      <div className="flex items-center border-b border-slate-100 px-4 py-3 bg-slate-50/50">
        <Search className="h-5 w-5 text-slate-400 ml-3" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="ابحث عن منتج، باركود، مريض، أو رابط سريع..."
          className="flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 font-bold w-full"
          dir="rtl"
          autoFocus
        />
        {loading && (
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent mr-2" />
        )}
      </div>

      <CommandList className="max-h-[35rem] p-3 overflow-y-auto no-scrollbar" dir="rtl">
        <CommandEmpty className="py-12 text-center text-slate-400 font-medium">
          <div className="flex flex-col items-center justify-center gap-3">
            <Package className="h-10 w-10 text-slate-300 stroke-[1.5]" />
            <p className="text-sm">لم يتم العثور على أي نتائج مطابقة</p>
          </div>
        </CommandEmpty>

        {/* Dynamic Product Search Results */}
        {products.length > 0 && (
          <CommandGroup 
            heading={<span className="text-xs font-black text-slate-400 px-2 select-none">المنتجات الدوائية</span>}
            className="mb-4"
          >
            {products.map((product) => (
              <CommandItem
                key={product.id}
                onSelect={() => handleSelectProduct(product.id)}
                className="flex items-center justify-between p-3 rounded-xl cursor-pointer hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100 group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="h-9 w-9 bg-teal-50 text-teal-600 rounded-lg flex items-center justify-center font-bold">
                    <Package size={18} />
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-slate-800 group-hover:text-primary transition-colors">
                      {product.name}
                    </p>
                    <p className="text-[11px] font-bold text-slate-400 mt-0.5">
                      {product.active_ingredient ? `المادة الفعالة: ${product.active_ingredient}` : `باركود: ${product.barcode}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="bg-teal-50/50 text-teal-600 border-teal-100 text-xs font-black px-2 py-0.5 rounded-md">
                    {product.selling_price.toFixed(2)} ج.م
                  </Badge>
                  <ArrowRight size={16} className="text-slate-300 group-hover:text-primary group-hover:translate-x-[-4px] transition-all rotate-180" />
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Dynamic Patient Search Results */}
        {patients.length > 0 && (
          <CommandGroup 
            heading={<span className="text-xs font-black text-slate-400 px-2 select-none">سجلات المرضى</span>}
            className="mb-4"
          >
            {patients.map((patient) => (
              <CommandItem
                key={patient.id}
                onSelect={() => handleSelectPatient(patient.id)}
                className="flex items-center justify-between p-3 rounded-xl cursor-pointer hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100 group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="h-9 w-9 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center font-bold">
                    <User size={18} />
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-slate-800 group-hover:text-primary transition-colors">
                      {patient.name}
                    </p>
                    <p className="text-[11px] font-bold text-slate-400 mt-0.5">
                      {patient.phone ? `الهاتف: ${patient.phone}` : ""} {patient.file_number ? ` | رقم الملف: ${patient.file_number}` : ""}
                    </p>
                  </div>
                </div>
                <ArrowRight size={16} className="text-slate-300 group-hover:text-primary group-hover:translate-x-[-4px] transition-all rotate-180" />
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Static Quick Navigation Links (filtered by search input query if typed) */}
        <CommandGroup 
          heading={<span className="text-xs font-black text-slate-400 px-2 select-none">روابط التنقل السريع</span>}
          className="mb-2"
        >
          {quickLinks
            .filter((link) => 
              query === "" || 
              link.title.toLowerCase().includes(query.toLowerCase()) || 
              link.shortcut.toLowerCase().includes(query.toLowerCase())
            )
            .map((link) => {
              const Icon = link.icon;
              return (
                <CommandItem
                  key={link.path}
                  onSelect={() => handleSelectRoute(link.path)}
                  className="flex items-center justify-between p-3 rounded-xl cursor-pointer hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100 group"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="h-9 w-9 bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center font-bold">
                      <Icon size={18} />
                    </div>
                    <span className="text-sm font-black text-slate-700 group-hover:text-primary transition-colors">
                      {link.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 font-mono text-[10px] font-medium text-slate-400">
                      {link.shortcut}
                    </kbd>
                    <ArrowRight size={16} className="text-slate-300 group-hover:text-primary group-hover:translate-x-[-4px] transition-all rotate-180" />
                  </div>
                </CommandItem>
              );
            })}
        </CommandGroup>
      </CommandList>
      
      <div className="border-t border-slate-100 px-4 py-3 bg-slate-50/80 flex items-center justify-between text-[11px] font-bold text-slate-400 select-none" dir="rtl">
        <div className="flex items-center gap-1.5">
          <span>اضغط على</span>
          <kbd className="px-1.5 py-0.5 rounded border border-slate-200 bg-white shadow-sm font-mono">⏎ Enter</kbd>
          <span>للاختيار والتوجيه</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span>اضغط</span>
          <kbd className="px-1.5 py-0.5 rounded border border-slate-200 bg-white shadow-sm font-mono">ESC</kbd>
          <span>للإغلاق</span>
        </div>
      </div>
    </CommandDialog>
  );
}
