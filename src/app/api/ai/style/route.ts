import { NextRequest, NextResponse } from 'next/server';
import {
  addCuratedExample,
  deleteCuratedExample,
  isStyleStoreConfigured,
  listCuratedExamples,
  listLearnedExamples,
} from '@/lib/ai/replyStyle';
import { errorResponse } from '@/lib/growth/http';

/** GET /api/ai/style — curated examples + replies learned from real staff conversations. */
export async function GET() {
  if (!isStyleStoreConfigured()) return NextResponse.json({ configured: false, curated: [], learned: [] });
  try {
    // If the reply_style_examples migration hasn't been run yet, still show learned replies.
    let needsMigration = false;
    const [curated, learned] = await Promise.all([
      listCuratedExamples().catch((e: Error) => {
        if (/PGRST205|reply_style_examples/.test(e.message)) needsMigration = true;
        else throw e;
        return [];
      }),
      listLearnedExamples(12),
    ]);
    return NextResponse.json({ configured: true, needsMigration, curated, learned });
  } catch (e) {
    return errorResponse(e);
  }
}

/** POST /api/ai/style { customerMessage, staffReply } — add an example of how the team replies. */
export async function POST(request: NextRequest) {
  try {
    const { customerMessage, staffReply } = await request.json();
    if (typeof customerMessage !== 'string' || typeof staffReply !== 'string' || !customerMessage.trim() || !staffReply.trim()) {
      return NextResponse.json({ error: 'customerMessage and staffReply are required.' }, { status: 400 });
    }
    if (customerMessage.length > 1000 || staffReply.length > 2000) {
      return NextResponse.json({ error: 'Example is too long.' }, { status: 400 });
    }
    const id = await addCuratedExample(customerMessage.trim(), staffReply.trim());
    return NextResponse.json({ id });
  } catch (e) {
    return errorResponse(e);
  }
}

/** DELETE /api/ai/style?id=... */
export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  try {
    await deleteCuratedExample(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
