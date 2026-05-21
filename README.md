# Pharmacy Management System - صيدلية الشفاء

نظام حديث ومتكامل لإدارة الصيدليات، تم بناؤه باستخدام أحدث تقنيات الويب: Next.js 15, Tailwind CSS, Shadcn UI, و Supabase.

## الميزات الأساسية
- **لوحة تحكم تفاعلية**: إحصائيات حية، ومخططات بيانية باستخدام Recharts.
- **نقطة البيع (POS)**: شاشة مخصصة للكاشير مع دعم اختصارات لوحة المفاتيح والباركود وإدارة السلة عبر Zustand.
- **إدارة المخزون**: تتبع كميات الأدوية، تواريخ الصلاحية، والتنبيهات للأصناف منخفضة المخزون.
- **تصميم متجاوب**: واجهة حديثة، تدعم اللغة العربية (RTL) بشكل مثالي.
- **قواعد بيانات Supabase**: بنية قوية مع دعم Row Level Security.

## متطلبات التشغيل
- Node.js (v18.17+)
- حساب في Supabase

## خطوات التثبيت المحلي

1. **تثبيت الحزم (Dependencies)**
   قم بفتح موجه الأوامر داخل مجلد المشروع `d:\projects\pharmacy` واكتب:
   ```bash
   npm install
   ```

2. **إعداد متغيرات البيئة (Environment Variables)**
   قم بنسخ ملف `.env.example` إلى `.env.local` وضع مفاتيح Supabase الخاصة بك:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

3. **إعداد قاعدة البيانات**
   اذهب إلى لوحة تحكم Supabase، وافتح قسم SQL Editor، ثم قم بنسخ ولصق محتوى ملف `supabase/schema.sql` واضغط على Run لتشغيل 스كربت وبناء الجداول.

4. **تشغيل خادم التطوير (Development Server)**
   ```bash
   npm run dev
   ```
   افتح المتصفح على الرابط `http://localhost:3000` لمشاهدة التطبيق.

## النشر على منصة Vercel (Deployment)

التطبيق جاهز بنسبة 100% للنشر عبر Vercel:

1. قم برفع المشروع إلى مستودع على GitHub.
2. سجل الدخول إلى [Vercel](https://vercel.com) وانقر على **Add New Project**.
3. اربط حساب GitHub الخاص بك واختر مستودع الصيدلية.
4. في قسم **Environment Variables**، قم بإضافة:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. اضغط على **Deploy**.
6. بعد دقائق معدودة، سيصبح النظام جاهزاً ويعمل بإنتاجية عالية!

---

> **ملاحظة**: تم استخدام `Zustand` لإدارة حالة عربة التسوق محلياً للحصول على أداء سريع بدون انتظار طلبات الخادم، بينما سيتم استخدام `Server Actions` من Next.js للتعامل مع قاعدة البيانات مثل حفظ الفواتير والمخزون.
# pharmacy
