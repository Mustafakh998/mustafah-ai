import React from 'react';
import { FileText, AlertTriangle, CheckCircle2, ArrowLeft, Stethoscope } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service | شروط الخدمة — MustafaH-AI',
  description: 'Terms of Service & Clinical Intake Conditions for MustafaH-AI Dental Assistant.',
};

export default function TermsOfServicePage() {
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
          <span className="text-[11px] font-mono text-slate-400">Effective: Nov 2026</span>
        </div>

        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold border border-blue-200">
            <FileText className="w-4 h-4" />
            <span>MustafaH-AI Platform — Terms of Service</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
            شروط استخدام المساعد الآلي لعيادة د. مصطفى هادي (Terms of Service)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
            يخضع استخدام المساعد الرقمي عبر منصة Instagram المخصص لعيادة د. مصطفى هادي للشروط والمعايير السريرية التالية:
          </p>
        </div>

        {/* Section 1: Clinical Nature & Advisory Purpose */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-emerald-600" />
            <span>1. طبيعة الخدمة والإرشاد السريري (Advisory Nature)</span>
          </h2>
          <div className="text-xs sm:text-sm text-slate-600 leading-relaxed space-y-2">
            <p>
              يقدم المساعد الآلي دعماً إدارياً وتنظيمياً لحجز مواعيد الكشفية، والإجابة على استفسارات الموقع والدوام في عيادة بغداد - زيونة.
            </p>
            <p>
              الردود الآلية <strong>لا تُعد بديلاً عن الكشف الطبي المباشر</strong> ولا تشكل وصفة طبية أو تشخيصاً نهائياً للحالة. تتطلب كل حالة كشفاً سريرياً مباشراً داخل العيادة.
            </p>
          </div>
        </div>

        {/* Section 2: Strict Orthodontic Price Prohibition */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <span>2. سياسة تسعير علاج التقويم الصارمة (Orthodontic Pricing Policy)</span>
          </h2>
          <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl text-xs sm:text-sm text-amber-950 leading-relaxed space-y-2">
            <div className="font-bold">حظر التسعير المسبق الآلي:</div>
            <p>
              امتثالاً لأخلاقيات مهنة طب الأسنان والمعايير السريرية المعتمدة لدى د. مصطفى هادي (أخصائي تقويم الأسنان والفكين)، يمتنع النظام تماماً عن تقديم أية أسعار أو تكاليف تقديرية أو خطط أقساط لعلاج التقويم عبر الرسائل قبل إجراء الكشفية السريرية المباشرة ودراسة الأشعة السينية البانورامية (OPG) والتحليل السيفالومتري.
            </p>
            <p className="text-xs text-amber-800">
              يتم تحديد الخطة العلاجية والتكلفة الدقيقة في جلسة الاستشارة داخل العيادة حصراً بناءً على درجة إطباق الأسنان والتشخيص المتكامل.
            </p>
          </div>
        </div>

        {/* Section 3: Emergency Protocols */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>3. الحالات الطارئة والتدخل البشري (Emergency Protocol)</span>
          </h2>
          <div className="text-xs sm:text-sm text-slate-600 leading-relaxed space-y-2">
            <p>
              في حالات الألم الشديد، أو النزيف الحاد، أو صدمات الأسنان الناتجة عن الحوادث، يرجى عدم الاعتماد على الردود الآلية، والاتصال فوراً بهاتف العيادة المباشر: <span className="font-bold text-emerald-700 font-mono">07768886667</span> أو التوجه لأقرب مركز طوارئ أسنان.
            </p>
            <p>
              يحق للمراجع في أي لحظة طلب التحدث مع الكادر البشري أو الطبيب عبر كتابة "أريد التحدث مع موظف" أو "حولني للطبيب" ليتم إيقاف المساعد الذكي فوراً.
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
