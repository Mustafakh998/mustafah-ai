
import { AccountId, PilotIntentType, TreatmentType } from '@/types';
import { generateSmartContextualResponse, ChatHistoryMessage } from './smartFallback';
import { generateGeminiDialectResponse } from './geminiEngine';

export interface AIResponseResult {
  replyText: string;
  intent: PilotIntentType | string;
  confidence: number;
  treatmentDetected?: TreatmentType;
  requiresHumanHandoff: boolean;
  handoffReason?: string;
  extractedPatientInfo?: {
    name?: string;
    phone?: string;
    preferredDate?: string;
    preferredTime?: string;
    inquiryType?: string;
  };
}

// Patterns specifically calibrated for Dr. Mustafa Hadi's Pilot
const PILOT_PATTERNS = {
  collaboration: [/تعاون|إعلان|اعلان|تسويق|سبونسر|شراكة|مؤتمر|محاضرة|برمجة|تطبيق|سوفتوير|collab|partnership|sponsor/i],
  urgent: [/طوارئ|وجع لا يطاق|ورم|انتفاخ|حادث|انكسر سني هسة|نزيف|ينزف|ينزل دم|خروج دم|طلع دم|يموتني الوجع|ديموتني|مسكن قوي|مضاد حيوي|ألم قوي|الم قوي|ألم شديد|الم شديد|يوجعني حيل|يموت من الوجع|الضرس|ضرس|ضرسي|عصب سن/i],
  personalBrand: [/منو دكتور مصطفى|شهادتك|وين متخرج|سيرتك|خبرتك|ليش يشرحلك قبل لا يعالجك|شكد عمرك/i],
  location: [/مكانكم|وين العيادة|وين صايرين|عنوانكم|زيونة|دريم سيتي|اللوكيشن|موقعكم/i],
  orthodontics: [
    /تقويم|بريسز|عضة مفتوحة|مطمور|ديمون|شفاف|فك|بروز|سلك|مطاط|closing loop|piggyback|open bite|متراكبة|تراكب|اعوجاج|معوجة|اسناني مخربطة|مخربطة|فتحة بين الاسنان|orthodontic|orthodontics|braces|aligner|aligners|invisalign|الدفعة الأولى|الدفعة الاولى|دفعة أولى|دفعة اولى|دفعة مقدمة|الدفعة المقدمة|أقساط|اقساط|تقسيط|monthly installments|down payment/i,
  ],
  consultation: [/احجز|حجز|استشارة|كشفية|اريد اجي|اكدر اجي|فحص|موعد|اريد اشوف الدكتور/i],
  generalEducation: [/تفريش|خيط اسنان|معجون|تسوس|اصفرار|تبييض|رائحة الفم|اسنان اللبنية|تنظيف الجير/i],
  humanAgent: [/اريد احجي وياك شخصياً|دكتور مصطفى نفسه|مو روبوت|روبوت|بوت|بشر|انسان|حوّلني|حولي|شخص حقيقي|دكتور حقيقي|احجي ويا واحد|اتصل بيه|احجي ويا الدكتور|أحجي ويا الدكتور|احجي ويا دكتور|أحجي ويا دكتور|اكلم الدكتور|أكلم الدكتور|احجي ويه الدكتور|أحجي ويه الدكتور/i],
};

export function classifyPilotIntent(userMessage: string): {
  intent: PilotIntentType;
  confidence: number;
  treatment?: TreatmentType;
  requiresHandoff: boolean;
  handoffReason?: string;
  extractedInfo: {
    name?: string;
    phone?: string;
    preferredDate?: string;
    preferredTime?: string;
    inquiryType?: string;
  };
} {
  const text = userMessage.trim();
  const extractedInfo: {
    name?: string;
    phone?: string;
    preferredDate?: string;
    preferredTime?: string;
    inquiryType?: string;
  } = {};

  // Extract Iraqi Phone Numbers
  const phoneMatch = text.match(/(?:\+?964|0)?7[7859]\d{8}/);
  if (phoneMatch) {
    extractedInfo.phone = phoneMatch[0];
  }

  // Extract Days & Times
  const dayMatch = text.match(/السبت|الأحد|الاحد|الاثنين|الإثنين|الثلاثاء|الاربعاء|الأربعاء|الخميس|باجر|عگب باجر/);
  if (dayMatch) {
    extractedInfo.preferredDate = dayMatch[0];
  }

  const timeMatch = text.match(/(?:\d{1,2}|وحدة|ثنتين|تلاثة|أربعة|خمسة|ستة|سبعة|ثمانية|تسعة)\s*(?:الصبح|الظهر|العصر|المغرب|بالليل|عصراً|مساءً)/);
  if (timeMatch) {
    extractedInfo.preferredTime = timeMatch[0];
  }

  // 1. Check for Urgent Clinical Situation (Emergency)
  if (PILOT_PATTERNS.urgent.some((r) => r.test(text))) {
    return {
      intent: 'urgent_clinical_question',
      confidence: 0.98,
      requiresHandoff: true,
      handoffReason: 'حالة طارئة أو ألم حاد — تستدعي تدخلاً سريعاً ومراجعة الطوارئ أو التواصل الفوري',
      extractedInfo: { ...extractedInfo, inquiryType: 'urgent_pain' },
    };
  }

  // 2. Check for Human Attention Required
  if (PILOT_PATTERNS.humanAgent.some((r) => r.test(text))) {
    return {
      intent: 'human_attention_required',
      confidence: 0.96,
      requiresHandoff: true,
      handoffReason: 'المراجع طلب التحدث مباشرة مع دكتور مصطفى أو فريق الاستقبال',
      extractedInfo: { ...extractedInfo, inquiryType: 'direct_human' },
    };
  }

  // 3. Collaboration / Professional Partnership Request
  if (PILOT_PATTERNS.collaboration.some((r) => r.test(text))) {
    return {
      intent: 'collaboration_request',
      confidence: 0.95,
      requiresHandoff: true,
      handoffReason: 'طلب تعاون مهني، شراكة، أو محاضرة تقنية موجهة لدكتور مصطفى',
      extractedInfo: { ...extractedInfo, inquiryType: 'professional_partnership' },
    };
  }

  // 4. Consultation Booking Request
  if (PILOT_PATTERNS.consultation.some((r) => r.test(text)) || extractedInfo.phone || extractedInfo.preferredDate) {
    let treatment: TreatmentType = 'consultation';
    if (PILOT_PATTERNS.orthodontics.some((r) => r.test(text))) treatment = 'orthodontics';

    return {
      intent: 'consultation_request',
      confidence: 0.97,
      treatment,
      requiresHandoff: true, // Requires reception confirmation
      handoffReason: 'طلب موعد كشفية واستشارة يتطلب التنسيق مع جدول العيادة لتأكيد التوفر',
      extractedInfo: { ...extractedInfo, inquiryType: 'appointment_booking' },
    };
  }

  // 5. Orthodontic Clinical Inquiry
  if (PILOT_PATTERNS.orthodontics.some((r) => r.test(text))) {
    const isOrthoPriceOrInstallment =
      /سعر|أسعار|اسعار|تكلفة|تكلف|يكلف|بيش|شكد|كم|فلوس|قسط|أقساط|اقساط|تقسيط|دفعة|مقدمة|تمويل|دفعات|طريقة الدفع|price|prices|cost|costs|installment|installments|down payment|financing/i.test(
        text
      );
    return {
      intent: 'orthodontic_inquiry',
      confidence: 0.94,
      treatment: 'orthodontics',
      requiresHandoff: isOrthoPriceOrInstallment,
      handoffReason: isOrthoPriceOrInstallment
        ? 'استفسار عن أسعار أو أقساط التقويم — سياسة النظام تمنع كشف الأسعار آلياً وتحوّل الحالة للتقييم والتواصل المباشر'
        : undefined,
      extractedInfo: { ...extractedInfo, inquiryType: isOrthoPriceOrInstallment ? 'orthodontic_price_inquiry' : 'orthodontics_explanation' },
    };
  }

  // 6. Personal Professional Profile Inquiry
  if (PILOT_PATTERNS.personalBrand.some((r) => r.test(text))) {
    return {
      intent: 'personal_professional_inquiry',
      confidence: 0.92,
      requiresHandoff: false,
      extractedInfo: { ...extractedInfo, inquiryType: 'doctor_profile' },
    };
  }

  // 7. Location and Directions
  if (PILOT_PATTERNS.location.some((r) => r.test(text))) {
    return {
      intent: 'location_and_directions',
      confidence: 0.96,
      requiresHandoff: false,
      extractedInfo: { ...extractedInfo, inquiryType: 'location' },
    };
  }

  // 8. General Dental Education
  return {
    intent: 'general_dental_education',
    confidence: 0.88,
    requiresHandoff: false,
    extractedInfo: { ...extractedInfo, inquiryType: 'dental_education' },
  };
}

export function generateIraqiDialectResponse(
  userMessage: string,
  accountId: AccountId = 'drmustafa_hadi',
  patientName?: string,
  history: ChatHistoryMessage[] = []
): AIResponseResult {
  return generateSmartContextualResponse(userMessage, accountId, patientName, history);
}

/**
 * Async version that leverages Google Gemini LLM if GEMINI_API_KEY is available,
 * or gracefully falls back to the intelligent contextual Baghdad dialect engine.
 */
export async function generateIraqiDialectResponseAsync(
  userMessage: string,
  accountId: AccountId = 'drmustafa_hadi',
  patientName?: string,
  history: ChatHistoryMessage[] = []
): Promise<AIResponseResult> {
  return generateGeminiDialectResponse(userMessage, accountId, patientName, history);
}
