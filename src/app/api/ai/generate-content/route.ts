import { NextRequest, NextResponse } from 'next/server';
import { generateDentalContentAsync, generate30DayCalendar } from '@/lib/ai/contentGenerator';
import { getAudit } from '@/lib/growth/service';
import { DAY_NAMES_AR } from '@/lib/growth/audit';
import { AccountId } from '@/types';

/** Summarises the account audit so the generator writes content that fits what already works. */
async function accountInsights(): Promise<string | undefined> {
  try {
    const a = await getAudit();
    const m = a.metrics;
    const best = [...m.formats].sort((x, y) => y.avgEngagementRate - x.avgEngagementRate)[0];
    const lines = [
      best && `أفضل صيغة عندنا: ${best.format} (تفاعل ${(best.avgEngagementRate * 100).toFixed(1)}%).`,
      m.bestSlots[0] && `أفضل وقت: ${DAY_NAMES_AR[m.bestSlots[0].day]} الساعة ${m.bestSlots[0].hourStart}:00–${m.bestSlots[0].hourStart + 3}:00.`,
      a.topPosts.length && `أنجح منشوراتنا بدأت بـ: ${a.topPosts.map((p) => `"${p.caption.slice(0, 70)}"`).join(' | ')}`,
      a.findings.length && `نقاط ضعف لازم نعالجها: ${a.findings.filter((f) => f.severity !== 'opportunity').slice(0, 3).map((f) => f.titleAr).join('، ')}.`,
    ].filter(Boolean);
    return lines.join('\n');
  } catch {
    return undefined; // no token or Instagram unavailable: generate without account data
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, accountId = 'drmustafa_hadi', topic, series, format, useInsights = true } = body;

    if (action === 'generate_30_day_calendar') {
      const calendar = generate30DayCalendar();
      return NextResponse.json({ calendar });
    }

    if (typeof topic === 'string' && topic.length > 300) {
      return NextResponse.json({ error: 'Topic is too long.' }, { status: 400 });
    }

    const insightsAr = useInsights ? await accountInsights() : undefined;
    const item = await generateDentalContentAsync({
      accountId: accountId as AccountId,
      topic,
      series,
      format,
      insightsAr,
    });

    return NextResponse.json({ item, usedAccountData: Boolean(insightsAr) });
  } catch (err) {
    console.error('Error generating content:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal Server Error' }, { status: 500 });
  }
}
