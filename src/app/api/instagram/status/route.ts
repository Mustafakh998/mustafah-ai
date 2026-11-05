import { NextResponse, connection } from 'next/server';
import { checkConnection } from '@/lib/instagram/insights';

/** GET /api/instagram/status — which Instagram features the configured token supports. */
export async function GET() {
  await connection(); // always run at request time, never at build
  return NextResponse.json(await checkConnection());
}
