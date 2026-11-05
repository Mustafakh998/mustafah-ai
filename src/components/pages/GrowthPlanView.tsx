'use client';

import React, { useState } from 'react';
import { CalendarDays, Rocket, Sparkles, Target, Wand2, Zap } from 'lucide-react';
import { Language, NavTabId } from '@/types';
import type { GrowthPlan, PlanFormat } from '@/lib/growth/plan';
import { DAY_NAMES_AR, DAY_NAMES_EN } from '@/lib/growth/audit';
import { Bar, Card, ErrorState, Item, Skeleton, Stagger, fetchJson, loadCompetitors } from '@/components/ui/kit';

const FORMAT_STYLE: Record<PlanFormat, { ar: string; cls: string }> = {
  reel: { ar: 'ريل', cls: 'bg-violet-100 text-violet-700' },
  carousel: { ar: 'كاروسيل', cls: 'bg-sky-100 text-sky-700' },
  story: { ar: 'ستوري', cls: 'bg-amber-100 text-amber-800' },
  post: { ar: 'صورة', cls: 'bg-slate-100 text-slate-700' },
};
const PLAN_KEY = 'growth_plan_v1';
export const STUDIO_HANDOFF_KEY = 'studio_handoff_v1';

interface Props {
  language: Language;
  onNavigate: (tab: NavTabId) => void;
}

export const GrowthPlanView: React.FC<Props> = ({ language, onNavigate }) => {
  const isAr = language === 'ar';
  // This view only mounts after a tab click (never server-rendered), so reading storage here is safe.
  const [plan, setPlan] = useState<GrowthPlan | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      return JSON.parse(localStorage.getItem(PLAN_KEY) || 'null');
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const p = await fetchJson<GrowthPlan>('/api/growth/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competitors: loadCompetitors() }),
      });
      setPlan(p);
      localStorage.setItem(PLAN_KEY, JSON.stringify(p));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const createInStudio = (format: PlanFormat, topic: string) => {
    sessionStorage.setItem(STUDIO_HANDOFF_KEY, JSON.stringify({ format, topic }));
    onNavigate('content_studio');
  };

  const header = (
    <Card className="p-5 flex flex-col sm:flex-row sm:items-center gap-4 bg-gradient-to-br from-slate-900 to-emerald-900 text-white border-0">
      <div className="flex-1 space-y-1">
        <h1 className="text-lg font-black flex items-center gap-2"><Rocket className="w-5 h-5 text-emerald-300" /> {isAr ? 'خطة النمو لـ 30 يوم' : '30-day growth plan'}</h1>
        <p className="text-sm text-emerald-100/80">
          {isAr
            ? 'مبنية على تحليل حسابك، الصفحات المشابهة اللي أضفتها، جمهور بغداد، ومبادئ ترتيب المحتوى اللي أعلنتها إنستغرام.'
            : 'Built from your audit, the similar pages you added, the Baghdad audience, and Instagram’s published ranking principles.'}
        </p>
      </div>
      <button onClick={generate} disabled={loading} className="inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm px-5 py-2.5 rounded-xl disabled:opacity-60 transition-colors">
        <Wand2 className={`w-4 h-4 ${loading ? 'animate-pulse' : ''}`} />
        {loading ? (isAr ? 'جاري الإعداد…' : 'Building…') : plan ? (isAr ? 'أعد إنشاء الخطة' : 'Regenerate') : isAr ? 'أنشئ الخطة' : 'Generate plan'}
      </button>
    </Card>
  );

  if (loading && !plan) {
    return <div className="space-y-4 max-w-6xl mx-auto">{header}<Skeleton className="h-40" /><Skeleton className="h-72" /></div>;
  }

  return (
    <Stagger className="space-y-5 max-w-6xl mx-auto">
      <Item>{header}</Item>
      {error && <ErrorState error={error} isAr={isAr} onRetry={generate} />}
      {!plan && !error && (
        <Item><p className="text-sm text-slate-500 text-center py-10">{isAr ? 'اضغط "أنشئ الخطة" للبدء.' : 'Press "Generate plan" to start.'}</p></Item>
      )}

      {plan && (
        <>
          <Item>
            <Card className="p-5 space-y-2" >
              <p className="text-sm text-slate-800 leading-relaxed" dir="rtl">{plan.summaryAr}</p>
              <p className="text-sm font-bold text-emerald-800 bg-emerald-50 rounded-xl px-3 py-2" dir="rtl">🎯 {plan.positioningAr}</p>
              <p className="text-[11px] text-slate-400">{plan.source === 'rules' ? (isAr ? 'خطة قياسية (الذكاء الاصطناعي غير متاح الآن)' : 'Rule-based plan (AI unavailable)') : `AI: ${plan.source}`} • {new Date(plan.generatedAt).toLocaleString()}</p>
            </Card>
          </Item>

          {/* Weekly schedule */}
          <Item>
            <Card className="p-5 space-y-3">
              <h2 className="font-bold text-slate-900 flex items-center gap-2"><CalendarDays className="w-5 h-5 text-emerald-600" /> {isAr ? 'جدول الأسبوع' : 'Weekly schedule'}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2">
                {[...plan.weeklySchedule].sort((a, b) => ((a.day + 1) % 7) - ((b.day + 1) % 7)).map((s, i) => (
                  <button key={i} onClick={() => createInStudio(s.format, s.ideaAr)} className="text-start p-3 rounded-xl border border-slate-200 hover:border-emerald-400 hover:shadow-md hover:-translate-y-0.5 transition-all space-y-1.5 group">
                    <div className="flex justify-between items-center text-[11px] font-bold text-slate-500">
                      <span>{(isAr ? DAY_NAMES_AR : DAY_NAMES_EN)[s.day] ?? s.day}</span>
                      <span className="font-mono">{s.time}</span>
                    </div>
                    <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${FORMAT_STYLE[s.format]?.cls ?? FORMAT_STYLE.post.cls}`}>{FORMAT_STYLE[s.format]?.ar ?? s.format}</span>
                    <p className="text-xs text-slate-800 font-semibold" dir="rtl">{s.ideaAr}</p>
                    <p className="text-[10px] text-emerald-700 opacity-0 group-hover:opacity-100 transition-opacity">{isAr ? 'اضغط للإنشاء ←' : 'Click to create →'}</p>
                  </button>
                ))}
              </div>
            </Card>
          </Item>

          <div className="grid lg:grid-cols-3 gap-5">
            {/* Content ideas */}
            <Item className="lg:col-span-2">
              <Card className="p-5 space-y-3 h-full">
                <h2 className="font-bold text-slate-900 flex items-center gap-2"><Sparkles className="w-5 h-5 text-violet-500" /> {isAr ? 'أفكار محتوى جاهزة' : 'Content ideas'}</h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {plan.contentIdeas.map((idea, i) => (
                    <div key={i} className="p-3.5 rounded-xl border border-slate-200 hover:border-violet-300 transition-colors space-y-1.5 flex flex-col">
                      <span className={`self-start text-[10px] font-bold px-2 py-0.5 rounded-full ${FORMAT_STYLE[idea.format]?.cls ?? FORMAT_STYLE.post.cls}`}>{FORMAT_STYLE[idea.format]?.ar ?? idea.format}</span>
                      <div className="font-bold text-sm text-slate-900" dir="rtl">{idea.titleAr}</div>
                      <p className="text-xs text-slate-600 italic" dir="rtl">“{idea.hookAr}”</p>
                      <p className="text-[11px] text-slate-500 flex-1" dir="rtl">{idea.whyAr}</p>
                      <button onClick={() => createInStudio(idea.format, idea.titleAr)} className="self-start text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 px-3 py-1.5 rounded-lg transition-colors">
                        {isAr ? 'اصنعه بالاستوديو' : 'Create in Studio'}
                      </button>
                    </div>
                  ))}
                </div>
              </Card>
            </Item>

            <Item className="space-y-5">
              <Card className="p-5 space-y-3">
                <h2 className="font-bold text-slate-900">{isAr ? 'أركان المحتوى' : 'Content pillars'}</h2>
                {plan.pillars.map((p) => (
                  <div key={p.nameAr} className="space-y-1" dir="rtl">
                    <div className="flex justify-between text-xs"><span className="font-semibold text-slate-800">{p.nameAr}</span><span className="font-mono text-slate-500">{p.percent}%</span></div>
                    <Bar value={p.percent / 100} className="bg-violet-500" />
                    <p className="text-[11px] text-slate-500">{p.whyAr}</p>
                  </div>
                ))}
              </Card>
              <Card className="p-5 space-y-2">
                <h2 className="font-bold text-slate-900 flex items-center gap-2"><Zap className="w-5 h-5 text-amber-500" /> {isAr ? 'خطوات سريعة هالأسبوع' : 'Quick wins this week'}</h2>
                <ul className="space-y-1.5" dir="rtl">{plan.quickWins.map((q, i) => <li key={i} className="text-xs text-slate-700 flex gap-2"><span className="text-emerald-600 font-bold">{i + 1}.</span>{q}</li>)}</ul>
              </Card>
            </Item>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {plan.learnFromOthersAr.length > 0 && (
              <Item><Card className="p-5 space-y-2 h-full">
                <h2 className="font-bold text-slate-900">{isAr ? 'دروس من الصفحات الأخرى' : 'Lessons from other pages'}</h2>
                <ul className="space-y-1.5 text-xs text-slate-700 list-disc ps-4" dir="rtl">{plan.learnFromOthersAr.map((l, i) => <li key={i}>{l}</li>)}</ul>
              </Card></Item>
            )}
            <Item><Card className="p-5 space-y-2 h-full">
              <h2 className="font-bold text-slate-900">{isAr ? 'خطة الترويج المدفوع' : 'Paid boost plan'}</h2>
              <div className="text-2xl font-black text-slate-900">${plan.boostPlan.monthlyBudgetUSD}<span className="text-xs text-slate-500 font-semibold"> / {isAr ? 'شهر' : 'month'}</span></div>
              <p className="text-xs text-slate-700" dir="rtl">{plan.boostPlan.ruleAr}</p>
              <p className="text-[11px] text-slate-500" dir="rtl">{plan.boostPlan.audienceAr}</p>
              <button onClick={() => onNavigate('ad_campaigns')} className="text-xs font-bold text-emerald-700">{isAr ? 'افتح الحملات ←' : 'Open Ad Campaigns →'}</button>
            </Card></Item>
            <Item><Card className="p-5 space-y-2 h-full">
              <h2 className="font-bold text-slate-900 flex items-center gap-2"><Target className="w-5 h-5 text-rose-500" /> {isAr ? 'شلون نقيس النجاح' : 'How we measure success'}</h2>
              {plan.kpis.map((k) => (
                <div key={k.nameAr} className="flex justify-between gap-2 text-xs" dir="rtl">
                  <span className="text-slate-700">{k.nameAr}</span>
                  <span className="font-mono text-slate-500 shrink-0">{k.currentAr} → <b className="text-emerald-700">{k.targetAr}</b></span>
                </div>
              ))}
            </Card></Item>
          </div>
        </>
      )}
    </Stagger>
  );
};
