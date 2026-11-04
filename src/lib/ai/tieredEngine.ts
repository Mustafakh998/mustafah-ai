export interface TieredAIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface TieredAIRequest {
  systemPrompt: string;
  userMessage: string;
  history?: Array<{ sender: 'user' | 'assistant' | 'staff'; text: string }>;
  temperature?: number;
  jsonMode?: boolean;
  timeoutMs?: number;
}

export interface TieredAIResponse {
  text: string;
  provider: 'gemini' | 'groq' | 'openrouter' | 'local_fallback';
  model: string;
  latencyMs: number;
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.AI_MODEL || 'gemini-3.5-flash-lite';

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct';

/**
 * Tier 1: Google Gemini (Primary Multi-Turn & Vision)
 */
async function callTier1Gemini(
  req: TieredAIRequest,
  timeoutMs = 12000
): Promise<string | null> {
  if (!GEMINI_API_KEY) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    // Prior history turns
    if (req.history && req.history.length > 0) {
      for (const m of req.history.slice(-6)) {
        contents.push({
          role: m.sender === 'user' ? 'user' : 'model',
          parts: [{ text: m.text }],
        });
      }
    }

    // Current turn
    contents.push({
      role: 'user',
      parts: [{ text: req.userMessage }],
    });

    const body: Record<string, unknown> = {
      contents,
      systemInstruction: {
        parts: [{ text: req.systemPrompt }],
      },
      generationConfig: {
        temperature: req.temperature ?? 0.7,
        maxOutputTokens: 1000,
        ...(req.jsonMode ? { responseMimeType: 'application/json' } : {}),
      },
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (res.ok) {
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (text) return text;
    } else {
      const err = await res.text();
      console.warn(`[TieredAI] Tier 1 (Gemini ${GEMINI_MODEL}) returned ${res.status}:`, err.slice(0, 120));
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[TieredAI] Tier 1 (Gemini) error/timeout:`, msg);
  } finally {
    clearTimeout(timer);
  }

  return null;
}

/**
 * Tier 2: GroqCloud (Ultra-Fast Sub-Second Fallback)
 */
async function callTier2Groq(
  req: TieredAIRequest,
  timeoutMs = 5000
): Promise<string | null> {
  if (!GROQ_API_KEY) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: req.systemPrompt },
    ];

    if (req.history && req.history.length > 0) {
      for (const m of req.history.slice(-6)) {
        messages.push({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.text,
        });
      }
    }

    messages.push({ role: 'user', content: req.userMessage });

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature: req.temperature ?? 0.7,
        max_tokens: 1000,
        ...(req.jsonMode ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: controller.signal,
    });

    if (res.ok) {
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content?.trim();
      if (text) return text;
    } else {
      const err = await res.text();
      console.warn(`[TieredAI] Tier 2 (Groq ${GROQ_MODEL}) returned ${res.status}:`, err.slice(0, 120));
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[TieredAI] Tier 2 (Groq) error/timeout:`, msg);
  } finally {
    clearTimeout(timer);
  }

  return null;
}

/**
 * Tier 3: OpenRouter (Open-Weights Fallback)
 */
async function callTier3OpenRouter(
  req: TieredAIRequest,
  timeoutMs = 6000
): Promise<string | null> {
  if (!OPENROUTER_API_KEY) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: req.systemPrompt },
    ];

    if (req.history && req.history.length > 0) {
      for (const m of req.history.slice(-6)) {
        messages.push({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.text,
        });
      }
    }

    messages.push({ role: 'user', content: req.userMessage });

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://mustafah-ai.vercel.app',
        'X-Title': 'MustafaH-AI Baghdad Platform',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages,
        temperature: req.temperature ?? 0.7,
        max_tokens: 1000,
        ...(req.jsonMode ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: controller.signal,
    });

    if (res.ok) {
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content?.trim();
      if (text) return text;
    } else {
      const err = await res.text();
      console.warn(`[TieredAI] Tier 3 (OpenRouter ${OPENROUTER_MODEL}) returned ${res.status}:`, err.slice(0, 120));
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[TieredAI] Tier 3 (OpenRouter) error/timeout:`, msg);
  } finally {
    clearTimeout(timer);
  }

  return null;
}

/**
 * Unified 3-Tier Multi-Engine Cascade
 * Tier 1 (Gemini) -> Tier 2 (Groq) -> Tier 3 (OpenRouter)
 */
export async function callTieredAI(
  req: TieredAIRequest
): Promise<TieredAIResponse | null> {
  const startTime = Date.now();

  // --- Tier 1: Google Gemini ---
  const tier1Text = await callTier1Gemini(req);
  if (tier1Text) {
    return {
      text: tier1Text,
      provider: 'gemini',
      model: GEMINI_MODEL,
      latencyMs: Date.now() - startTime,
    };
  }

  console.log('[TieredAI] Cascading to Tier 2: GroqCloud...');

  // --- Tier 2: GroqCloud ---
  const tier2Text = await callTier2Groq(req);
  if (tier2Text) {
    return {
      text: tier2Text,
      provider: 'groq',
      model: GROQ_MODEL,
      latencyMs: Date.now() - startTime,
    };
  }

  console.log('[TieredAI] Cascading to Tier 3: OpenRouter...');

  // --- Tier 3: OpenRouter ---
  const tier3Text = await callTier3OpenRouter(req);
  if (tier3Text) {
    return {
      text: tier3Text,
      provider: 'openrouter',
      model: OPENROUTER_MODEL,
      latencyMs: Date.now() - startTime,
    };
  }

  console.warn('[TieredAI] All 3 external AI tiers failed or were unavailable.');
  return null;
}
