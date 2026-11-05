// Decides whether an AI reply may be sent on its own or must wait for a person.
// Shared by the server (webhook) and the browser (DM simulator), so keep it free of server-only imports.

/** Simple, low-risk questions the AI may answer on its own. Everything else becomes a draft. */
export const AUTO_SEND_INTENTS = new Set(['location_and_directions', 'general_dental_education', 'personal_professional_inquiry']);
export const AUTO_SEND_MIN_CONFIDENCE = 0.88;

/**
 * Topics that always need a person, even if the intent classifier missed them:
 * bookings/dates (the AI cannot actually book), money, and pain/emergencies.
 */
const SENSITIVE_RE =
  /حجز|احجز|أحجز|موعد|مواعيد|باجر|بكرة|الخميس|الجمعة|السبت|الأحد|الاحد|الاثنين|الثلاثاء|الأربعاء|الاربعاء|سعر|أسعار|اسعار|شكد|بيش|تكلف|كلفة|فلوس|قسط|أقساط|اقساط|تقسيط|دفع|خصم|عرض|ألم|الم |وجع|يوجع|نزف|ورم|التهاب|طوارئ|كسر|book|appointment|price|cost|pain|emergency/i;

export type ReplyMode = 'auto' | 'draft';

export function decideReplyMode(
  ai: { intent: string; confidence: number; requiresHumanHandoff?: boolean },
  patientMessage: string,
  draftAll = false
): ReplyMode {
  if (draftAll || ai.requiresHumanHandoff) return 'draft';
  if (SENSITIVE_RE.test(patientMessage)) return 'draft';
  return AUTO_SEND_INTENTS.has(ai.intent) && ai.confidence >= AUTO_SEND_MIN_CONFIDENCE ? 'auto' : 'draft';
}
