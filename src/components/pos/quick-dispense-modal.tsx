"use client";

import { useState } from "react";
import { Search, Plus, Minus, X, CheckCircle, ScanBarcode } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { usePosStore, Product, calculateUnitPrice, SellingUnit } from "@/store/pos-store";
import { toast } from "sonner";

type LocalCartItem = {
  cartItemId: string;
  product: Product;
  quantity: number;
  unit: SellingUnit;
  unitPrice: number;
};

interface QuickDispenseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function QuickDispenseModal({ isOpen, onClose }: QuickDispenseModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [localCart, setLocalCart] = useState<LocalCartItem[]>([]);
  const { products } = usePosStore();

  // Search Results
  const searchResults = searchQuery.trim() === "" 
    ? [] 
    : products.filter(p => 
        p.name.includes(searchQuery) || p.barcode.includes(searchQuery) || p.category.includes(searchQuery)
      ).slice(0, 5); // Limit to top 5 results

  const addToCart = (product: Product, unit: SellingUnit = 'box') => {
    const cartItemId = `${product.id}-${unit}`;
    const existing = localCart.find(item => item.cartItemId === cartItemId);
    const unitPrice = calculateUnitPrice(product, unit);

    if (existing) {
      setLocalCart(localCart.map(item => 
        item.cartItemId === cartItemId 
          ? { ...item, quantity: item.quantity + 1 } 
          : item
      ));
    } else {
      setLocalCart([...localCart, { cartItemId, product, quantity: 1, unit, unitPrice }]);
    }
    
    // Clear search after adding
    setSearchQuery("");
  };

  const removeFromCart = (cartItemId: string) => {
    setLocalCart(localCart.filter(item => item.cartItemId !== cartItemId));
  };

  const updateQuantity = (cartItemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(cartItemId);
      return;
    }
    setLocalCart(localCart.map(item => 
      item.cartItemId === cartItemId ? { ...item, quantity } : item
    ));
  };

  const total = localCart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);

  const [isProcessing, setIsProcessing] = useState(false);

  const handleCheckout = async () => {
    if (localCart.length === 0) return;
    
    setIsProcessing(true);
    const storeObj = usePosStore.getState();
    const res = await storeObj.quickCheckout(localCart, 'cash');
    setIsProcessing(false);

    if (res.success) {
      toast.success("تم إتمام عملية البيع بنجاح!", {
        description: `مجموع الفاتورة: ${total.toFixed(2)} ج.م`,
        icon: <CheckCircle className="text-green-500" />
      });
      // Reset and close
      setLocalCart([]);
      setSearchQuery("");
      onClose();
    } else {
      toast.error("حدث خطأ أثناء البيع!", {
        description: res.error || "حاول مرة أخرى",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden bg-slate-50" dir="rtl">
        <DialogHeader className="p-4 bg-white border-b border-slate-200">
          <DialogTitle className="text-xl font-bold flex items-center gap-2 text-primary">
            صرف سريع (أدوية كاش)
          </DialogTitle>
          <DialogDescription className="text-slate-500 text-sm">
            قم بمسح الباركود أو ابحث عن المنتج لإتمام البيع الفوري دون تسجيل بيانات المريض.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col h-[500px]">
          {/* Search Area */}
          <div className="p-4 bg-white border-b border-slate-200 relative z-10">
            <div className="relative">
              <ScanBarcode className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <Input 
                className="w-full pl-4 pr-10 py-5 text-md bg-slate-50 border-slate-200 rounded-lg focus-visible:ring-primary/20"
                placeholder="ابحث عن دواء..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
            </div>

            {/* Search Results Dropdown */}
            {searchResults.length > 0 && (
              <div className="absolute top-full left-4 right-4 mt-1 bg-white border border-slate-200 shadow-xl rounded-lg overflow-hidden flex flex-col max-h-60 overflow-y-auto">
                {searchResults.map(product => (
                  <div key={product.id} className="flex items-center justify-between p-3 border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">{product.name}</h4>
                      <div className="text-xs text-slate-500 mt-1 flex gap-2">
                        <span>{product.price.toFixed(2)} ج.م</span>
                        <span className="text-slate-300">|</span>
                        <span className={product.stock > 0 ? "text-green-600" : "text-red-500"}>
                          {product.stock > 0 ? `متوفر: ${product.stock}` : 'نفذ الكمية'}
                        </span>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => addToCart(product, 'box')}
                      disabled={product.stock === 0}
                      className="h-8 rounded-md"
                    >
                      إضافة <Plus size={14} className="mr-1" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {localCart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-300">
                <ScanBarcode size={48} className="opacity-20 mb-4" />
                <p>امسح باركود منتج للبدء...</p>
              </div>
            ) : (
              localCart.map(item => (
                <div key={item.cartItemId} className="flex items-center justify-between bg-white border border-slate-200 p-3 rounded-lg shadow-sm">
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-800 text-sm">{item.product.name}</h4>
                    <div className="flex gap-2 items-center mt-1">
                      <span className="text-primary font-bold text-sm">{(item.unitPrice * item.quantity).toFixed(2)} ج.م</span>
                      <Badge variant="outline" className="text-[10px] py-0 px-1 bg-slate-50 text-slate-500">
                        {item.unit === 'box' ? 'علبة' : item.unit === 'strip' ? 'شريط' : 'حبة'}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="flex items-center bg-slate-50 rounded-md border border-slate-200 p-0.5">
                      <button 
                        className="w-6 h-6 flex items-center justify-center text-slate-500 hover:bg-white hover:text-primary rounded"
                        onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-6 text-center text-xs font-bold">{item.quantity}</span>
                      <button 
                        className="w-6 h-6 flex items-center justify-center text-slate-500 hover:bg-white hover:text-primary rounded"
                        onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    
                    <button 
                      onClick={() => removeFromCart(item.cartItemId)}
                      className="text-slate-300 hover:text-red-500 p-1"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Checkout */}
          <div className="p-4 bg-white border-t border-slate-200">
            <div className="flex justify-between items-end mb-4">
              <span className="text-slate-500 text-sm font-medium">الإجمالي المستحق</span>
              <div className="text-right">
                <span className="text-2xl font-black text-primary">{total.toFixed(2)}</span>
                <span className="text-sm font-bold text-primary ml-1">ج.م</span>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onClose}>
                إلغاء
              </Button>
              <Button 
                className="flex-2 bg-green-600 hover:bg-green-700 text-white font-bold" 
                onClick={handleCheckout}
                disabled={localCart.length === 0 || isProcessing}
              >
                {isProcessing ? "جاري الدفع..." : "دفع نقدي كاش (F12)"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
