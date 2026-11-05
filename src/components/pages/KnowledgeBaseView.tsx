import React, { useState } from 'react';
import {
  Search,
  MapPin,
  Clock,
  Phone,
  HelpCircle,
} from 'lucide-react';
import { AppState } from '@/lib/store';
import { CLINIC_SERVICES } from '@/lib/data/initialData';
import { TreatmentService } from '@/types';

interface KnowledgeBaseViewProps {
  state: AppState;
}

export const KnowledgeBaseView: React.FC<KnowledgeBaseViewProps> = ({ state }) => {
  const isAr = state.currentLanguage === 'ar';
  const [searchQuery, setSearchQuery] = useState('');
  const [services] = useState<TreatmentService[]>(CLINIC_SERVICES);
  const [selectedService, setSelectedService] = useState<TreatmentService>(CLINIC_SERVICES[0]);

  const filteredServices = services.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.nameAr.toLowerCase().includes(q) ||
      s.nameEn.toLowerCase().includes(q) ||
      s.descriptionAr.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900">
            {isAr ? 'قاعدة المعرفة الطبية المعتمدة (Clinic Knowledge Base)' : 'Medical Knowledge Base'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {isAr
              ? 'المرجع الرسمي الوحيد للذكاء الاصطناعي: أسعار معتمدة، عناوين، أطباء العيادة، وإجابات الأسئلة الشائعة — لا نخترع أي معلومة مفقودة'
              : 'Grounded truth for AI: approved treatments, Baghdad pricing, operating hours, and verified doctors.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute top-2.5 start-3" />
            <input
              type="text"
              placeholder={isAr ? 'بحث في الخدمات والأسعار...' : 'Search services & FAQs...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl ps-9 pe-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Verified Clinic Core Details Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 shrink-0">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900">{isAr ? 'العنوان الجغرافي الدقيق:' : 'Exact Clinic Address:'}</div>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              {isAr
                ? 'بغداد – زيونة – خدمي دريم سيتي مول (مجاور مطعم صيف وشتاء، البناية فوق مقهى الخيال، الطابق السادس، شقة 6)'
                : 'Baghdad – Zayouna – Dream City Mall service street, Beside Sayf Restaurant, Above Al-Khayal Cafe (6th Floor, Apt 6)'}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-700 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900">{isAr ? 'أوقات الدوام والاستقبال:' : 'Working Hours:'}</div>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              {isAr
                ? 'من السبت إلى الخميس: 2:00 ظهراً – 9:00 مساءً (الجمعة عطلة العيادة الرسمية)'
                : 'Saturday to Thursday: 2:00 PM – 9:00 PM (Friday Closed)'}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-amber-50 text-amber-700 shrink-0">
            <Phone className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900">{isAr ? 'هاتف الحجز والواتساب المعتمد:' : 'Booking & WhatsApp Line:'}</div>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              <strong className="font-mono text-emerald-700 text-sm">07768886667</strong>
              <br />
              <span className="text-[11px] text-slate-400">
                {isAr ? 'مربوط مباشرة مع شات الاستقبال' : 'Linked with reception hotline'}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout: Catalog & Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Services List */}
        <div className="space-y-3">
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500">
            {isAr ? 'الخدمات والأقسام الطبية المعتمدة' : 'Approved Treatment Departments'}
          </h3>

          <div className="space-y-2">
            {filteredServices.map((svc) => {
              const isSelected = selectedService.id === svc.id;
              return (
                <div
                  key={svc.id}
                  onClick={() => setSelectedService(svc)}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-md'
                      : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm">{svc.nameAr}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isSelected ? 'bg-white text-emerald-800' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {svc.priceRangeUSD}
                    </span>
                  </div>
                  <div className={`text-xs ${isSelected ? 'text-emerald-100' : 'text-slate-500'}`}>
                    {svc.doctorInChargeAr}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 2 Columns: Selected Service Detail & Approved FAQs */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex items-start justify-between pb-4 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-slate-900 text-lg">{selectedService.nameAr}</h3>
                <span className="text-xs text-slate-400 font-mono">({selectedService.nameEn})</span>
              </div>
              <p className="text-xs text-emerald-700 font-bold mt-1">
                {isAr ? 'الطبيب المسؤول:' : 'Lead Doctor:'} {selectedService.doctorInChargeAr}
              </p>
            </div>
            <div className="text-end">
              <div className="text-xs text-slate-400">{isAr ? 'الكلفة المعتمدة في بغداد:' : 'Price Range:'}</div>
              <div className="text-sm font-black text-emerald-800">{selectedService.priceRangeIQD}</div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                {isAr ? 'الوصف السريري والإجراءات:' : 'Clinical Description:'}
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                {selectedService.descriptionAr}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] font-bold text-slate-500 block mb-1">
                  {isAr ? 'مدة العلاج المتوقعة:' : 'Expected Duration:'}
                </span>
                <span className="text-xs font-semibold text-slate-800">
                  {selectedService.durationInfoAr}
                </span>
              </div>

              {selectedService.guaranteeAr && (
                <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200">
                  <span className="text-[11px] font-bold text-emerald-800 block mb-1">
                    {isAr ? 'الضمان والمتابعة:' : 'Warranty & Follow-up:'}
                  </span>
                  <span className="text-xs font-semibold text-emerald-950">
                    {selectedService.guaranteeAr}
                  </span>
                </div>
              )}
            </div>

            {/* Approved FAQs Grounding the Assistant */}
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
                <span>{isAr ? 'الأسئلة الشائعة المعتمدة للذكاء الاصطناعي:' : 'Approved Iraqi Dialect FAQs:'}</span>
              </h4>

              <div className="space-y-2.5">
                {selectedService.faqs.map((faq, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1.5">
                    <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-800 text-[10px] flex items-center justify-center font-bold">
                        س
                      </span>
                      <span>{faq.qAr}</span>
                    </div>
                    <div className="text-xs text-slate-600 ps-5 leading-relaxed bg-slate-50/60 p-2 rounded-lg font-sans">
                      {faq.aAr}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

