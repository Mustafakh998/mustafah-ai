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
  title: 'MustafaH-AI | د. مصطفى هادي — طبيب أسنان يشرحلك قبل لا يعالجك',
  description:
    'MustafaH-AI — Lean Hybrid Instagram Growth & Patient Acquisition Platform for Dr. Mustafa Hadi (Specialist Orthodontist) in Baghdad, Iraq.',
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
