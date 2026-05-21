-- ============================================================
-- Migration v2: B-Connect Feature Set
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. إضافة أعمدة الباركود للوحدات الكسرية في المنتجات
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS strip_barcode VARCHAR(100);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS pill_barcode VARCHAR(100);

-- 2. تعديل جدول تفاصيل المشتريات لدعم البونص والخصومات الإضافية
ALTER TABLE public.purchase_items ADD COLUMN IF NOT EXISTS bonus_quantity INTEGER DEFAULT 0;
ALTER TABLE public.purchase_items ADD COLUMN IF NOT EXISTS extra_discount_percent DECIMAL(5,2) DEFAULT 0.00;
ALTER TABLE public.purchase_items ADD COLUMN IF NOT EXISTS effective_unit_cost DECIMAL(10,2);

-- 3. إنشاء جدول جهات التعاقد والتأمين الصحي (Insurance Contracts)
CREATE TABLE IF NOT EXISTS public.insurance_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    discount_percent DECIMAL(5,2) DEFAULT 0.00,
    patient_copay_percent DECIMAL(5,2) DEFAULT 100.00,
    notes TEXT,
    pharmacy_id UUID REFERENCES public.pharmacies(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. ربط المبيعات بعقود التأمين وتقسيم المبالغ
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS insurance_contract_id UUID REFERENCES public.insurance_contracts(id) ON DELETE SET NULL;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS insurance_paid_amount DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS patient_copay_amount DECIMAL(10,2) DEFAULT 0.00;

-- 5. جدول جلسات مرتجع الموردين (Supplier Returns)
CREATE TABLE IF NOT EXISTS public.supplier_returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(100) NOT NULL,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE CASCADE,
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    tax DECIMAL(10,2) DEFAULT 0.00,
    total DECIMAL(10,2) NOT NULL DEFAULT 0,
    notes TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    pharmacy_id UUID REFERENCES public.pharmacies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.supplier_return_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id UUID REFERENCES public.supplier_returns(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    batch_id UUID REFERENCES public.product_batches(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL,
    unit_cost DECIMAL(10,2) NOT NULL,
    total_cost DECIMAL(10,2) NOT NULL,
    reason VARCHAR(100) DEFAULT 'expired',
    pharmacy_id UUID REFERENCES public.pharmacies(id) ON DELETE CASCADE
);

-- 6. تفعيل الـ RLS للجداول الجديدة
ALTER TABLE public.insurance_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_return_items ENABLE ROW LEVEL SECURITY;

-- 7. سياسات الوصول (Tenant RLS Policies)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'insurance_contracts' AND policyname = 'insurance_tenant_policy'
    ) THEN
        CREATE POLICY insurance_tenant_policy ON public.insurance_contracts
            FOR ALL USING (pharmacy_id = get_my_pharmacy_id()) WITH CHECK (pharmacy_id = get_my_pharmacy_id());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'supplier_returns' AND policyname = 'supplier_returns_tenant_policy'
    ) THEN
        CREATE POLICY supplier_returns_tenant_policy ON public.supplier_returns
            FOR ALL USING (pharmacy_id = get_my_pharmacy_id()) WITH CHECK (pharmacy_id = get_my_pharmacy_id());
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'supplier_return_items' AND policyname = 'supplier_return_items_tenant_policy'
    ) THEN
        CREATE POLICY supplier_return_items_tenant_policy ON public.supplier_return_items
            FOR ALL USING (pharmacy_id = get_my_pharmacy_id()) WITH CHECK (pharmacy_id = get_my_pharmacy_id());
    END IF;
END $$;

-- 8. Indexes للأداء
CREATE INDEX IF NOT EXISTS idx_products_strip_barcode ON public.products(strip_barcode);
CREATE INDEX IF NOT EXISTS idx_products_pill_barcode ON public.products(pill_barcode);
CREATE INDEX IF NOT EXISTS idx_supplier_returns_pharmacy ON public.supplier_returns(pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_insurance_contracts_pharmacy ON public.insurance_contracts(pharmacy_id);
