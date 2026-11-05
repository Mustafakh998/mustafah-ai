import 'server-only';
import { NextResponse } from 'next/server';
import { GraphError } from '@/lib/instagram/insights';

/** Converts thrown errors into JSON responses without leaking secrets. */
export function errorResponse(e: unknown) {
  if (e instanceof GraphError) {
    return NextResponse.json({ error: e.message, code: e.code }, { status: e.status && e.status >= 400 ? e.status : 502 });
  }
  console.error('[API]', e);
  return NextResponse.json({ error: e instanceof Error ? e.message : 'Internal error' }, { status: 500 });
}
