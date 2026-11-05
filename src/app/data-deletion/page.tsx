import React from 'react';
import {
  Trash2,
  ShieldCheck,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Data Deletion Instructions | تعليمات حذف البيانات — MustafaH-AI',
  description: 'Official Meta Platform Data Deletion Instructions for MustafaH-AI Clinical Intake Assistant.',
};

export default function DataDeletionPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-10 space-y-8">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-emerald-700 hover:text-emerald-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>العودة للمنصة الرئيسية / Back to Home</span>
          </Link>
          <span className="text-[11px] font-mono text-slate-400">Meta Compliance Standard</span>
        </div>

        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-rose-50 text-rose-700 rounded-full text-xs font-bold border border-rose-200">
            <Trash2 className="w-4 h-4" />
            <span>Meta Platform Data Deletion Instructions</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
            تعليمات حذف بيانات المستخدم (User Data Deletion)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
            وفقاً لقواعد منصة Meta لحماية خصوصية المستخدمين (Meta Platform Terms Section 4.d)، توضح هذه الصفحة خطوات طلب حذف كافة البيانات المرتبطة بحسابك على Instagram من أنظمة MustafaH-AI.
          </p>
        </div>

        {/* Step-by-Step Instructions */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <span>خطوات حذف البيانات عبر تطبيق Instagram</span>
          </h2>
          <div className="space-y-3 text-xs sm:text-sm text-slate-600">
            <div className="flex items-start gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
              <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0">1</span>
              <div>
                <strong className="text-slate-900">إلغاء الصلاحيات من إعدادات حسابك:</strong>
                <p className="text-slate-500 mt-0.5">افتح تطبيق Instagram ثم توجه إلى: الإعدادات والخصوصية &gt; إعدادات الموقع والأذونات &gt; التطبيقات ومواقع الويب (Apps and Websites) &gt; النشطة (Active) &gt; اختر تطبيق <strong>MustafaH-AI Assistant</strong> وانقر على <strong>إزالة (Remove)</strong>.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
              <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0">2</span>
              <div>
                <strong className="text-slate-900">إرسال أمر الحذف المباشر في المحادثة:</strong>
                <p className="text-slate-500 mt-0.5">أرسل رسالة نصية بحسابك إلى <strong>@drmustafa_hadi</strong> تتضمن عبارة: <code className="bg-slate-200 text-slate-900 px-1.5 py-0.5 rounded font-bold">حذف بياناتي</code> أو <code className="bg-slate-200 text-slate-900 px-1.5 py-0.5 rounded font-bold">Delete my data</code>. سيتعرف النظام فوراً على معرفك الرقمي ويقوم بمسح سجل المحادثة.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
              <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0">3</span>
              <div>
                <strong className="text-slate-900">التواصل مع إدارة العيادة هاتفياً:</strong>
                <p className="text-slate-500 mt-0.5">يمكنك الاتصال مباشرة بمكتب استقبال د. مصطفى هادي على الرقم: <span className="font-mono font-bold text-emerald-700">07768886667</span> لطلب المسح الفوري لسجلات المحادثة ورقم الهاتف المسجل.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Confirmation & SLA */}
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 space-y-1.5">
          <div className="font-bold flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            <span>فترة إنجاز الحذف (Data Purge SLA):</span>
          </div>
          <p>
            تتم معالجة طلبات الحذف آلياً خلال أقل من 24 ساعة، ويتم إصدار رقم تأكيد رقمي لحذف المعرف من جداول الـ Webhook و CRM بشكل نهائي وفق متطلبات Meta.
          </p>
        </div>

        {/* Footer Contact */}
        <div className="pt-6 border-t border-slate-100 text-center text-xs text-slate-500 space-y-1">
          <p className="font-bold text-slate-800">عيادة د. مصطفى هادي لتقويم وتجميل الأسنان — بغداد، العراق</p>
          <p>زيونة - خدمي دريم سيتي مول، مجاور مطعم صيف وشتاء | هاتف: 07768886667</p>
        </div>
      </div>
    </div>
  );
}
