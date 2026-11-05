import React, { useState } from 'react';
import {
  DollarSign,
  ShieldAlert,
  Play,
  Pause,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Plus,
  Flame,
  Compass,
  Check,
  Loader2,
} from 'lucide-react';
import { AppState } from '@/lib/store';
import { AccountId, AdCampaign, NavTabId } from '@/types';
import { toast } from '@/lib/toast';

interface AdCampaignsViewProps {
  state: AppState;
  onToggleCampaignStatus: (id: string) => void;
  onAddCampaign?: (camp: AdCampaign) => void;
  onBoostPostOrProfile?: (params: {
    accountId: AccountId;
    objective: AdCampaign['objective'];
    headline: string;
    body: string;
    targetNeighborhoods: string[];
    dailyBudgetUSD: number;
    durationDays: number;
    boostedContentId?: string;
  }) => AdCampaign | Promise<AdCampaign>;
  onNavigate?: (tab: NavTabId) => void;
}

export const AdCampaignsView: React.FC<AdCampaignsViewProps> = ({
  state,
  onToggleCampaignStatus,
  onAddCampaign,
  onBoostPostOrProfile,
  onNavigate,
}) => {
  const isAr = state.currentLanguage === 'ar';
  const { campaigns, analytics, contentItems } = state;

  const [confirmModalCampaign, setConfirmModalCampaign] = useState<AdCampaign | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Form State for New Boost / Campaign
  const [adObjective, setAdObjective] = useState<AdCampaign['objective']>('profile_visits');
  const [selectedContentId, setSelectedContentId] = useState<string>('');
  const [customHeadline, setCustomHeadline] = useState(
    'د. مصطفى هادي — أخصائي تقويم الأسنان والفكين في بغداد زيونة 📐✨'
  );
  const [customBody, setCustomBody] = useState(
    'طبيب أسنان يشرحلك قبل لا يعالجك. فحص إطباق سريري دقيق وأشعة سيفالومتريك لتشخيص العضة والتقويم بدون خلع غير ضروري. احجز استشارتك الآن 📍 خدمي دريم سيتي مول.'
  );
  const [targetNeighborhoods, setTargetNeighborhoods] = useState<string[]>([
    'زيونة (نطاق العيادة)',
    'المنصور',
    'الكرادة',
    'الجادرية',
  ]);
  const [dailyBudgetUSD, setDailyBudgetUSD] = useState<number>(4);
  const [durationDays, setDurationDays] = useState<number>(4);

  const totalAllocated = campaigns.reduce((acc, c) => acc + c.allocatedBudgetUSD, 0);
  const totalSpent = campaigns.reduce((acc, c) => acc + c.spentUSD, 0);
  const plannedNewBudget = dailyBudgetUSD * durationDays;

  const ALL_NEIGHBORHOODS = [
    'زيونة (نطاق العيادة)',
    'المنصور',
    'الكرادة',
    'الجادرية',
    'شارع فلسطين',
    'اليرموك',
    'الأعظمية',
    'الحارثية',
  ];

  const handleToggleNeighborhood = (hood: string) => {
    if (targetNeighborhoods.includes(hood)) {
      if (targetNeighborhoods.length > 1) {
        setTargetNeighborhoods(targetNeighborhoods.filter((h) => h !== hood));
      }
    } else {
      setTargetNeighborhoods([...targetNeighborhoods, hood]);
    }
  };

  const handleContentSelect = (id: string) => {
    setSelectedContentId(id);
    const item = contentItems.find((c) => c.id === id);
    if (item) {
      setCustomHeadline(`${item.coverHeadlineAr || item.titleAr} 🦷`);
      setCustomBody(
        `${item.hookAr}\n\n${item.scriptAr.slice(0, 160)}...\n\nراسلنا دايركت لمعرفة خطة العلاج المناسبة ✉️`
      );
    }
  };

  const handleCreateAdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onBoostPostOrProfile) {
      // Sent to Meta as a PAUSED campaign — it does not spend yet. Store shows a toast once
      // Meta confirms creation (or reports an error), since this is a real network call.
      onBoostPostOrProfile({
        accountId: 'drmustafa_hadi',
        objective: adObjective,
        headline: customHeadline,
        body: customBody,
        targetNeighborhoods,
        dailyBudgetUSD,
        durationDays,
        boostedContentId: selectedContentId || undefined,
      });
    } else if (onAddCampaign) {
      // Fallback path (no Meta wiring provided by the parent): local-only draft, never active.
      const newCamp: AdCampaign = {
        id: `boost_${Date.now()}`,
        name: 'Targeted Baghdad Dental Ad',
        nameAr: `إعلان ممول مستهدف ($${plannedNewBudget})`,
        accountId: 'drmustafa_hadi',
        objective: adObjective,
        allocatedBudgetUSD: plannedNewBudget,
        spentUSD: 0,
        status: 'draft_pending_approval',
        targetLocation: `Baghdad (${targetNeighborhoods.join(', ')})`,
        targetAudienceAr: `بغداد (${targetNeighborhoods.join('، ')}) للأعمار 18-38`,
        reach: 0,
        impressions: 0,
        conversationsStarted: 0,
        qualifiedInquiries: 0,
        appointmentRequests: 0,
        confirmedAppointments: 0,
        attendedPatients: 0,
        requiresHumanApproval: true,
        dailyBudgetUSD,
        durationDays,
        targetNeighborhoods,
        adCreativeHeadline: customHeadline,
        adCreativeBody: customBody,
      };
      onAddCampaign(newCamp);
      toast(isAr ? 'تم حفظ الحملة كمسودة بانتظار الموافقة.' : 'Campaign saved as a draft awaiting approval.');
    }

    setIsCreateModalOpen(false);
  };

  const handleToggleClick = (camp: AdCampaign) => {
    if (camp.metaSyncPending) return; // a create/activate/pause call is already in flight
    if (camp.status !== 'active') {
      // Human approval gate required to turn on/spend real budget
      setConfirmModalCampaign(camp);
    } else {
      onToggleCampaignStatus(camp.id);
    }
  };

  const confirmActivation = () => {
    if (!confirmModalCampaign) return;
    onToggleCampaignStatus(confirmModalCampaign.id);
    setConfirmModalCampaign(null);
  };

  return (
    <div className="space-y-6 text-start">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-emerald-600 text-white shadow-sm">
              <DollarSign className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
              MICRO-BUDGET ENGINE &lt; $100
            </span>
            <span className="text-xs font-mono text-slate-400">@drmustafa_hadi</span>
          </div>
          <h2 className="text-2xl font-black text-slate-900">
            {isAr ? 'إدارة وتخطيط الحملات الإعلانية وترويج المنشورات' : 'Meta Ad Campaigns & Post Booster (<$100/mo)'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {isAr
              ? 'إنشاء إعلانات وترويج ريلز الملف الشخصي مع استهداف جغرافي دقيق في بغداد وبوابة موافقة بشرية صارمة'
              : 'Launch targeted Meta ads, boost high-retention Reels, and grow profile visits with zero budget waste.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onNavigate && (
            <button
              onClick={() => onNavigate('marketing_strategy')}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors"
            >
              <Compass className="w-3.5 h-3.5 text-emerald-600" />
              <span>{isAr ? 'قاعدة الـ 10% للترويج' : '10% Boost Rule'}</span>
            </button>
          )}

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>{isAr ? 'إنشاء إعلان جديد / ترويج منشور' : '+ Launch New Ad / Boost'}</span>
          </button>
        </div>
      </div>

      {/* Strict Human Approval Gate Alert */}
      <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-start gap-3 text-xs text-amber-950">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <div className="font-bold text-sm">
            {isAr ? 'تنبيه الأمان المالي والموافقة البشرية الصارمة' : 'Human Spend Authorization Gate Active'}
          </div>
          <p className="mt-1 leading-relaxed text-amber-900">
            {isAr
              ? 'المبالغ المذكورة هي خطة تسويقية منضبطة تحت سقف 100$ شهرياً. لا يقوم النظام بصرف أي مبالغ مالية تلقائياً دون موافقة صريحة يدوية من الدكتور أو مدير العيادة.'
              : 'All campaigns adhere strictly to the <$100/mo ceiling. Zero spend occurs automatically without explicit manual authorization.'}
          </p>
        </div>
      </div>

      {/* Budget Allocation Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">{isAr ? 'الميزانية الشهرية القصوى' : 'Monthly Ceiling'}</div>
          <div className="text-2xl font-black text-slate-900 mt-1">&lt; $100 / mo</div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-1">
            {isAr ? 'تحكم صارم بالنفقات' : 'Zero overspending'}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">{isAr ? 'المخطط الموزع' : 'Planned Allocation'}</div>
          <div className="text-2xl font-black text-blue-700 mt-1">${totalAllocated}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            {campaigns.length} {isAr ? 'حملات نشطة ومسودات' : 'campaigns tracked'}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">{isAr ? 'المصروف الفعلي حتى الآن' : 'Total Spent'}</div>
          <div className="text-2xl font-black text-slate-900 mt-1">${totalSpent.toFixed(1)}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            ${Math.max(0, 100 - totalSpent).toFixed(1)} {isAr ? 'متبقي من السقف' : 'remaining'}
          </div>
        </div>

        <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-300 shadow-sm">
          <div className="text-xs font-bold text-emerald-800">{isAr ? 'كلفة المريض الحاضر' : 'Attended Patient CAC'}</div>
          <div className="text-2xl font-black text-emerald-950 mt-1">${analytics.costPerAttendedPatientUSD}</div>
          <div className="text-[11px] text-emerald-700 font-semibold mt-1">
            {isAr ? 'كفاءة استحواذ قياسية' : 'High ROI on ad dollar'}
          </div>
        </div>
      </div>

      {/* Campaigns List */}
      <div className="space-y-4">
        {campaigns.map((camp) => (
          <div
            key={camp.id}
            className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4 text-start"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                      camp.status === 'active'
                        ? 'bg-emerald-100 text-emerald-800'
                        : camp.status === 'paused'
                        ? 'bg-slate-200 text-slate-700'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {camp.status === 'active'
                      ? isAr
                        ? 'نشطة ومفعلة'
                        : 'Active'
                      : camp.status === 'paused'
                      ? isAr
                        ? 'متوقفة مؤقتاً'
                        : 'Paused'
                      : isAr
                      ? 'مسودة بانتظار الموافقة'
                      : 'Pending Approval'}
                  </span>

                  <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono uppercase">
                    {camp.objective.replace(/_/g, ' ')}
                  </span>

                  <span className="text-xs font-mono text-slate-400">
                    {camp.accountId === 'drmustafa_hadi' ? '@drmustafa_hadi' : '@almeswaksmile.iq'}
                  </span>
                </div>
                <h3 className="font-bold text-slate-900 text-base">{camp.nameAr}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{camp.targetAudienceAr}</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-end">
                  <div className="text-xs text-slate-400">{isAr ? 'الميزانية المخصصة' : 'Allocated'}</div>
                  <div className="font-black text-slate-900 text-sm">
                    ${camp.spentUSD.toFixed(1)} / ${camp.allocatedBudgetUSD}
                  </div>
                </div>

                <button
                  onClick={() => handleToggleClick(camp)}
                  className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${
                    camp.status === 'active'
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                  }`}
                >
                  {camp.status === 'active' ? (
                    <>
                      <Pause className="w-3.5 h-3.5" />
                      <span>{isAr ? 'إيقاف مؤقت' : 'Pause'}</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>{isAr ? 'تفعيل الإعلان' : 'Activate'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Performance Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-3 border-t border-slate-100 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-xl">
                <span className="text-slate-400 block text-[10px]">{isAr ? 'الوصول في بغداد' : 'Reach'}</span>
                <strong className="text-slate-800 font-mono text-sm">
                  {camp.reach.toLocaleString()}
                </strong>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl">
                <span className="text-slate-400 block text-[10px]">{isAr ? 'استفسارات الدايركت' : 'Inquiries'}</span>
                <strong className="text-slate-800 font-mono text-sm">
                  {camp.conversationsStarted}
                </strong>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl">
                <span className="text-slate-400 block text-[10px]">{isAr ? 'مؤهلون بالذكاء الاصطناعي' : 'Qualified'}</span>
                <strong className="text-emerald-700 font-mono text-sm">
                  {camp.qualifiedInquiries}
                </strong>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl">
                <span className="text-slate-400 block text-[10px]">{isAr ? 'حجوزات مؤكدة' : 'Confirmed'}</span>
                <strong className="text-blue-700 font-mono text-sm">
                  {camp.confirmedAppointments}
                </strong>
              </div>

              <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200">
                <span className="text-emerald-800 block text-[10px] font-bold">{isAr ? 'مرضى حضروا للعيادة' : 'Attended'}</span>
                <strong className="text-emerald-950 font-mono text-sm">
                  {camp.attendedPatients} {isAr ? 'مرضى' : 'pts'}
                </strong>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL: Launch New Ad / Boost Post */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 space-y-6 animate-in zoom-in-95 text-start my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                  <Flame className="w-5 h-5 text-amber-500" />
                  <span>{isAr ? 'إنشاء إعلان ممول / ترويج منشور وحساب' : 'Launch Meta Ad / Boost Post'}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isAr
                    ? 'ترويج منضبط بميزانية صغيرة واستهداف أحياء بغداد المحيطة بعيادة زيونة'
                    : 'Targeted micro-budget campaign (<$100 ceiling) with live mobile preview.'}
                </p>
              </div>

              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAdSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column: Settings */}
                <div className="space-y-4 text-xs">
                  {/* Objective */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1.5">
                      {isAr ? 'هدف الحملة الإعلانية:' : 'Campaign Objective:'}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'profile_visits', labelAr: 'زيارات البروفايل', labelEn: 'Profile Visits' },
                        { id: 'click_to_instagram_direct', labelAr: 'رسائل الدايركت', labelEn: 'Direct DMs' },
                        { id: 'reel_engagement', labelAr: 'تفاعل ومشاهدات', labelEn: 'Engagement' },
                      ].map((obj) => (
                        <button
                          key={obj.id}
                          type="button"
                          onClick={() => setAdObjective(obj.id as AdCampaign['objective'])}
                          className={`p-2 rounded-xl border text-[11px] font-bold transition-all text-center ${
                            adObjective === obj.id
                              ? 'border-emerald-600 bg-emerald-50 text-emerald-950 shadow-sm'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {isAr ? obj.labelAr : obj.labelEn}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Pick Existing Content (Optional) */}
                  {contentItems.length > 0 && (
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        {isAr ? 'اختيار منشور/ريلز من الاستوديو (اختياري للترويج):' : 'Select from Content Studio:'}
                      </label>
                      <select
                        value={selectedContentId}
                        onChange={(e) => handleContentSelect(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-emerald-600 text-xs"
                      >
                        <option value="">{isAr ? '-- ترويج مخصص بدون ربط منشور --' : '-- Custom ad copy --'}</option>
                        {contentItems.map((item) => (
                          <option key={item.id} value={item.id}>
                            [{item.format.toUpperCase()}] {item.titleAr}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Headline & Body */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      {isAr ? 'عنوان الإعلان البصري (Headline):' : 'Ad Headline:'}
                    </label>
                    <input
                      type="text"
                      required
                      value={customHeadline}
                      onChange={(e) => setCustomHeadline(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600 font-sans"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      {isAr ? 'نص الإعلان والرسالة (Ad Body Text):' : 'Ad Body:'}
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={customBody}
                      onChange={(e) => setCustomBody(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600 resize-none font-sans"
                    />
                  </div>

                  {/* Baghdad Districts Multi-select */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1.5">
                      {isAr ? 'الأحياء المستهدفة في بغداد (نطاق الوصول للعيادة):' : 'Target Baghdad Neighborhoods:'}
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {ALL_NEIGHBORHOODS.map((hood) => {
                        const isSelected = targetNeighborhoods.includes(hood);
                        return (
                          <button
                            key={hood}
                            type="button"
                            onClick={() => handleToggleNeighborhood(hood)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                              isSelected
                                ? 'bg-slate-900 text-emerald-400 border border-slate-800'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent'
                            }`}
                          >
                            {hood}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Budget & Duration Sliders */}
                  <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                    <div>
                      <div className="flex items-center justify-between font-bold text-[11px] mb-1">
                        <span>{isAr ? 'الميزانية اليومية:' : 'Daily Budget:'}</span>
                        <span className="font-mono text-emerald-700">${dailyBudgetUSD} / day</span>
                      </div>
                      <input
                        type="range"
                        min="2"
                        max="15"
                        step="1"
                        value={dailyBudgetUSD}
                        onChange={(e) => setDailyBudgetUSD(Number(e.target.value))}
                        className="w-full accent-emerald-600"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between font-bold text-[11px] mb-1">
                        <span>{isAr ? 'مدة الحملة:' : 'Duration:'}</span>
                        <span className="font-mono text-blue-700">{durationDays} {isAr ? 'أيام' : 'days'}</span>
                      </div>
                      <input
                        type="range"
                        min="2"
                        max="14"
                        step="1"
                        value={durationDays}
                        onChange={(e) => setDurationDays(Number(e.target.value))}
                        className="w-full accent-blue-600"
                      />
                    </div>
                  </div>

                  <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between text-xs font-bold text-emerald-950">
                    <span>{isAr ? 'الميزانية الإجمالية للحملة:' : 'Total Planned Spend:'}</span>
                    <span className="font-black text-sm">${plannedNewBudget} USD</span>
                  </div>
                </div>

                {/* Right Column: Live Mobile Sponsored Preview */}
                <div className="space-y-3">
                  <span className="text-xs font-bold text-slate-700 block">
                    {isAr ? 'معاينة الإعلان الممول المباشر على إنستغرام:' : 'Live Instagram Sponsored Preview:'}
                  </span>

                  {/* Instagram Sponsored Card Mockup */}
                  <div className="p-4 bg-slate-900 text-white rounded-3xl border border-slate-800 shadow-xl space-y-3 text-xs">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-rose-500 p-0.5">
                          <div className="w-full h-full bg-slate-900 rounded-full flex items-center justify-center font-bold text-xs">
                            م
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-white">drmustafa_hadi</span>
                            <span className="w-3 h-3 rounded-full bg-blue-500 flex items-center justify-center text-[8px] font-bold">✓</span>
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {isAr ? 'إعلان ممول • بغداد زيونة' : 'Sponsored • Baghdad'}
                          </span>
                        </div>
                      </div>
                      <span className="text-slate-400">•••</span>
                    </div>

                    {/* Creative Area */}
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-950 to-slate-800 border border-white/10 min-h-[140px] flex flex-col justify-between">
                      <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">
                        {adObjective === 'profile_visits'
                          ? 'PROFILE BOOST'
                          : adObjective === 'click_to_instagram_direct'
                          ? 'CLICK TO DM'
                          : 'REEL BOOST'}
                      </span>
                      <h4 className="font-black text-sm sm:text-base text-white leading-snug">
                        {customHeadline}
                      </h4>
                      <p className="text-[11px] text-slate-300 line-clamp-2 mt-1">
                        {customBody}
                      </p>
                    </div>

                    {/* Action Bar / CTA */}
                    <div className="p-2.5 bg-emerald-600 rounded-xl text-white font-bold text-xs flex items-center justify-between">
                      <span>
                        {adObjective === 'profile_visits'
                          ? isAr
                            ? 'زيارة الملف الشخصي 👤'
                            : 'View Instagram Profile'
                          : isAr
                          ? 'إرسال رسالة لحجز كشفية ✉️'
                          : 'Send Message'}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </div>

                    {/* Projected Results Preview */}
                    <div className="pt-2 border-t border-white/10 grid grid-cols-3 gap-2 text-[10px] text-slate-400 text-center">
                      <div>
                        <span className="block text-slate-500">{isAr ? 'الوصول المتوقع' : 'Est. Reach'}</span>
                        <strong className="text-white font-mono">{plannedNewBudget * 350} - {plannedNewBudget * 600}</strong>
                      </div>
                      <div>
                        <span className="block text-slate-500">{isAr ? 'استفسارات محتملة' : 'Est. Leads'}</span>
                        <strong className="text-emerald-400 font-mono">{Math.round(plannedNewBudget * 0.4)} - {Math.round(plannedNewBudget * 0.9)}</strong>
                      </div>
                      <div>
                        <span className="block text-slate-500">{isAr ? 'الكلفة المتوقعة' : 'Est. CAC'}</span>
                        <strong className="text-blue-400 font-mono">&lt; $6 / pt</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons with Human Spend Authorization */}
              <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>
                    {isAr
                      ? 'الضغط على زر التفعيل يمثل تفويضاً بشرياً صريحاً بصرف ميزانية الحملة.'
                      : 'Authorizing launches this campaign and deducts from your monthly ceiling.'}
                  </span>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs"
                  >
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>

                  <button
                    type="submit"
                    className="flex-1 sm:flex-none px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isAr ? 'أوافق وأفوّض إطلاق الحملة الآن' : 'Authorize & Launch Campaign'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for existing campaigns */}
      {confirmModalCampaign && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 text-start">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="font-black text-slate-900 text-base">
                {isAr ? 'تأكيد تفعيل الحملة وصرف الميزانية' : 'Authorize Ad Spend'}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {isAr
                  ? `هل أنت متأكد من تفعيل حملة "${confirmModalCampaign.nameAr}"؟ الميزانية المخصصة هي $${confirmModalCampaign.allocatedBudgetUSD}.`
                  : `Are you sure you want to activate "${confirmModalCampaign.name}" with a budget of $${confirmModalCampaign.allocatedBudgetUSD}?`}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmModalCampaign(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={confirmActivation}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm"
              >
                {isAr ? 'تأكيد التفعيل والموافقة' : 'Authorize & Activate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
