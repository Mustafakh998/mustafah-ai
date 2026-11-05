import { NextRequest, NextResponse } from 'next/server';
import { getAudit } from '@/lib/growth/service';
import { errorResponse } from '@/lib/growth/http';

/** GET /api/growth/audit[?refresh=1] — audit of the last 30 posts (cached 10 minutes). */
export async function GET(request: NextRequest) {
  // Read the request outside try/catch so Next.js can detect this route is dynamic.
  const refresh = request.nextUrl.searchParams.get('refresh') === '1';
  try {
    return NextResponse.json(await getAudit(refresh));
  } catch (e) {
    return errorResponse(e);
  }
}
