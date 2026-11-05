'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowUpRight, Lightbulb, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { Language, NavTabId } from '@/types';
import type { AuditResult, PostScore, Severity } from '@/lib/growth/audit';
import { DAY_NAMES_AR, DAY_NAMES_EN } from '@/lib/growth/audit';
import { Bar, Card, ErrorState, Item, ScoreRing, Skeleton, Stagger, Stat, fetchJson } from '@/components/ui/kit';

const SEVERITY: Record<Severity, { ar: string; en: string; cls: string }> = {
  high: { ar: 'مهم جداً', en: 'High', cls: 'bg-rose-100 text-rose-700 border-rose-200' },
  medium: { ar: 'متوسط', en: 'Medium', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  low: { ar: 'بسيط', en: 'Low', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  opportunity: { ar: 'فرصة', en: 'Opportunity', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
};
const FORMAT_LABEL = { reel: ['ريلز', 'Reels'], carousel: ['كاروسيل', 'Carousel'], post: ['صورة', 'Photo'], video: ['فيديو', 'Video'] };
const pct = (x?: number) => (x === undefined ? '—' : `${(x * 100).toFixed(1)}%`);

interface Props {
  language: Language;
  onNavigate: (tab: NavTabId) => void;
}

export const GrowthAuditView: React.FC<Props> = ({ language, onNavigate }) => {
  const isAr = language === 'ar';
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      setAudit(await fetchJson<AuditResult>(`/api/growth/audit${refresh ? '?refresh=1' : ''}`));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJson<AuditResult>('/api/growth/audit')
      .then(setAudit)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  if (loading && !audit) {
    return (
      <div className="space-y-4 max-w-6xl mx-auto">
        <Skeleton className="h-36" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (error || !audit) return <div className="max-w-3xl mx-auto"><ErrorState error={error ?? ''} isAr={isAr} onRetry={() => load(true)} /></div>;

  const m = audit.metrics;
  const issues = audit.findings.filter((f) => f.severity !== 'opportunity');
  const opportunities = audit.findings.filter((f) => f.severity === 'opportunity');

  return (
    <Stagger className="space-y-5 max-w-6xl mx-auto">
      {/* Score header */}
      <Item>
        <Card className="p-5 sm:p-6 flex flex-col sm:flex-row items-center gap-6 bg-gradient-to-br from-white to-emerald-50/50">
          <ScoreRing score={audit.score} label={isAr ? 'من 100' : 'of 100'} />
          <div className="flex-1 text-center sm:text-start space-y-1.5">
            <h1 className="text-xl font-black text-slate-900">
              {isAr ? `تحليل حساب @${audit.profile.username}` : `@${audit.profile.username} audit`}
            </h1>
            <p className="text-sm text-slate-600">
              {isAr
                ? `${audit.profile.followersCount.toLocaleString()} متابع • تم تحليل آخر ${m.postsAnalysed} منشور • ${issues.length} نقطة تحتاج تحسين`
                : `${audit.profile.followersCount.toLocaleString()} followers • last ${m.postsAnalysed} posts • ${issues.length} things to fix`}
            </p>
            <div className="flex flex-wrap gap-2 justify-center sm:justify-start pt-2">
              <button onClick={() => onNavigate('growth_plan')} className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors">
                {isAr ? 'اعمل خطة نمو من هذا التحليل' : 'Build a growth plan from this'} <ArrowUpRight className="w-4 h-4" />
              </button>
              <button onClick={() => load(true)} disabled={loading} className="inline-flex items-center gap-1.5 bg-white border border-slate-300 text-slate-700 text-sm font-semibold px-3 py-2 rounded-xl hover:bg-slate-50 disabled:opacity-50">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> {isAr ? 'تحديث' : 'Refresh'}
              </button>
            </div>
          </div>
        </Card>
      </Item>

      {/* Key numbers */}
      <Item className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Stat label={isAr ? 'نسبة التفاعل' : 'Engagement rate'} value={pct(m.avgEngagementRate)} hint={isAr ? 'التفاعلات ÷ الوصول' : 'interactions ÷ reach'} />
        <Stat label={isAr ? 'منشورات بالأسبوع' : 'Posts per week'} value={m.postsPerWeek.toFixed(1)} />
        <Stat label={isAr ? 'المشاركة (إرسال)' : 'Shares per reach'} value={pct(m.sharesPerReach)} hint={isAr ? 'أقوى إشارة للوصول لجمهور جديد' : 'key signal for new reach'} />
        <Stat label={isAr ? 'متوسط مشاهدة الريل' : 'Avg Reel watch'} value={m.avgReelWatchSec !== undefined ? `${m.avgReelWatchSec.toFixed(1)}s` : '—'} />
      </Item>

      <div className="grid lg:grid-cols-5 gap-5">
        {/* Weaknesses */}
        <Item className="lg:col-span-3">
          <Card className="p-5 space-y-3 h-full">
            <h2 className="font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" /> {isAr ? 'نقاط الضعف وشلون تصلحها' : 'Weak spots and how to fix them'}
            </h2>
            {issues.length === 0 && <p className="text-sm text-slate-500">{isAr ? 'ما لكينا مشاكل واضحة 👏' : 'No clear problems found 👏'}</p>}
            {issues.map((f) => (
              <div key={f.id} className="p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${SEVERITY[f.severity].cls}`}>{isAr ? SEVERITY[f.severity].ar : SEVERITY[f.severity].en}</span>
                  <span className="font-bold text-sm text-slate-900">{isAr ? f.titleAr : f.titleEn}</span>
                </div>
                <p className="text-xs text-slate-600" dir="rtl">{f.detailAr}</p>
                <p className="text-xs text-emerald-800 bg-emerald-50 rounded-lg px-2.5 py-1.5" dir="rtl">✅ {f.fixAr}</p>
              </div>
            ))}
          </Card>
        </Item>

        {/* Formats + opportunities */}
        <Item className="lg:col-span-2 space-y-5">
          <Card className="p-5 space-y-3">
            <h2 className="font-bold text-slate-900">{isAr ? 'أداء كل صيغة' : 'Performance by format'}</h2>
            {m.formats.map((f) => {
              const max = Math.max(...m.formats.map((x) => x.avgEngagementRate), 0.0001);
              return (
                <div key={f.format} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-slate-700">{FORMAT_LABEL[f.format][isAr ? 0 : 1]} <span className="text-slate-400">({f.count})</span></span>
                    <span className="font-mono text-slate-600">{pct(f.avgEngagementRate)}</span>
                  </div>
                  <Bar value={f.avgEngagementRate / max} />
                </div>
              );
            })}
          </Card>
          {opportunities.length > 0 && (
            <Card className="p-5 space-y-2.5 border-emerald-200">
              <h2 className="font-bold text-slate-900 flex items-center gap-2"><Lightbulb className="w-5 h-5 text-emerald-600" /> {isAr ? 'فرص' : 'Opportunities'}</h2>
              {opportunities.map((f) => (
                <div key={f.id} className="text-xs space-y-0.5" dir="rtl">
                  <div className="font-bold text-slate-800">{f.titleAr}</div>
                  <div className="text-slate-600">{f.detailAr} {f.fixAr}</div>
                </div>
              ))}
            </Card>
          )}
          {m.bestSlots.length > 0 && (
            <Card className="p-5 space-y-2">
              <h2 className="font-bold text-slate-900">{isAr ? 'أفضل أوقات النشر (بغداد)' : 'Best times to post (Baghdad)'}</h2>
              {m.bestSlots.map((s) => (
                <div key={`${s.day}-${s.hourStart}`} className="flex justify-between text-xs">
                  <span className="text-slate-700">{(isAr ? DAY_NAMES_AR : DAY_NAMES_EN)[s.day]} {s.hourStart}:00–{s.hourStart + 3}:00</span>
                  <span className="font-mono text-emerald-700">{pct(s.avgEngagementRate)}</span>
                </div>
              ))}
            </Card>
          )}
        </Item>
      </div>

      {/* Best and worst posts */}
      <Item className="grid md:grid-cols-2 gap-5">
        <PostList title={isAr ? 'أنجح المنشورات' : 'Top posts'} icon={<TrendingUp className="w-5 h-5 text-emerald-600" />} posts={audit.topPosts} isAr={isAr} />
        <PostList title={isAr ? 'أضعف المنشورات' : 'Weakest posts'} icon={<TrendingDown className="w-5 h-5 text-rose-500" />} posts={audit.weakPosts} isAr={isAr} />
      </Item>
    </Stagger>
  );
};

const PostList: React.FC<{ title: string; icon: React.ReactNode; posts: PostScore[]; isAr: boolean }> = ({ title, icon, posts, isAr }) => (
  <Card className="p-5 space-y-3">
    <h2 className="font-bold text-slate-900 flex items-center gap-2">{icon} {title}</h2>
    {posts.map((p) => (
      <a key={p.id} href={p.permalink} target="_blank" rel="noreferrer" className="flex gap-3 p-2 -mx-2 rounded-xl hover:bg-slate-50 transition-colors">
        {p.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.thumbnailUrl} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0 bg-slate-100" />
        ) : (
          <div className="w-14 h-14 rounded-lg bg-slate-100 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-700 line-clamp-2" dir="auto">{p.caption || (isAr ? '(بدون كابشن)' : '(no caption)')}</p>
          <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap gap-x-3">
            <span className="font-bold text-slate-800">{pct(p.engagementRate)}</span>
            {p.reach !== undefined && <span>{isAr ? 'وصول' : 'reach'} {p.reach.toLocaleString()}</span>}
            <span>❤ {p.likes}</span>
            <span>💬 {p.comments}</span>
            {p.shares !== undefined && <span>↗ {p.shares}</span>}
          </div>
        </div>
      </a>
    ))}
  </Card>
);
