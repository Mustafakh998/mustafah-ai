import { NextRequest, NextResponse } from 'next/server';
import { generateIraqiDialectResponse } from '@/lib/ai/iraqiEngine';
import { AccountId } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, accountId = 'drmustafa_hadi', patientName } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const result = generateIraqiDialectResponse(
      message,
      accountId as AccountId,
      patientName
    );

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Error in AI chat endpoint:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
