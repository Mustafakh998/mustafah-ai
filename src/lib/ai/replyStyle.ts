// Learns the clinic team's reply style from (a) curated examples and (b) real staff replies
// stored in Supabase, and turns them into few-shot examples for the AI system prompt.
import 'server-only';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MAX_EXAMPLES = 8;
const CACHE_MS = 5 * 60_000;

export interface StyleExample {
  id: string;
  customerMessage: string;
  staffReply: string;
  source: 'curated' | 'learned';
  createdAt: string;
}

const headers = () => ({
  'Content-Type': 'application/json',
  apikey: SERVICE_KEY ?? '',
  Authorization: `Bearer ${SERVICE_KEY ?? ''}`,
});

export const isStyleStoreConfigured = () => Boolean(SUPABASE_URL && SERVICE_KEY);

async function sb<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers(), ...(init?.headers ?? {}) },
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (res.status === 204 ? null : res.json()) as T;
}

export async function listCuratedExamples(accountId = 'drmustafa_hadi'): Promise<StyleExample[]> {
  if (!isStyleStoreConfigured()) return [];
  const rows = await sb<{ id: string; customer_message: string; staff_reply: string; created_at: string }[]>(
    `reply_style_examples?account_id=eq.${encodeURIComponent(accountId)}&order=created_at.desc&limit=50`
  );
  return rows.map((r) => ({ id: r.id, customerMessage: r.customer_message, staffReply: r.staff_reply, source: 'curated', createdAt: r.created_at }));
}

export async function addCuratedExample(customerMessage: string, staffReply: string, accountId = 'drmustafa_hadi') {
  const rows = await sb<{ id: string }[]>('reply_style_examples', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify([{ account_id: accountId, customer_message: customerMessage, staff_reply: staffReply }]),
  });
  cache = null;
  return rows[0]?.id;
}

export async function deleteCuratedExample(id: string) {
  await sb(`reply_style_examples?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
  cache = null;
}

/** Pairs each patient message with the staff reply that directly followed it. */
export async function listLearnedExamples(limit = 20): Promise<StyleExample[]> {
  if (!isStyleStoreConfigured()) return [];
  const rows = await sb<{ id: string; conversation_id: string; sender: string; text: string; timestamp: string }[]>(
    'chat_messages?select=id,conversation_id,sender,text,timestamp&order=timestamp.desc&limit=600'
  );
  const byConv = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byConv.get(r.conversation_id) ?? [];
    list.push(r);
    byConv.set(r.conversation_id, list);
  }
  const pairs: StyleExample[] = [];
  for (const list of byConv.values()) {
    list.sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp));
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1];
      const cur = list[i];
      if (cur.sender === 'staff' && prev.sender === 'user' && cur.text.trim().length > 8) {
        pairs.push({ id: cur.id, customerMessage: prev.text, staffReply: cur.text, source: 'learned', createdAt: cur.timestamp });
      }
    }
  }
  return pairs.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, limit);
}

let cache: { at: number; examples: StyleExample[] } | null = null;

/** Curated examples first, then the most recent real staff replies. Cached for 5 minutes. */
export async function getStyleExamples(): Promise<StyleExample[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.examples;
  const [curated, learned] = await Promise.all([
    listCuratedExamples().catch(() => []),
    listLearnedExamples().catch(() => []),
  ]);
  const examples = [...curated, ...learned].slice(0, MAX_EXAMPLES);
  cache = { at: Date.now(), examples };
  return examples;
}

/** System-prompt section that teaches the model the team's tone without copying facts blindly. */
export function buildStylePrompt(examples: StyleExample[]): string {
  if (!examples.length) return '';
  const shots = examples
    .map((e, i) => `مثال ${i + 1}:\nالمراجع: ${e.customerMessage.slice(0, 400)}\nرد الفريق: ${e.staffReply.slice(0, 600)}`)
    .join('\n\n');
  return `

أسلوب فريق العيادة الحقيقي (تعلّم منه):
فيما يلي ردود حقيقية كتبها فريق العيادة للمراجعين. قلّد نفس النبرة، طول الرد، الكلمات العراقية، طريقة الترحيب والختام، واستخدام الإيموجي.
لا تنسخ الردود حرفياً، ولا تنقل منها أسعاراً أو مواعيد أو معلومات خاصة بمراجع آخر. المعلومات الطبية والعيادة تؤخذ من التعليمات أعلاه فقط.

${shots}`;
}
