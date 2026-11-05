// Growth plan shape plus a rule-based plan used when the AI providers are unavailable.
import type { AuditResult } from './audit';

export type PlanFormat = 'reel' | 'carousel' | 'story' | 'post';

export interface GrowthPlan {
  generatedAt: string;
  source: string; // AI provider name, or "rules"
  summaryAr: string;
  positioningAr: string;
  pillars: { nameAr: string; percent: number; whyAr: string }[];
  weeklySchedule: { day: number; time: string; format: PlanFormat; pillarAr: string; ideaAr: string }[];
  contentIdeas: { format: PlanFormat; titleAr: string; hookAr: string; whyAr: string }[];
  quickWins: string[];
  learnFromOthersAr: string[];
  boostPlan: { monthlyBudgetUSD: number; ruleAr: string; audienceAr: string };
  kpis: { nameAr: string; currentAr: string; targetAr: string }[];
}

export function fallbackPlan(audit: AuditResult): GrowthPlan {
  const m = audit.metrics;
  const best = m.bestSlots[0];
  const primeTime = best ? `${String(best.hourStart + 1).padStart(2, '0')}:00` : '20:30';
  return {
    generatedAt: new Date().toISOString(),
    source: 'rules',
    summaryAr: `تقييم الحساب ${audit.score}/100. أهم شي هسه: ${audit.findings[0]?.titleAr ?? 'الاستمرار بنفس الوتيرة'}.`,
    positioningAr: 'د. مصطفى هادي — أخصائي تقويم يشرحلك حالتك بالهندسة والأشعة قبل لا يبدي.',
    pillars: [
      { nameAr: 'شرح الحالات (تعليمي)', percent: 40, whyAr: 'يبني الثقة ويجيب حفظ ومشاركة.' },
      { nameAr: 'نتائج وقصص مراجعين', percent: 25, whyAr: 'دليل اجتماعي يقنع المترددين (بموافقة المريض).' },
      { nameAr: 'وراء الكواليس ووجه الدكتور', percent: 20, whyAr: 'الناس تحجز عند طبيب تعرفه.' },
      { nameAr: 'عروض وأسئلة الأسعار والأقساط', percent: 15, whyAr: 'يحول المتابع إلى رسالة دايركت.' },
    ],
    weeklySchedule: [
      { day: 6, time: primeTime, format: 'reel', pillarAr: 'شرح الحالات', ideaAr: 'خطأ شائع يخرّب نتيجة التقويم' },
      { day: 0, time: '19:00', format: 'story', pillarAr: 'وراء الكواليس', ideaAr: 'استفتاء: تقويم شفاف لو معدني؟' },
      { day: 1, time: primeTime, format: 'carousel', pillarAr: 'شرح الحالات', ideaAr: '5 علامات تحتاج تقويم' },
      { day: 2, time: '20:00', format: 'reel', pillarAr: 'نتائج وقصص', ideaAr: 'رحلة مراجع من أول زيارة' },
      { day: 3, time: '19:00', format: 'story', pillarAr: 'أسئلة وأجوبة', ideaAr: 'صندوق أسئلة للدكتور' },
      { day: 4, time: primeTime, format: 'reel', pillarAr: 'عروض وأقساط', ideaAr: 'شلون تبدي تقويم بقسط شهري مريح' },
      { day: 5, time: '21:00', format: 'story', pillarAr: 'خفيف', ideaAr: 'جمعة مباركة + تذكير بالحجز' },
    ],
    contentIdeas: [
      { format: 'reel', titleAr: 'ليش أسنانك رجعت عوجة بعد التقويم؟', hookAr: 'فكيت التقويم وبعد سنة رجعت أسنانك؟ هذا السبب 👇', whyAr: 'مشكلة شائعة تنرسل للأصدقاء.' },
      { format: 'carousel', titleAr: '5 أخطاء بتنظيف التقويم', hookAr: 'الخطأ رقم 3 يسويه الكل 😬', whyAr: 'محتوى يحفظه الناس.' },
      { format: 'reel', titleAr: 'الفرق بين التقويم الشفاف والمعدني', hookAr: 'شفاف لو معدني؟ الجواب مو مثل ما تتوقع', whyAr: 'سؤال يتكرر بالدايركت.' },
      { format: 'story', titleAr: 'اختبار: عندك عضة مفتوحة؟', hookAr: 'سد سنونك وشوف المراية… تتلاقى؟', whyAr: 'ستيكر تفاعلي يرفع ظهور الستوري.' },
      { format: 'reel', titleAr: 'يوم كامل بالعيادة بزيونة', hookAr: 'تعال وياي من أول مراجع لآخر واحد', whyAr: 'وجه الدكتور يبني الثقة.' },
    ],
    quickWins: [
      'خلي البايو يذكر: أخصائي تقويم • زيونة بغداد • أقساط • زر الواتساب.',
      'اختم كل منشور بدعوة وحدة: "علّق تقويم وأرسلك التفاصيل".',
      'استخدم 3–5 هاشتاغات محلية دقيقة بدل القوائم الطويلة.',
      'ثبّت 3 منشورات: نتيجة حالة، شرح الأقساط، شلون توصل للعيادة.',
      'رد على كل تعليق خلال أول ساعة من النشر.',
    ],
    learnFromOthersAr: [],
    boostPlan: {
      monthlyBudgetUSD: 60,
      ruleAr: 'روّج فقط المنشور اللي يتفوق عضوياً (أعلى 10% بالتفاعل خلال 48 ساعة)، بهدف رسائل الدايركت.',
      audienceAr: 'بغداد 15 كم حول زيونة، أعمار 18–40، اهتمامات: الجمال، الأعراس، الجامعات.',
    },
    kpis: [
      { nameAr: 'منشورات أسبوعياً', currentAr: m.postsPerWeek.toFixed(1), targetAr: '4–5' },
      { nameAr: 'نسبة التفاعل', currentAr: `${(m.avgEngagementRate * 100).toFixed(1)}%`, targetAr: `${Math.max(3, m.avgEngagementRate * 130).toFixed(1)}%` },
      { nameAr: 'رسائل دايركت جديدة أسبوعياً', currentAr: '—', targetAr: '+30%' },
      { nameAr: 'مواعيد محجوزة من إنستغرام', currentAr: '—', targetAr: '+20%' },
    ],
  };
}
