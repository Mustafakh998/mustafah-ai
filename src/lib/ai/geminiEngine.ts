import { GoogleGenAI } from '@google/genai';
import { AccountId, TreatmentType } from '@/types';
import { AIResponseResult } from './iraqiEngine';
import { generateSmartContextualResponse, ChatHistoryMessage, detectGender } from './smartFallback';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const MODEL_NAME = process.env.AI_MODEL || 'gemini-2.5-flash';

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
 * Generate context-aware AI response using Google Gemini if API key is configured,
 * otherwise smoothly fallback to the smart contextual Baghdad dialect engine.
 */
export async function generateGeminiDialectResponse(
  userMessage: string,
  accountId: AccountId = 'drmustafa_hadi',
  patientName?: string,
  history: ChatHistoryMessage[] = []
): Promise<AIResponseResult> {
  // 1. Get structured baseline from smart reasoning engine
  const baseResult = generateSmartContextualResponse(userMessage, accountId, patientName, history);

  // 2. If Gemini API key is missing or blank, use the smart contextual engine
  if (!GEMINI_API_KEY || GEMINI_API_KEY.includes('your_gemini') || GEMINI_API_KEY.length < 10) {
    return baseResult;
  }

  // 3. Call Google Gemini via @google/genai SDK
  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    // Format conversation history for Gemini
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    // Add previous turns if available
    for (const msg of history.slice(-6)) {
      contents.push({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }],
      });
    }

    // Add current user prompt
    const userPrompt = patientName
      ? `[اسم المراجع في الإنستغرام: ${patientName}]\nرسالة المراجع: ${userMessage}`
      : `رسالة المراجع: ${userMessage}`;

    contents.push({
      role: 'user',
      parts: [{ text: userPrompt }],
    });

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents,
      config: {
        systemInstruction: CLINIC_SYSTEM_PROMPT,
        temperature: 0.7,
        maxOutputTokens: 600,
      },
    });

    const generatedText = response.text?.trim();
    if (generatedText) {
      return {
        ...baseResult,
        replyText: generatedText,
      };
    }
  } catch (err) {
    console.warn('[GeminiEngine] Gemini API call failed, using smart contextual fallback:', err);
  }

  return baseResult;
}

