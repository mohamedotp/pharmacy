import type { Metadata } from "next";
import { Tajawal } from "next/font/google";
import "./globals.css";

const tajawal = Tajawal({
  subsets: ["arabic"],
  weight: ["300", "400", "500", "700", "800", "900"],
  variable: "--font-tajawal",
});

export const metadata: Metadata = {
  title: "صيدلية الشفاء - PharmacyOS",
  description: "نظام إدارة الصيدلية الحديث",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={`${tajawal.variable} antialiased`}>
      <body className="font-sans min-h-screen bg-slate-50 text-slate-900 flex flex-col">
        {children}
      </body>
    </html>
  );
}
