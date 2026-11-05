// Server-only read client for the Instagram Graph API: profile, media + insights, and
// Business Discovery (public stats of other business/creator accounts).
// Works with both token types:
//   - Instagram Login tokens (start with "IGAA")  -> graph.instagram.com, /me
//   - Facebook Login tokens  (start with "EAA")   -> graph.facebook.com, IG business user id
// Business Discovery is only available with Facebook Login tokens.
import 'server-only';

const API_VERSION = process.env.META_GRAPH_API_VERSION || 'v21.0';

export class GraphError extends Error {
  constructor(message: string, public code?: number, public status?: number) {
    super(message);
    this.name = 'GraphError';
  }
}

export interface IgProfile {
  id: string;
  username: string;
  name?: string;
  biography?: string;
  followersCount: number;
  followsCount?: number;
  mediaCount: number;
  profilePictureUrl?: string;
  website?: string;
}

export type MediaFormat = 'reel' | 'carousel' | 'post' | 'video';

export interface IgMedia {
  id: string;
  caption: string;
  format: MediaFormat;
  timestamp: string;
  permalink?: string;
  thumbnailUrl?: string;
  likes: number;
  comments: number;
  // Insights (own account only; undefined for other accounts)
  reach?: number;
  views?: number;
  saves?: number;
  shares?: number;
  avgWatchTimeMs?: number;
}

function getToken(): string {
  const token = process.env.DR_MUSTAFA_ACCESS_TOKEN?.trim();
  if (!token || token.includes('your_')) {
    throw new GraphError('DR_MUSTAFA_ACCESS_TOKEN is not set in the server environment.', undefined, 401);
  }
  return token;
}

const isInstagramLoginToken = (t: string) => t.startsWith('IGAA');

function baseUrl(token: string) {
  return isInstagramLoginToken(token) ? 'https://graph.instagram.com' : 'https://graph.facebook.com';
}

async function graphGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const token = getToken();
  const qs = new URLSearchParams({ ...params, access_token: token });
  const res = await fetch(`${baseUrl(token)}/${API_VERSION}/${path}?${qs}`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    // Never include the URL: it contains the access token.
    const e = body.error ?? {};
    throw new GraphError(e.message || `Graph API HTTP ${res.status}`, e.code, res.status);
  }
  return body as T;
}

let cachedUserId: string | null = null;

/** The only Instagram account this dashboard may read or post as. */
const EXPECTED_USERNAME = () => (process.env.DR_MUSTAFA_INSTAGRAM_USERNAME || 'drmustafa_hadi').replace(/^@/, '').toLowerCase();

/** Resolves the Instagram professional account id for the configured token. */
export async function getIgUserId(): Promise<string> {
  if (cachedUserId) return cachedUserId;
  const token = getToken();
  const expected = EXPECTED_USERNAME();

  type IgRef = { id: string; username?: string };
  let candidates: IgRef[] = [];

  if (isInstagramLoginToken(token)) {
    const me = await graphGet<{ user_id?: string; id: string; username?: string }>('me', { fields: 'user_id,id,username' });
    candidates = [{ id: me.user_id || me.id, username: me.username }];
  } else if (process.env.DR_MUSTAFA_INSTAGRAM_USER_ID) {
    candidates = [{ id: process.env.DR_MUSTAFA_INSTAGRAM_USER_ID }];
  } else {
    // Page token (the setup in docs/meta_webhook_and_deployment_runbook.md): "me" is the Facebook Page.
    const page = await graphGet<{ instagram_business_account?: IgRef }>('me', {
      fields: 'instagram_business_account{id,username}',
    }).catch(() => null);
    if (page?.instagram_business_account) {
      candidates = [page.instagram_business_account];
    } else {
      // User token: it can see every Page/Instagram account this person manages.
      const pages = await graphGet<{ data: { instagram_business_account?: IgRef }[] }>('me/accounts', {
        fields: 'instagram_business_account{id,username}',
      });
      candidates = pages.data.flatMap((p) => (p.instagram_business_account ? [p.instagram_business_account] : []));
    }
  }

  // Look up usernames we don't have yet, then pick the expected account by name, never "the first one".
  for (const c of candidates) {
    if (!c.username) c.username = (await graphGet<{ username: string }>(c.id, { fields: 'username' })).username;
  }
  const match = candidates.find((c) => c.username?.toLowerCase() === expected);
  if (!match) {
    const found = candidates.map((c) => `@${c.username}`).join(', ') || 'none';
    throw new GraphError(
      `This token is for ${found}, not @${expected}. Generate the token again and select only the @${expected} Page/Instagram account.`,
      undefined,
      403
    );
  }
  cachedUserId = match.id;
  return cachedUserId;
}

const PROFILE_FIELDS = 'id,username,name,biography,followers_count,follows_count,media_count,profile_picture_url,website';

interface RawProfile {
  id: string;
  username: string;
  name?: string;
  biography?: string;
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
  profile_picture_url?: string;
  website?: string;
}

const mapProfile = (p: RawProfile): IgProfile => ({
  id: p.id,
  username: p.username,
  name: p.name,
  biography: p.biography,
  followersCount: p.followers_count ?? 0,
  followsCount: p.follows_count,
  mediaCount: p.media_count ?? 0,
  profilePictureUrl: p.profile_picture_url,
  website: p.website,
});

export async function getProfile(): Promise<IgProfile> {
  const id = await getIgUserId();
  return mapProfile(await graphGet<RawProfile>(id, { fields: PROFILE_FIELDS }));
}

interface RawMedia {
  id: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  timestamp: string;
  permalink?: string;
  thumbnail_url?: string;
  media_url?: string;
  like_count?: number;
  comments_count?: number;
}

function formatOf(m: RawMedia): MediaFormat {
  if (m.media_product_type === 'REELS') return 'reel';
  if (m.media_type === 'CAROUSEL_ALBUM') return 'carousel';
  if (m.media_type === 'VIDEO') return 'video';
  return 'post';
}

const mapMedia = (m: RawMedia): IgMedia => ({
  id: m.id,
  caption: m.caption ?? '',
  format: formatOf(m),
  timestamp: m.timestamp,
  permalink: m.permalink,
  thumbnailUrl: m.thumbnail_url ?? (m.media_type === 'IMAGE' ? m.media_url : undefined),
  likes: m.like_count ?? 0,
  comments: m.comments_count ?? 0,
});

const MEDIA_FIELDS =
  'id,caption,media_type,media_product_type,timestamp,permalink,thumbnail_url,media_url,like_count,comments_count';

// Metric names change between API versions; try the full set, then a minimal one.
const METRIC_SETS = {
  reel: ['reach', 'views', 'saved', 'shares', 'ig_reels_avg_watch_time'],
  default: ['reach', 'views', 'saved', 'shares'],
  minimal: ['reach', 'saved'],
};

async function fetchMediaInsights(media: IgMedia): Promise<IgMedia> {
  const sets = [media.format === 'reel' ? METRIC_SETS.reel : METRIC_SETS.default, METRIC_SETS.minimal];
  for (const metrics of sets) {
    try {
      const res = await graphGet<{ data: { name: string; values?: { value: number }[]; total_value?: { value: number } }[] }>(
        `${media.id}/insights`,
        { metric: metrics.join(',') }
      );
      const v = (name: string) => {
        const d = res.data.find((x) => x.name === name);
        return d?.total_value?.value ?? d?.values?.[0]?.value;
      };
      return {
        ...media,
        reach: v('reach'),
        views: v('views'),
        saves: v('saved'),
        shares: v('shares'),
        avgWatchTimeMs: v('ig_reels_avg_watch_time'),
      };
    } catch {
      // try the next, smaller metric set
    }
  }
  return media;
}

/** Runs async work over items with limited concurrency (keeps us under Graph API rate limits). */
async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

export async function getRecentMediaWithInsights(limit = 30): Promise<IgMedia[]> {
  const id = await getIgUserId();
  const res = await graphGet<{ data: RawMedia[] }>(`${id}/media`, { fields: MEDIA_FIELDS, limit: String(limit) });
  return mapLimit(res.data.map(mapMedia), 4, fetchMediaInsights);
}

/** Public profile + recent posts of another business/creator account (no insights). */
export async function getBusinessDiscovery(username: string, mediaLimit = 25): Promise<{ profile: IgProfile; media: IgMedia[] }> {
  if (isInstagramLoginToken(getToken())) {
    throw new GraphError(
      'Comparing other pages needs a Facebook Login token (starts with "EAA") with instagram_basic and pages_read_engagement. Instagram Login tokens (IGAA...) cannot use Business Discovery.',
      undefined,
      400
    );
  }
  const id = await getIgUserId();
  const fields = `business_discovery.username(${username}){${PROFILE_FIELDS.replace(',profile_picture_url,website', ',profile_picture_url')},media.limit(${mediaLimit}){id,caption,media_type,media_product_type,timestamp,permalink,like_count,comments_count}}`;
  const res = await graphGet<{ business_discovery: RawProfile & { media?: { data: RawMedia[] } } }>(id, { fields });
  const bd = res.business_discovery;
  return { profile: mapProfile(bd), media: (bd.media?.data ?? []).map(mapMedia) };
}

export interface ConnectionStatus {
  configured: boolean;
  tokenType?: 'instagram_login' | 'facebook_login';
  profile?: IgProfile;
  canReadInsights?: boolean;
  canCompare?: boolean;
  error?: string;
}

/** Checks which features the configured token supports. */
export async function checkConnection(): Promise<ConnectionStatus> {
  let token: string;
  try {
    token = getToken();
  } catch (e) {
    return { configured: false, error: (e as Error).message };
  }
  const tokenType = isInstagramLoginToken(token) ? 'instagram_login' : 'facebook_login';
  try {
    const profile = await getProfile();
    let canReadInsights = false;
    try {
      const media = await graphGet<{ data: RawMedia[] }>(`${profile.id}/media`, { fields: 'id', limit: '1' });
      if (media.data[0]) {
        await graphGet(`${media.data[0].id}/insights`, { metric: 'reach' });
      }
      canReadInsights = true;
    } catch {
      canReadInsights = false;
    }
    return {
      configured: true,
      tokenType,
      profile,
      canReadInsights,
      canCompare: tokenType === 'facebook_login',
    };
  } catch (e) {
    return { configured: true, tokenType, error: (e as Error).message };
  }
}
