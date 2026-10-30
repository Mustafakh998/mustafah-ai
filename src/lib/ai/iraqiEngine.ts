import { CLINIC_SERVICES, INITIAL_ACCOUNTS } from '@/lib/data/initialData';
import { AccountId, TreatmentType } from '@/types';

export interface AIResponseResult {
  replyText: string;
  intent: string;
  confidence: number;
  treatmentDetected?: TreatmentType;
  requiresHumanHandoff: boolean;
  handoffReason?: string;
  extractedPatientInfo?: {
    name?: string;
    phone?: string;
    preferredDate?: string;
    preferredTime?: string;
  };
}

// Baghdad Dialect Vocabulary & Patterns
const BAGHDAD_PATTERNS = {
  price: [/شكد|كم سعر|بيش|شقد|كلفة|تكلفة|بكم/i],
  location: [/وين|مكانكم|عنوانكم|وين صايرين|موقعكم|بيا منطقة|زيونة/i],
  booking: [/احجز|حجز|موعد|اريد اجي|اكدر اجي|تثبيت|كشفية|استشارة/i],
  orthodontics: [/تقويم|بريسز|عضة مفتوحة|مطمور|ديمون|شفاف|فك|بروز|سلك|مطاط/i],
  cosmetic: [/ايماكس|e-max|تجميل|ابتسامة|زيركون|فينير|عدسات|قشور/i],
  pediatric: [/اطفال|ابني|بنتي|طفل|تسوس طفل|دكتورة سجى|دكتورة شوخان/i],
  whitening: [/تبييض|تبيض|ليزر|اصفرار|تنظيف/i],
  general: [/حشوة|عصب|قلع|خلع|وجع|الم|تسكين/i],
  onlineDiagnosis: [/صورة لسني|شوف هاي الصورة|شخصني|شنو علاجي بالظبط|انطيني دوا|اكتبلي علاج|مضاد حيوي/i],
  humanAgent: [/انسان|بشر|روبوت|بوت|موظف|استقبال|حوّلني|حولي|شخص حقيقي|دكتور حقيقي|احجي ويا واحد/i],
};

export function classifyIntentAndExtractInfo(userMessage: string): {
  intent: string;
  confidence: number;
  treatment?: TreatmentType;
  requiresHandoff: boolean;
  handoffReason?: string;
  extractedInfo: {
    name?: string;
    phone?: string;
    preferredDate?: string;
    preferredTime?: string;
  };
} {
  const text = userMessage.trim();
  const extractedInfo: {
    name?: string;
    phone?: string;
    preferredDate?: string;
    preferredTime?: string;
  } = {};

  // Extract Iraqi Phone Numbers (077xxxxxxxx, 078xxxxxxxx, 075xxxxxxxx, 079xxxxxxxx, +9647xxxxxxxxx)
  const phoneMatch = text.match(/(?:\+?964|0)?7[7859]\d{8}/);
  if (phoneMatch) {
    extractedInfo.phone = phoneMatch[0];
  }

  // Extract requested times/days
  const dayMatch = text.match(/السبت|الأحد|الاحد|الاثنين|الإثنين|الثلاثاء|الاربعاء|الأربعاء|الخميس|باجر|عگب باجر/);
  if (dayMatch) {
    extractedInfo.preferredDate = dayMatch[0];
  }

  const timeMatch = text.match(/(?:\d{1,2}|وحدة|ثنتين|تلاثة|أربعة|خمسة|ستة|سبعة|ثمانية|تسعة)\s*(?:الصبح|الظهر|العصر|المغرب|بالليل|عصراً|مساءً)/);
  if (timeMatch) {
    extractedInfo.preferredTime = timeMatch[0];
  }

  // 1. Check for Human Agent Request
  if (BAGHDAD_PATTERNS.humanAgent.some((r) => r.test(text))) {
    return {
      intent: 'human_takeover_request',
      confidence: 0.99,
      requiresHandoff: true,
      handoffReason: 'المراجع طلب التحدث مباشرة مع موظف الاستقبال أو الطبيب',
      extractedInfo,
    };
  }

  // 2. Check for Online Diagnosis / Drug Prescription Guardrail
  if (BAGHDAD_PATTERNS.onlineDiagnosis.some((r) => r.test(text))) {
    return {
      intent: 'online_diagnosis_request',
      confidence: 0.95,
      requiresHandoff: true,
      handoffReason: 'طلب تشخيص سريري أو وصف أدوية عبر الإنترنت — يتطلب فحصاً مباشراً بالعيادة',
      extractedInfo,
    };
  }

  // 3. Treatment Identification
  let treatment: TreatmentType | undefined;
  if (BAGHDAD_PATTERNS.orthodontics.some((r) => r.test(text))) treatment = 'orthodontics';
  else if (BAGHDAD_PATTERNS.cosmetic.some((r) => r.test(text))) treatment = 'cosmetic_emax';
  else if (BAGHDAD_PATTERNS.pediatric.some((r) => r.test(text))) treatment = 'pediatric';
  else if (BAGHDAD_PATTERNS.whitening.some((r) => r.test(text))) treatment = 'teeth_whitening';
  else if (BAGHDAD_PATTERNS.general.some((r) => r.test(text))) treatment = 'general_restorative';

  // 4. Intent Classification
  if (BAGHDAD_PATTERNS.booking.some((r) => r.test(text)) || extractedInfo.phone || extractedInfo.preferredDate) {
    return {
      intent: 'appointment_request',
      confidence: 0.97,
      treatment,
      requiresHandoff: true, // Leads to reception confirmation
      handoffReason: 'طلب حجز موعد يتطلب تأكيد التوفر من الاستقبال',
      extractedInfo,
    };
  }

  if (BAGHDAD_PATTERNS.location.some((r) => r.test(text))) {
    return {
      intent: 'location_and_directions',
      confidence: 0.96,
      treatment,
      requiresHandoff: false,
      extractedInfo,
    };
  }

  if (BAGHDAD_PATTERNS.price.some((r) => r.test(text))) {
    return {
      intent: 'price_inquiry',
      confidence: 0.94,
      treatment,
      requiresHandoff: false,
      extractedInfo,
    };
  }

  if (treatment) {
    return {
      intent: 'treatment_information',
      confidence: 0.91,
      treatment,
      requiresHandoff: false,
      extractedInfo,
    };
  }

  return {
    intent: 'general_greeting',
    confidence: 0.85,
    requiresHandoff: false,
    extractedInfo,
  };
}

export function generateIraqiDialectResponse(
  userMessage: string,
  accountId: AccountId = 'drmustafa_hadi',
  patientName?: string
): AIResponseResult {
  const classification = classifyIntentAndExtractInfo(userMessage);
  const nameGreeting = patientName ? `أهلاً وسهلاً بيچ ${patientName} 💚` : 'أهلاً وسهلاً بيك نورتنا 💚';

  const isPersonal = accountId === 'drmustafa_hadi';
  const orthoDoctorRef = isPersonal ? 'دكتور مصطفى هادي' : 'دكتور مصطفى هادي (أخصائي التقويم بعيادتنا)';

  let replyText = '';

  switch (classification.intent) {
    case 'human_takeover_request':
      replyText = `${nameGreeting} تدلل عيوني! راح أحول المحادثة هسة فوراً لزميلتي بمكتب الاستقبال حتى تتواصل وياك مباشرة، أو تكدر تتصل بينا على رقم العيادة المباشر 07768886667 📞. ثواني وتكون وياك!`;
      break;

    case 'online_diagnosis_request':
      replyText = `${nameGreeting} سلامتك ألف سلامة يا رب! من باب الأمانة الطبية وحرصاً على صحتك، ما نكدر نشخص الحالة أو نكتب أدوية ومسكنات عن طريق الإنستغرام بدون فحص سريري وأشعة بانورامية بالعيادة حتى نتأكد من وضع السن والعصب صح 🦷.\n\nالكشفية والاستشارة يم ${orthoDoctorRef} وباقي الأطباء تشمل فحص دقيق وخطة علاجية واضحة.\nتحب نثبتلك موعد كشفية مناسب بالعيادة بزيونة؟ 📍`;
      break;

    case 'appointment_request':
      if (classification.extractedInfo.preferredDate || classification.extractedInfo.phone) {
        const details = [
          classification.extractedInfo.preferredDate ? `يوم ${classification.extractedInfo.preferredDate}` : '',
          classification.extractedInfo.preferredTime ? `الساعة ${classification.extractedInfo.preferredTime}` : '',
          classification.extractedInfo.phone ? `رقمك: ${classification.extractedInfo.phone}` : '',
        ]
          .filter(Boolean)
          .join(' — ');

        replyText = `عاشت إيدك ${patientName || 'عيوني'} تم تسجيل طلب الموعد (${details}) بنجاح! 💚\n\nموظفة الاستقبال بعيادة المسواك راح تتأكد من جدول الحجوزات وتتصل بيك هاتفياً أو تراسلك واتساب للتأكيد النهائي وتزويدك بتفاصيل الوصول.\n📍 عنواننا: بغداد – زيونة – خدمي دريم سيتي مول (مجاور مطعم صيف وشتاء، الطابق السادس شقة 6).\n\nننتظرك تنورنا! ✨`;
      } else {
        replyText = `${nameGreeting} تدلل من عيوني! نتشرف بزيارتك بالعيادة. حتى نثبتلك أنسب موعد:\n1️⃣ شنو اليوم والوقت اللي يناسبك (السبت للخميس: 2 ظهراً إلى 9 مساءً)؟\n2️⃣ ويا رقم تلفون لحضرتك حتى نثبت الحجز ونتواصل وياك للتأكيد؟ 📱`;
      }
      break;

    case 'location_and_directions':
      replyText = `${nameGreeting} مكاننا سهل كلش ووسط بغداد 📍:\n\n🏬 **عيادة المسواك التخصصية**\nبغداد – زيونة – شارع دريم سيتي الخدمي\n(مجاور مطعم صيف وشتاء، البناية اللي فوق مقهى الخيال – الطابق السادس، شقة 6).\n\n⏰ أوقات الدوام: من السبت إلى الخميس، من الساعة 2:00 ظهراً وحتى 9:00 مساءً.\n📞 رقم الحجز والاستعلام المباشر: 07768886667\n\nتحب نثبتلك موعد كشفية تشرفنا بيه؟ 💚`;
      break;

    case 'price_inquiry':
      if (classification.treatment === 'orthodontics' || isPersonal) {
        replyText = `${nameGreeting} كلفة التقويم يم ${orthoDoctorRef} تبدأ من 1,200,000 دينار عراقي وتعتمد على نوع التقويم (المعدني الدقيق، نظام الدامون الذاتي Damon، أو التقويم الشفاف Clear Aligners) وحاجة الفك لتعديل الإطباق.\n\n✨ الأهم عدنا نوفر **نظام أقساط مريح جداً**: دفعة أولى بسيطة والباقي أقساط مريحة ويا جلسات المتابعة الشهرية.\n\nالكشفية الأولية وفحص الفكين تشمل خطة علاج متكاملة. تحب تشرفنا لأخذ أشعة وقياسات؟ 🦷`;
      } else if (classification.treatment === 'cosmetic_emax') {
        replyText = `${nameGreeting} في عيادة المسواك نعتمد على خزف الإيماكس الألماني الأصلي E-max بجلستين فقط مع بطاقة ضمان رسمي مدى الحياة ضد تغير اللون أو الكسر ✨.\nالكلفة تبدأ من 250,000 إلى 350,000 دينار للسن الواحد مع برد سطحي جداً للحفاظ على السن الطبيعي.\n\nتحبين موعد كشفية ويا دكتور أحمد هاشم لاختيار درجة البياض المناسبة لملامح وجهك؟ 🤍`;
      } else if (classification.treatment === 'pediatric') {
        replyText = `فدوة لقلبه 🩵 بقسم أسنان الأطفال مع د. سجى الحسيني ود. شوخان طوزلو، كشفية وفحص الطفل بـ 25,000 دينار فقط، وجلسات علاج التسوس بدون حفر وإبرة بمادة SDF تبدأ من 35,000 دينار.\nالأجواء مرحة ومليانة ألعاب حتى الطفل يطلع فرحان بدون أي خوف! 🧸`;
      } else {
        replyText = `${nameGreeting} تدلل! أسعارنا في عيادة المسواك مدروسة وشفافة:\n• كشفية وفحص كامل: 15,000 دينار (ومجانية عند البدء بالعلاج)\n• تنظيف وتلميع وإزالة تكلسات بالألتراسونيك: 35,000 دينار\n• حشوات تجميلية ليزرية أصلية: تبدأ من 35,000 دينار\n• تبييض ليزري بجلسة واحدة: 150,000 - 200,000 دينار\n\nعن أي إجراء حاب تستفسر بالتحديد يا غالي؟ 💚`;
      }
      break;

    case 'treatment_information':
      if (classification.treatment === 'orthodontics' || isPersonal) {
        replyText = `${nameGreeting} علاج تقويم الأسنان ويا ${orthoDoctorRef} يتم بأعلى المعايير العالمية الرقمية.\nنعالج العضة المفتوحة، تزاحم الأسنان، والأسنان المطمورة (المدفونة) بطرق ميكانيكية دقيقة تحافظ على صحة الجذور واللثة وبأقل مدة ممكنة.\nالهدف مو بس صف الأسنان، وإنما تحقيق إطباق وظيفي مريح وابتسامة متناسقة ويا ملامح الوجه 📐✨.\n\nتحب نحجزلك موعد كشفية نوضحلك بيه خطة علاج حالتك بالتفصيل؟`;
      } else if (classification.treatment === 'pediatric') {
        replyText = `أهلاً بيكم 🩵 قسم طب أسنان الأطفال بعيادة المسواك بإشراف د. سجى الحسيني ود. شوخان طوزلو مصمم خصيصاً ليكسر خوف الطفل من طبيب الأسنان. نستخدم تقنيات حديثة بدون ألم مثل مادة الفلورايد الفضي SDF والحشوات التجميلية اللطيفة.\n\nتحبون تحجزون جلسة فحص وتعارف لطفلكم؟ 🧸`;
      } else {
        replyText = `${nameGreeting} بالمسواك نوفر أحدث التقنيات الرقمية لتجميل وعلاج الأسنان مع فريق من أمهر أطباء بغداد في زيونة 💚.\nعن أي حالة تحب تستفسر أكثر، ونكدر نرتبلك موعد فحص واستشارة بالعيادة بأي وقت يناسبك!`;
      }
      break;

    default:
      replyText = isPersonal
        ? `${nameGreeting} عيادة دكتور مصطفى هادي لتقويم الأسنان ترحب بيك! شلون أكدر أساعدك اليوم بخصوص أسنانك أو استفسارك عن التقويم؟ 🦷`
        : `${nameGreeting} عيادة المسواك لطب وتجميل الأسنان ترحب بيك في بغداد زيونة! شلون نكدر نساعدك اليوم بابتسامتك؟ 💚`;
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
