import { AccountId } from '@/types';
import { AIResponseResult } from './iraqiEngine';

export interface ChatHistoryMessage {
  sender: 'user' | 'assistant' | 'staff';
  text: string;
}

/**
 * Detect gender based on Arabic / Iraqi first names or username
 */
export function detectGender(nameOrUsername?: string): 'male' | 'female' | 'unknown' {
  if (!nameOrUsername) return 'unknown';
  const clean = nameOrUsername.toLowerCase().replace(/[@_.]/g, ' ');

  const maleNames = [
    'ali', 'ahmed', 'ahmad', 'mohammed', 'muhammed', 'mustafa', 'moustafa',
    'hussein', 'hussain', 'haider', 'hayder', 'omar', 'othman', 'karrar',
    'saif', 'abbas', 'youssef', 'yousef', 'hassan', 'hasan', 'sajjad',
    'ibrahim', 'zaid', 'ammar', 'mahmoud', 'mahmood', 'alaa', 'bilal',
    'علي', 'أحمد', 'احمد', 'محمد', 'مصطفى', 'حسين', 'حيدر', 'عمر', 'عثمان',
    'كرار', 'سيف', 'عباس', 'يوسف', 'حسن', 'سجاد', 'إبراهيم', 'ابراهيم', 'زيد', 'عمار'
  ];

  const femaleNames = [
    'noor', 'nour', 'zahraa', 'zahra', 'fatima', 'fatimah', 'maryam', 'mariam',
    'huda', 'houda', 'sara', 'sarah', 'aya', 'ayah', 'reem', 'rim',
    'dina', 'deenah', 'shahad', 'baneen', 'tabarak', 'zainab', 'zeinab',
    'نور', 'زهراء', 'فاطمة', 'فاطمه', 'مريم', 'هدى', 'سارة', 'ساره', 'آية', 'اية',
    'ريم', 'دينا', 'شهد', 'بنين', 'تبارك', 'زينب'
  ];

  for (const m of maleNames) {
    if (clean.includes(m)) return 'male';
  }
  for (const f of femaleNames) {
    if (clean.includes(f)) return 'female';
  }

  return 'unknown';
}

/**
 * Intelligent, context-aware rule & semantic reasoning engine.
 * Generates dynamic, natural, non-repetitive responses in Baghdad Iraqi dialect.
 */
export function generateSmartContextualResponse(
  userMessage: string,
  accountId: AccountId = 'drmustafa_hadi',
  patientName?: string,
  history: ChatHistoryMessage[] = []
): AIResponseResult {
  const text = userMessage.trim();
  const gender = detectGender(patientName);

  // Pronouns based on gender
  const greetingParticle = gender === 'female' ? 'بيچ' : gender === 'male' ? 'بيك' : 'بيك/بيچ';
  const dearParticle = gender === 'female' ? 'عزيزتي' : gender === 'male' ? 'يا غالي' : 'يا غالي';
  const brotherSister = gender === 'female' ? 'أختي' : gender === 'male' ? 'أخوي' : 'عيني';

  // Check if we already greeted this user in history
  const hasPriorGreeting = history.some(
    (m) => m.sender === 'assistant' && (m.text.includes('أهلاً وسهلاً') || m.text.includes('نورت'))
  );

  const cleanPatientDisplay = patientName
    ? patientName.replace(/^@/, '').replace(/_/g, ' ')
    : '';

  const greetingPrefix = hasPriorGreeting
    ? 'تدلل عيوني 💚'
    : cleanPatientDisplay
    ? `أهلاً وسهلاً ${greetingParticle} ${brotherSister} ${cleanPatientDisplay} نورتنا 💚`
    : `أهلاً وسهلاً ${greetingParticle} نورت صفحة د. مصطفى هادي 💚`;

  // 1. Gratitude & Polite Closures
  const isGratitude = /^(شكراً|شكرا|تسلم|تسلمين|ممنون|ممنونة|عاشت ايدك|مشكور|مشكورة|الله يحفظك|حبيبي|يسلمو|فدوة|تدلل)$/i.test(text) ||
    /شكراً جزيلاً|تسلم يا غالي|ممنون دكتور|عاشت ايدكم/i.test(text);
  if (isGratitude) {
    return {
      replyText: `تدلل ${brotherSister}! بالخدمة دائماً وأي استفسار ثاني تحتاجوه دكتور مصطفى وفريق العيادة حاضرين 💚 نتشرف بيكم بأي وقت! 🦷`,
      intent: 'general_dental_education',
      confidence: 0.98,
      treatmentDetected: 'consultation',
      requiresHumanHandoff: false,
    };
  }

  // 2. Photos Already Sent / Follow-up on Pictures
  const isPhotosAlreadySent = /دزيت|دزيتهن|وصلت الصور|وصلن الصور|شوفهن|شوكت يرجعلي|شوكت الرد|شوكت يجاوب|شفت الصور|شفتوهن/i.test(text);
  if (isPhotosAlreadySent) {
    const reply = `عاشت إيدك ${dearParticle}! استلمنا الصور بنجاح وهسة راح يعرضها الفريق على دكتور مصطفى أول ما يفرغ من الكشفية السريرية بالعيادة 📸✨\n\n` +
      `راح نراجعها ونرد عليك برأي الدكتور المبدئي بأقرب فرصة ممكنة اليوم.\n\n` +
      `إذا تحب تزودنا برقم تلفونك حتى نتصل بيك مباشرة أول ما يجهز التقييم تگدر تكتبه وتدلل! 📲`;

    return {
      replyText: reply,
      intent: 'consultation_request',
      confidence: 0.97,
      treatmentDetected: 'orthodontics',
      requiresHumanHandoff: true,
      handoffReason: 'المراجع أرسل صور الأسنان وبانتظار تقييم دكتور مصطفى',
      extractedPatientInfo: { inquiryType: 'photos_submitted' },
    };
  }

  // 3. Photo Assessment / Remote Evaluation Inquiry (e.g. "اريد على صورة وجهي لان بيتي بعيد")
  const isPhotoInquiry = /صورة|صور|صوره|صورتي|وجهي|ادز صور|ادزلك|اونلاين|عن بعد|بعيد|بيتي بعيد|المسافة|محافظة|محافظات|كشفية بالصور|فحص بالصور/i.test(text);
  if (isPhotoInquiry) {
    const isFarDistance = /بعيد|بيتي بعيد|مسافة|محافظة|محافظات|طريق|سفر/i.test(text);

    let reply = `${greetingPrefix}\nشعارنا دائماً: "د. مصطفى هادي — طبيب أسنان يشرحلك قبل لا يعالجك" 📐✨\n\n`;

    if (isFarDistance) {
      reply += `نقدر تماماً إن بيتك بعيد وحاب تاخذ رأي وفكرة أولية قبل لا تتعنى وتجي للعيادة! 🚗💨\n\n`;
    }

    reply += `أكيد تگدر تدزلنا هنا صور واضحة لأسنانك ولابتسامتك:\n` +
      `📸 **١. صورة واضحة من الأمام** والأسنان مطبوقة كأنك تبتسم.\n` +
      `📸 **٢. صورة جانبية من اليمين واليسار** تبين علاقة الفك العلوي بالسفلي.\n` +
      `📸 **٣. صورة لوجهك كامل من الجانب (بروفايل)** إذا تحب ندرس تناسق الشفة والفك.\n\n` +
      `دكتور مصطفى راح يشوف الصور بنفسه وينطيك فكرة أولية وتوضيح عن نوع المشكلة وخيارات التقويم المقترحة 🦷.\n\n` +
      `📌 *ملاحظة مهمة:* الخطة العلاجية النهائية الدقيقة تتأكد دائماً بالعيادة مع فحص أشعة الـ OPG وقياسات الأطباق السريرية.\n\n` +
      `دز الصور هسة على راحتك، واحنا وياك خطوة بخطوة وتدلل! ✨`;

    return {
      replyText: reply,
      intent: 'consultation_request',
      confidence: 0.96,
      treatmentDetected: 'orthodontics',
      requiresHumanHandoff: false,
      extractedPatientInfo: { inquiryType: 'remote_photo_consultation' },
    };
  }

  // 2. Urgent Emergency or Severe Pain
  const isUrgent = /طوارئ|وجع لا يطاق|ورم|انتفاخ|حادث|انكسر سني|نزيف|ينزف|ينزل دم|ديموتني|ألم قوي|الم قوي|ألم شديد|الم شديد|يوجعني حيل|يموت من الوجع|طك السلك|انكسر البريسز/i.test(text);
  if (isUrgent) {
    const emergencyReply = `${greetingPrefix}\nسلامتك ألف سلامة وما تشوف شر يا رب! ⚠️\n\n` +
      `حسب الأمانة الطبية، الألم الحاد أو الورم المفاجئ ما يتأجل ولا ينفع وياه علاج أو مسكن عبر الإنستغرام بدون فحص سريري مباشر.\n\n` +
      `📞 **يرجى الاتصال المباشر بهاتف الطوارئ والاستقبال بالعيادة فوراً:** 07768886667\n` +
      `📍 العيادة مفتوحة يومياً من السبت إلى الخميس (2:00 ظهراً – 9:00 مساءً) في بغداد – زيونة (خدمي دريم سيتي مول).\n\n` +
      `إذا چان الوقت خارج الدوام والألم شديد، يرجى التوجه لأقرب مركز طوارئ أسنان فوراً. تم تحويل إشعارك للفريق.`;

    return {
      replyText: emergencyReply,
      intent: 'urgent_clinical_question',
      confidence: 0.99,
      treatmentDetected: 'consultation',
      requiresHumanHandoff: true,
      handoffReason: 'حالة ألم حاد أو طارئة تتطلب تدخلاً سريرياً عاجلاً',
      extractedPatientInfo: { inquiryType: 'urgent_pain' },
    };
  }

  // 3. Orthodontic Pricing & Installments (Flexible & Clear)
  const isPriceQuery = /سعر|أسعار|اسعار|تكلفة|تكلف|يكلف|بيش|شكد|كم|فلوس|قسط|أقساط|اقساط|تقسيط|دفعة|مقدمة|تمويل|دفعات|طريقة الدفع|price|cost|installment/i.test(text);
  if (isPriceQuery) {
    const reply = `${hasPriorGreeting ? 'تدلل عيوني' : greetingPrefix}\n` +
      `بالنسبة لتكلفة تقويم الأسنان يم د. مصطفى هادي:\n\n` +
      `تقويم الأسنان مو قالب ثابت؛ السعر يعتمد بشكل أساسي على:\n` +
      `🔹 درجة تزاحم الأسنان أو بروز الفك\n` +
      `🔹 نوع النظام الأنسب لحالتك (تقويم الدامون الذاتي Damon، أو التقويم الشفاف Clear Aligners، أو التقويم التقليدي)\n` +
      `🔹 مدة الخطة العلاجية المتوقعة\n\n` +
      `💳 **نظام الأقساط الميسرة:**\n` +
      `لتسهيل العلاج على مراجعينا، العيادة توفر نظام **أقساط شهرية مريحة** مع دفعة أولى بسيطة تناسب الجميع وبدون أي فوائد.\n\n` +
      `التكلفة الدقيقة وخيارات الدفع تتحدد بعد الكشفية السريرية وأشعة الـ OPG بالعيادة.\n\n` +
      `تحب نسجلك موعد كشفية واستشارة ونشرحلك كل الخيارات بالتفصيل؟ 🦷✨`;

    return {
      replyText: reply,
      intent: 'orthodontic_inquiry',
      confidence: 0.95,
      treatmentDetected: 'orthodontics',
      requiresHumanHandoff: false,
      extractedPatientInfo: { inquiryType: 'orthodontic_price_inquiry' },
    };
  }

  // 4. Working Hours & Clinic Location
  const isLocationOrHours = /مكانكم|وين العيادة|وين صايرين|عنوانكم|زيونة|اللوكيشن|موقعكم|أوقات|اوقات|وقت الدوام|شوكت تفتحون|ساعات الدوام|يوم الجمعة/i.test(text);
  if (isLocationOrHours) {
    const reply = `${hasPriorGreeting ? 'تدلل عيوني' : greetingPrefix}\n` +
      `📍 **عنوان العيادة:**\n` +
      `بغداد – زيونة – شارع دريم سيتي مول الخدمي، مجمع عيادات المسواك (فوق كافيه الخيال، الطابق السادس – شقة 6).\n\n` +
      `⏰ **أوقات الدوام:**\n` +
      `السبت إلى الخميس: من الساعة 2:00 ظهراً حتى 9:00 مساءً.\n` +
      `(يوم الجمعة عطلة العيادة).\n\n` +
      `📞 **هاتف الحجز المباشر والاستفسار:** 07768886667\n\n` +
      `ننتظرك تشرفنا بأي وقت يناسبك! 🦷`;

    return {
      replyText: reply,
      intent: 'location_and_directions',
      confidence: 0.97,
      treatmentDetected: 'consultation',
      requiresHumanHandoff: false,
      extractedPatientInfo: { inquiryType: 'location' },
    };
  }

  // 5. Patient Phone Number Provided
  const phoneMatch = text.match(/(?:\+?964|0)?7[7859]\d{8}/);
  if (phoneMatch) {
    const phone = phoneMatch[0];
    const reply = `عاشت إيدك ${dearParticle}! تم تسجيل رقمك (${phone}) بنجاح 📲💚\n\n` +
      `مكتب الاستقبال بالعيادة راح يتواصلون وياك لتأكيد الموعد المناسب لجدول دكتور مصطفى.\n\n` +
      `شنو اليوم أو الوقت اللي تفضله خلال الأسبوع؟ (الدوام: السبت - الخميس من 2 الظهر لـ 9 بالليل).`;

    return {
      replyText: reply,
      intent: 'consultation_request',
      confidence: 0.98,
      treatmentDetected: 'consultation',
      requiresHumanHandoff: true,
      handoffReason: 'المراجع زود رقم هاتفه لغرض تأكيد الحجز',
      extractedPatientInfo: { phone, inquiryType: 'phone_provided' },
    };
  }

  // 6. Direct Request to Speak with Human / Doctor
  const isHumanRequest = /احجي وياك|دكتور مصطفى نفسه|مو روبوت|روبوت|بوت|بشر|انسان|شخص حقيقي|دكتور حقيقي|اتصل بيه|اكلم الدكتور/i.test(text);
  if (isHumanRequest) {
    const reply = `تدلل ${brotherSister}! أني المساعد الذكي لدكتور مصطفى وراح أحول رسالتك هسة مباشرة لدكتور مصطفى وفريق الاستقبال حتى يتابعون وياك شخصياً 🤝.\n\n` +
      `إذا الموضوع مستعجل، تگدر تتصل بينا هاتفياً أو تراسلنا واتساب على: 07768886667 📱\n` +
      `دقائق ويكون الفريق وياك!`;

    return {
      replyText: reply,
      intent: 'human_attention_required',
      confidence: 0.98,
      requiresHumanHandoff: true,
      handoffReason: 'طلب التحدث المباشر مع الدكتور أو الاستقبال',
      extractedPatientInfo: { inquiryType: 'direct_human' },
    };
  }

  // 7. General Orthodontic Questions (Damon, Open bite, Crowding)
  const isOrthoConcept = /عضة مفتوحة|دامون|ديمون|شفاف|متراكبة|بروز|سلك|فك|انفيزالاين|ريتينر|تثبيت|خلع أسنان/i.test(text);
  if (isOrthoConcept) {
    const reply = `${hasPriorGreeting ? 'تدلل عيوني' : greetingPrefix}\n` +
      `دكتور مصطفى يعتمد أحدث التقنيات الهندسية بالتقويم، خصوصاً نظام الدامون الذاتي (Damon System) والتقويم الشفاف.\n\n` +
      `ميزة هذي الأنظمة إنها تتحرك بقوى خفيفة بيولوجية، تقلل ألم الشد، وبأغلب الحالات نتفادى قلع الأسنان السليمة ونعالج العضة المفتوحة والبروز بدون جراحة!\n\n` +
      `تحب تشرحلي أكثر شنو المشكلة بأسنانك أو تحب نسجلك موعد استشارة حتى يفحصك الدكتور؟ 🦷✨`;

    return {
      replyText: reply,
      intent: 'orthodontic_inquiry',
      confidence: 0.93,
      treatmentDetected: 'orthodontics',
      requiresHumanHandoff: false,
      extractedPatientInfo: { inquiryType: 'orthodontic_explanation' },
    };
  }

  // 8. General Polite Fallback (Context-aware, Not Repeating Greeting)
  const generalReply = hasPriorGreeting
    ? `تدلل ${brotherSister}! احنا وياك دائماً. كلي شنو تحب تعرف أكثر عن علاجات الأسنان أو التقويم، أو إذا حاب نرتبلك موعد فحص يم دكتور مصطفى بزيونة؟ 🦷`
    : `${greetingPrefix}\n` +
      `شعارنا دائماً: "طبيب أسنان يشرحلك قبل لا يعالجك" 📐✨\n\n` +
      `شلون أكدر أساعدك اليوم؟ سواء استفسار عن تقويم الأسنان، مشاكل الإطباق، أو تحب نرتب موعد كشفية واستشارة يم دكتور مصطفى؟ تدلل! 🦷`;

  return {
    replyText: generalReply,
    intent: 'general_dental_education',
    confidence: 0.88,
    treatmentDetected: 'consultation',
    requiresHumanHandoff: false,
    extractedPatientInfo: { inquiryType: 'general_inquiry' },
  };
}

