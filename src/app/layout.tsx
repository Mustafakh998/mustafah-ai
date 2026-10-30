import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'ALMESWAK AI — Baghdad Edition | نظام المسواك للذكاء الاصطناعي',
  description:
    'Lean Hybrid Instagram Growth & Patient Acquisition System for Almeswak Dental Clinic & Dr. Mustafa Hadi in Baghdad, Iraq.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full flex flex-col bg-slate-100 text-slate-900 overflow-hidden">
        {children}
      </body>
    </html>
  );
}
