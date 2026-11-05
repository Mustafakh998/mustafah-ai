import { AccountId } from '@/types';
import { PILOT_ACCOUNT_ID } from './policy';
import { sanitizeLogString } from './graphApi';

/**
 * Meta Marketing API client for creating real ad campaigns.
 *
 * Safety rules enforced here (not just in the UI), because this client spends real money:
 *  1. Campaigns are ALWAYS created paused. Nothing we create can start spending without
 *     a separate, explicit `activateCampaign` call triggered by a human clicking "Activate".
 *  2. Every campaign is forced into Meta's "Special Ad Category: HEALTH" bucket, which is
 *     legally required for clinic/medical advertising and restricts detailed targeting.
 *  3. A hard ceiling on daily budget is enforced server-side, independent of whatever the
 *     UI sends, so a UI bug can't silently create a runaway-spend campaign.
 */

export interface MarketingApiOptions {
  customFetch?: typeof fetch;
  graphApiVersion?: string;
}

// Hard backstop, independent of the UI's own budget input validation.
const MAX_DAILY_BUDGET_USD = 100;

export type MarketingApiResult<T> =
  | { success: true; data: T }
  | {
      success: false;
      error:
        | 'UNAUTHORIZED_OR_MISSING_TOKEN'
        | 'MISSING_AD_ACCOUNT'
        | 'ACCOUNT_ISOLATION_PROHIBITION'
        | 'BUDGET_CEILING_EXCEEDED'
        | 'TOKEN_EXPIRED'
        | 'API_ERROR'
        | 'NETWORK_ERROR';
      code?: number;
      message: string;
    };

export interface CreateCampaignParams {
  accountId: AccountId;
  /** Human-readable name shown in Meta Ads Manager, e.g. "Boost: Damon ortho reel". */
  name: string;
  objective: 'OUTCOME_ENGAGEMENT' | 'OUTCOME_TRAFFIC' | 'OUTCOME_AWARENESS';
  dailyBudgetUSD: number;
}

export interface CreateAdSetParams {
  accountId: AccountId;
  campaignId: string;
  name: string;
  dailyBudgetUSD: number;
  /** Radius targeting around the clinic in Baghdad. */
  targeting: {
    latitude: number;
    longitude: number;
    radiusKm: number;
    ageMin: number;
    ageMax: number;
  };
  /** Instagram Graph object id of the post/reel to promote, when boosting existing content. */
  promotedObjectId?: string;
}

export interface MetaCampaign {
  id: string;
  name: string;
  status: 'PAUSED' | 'ACTIVE';
}

/**
 * Minimal Graph API error shape, duplicated from graphApi.ts's MetaGraphApiErrorResponse
 * to avoid importing DM-sending types into the ads client.
 */
interface MetaErrorBody {
  error?: { message?: string; code?: number; error_subcode?: number };
}

export class MarketingApiClient {
  private customFetch?: typeof fetch;
  private graphApiVersion: string;

  constructor(options: MarketingApiOptions = {}) {
    this.customFetch = options.customFetch;
    this.graphApiVersion = options.graphApiVersion ?? 'v21.0';
  }

  /** Same account-isolation rule as DM sending: only the authorized pilot account may spend money. */
  private resolveAccessToken(accountId: AccountId): string | null {
    if (accountId !== PILOT_ACCOUNT_ID) return null;
    const token = process.env.DR_MUSTAFA_ACCESS_TOKEN;
    if (!token || token.trim() === '' || token.includes('your_long_lived_user_access_token_here')) return null;
    return token.trim();
  }

  private resolveAdAccountId(): string | null {
    const raw = process.env.DR_MUSTAFA_AD_ACCOUNT_ID?.trim();
    if (!raw) return null;
    return raw.startsWith('act_') ? raw : `act_${raw}`;
  }

  private async request<T>(
    path: string,
    token: string,
    init: { method: 'GET' | 'POST'; body?: Record<string, unknown> }
  ): Promise<MarketingApiResult<T>> {
    const fetchFn = this.customFetch || globalThis.fetch;
    const url = `https://graph.facebook.com/${this.graphApiVersion}/${path}`;

    try {
      const response = await fetchFn(url, {
        method: init.method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: init.body ? JSON.stringify(init.body) : undefined,
      });
      const raw = (await response.json()) as T & MetaErrorBody;

      if (response.ok) {
        return { success: true, data: raw };
      }

      const metaError = raw.error;
      if (metaError?.code === 190) {
        console.error('[Marketing API] Auth failure: token expired or invalidated (Code 190).');
        return { success: false, error: 'TOKEN_EXPIRED', code: 190, message: metaError.message || 'Access token expired.' };
      }

      console.error(`[Marketing API] Error on ${path}:`, sanitizeLogString(metaError?.message || 'Unknown error'));
      return {
        success: false,
        error: 'API_ERROR',
        code: metaError?.code,
        message: metaError?.message || `Meta Marketing API error on ${path}.`,
      };
    } catch (err) {
      console.error(`[Marketing API] Network error on ${path}:`, sanitizeLogString(String(err)));
      return { success: false, error: 'NETWORK_ERROR', message: 'Network error reaching the Meta Marketing API.' };
    }
  }

  /**
   * Creates a campaign. ALWAYS created with status=PAUSED and special_ad_categories=['HEALTH'],
   * regardless of what the caller asks for — this cannot be overridden by a parameter.
   */
  public async createCampaign(params: CreateCampaignParams): Promise<MarketingApiResult<MetaCampaign>> {
    if (params.accountId !== PILOT_ACCOUNT_ID) {
      return {
        success: false,
        error: 'ACCOUNT_ISOLATION_PROHIBITION',
        message: 'Ad spend blocked: only the authorized @drmustafa_hadi account may create campaigns.',
      };
    }
    if (params.dailyBudgetUSD <= 0 || params.dailyBudgetUSD > MAX_DAILY_BUDGET_USD) {
      return {
        success: false,
        error: 'BUDGET_CEILING_EXCEEDED',
        message: `Daily budget must be between $1 and $${MAX_DAILY_BUDGET_USD}.`,
      };
    }

    const token = this.resolveAccessToken(params.accountId);
    if (!token) {
      return { success: false, error: 'UNAUTHORIZED_OR_MISSING_TOKEN', message: 'DR_MUSTAFA_ACCESS_TOKEN is missing or not configured.' };
    }
    const adAccountId = this.resolveAdAccountId();
    if (!adAccountId) {
      return { success: false, error: 'MISSING_AD_ACCOUNT', message: 'DR_MUSTAFA_AD_ACCOUNT_ID is not configured.' };
    }

    return this.request<MetaCampaign>(`${adAccountId}/campaigns`, token, {
      method: 'POST',
      body: {
        name: params.name,
        objective: params.objective,
        status: 'PAUSED', // Never create a campaign that is already running.
        special_ad_categories: ['HEALTH'], // Required for medical/clinic advertising; not optional.
        daily_budget: Math.round(params.dailyBudgetUSD * 100), // Meta expects minor currency units (cents).
      },
    });
  }

  /** Creates an ad set under an existing (paused) campaign, scoped to a Baghdad radius. */
  public async createAdSet(params: CreateAdSetParams): Promise<MarketingApiResult<{ id: string }>> {
    if (params.accountId !== PILOT_ACCOUNT_ID) {
      return { success: false, error: 'ACCOUNT_ISOLATION_PROHIBITION', message: 'Ad spend blocked for this account.' };
    }
    if (params.dailyBudgetUSD <= 0 || params.dailyBudgetUSD > MAX_DAILY_BUDGET_USD) {
      return { success: false, error: 'BUDGET_CEILING_EXCEEDED', message: `Daily budget must be between $1 and $${MAX_DAILY_BUDGET_USD}.` };
    }

    const token = this.resolveAccessToken(params.accountId);
    if (!token) return { success: false, error: 'UNAUTHORIZED_OR_MISSING_TOKEN', message: 'DR_MUSTAFA_ACCESS_TOKEN is missing.' };
    const adAccountId = this.resolveAdAccountId();
    if (!adAccountId) return { success: false, error: 'MISSING_AD_ACCOUNT', message: 'DR_MUSTAFA_AD_ACCOUNT_ID is not configured.' };

    const { latitude, longitude, radiusKm, ageMin, ageMax } = params.targeting;

    return this.request<{ id: string }>(`${adAccountId}/adsets`, token, {
      method: 'POST',
      body: {
        name: params.name,
        campaign_id: params.campaignId,
        status: 'PAUSED',
        daily_budget: Math.round(params.dailyBudgetUSD * 100),
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'REACH',
        bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
        targeting: {
          geo_locations: {
            custom_locations: [{ latitude, longitude, radius: radiusKm, distance_unit: 'kilometer' }],
          },
          age_min: ageMin,
          age_max: ageMax,
          // Special Ad Category: HEALTH disallows detailed interest/behavior targeting on Meta's side;
          // we don't send any `flexible_spec` interest targeting here on purpose.
        },
      },
    });
  }

  /**
   * The ONLY call that can make a campaign spend money. Always requires an explicit,
   * separate invocation — never bundled into campaign/ad-set creation.
   */
  public async activateCampaign(accountId: AccountId, campaignId: string): Promise<MarketingApiResult<{ success: true }>> {
    if (accountId !== PILOT_ACCOUNT_ID) {
      return { success: false, error: 'ACCOUNT_ISOLATION_PROHIBITION', message: 'Ad spend blocked for this account.' };
    }
    const token = this.resolveAccessToken(accountId);
    if (!token) return { success: false, error: 'UNAUTHORIZED_OR_MISSING_TOKEN', message: 'DR_MUSTAFA_ACCESS_TOKEN is missing.' };

    return this.request<{ success: true }>(campaignId, token, { method: 'POST', body: { status: 'ACTIVE' } });
  }

  public async pauseCampaign(accountId: AccountId, campaignId: string): Promise<MarketingApiResult<{ success: true }>> {
    if (accountId !== PILOT_ACCOUNT_ID) {
      return { success: false, error: 'ACCOUNT_ISOLATION_PROHIBITION', message: 'Blocked for this account.' };
    }
    const token = this.resolveAccessToken(accountId);
    if (!token) return { success: false, error: 'UNAUTHORIZED_OR_MISSING_TOKEN', message: 'DR_MUSTAFA_ACCESS_TOKEN is missing.' };

    return this.request<{ success: true }>(campaignId, token, { method: 'POST', body: { status: 'PAUSED' } });
  }

  /** Reads live spend/status for a campaign, used to show real numbers instead of the old simulated zeros. */
  public async getCampaignInsights(
    accountId: AccountId,
    campaignId: string
  ): Promise<MarketingApiResult<{ status: string; spend: number; impressions: number; reach: number }>> {
    if (accountId !== PILOT_ACCOUNT_ID) {
      return { success: false, error: 'ACCOUNT_ISOLATION_PROHIBITION', message: 'Blocked for this account.' };
    }
    const token = this.resolveAccessToken(accountId);
    if (!token) return { success: false, error: 'UNAUTHORIZED_OR_MISSING_TOKEN', message: 'DR_MUSTAFA_ACCESS_TOKEN is missing.' };

    const statusRes = await this.request<{ status: string }>(`${campaignId}?fields=status`, token, { method: 'GET' });
    if (!statusRes.success) return statusRes;

    const insightsRes = await this.request<{ data: { spend?: string; impressions?: string; reach?: string }[] }>(
      `${campaignId}/insights?fields=spend,impressions,reach`,
      token,
      { method: 'GET' }
    );
    const row = insightsRes.success ? insightsRes.data.data?.[0] : undefined;

    return {
      success: true,
      data: {
        status: statusRes.data.status,
        spend: Number(row?.spend ?? 0),
        impressions: Number(row?.impressions ?? 0),
        reach: Number(row?.reach ?? 0),
      },
    };
  }
}

export const defaultMarketingApiClient = new MarketingApiClient();
