import { NextRequest, NextResponse } from 'next/server';
import { buildGrowthPlan, getAudit, getCompetitors, USERNAME_RE } from '@/lib/growth/service';
import { errorResponse } from '@/lib/growth/http';

/** POST /api/growth/plan { competitors?: string[] } — 30-day AI growth plan from the audit + similar pages. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const names: string[] = Array.isArray(body.competitors)
      ? body.competitors.map((u: unknown) => String(u).replace(/^@/, '').trim()).filter((u: string) => USERNAME_RE.test(u)).slice(0, 5)
      : [];
    const audit = await getAudit();
    const competitors = names.length ? await getCompetitors(names) : [];
    return NextResponse.json(await buildGrowthPlan(audit, competitors));
  } catch (e) {
    return errorResponse(e);
  }
}
