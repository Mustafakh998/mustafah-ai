import { NextRequest, NextResponse } from 'next/server';
import { generateStyledReply } from '@/lib/ai/replyEngine';
import { AccountId } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, accountId = 'drmustafa_hadi', patientName, history = [] } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (message.length > 1000) {
      return NextResponse.json({ error: 'Message too long' }, { status: 400 });
    }

    const result = await generateStyledReply(message, accountId as AccountId, patientName, history);

    return NextResponse.json(result);
  } catch (err) {
    console.error('Error in AI chat endpoint:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal Server Error' }, { status: 500 });
  }
}

