'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ExternalLink, Plus, RefreshCw, Users, X } from 'lucide-react';
import { Language, NavTabId } from '@/types';
import type { AuditResult, CompetitorSummary } from '@/lib/growth/audit';
import { Bar, Card, ErrorState, Item, Skeleton, Stagger, fetchJson, loadCompetitors, saveCompetitors } from '@/components/ui/kit';

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

interface Props {
  language: Language;
  onNavigate: (tab: NavTabId) => void;
}

export const SimilarPagesView: React.FC<Props> = ({ language, onNavigate }) => {
  const isAr = language === 'ar';
  // Mounted only after a tab click (never server-rendered), so reading storage here is safe.
  const [names, setNames] = useState<string[]>(() => (typeof window === 'undefined' ? [] : loadCompetitors()));
  const [input, setInput] = useState('');
  const [results, setResults] = useState<CompetitorSummary[]>([]);
  const [own, setOwn] = useState<AuditResult | null>(null);
  const [loading, setLoading] = useState(() => names.length > 0);
  const [error, setError] = useState<string | null>(null);

  const requestCompare = (list: string[], refresh: boolean) =>
    fetchJson<{ competitors: CompetitorSummary[] }>('/api/growth/competitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: list, refresh }),
    })
      .then((d) => setResults(d.competitors))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));

  useEffect(() => {
    fetchJson<AuditResult>('/api/growth/audit').then(setOwn).catch(() => {});
    if (names.length) requestCompare(names, false);
    // Run once on open with the saved list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (list: string[]) => {
    setNames(list);
    saveCompetitors(list);
  };

  const add = () => {
    const u = input.trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/.*$/, '').toLowerCase();
    if (!/^[a-z0-9._]{1,30}$/.test(u) || names.includes(u) || names.length >= 5) return;
    update([...names, u]);
    setInput('');
  };

  const compare = (list = names, refresh = false) => {
    if (!list.length) return;
    setLoading(true);
    setError(null);
    requestCompare(list, refresh);
  };

  const ok = results.filter((r) => !r.error);
  const ownRow: CompetitorSummary | null = own
    ? {
        username: own.profile.username,
        followers: own.profile.followersCount,
        postsPerWeek: own.metrics.postsPerWeek,
        avgEngagementByFollowers: own.metrics.avgEngagementByFollowers,
        reelShare: own.metrics.formats.find((f) => f.format === 'reel')?.share ?? 0,
        carouselShare: own.metrics.formats.find((f) => f.format === 'carousel')?.share ?? 0,
        ctaRate: own.metrics.ctaRate,
        avgHashtags: own.metrics.avgHashtags,
        topPosts: [],
      }
    : null;
  const rows = ownRow ? [ownRow, ...ok] : ok;
  const maxEr = Math.max(...rows.map((r) => r.avgEngagementByFollowers), 0.0001);

  return (
    <Stagger className="space-y-5 max-w-6xl mx-auto">
      <Item>
        <Card className="p-5 space-y-3">
          <div>
            <h1 className="text-lg font-black text-slate-900 flex items-center gap-2"><Users className="w-5 h-5 text-emerald-600" /> {isAr ? 'قارن نفسك بالصفحات المشابهة' : 'Compare with similar pages'}</h1>
            <p className="text-sm text-slate-500 mt-1">
              {isAr
                ? 'أضف لحد 5 صفحات أطباء أسنان أو عيادات (حسابات أعمال أو صانع محتوى). نقرأ أرقامهم العامة من إنستغرام الرسمي.'
                : 'Add up to 5 dental pages (business or creator accounts). We read their public numbers through the official Instagram API.'}
            </p>
          </div>
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
              placeholder={isAr ? '@اسم_الصفحة' : '@username'}
              dir="ltr"
              className="flex-1 min-w-0 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button onClick={add} disabled={names.length >= 5} className="inline-flex items-center gap-1 bg-slate-900 text-white text-sm font-bold px-3 py-2 rounded-xl disabled:opacity-40">
              <Plus className="w-4 h-4" /> {isAr ? 'أضف' : 'Add'}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <AnimatePresence>
              {names.map((n) => (
                <motion.span key={n} layout initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
                  className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold px-2.5 py-1 rounded-full" dir="ltr">
                  @{n}
                  <button onClick={() => update(names.filter((x) => x !== n))} aria-label={`Remove ${n}`}><X className="w-3.5 h-3.5" /></button>
                </motion.span>
              ))}
            </AnimatePresence>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => compare(names, true)} disabled={!names.length || loading} className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-4 py-2 rounded-xl disabled:opacity-40 transition-colors">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> {isAr ? 'قارن' : 'Compare'}
            </button>
            {ok.length > 0 && (
              <button onClick={() => onNavigate('growth_plan')} className="text-sm font-bold text-emerald-700 hover:text-emerald-800 px-2">
                {isAr ? 'استخدمها بخطة النمو ←' : 'Use in growth plan →'}
              </button>
            )}
          </div>
        </Card>
      </Item>

      {error && <ErrorState error={error} isAr={isAr} onRetry={() => compare(names, true)} />}
      {loading && !results.length && <Skeleton className="h-56" />}

      {results.filter((r) => r.error).map((r) => (
        <Item key={r.username}>
          <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2" dir="auto">@{r.username}: {r.error}</p>
        </Item>
      ))}

      {rows.length > 0 && (
        <Item>
          <Card className="p-5 overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-xs text-slate-500 text-start">
                  <th className="text-start pb-3 font-semibold">{isAr ? 'الصفحة' : 'Page'}</th>
                  <th className="text-start pb-3 font-semibold">{isAr ? 'المتابعين' : 'Followers'}</th>
                  <th className="text-start pb-3 font-semibold">{isAr ? 'منشور/أسبوع' : 'Posts/wk'}</th>
                  <th className="text-start pb-3 font-semibold w-40">{isAr ? 'التفاعل' : 'Engagement'}</th>
                  <th className="text-start pb-3 font-semibold">{isAr ? 'ريلز' : 'Reels'}</th>
                  <th className="text-start pb-3 font-semibold">{isAr ? 'دعوة للحجز' : 'CTA'}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.username} className={`border-t border-slate-100 ${i === 0 && ownRow ? 'bg-emerald-50/60' : ''}`}>
                    <td className="py-2.5 font-semibold text-slate-800" dir="ltr">@{r.username}{i === 0 && ownRow && <span className="ms-1 text-[10px] text-emerald-700">({isAr ? 'أنت' : 'you'})</span>}</td>
                    <td className="py-2.5 font-mono">{r.followers.toLocaleString()}</td>
                    <td className="py-2.5 font-mono">{r.postsPerWeek.toFixed(1)}</td>
                    <td className="py-2.5 pe-4"><div className="flex items-center gap-2"><span className="font-mono w-12">{pct(r.avgEngagementByFollowers)}</span><div className="flex-1"><Bar value={r.avgEngagementByFollowers / maxEr} className={i === 0 && ownRow ? 'bg-emerald-500' : 'bg-slate-400'} /></div></div></td>
                    <td className="py-2.5 font-mono">{Math.round(r.reelShare * 100)}%</td>
                    <td className="py-2.5 font-mono">{Math.round(r.ctaRate * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[11px] text-slate-400 mt-3">{isAr ? 'التفاعل هنا = (إعجابات + تعليقات) ÷ المتابعين، حتى تصير المقارنة عادلة.' : 'Engagement here = (likes + comments) ÷ followers so pages compare fairly.'}</p>
          </Card>
        </Item>
      )}

      {ok.length > 0 && (
        <Item className="grid md:grid-cols-2 gap-4">
          {ok.map((c) => (
            <Card key={c.username} className="p-4 space-y-2">
              <div className="font-bold text-slate-900 text-sm" dir="ltr">@{c.username} — {isAr ? 'أنجح منشوراتهم' : 'their top posts'}</div>
              {c.topPosts.map((p, i) => (
                <a key={i} href={p.permalink} target="_blank" rel="noreferrer" className="block text-xs p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
                  <div className="flex justify-between text-[11px] text-slate-500 mb-1"><span>{p.format}</span><span>❤ {p.likes} • 💬 {p.comments} <ExternalLink className="inline w-3 h-3" /></span></div>
                  <p className="text-slate-700 line-clamp-2" dir="auto">{p.caption || '—'}</p>
                </a>
              ))}
            </Card>
          ))}
        </Item>
      )}
    </Stagger>
  );
};
