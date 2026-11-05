// Deterministic account audit: turns raw Instagram media stats into metrics and findings.
// Pure functions (no I/O) so results are repeatable and safe to import on client or server.
import type { IgMedia, IgProfile, MediaFormat } from '@/lib/instagram/insights';

export type Severity = 'high' | 'medium' | 'low' | 'opportunity';

export interface Finding {
  id: string;
  severity: Severity;
  titleAr: string;
  titleEn: string;
  detailAr: string;
  fixAr: string;
}

export interface FormatStat {
  format: MediaFormat;
  count: number;
  share: number; // 0..1 of analysed posts
  avgEngagementRate: number; // 0..1
  avgReach?: number;
}

export interface TimeSlot {
  day: number; // 0 = Sunday (Baghdad time)
  hourStart: number; // 0, 3, 6 ... 21
  posts: number;
  avgEngagementRate: number;
}

export interface PostScore {
  id: string;
  format: MediaFormat;
  caption: string;
  permalink?: string;
  thumbnailUrl?: string;
  timestamp: string;
  engagementRate: number;
  reach?: number;
  likes: number;
  comments: number;
  saves?: number;
  shares?: number;
}

export interface AccountMetrics {
  postsAnalysed: number;
  postsPerWeek: number;
  longestGapDays: number;
  avgEngagementRate: number; // interactions / reach (or / followers if no reach)
  avgEngagementByFollowers: number; // (likes+comments)/followers — comparable across accounts
  avgReach?: number;
  sharesPerReach?: number;
  savesPerReach?: number;
  avgReelWatchSec?: number;
  ctaRate: number;
  questionRate: number;
  avgCaptionLength: number;
  avgHashtags: number;
  arabicCaptionRate: number;
  formats: FormatStat[];
  bestSlots: TimeSlot[];
}

export interface AuditResult {
  generatedAt: string;
  profile: IgProfile;
  score: number;
  metrics: AccountMetrics;
  findings: Finding[];
  topPosts: PostScore[];
  weakPosts: PostScore[];
}

const CTA_RE = /راسل|دايركت|الخاص|خاص|احجز|حجز|علق|علّق|اتصل|واتساب|الرابط|بالبايو|سجل|تواصل|\bDM\b|book|comment|link in bio|call/i;
const ARABIC_RE = /[؀-ۿ]/;
const HASHTAG_RE = /#[\p{L}\p{N}_]+/gu;
const DAY_MS = 86_400_000;

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const defined = <T,>(xs: (T | undefined)[]) => xs.filter((x): x is T => x !== undefined);

function engagementRate(m: IgMedia, followers: number): number {
  const interactions = m.likes + m.comments + (m.saves ?? 0) + (m.shares ?? 0);
  if (m.reach && m.reach > 0) return interactions / m.reach;
  return followers > 0 ? (m.likes + m.comments) / followers : 0;
}

/** Day of week and hour in Baghdad (UTC+3, no daylight saving). */
function baghdadTime(iso: string) {
  const d = new Date(new Date(iso).getTime() + 3 * 3_600_000);
  return { day: d.getUTCDay(), hour: d.getUTCHours() };
}

export function computeMetrics(profile: IgProfile, media: IgMedia[]): AccountMetrics {
  const followers = profile.followersCount;
  const sorted = [...media].sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));
  const ers = sorted.map((m) => engagementRate(m, followers));

  // Cadence over the span covered by the analysed posts (min 1 week).
  const times = sorted.map((m) => +new Date(m.timestamp));
  const spanDays = times.length > 1 ? Math.max(7, (times[0] - times[times.length - 1]) / DAY_MS) : 7;
  const gaps = times.slice(1).map((t, i) => (times[i] - t) / DAY_MS);
  const sinceLast = times.length ? (Date.now() - times[0]) / DAY_MS : 0;

  const formats: FormatStat[] = (['reel', 'carousel', 'post', 'video'] as MediaFormat[])
    .map((format) => {
      const idx = sorted.map((m, i) => (m.format === format ? i : -1)).filter((i) => i >= 0);
      return {
        format,
        count: idx.length,
        share: sorted.length ? idx.length / sorted.length : 0,
        avgEngagementRate: avg(idx.map((i) => ers[i])),
        avgReach: idx.some((i) => sorted[i].reach) ? avg(defined(idx.map((i) => sorted[i].reach))) : undefined,
      };
    })
    .filter((f) => f.count > 0);

  const slots = new Map<string, { day: number; hourStart: number; ers: number[] }>();
  sorted.forEach((m, i) => {
    const { day, hour } = baghdadTime(m.timestamp);
    const hourStart = Math.floor(hour / 3) * 3;
    const key = `${day}-${hourStart}`;
    const s = slots.get(key) ?? { day, hourStart, ers: [] };
    s.ers.push(ers[i]);
    slots.set(key, s);
  });
  const bestSlots = [...slots.values()]
    .filter((s) => s.ers.length >= 2)
    .map((s) => ({ day: s.day, hourStart: s.hourStart, posts: s.ers.length, avgEngagementRate: avg(s.ers) }))
    .sort((a, b) => b.avgEngagementRate - a.avgEngagementRate)
    .slice(0, 3);

  const withReach = sorted.filter((m) => m.reach && m.reach > 0);
  const totalReach = withReach.reduce((a, m) => a + (m.reach ?? 0), 0);
  const reels = sorted.filter((m) => m.avgWatchTimeMs !== undefined);

  return {
    postsAnalysed: sorted.length,
    postsPerWeek: (sorted.length / spanDays) * 7,
    longestGapDays: Math.max(0, sinceLast, ...gaps),
    avgEngagementRate: avg(ers),
    avgEngagementByFollowers: followers ? avg(sorted.map((m) => (m.likes + m.comments) / followers)) : 0,
    avgReach: withReach.length ? totalReach / withReach.length : undefined,
    sharesPerReach: totalReach ? withReach.reduce((a, m) => a + (m.shares ?? 0), 0) / totalReach : undefined,
    savesPerReach: totalReach ? withReach.reduce((a, m) => a + (m.saves ?? 0), 0) / totalReach : undefined,
    avgReelWatchSec: reels.length ? avg(reels.map((m) => (m.avgWatchTimeMs ?? 0) / 1000)) : undefined,
    ctaRate: avg(sorted.map((m) => (CTA_RE.test(m.caption) ? 1 : 0))),
    questionRate: avg(sorted.map((m) => (/[?؟]/.test(m.caption) ? 1 : 0))),
    avgCaptionLength: avg(sorted.map((m) => m.caption.length)),
    avgHashtags: avg(sorted.map((m) => m.caption.match(HASHTAG_RE)?.length ?? 0)),
    arabicCaptionRate: avg(sorted.map((m) => (ARABIC_RE.test(m.caption) ? 1 : 0))),
    formats,
    bestSlots,
  };
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
export const DAY_NAMES_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
export const DAY_NAMES_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FORMAT_AR: Record<MediaFormat, string> = { reel: 'الريلز', carousel: 'الكاروسيل', post: 'الصور', video: 'الفيديو' };

export function findWeaknesses(m: AccountMetrics): Finding[] {
  const f: Finding[] = [];
  const add = (x: Finding) => f.push(x);

  if (m.postsAnalysed === 0) {
    add({ id: 'no_posts', severity: 'high', titleAr: 'لا توجد منشورات', titleEn: 'No posts found', detailAr: 'الحساب ما بيه منشورات نقدر نحللها.', fixAr: 'ابدأ بـ 3 منشورات أسبوعياً على الأقل.' });
    return f;
  }

  if (m.postsPerWeek < 2) {
    add({ id: 'low_frequency', severity: 'high', titleAr: 'النشر قليل', titleEn: 'Posting too rarely', detailAr: `معدل النشر ${m.postsPerWeek.toFixed(1)} منشور بالأسبوع. الخوارزمية تقلل الوصول للحسابات غير المنتظمة.`, fixAr: 'التزم بـ 3–5 منشورات أسبوعياً بجدول ثابت، والستوري يومياً.' });
  } else if (m.postsPerWeek < 3.5) {
    add({ id: 'medium_frequency', severity: 'medium', titleAr: 'النشر غير كافٍ', titleEn: 'Posting could be more frequent', detailAr: `معدل النشر ${m.postsPerWeek.toFixed(1)} بالأسبوع.`, fixAr: 'ارفع المعدل إلى 4 منشورات أسبوعياً، 2 منها ريلز.' });
  }

  if (m.longestGapDays > 10) {
    add({ id: 'long_gap', severity: 'medium', titleAr: 'انقطاع طويل عن النشر', titleEn: 'Long gap between posts', detailAr: `أطول فترة بدون نشر ${Math.round(m.longestGapDays)} يوم.`, fixAr: 'جهّز محتوى أسبوعين مقدماً حتى ما يصير انقطاع وقت الانشغال.' });
  }

  const reel = m.formats.find((x) => x.format === 'reel');
  if (!reel || reel.share < 0.4) {
    add({ id: 'few_reels', severity: reel ? 'medium' : 'high', titleAr: 'الريلز قليلة', titleEn: 'Too few Reels', detailAr: `الريلز تمثل ${pct(reel?.share ?? 0)} فقط من المنشورات. الريلز هي الطريقة الأساسية للوصول لناس ما يتابعونك.`, fixAr: 'خلي 50% من المنشورات ريلز قصيرة (15–45 ثانية) بشرح بسيط من الدكتور.' });
  }

  if (m.avgReelWatchSec !== undefined && m.avgReelWatchSec < 5) {
    add({ id: 'weak_hook', severity: 'high', titleAr: 'المشاهدون يطلعون بسرعة', titleEn: 'Weak Reel hooks', detailAr: `متوسط مدة المشاهدة ${m.avgReelWatchSec.toFixed(1)} ثانية فقط.`, fixAr: 'ابدأ كل ريل بجملة صادمة أو سؤال بأول ثانيتين، ونص مكتوب على الشاشة، وبدون مقدمات.' });
  }

  if (m.sharesPerReach !== undefined && m.sharesPerReach < 0.01) {
    add({ id: 'low_shares', severity: 'medium', titleAr: 'المشاركات قليلة', titleEn: 'Few shares', detailAr: `نسبة المشاركة ${pct(m.sharesPerReach)} من الوصول. إرسال المنشور للأصدقاء من أقوى إشارات الخوارزمية للوصول لجمهور جديد.`, fixAr: 'اصنع محتوى يندز للغير: "دز هذا لصديقك اللي يخاف من طبيب الأسنان"، معلومات مفاجئة، قبل وبعد.' });
  }

  if (m.savesPerReach !== undefined && m.savesPerReach < 0.01) {
    add({ id: 'low_saves', severity: 'low', titleAr: 'الحفظ قليل', titleEn: 'Few saves', detailAr: `نسبة الحفظ ${pct(m.savesPerReach)}.`, fixAr: 'انشر كاروسيل نصائح عملية (مثلاً: 5 أخطاء بتنظيف التقويم) يحب الناس يحفظوها.' });
  }

  if (m.ctaRate < 0.5) {
    add({ id: 'no_cta', severity: 'medium', titleAr: 'لا توجد دعوة للحجز', titleEn: 'Missing calls to action', detailAr: `${pct(1 - m.ctaRate)} من المنشورات بدون دعوة واضحة للتواصل.`, fixAr: 'اختم كل منشور بدعوة واحدة واضحة: "علّق بكلمة تقويم وأرسلك التفاصيل" أو "راسلنا خاص".' });
  }

  if (m.questionRate < 0.25) {
    add({ id: 'no_questions', severity: 'low', titleAr: 'تفاعل التعليقات ضعيف', titleEn: 'Captions rarely ask questions', detailAr: 'أغلب الكابشنات ما بيها سؤال للمتابع.', fixAr: 'اسأل سؤال بسيط بآخر الكابشن ("انت من جماعة التقويم الشفاف لو المعدني؟").' });
  }

  if (m.avgHashtags > 8) {
    add({ id: 'too_many_hashtags', severity: 'low', titleAr: 'هاشتاغات كثيرة', titleEn: 'Too many hashtags', detailAr: `متوسط ${Math.round(m.avgHashtags)} هاشتاغ بالمنشور.`, fixAr: 'استخدم 3–5 هاشتاغات دقيقة (مثل #تقويم_اسنان #بغداد #زيونة) واعتمد على كلمات الكابشن للبحث.' });
  }

  if (m.avgCaptionLength < 60) {
    add({ id: 'short_captions', severity: 'low', titleAr: 'الكابشن قصير جداً', titleEn: 'Captions are very short', detailAr: 'الإنستغرام يستخدم كلمات الكابشن بالبحث.', fixAr: 'اكتب 2–3 أسطر تتضمن كلمات يبحث عنها الناس: تقويم أسنان بغداد، ابتسامة هوليود، زيونة.' });
  }

  if (m.arabicCaptionRate < 0.7) {
    add({ id: 'not_arabic', severity: 'low', titleAr: 'كابشنات بغير العربي', titleEn: 'Captions not in Arabic', detailAr: `${pct(1 - m.arabicCaptionRate)} من الكابشنات بدون عربي.`, fixAr: 'اكتب الكابشن باللهجة العراقية أولاً، وضيف سطر إنجليزي إذا تحتاج.' });
  }

  // Opportunities
  const best = [...m.formats].filter((x) => x.count >= 2).sort((a, b) => b.avgEngagementRate - a.avgEngagementRate)[0];
  if (best && m.formats.length > 1 && best.avgEngagementRate > m.avgEngagementRate * 1.25) {
    add({ id: 'best_format', severity: 'opportunity', titleAr: `${FORMAT_AR[best.format]} هي الأقوى عندك`, titleEn: `${best.format} performs best`, detailAr: `تفاعل ${FORMAT_AR[best.format]} ${pct(best.avgEngagementRate)} مقابل ${pct(m.avgEngagementRate)} كمتوسط.`, fixAr: `زيد نسبة ${FORMAT_AR[best.format]} بالخطة الشهرية.` });
  }
  const slot = m.bestSlots[0];
  if (slot && slot.avgEngagementRate > m.avgEngagementRate * 1.3) {
    add({ id: 'best_time', severity: 'opportunity', titleAr: 'أفضل وقت للنشر', titleEn: 'Best time to post', detailAr: `منشورات ${DAY_NAMES_AR[slot.day]} بين ${slot.hourStart}:00 و ${slot.hourStart + 3}:00 (بتوقيت بغداد) تتفاعل أكثر.`, fixAr: 'انشر أهم محتوى الأسبوع بهذا الوقت.' });
  }

  const order: Record<Severity, number> = { high: 0, medium: 1, low: 2, opportunity: 3 };
  return f.sort((a, b) => order[a.severity] - order[b.severity]);
}

export function scoreAccount(findings: Finding[]): number {
  const penalty = { high: 15, medium: 8, low: 3, opportunity: 0 };
  return Math.max(0, Math.min(100, 100 - findings.reduce((a, x) => a + penalty[x.severity], 0)));
}

export function runAudit(profile: IgProfile, media: IgMedia[]): AuditResult {
  const metrics = computeMetrics(profile, media);
  const findings = findWeaknesses(metrics);
  const scored: PostScore[] = media.map((m) => ({
    id: m.id,
    format: m.format,
    caption: m.caption.slice(0, 160),
    permalink: m.permalink,
    thumbnailUrl: m.thumbnailUrl,
    timestamp: m.timestamp,
    engagementRate: engagementRate(m, profile.followersCount),
    reach: m.reach,
    likes: m.likes,
    comments: m.comments,
    saves: m.saves,
    shares: m.shares,
  }));
  const byEr = [...scored].sort((a, b) => b.engagementRate - a.engagementRate);
  return {
    generatedAt: new Date().toISOString(),
    profile,
    score: scoreAccount(findings),
    metrics,
    findings,
    topPosts: byEr.slice(0, 3),
    weakPosts: byEr.slice(-3).reverse(),
  };
}

// ---- Similar pages benchmark ----

export interface CompetitorSummary {
  username: string;
  name?: string;
  followers: number;
  postsPerWeek: number;
  avgEngagementByFollowers: number;
  reelShare: number;
  carouselShare: number;
  ctaRate: number;
  avgHashtags: number;
  topPosts: { caption: string; permalink?: string; format: MediaFormat; likes: number; comments: number }[];
  error?: string;
}

export function summarizeCompetitor(profile: IgProfile, media: IgMedia[]): CompetitorSummary {
  const m = computeMetrics(profile, media);
  const share = (f: MediaFormat) => m.formats.find((x) => x.format === f)?.share ?? 0;
  return {
    username: profile.username,
    name: profile.name,
    followers: profile.followersCount,
    postsPerWeek: m.postsPerWeek,
    avgEngagementByFollowers: m.avgEngagementByFollowers,
    reelShare: share('reel'),
    carouselShare: share('carousel'),
    ctaRate: m.ctaRate,
    avgHashtags: m.avgHashtags,
    topPosts: [...media]
      .sort((a, b) => b.likes + b.comments - (a.likes + a.comments))
      .slice(0, 3)
      .map((p) => ({ caption: p.caption.slice(0, 200), permalink: p.permalink, format: p.format, likes: p.likes, comments: p.comments })),
  };
}
