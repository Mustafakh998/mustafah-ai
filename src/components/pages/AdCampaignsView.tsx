import React, { useState } from 'react';
import {
  DollarSign,
  TrendingUp,
  Target,
  ShieldAlert,
  Play,
  Pause,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Info,
} from 'lucide-react';
import { AppState } from '@/lib/store';
import { AdCampaign, Language } from '@/types';

interface AdCampaignsViewProps {
  state: AppState;
  onToggleCampaignStatus: (id: string) => void;
}

export const AdCampaignsView: React.FC<AdCampaignsViewProps> = ({
  state,
  onToggleCampaignStatus,
}) => {
  const isAr = state.currentLanguage === 'ar';
  const { campaigns, analytics } = state;

  const [confirmModalCampaign, setConfirmModalCampaign] = useState<AdCampaign | null>(null);

  const totalAllocated = campaigns.reduce((acc, c) => acc + c.allocatedBudgetUSD, 0);
  const totalSpent = campaigns.reduce((acc, c) => acc + c.spentUSD, 0);

  const handleToggleClick = (camp: AdCampaign) => {
    if (camp.status !== 'active') {
      // Human approval gate required to turn on/spend
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
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-black text-slate-900">
          {isAr ? 'إدارة وتخطيط الحملات الإعلانية (ميزانية < 100$ شهرياً)' : 'Meta Ad Campaigns & Budget Planner (<$100/mo)'}
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          {isAr
            ? 'توزيع استراتيجي للميزانية المحدودة في بغداد مع نظام موافقة بشرية صارم قبل تفعيل أو صرف أي دولار'
            : 'Disciplined low-budget patient acquisition with mandatory human authorization gates.'}
        </p>
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
              ? 'المبالغ المذكورة ($60 رئيسية، $20 إعادة استهداف، $20 تجارب) هي خطة تخطيطية وتوزيع مقترح وليست تفويضاً بالصرف التلقائي. يتطلب أي إطلاق أو تعديل ميزانية موافقة صريحة من الدكتور أو مدير العيادة.'
              : 'These planned figures ($60 acquisition, $20 retargeting, $20 testing) are budget plans, not permission to spend. Every campaign requires explicit human authorization.'}
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
            {isAr ? 'مقسمة على 3 حملات' : 'Split across 3 streams'}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-semibold text-slate-500">{isAr ? 'المصروف الفعلي حتى الآن' : 'Total Spent'}</div>
          <div className="text-2xl font-black text-slate-900 mt-1">${totalSpent.toFixed(1)}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            ${(100 - totalSpent).toFixed(1)} {isAr ? 'متبقي من الميزانية' : 'remaining'}
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
                  <span className="text-xs font-mono text-slate-400">
                    {camp.accountId === 'drmustafa_hadi' ? '@drmustafa_hadi' : '@almeswaksmile.iq'}
                  </span>
                </div>
                <h3 className="font-bold text-slate-900 text-base">{camp.nameAr}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{camp.targetAudienceAr}</p>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-end">
                  <div className="text-xs text-slate-400">{isAr ? 'الميزانية / المصروف:' : 'Budget / Spent:'}</div>
                  <div className="text-base font-black text-slate-900">
                    ${camp.spentUSD} <span className="text-slate-400 text-xs font-normal">/ ${camp.allocatedBudgetUSD}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleToggleClick(camp)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm ${
                    camp.status === 'active'
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {camp.status === 'active' ? (
                    <>
                      <Pause className="w-3.5 h-3.5" />
                      <span>{isAr ? 'إيقاف الحملة' : 'Pause'}</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      <span>{isAr ? 'طلب التفعيل والصرف' : 'Authorize & Launch'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Campaign Performance Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100 text-center text-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">{isAr ? 'الوصول' : 'Reach'}</span>
                <span className="font-bold text-slate-800">{camp.reach.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">{isAr ? 'الظهور' : 'Impressions'}</span>
                <span className="font-bold text-slate-800">{camp.impressions.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">{isAr ? 'محادثات DM' : 'Conversations'}</span>
                <span className="font-bold text-blue-700">{camp.conversationsStarted}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">{isAr ? 'مؤهلون طبياً' : 'Qualified'}</span>
                <span className="font-bold text-indigo-700">{camp.qualifiedInquiries}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">{isAr ? 'طلبات حجز' : 'Requests'}</span>
                <span className="font-bold text-amber-700">{camp.appointmentRequests}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">{isAr ? 'مؤكدة' : 'Confirmed'}</span>
                <span className="font-bold text-teal-700">{camp.confirmedAppointments}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">{isAr ? 'حضروا للعيادة' : 'Attended'}</span>
                <span className="font-bold text-emerald-700">{camp.attendedPatients}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Human Approval Confirmation Modal */}
      {confirmModalCampaign && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-amber-600 pb-2 border-b border-slate-200">
              <ShieldAlert className="w-6 h-6" />
              <h3 className="font-bold text-slate-900 text-base">
                {isAr ? 'تأكيد الموافقة البشرية على الصرف الإعلاني' : 'Confirm Human Spend Authorization'}
              </h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {isAr
                ? `هل تؤكد تفعيل حملة "${confirmModalCampaign.nameAr}" بميزانية مخطط لها بقيمة $${confirmModalCampaign.allocatedBudgetUSD}؟ لن يتم الصرف من الحساب الإعلاني إلا بعد هذه الموافقة الصريحة.`
                : `Are you authorizing spend for "${confirmModalCampaign.name}" with a budget of $${confirmModalCampaign.allocatedBudgetUSD}?`}
            </p>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1">
              <div>
                <strong>{isAr ? 'الحساب:' : 'Account:'}</strong> @{confirmModalCampaign.accountId}
              </div>
              <div>
                <strong>{isAr ? 'الموقع المستهدف:' : 'Location:'}</strong> {confirmModalCampaign.targetLocation}
              </div>
              <div>
                <strong>{isAr ? 'الميزانية القصوى:' : 'Max Spend:'}</strong> ${confirmModalCampaign.allocatedBudgetUSD}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={confirmActivation}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs transition-colors shadow-sm flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isAr ? 'تأكيد وإطلاق الحملة' : 'Authorize & Launch'}</span>
              </button>
              <button
                onClick={() => setConfirmModalCampaign(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
