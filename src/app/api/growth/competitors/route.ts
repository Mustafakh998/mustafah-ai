import { NextRequest, NextResponse } from 'next/server';
import { getCompetitors, USERNAME_RE } from '@/lib/growth/service';
import { errorResponse } from '@/lib/growth/http';

/** POST /api/growth/competitors { usernames: string[], refresh?: boolean } — public stats of up to 5 pages. */
export async function POST(request: NextRequest) {
  try {
    const { usernames, refresh } = await request.json();
    const list: string[] = Array.isArray(usernames) ? usernames.map((u) => String(u).replace(/^@/, '').trim()) : [];
    if (!list.length || list.length > 5 || !list.every((u) => USERNAME_RE.test(u))) {
      return NextResponse.json({ error: 'Provide 1–5 valid Instagram usernames.' }, { status: 400 });
    }
    return NextResponse.json({ competitors: await getCompetitors(list, Boolean(refresh)) });
  } catch (e) {
    return errorResponse(e);
  }
}
