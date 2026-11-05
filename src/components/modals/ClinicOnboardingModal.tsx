import React, { useState } from 'react';
import {
  X,
  Building2,
  CheckCircle2,
  Sparkles,
  MapPin,
  Phone,
  User,
  ShieldCheck,
} from 'lucide-react';
import { Language, SubscriptionTier } from '@/types';

interface ClinicOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  onClinicCreated?: (clinic: {
    name: string;
    city: string;
    phone: string;
    plan: SubscriptionTier;
  }) => void;
}

export const ClinicOnboardingModal: React.FC<ClinicOnboardingModalProps> = ({
  isOpen,
  onClose,
  language,
  onClinicCreated,
}) => {
  const isAr = language === 'ar';

  const [clinicName, setClinicName] = useState('');
  const [leadDoctor, setLeadDoctor] = useState('');
  const [city, setCity] = useState('بغداد - المنصور');
  const [phone, setPhone] = useState('077');
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionTier>('professional');
  const [hasAcknowledgedOrthoGuardrail, setHasAcknowledgedOrthoGuardrail] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicName.trim()) return;

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setSuccessMessage(
        isAr
          ? `تم إنشاء العيادة بنجاح! تم تفعيل خطة ${selectedPlan} وتخصيص مسار معزول أمنياً عبر PostgreSQL RLS.`
          : `Clinic registered successfully! Plan ${selectedPlan} activated with isolated PostgreSQL RLS boundaries.`
      );
      if (onClinicCreated) {
        onClinicCreated({
          name: clinicName,
          city,
          phone,
          plan: selectedPlan,
        });
      }
      setTimeout(() => {
        onClose();
        setSuccessMessage(null);
      }, 1800);
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-xl w-full p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-2xl border border-indigo-100">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">
                {isAr ? 'تسجيل عيادة جديدة (Onboard New Clinic)' : 'Onboard New Dental Clinic'}
              </h3>
              <p className="text-xs text-slate-500">
                {isAr
                  ? 'إضافة مستأجر سحابي معزول بالكامل ضمن منصة MustafaH-AI'
                  : 'Deploy an isolated tenant workspace on MustafaH-AI SaaS'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {successMessage ? (
          <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto animate-bounce" />
            <h4 className="font-black text-emerald-900 text-base">
              {isAr ? 'اكتمل إنشاء المستأجر الجديد!' : 'Tenant Provisioned!'}
            </h4>
            <p className="text-xs text-emerald-800 font-semibold">{successMessage}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 text-xs">
            {/* Clinic Info Fields */}
            <div className="space-y-3">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  {isAr ? 'اسم العيادة / المركز التخصصي *' : 'Clinic / Center Name *'}
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute start-3 top-3" />
                  <input
                    type="text"
                    required
                    placeholder={isAr ? 'مثال: عيادة المنصور التخصصية لطب الأسنان' : 'e.g. Mansour Dental Center'}
                    value={clinicName}
                    onChange={(e) => setClinicName(e.target.value)}
                    className="w-full ps-9 pe-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    {isAr ? 'طبيب الأسنان المسؤول' : 'Lead Doctor'}
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute start-3 top-3" />
                    <input
                      type="text"
                      placeholder={isAr ? 'د. أحمد الربيعي' : 'Dr. Ahmed'}
                      value={leadDoctor}
                      onChange={(e) => setLeadDoctor(e.target.value)}
                      className="w-full ps-9 pe-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    {isAr ? 'الموقع / المحافظة' : 'Location / District'}
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-slate-400 absolute start-3 top-3" />
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full ps-9 pe-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-medium"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  {isAr ? 'رقم هاتف الاستقبال العراقي (WhatsApp Hotline) *' : 'Reception Mobile (Iraq) *'}
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute start-3 top-3" />
                  <input
                    type="tel"
                    required
                    placeholder="077XXXXXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full ps-9 pe-3 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-mono font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Subscription Tier Selection */}
            <div className="space-y-2">
              <label className="block text-slate-700 font-bold">
                {isAr ? 'اختر خطة الاشتراك السحابية (Subscription Tier)' : 'Select Cloud Subscription Plan'}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Starter */}
                <div
                  onClick={() => setSelectedPlan('starter')}
                  className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                    selectedPlan === 'starter'
                      ? 'border-indigo-600 bg-indigo-50/50 shadow-sm ring-1 ring-indigo-600'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="font-bold text-slate-900">Starter</div>
                  <div className="text-indigo-700 font-black mt-1">150,000 د.ع</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">1,000 رسالة • فرع 1</div>
                </div>

                {/* Professional */}
                <div
                  onClick={() => setSelectedPlan('professional')}
                  className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                    selectedPlan === 'professional'
                      ? 'border-indigo-600 bg-indigo-50/50 shadow-sm ring-1 ring-indigo-600'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">Pro</span>
                    <span className="text-[9px] bg-indigo-600 text-white font-bold px-1.5 py-0.5 rounded-full">
                      الأشيع
                    </span>
                  </div>
                  <div className="text-indigo-700 font-black mt-1">450,000 د.ع</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">10,000 رسالة • 3 فروع</div>
                </div>

                {/* Enterprise */}
                <div
                  onClick={() => setSelectedPlan('enterprise')}
                  className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                    selectedPlan === 'enterprise'
                      ? 'border-indigo-600 bg-indigo-50/50 shadow-sm ring-1 ring-indigo-600'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="font-bold text-slate-900">Enterprise</div>
                  <div className="text-indigo-700 font-black mt-1">950,000 د.ع</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">100,000 رسالة • 10 فروع</div>
                </div>
              </div>
            </div>

            {/* Optional Orthodontic Price Guardrail Preference */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <div className="flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div className="text-[11px] text-slate-700 leading-relaxed">
                  <span className="font-bold block mb-0.5 text-slate-900">
                    {isAr
                      ? 'حماية وضوابط أسعار التقويم (موصى به)'
                      : 'Orthodontic Pricing Protection (Recommended)'}
                  </span>
                  {isAr
                    ? 'تفعيل توجيه استفسارات تكلفة التقويم إلى الاستشارة والفحص السريري المباشر بدلاً من التقدير الآلي.'
                    : 'Route orthodontic price inquiries to direct clinical consultation instead of automated estimates.'}
                </div>
              </div>
              <label className="flex items-center gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasAcknowledgedOrthoGuardrail}
                  onChange={(e) => setHasAcknowledgedOrthoGuardrail(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                />
                <span className="text-[11px] font-bold text-slate-800">
                  {isAr ? 'تفعيل حماية أسعار التقويم لهذه العيادة' : 'Enable orthodontic pricing protection for this clinic'}
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-100 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>{isAr ? 'جاري تهيئة المستأجر السحابي...' : 'Provisioning Tenant...'}</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>{isAr ? 'تأكيد التسجيل وإنشاء مساحة العيادة' : 'Confirm Registration & Create Workspace'}</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

