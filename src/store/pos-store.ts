import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase } from '@/lib/supabase';

export type SellingUnit = 'box' | 'strip' | 'pill';
export type PaymentMethod = 'cash' | 'visa' | 'instapay' | 'vodafone_cash' | 'credit' | 'mixed';

export type Product = {
  id: string;
  name: string;
  description: string;
  price: number; // Price per box
  stock: number; // Stock in boxes
  category: string;
  barcode: string;
  stripBarcode?: string;
  pillBarcode?: string;
  stripsPerBox?: number;
  pillsPerStrip?: number;
  image_url?: string;
  activeIngredient?: string;
};

export type CartItem = {
  cartItemId: string; // Unique ID for cart item (product_id + unit)
  product: Product;
  quantity: number;
  unit: SellingUnit;
  unitPrice: number;
  note?: string; // item-level note
};

export type OrderTab = {
  id: string;
  label: string; // e.g. "طلب 1"
  cart: CartItem[];
  discount: number;
  discountType: 'amount' | 'percent';
  deliveryFee: number;
  customerId?: string;
  customerName?: string;
  createdAt: Date;
};

export type SuspendedOrder = {
  id: string;
  label: string;
  cart: CartItem[];
  discount: number;
  discountType: 'amount' | 'percent';
  deliveryFee?: number;
  customerId?: string;
  customerName?: string;
  suspendedAt: Date;
  note?: string;
};

export type Shift = {
  id: string;
  start_time: string;
  starting_cash: number;
  status: 'open' | 'closed';
};

export type ShiftTotals = {
  totalSales: number;
  cashSales: number;
  visaSales: number;
  instapaySales: number;
  vodafoneCashSales: number;
  expectedCash: number;
  startingCash: number;
};

interface PosState {
  // Products
  products: Product[];
  fetchProducts: () => Promise<void>;

  // Tabs
  tabs: OrderTab[];
  activeTabId: string;
  addTab: () => void;
  removeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;

  // Active tab helpers (work on the active tab)
  cart: CartItem[];
  discount: number;
  discountType: 'amount' | 'percent';
  deliveryFee: number;

  addToCart: (product: Product, unit?: SellingUnit) => void;
  removeFromCart: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  updateUnit: (cartItemId: string, newUnit: SellingUnit) => void;
  updateItemNote: (cartItemId: string, note: string) => void;
  clearCart: () => void;
  setDiscount: (amount: number) => void;
  setDiscountType: (type: 'amount' | 'percent') => void;
  setDeliveryFee: (amount: number) => void;
  setCustomerName: (name: string) => void;
  setCustomerInfo: (name: string, id?: string) => void;
  getTotals: () => { subtotal: number; discountAmount: number; deliveryFee: number; total: number; itemCount: number };

  // Suspend / Resume
  suspendedOrders: SuspendedOrder[];
  suspendOrder: (note?: string) => void;
  resumeOrder: (orderId: string) => void;
  deleteSuspendedOrder: (orderId: string) => void;

  // Checkout
  checkoutOrder: (paymentMethod: PaymentMethod, mixedCash?: number, mixedVisa?: number, insuranceContractId?: string, insurancePaidAmount?: number, patientCopayAmount?: number) => Promise<{ success: boolean; invoiceNumber?: string; receiptData?: any; error?: string }>;
  quickCheckout: (cart: CartItem[], paymentMethod: PaymentMethod) => Promise<{ success: boolean; invoiceNumber?: string; receiptData?: any; error?: string }>;

  // Shifts
  currentShift: Shift | null;
  fetchCurrentShift: () => Promise<void>;
  openShift: (startingCash: number) => Promise<{ success: boolean; error?: string }>;
  closeShift: (expectedCash: number, actualCash: number) => Promise<boolean>;
  getShiftTotals: () => Promise<ShiftTotals>;

  // Cashier & Delivery
  cashierId?: string;
  setCashierId: (id: string | undefined) => void;
  deliveryId?: string;
  setDeliveryId: (id: string | undefined) => void;

  // Offline POS
  offlineQueue: any[];
  syncOfflineOrders: () => Promise<void>;
}

const generateTabId = () => `tab-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const generateInvoiceNumber = () => `INV-${Date.now().toString().slice(-8)}`;

const createEmptyTab = (label: string): OrderTab => ({
  id: generateTabId(),
  label,
  cart: [],
  discount: 0,
  discountType: 'amount',
  deliveryFee: 0,
  createdAt: new Date(),
});

export const calculateUnitPrice = (product: Product, unit: SellingUnit): number => {
  if (unit === 'box') return product.price;
  if (unit === 'strip' && product.stripsPerBox) return product.price / product.stripsPerBox;
  if (unit === 'pill' && product.stripsPerBox && product.pillsPerStrip) {
    return product.price / (product.stripsPerBox * product.pillsPerStrip);
  }
  return product.price;
};

const initialTab = createEmptyTab('طلب 1');

export const usePosStore = create<PosState>()(persist((set, get) => ({
  products: [],
  fetchProducts: async () => {
    const { data, error } = await supabase
      .from('products')
      .select(`
        id,
        barcode,
        strip_barcode,
        pill_barcode,
        name,
        description,
        selling_price,
        stock_quantity,
        strips_per_box,
        pills_per_strip,
        image_url,
        active_ingredient,
        categories (name)
      `);
    
    if (error) {
      console.error('Error fetching products:', error);
      return;
    }

    if (data) {
      const mappedProducts = data.map((p: any) => ({
        id: p.id,
        barcode: p.barcode,
        stripBarcode: p.strip_barcode,
        pillBarcode: p.pill_barcode,
        name: p.name,
        description: p.description || '',
        price: p.selling_price,
        stock: p.stock_quantity,
        category: p.categories?.name || 'أخرى',
        stripsPerBox: p.strips_per_box,
        pillsPerStrip: p.pills_per_strip,
        image_url: p.image_url,
        activeIngredient: p.active_ingredient
      }));
      set({ products: mappedProducts });
    }
  },

  tabs: [initialTab],
  activeTabId: initialTab.id,
  suspendedOrders: [],
  offlineQueue: [],
  
  cashierId: undefined,
  setCashierId: (id) => set({ cashierId: id }),
  deliveryId: undefined,
  setDeliveryId: (id) => set({ deliveryId: id }),

  // Computed active tab cart / discount (derived from tabs)
  get cart() {
    const { tabs, activeTabId } = get();
    return tabs.find(t => t.id === activeTabId)?.cart ?? [];
  },
  get discount() {
    const { tabs, activeTabId } = get();
    return tabs.find(t => t.id === activeTabId)?.discount ?? 0;
  },
  get discountType() {
    const { tabs, activeTabId } = get();
    return tabs.find(t => t.id === activeTabId)?.discountType ?? 'amount';
  },
  get deliveryFee() {
    const { tabs, activeTabId } = get();
    return tabs.find(t => t.id === activeTabId)?.deliveryFee ?? 0;
  },

  // Tab management
  addTab: () => set((state) => {
    const newTab = createEmptyTab(`طلب ${state.tabs.length + 1}`);
    return { tabs: [...state.tabs, newTab], activeTabId: newTab.id };
  }),

  removeTab: (tabId) => set((state) => {
    if (state.tabs.length === 1) return state; // keep at least one tab
    const newTabs = state.tabs.filter(t => t.id !== tabId);
    const newActiveId = state.activeTabId === tabId
      ? newTabs[newTabs.length - 1].id
      : state.activeTabId;
    return { tabs: newTabs, activeTabId: newActiveId };
  }),

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  // Cart helpers that work on the active tab
  addToCart: (product, unit = 'box') => set((state) => {
    const cartItemId = `${product.id}-${unit}`;
    const unitPrice = calculateUnitPrice(product, unit);
    return {
      tabs: state.tabs.map(tab =>
        tab.id !== state.activeTabId ? tab : {
          ...tab,
          cart: tab.cart.some(i => i.cartItemId === cartItemId)
            ? tab.cart.map(i => i.cartItemId === cartItemId ? { ...i, quantity: i.quantity + 1 } : i)
            : [...tab.cart, { cartItemId, product, quantity: 1, unit, unitPrice }]
        }
      )
    };
  }),

  removeFromCart: (cartItemId) => set((state) => ({
    tabs: state.tabs.map(tab =>
      tab.id !== state.activeTabId ? tab : {
        ...tab,
        cart: tab.cart.filter(i => i.cartItemId !== cartItemId)
      }
    )
  })),

  updateQuantity: (cartItemId, quantity) => set((state) => ({
    tabs: state.tabs.map(tab =>
      tab.id !== state.activeTabId ? tab : {
        ...tab,
        cart: quantity <= 0
          ? tab.cart.filter(i => i.cartItemId !== cartItemId)
          : tab.cart.map(i => i.cartItemId === cartItemId ? { ...i, quantity } : i)
      }
    )
  })),

  updateUnit: (cartItemId, newUnit) => set((state) => {
    return {
      tabs: state.tabs.map(tab => {
        if (tab.id !== state.activeTabId) return tab;
        const item = tab.cart.find(i => i.cartItemId === cartItemId);
        if (!item) return tab;
        const newCartItemId = `${item.product.id}-${newUnit}`;
        const newUnitPrice = calculateUnitPrice(item.product, newUnit);
        const existingOther = tab.cart.find(i => i.cartItemId === newCartItemId);
        if (existingOther) {
          return {
            ...tab,
            cart: tab.cart
              .filter(i => i.cartItemId !== cartItemId)
              .map(i => i.cartItemId === newCartItemId
                ? { ...i, quantity: i.quantity + item.quantity }
                : i
              )
          };
        }
        return {
          ...tab,
          cart: tab.cart.map(i =>
            i.cartItemId === cartItemId
              ? { ...i, unit: newUnit, cartItemId: newCartItemId, unitPrice: newUnitPrice }
              : i
          )
        };
      })
    };
  }),

  updateItemNote: (cartItemId, note) => set((state) => ({
    tabs: state.tabs.map(tab =>
      tab.id !== state.activeTabId ? tab : {
        ...tab,
        cart: tab.cart.map(i => i.cartItemId === cartItemId ? { ...i, note } : i)
      }
    )
  })),

  clearCart: () => set((state) => ({
    tabs: state.tabs.map(tab =>
      tab.id !== state.activeTabId ? tab : {
        ...tab,
        cart: [],
        discount: 0,
        discountType: 'amount',
        deliveryFee: 0,
        customerId: undefined,
        customerName: undefined
      }
    )
  })),

  setDiscount: (amount) => set((state) => ({
    tabs: state.tabs.map(tab =>
      tab.id !== state.activeTabId ? tab : { ...tab, discount: amount }
    )
  })),

  setDiscountType: (type) => set((state) => ({
    tabs: state.tabs.map(tab =>
      tab.id !== state.activeTabId ? tab : { ...tab, discountType: type, discount: 0 }
    )
  })),
  setDeliveryFee: (amount) => set((state) => ({
    tabs: state.tabs.map(tab =>
      tab.id !== state.activeTabId ? tab : { ...tab, deliveryFee: amount }
    )
  })),

  setCustomerName: (name) => set((state) => ({
    tabs: state.tabs.map(tab =>
      tab.id !== state.activeTabId ? tab : { ...tab, customerName: name }
    )
  })),

  setCustomerInfo: (name, id) => set((state) => ({
    tabs: state.tabs.map(tab =>
      tab.id !== state.activeTabId ? tab : { ...tab, customerName: name, customerId: id }
    )
  })),

  getTotals: () => {
    const { tabs, activeTabId } = get();
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return { subtotal: 0, discountAmount: 0, deliveryFee: 0, total: 0, itemCount: 0 };

    const { cart, discount, discountType, deliveryFee = 0 } = tab;
    const subtotal = cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

    const discountAmount = discountType === 'percent'
      ? (subtotal * (discount / 100))
      : discount;

    const total = subtotal - discountAmount + deliveryFee;

    return {
      subtotal,
      discountAmount,
      deliveryFee,
      total: Math.max(0, total),
      itemCount
    };
  },

  suspendOrder: (note) => set((state) => {
    const tab = state.tabs.find(t => t.id === state.activeTabId);
    if (!tab || tab.cart.length === 0) return state;

    const suspended: SuspendedOrder = {
      id: `sus-${Date.now()}`,
      label: tab.label,
      cart: tab.cart,
      discount: tab.discount,
      discountType: tab.discountType,
      deliveryFee: tab.deliveryFee,
      customerId: tab.customerId,
      customerName: tab.customerName,
      suspendedAt: new Date(),
      note,
    };

    // Clear the current tab
    const newTabs = state.tabs.map(t =>
      t.id !== state.activeTabId ? t : {
        ...t,
        cart: [],
        discount: 0,
        discountType: 'amount' as const,
        deliveryFee: 0,
      }
    );

    return {
      tabs: newTabs,
      suspendedOrders: [...state.suspendedOrders, suspended]
    };
  }),

  resumeOrder: (orderId) => set((state) => {
    const order = state.suspendedOrders.find(o => o.id === orderId);
    if (!order) return state;

    // Try to put it in the active tab if empty, else create a new tab
    const activeTab = state.tabs.find(t => t.id === state.activeTabId);
    const canUseActive = activeTab && activeTab.cart.length === 0;

    let newTabs: OrderTab[];
    let newActiveId: string;

    if (canUseActive) {
      newTabs = state.tabs.map(t =>
        t.id !== state.activeTabId ? t : {
          ...t,
          label: order.label,
          cart: order.cart,
          discount: order.discount,
          discountType: order.discountType,
          deliveryFee: order.deliveryFee ?? 0,
          customerId: order.customerId,
          customerName: order.customerName,
        }
      );
      newActiveId = state.activeTabId;
    } else {
      const newTab: OrderTab = {
        id: generateTabId(),
        label: order.label,
        cart: order.cart,
        discount: order.discount,
        discountType: order.discountType,
        deliveryFee: order.deliveryFee ?? 0,
        customerId: order.customerId,
        customerName: order.customerName,
        createdAt: new Date(),
      };
      newTabs = [...state.tabs, newTab];
      newActiveId = newTab.id;
    }

    return {
      tabs: newTabs,
      activeTabId: newActiveId,
      suspendedOrders: state.suspendedOrders.filter(o => o.id !== orderId)
    };
  }),

  deleteSuspendedOrder: (orderId) => set((state) => ({
    suspendedOrders: state.suspendedOrders.filter(o => o.id !== orderId)
  })),

  // Checkout: save to DB
  checkoutOrder: async (paymentMethod, mixedCash, mixedVisa, insuranceContractId, insurancePaidAmount, patientCopayAmount) => {
    const { tabs, activeTabId } = get();
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab || tab.cart.length === 0) return { success: false, error: 'السلة فارغة' };

    const { cart, discount, discountType, deliveryFee = 0 } = tab;
    const subtotal = cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    const discountAmount = discountType === 'percent' ? (subtotal * (discount / 100)) : discount;
    const total = Math.max(0, subtotal - discountAmount + deliveryFee);
    const invoiceNumber = generateInvoiceNumber();

    // Payment method mapping to DB value
    const paymentMethodMap: Record<PaymentMethod, string> = {
      cash: 'cash',
      visa: 'visa',
      instapay: 'instapay',
      vodafone_cash: 'vodafone_cash',
      credit: 'credit',
      mixed: 'mixed',
    };

    const { currentShift } = get();
    
    // Check if network is offline
    const isOnline = typeof window !== 'undefined' ? window.navigator.onLine : true;
    let isOfflineCheckout = !isOnline;

    let authUser: any = null;
    let pharmacyId: string | null = null;

    if (!isOfflineCheckout) {
      try {
        const { data: authData } = await supabase.auth.getUser();
        authUser = authData?.user;
        if (authUser) {
          const { data: userProfile } = await supabase.from('users').select('pharmacy_id').eq('id', authUser.id).single();
          pharmacyId = userProfile?.pharmacy_id || null;
        }

        const { data: saleData, error: saleError } = await supabase
          .from('sales')
          .insert({
            invoice_number: invoiceNumber,
            shift_id: currentShift?.id || null,
            pharmacy_id: pharmacyId,
            subtotal,
            discount: discountAmount,
            tax: 0,
            delivery_fee: deliveryFee,
            total,
            payment_method: paymentMethodMap[paymentMethod],
            cash_paid: paymentMethod === 'cash' ? (patientCopayAmount ?? total) : (paymentMethod === 'mixed' ? (mixedCash || 0) : 0),
            visa_paid: paymentMethod === 'visa' ? (patientCopayAmount ?? total) : (paymentMethod === 'mixed' ? (mixedVisa || 0) : 0),
            patient_id: tab.customerId || null,
            patient_name: tab.customerName || null,
            cashier_id: get().cashierId || authUser?.id || null,
            delivery_id: get().deliveryId || null,
            insurance_contract_id: insuranceContractId || null,
            insurance_paid_amount: insurancePaidAmount || 0.00,
            patient_copay_amount: patientCopayAmount || total,
            notes: [cart.map(i => i.note).filter(Boolean).join(' | '), get().deliveryId ? `مندوب: ${get().deliveryId}` : null].filter(Boolean).join(' - ') || null,
          })
          .select('id')
          .single();

        if (saleError) {
          if (saleError.message?.includes('fetch') || saleError.message?.includes('Network') || saleError.message?.includes('network')) {
            isOfflineCheckout = true;
          } else {
            return { success: false, error: saleError.message ?? 'خطأ في حفظ الفاتورة' };
          }
        } else if (!saleData) {
          isOfflineCheckout = true;
        } else {
          const saleId = saleData.id;

          // Insert sale items
          const saleItems = cart.map(item => ({
            sale_id: saleId,
            product_id: item.product.id,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            total_price: item.unitPrice * item.quantity,
          }));

          const { error: itemsError } = await supabase.from('sale_items').insert(saleItems);
          if (itemsError) {
            return { success: false, error: itemsError.message };
          }

          // Update patient total_purchases and balance if applicable
          if (tab.customerId) {
            const { data: patient } = await supabase.from('patients').select('total_purchases, balance').eq('id', tab.customerId).single();
            if (patient) {
              const updatePayload: any = { total_purchases: patient.total_purchases + total };
              if (paymentMethod === 'credit') {
                updatePayload.balance = (Number(patient.balance) || 0) + (patientCopayAmount ?? total);
              }
              await supabase.from('patients').update(updatePayload).eq('id', tab.customerId);
            }
          }

          // Process stock deduction via FIFO/FEFO
          await supabase.rpc('process_sale_inventory_fifo', { p_sale_id: saleId });

          // Clear active tab
          set((state) => ({
            tabs: state.tabs.map(t =>
              t.id !== state.activeTabId ? t : {
                ...t,
                cart: [],
                discount: 0,
                discountType: 'amount' as const,
                deliveryFee: 0,
                customerId: undefined,
                customerName: undefined
              }
            )
          }));

          get().fetchProducts();

          return { 
            success: true, 
            invoiceNumber,
            receiptData: {
              cart,
              subtotal,
              discountAmount,
              deliveryFee,
              total,
              paymentMethod,
              mixedCash,
              mixedVisa,
              patientName: tab.customerName,
              cashierId: get().cashierId || authUser?.id,
              deliveryId: get().deliveryId,
              insuranceContractId,
              insurancePaidAmount,
              patientCopayAmount
            }
          };
        }
      } catch (err: any) {
        console.error("Supabase error during checkout, fallback to offline:", err);
        isOfflineCheckout = true;
      }
    }

    if (isOfflineCheckout) {
      const offlineSale = {
        invoice_number: invoiceNumber,
        shift_id: currentShift?.id || null,
        pharmacy_id: pharmacyId,
        subtotal,
        discount: discountAmount,
        tax: 0,
        delivery_fee: deliveryFee,
        total,
        payment_method: paymentMethodMap[paymentMethod],
        cash_paid: paymentMethod === 'cash' ? total : (paymentMethod === 'mixed' ? (mixedCash || 0) : 0),
        visa_paid: paymentMethod === 'visa' ? total : (paymentMethod === 'mixed' ? (mixedVisa || 0) : 0),
        patient_id: tab.customerId || null,
        patient_name: tab.customerName || null,
        cashier_id: get().cashierId || null,
        delivery_id: get().deliveryId || null,
        notes: [cart.map(i => i.note).filter(Boolean).join(' | '), get().deliveryId ? `مندوب: ${get().deliveryId}` : null].filter(Boolean).join(' - ') || null,
        items: cart.map(item => ({
          product_id: item.product.id,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total_price: item.unitPrice * item.quantity,
          unit: item.unit
        })),
        created_at: new Date().toISOString()
      };

      set((state) => ({
        offlineQueue: [...(state.offlineQueue || []), offlineSale]
      }));

      // Decrement local stock in state
      set((state) => {
        const updatedProducts = state.products.map(prod => {
          const cartItem = cart.find(item => item.product.id === prod.id);
          if (cartItem) {
            const boxesConsumed =
              cartItem.unit === 'box' ? cartItem.quantity
              : cartItem.unit === 'strip' && cartItem.product.stripsPerBox
                ? cartItem.quantity / cartItem.product.stripsPerBox
                : cartItem.unit === 'pill' && cartItem.product.stripsPerBox && cartItem.product.pillsPerStrip
                  ? cartItem.quantity / (cartItem.product.stripsPerBox * cartItem.product.pillsPerStrip)
                  : cartItem.quantity;
            return {
              ...prod,
              stock: Math.max(0, prod.stock - Math.ceil(boxesConsumed))
            };
          }
          return prod;
        });
        return { products: updatedProducts };
      });

      // Clear active tab
      set((state) => ({
        tabs: state.tabs.map(t =>
          t.id !== state.activeTabId ? t : {
            ...t,
            cart: [],
            discount: 0,
            discountType: 'amount' as const,
            deliveryFee: 0,
            customerId: undefined,
            customerName: undefined
          }
        )
      }));

      return {
        success: true,
        invoiceNumber,
        isOffline: true,
        receiptData: {
          cart,
          subtotal,
          discountAmount,
          deliveryFee,
          total,
          paymentMethod,
          mixedCash,
          mixedVisa,
          patientName: tab.customerName,
          cashierId: get().cashierId,
          deliveryId: get().deliveryId,
          isOffline: true
        }
      };
    }

    return { success: false, error: 'حدث خطأ غير متوقع' };
  },
  quickCheckout: async (cart, paymentMethod) => {
    if (cart.length === 0) return { success: false, error: 'السلة فارغة' };

    const { currentShift } = get();
    const subtotal = cart.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
    const total = subtotal;
    const invoiceNumber = generateInvoiceNumber();

    const paymentMethodMap: Record<PaymentMethod, string> = {
      cash: 'cash',
      visa: 'visa',
      instapay: 'instapay',
      vodafone_cash: 'vodafone_cash',
      credit: 'credit',
      mixed: 'mixed',
    };

    const { data: saleData, error: saleError } = await supabase
      .from('sales')
      .insert({
        invoice_number: invoiceNumber,
        shift_id: currentShift?.id || null,
        subtotal,
        discount: 0,
        tax: 0,
        total,
        payment_method: paymentMethodMap[paymentMethod],
        cash_paid: paymentMethod === 'cash' ? total : 0,
        visa_paid: paymentMethod === 'visa' ? total : 0,
        notes: 'صرف سريع',
        cashier_id: get().cashierId || (await supabase.auth.getUser()).data.user?.id || null,
      })
      .select('id')
      .single();

    if (saleError || !saleData) {
      console.error('Quick Sale insert error:', saleError);
      return { success: false, error: saleError?.message ?? 'خطأ في حفظ الفاتورة' };
    }

    const saleId = saleData.id;

    const saleItems = cart.map(item => ({
      sale_id: saleId,
      product_id: item.product.id,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total_price: item.unitPrice * item.quantity,
    }));

    const { error: itemsError } = await supabase.from('sale_items').insert(saleItems);
    if (itemsError) {
      console.error('Quick Sale items insert error:', itemsError);
      return { success: false, error: itemsError.message };
    }

    // Process stock deduction via FIFO/FEFO
    await supabase.rpc('process_sale_inventory_fifo', { p_sale_id: saleId });

    get().fetchProducts();
    return { success: true, invoiceNumber };
  },

  syncOfflineOrders: async () => {
    const { offlineQueue } = get();
    if (!offlineQueue || offlineQueue.length === 0) return;

    console.log(`[OfflineSync] Starting sync of ${offlineQueue.length} offline orders.`);
    let syncCount = 0;
    
    // We copy the queue to avoid modifying the array while iterating
    const queueCopy = [...offlineQueue];

    for (const order of queueCopy) {
      try {
        // Insert into sales
        const { data: saleData, error: saleErr } = await supabase
          .from('sales')
          .insert({
            invoice_number: order.invoice_number,
            shift_id: order.shift_id,
            pharmacy_id: order.pharmacy_id,
            subtotal: order.subtotal,
            discount: order.discount,
            tax: order.tax,
            delivery_fee: order.delivery_fee,
            total: order.total,
            payment_method: order.payment_method,
            cash_paid: order.cash_paid,
            visa_paid: order.visa_paid,
            patient_id: order.patient_id,
            patient_name: order.patient_name,
            cashier_id: order.cashier_id,
            delivery_id: order.delivery_id,
            notes: order.notes,
            created_at: order.created_at
          })
          .select('id')
          .single();

        if (saleErr || !saleData) throw saleErr || new Error("Failed to insert offline sale");

        const saleId = saleData.id;

        // Insert sale items
        const saleItemsPayload = order.items.map((item: any) => ({
          sale_id: saleId,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price
        }));

        const { error: itemsErr } = await supabase
          .from('sale_items')
          .insert(saleItemsPayload);

        if (itemsErr) throw itemsErr;

        // Increment patient balances/purchases online if applicable
        if (order.patient_id) {
          const { data: patient } = await supabase.from('patients').select('total_purchases, balance').eq('id', order.patient_id).single();
          if (patient) {
            const updatePayload: any = { total_purchases: patient.total_purchases + order.total };
            if (order.payment_method === 'credit') {
              updatePayload.balance = (Number(patient.balance) || 0) + order.total;
            }
            await supabase.from('patients').update(updatePayload).eq('id', order.patient_id);
          }
        }

        // Process stock deduction via FIFO/FEFO
        await supabase.rpc('process_sale_inventory_fifo', { p_sale_id: saleId });

        // Remove from offlineQueue
        set((state) => ({
          offlineQueue: state.offlineQueue.filter((o: any) => o.invoice_number !== order.invoice_number)
        }));
        syncCount++;
      } catch (err) {
        console.error(`[OfflineSync] Failed to sync order ${order.invoice_number}:`, err);
        break; // stop to prevent cascading errors if connection dropped again
      }
    }

    if (syncCount > 0) {
      console.log(`[OfflineSync] Successfully synced ${syncCount} orders.`);
      get().fetchProducts();
    }
  },

  // Shifts
  currentShift: null,
  fetchCurrentShift: async () => {
    // get the latest open shift
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .eq('status', 'open')
      .order('start_time', { ascending: false })
      .limit(1)
      .single();
    if (data) set({ currentShift: data as Shift });
    else set({ currentShift: null });
  },

  openShift: async (startingCash) => {
    // We should try to get the user and pharmacy_id if the system is multi-tenant
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    
    let pharmacyId = null;
    if (userId) {
      const { data: profile } = await supabase.from('users').select('pharmacy_id').eq('id', userId).single();
      pharmacyId = profile?.pharmacy_id;
    }

    const payload: any = { 
      starting_cash: startingCash, 
      status: 'open',
      user_id: userId
    };
    if (pharmacyId) payload.pharmacy_id = pharmacyId;

    const { data, error } = await supabase
      .from('shifts')
      .insert(payload)
      .select('*')
      .single();
      
    if (error) {
      console.error('Error opening shift:', error);
      return { success: false, error: error.message };
    }
    if (!data) return { success: false, error: 'Unknown error opening shift' };
    
    set({ currentShift: data as Shift });
    return { success: true };
  },

  closeShift: async (expectedCash, actualCash) => {
    const shift = get().currentShift;
    if (!shift) return false;
    const { error } = await supabase
      .from('shifts')
      .update({
        status: 'closed',
        end_time: new Date().toISOString(),
        ending_cash: actualCash,
        expected_cash: expectedCash,
      })
      .eq('id', shift.id);
    if (error) return false;
    set({ currentShift: null });
    return true;
  },

  getShiftTotals: async () => {
    const shift = get().currentShift;
    if (!shift) return { totalSales: 0, cashSales: 0, visaSales: 0, instapaySales: 0, vodafoneCashSales: 0, expectedCash: 0, startingCash: 0 };
    
    const { data, error } = await supabase
      .from('sales')
      .select('total, payment_method')
      .eq('shift_id', shift.id);
      
    if (error || !data) return { totalSales: 0, cashSales: 0, visaSales: 0, instapaySales: 0, vodafoneCashSales: 0, expectedCash: shift.starting_cash, startingCash: shift.starting_cash };

    let totalSales = 0, cashSales = 0, visaSales = 0, instapaySales = 0, vodafoneCashSales = 0;
    data.forEach(sale => {
      totalSales += sale.total;
      if (sale.payment_method === 'cash') cashSales += sale.total;
      if (sale.payment_method === 'visa') visaSales += sale.total;
      if (sale.payment_method === 'instapay') instapaySales += sale.total;
      if (sale.payment_method === 'vodafone_cash') vodafoneCashSales += sale.total;
    });

    return {
      totalSales,
      cashSales,
      visaSales,
      instapaySales,
      vodafoneCashSales,
      expectedCash: shift.starting_cash + cashSales,
      startingCash: shift.starting_cash

    };
  },
}), {
  name: 'pharmacy-pos-shift',
  partialize: (state) => ({ currentShift: state.currentShift, offlineQueue: state.offlineQueue }),
}));
