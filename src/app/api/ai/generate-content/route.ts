import { NextRequest, NextResponse } from 'next/server';
import { generateDentalContent, generate30DayCalendar } from '@/lib/ai/contentGenerator';
import { AccountId } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, accountId = 'drmustafa_hadi', topic, series, format } = body;

    if (action === 'generate_30_day_calendar') {
      const calendar = generate30DayCalendar();
      return NextResponse.json({ calendar });
    }

    const item = generateDentalContent({
      accountId: accountId as AccountId,
      topic,
      series,
      format,
    });

    return NextResponse.json({ item });
  } catch (err: any) {
    console.error('Error generating content:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
