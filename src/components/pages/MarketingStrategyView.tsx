import React, { useState } from 'react';
import {
  Compass,
  Video,
  Layers,
  Sparkles,
  MessageSquare,
  DollarSign,
  Star,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Flame,
  Send,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { AppState } from '@/lib/store';
import { CommentAutomationRule, TreatmentType, NavTabId } from '@/types';
import { toast } from '@/lib/toast';

interface MarketingStrategyViewProps {
  state: AppState;
  onNavigate: (tab: NavTabId) => void;
  onToggleCommentRule?: (id: string) => void;
  onAddCommentRule?: (rule: CommentAutomationRule) => void;
  onSendReviewRequest?: (id: string) => void;
  onReengageLead?: (id: string) => void;
}

type StrategySubTab =
  | 'strategy_overview'
  | 'content_matrix'
  | 'boost_blueprint'
  | 'comment_automation'
  | 'google_reviews'
  | 'lapsed_reactivation';

export const MarketingStrategyView: React.FC<MarketingStrategyViewProps> = ({
  state,
  onNavigate,
  onToggleCommentRule,
  onAddCommentRule,
  onSendReviewRequest,
  onReengageLead,
}) => {
  const isAr = state.currentLanguage === 'ar';
  const { commentRules = [], reviewRequests = [], leads = [] } = state;

  const [activeSubTab, setActiveSubTab] = useState<StrategySubTab>('strategy_overview');

  // Comment simulator state
  const [testComment, setTestComment] = useState('');
  const [simulatedMatch, setSimulatedMatch] = useState<{
    rule: CommentAutomationRule | null;
    matched: boolean;
  } | null>(null);

  // New rule modal state
  const [isNewRuleOpen, setIsNewRuleOpen] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');
  const [newPublicReply, setNewPublicReply] = useState('');
  const [newPrivateReply, setNewPrivateReply] = useState('');
  const [newTreatment, setNewTreatment] = useState<TreatmentType>('orthodontics');

  const handleTestComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testComment.trim()) return;

    const lower = testComment.toLowerCase();
    const matchedRule = commentRules.find((r) => r.isActive && lower.includes(r.keyword.toLowerCase()));

    setSimulatedMatch({
      rule: matchedRule || null,
      matched: !!matchedRule,
    });
  };

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword.trim() || !onAddCommentRule) return;

    const newRule: CommentAutomationRule = {
      id: `rule_${Date.now()}`,
      accountId: 'drmustafa_hadi',
      keyword: newKeyword.trim(),
      publicReplyAr: newPublicReply || 'تدلل عيوني 💚 تفاصيل الخطة وصلتك بالخاص ✉️',
      privateDmReplyAr: newPrivateReply || 'أهلاً بك 🌸 للاستفسار عن العلاج وحجز موعد في عيادتنا بزيونة، يا يوم يناسبك ورقم هاتفك؟',
      isActive: true,
      triggersCount: 0,
      targetTreatment: newTreatment,
    };

    onAddCommentRule(newRule);
    setIsNewRuleOpen(false);
    setNewKeyword('');
    setNewPublicReply('');
    setNewPrivateReply('');
  };

  // Find lapsed leads (not yet confirmed or attended, created > 2 days ago or with inquiries)
  const lapsedLeads = leads.filter(
    (l) => l.status === 'new_inquiry' || l.status === 'qualified'
  );

  return (
    <div className="space-y-6 text-start">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-emerald-600 text-white shadow-sm">
              <Compass className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
              GROWTH PLAYBOOK 2026
            </span>
            <span className="text-xs font-mono text-slate-400">@drmustafa_hadi</span>
          </div>
          <h2 className="text-2xl font-black text-slate-900">
            {isAr ? 'استراتيجية التسويق والنمو الشامل (Growth Engine)' : 'Dental Practice Growth Engine & Strategy'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {isAr
              ? 'خطة متكاملة لعيادة د. مصطفى هادي: صناعة المحتوى، ترويج المنشورات، أتمتة التعليقات، تصدر خرائط جوجل، وتنشيط المراجعين القدامى'
              : 'Full-funnel clinical acquisition: 4-format content, micro-boost ads, comment triggers, local SEO, and lapsed lead reactivation.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('content_studio')}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Video className="w-3.5 h-3.5" />
            <span>{isAr ? 'إنشاء محتوى بالاستوديو' : 'Create in Studio'}</span>
          </button>
          <button
            onClick={() => onNavigate('ad_campaigns')}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
          >
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isAr ? 'ترويج منشور / حساب' : 'Boost / Run Ads'}</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-2 scrollbar-none">
        {[
          { id: 'strategy_overview', labelAr: 'نظرة عامة على القمع', labelEn: 'Funnel Overview', icon: Compass },
          { id: 'content_matrix', labelAr: 'مصفوفة المحتوى (4 صيغ)', labelEn: '4-Format Content Matrix', icon: Video },
          { id: 'boost_blueprint', labelAr: 'قاعدة الـ 10% لترويج الإعلانات', labelEn: '10% Boost Blueprint', icon: Flame },
          { id: 'comment_automation', labelAr: 'أتمتة التعليقات (Comment-to-DM)', labelEn: 'Comment-to-DM Triggers', icon: MessageSquare, badge: commentRules.length },
          { id: 'google_reviews', labelAr: 'تقييمات خرائط Google', labelEn: 'Google Maps Local SEO', icon: Star, badge: reviewRequests.length },
          { id: 'lapsed_reactivation', labelAr: 'استعادة المراجعين الخاملين', labelEn: 'Lapsed Reactivation', icon: RefreshCw, badge: lapsedLeads.length },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as StrategySubTab)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-2 transition-all ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{isAr ? tab.labelAr : tab.labelEn}</span>
              {tab.badge !== undefined && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 1. STRATEGY OVERVIEW */}
      {activeSubTab === 'strategy_overview' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Master Funnel Visual Banner */}
          <div className="p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 max-w-3xl space-y-3">
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-500/30 inline-block">
                {isAr ? 'دورة حياة المراجع الكاملة (End-to-End Flywheel)' : 'End-to-End Patient Growth Engine'}
              </span>
              <h3 className="text-xl sm:text-2xl font-black leading-snug">
                {isAr
                  ? 'من مجرد مشاهد عابر في بغداد.. إلى مراجع حقيقي على كرسي العيادة، ثم تقييم 5 نجوم على Google!'
                  : 'From a casual Baghdad viewer.. to a seated dental chair patient, into a 5-star Google review!'}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {isAr
                  ? 'لا نعتمد على الصدفة أو الرسائل المكررة. النظام يربط كل نقطة اتصال بذكاء: المحتوى العضوي يجلب المشاهدات، أتمتة التعليقات تسحب المراجعين إلى الدايركت، الذكاء الاصطناعي العراقي الثلاثي يحجز الموعد، وبعد الزيارة تنطلق دعوة تقييم خرائط جوجل لترسيخ الصدارة في زيونة.'
                  : 'A systematic patient acquisition engine: organic reels build reach, comment triggers route leads to DMs, the 3-tier Iraqi AI books chair appointments, and post-visit reviews solidify Google Maps ranking in Zayouna.'}
              </p>
            </div>

            {/* Step-by-Step Flow Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-6 relative z-10 text-xs">
              <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10 space-y-1.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black">
                  1
                </div>
                <div className="font-bold text-white">{isAr ? 'صناعة المحتوى' : 'Organic Content'}</div>
                <p className="text-[11px] text-slate-400">
                  {isAr ? '3 ريلز + 1 كاروسيل + ستوريات تفاعلية بهوك أول 3 ثواني' : 'High-retention Reels & Carousels with 3s Baghdad hooks.'}
                </p>
              </div>

              <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10 space-y-1.5">
                <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-black">
                  2
                </div>
                <div className="font-bold text-white">{isAr ? 'ترويج الـ 10%' : '10% Micro-Boost'}</div>
                <p className="text-[11px] text-slate-400">
                  {isAr ? 'ترويج الريلز الأكثر تفاعلاً بميزانية < $100 في زيونة والمناطق القريبة' : 'Boost top 10% organic posts to target Baghdad districts.'}
                </p>
              </div>

              <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10 space-y-1.5">
                <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center font-black">
                  3
                </div>
                <div className="font-bold text-white">{isAr ? 'أتمتة التعليقات' : 'Comment-to-DM'}</div>
                <p className="text-[11px] text-slate-400">
                  {isAr ? 'كلمات مفتاحية (تقويم، ابتسامة، حجز) ترسل دليلاً فورياً بالخاص' : 'Triggers send personalized clinical guides instantly in DMs.'}
                </p>
              </div>

              <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10 space-y-1.5">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-black">
                  4
                </div>
                <div className="font-bold text-white">{isAr ? 'تأكيد الحجز بالعيادة' : 'Chair Attendance'}</div>
                <p className="text-[11px] text-slate-400">
                  {isAr ? 'الاستقبال يؤكد الموعد 07768886667 والمراجع يحضر للكشفية' : 'Desk confirms visit; patient arrives at Zayouna clinic.'}
                </p>
              </div>

              <div className="p-3.5 bg-white/5 rounded-2xl border border-white/10 space-y-1.5">
                <div className="w-7 h-7 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center font-black">
                  5
                </div>
                <div className="font-bold text-white">{isAr ? 'تقييم Google Maps' : 'Google Reviews'}</div>
                <p className="text-[11px] text-slate-400">
                  {isAr ? 'رسالة شكر مع رابط تقييم 5 نجوم لرفع ترتيب العيادة محلياً' : 'Automated 5-star review loop drives #1 local SEO ranking.'}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Metrics & KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-xs text-slate-500 font-semibold">{isAr ? 'كلفة المريض الحاضر (CAC)' : 'Attended Patient CAC'}</span>
              <div className="text-2xl font-black text-emerald-950">${state.analytics.costPerAttendedPatientUSD}</div>
              <div className="text-[10px] text-emerald-700 font-bold">{isAr ? 'ممتاز (مقارنة بمتوسط بغداد $25)' : 'Industry-leading (<$25 avg)'}</div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-xs text-slate-500 font-semibold">{isAr ? 'قواعد التعليقات المفعلة' : 'Active Comment Triggers'}</span>
              <div className="text-2xl font-black text-slate-900">{commentRules.filter((r) => r.isActive).length} / {commentRules.length}</div>
              <div className="text-[10px] text-slate-500">{isAr ? 'تستقبل استفسارات 24/7' : 'Running 24/7 on live posts'}</div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-xs text-slate-500 font-semibold">{isAr ? 'تقييمات خرائط Google' : 'Google Review Requests'}</span>
              <div className="text-2xl font-black text-amber-600">5.0 ★</div>
              <div className="text-[10px] text-slate-500">{reviewRequests.length} {isAr ? 'طلبات مرسلة للمراجعين' : 'requests logged'}</div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-1">
              <span className="text-xs text-slate-500 font-semibold">{isAr ? 'مراجعون بانتظار التنشيط' : 'Lapsed Leads to Recover'}</span>
              <div className="text-2xl font-black text-blue-700">{lapsedLeads.length}</div>
              <div className="text-[10px] text-blue-600 font-bold">{isAr ? 'فرصة لإعادة الحجز' : 'High-intent dormant leads'}</div>
            </div>
          </div>
        </div>
      )}

      {/* 2. THE 4-FORMAT CONTENT MATRIX */}
      {activeSubTab === 'content_matrix' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl text-xs text-blue-950 flex items-start gap-3">
            <Video className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm">
                {isAr ? 'مصفوفة صناعة المحتوى وفق خوارزمية إنستغرام 2026' : 'Official Meta 2026 Content Format Matrix'}
              </div>
              <p className="mt-1 leading-relaxed text-blue-900">
                {isAr
                  ? 'لا يمكن لعيادة الأسنان الاعتماد على نوع محتوى واحد فقط. الخوارزمية تتطلب توزيعاً مدروساً: الريلز للاكتشاف، الكاروسيل للحفظ والمصداقية، الستوريات للعلاقة اليومية، والبوستات المفردة لإثبات النتائج السريرية.'
                  : 'Balanced format distribution is mandatory: Reels for reach, Carousels for saves, Stories for daily connection, and Posts for case proof.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Format 1: Reels */}
            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-purple-100 text-purple-700 font-bold">
                    <Video className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{isAr ? '1. ريلز وفيديوهات قصيرة (Reels & Videos)' : '1. Reels & Short Videos'}</h4>
                    <span className="text-[10px] text-purple-600 font-bold">{isAr ? '3 مرات أسبوعياً — التردد الأساسي' : '3x Weekly — Discovery Core'}</span>
                  </div>
                </div>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">9:16 Vertical</span>
              </div>
              <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                <li><strong className="text-slate-800">{isAr ? 'الهدف:' : 'Goal:'}</strong> {isAr ? 'الوصول لآلاف المتابعين الجدد في بغداد عبر ريلز تتجاوز 12 ثانية مشاهدة.' : 'Reach new patients via high watch-time.'}</li>
                <li><strong className="text-slate-800">{isAr ? 'معيار النجاح:' : 'Key Metric:'}</strong> {isAr ? 'معدل المشاركة عبر الخاص (Sends per Reach) > 4%.' : 'Sends-per-reach > 4%.'}</li>
                <li><strong className="text-slate-800">{isAr ? 'أوقات النشر المثالية:' : 'Best Time:'}</strong> {isAr ? '6:00 مساءً إلى 9:30 مساءً بتوقيت بغداد.' : '6:00 PM – 9:30 PM Baghdad time.'}</li>
              </ul>
              <button
                onClick={() => onNavigate('content_studio')}
                className="w-full py-2 bg-purple-50 hover:bg-purple-100 text-purple-900 font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <span>{isAr ? 'توليد سكربت ريلز بالاستوديو' : 'Generate Reel Script'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Format 2: Carousels */}
            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-blue-100 text-blue-700 font-bold">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{isAr ? '2. كاروسيل تعليمي (Multi-Slide Carousel)' : '2. Educational Carousels'}</h4>
                    <span className="text-[10px] text-blue-600 font-bold">{isAr ? 'مرة واحدة أسبوعياً' : '1x Weekly — Authority Core'}</span>
                  </div>
                </div>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">4:5 Portrait</span>
              </div>
              <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                <li><strong className="text-slate-800">{isAr ? 'الهدف:' : 'Goal:'}</strong> {isAr ? 'بناء الثقة السريرية العميقة وتفكيك المخاوف (العضة المفتوحة، خلع الضواحك، الدامون).' : 'Deep clinical authority & case breakdowns.'}</li>
                <li><strong className="text-slate-800">{isAr ? 'معيار النجاح:' : 'Key Metric:'}</strong> {isAr ? 'حفظ المنشور (Saves / Bookmarks) لتصنيف الحساب كمرجع موثوق.' : 'Save velocity & bookmark rate.'}</li>
                <li><strong className="text-slate-800">{isAr ? 'الهيكل المثالي:' : 'Structure:'}</strong> {isAr ? '5 شرائح: غلاف مشكلة ➔ تشخيص ➔ ميكانيكا ➔ نتيجة ➔ حجز.' : '5 slides: Hook ➔ Diagnosis ➔ Mechanics ➔ Result ➔ CTA.'}</li>
              </ul>
              <button
                onClick={() => onNavigate('content_studio')}
                className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-blue-900 font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <span>{isAr ? 'توليد كاروسيل 5 شرائح' : 'Generate Carousel Slides'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Format 3: Stories */}
            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-amber-100 text-amber-700 font-bold">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{isAr ? '3. ستوري تفاعلي 24 ساعة (Interactive Stories)' : '3. Daily Interactive Stories'}</h4>
                    <span className="text-[10px] text-amber-600 font-bold">{isAr ? '5-7 أيام أسبوعياً' : 'Daily — Nurture Core'}</span>
                  </div>
                </div>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">24h Expire</span>
              </div>
              <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                <li><strong className="text-slate-800">{isAr ? 'الهدف:' : 'Goal:'}</strong> {isAr ? 'التفاعل الشخصي اللحظي مع المراجعين عبر استطلاعات الرأي وصناديق الأسئلة.' : 'Direct daily touchpoints & Q&A.'}</li>
                <li><strong className="text-slate-800">{isAr ? 'الستيكرات الحاسمة:' : 'Stickers:'}</strong> {isAr ? 'ستيكر تصويت (Poll)، صندوق أسئلة (Q&A)، ورابط حجز مباشر.' : 'Poll stickers, question boxes, and DM links.'}</li>
                <li><strong className="text-slate-800">{isAr ? 'النبرة:' : 'Tone:'}</strong> {isAr ? 'عفوية ومباشرة من داخل عيادة د. مصطفى بزيونة.' : 'Authentic behind-the-scenes at Zayouna.'}</li>
              </ul>
              <button
                onClick={() => onNavigate('content_studio')}
                className="w-full py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <span>{isAr ? 'توليد أفكار ستوري تفاعلي' : 'Generate Story Ideas'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Format 4: Single Posts */}
            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-teal-100 text-teal-700 font-bold">
                    <Star className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{isAr ? '4. منشور صورة / إنفوجرافيك (Single Posts)' : '4. Case Proof Posts'}</h4>
                    <span className="text-[10px] text-teal-600 font-bold">{isAr ? '1-2 مرة أسبوعياً' : '1-2x Weekly — Social Proof'}</span>
                  </div>
                </div>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">1:1 / 4:5</span>
              </div>
              <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                <li><strong className="text-slate-800">{isAr ? 'الهدف:' : 'Goal:'}</strong> {isAr ? 'توثيق الحالات الناجحة قبل وبعد، شهادات المراجعين، والإعلانات الرسمية.' : 'Before/after case reveals and clinic milestones.'}</li>
                <li><strong className="text-slate-800">{isAr ? 'النص والمحتوى:' : 'Content:'}</strong> {isAr ? 'عنوان جذاب على الصورة + كابشن يشرح التحدي الهندسي وكيفية التغلب عليه.' : 'High-contrast headline + biomechanical explanation.'}</li>
                <li><strong className="text-slate-800">{isAr ? 'الدعوة للإجراء:' : 'CTA:'}</strong> {isAr ? 'علق بـ (ابتسامة) أو راسلنا دايركت.' : 'Comment keyword or DM for consultation.'}</li>
              </ul>
              <button
                onClick={() => onNavigate('content_studio')}
                className="w-full py-2 bg-teal-50 hover:bg-teal-100 text-teal-900 font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <span>{isAr ? 'توليد منشور صورة وإنفوجرافيك' : 'Generate Single Post'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. THE 10% BOOST BLUEPRINT */}
      {activeSubTab === 'boost_blueprint' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="p-5 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-300 rounded-3xl space-y-3">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-amber-600" />
              <h3 className="font-black text-slate-900 text-base">
                {isAr ? 'قاعدة الـ 10% الذهبية لترويج المنشورات والبروفايل بأقل من 100$' : 'The 10% Golden Boost Rule (<$100/mo)'}
              </h3>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              {isAr
                ? 'أكبر خطأ ترتكبه العيادات هو الضغط على زر "Boost" لمنشور جديد لم يثبت نجاحه عضوياً. في نظام د. مصطفى، ننتظر 48 ساعة بعد نشر الريل. إذا حقق المنشور نسبة حفظ ومشاركة تتجاوز 15%، نقوم بترويجه بميزانية اختبارية صغيرة ($3 إلى $5 يومياً) لاستهداف أحياء محددة في بغداد.'
                : 'Never boost cold content. Wait 48h: if a Reel achieves >15% saves/sends organically, micro-boost it with $3–$5/day to hyper-local Baghdad districts.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Step 1 */}
            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="w-8 h-8 rounded-xl bg-slate-900 text-emerald-400 font-black flex items-center justify-center text-sm">
                01
              </div>
              <h4 className="font-bold text-slate-900 text-sm">
                {isAr ? 'اختبار الجدارة العضوية (Organic Proof)' : 'Organic Validation'}
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                {isAr
                  ? 'انشر الريل بالعامية البغدادية مع هوك العضة المفتوحة أو الدامون. راقب المشاهدات لمدة 48 ساعة دون أي إنفاق مالي.'
                  : 'Publish organically. Track watch time and saves for 48 hours with zero ad spend.'}
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="w-8 h-8 rounded-xl bg-slate-900 text-emerald-400 font-black flex items-center justify-center text-sm">
                02
              </div>
              <h4 className="font-bold text-slate-900 text-sm">
                {isAr ? 'الاستهداف الجغرافي الدقيق في بغداد' : 'Hyper-Local Baghdad Geo-Fencing'}
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                {isAr
                  ? 'لا تستهدف كل العراق! حدد دائرة 15 كم حول عيادة زيونة (زيونة، المنصور، الكرادة، الجادرية، شارع فلسطين، اليرموك) للأعمار 18-38.'
                  : 'Target strictly reachable zones within 15km of Zayouna clinic for ages 18–38.'}
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="w-8 h-8 rounded-xl bg-slate-900 text-emerald-400 font-black flex items-center justify-center text-sm">
                03
              </div>
              <h4 className="font-bold text-slate-900 text-sm">
                {isAr ? 'الميزانية الصارمة وبوابة الموافقة' : 'Micro-Budget & Spend Gate'}
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                {isAr
                  ? 'اضبط الميزانية على $3 إلى $5 يومياً لمدة 4 أيام (المجموع $15 إلى $20 لكل ريل رابح). لا يصرف أي دولار دون موافقة الدكتور اليدوية.'
                  : 'Set $3–$5/day for 4 days ($12–$20 total). Zero spend without doctor manual authorization.'}
              </p>
            </div>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h4 className="font-bold text-slate-900 text-sm">
                {isAr ? 'جاهز لترويج منشور أو زيادة زيارات البروفايل؟' : 'Ready to Boost a Reel or Profile?'}
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                {isAr
                  ? 'يمكنك إنشاء إعلان ممول جديد وتحديد الأحياء والميزانية مباشرة من مدير الحملات'
                  : 'Launch a targeted ad set with custom Baghdad neighborhoods and instant simulator.'}
              </p>
            </div>
            <button
              onClick={() => onNavigate('ad_campaigns')}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-sm transition-all shrink-0"
            >
              <DollarSign className="w-4 h-4" />
              <span>{isAr ? 'الانتقال لمدير الإعلانات والترويج' : 'Open Ad Campaigns Manager'}</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. COMMENT-TO-DM TRIGGERS */}
      {activeSubTab === 'comment_automation' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-black text-slate-900 text-base">
                {isAr ? 'قواعد تحويل التعليقات العامة إلى رسائل خاصة (Comment-to-DM)' : 'Automated Comment-to-DM Rules'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isAr
                  ? 'عندما يعلق أي شخص على ريلز أو بوست بكلمة مفتاحية، يرد النظام على تعليقه بلباقة ويرسل له دليلاً مخصصاً بالدايركت فوراً'
                  : 'Automatically reply to public comments and send comprehensive DM guides when trigger words are detected.'}
              </p>
            </div>

            <button
              onClick={() => setIsNewRuleOpen(true)}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAr ? 'إضافة كلمة مفتاحية جديدة' : 'Add Trigger Word'}</span>
            </button>
          </div>

          {/* Rules Cards List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {commentRules.map((rule) => (
              <div
                key={rule.id}
                className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3 text-start"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-slate-900 text-emerald-400 font-mono font-bold text-xs rounded-lg">
                      &quot;{rule.keyword}&quot;
                    </span>
                    <span className="text-xs font-bold text-slate-700">
                      {rule.targetTreatment === 'orthodontics'
                        ? isAr
                          ? 'تقويم الأسنان'
                          : 'Orthodontics'
                        : rule.targetTreatment === 'cosmetic_emax'
                        ? isAr
                          ? 'ابتسامة إيماكس'
                          : 'Cosmetic E-max'
                        : isAr
                        ? 'استشارة عامة وحجز'
                        : 'Consultation'}
                    </span>
                  </div>

                  <button
                    onClick={() => onToggleCommentRule && onToggleCommentRule(rule.id)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-colors ${
                      rule.isActive
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {rule.isActive ? (isAr ? 'مفعلة' : 'Active') : (isAr ? 'معطلة' : 'Paused')}
                  </button>
                </div>

                {/* Public Reply Preview */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    {isAr ? 'الرد العام في التعليقات (Public Reply):' : 'Public Comment Reply:'}
                  </span>
                  <p className="text-xs text-slate-800">{rule.publicReplyAr}</p>
                </div>

                {/* Private DM Preview */}
                <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200 space-y-1">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                    {isAr ? 'الرسالة المرسلة للخاص (Private DM):' : 'Private Direct Message:'}
                  </span>
                  <p className="text-xs text-emerald-950 leading-relaxed whitespace-pre-wrap">
                    {rule.privateDmReplyAr}
                  </p>
                </div>

                <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
                  <span>{isAr ? 'عدد مرات التفعيل التلقائي:' : 'Times Triggered:'}</span>
                  <strong className="text-slate-800 font-mono">{rule.triggersCount} {isAr ? 'مرة' : 'times'}</strong>
                </div>
              </div>
            ))}
          </div>

          {/* Interactive Comment Simulator */}
          <div className="p-6 bg-slate-900 text-white rounded-3xl border border-slate-800 space-y-4">
            <h4 className="font-black text-sm text-emerald-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              <span>{isAr ? 'مختبر تجربة التعليقات اللحظي (Live Comment Tester)' : 'Live Comment Tester'}</span>
            </h4>
            <p className="text-xs text-slate-300">
              {isAr
                ? 'جرب كتابة تعليق كأنك مراجع على إنستغرام (مثال: "دكتور شنو سعر التقويم؟" أو "محتاج حجز كشفية") لاختبار سرعة المطابقة التلقائية:'
                : 'Test how the system matches patient comments like "تقويم" or "حجز" in real time:'}
            </p>

            <form onSubmit={handleTestComment} className="flex gap-2">
              <input
                type="text"
                value={testComment}
                onChange={(e) => setTestComment(e.target.value)}
                placeholder={isAr ? 'اكتب تعليق تجريبي هنا (مثال: دكتور بلكت سعر تقويم الدامون؟)' : 'Type a test comment...'}
                className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-colors shrink-0"
              >
                {isAr ? 'اختبار الرد' : 'Test Trigger'}
              </button>
            </form>

            {simulatedMatch && (
              <div className="p-4 bg-slate-800/80 rounded-2xl border border-slate-700 space-y-3 animate-in fade-in">
                {simulatedMatch.matched && simulatedMatch.rule ? (
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isAr ? `تمت المطابقة مع الكلمة: "${simulatedMatch.rule.keyword}"` : `Matched: "${simulatedMatch.rule.keyword}"`}</span>
                    </div>
                    <div className="p-2.5 bg-slate-900 rounded-xl text-slate-300">
                      <strong className="text-slate-400 block mb-0.5">{isAr ? 'الرد العام في التعليق:' : 'Public Reply:'}</strong>
                      {simulatedMatch.rule.publicReplyAr}
                    </div>
                    <div className="p-2.5 bg-emerald-950/70 border border-emerald-500/30 rounded-xl text-emerald-200">
                      <strong className="text-emerald-400 block mb-0.5">{isAr ? 'الرسالة المرسلة للخاص فوراً:' : 'Instant DM Sent:'}</strong>
                      {simulatedMatch.rule.privateDmReplyAr}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-amber-400 text-xs">
                    <AlertTriangle className="w-4 h-4" />
                    <span>
                      {isAr
                        ? 'لم يتم العثور على كلمة مفتاحية متطابقة. سيتولى المساعد الذكي أو الاستقبال الرد يدوياً.'
                        : 'No active trigger word matched. Falls back to AI/Staff triage.'}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. GOOGLE MAPS 5-STAR REVIEWS */}
      {activeSubTab === 'google_reviews' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="p-5 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-300 rounded-3xl flex items-start gap-3">
            <Star className="w-6 h-6 text-amber-500 shrink-0 mt-0.5 fill-amber-500" />
            <div className="space-y-1">
              <h3 className="font-black text-slate-900 text-sm">
                {isAr ? 'منظومة تصدر نتائج خرائط جوجل لعيادات الأسنان في بغداد (Google Local SEO)' : 'Google Maps Local SEO Engine'}
              </h3>
              <p className="text-xs text-slate-700 leading-relaxed">
                {isAr
                  ? 'أكثر من 65% من الباحثين عن "أفضل دكتور تقويم في بغداد" أو "عيادة أسنان في زيونة" يختارون العيادة صاحبة أعلى تقييم على Google Maps. يرسل النظام طلباً لطيفاً ومباشراً للمراجعين فور إتمام زيارتهم في العيادة لمضاعفة التقييمات الإيجابية الحقيقية.'
                  : 'Over 65% of Baghdad orthodontic searches happen on Google Maps. The system triggers 5-star review invitations within 24 hours of clinic attendance.'}
              </p>
            </div>
          </div>

          {/* Review Requests List */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-900 text-sm">{isAr ? 'سجل طلبات التقييم للمراجعين بعد الزيارة:' : 'Post-Visit Review Queue:'}</h4>

            {reviewRequests.map((req) => (
              <div
                key={req.id}
                className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <strong className="text-slate-900 font-bold text-sm">{req.patientName}</strong>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 font-mono">
                      {req.phone}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        req.status === 'reviewed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : req.status === 'sent'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {req.status === 'reviewed'
                        ? isAr
                          ? 'تم التقييم 5 نجوم ★'
                          : 'Reviewed 5★'
                        : req.status === 'sent'
                        ? isAr
                          ? 'تم إرسال الطلب'
                          : 'Request Sent'
                        : isAr
                        ? 'بانتظار الإرسال'
                        : 'Pending Send'}
                    </span>
                  </div>
                  <div className="text-slate-500">
                    {req.treatmentNameAr} — {isAr ? 'تاريخ الزيارة:' : 'Visited:'} {req.visitedDate}
                  </div>
                  <p className="text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-200 mt-2 whitespace-pre-wrap">
                    {req.messageAr}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {req.status !== 'reviewed' && (
                    <button
                      onClick={() => onSendReviewRequest && onSendReviewRequest(req.id)}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isAr ? 'إرسال عبر WhatsApp / SMS' : 'Send via WhatsApp'}</span>
                    </button>
                  )}
                  <a
                    href={req.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
                  >
                    <MapPin className="w-3.5 h-3.5 text-red-500" />
                    <span>{isAr ? 'رابط الخريطة' : 'Maps Link'}</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. LAPSED LEAD REACTIVATION */}
      {activeSubTab === 'lapsed_reactivation' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-3xl space-y-2">
            <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-blue-600" />
              <span>{isAr ? 'حملات إعادة تنشيط المراجعين المترددين (Lapsed Lead Reactivation)' : 'Dormant Patient Recovery'}</span>
            </h3>
            <p className="text-xs text-slate-700 leading-relaxed">
              {isAr
                ? 'كثير من المراجعين في بغداد يستفسرون عن تقويم الأسنان أو الإيماكس ثم ينشغلون أو يترددون بسبب التكلفة أو الوقت. بدلاً من إهمالهم، يوفر النظام رسائل إعادة تنشيط بالعامية البغدادية الدافئة بدون أي إلحاح تجاري، مما يعيد 20-30% منهم لجدولة الموعد.'
                : 'Many patients inquire about braces or aligners then drop off. This module lets you recover 20–30% of dormant leads with warm Baghdadi check-ins.'}
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{isAr ? 'المراجعون الذين استفسروا سابقاً ولم يتم تأكيد موعدهم بعد:' : 'Dormant inquiries awaiting gentle re-engagement:'}</span>
              <strong className="text-slate-800">{lapsedLeads.length} {isAr ? 'مراجع' : 'leads'}</strong>
            </div>

            {lapsedLeads.map((lead) => (
              <div
                key={lead.id}
                className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <strong className="text-slate-900 font-bold text-sm">{lead.patientName}</strong>
                    <span className="text-slate-400 font-mono">@{lead.instagramUsername}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                      {lead.treatmentNameAr}
                    </span>
                  </div>
                  <div className="text-slate-500">
                    {isAr ? 'آخر استفسار:' : 'Last message:'} &quot;{lead.lastMessageText}&quot;
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {lead.phone ? `هاتف: ${lead.phone}` : isAr ? 'لا يوجد رقم هاتف بعد' : 'No phone logged'}
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (onReengageLead) onReengageLead(lead.id);
                    toast(isAr ? `تم إرسال رسالة إعادة التنشيط إلى ${lead.patientName} بنجاح!` : `Reactivation sent!`);
                  }}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-sm shrink-0"
                >
                  <Send className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{isAr ? 'إرسال رسالة اطمئنان وإعادة تنشيط' : 'Send Warm Check-In'}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Create New Comment Trigger */}
      {isNewRuleOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 text-start">
            <h3 className="font-black text-slate-900 text-base">
              {isAr ? 'إضافة كلمة مفتاحية لأتمتة التعليقات' : 'Add New Comment Trigger'}
            </h3>

            <form onSubmit={handleCreateRule} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isAr ? 'الكلمة المفتاحية (Trigger Keyword):' : 'Trigger Keyword:'}
                </label>
                <input
                  type="text"
                  required
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  placeholder={isAr ? 'مثال: أسعار، زراعة، دامون، خصم' : 'e.g. price, damon, braces'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600 font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isAr ? 'العلاج المستهدف:' : 'Target Treatment:'}
                </label>
                <select
                  value={newTreatment}
                  onChange={(e) => setNewTreatment(e.target.value as TreatmentType)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600 bg-white"
                >
                  <option value="orthodontics">{isAr ? 'تقويم الأسنان والفكين' : 'Orthodontics'}</option>
                  <option value="cosmetic_emax">{isAr ? 'ابتسامة إيماكس وتجميل' : 'Cosmetic E-max'}</option>
                  <option value="teeth_whitening">{isAr ? 'تبييض الأسنان بالليزر' : 'Teeth Whitening'}</option>
                  <option value="consultation">{isAr ? 'استشارة وكشفية عامة' : 'General Consultation'}</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isAr ? 'الرد التلقائي في التعليق العام (Public Reply):' : 'Public Reply:'}
                </label>
                <input
                  type="text"
                  value={newPublicReply}
                  onChange={(e) => setNewPublicReply(e.target.value)}
                  placeholder={isAr ? 'تدلل عيوني 💚 تفاصيل الخطة وصلتك بالخاص ✉️' : 'Public reply snippet...'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isAr ? 'الرسالة الخاصة المرسلة بالدايركت (Private DM):' : 'Private DM Guide:'}
                </label>
                <textarea
                  rows={3}
                  value={newPrivateReply}
                  onChange={(e) => setNewPrivateReply(e.target.value)}
                  placeholder={isAr ? 'أهلاً بك 🌸 للاستفسار وحجز موعد استشارتك بعيادتنا في زيونة، يا يوم يناسبك ورقم تليفونك؟' : 'Direct message payload...'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600 resize-none font-sans"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewRuleOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  {isAr ? 'حفظ وتفعيل القاعدة' : 'Save & Activate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

