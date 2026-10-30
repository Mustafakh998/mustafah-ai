import React, { useState } from 'react';
import {
  Sparkles,
  Bot,
  User,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  MessageSquare,
  Users,
  CalendarCheck,
  TrendingUp,
  Clock,
  Eye,
  Share2,
  DollarSign,
  Play,
  RotateCcw,
  Sliders,
  ExternalLink,
  Code,
  Heart,
  Bookmark,
  Check,
  FileText,
  Lock,
} from 'lucide-react';
import { InstagramIcon } from '@/components/icons/InstagramIcon';
import { AppState } from '@/lib/store';
import { NavTabId } from '@/types';

interface PilotDemoViewProps {
  state: AppState;
  onNavigate: (tab: NavTabId) => void;
  onOpenSimulateModal: () => void;
}

export const PilotDemoView: React.FC<PilotDemoViewProps> = ({
  state,
  onNavigate,
  onOpenSimulateModal,
}) => {
  const isAr = state.currentLanguage === 'ar';
  const [activeStep, setActiveStep] = useState<number>(1);
  const [showJsonPayload, setShowJsonPayload] = useState<boolean>(false);
  const [isHumanTakeoverActive, setIsHumanTakeoverActive] = useState<boolean>(false);
  const [demoScenario, setDemoScenario] = useState<'ortho' | 'emergency' | 'whitening'>('ortho');

  const STEPS = [
    {
      num: 1,
      id: 'inbound',
      titleAr: '١. وصول رسالة الإنستغرام (DM)',
      titleEn: '1. Inbound Instagram DM',
      descAr: 'استلام الرسالة فورياً عبر Meta Webhook الرسمي',
      descEn: 'Instant receipt via official Meta Webhook v21.0',
    },
    {
      num: 2,
      id: 'nlp',
      titleAr: '٢. فهم اللهجة البغدادية (NLP)',
      titleEn: '2. Iraqi Dialect Analysis',
      descAr: 'تحليل المصطلحات البغدادية وتصنيف نية المراجع بدقة',
      descEn: 'Baghdad slang parsing & intent classification',
    },
    {
      num: 3,
      id: 'grounded_ai',
      titleAr: '٣. رد الدكتور الذكي والمعتمد',
      titleEn: '3. Grounded Brand AI Reply',
      descAr: 'شرح طبيب أسنان يشرحلك قبل لا يعالجك وبلا وعود كاذبة',
      descEn: 'Educational, non-prescriptive persona response',
    },
    {
      num: 4,
      id: 'qualification',
      titleAr: '٤. تأهيل المراجع التلقائي',
      titleEn: '4. Lead Qualification',
      descAr: 'تقييم جدية المراجع واستخراج نوع العلاج والمدينة',
      descEn: 'Lead scoring and treatment requirement extraction',
    },
    {
      num: 5,
      id: 'takeover',
      titleAr: '٥. التدخل البشري الفوري',
      titleEn: '5. Human Takeover Protocol',
      descAr: 'تحويل سلس لموظف الاستقبال عند طلب المراجع أو الحالات الخاصة',
      descEn: 'Seamless staff takeover for clinical/specific requests',
    },
    {
      num: 6,
      id: 'crm',
      titleAr: '٦. مزامنة الـ CRM والكانبان',
      titleEn: '6. Live CRM Kanban Sync',
      descAr: 'تسجيل المراجع آلياً في خط المبيعات ومتابعة اهتمامه',
      descEn: 'Automated pipeline ingestion with full audit trail',
    },
    {
      num: 7,
      id: 'appointment',
      titleAr: '٧. تسجيل رغبة الحجز بأمان',
      titleEn: '7. Safe Appointment Request',
      descAr: 'تسجيل الموعد للاستقبال دون إعطاء تأكيد زائف لشاغر الكرسي',
      descEn: 'Logging chair request without false clinical promises',
    },
    {
      num: 8,
      id: 'attribution',
      titleAr: '٨. قياس العائد وجدوى الإعلان',
      titleEn: '8. Attribution & ROI Metrics',
      descAr: 'ربط الحجز بالريلز ومحاسبة تكلفة المراجع الفعلي (<$100)',
      descEn: 'Reel attribution, conversion tracking & unit economics',
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner: Management Presentation Header */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-emerald-500/30 relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -left-16 -bottom-16 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                {isAr ? 'عرض عملي تفاعلي للإدارة' : 'Executive Management Demonstration'}
              </span>
              <span className="bg-slate-800 text-slate-300 text-[11px] font-mono px-2.5 py-1 rounded-full">
                {isAr ? 'حساب التجربة: @drmustafa_hadi' : 'Pilot: @drmustafa_hadi'}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">{isAr ? 'اختر سيناريو العرض:' : 'Demo Scenario:'}</span>
              <div className="bg-slate-800/80 p-1 rounded-xl border border-slate-700 flex gap-1 text-xs">
                <button
                  onClick={() => setDemoScenario('ortho')}
                  className={`px-3 py-1 rounded-lg font-medium transition-all ${
                    demoScenario === 'ortho'
                      ? 'bg-emerald-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {isAr ? 'استفسار تقويم وأقساط' : 'Orthodontics & Installments'}
                </button>
                <button
                  onClick={() => setDemoScenario('whitening')}
                  className={`px-3 py-1 rounded-lg font-medium transition-all ${
                    demoScenario === 'whitening'
                      ? 'bg-emerald-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {isAr ? 'تبييض وتجميل' : 'Teeth Whitening'}
                </button>
                <button
                  onClick={() => setDemoScenario('emergency')}
                  className={`px-3 py-1 rounded-lg font-medium transition-all ${
                    demoScenario === 'emergency'
                      ? 'bg-red-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {isAr ? 'ألم طارئ (وجع سن)' : 'Urgent Tooth Pain'}
                </button>
              </div>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-2">
            {isAr
              ? 'رحلة المراجع من ريل الإنستغرام إلى كرسي العيادة'
              : 'Patient Conversion Journey: From Reel to Dental Chair'}
          </h1>
          <p className="text-sm text-slate-300 max-w-3xl leading-relaxed">
            {isAr
              ? 'عرض عملي متكامل يوضح لإدارة عيادة المسواك كيف يقوم النظام بتحويل استفسارات الإنستغرام المهدرة إلى مواعيد مؤكدة بنسبة تحويل تتجاوز 40%، مع حماية أطباء العيادة من الإحراج الطبي والوعود الخاطئة.'
              : 'Interactive demonstration showing clinic leadership how automated DM triage converts wasted inquiries into confirmed chair visits without sacrificing clinical integrity or brand reputation.'}
          </p>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800/80 text-center">
            <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/50">
              <div className="text-xs text-slate-400">{isAr ? 'كلفة المراجع المؤهل' : 'Cost per Qualified Lead'}</div>
              <div className="text-lg font-black text-emerald-400 font-mono mt-0.5">$2.02</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/50">
              <div className="text-xs text-slate-400">{isAr ? 'سرعة الاستجابة' : 'Avg. Response Time'}</div>
              <div className="text-lg font-black text-teal-300 font-mono mt-0.5">&lt; 3 {isAr ? 'ثوانٍ' : 'sec'}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/50">
              <div className="text-xs text-slate-400">{isAr ? 'معدل الحضور للعيادة' : 'Attended Conversion'}</div>
              <div className="text-lg font-black text-emerald-400 font-mono mt-0.5">66.7%</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/50">
              <div className="text-xs text-slate-400">{isAr ? 'الميزانية الإعلانية' : 'Monthly Ad Budget'}</div>
              <div className="text-lg font-black text-blue-400 font-mono mt-0.5">&lt; $100 / mo</div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive 8-Step Navigation Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-sm">
        <div className="flex items-center justify-between px-3 py-1 mb-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            {isAr ? 'مراحل خط التحويل (اختر المرحلة للمعاينة):' : 'Conversion Stages (Click to inspect):'}
          </span>
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
            {isAr ? `المرحلة ${activeStep} من ٨` : `Step ${activeStep} of 8`}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {STEPS.map((step) => {
            const isCurrent = activeStep === step.num;
            const isCompleted = activeStep > step.num;

            return (
              <button
                key={step.id}
                onClick={() => setActiveStep(step.num)}
                className={`p-2.5 rounded-xl text-start transition-all border relative flex flex-col justify-between ${
                  isCurrent
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-500/30'
                    : isCompleted
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100/70'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 ${
                      isCurrent
                        ? 'bg-white text-emerald-700'
                        : isCompleted
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {isCompleted ? '✓' : step.num}
                  </span>
                </div>
                <div className="text-xs font-bold truncate">
                  {isAr ? step.titleAr.split('. ')[1] : step.titleEn.split('. ')[1]}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Step Detail Stage */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Step Top Bar */}
        <div className="p-6 border-b border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                {isAr ? `المرحلة رقم ${activeStep}` : `Stage #${activeStep}`}
              </span>
              <h2 className="text-xl font-black text-slate-900">
                {isAr ? STEPS[activeStep - 1].titleAr : STEPS[activeStep - 1].titleEn}
              </h2>
            </div>
            <p className="text-xs text-slate-500">
              {isAr ? STEPS[activeStep - 1].descAr : STEPS[activeStep - 1].descEn}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveStep((prev) => Math.max(1, prev - 1))}
              disabled={activeStep === 1}
              className="p-2 rounded-xl border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700"
              title={isAr ? 'المرحلة السابقة' : 'Previous Step'}
            >
              <ArrowRight className={`w-4 h-4 ${isAr ? '' : 'rotate-180'}`} />
            </button>
            <button
              onClick={() => setActiveStep((prev) => Math.min(8, prev + 1))}
              disabled={activeStep === 8}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-sm"
            >
              <span>{isAr ? 'المرحلة التالية' : 'Next Stage'}</span>
              <ArrowLeft className={`w-4 h-4 ${isAr ? '' : 'rotate-180'}`} />
            </button>
          </div>
        </div>

        {/* Step Body Content */}
        <div className="p-6 sm:p-8">
          {/* STEP 1: Inbound DM */}
          {activeStep === 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 space-y-4">
                <div className="p-4 rounded-2xl bg-slate-900 text-white font-mono text-xs shadow-inner">
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800 text-slate-400">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>Meta Webhook Handshake (Verified)</span>
                    </span>
                    <button
                      onClick={() => setShowJsonPayload(!showJsonPayload)}
                      className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
                    >
                      <Code className="w-3.5 h-3.5" />
                      <span>{showJsonPayload ? 'إخفاء الـ JSON' : 'عرض الـ JSON الأصلي'}</span>
                    </button>
                  </div>

                  {showJsonPayload ? (
                    <pre className="text-emerald-400 text-[11px] overflow-x-auto p-2 bg-slate-950 rounded-lg max-h-60">
{`{
  "object": "instagram",
  "entry": [
    {
      "id": "17841400012345678",
      "time": 1730248920,
      "messaging": [
        {
          "sender": { "id": "user_sarah_iq_984" },
          "recipient": { "id": "drmustafa_hadi" },
          "timestamp": 1730248920150,
          "message": {
            "mid": "m_mid.1730248920:f294ab1",
            "text": "${
              demoScenario === 'ortho'
                ? 'سلام دكتور مصطفى.. شكد سعر التقويم ويصير اقساط؟ عندي عضة مفتوحة'
                : demoScenario === 'whitening'
                ? 'مرحبا دكتور.. شكد سعر التبييض وشكد يطول؟ يوجع لو لا؟'
                : 'دكتور سن العقل طالع بيه ورم ووجع يموت ما انام الليل شنو اسوي؟'
            }"
          }
        }
      ]
    }
  ]
}`}
                    </pre>
                  ) : (
                    <div className="space-y-2 text-slate-300">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Event:</span>
                        <span className="text-emerald-400 font-bold">messages (Meta Graph API v21.0)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Recipient:</span>
                        <span className="text-white font-semibold">@drmustafa_hadi (ID: 17841400012345678)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Sender:</span>
                        <span className="text-white font-semibold">@sarah_aliraqi (Sarah Al-Saadi)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Received Text:</span>
                        <span className="text-amber-300 font-sans font-medium text-xs">
                          {demoScenario === 'ortho'
                            ? '"سلام دكتور مصطفى.. شكد سعر التقويم ويصير اقساط؟ عندي عضة مفتوحة"'
                            : demoScenario === 'whitening'
                            ? '"مرحبا دكتور.. شكد سعر التبييض وشكد يطول؟ يوجع لو لا؟"'
                            : '"دكتور سن العقل طالع بيه ورم ووجع يموت ما انام الليل شنو اسوي؟"'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 leading-relaxed">
                  <div className="flex items-center gap-2 font-bold mb-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>{isAr ? 'توثيق رسمي وأمان كامل' : 'Official Authentication'}</span>
                  </div>
                  <p>
                    {isAr
                      ? 'الرسالة تصل إلى نظام ALMESWAK AI خلال 300 مللي ثانية فقط عبر البنية التحتية الرسمية لـ Meta، دون استخدام أي برامج طرف ثالث غير مصرحة أو طلب كلمة المرور.'
                      : 'Incoming DMs trigger official webhooks with zero scraping or unsafe password storage.'}
                  </p>
                </div>
              </div>

              {/* Instagram Mock Phone Preview */}
              <div className="lg:col-span-5 flex justify-center">
                <div className="w-full max-w-xs bg-slate-900 rounded-[2.5rem] p-3 shadow-2xl border-4 border-slate-800">
                  <div className="w-full bg-slate-950 rounded-[2rem] overflow-hidden flex flex-col h-[380px] border border-slate-800">
                    {/* IG Chat Header */}
                    <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-white">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-xs">
                          م
                        </div>
                        <div>
                          <div className="text-xs font-bold">drmustafa_hadi</div>
                          <div className="text-[10px] text-emerald-400">Active now</div>
                        </div>
                      </div>
                      <InstagramIcon className="w-4 h-4 text-slate-400" />
                    </div>

                    {/* IG Chat Messages */}
                    <div className="flex-1 p-3 space-y-3 overflow-y-auto text-xs bg-slate-950">
                      <div className="text-center text-[10px] text-slate-500 my-1">Today 3:42 PM</div>
                      <div className="flex justify-start">
                        <div className="max-w-[85%] bg-slate-800 text-slate-100 rounded-2xl rounded-tl-sm px-3.5 py-2.5 shadow-sm text-xs leading-relaxed">
                          {demoScenario === 'ortho'
                            ? 'سلام دكتور مصطفى.. شكد سعر التقويم ويصير اقساط؟ عندي عضة مفتوحة وأسناني متراكبة'
                            : demoScenario === 'whitening'
                            ? 'مرحبا دكتور.. شكد سعر التبييض وشكد يطول؟ يوجع لو لا؟'
                            : 'دكتور سن العقل طالع بيه ورم ووجع يموت ما انام الليل شنو اسوي؟'}
                        </div>
                      </div>
                    </div>

                    <div className="p-2.5 bg-slate-900 border-t border-slate-800 text-center text-[11px] text-slate-400">
                      {isAr ? 'تم استلام الرسالة في النظام' : 'Message Captured'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Iraqi NLP */}
          {activeStep === 2 && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <h3 className="font-bold text-slate-900 text-sm mb-3">
                  {isAr ? 'المعالجة اللغوية للهجة البغدادية (Baghdad NLP Parser):' : 'Baghdad Dialect Processing:'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <div className="text-slate-500 mb-1">{isAr ? 'النية المستخلصة (Intent):' : 'Classified Intent:'}</div>
                    <div className="text-emerald-700 font-bold text-sm font-mono flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-600" />
                      {demoScenario === 'ortho'
                        ? 'orthodontic_inquiry'
                        : demoScenario === 'whitening'
                        ? 'consultation_request'
                        : 'urgent_clinical_question'}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">Confidence Score: 98.4%</div>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <div className="text-slate-500 mb-1">{isAr ? 'المصطلحات العراقية المكتشفة:' : 'Detected Slang/Terms:'}</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {demoScenario === 'ortho' ? (
                        <>
                          <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[11px] font-semibold">شكد سعر</span>
                          <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[11px] font-semibold">اقساط</span>
                          <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[11px] font-semibold">عضة مفتوحة</span>
                          <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[11px] font-semibold">متراكبة</span>
                        </>
                      ) : demoScenario === 'whitening' ? (
                        <>
                          <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[11px] font-semibold">تبييض</span>
                          <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[11px] font-semibold">شكد يطول</span>
                          <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[11px] font-semibold">يوجع لو لا</span>
                        </>
                      ) : (
                        <>
                          <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded text-[11px] font-semibold">وجع يموت</span>
                          <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded text-[11px] font-semibold">سن العقل</span>
                          <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded text-[11px] font-semibold">ورم</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <div className="text-slate-500 mb-1">{isAr ? 'حالة الطوارئ والحساسية:' : 'Urgency Level:'}</div>
                    <div className={`font-bold text-sm ${demoScenario === 'emergency' ? 'text-red-600' : 'text-slate-800'}`}>
                      {demoScenario === 'emergency'
                        ? '🚨 حالة طارئة — إشعار مباشر للاستقبال'
                        : 'عادي — استفسار علاجي تحويلي'}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">Sentiment: +0.76 (High Interest)</div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900">
                <div className="font-bold flex items-center gap-1.5 mb-1">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  <span>{isAr ? 'ميزة المحرك العراقي المطور:' : 'Dialect Robustness:'}</span>
                </div>
                <p>
                  {isAr
                    ? 'المحرك لا يعتمد على فصحى مصطنعة أو ترجمة حرفية من الإنجليزية. يفهم الكلمات البغدادية (كشفية، عضة، بلاتين، سحب عصب، حشوة ضوئية، تلبيس زيركون، دامون، فك سفلي) ولا يخطئ في تصنيف السؤال.'
                    : 'Engine handles Baghdad nuances natively, preventing frustrating generic AI responses.'}
                </p>
              </div>
            </div>
          )}

          {/* STEP 3: Grounded AI Response */}
          {activeStep === 3 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Persona & Guardrails Rules */}
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <Bot className="w-4 h-4 text-emerald-600" />
                    <span>{isAr ? 'قواعد الشخصية والضوابط الطبية:' : 'Persona & Guardrails:'}</span>
                  </h3>

                  <ul className="space-y-2 text-xs text-slate-700">
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-600 font-bold">✓</span>
                      <span>
                        <strong>هوية الدكتور:</strong> "د. مصطفى هادي — طبيب أسنان يشرحلك قبل لا يعالجك".
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-600 font-bold">✓</span>
                      <span>
                        <strong>الأسعار المعتمدة:</strong> ذكر نطاق السعر المعتمد (1,000,000 - 1,500,000 د.ع) دون تأكيد رقم نهائي قبل الفحص السريري.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-600 font-bold">✓</span>
                      <span>
                        <strong>شفافية الأقساط:</strong> توضيح توفر الأقساط الشهرية المريحة مع كل موعد شد.
                      </span>
                    </li>
                    <li className="flex items-start gap-2 text-red-700 font-semibold bg-red-50 p-2 rounded-lg border border-red-200">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                      <span>
                        <strong>مانع التجاوز الطبي:</strong> منع تشخيص الأشعة أو وصف أدوية ومسكنات أو إعطاء وعود مطلقة مثل "سنك ينعدل بشهرين".
                      </span>
                    </li>
                  </ul>
                </div>

                {/* Actual Generated Response */}
                <div className="p-5 rounded-2xl bg-emerald-950 text-white space-y-3 border border-emerald-800 shadow-md">
                  <div className="flex items-center justify-between text-xs text-emerald-400 pb-2 border-b border-emerald-900">
                    <span className="font-bold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      {isAr ? 'الرد المولّد تلقائياً (اللهجة البغدادية الدافئة):' : 'Generated Response:'}
                    </span>
                    <span className="font-mono text-[11px]">latency: 1.2s</span>
                  </div>

                  <p className="text-xs leading-relaxed text-slate-100 whitespace-pre-line font-sans">
                    {demoScenario === 'ortho'
                      ? `أهلاً وسهلاً بيج سارة نورتي 🌸\n\nبالنسبة للعضة المفتوحة وتراكب الأسنان، فهذا تخصصنا الدقيق بدراسة حركة الفكين وأجهزة التقويم.\n\nالتقويم الثابت يمنا يبدأ من 1,000,000 إلى 1,500,000 دينار عراقي حسب نوع الحاصرات وحالة الفك، وأكيد متوفر نظام أقساط مريحة جداً (مقدمة بسيطة وباقي المبلغ أقساط شهرية ويه كل جلسة شد).\n\nبس مثل ما نكول دائماً: "طبيب أسنان يشرحلك قبل لا يعالجك".. فالتشخيص الصحيح وخطة العلاج لازم تكون بعد فحص سريري وأشعة بالعيادة حتى نحدد الأنسب الج.\n\nتحبين نسجل رغبتج بزيارة كشفية بالعيادة ونرتب الموعد المناسب وياج؟ 🦷`
                      : demoScenario === 'whitening'
                      ? `أهلاً وسهلاً بيج سارة نورتي 🌸\n\nتبييض الأسنان بالعيادة نستخدم بيه أحدث تقنية زووم (Philips Zoom) بجلسة وحدة مدتها 45 دقيقة تقريباً، وتنطيج من 4 إلى 8 درجات أفتح وبدون ألم أو تحسس مزعج.\n\nسعر الجلسة يبدأ من 120,000 إلى 180,000 دينار عراقي.\n\nتحبين نسجل رغبتج بموعد بالعيادة وننسق وياج الوقت المناسب؟ 🦷`
                      : `أهلاً وسهلاً.. سلامات وألف سلامة عليك ما تشوف شر 🌸\n\nوجع سن العقل مع الورم يعتبر حالة طارئة تحتاج فحص سريري مباشر بالعيادة للتأكد من عدم وجود التهاب حول التاج (Pericoronitis)، وممنوع أخذ أي مضاد حيوي بدون وصفة الطبيب.\n\nكإجراء أولي لحين وصولك للعيادة: تقدر تستخدم مضمضة مي وملح دافي، وبندول أو بروفين كمسكن بسيط فقط.\n\nعيادة المسواك مفتوحة يومياً من 1:00 ظهراً إلى 9:00 مساءً (زيونة - خدمي دريم سيتي مول). تكدر تتصل فوراً برقم الطوارئ والحجز: 07768886667 أو نسجلك أسبقية حجز حالاً؟ 🚨`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Lead Qualification */}
          {activeStep === 4 && (
            <div className="space-y-6">
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                  <h3 className="font-bold text-slate-900 text-sm">
                    {isAr ? 'بطاقة تأهيل المراجع التلقائية (Lead Score: 88/100):' : 'Lead Qualification Card:'}
                  </h3>
                  <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-3 py-1 rounded-full w-fit">
                    {isAr ? 'مؤهل عالي الجدية (Qualified Lead)' : 'High Priority Lead'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <span className="text-slate-400 block mb-0.5">{isAr ? 'اسم المراجع:' : 'Patient Name:'}</span>
                    <span className="font-bold text-slate-800">سارة السعدي</span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <span className="text-slate-400 block mb-0.5">{isAr ? 'العلاج المطلوب:' : 'Treatment:'}</span>
                    <span className="font-bold text-emerald-700">تقويم أسنان ثابت (عضة مفتوحة)</span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <span className="text-slate-400 block mb-0.5">{isAr ? 'القدرة المالية:' : 'Budget Readiness:'}</span>
                    <span className="font-bold text-slate-800">مهتم بنظام الأقساط الميسرة</span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200">
                    <span className="text-slate-400 block mb-0.5">{isAr ? 'المدينة / المنطقة:' : 'Location:'}</span>
                    <span className="font-bold text-slate-800">بغداد – المنصور / الكرخ</span>
                  </div>
                </div>

                <div className="mt-4 p-4 rounded-xl bg-white border border-slate-200 text-xs text-slate-600">
                  <span className="font-bold text-slate-800">{isAr ? 'ملاحظة الذكاء الاصطناعي للاستقبال: ' : 'AI Reception Note: '}</span>
                  {isAr
                    ? 'المراجعة واعية ومحددة لمشكلتها (عضة مفتوحة)، استفسرت عن الأقساط بعد مشاهدة ريل دكتور مصطفى حول أسعار التقويم. فرصة التحويل إلى كشف سريري تزيد عن 85%.'
                    : 'Patient is well-informed, responding to Dr. Mustafa Reel #1, ready for clinical consult.'}
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Human Takeover */}
          {activeStep === 5 && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-amber-950 text-sm flex items-center gap-2">
                      <Users className="w-4 h-4 text-amber-600" />
                      <span>{isAr ? 'بروتوكول تحويل المحادثة لموظف الاستقبال (Human Escalation)' : 'Human Takeover'}</span>
                    </h3>
                    <p className="text-xs text-amber-800 mt-1">
                      {isAr
                        ? 'إذا طلب المراجع التحدث مع موظف، أو طرح سؤالاً شخصياً عن دوام الدكتور، يوقف النظام الردود الآلية فوراً.'
                        : 'Instant transition to human staff upon request or complex clinical questions.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-amber-300 shadow-sm w-fit">
                    <span className="text-xs font-bold text-slate-700">
                      {isHumanTakeoverActive ? (isAr ? 'وضع الموظف البشري' : 'Human Mode') : (isAr ? 'الذكاء الآلي نشط' : 'AI Mode')}
                    </span>
                    <button
                      onClick={() => setIsHumanTakeoverActive(!isHumanTakeoverActive)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        isHumanTakeoverActive ? 'bg-amber-600' : 'bg-emerald-600'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                          isHumanTakeoverActive ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-amber-200 text-xs space-y-2">
                  <div className="font-bold text-slate-800">{isAr ? 'رسالة المراجع التي فعّلت التحويل:' : 'Trigger Message:'}</div>
                  <div className="p-2.5 rounded-lg bg-slate-100 text-slate-800 font-medium">
                    "زين دكتور انت متواجد بالعيادة السبت العصر؟ اريد افحص يمك شخصياً مو يم دكتور ثاني"
                  </div>
                  <div className="flex items-center gap-2 text-emerald-700 font-semibold text-[11px] pt-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      {isAr
                        ? 'تم إرسال إشعار فوري لمكتب الاستقبال: "المراجعة سارة ترغب بتأكيد حضور د. مصطفى يوم السبت"'
                        : 'Alert dispatched to clinic desk for scheduling confirmation.'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: CRM Kanban */}
          {activeStep === 6 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-sm">
                  {isAr ? 'موقع المراجع في خط مبيعات العيادة (CRM Pipeline):' : 'CRM Pipeline Live Status:'}
                </h3>
                <button
                  onClick={() => onNavigate('leads_crm')}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1"
                >
                  <span>{isAr ? 'فتح شاشة إدارة المراجعين الكاملة' : 'Open Full CRM'}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Mini Kanban View */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                <div className="bg-slate-100 p-3 rounded-2xl border border-slate-200 opacity-60">
                  <div className="font-bold text-slate-600 mb-2">{isAr ? 'استفسار جديد' : 'New Inquiries'} (1)</div>
                  <div className="p-2.5 bg-white rounded-xl shadow-sm border border-slate-200 text-slate-400">
                    علي الكرخي (استفسار زراعة)
                  </div>
                </div>

                <div className="bg-emerald-50 p-3 rounded-2xl border-2 border-emerald-500 shadow-sm">
                  <div className="font-bold text-emerald-800 mb-2 flex items-center justify-between">
                    <span>{isAr ? 'مؤهل للمعاينة' : 'Qualified'} (3)</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  </div>
                  <div className="p-3 bg-white rounded-xl shadow-md border border-emerald-300 space-y-1.5">
                    <div className="flex items-center justify-between font-bold text-slate-900">
                      <span>سارة السعدي</span>
                      <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">تقويم</span>
                    </div>
                    <div className="text-[11px] text-slate-500">@sarah_aliraqi • 0771XXXXXXX</div>
                    <div className="text-[10px] text-slate-400">المصدر: Reel #1 (أسعار التقويم)</div>
                  </div>
                </div>

                <div className="bg-slate-100 p-3 rounded-2xl border border-slate-200">
                  <div className="font-bold text-slate-600 mb-2">{isAr ? 'طلب موعد' : 'Appointment Requested'} (2)</div>
                  <div className="p-2.5 bg-white rounded-xl shadow-sm border border-slate-200 text-slate-600">
                    زينب م. (السبت 5:00 م)
                  </div>
                </div>

                <div className="bg-slate-100 p-3 rounded-2xl border border-slate-200">
                  <div className="font-bold text-slate-600 mb-2">{isAr ? 'حضر وتلقى العلاج' : 'Attended'} (4)</div>
                  <div className="p-2.5 bg-white rounded-xl shadow-sm border border-slate-200 text-emerald-700 font-semibold">
                    حيدر جاسم (بدأ التقويم)
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 7: Safe Appointment Request */}
          {activeStep === 7 && (
            <div className="space-y-6">
              <div className="p-5 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-blue-950 text-sm flex items-center gap-2">
                    <CalendarCheck className="w-4 h-4 text-blue-600" />
                    <span>{isAr ? 'تسجيل طلب الموعد دون ادعاء توفر الكرسي' : 'Safe Chair Request Workflow'}</span>
                  </h3>
                  <span className="text-xs font-bold text-blue-700 bg-blue-100 px-3 py-1 rounded-full">
                    Status: new_request
                  </span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-blue-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block mb-0.5">{isAr ? 'الموعد المفضل للمراجع:' : 'Preferred Window:'}</span>
                    <span className="font-bold text-slate-800">السبت العصر (4:00 - 6:00 مساءً)</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">{isAr ? 'الطبيب المطلوب:' : 'Requested Doctor:'}</span>
                    <span className="font-bold text-emerald-700">د. مصطفى هادي (تقويم أسنان)</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">{isAr ? 'مقر العيادة المطلوب:' : 'Clinic Branch:'}</span>
                    <span className="font-bold text-slate-800">بغداد – زيونة (دريم سيتي)</span>
                  </div>
                </div>

                {/* Important Medical Guardrail Shield */}
                <div className="p-3.5 bg-slate-900 rounded-xl text-white text-xs space-y-1.5">
                  <div className="font-bold text-amber-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                    <span>{isAr ? 'الضمان الطبي الصارم (عدم إعطاء تأكيد زائف):' : 'Clinical Non-Prescriptive Guardrail:'}</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    {isAr
                      ? 'الذكاء الاصطناعي لا يكتب للمراجع أبداً "تم تأكيد موعدك النهائي للسبت الساعة 5"! بل يكتب بوضوح: "تم تسجيل رغبتج بالموعد يوم السبت.. موظف الاستقبال راح يتصل بيج على رقمج لتأكيد الحجز النهائي والتنسيق حسب فراغ الكرسي". هذا يحمي العيادة بنسبة 100% من تضارب المواعيد وإحراج المرضى.'
                      : 'System explicitly records the request without pretending to confirm chair availability, awaiting reception review.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 8: Attribution & ROI Metrics */}
          {activeStep === 8 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Reel Attribution Box */}
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    <span>{isAr ? 'إسناد المراجع إلى المحتوى الإعلاني:' : 'Reel Attribution:'}</span>
                  </h3>

                  <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs space-y-2">
                    <div className="font-bold text-slate-800">
                      Reel #1: "ليش أسعار التقويم تختلف ببغداد؟ منو ديحدد السعر الحقيقي؟"
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-slate-600 pt-2 border-t border-slate-100">
                      <div>
                        <div className="font-bold text-slate-900">106,400</div>
                        <div className="text-[10px] text-slate-400">مشاهدة</div>
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">4,210</div>
                        <div className="text-[10px] text-slate-400">إعجاب</div>
                      </div>
                      <div>
                        <div className="font-bold text-emerald-600">684</div>
                        <div className="text-[10px] text-slate-400">مشاركة (Send)</div>
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-slate-600 leading-relaxed">
                    {isAr
                      ? 'أكثر من 72% من الرسائل الواردة انطلقت بعد مشاهدة هذا الريل مباشرة أو استخدام الكلمة المفتاحية في التعليقات، مما يثبت نجاح أسلوب "طبيب يشرحلك قبل لا يعالجك".'
                      : 'Over 72% of inbound conversations originated from this educational reel.'}
                  </div>
                </div>

                {/* Economics & ROI Box */}
                <div className="p-5 rounded-2xl bg-emerald-950 text-white space-y-4 shadow-md border border-emerald-800">
                  <h3 className="font-bold text-emerald-400 text-sm flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    <span>{isAr ? 'الجدوى الاقتصادية والعائد على الاستثمار (ROI):' : 'Unit Economics & ROI:'}</span>
                  </h3>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-emerald-900">
                      <span className="text-slate-300">ميزانية الإعلانات الشهرية:</span>
                      <span className="font-mono font-bold text-white">$85.00 / شهر</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-emerald-900">
                      <span className="text-slate-300">المراجعون المؤهلون (Qualified):</span>
                      <span className="font-mono font-bold text-white">42 مراجعاً</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-emerald-900">
                      <span className="text-slate-300">طلبات المواعيد المرفوعة للاستقبال:</span>
                      <span className="font-mono font-bold text-white">18 طلباً</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-emerald-900">
                      <span className="text-slate-300">المراجعون الحاضرون للعيادة فعلياً:</span>
                      <span className="font-mono font-bold text-emerald-400">12 مراجعاً</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-emerald-900">
                      <span className="text-slate-300">كلفة استقطاب المراجع الحاضر (CAC):</span>
                      <span className="font-mono font-bold text-teal-300">$7.08 للمريض</span>
                    </div>
                    <div className="flex justify-between pt-2">
                      <span className="text-slate-200 font-bold">العائد المالي المتوقع للعيادة:</span>
                      <span className="font-mono font-black text-emerald-400 text-sm">12M – 18M د.ع</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Step Bottom Controls */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-slate-500">
            {isAr
              ? '💡 يمكنك في أي وقت تجربة محاكاة رسالة حقيقية من مراجع بغدادي وملاحظة رد النظام فورياً'
              : '💡 Test live inbound Iraqi Arabic messages any time via the simulation button'}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenSimulateModal}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isAr ? 'تجربة رسالة جديدة الآن' : 'Simulate Live DM'}</span>
            </button>
            <button
              onClick={() => onNavigate('inbox')}
              className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{isAr ? 'صندوق المحادثات الحية' : 'Live Inbox'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Clinic Management Proposal Quick Action Card */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 text-white border border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-400" />
            <span>{isAr ? 'تقرير الإدارة ومقترح توسعة عيادة المسواك' : 'Management Proposal & Expansion Plan'}</span>
          </h3>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            {isAr
              ? 'تم إعداد وثيقة العرض الكاملة وجدوى توسعة النظام ليشمل كافة تخصصات العيادة (الأطفال، ابتسامة هوليوود، الحشوات، وتجميل الوجه) بعد نجاح تجربة د. مصطفى هادي.'
              : 'Detailed management proposal ready for Almeswak Dental Clinic leadership review.'}
          </p>
        </div>

        <button
          onClick={() => onNavigate('overview')}
          className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-5 py-2.5 rounded-xl text-xs shrink-0 transition-all shadow-md flex items-center gap-2"
        >
          <span>{isAr ? 'الاطلاع على لوحة الأداء' : 'View Executive Dashboard'}</span>
          <ArrowLeft className={`w-4 h-4 ${isAr ? '' : 'rotate-180'}`} />
        </button>
      </div>
    </div>
  );
};
