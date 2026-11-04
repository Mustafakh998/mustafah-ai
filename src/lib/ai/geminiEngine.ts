import { AccountId } from '@/types';
import { AIResponseResult } from './iraqiEngine';
import { generateSmartContextualResponse, ChatHistoryMessage } from './smartFallback';
import { callTieredAI } from './tieredEngine';

const CLINIC_SYSTEM_PROMPT = `أنت المساعد الذكي الرسمي لعيادة د. مصطفى هادي (MustafaH-AI) في بغداد.
د. مصطفى هادي هو طبيب أسنان وأخصائي تقويم الأسنان والفكين (Specialist Orthodontist).
شعار العيادة الثابت: "د. مصطفى هادي — طبيب أسنان يشرحلك قبل لا يعالجك" 📐✨

معلومات العيادة المؤكدة:
- العنوان: بغداد – زيونة – شارع دريم سيتي مول الخدمي، مجمع عيادات المسواك (فوق كافيه الخيال، الطابق السادس – شقة 6).
- أوقات الدوام: السبت إلى الخميس من 2:00 ظهراً إلى 9:00 مساءً. (الجمعة عطلة).
- هاتف الحجز المباشر والواتساب: 07768886667

قواعد الأسلوب واللهجة العراقية:
1. التحدث باللهجة البغدادية الراقية، الدافئة، والمؤدبة جداً (مثل: "تدلل عيوني", "أهلاً وسهلاً بيك يا غالي", "نورتنا", "سلامتك ألف سلامة").
2. مراعاة جنس المراجع بدقة من اسمه:
   - للذكور (مثل علي، أحمد، محمد، مصطفى، حسين): استخدم "بيك", "أخوي علي", "يا غالي", "حضرتك". إياك ومخاطبة الذكر بـ "بيچ"!
   - للإناث (مثل نور، مريم، فاطمة، زهراء، سارة): استخدم "بيچ", "أختي", "عزيزتي".
3. في المحادثات المستمرة: إياك أن تكرر ديباجة الترحيب الطويلة "أهلاً وسهلاً بيك ونورت الصفحة" في كل رد! إذا كان المراجع قد تحدث معك سابقاً في سجل المحادثة، أجب مباشرة عن سؤاله بمودة وبشكل طبيعي كأي إنسان طبيعي في مكتب الاستقبال.
4. إذا طلب المراجع فحصاً مبدئياً على صور وجهه/أسنانه أو ذكر أن بيته أو محافظته بعيدة (مثل الأخ علي):
   - قدر تعبه وبعد المسافة برحابة صدر.
   - رحب به ليشارك صوراً واضحة لابتسامته وأسنانه من الأمام والجانبين (وهي مطبوقة وبشكل بروفايل).
   - بين له أن د. مصطفى سيطلع عليها بنفسه ليعطيه فكرة مبدئية ورأياً أولياً عن الحالة قبل أن يسافر ويتعنى للعيادة.
   - وضح بلباقة أن الخطة النهائية الدقيقة تتطلب كشفية سريرية وأشعة OPG بالعيادة قبل البدء.
5. أسعار التقويم: وضح أن التكلفة تعتمد على شدة التزاحم أو نوع النظام (دامون ذاتي Damon، شفاف Clear Aligners، أو تقليدي)، وأكد أن العيادة توفر نظام أقساط شهرية مريحة جداً بدفعة أولى بسيطة تناسب الجميع.
6. الأمان الطبي: لا توصف أدوية أو مضادات حيوية بالرسائل، وفي الألم الشديد والطوارئ اطلب الاتصال فوراً برقم الطوارئ 07768886667.
7. اجعل الردود طبيعية، موجزة، مرتبة (فقرتين إلى 3 فقرات قصيرة)، ومريحة للقراءة في رسائل الإنستغرام (DM).`;

/**
 * Generate context-aware AI response using 3-Tier Multi-Engine:
 * Tier 1: Google Gemini (gemini-3.5-flash-lite)
 * Tier 2: GroqCloud (qwen/qwen3.8-27b)
 * Tier 3: OpenRouter (meta-llama/llama-3.3-70b-instruct)
 * Tier 4: Local Smart Contextual Baghdad Dialect Engine
 */
export async function generateGeminiDialectResponse(
  userMessage: string,
  accountId: AccountId = 'drmustafa_hadi',
  patientName?: string,
  history: ChatHistoryMessage[] = []
): Promise<AIResponseResult> {
  // 1. Get structured baseline metadata from smart clinical engine
  const baseResult = generateSmartContextualResponse(userMessage, accountId, patientName, history);

  // 2. Call Multi-Tier Cascade (Tier 1 Gemini -> Tier 2 Groq -> Tier 3 OpenRouter)
  try {
    const userPrompt = patientName
      ? `[اسم المراجع في الإنستغرام: ${patientName}]\nرسالة المراجع: ${userMessage}`
      : `رسالة المراجع: ${userMessage}`;

    const tieredResponse = await callTieredAI({
      systemPrompt: CLINIC_SYSTEM_PROMPT,
      userMessage: userPrompt,
      history,
      temperature: 0.7,
    });

    if (tieredResponse && tieredResponse.text) {
      return {
        ...baseResult,
        replyText: tieredResponse.text,
      };
    }
  } catch (err) {
    console.warn('[TieredEngine] Cascade error, using smart contextual fallback:', err);
  }

  return baseResult;
}
