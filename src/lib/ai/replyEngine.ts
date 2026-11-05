// Server-side entry point for DM replies: adds the team's learned reply style and decides
// whether a reply may be sent automatically or must wait for a person to approve it.
import 'server-only';
import { AccountId } from '@/types';
import { AIResponseResult } from './iraqiEngine';
import { generateGeminiDialectResponse } from './geminiEngine';
import { ChatHistoryMessage } from './smartFallback';
import { buildStylePrompt, getStyleExamples } from './replyStyle';
import { decideReplyMode, ReplyMode } from './replyPolicy';

export type { ReplyMode } from './replyPolicy';

const CLINIC_PHONE = process.env.NEXT_PUBLIC_CLINIC_PHONE || '07768886667';

/** Short holding message sent while a person prepares the real answer. Emergencies always get the phone number. */
export function holdingMessageFor(intent: string): string {
  if (intent === 'urgent_clinical_question') {
    return `سلامتك ألف سلامة 🙏 إذا الألم شديد أو أكو نزف أو ورم، اتصل فوراً على ${CLINIC_PHONE}. فريق د. مصطفى راح يتابع رسالتك هسه.`;
  }
  return 'أهلاً وسهلاً بيك 🌷 وصلت رسالتك، فريق د. مصطفى راح يرد عليك بالتفصيل خلال وقت قصير إن شاء الله.';
}

export async function generateStyledReply(
  userMessage: string,
  accountId: AccountId = 'drmustafa_hadi',
  patientName?: string,
  history: ChatHistoryMessage[] = []
): Promise<AIResponseResult & { mode: ReplyMode }> {
  const examples = await getStyleExamples().catch(() => []);
  const ai = await generateGeminiDialectResponse(userMessage, accountId, patientName, history, buildStylePrompt(examples));
  // REPLY_MODE=draft_all makes every reply wait for approval (default: simple questions auto-send).
  return { ...ai, mode: decideReplyMode(ai, userMessage, process.env.REPLY_MODE === 'draft_all') };
}
