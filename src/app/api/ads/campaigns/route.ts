import { NextRequest, NextResponse } from 'next/server';
import { defaultMarketingApiClient } from '@/lib/instagram/marketingApi';
import { AccountId } from '@/types';

/**
 * POST /api/ads/campaigns
 * Actions:
 * - create: creates a campaign + ad set on Meta. ALWAYS created PAUSED — never spends on its own.
 * - activate: the only action that lets a campaign start spending. Requires a human click in the UI.
 * - pause: stops spend immediately.
 * - insights: reads live status/spend/impressions/reach for a campaign.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, accountId = 'drmustafa_hadi', campaignId } = body;

    if (action === 'create') {
      const { name, objective, dailyBudgetUSD, targeting } = body;
      if (!name || !objective || !dailyBudgetUSD || !targeting) {
        return NextResponse.json({ error: 'name, objective, dailyBudgetUSD, and targeting are required.' }, { status: 400 });
      }

      const campaignResult = await defaultMarketingApiClient.createCampaign({
        accountId: accountId as AccountId,
        name,
        objective,
        dailyBudgetUSD,
      });
      if (!campaignResult.success) {
        return NextResponse.json({ success: false, error: campaignResult.error, message: campaignResult.message }, { status: 502 });
      }

      const adSetResult = await defaultMarketingApiClient.createAdSet({
        accountId: accountId as AccountId,
        campaignId: campaignResult.data.id,
        name: `${name} — Ad Set`,
        dailyBudgetUSD,
        targeting,
      });
      if (!adSetResult.success) {
        // Campaign exists but paused with no ad set; surface both ids so staff can fix it in Ads Manager.
        return NextResponse.json(
          { success: false, error: adSetResult.error, message: adSetResult.message, campaignId: campaignResult.data.id },
          { status: 502 }
        );
      }

      return NextResponse.json({
        success: true,
        campaignId: campaignResult.data.id,
        adSetId: adSetResult.data.id,
        status: 'PAUSED',
      });
    }

    if (!campaignId || typeof campaignId !== 'string') {
      return NextResponse.json({ error: 'campaignId is required.' }, { status: 400 });
    }

    if (action === 'activate') {
      const result = await defaultMarketingApiClient.activateCampaign(accountId as AccountId, campaignId);
      if (!result.success) return NextResponse.json({ success: false, error: result.error, message: result.message }, { status: 502 });
      return NextResponse.json({ success: true, status: 'ACTIVE' });
    }

    if (action === 'pause') {
      const result = await defaultMarketingApiClient.pauseCampaign(accountId as AccountId, campaignId);
      if (!result.success) return NextResponse.json({ success: false, error: result.error, message: result.message }, { status: 502 });
      return NextResponse.json({ success: true, status: 'PAUSED' });
    }

    if (action === 'insights') {
      const result = await defaultMarketingApiClient.getCampaignInsights(accountId as AccountId, campaignId);
      if (!result.success) return NextResponse.json({ success: false, error: result.error, message: result.message }, { status: 502 });
      return NextResponse.json({ success: true, ...result.data });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[API /api/ads/campaigns] Error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
