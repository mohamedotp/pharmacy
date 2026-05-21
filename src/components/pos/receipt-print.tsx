import React from 'react';
import { useAuthStore } from '@/store/auth-store';

export default function ReceiptPrint({ 
  receiptData, 
  invoiceNumber,
  cashiers = [],
  deliveryPersons = []
}: { 
  receiptData: any, 
  invoiceNumber: string | null,
  cashiers?: any[],
  deliveryPersons?: any[]
}) {
  const { pharmacy } = useAuthStore();

  if (!receiptData || !invoiceNumber) return null;

  const {
    cart,
    subtotal,
    discountAmount,
    deliveryFee,
    total,
    paymentMethod,
    mixedCash,
    mixedVisa,
    patientName,
    cashierId,
    deliveryId
  } = receiptData;

  const getPaymentLabel = (method: string) => {
    switch (method) {
      case 'cash': return 'كاش';
      case 'visa': return 'فيزا';
      case 'instapay': return 'إنستاباي';
      case 'vodafone_cash': return 'فودافون كاش';
      case 'credit': return 'آجل (مديونية)';
      case 'mixed': return 'دفع مختلط';
      default: return method;
    }
  };

  return (
    <div className="hidden print:block fixed inset-0 bg-white text-black text-right p-4 font-mono text-[12px] w-[80mm] mx-auto z-[9999]" dir="rtl">
      {/* Header */}
      <div className="text-center mb-4 border-b border-black pb-2">
        <h2 className="font-bold text-lg mb-1">{pharmacy?.name || 'صيدلية غير مسماة'}</h2>
        {pharmacy?.phone && <p>{pharmacy.phone}</p>}
        {pharmacy?.address && <p className="text-[10px]">{pharmacy.address}</p>}
      </div>

      {/* Invoice Info */}
      <div className="mb-4 text-[10px] border-b border-black pb-2 space-y-1">
        {receiptData.isOffline && (
          <div className="text-center font-bold border border-black p-1 mb-2">
            * فاتورة أوفلاين (قيد المزامنة) *
          </div>
        )}
        <div className="flex justify-between">
          <span>فاتورة رقم:</span>
          <span className="font-bold">{invoiceNumber}</span>
        </div>
        <div className="flex justify-between">
          <span>التاريخ/الوقت:</span>
          <span>{new Date().toLocaleString('ar-EG', { hour12: true })}</span>
        </div>
        
        <div className="flex justify-between mt-1 pt-1 border-t border-dashed border-gray-400">
          <span>الكاشير:</span>
          <span className="font-bold">{cashiers.find(c => c.id === cashierId)?.full_name || 'الافتراضي'}</span>
        </div>
        {deliveryId && (
          <div className="flex justify-between">
            <span>مندوب التوصيل:</span>
            <span className="font-bold">{deliveryPersons.find(d => d.id === deliveryId)?.full_name || 'غير معروف'}</span>
          </div>
        )}

        {patientName && (
          <div className="flex justify-between mt-1 pt-1 border-t border-dashed border-gray-400">
            <span>العميل:</span>
            <span className="font-bold">{patientName}</span>
          </div>
        )}
      </div>

      {/* Items Table */}
      <table className="w-full text-[10px] mb-4 border-collapse">
        <thead>
          <tr className="border-b border-black">
            <th className="text-right pb-1">الصنف</th>
            <th className="text-center pb-1">الكمية</th>
            <th className="text-left pb-1">الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          {cart.map((item: any, idx: number) => (
            <tr key={idx} className="border-b border-dashed border-gray-300">
              <td className="py-1">
                {item.product.name}
                {item.note && <div className="text-[8px] text-gray-500">ملاحظة: {item.note}</div>}
              </td>
              <td className="text-center py-1">{item.quantity}</td>
              <td className="text-left py-1">{(item.unitPrice * item.quantity).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="border-b border-black pb-2 mb-4 space-y-1">
        <div className="flex justify-between">
          <span>المجموع:</span>
          <span>{subtotal.toFixed(2)} ج.م</span>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between">
            <span>الخصم:</span>
            <span>{discountAmount.toFixed(2)} ج.م</span>
          </div>
        )}
        {deliveryFee > 0 && (
          <div className="flex justify-between">
            <span>خدمة التوصيل:</span>
            <span>{deliveryFee.toFixed(2)} ج.م</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-[14px] mt-1 pt-1 border-t border-black">
          <span>الصافي:</span>
          <span>{total.toFixed(2)} ج.م</span>
        </div>
        <div className="flex justify-between mt-1 text-[10px]">
          <span>طريقة الدفع:</span>
          <span>{getPaymentLabel(paymentMethod)}</span>
        </div>
        {paymentMethod === 'mixed' && (
          <div className="text-[9px] text-gray-500 pr-2 space-y-0.5" style={{ paddingRight: '10px' }}>
            <div className="flex justify-between">
              <span>- نقداً (كاش):</span>
              <span>{(mixedCash || 0).toFixed(2)} ج.م</span>
            </div>
            <div className="flex justify-between">
              <span>- بالبطاقة (فيزا):</span>
              <span>{(mixedVisa || 0).toFixed(2)} ج.م</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center text-[10px] mt-4 space-y-1">
        <p>{pharmacy?.receipt_footer_ar || 'شكراً لزيارتكم'}</p>
        {pharmacy?.clinic_numbers && (
          <p className="font-bold pt-1">رقم العيادة: <span dir="ltr">{pharmacy.clinic_numbers}</span></p>
        )}
      </div>

      {/* Styles for printing */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:block, .print\\:block * {
            visibility: visible;
          }
          .print\\:block {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm;
            padding: 5mm;
            margin: 0;
            background: white !important;
            color: black !important;
          }
        }
      `}} />
    </div>
  );
}
