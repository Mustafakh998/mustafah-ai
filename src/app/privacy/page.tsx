import React from 'react';
import { ShieldCheck, Lock, Eye, Trash2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy | سياسة الخصوصية — MustafaH-AI',
  description: 'Official Privacy Policy for MustafaH-AI Dental Practice Clinical Intake Assistant.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-10 space-y-8">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-emerald-700 hover:text-emerald-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>العودة للمنصة الرئيسية / Back to Home</span>
          </Link>
          <span className="text-[11px] font-mono text-slate-400">Version 2.1 (Nov 2026)</span>
        </div>

        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold border border-emerald-200">
            <ShieldCheck className="w-4 h-4" />
            <span>MustafaH-AI Platform — Official Privacy Policy</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
            سياسة الخصوصية وحماية بيانات المرضى (Privacy Policy)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
            توضح هذه الوثيقة كيفية تعامل منصة <strong>MustafaH-AI</strong> مع بيانات المرضى والمراجعين الواردة عبر منصات Meta (Instagram Direct و Facebook Pages) التابعة لعيادة د. مصطفى هادي في بغداد.
          </p>
        </div>

        {/* Section 1: Data We Collect */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Eye className="w-5 h-5 text-emerald-600" />
            <span>1. البيانات التي نجمعها (Information We Collect)</span>
          </h2>
          <div className="text-xs sm:text-sm text-slate-600 leading-relaxed space-y-2">
            <p>
              عند مراسلة حساب العيادة المعتمد (<strong>@drmustafa_hadi</strong>) عبر إنستغرام، تجمع المنصة حصراً:
            </p>
            <ul className="list-disc list-inside space-y-1.5 ps-2">
              <li><strong>المعرف الرقمي للمستخدم (Instagram Scoped ID):</strong> معرف رقمي عشوائي توفره Meta لربط المحادثة دون الكشف عن تفاصيل حسابك الشخصي الحساسة.</li>
              <li><strong>محتوى الرسائل واستفسارات الحجز:</strong> النصوص أو الاستفسارات السريرية المرسلة للاستفسار عن موقع العيادة، أوقات الدوام، أو طلب موعد كشفية.</li>
              <li><strong>رقم الهاتف المزوّد طوعاً:</strong> رقم الهاتف العراقي الذي يقدمه المراجع طوعاً لتأكيد موعد الكشفية والتواصل مع قسم الاستقبال.</li>
            </ul>
          </div>
        </div>

        {/* Section 2: Purpose of Processing */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Lock className="w-5 h-5 text-emerald-600" />
            <span>2. الغرض من معالجة البيانات (Purpose of Data Processing)</span>
          </h2>
          <div className="text-xs sm:text-sm text-slate-600 leading-relaxed space-y-2">
            <p>تُستخدم البيانات حصراً للأغراض الطبية والإدارية التالية:</p>
            <ol className="list-decimal list-inside space-y-1.5 ps-2">
              <li>الإجابة الفورية باللهجة العراقية على استفسارات مواعيد وأماكن تقديم الخدمة (بغداد - زيونة).</li>
              <li>تسجيل وتأكيد حجوزات كشفية الأسنان وتنسيق حضور المرضى مع كادر الاستقبال.</li>
              <li>حماية السلامة السريرية: تحويل الحالات العاجلة إلى الطبيب البشري وحظر التسعير المسبق غير السريري.</li>
            </ol>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 font-semibold mt-3">
              نؤكد التزامنا التام: لا نقوم ببيع أو مشاركة أو تأجير أي بيانات شخصية أو طبية مع أي أطراف ثالثة أو معلنين على الإطلاق.
            </div>
          </div>
        </div>

        {/* Section 3: Data Security & Storage */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <span>3. أمان وتخزين البيانات (Data Security & Tenant Isolation)</span>
          </h2>
          <div className="text-xs sm:text-sm text-slate-600 leading-relaxed space-y-2">
            <p>
              تخضع قاعدة البيانات لحماية صارمة على مستوى الخادم:
            </p>
            <ul className="list-disc list-inside space-y-1.5 ps-2">
              <li>تشفير البيانات أثناء النقل (TLS 1.3) وأثناء التخزين (AES-256).</li>
              <li>عزل البيانات عبر تقنية PostgreSQL Row Level Security (RLS) بحيث لا يمكن لأي عيادة أخرى الوصول لسجلات مرضى عيادة أخرى.</li>
              <li>نظام إخفاء المفاتيح السرية (Secret Masking) في جميع سجلات المعالجة الفنية.</li>
            </ul>
          </div>
        </div>

        {/* Section 4: Data Retention & User Rights */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-rose-600" />
            <span>4. حذف البيانات وحقوق المراجع (Data Deletion Rights)</span>
          </h2>
          <div className="text-xs sm:text-sm text-slate-600 leading-relaxed space-y-3">
            <p>
              يحق لكل مراجع طلب حذف كامل سجل محادثاته وبياناته في أي وقت وفق سياسات Meta لحماية المستخدمين:
            </p>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs">
              <div className="font-bold text-slate-900">طرق طلب الحذف الفوري:</div>
              <ul className="list-disc list-inside space-y-1 text-slate-700">
                <li>إرسال رسالة &quot;حذف بياناتي&quot; أو &quot;Delete my data&quot; مباشرة في المحادثة مع الحساب.</li>
                <li>الاتصال المباشر بهاتف العيادة: <span className="font-mono font-bold text-emerald-700">07768886667</span>.</li>
                <li>زيارة صفحة تعليمات الحذف الرسمية: <Link href="/data-deletion" className="text-indigo-600 font-bold underline">تعليمات حذف البيانات</Link>.</li>
              </ul>
            </div>
            <p className="text-[11px] text-slate-500">
              يتم تنفيذ طلب الحذف خلال 48 ساعة وحذف كافة المعرفات المرتبطة من قواعد البيانات بصورة نهائية غير قابلة للاسترجاع.
            </p>
          </div>
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
