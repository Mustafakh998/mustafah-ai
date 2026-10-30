import { CLINIC_SERVICES, INITIAL_ACCOUNTS } from '@/lib/data/initialData';
import { AccountId, PilotIntentType, TreatmentType } from '@/types';

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
  urgent: [/طوارئ|وجع لا يطاق|ورم|انتفاخ|حادث|انكسر سني هسة|نزيف|دم|يموتني الوجع|ديموتني|مسكن قوي|مضاد حيوي/i],
  personalBrand: [/منو دكتور مصطفى|شهادتك|وين متخرج|سيرتك|خبرتك|ليش يشرحلك قبل لا يعالجك|شكد عمرك/i],
  location: [/مكانكم|وين العيادة|وين صايرين|عنوانكم|زيونة|دريم سيتي|اللوكيشن|موقعكم/i],
  orthodontics: [/تقويم|بريسز|عضة مفتوحة|مطمور|ديمون|شفاف|فك|بروز|سلك|مطاط|closing loop|piggyback|open bite/i],
  consultation: [/احجز|حجز|استشارة|كشفية|اريد اجي|اكدر اجي|فحص|موعد|اريد اشوف الدكتور/i],
  generalEducation: [/تفريش|خيط اسنان|معجون|تسوس|اصفرار|تبييض|رائحة الفم|اسنان اللبنية|تنظيف الجير/i],
  humanAgent: [/اريد احجي وياك شخصياً|دكتور مصطفى نفسه|مو روبوت|روبوت|بوت|بشر|انسان|حوّلني|حولي|شخص حقيقي|دكتور حقيقي|احجي ويا واحد|اتصل بيه/i],
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
    return {
      intent: 'orthodontic_inquiry',
      confidence: 0.94,
      treatment: 'orthodontics',
      requiresHandoff: false,
      extractedInfo: { ...extractedInfo, inquiryType: 'orthodontics_explanation' },
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
  patientName?: string
): AIResponseResult {
  const classification = classifyPilotIntent(userMessage);
  const nameGreeting = patientName ? `أهلاً وسهلاً بيچ ${patientName} 💚` : 'أهلاً وسهلاً بيك نورت صفحة دكتور مصطفى هادي 💚';

  // Assistant introduction representing Dr. Mustafa
  const assistantIntro = 'أني المساعد الذكي الخاص بدكتور مصطفى هادي';
  const brandSlogan = 'شعارنا دائماً: "طبيب أسنان يشرحلك قبل لا يعالجك" 📐✨';

  let replyText = '';

  switch (classification.intent) {
    case 'urgent_clinical_question':
      replyText = `${nameGreeting}\nسلامتك ألف سلامة وما تشوف شر يا رب! ⚠️\n\nحسب الأمانة الطبية والمسؤولية المهنية، إذا چان عندك ألم حاد أو ورم مفاجئ أو كسر، مهم جداً ما تكتفي باستشارة الإنستغرام أو أخذ مضاد حيوي ومسكنات قوية بدون فحص سريري وتشخيص مباشر بالعيادة.\n\n📞 يرجى الاتصال المباشر بهاتف الطوارئ والاستقبال بالعيادة بزيونة فوراً: 07768886667\nأو التوجه لأقرب مركز طوارئ أسنان إذا چان الوقت خارج ساعات الدوام الرسمية.\n\nتم تحويل رسالتك هسة لفريق العيادة للتواصل وياك في أقرب فرصة.`;
      break;

    case 'location_and_directions':
      replyText = `${nameGreeting}\nمقر العيادة في قلب بغداد:\n📍 **العنوان:** بغداد – زيونة – شارع دريم سيتي مول الخدمي، مجمع عيادات المسواك (فوق كافيه الخيال، الطابق السادس شقة 6).\n\n⏰ **أوقات الدوام:** السبت إلى الخميس: 2:00 ظهراً – 9:00 مساءً.\n📞 **هاتف الحجز المباشر والاستفسار:** 07768886667\n\nتحب نسجل طلب موعد لحضرتك؟ نتشرف بزيارتك! 🦷✨`;
      break;

    case 'human_attention_required':
      replyText = `${nameGreeting}\nتدلل عيوني! ${assistantIntro}. راح أحول رسالتك هسة مباشرة لدكتور مصطفى وفريق الاستقبال حتى يتواصلون وياك شخصياً.\n\nإذا چان الموضوع مستعجل بخصوص موعد فحص أو استفسار مباشر، تگدر تتصل بينا هاتفياً أو تراسلنا واتساب على: 07768886667 📱\nثواني ويكون الفريق وياك!`;
      break;

    case 'collaboration_request':
      replyText = `${nameGreeting}\nشكراً جزيلاً لاهتمامك وتواصلك ويا د. مصطفى هادي 🤝✨\nدكتور مصطفى يرحب دائماً بالتعاون العلمي، المحاضرات الطبية، والمشاريع اللي تدمج بين طب الأسنان والتقنية والبرمجة.\n\nتم تسجيل تفاصيل رسالتك ونقلها لدكتور مصطفى شخصياً للاطلاع عليها والرد.\nإذا عندك ملف أو مقترح رسمي، تكدر تزودنا بريدك الإلكتروني أو رقم الواتساب لسهولة التنسيق. نورتنا!`;
      break;

    case 'consultation_request':
      if (classification.extractedInfo.preferredDate || classification.extractedInfo.phone) {
        const details = [
          classification.extractedInfo.preferredDate ? `يوم ${classification.extractedInfo.preferredDate}` : '',
          classification.extractedInfo.preferredTime ? `الساعة ${classification.extractedInfo.preferredTime}` : '',
          classification.extractedInfo.phone ? `رقمك: ${classification.extractedInfo.phone}` : '',
        ]
          .filter(Boolean)
          .join(' — ');

        replyText = `عاشت إيدك ${patientName || 'يا غالي'}! تم تسجيل طلب الموعد (${details}) بنجاح في سجلات الاستفسارات 💚\n\n📌 **ملاحظة مهمة من دكتور مصطفى:**\nهذا تسجيل لطلبك، وموظفة الاستقبال بالعيادة راح تتصل بيك هاتفياً للتأكد من توفر الكرسي والوقت المناسب وتأكيد الحجز رسمياً (ما نكدر نأكد الحجز النهائي آلياً قبل مراجعة الجدول).\n\n📍 مكان الكشفية: بغداد – زيونة – خدمي دريم سيتي مول (عيادة المسواك، الطابق السادس شقة 6).\n\nبانتظار تشرفنا بالعيادة! ✨`;
      } else {
        replyText = `${nameGreeting}\nتدلل من عيوني! الكشفية والاستشارة يم د. مصطفى تشمل فحص سريري دقيق ودراسة إطباق الفكين وأخذ الأشعة اللازمة 📐.\n\nحتى نرفع طلب الموعد لمكتب الاستقبال ويتصلون بيك للتأكيد:\n1️⃣ شنو اليوم والوقت التقريبي اللي يناسبك؟\n2️⃣ ويا رقم تلفون لحضرتك للتواصل وتأكيد الحجز؟ 📱\n\n(أوقات دوام العيادة: السبت إلى الخميس: 2:00 ظهراً – 9:00 مساءً).`;
      }
      break;

    case 'orthodontic_inquiry':
      replyText = `${nameGreeting}\n${brandSlogan}\n\nتقويم الأسنان ويا دكتور مصطفى مو مجرد صف أسنان، وإنما هندسة متكاملة للإطباق والابتسامة وتناسق ملامح الوجه 📐.\nنعالج حالات العضة المفتوحة، تزاحم الأسنان، والأسنان المطمورة باستخدام أنظمة متطورة مثل نظام الدامون الذاتي (Damon System) والتقويم الشفاف.\n\n💡 **بالنسبة للأسعار والأقساط:**\nخطة العلاج وتكلفتها تختلف حسب تعقيد الحالة ونوع التقويم (تبدأ تقريبياً من 1,200,000 دينار عراقي مع نظام أقساط شهرية مريحة جداً مع كل جلسة مراجعة). السعر النهائي الدقيق يتحدد فقط بعد الكشفية السريرية وأشعة الـ OPG.\n\nتحب نسجلك طلب كشفية يم دكتور مصطفى حتى يفحص حالتك ويشرحلك الخطة بالتفصيل؟ 🦷`;
      break;

    case 'personal_professional_inquiry':
      replyText = `${nameGreeting}\nدكتور مصطفى هادي هو طبيب أسنان وأخصائي تقويم الأسنان والفكين في بغداد 🦷.\nمهتم جداً بتطبيق التكنولوجيا، الميكانيكا الحيوية الدقيقة، والبرمجة في تخطيط ابتسامات المرضى.\n\nشعار دكتور مصطفى بالعمل:\n"طبيب أسنان يشرحلك قبل لا يعالجك" — لأننا نؤمن إن المريض شريك أساسي في فهم خطته العلاجية قبل البدء بأي خطوة.\n\nدكتور مصطفى يستقبل مراجعيه في عيادة المسواك التخصصية (بغداد – زيونة، خدمي دريم سيتي مول).\nشلون نكدر نساعدك اليوم باستفسارك؟ 💚`;
      break;

    case 'general_dental_education':
    default:
      replyText = `${nameGreeting}\n${brandSlogan}\n\nسؤالك ممتاز! الحفاظ على صحة الأسنان يبدأ من العادات اليومية الصحيحة: تفريش الأسنان مرتين يومياً بمعجون يحتوي على الفلورايد، واستخدام خيط الأسنان الطبي لتنظيف الفراغات اللي الفرشاة ما توصلها.\nإذا چان استفسارك عن حالة معينة بأسنانك أو حاب تعرف معلومات أكثر عن التقويم، اكتبلي تفاصيل أكثر وتدلل! 🦷✨`;
      break;
  }

  return {
    replyText,
    intent: classification.intent,
    confidence: classification.confidence,
    treatmentDetected: classification.treatment,
    requiresHumanHandoff: classification.requiresHandoff,
    handoffReason: classification.handoffReason,
    extractedPatientInfo: classification.extractedInfo,
  };
}
