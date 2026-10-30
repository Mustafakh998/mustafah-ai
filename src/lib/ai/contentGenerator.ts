import { AccountId, ContentItem } from '@/types';

export interface ContentGenerationRequest {
  accountId: AccountId;
  topic?: string;
  series?: string;
  format?: 'reel' | 'carousel' | 'story';
  targetObjective?: 'appointment_conversion' | 'trust_building' | 'educational_reach';
}

const DR_MUSTAFA_SERIES = [
  'خل نحچي عن التقويم',
  'دكتور مصطفى يجاوب',
  'معلومة أسنان بدقيقة',
  'صح لو غلط؟',
  'من العيادة',
  'سؤال من متابع',
];

const CLINIC_SERIES = [
  'ابتسامات المسواك',
  'أبطال المسواك (أطفالنا)',
  'يوميات المسواك',
  'قبل وبعد بالمسواك',
  'معايير الثقة والتعقيم',
];

export function generateDentalContent(request: ContentGenerationRequest): ContentItem {
  const isPersonal = request.accountId === 'drmustafa_hadi';
  const format = request.format || 'reel';
  const id = `generated_${Date.now()}`;

  if (isPersonal) {
    const series = request.series || DR_MUSTAFA_SERIES[Math.floor(Math.random() * DR_MUSTAFA_SERIES.length)];

    if (series === 'صح لو غلط؟' || request.topic?.includes('غلط')) {
      return {
        id,
        accountId: 'drmustafa_hadi',
        title: 'Mythbusters: Does Orthodontics Weaken Tooth Roots?',
        titleAr: 'صح لو غلط؟ التقويم يضعف جذور الأسنان ويسويها تلگلك؟ 🦷',
        format,
        seriesNameAr: 'صح لو غلط؟',
        hookAr: 'صح لو غلط.. التقويم بعد ما تفتحه تبقى أسنانك تتحرك وتضعف جذورها؟ 😱',
        scriptAr:
          'هواية ناس يترددون يسوون تقويم لأن سامعين إشاعة تكول: الأسنان ترجع تخرب وجذورها تموت!\nخل نجاوبكم علمياً:\nلما نحرك الأسنان بقوى ميكانيكية محسوبة ومدروسة بأيدي أخصائي، العظم يذوب من جهة ويبني عظم جديد وقوي من الجهة الثانية!\nالسن يتحرك بثبات تام، وبنهاية العلاج نركب جهاز تثبيت (Retainer) يخلي النتيجة ثابتة وقوية طول العمر.\nالتقويم بالعكس، يحمي أسنانك من التآكل وتجمع الجير لما نصلح الإطباق العوج.',
        visualDirectionAr:
          'د. مصطفى جالس في العيادة بإضاءة احترافية سينمائية، لقطة متوسطة مع إيماءات واثقة باليد، ثم الانتقال لصورة أشعة ثلاثية الأبعاد CBCT تبين كثافة العظم حول جذر السن أثناء حركة التقويم.',
        captionAr:
          'الإشاعات بعالم الأسنان هواية.. بس العلم يوضح الحقيقة 📐✨\nالتقويم الصحيح يبني عظم صحي ويحمي إطباقك لسنوات طويلة.\n\nعندك أي سؤال مأرقك عن التقويم؟ اكتبه بالتعليقات أو راسلنا دايركت ✉️\n\n#دكتور_مصطفى_هادي #صح_لو_غلط #تقويم_الأسنان #اسنان_بغداد #orthodontics_iraq',
        ctaAr: 'شارك الفيديو ويا شخص خايف يسوي تقويم بسبب هالكلام، وراسلنا دايركت للاستفسار ✉️',
        coverHeadlineAr: 'التقويم يضعف الجذور؟ حقيقة لو كذبة! 🤔',
        targetAudienceAr: 'الشباب والبالغين في بغداد المترددين ببدء التقويم بسبب مفاهيم شائعة خاطئة',
        scheduledDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
        status: 'draft',
      };
    }

    if (series === 'معلومة أسنان بدقيقة') {
      return {
        id,
        accountId: 'drmustafa_hadi',
        title: 'Why Clear Aligners Might Fail Without Discipline',
        titleAr: 'ليش التقويم الشفاف يفشل عند بعض الناس؟',
        format,
        seriesNameAr: 'معلومة أسنان بدقيقة',
        hookAr: 'فكرة التقويم الشفاف تجنن.. بس ليش هواية ناس تضيع فلوسها بيه بدون نتيجة؟ ⏳',
        scriptAr:
          'التقويم الشفاف (Clear Aligners) تقنية جبارة وغير مرئية ومريحة بالأكل، بس عندها شرط أساسي واحد:\nالالتزام بـ 22 ساعة يومياً!\nإذا تلبسه بس بالليل أو لما تطلع، الأسنان مراح تلحگ تتحرك، والقالب الجديد مراح يركب صح.\nقبل ما تختار الشفاف، اسأل نفسك: هل عندك الانضباط لو نختارلك نظام الدامون الذاتي اللي يشتغل على مدار 24 ساعة بدون ما تشيل همه؟',
        visualDirectionAr:
          'د. مصطفى يمسك قالب تقويم شفاف أنيق، يضعه على مجسم فك شفاف، لقطة مقربة للمفاصل الدقيقة، ثم إظهار تقويم الدامون المعدني الأنيق للمقارنة.',
        captionAr:
          'الشفافية حلوة.. بس النتيجة تحتاج التزام 📐✨ قبل ما تختار نوع التقويم، لازم نعرف نمط حياتك ومدى ملائمته لخطة العلاج.\n\nكشفية التقويم بالعيادة توضحلك الخيار الأنسب لحالتك.\nراسلنا دايركت لحجز موعد كشفية مع د. مصطفى هادي ✉️\n\n#تقويم_شفاف #دكتور_مصطفى #انفزلاين #اسنان_العراق #بغداد',
        ctaAr: 'أنت من النوع الملتزم اللي يناسبه التقويم الشفاف؟ احجيلنا بالتعليقات 💬',
        coverHeadlineAr: 'التقويم الشفاف.. متى يفشل؟ 🦷⚠️',
        targetAudienceAr: 'الموظفون والطلاب والباحثون عن حلول تقويمية غير مرئية وأنيقة في بغداد',
        scheduledDate: new Date(Date.now() + 86400000 * 4).toISOString().split('T')[0],
        status: 'draft',
      };
    }

    // Default Orthodontics series
    return {
      id,
      accountId: 'drmustafa_hadi',
      title: 'Crowded Lower Teeth & Lingual Distalization',
      titleAr: 'تزاحم الأسنان السفلية وحل ضيق الفك - د. مصطفى',
      format,
      seriesNameAr: 'خل نحچي عن التقويم',
      hookAr: 'أسنانك السفلية متراكبة وحدة فوگ الثانية ومضايقتك بالضحكة؟ شوف شلون حليناها! 🦷',
      scriptAr:
        'ازدحام الأسنان السفلية مشكلة شائعة جداً وتسبب تراكم التكلسات وصعوبة بالتنظيف.\nبهالحالة وفرنا مساحة كافية بدون ما نأثر على عظمة الذقن أو نبرز الأسنان للأمام، وبخطوات ميكانيكية محسوبة الأسنان رجعت لمسار القوس الطبيعي.\nخلال 9 أشهر فقط، تحولت الابتسامة من ازدحام وتكدس إلى صفة هندسية مثالية.',
      visualDirectionAr:
        'مقارنة بصرية واضحة مقسمة للشاشة (Split screen): صورة الأسنان السفلية قبل العلاج وصورتها بعد الاصطفاف، مع لقطة لد. مصطفى وهو يشرح الميكانيكا.',
      captionAr:
        'تعديل ازدحام الأسنان مو بس شكل وجمالية.. هو حماية حقيقية للأسنان من التسوس وتراجع اللثة 💚\n\nحاب تفحص أسنانك وتعرف خطة علاجك؟\nراسلنا على الدايركت لحجز كشفية بالعيادة في زيونة ✉️\n\n#تقويم_اسنان #دكتور_مصطفى_هادي #زيونة_بغداد #ابتسامة',
      ctaAr: 'راسلنا دايركت وراح نجاوبك عن كل تفاصيل الأقساط والمدة المتوقعة لحالتك 📩',
      coverHeadlineAr: 'تزاحم الأسنان السفلية.. الحل السريع 📐',
      targetAudienceAr: 'أهالي بغداد الراغبين بتعديل وتصفيف الأسنان المزدحمة',
      scheduledDate: new Date(Date.now() + 86400000 * 6).toISOString().split('T')[0],
      status: 'draft',
    };
  }

  // Clinic official workspace
  const series = request.series || CLINIC_SERIES[Math.floor(Math.random() * CLINIC_SERIES.length)];

  if (series === 'أبطال المسواك (أطفالنا)') {
    return {
      id,
      accountId: 'almeswaksmile_iq',
      title: 'Pediatric Dental Care SDF Technology',
      titleAr: 'علاج تسوس الأطفال بمادة SDF بدون حفر ولا ألم',
      format,
      seriesNameAr: 'أبطال المسواك (أطفالنا)',
      hookAr: 'طفلكم عنده تسوس أسنان وخايفين من الحفر والإبرة؟ عدنا الحل السحري! 🧸🩵',
      scriptAr:
        'في عيادة المسواك وفرنا أحدث تقنية عالمية لأسنان الأطفال: مادة الفلورايد الفضي SDF.\nقطرة واحدة ندهن بيها السن المتسوس بدون أي حفر وبدون أي تخدير، وتوقف التسوس فوراً وتحمي السن اللبني لحد ما يتبدل طبيعياً!\nبإشراف د. سجى الحسيني ود. شوخان طوزلو، نضمن لطفلكم زيارة كلها لعب وهدايا وابتسامة بدون أي دمعة.',
      visualDirectionAr:
        'د. سجى ببالطو الأطفال المبهج وهي تبتسم مع طفل شجاع يحمل درع البطل، لقطة لمجسم السن والألوان المرحة داخل العيادة.',
      captionAr:
        'وداعاً لخوف الأطفال من طبيب الأسنان 🧸💛 بتقنية SDF نوقف التسوس بلمسة لطيفة وبدون أي ألم.\n\nاحجزوا موعد فحص لأبطالكم الصغار عبر الدايركت أو الهاتف: 07768886667 📞\n📍 بغداد – زيونة – خدمي دريم سيتي مول\n\n#اطفالنا #عيادة_المسواك #اسنان_اطفال #بغداد #زيونة',
      ctaAr: 'راسلونا على الدايركت لحجز أول زيارة كشفية مريحة لطفلكم ✉️',
      coverHeadlineAr: 'علاج تسوس الأطفال.. بدون حفر ولا إبرة! 🧸✨',
      targetAudienceAr: 'الأمهات والآباء في بغداد الباحثين عن رعاية لطيفة لأسنان أطفالهم',
      scheduledDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
      status: 'draft',
    };
  }

  // Default E-max Clinic Transformation
  return {
    id,
    accountId: 'almeswaksmile_iq',
    title: 'E-max Smile Makeover in 2 Sessions',
    titleAr: 'ابتسامة الإيماكس بجلستين وضمان رسمي مدى الحياة',
    format,
    seriesNameAr: 'ابتسامات المسواك',
    hookAr: 'بجلستين فقط.. تگدر تحصل على الابتسامة الطبيعية اللي تحلم بيها! ✨',
    scriptAr:
      'ليش نختار قشور وخزف E-max الألماني في عيادة المسواك؟\nأولاً: شفافية ومظهر طبيعي 100% بدون بياض طبشوري صناعي.\nثانياً: برد خفيف جداً يحافظ على سلامة أسنانك الطبيعية.\nثالثاً: تنجز بجلستين فقط مع أخذ القياسات بالماسح الرقمي ثلاثي الأبعاد.\nوالأهم: بطاقة ضمان رسمي مدى الحياة ضد تغير اللون أو التلف.',
    visualDirectionAr:
      'لقطات ماكرو بجودة سينمائية فائقة تظهر انعكاس الضوء الطبيعي على أسنان الإيماكس، مع لقطات داخل مختبر العيادة الرقمي وتثبيت العدسات بدقة.',
    captionAr:
      'ابتسامتك تستحق الجودة الألمانية والضمان الحقيقي 🤍 في عيادة المسواك نضمنلك نتيجة تليق بثقتك.\n\nللحجز والاستفسار عن العروض المتاحة، راسلونا عبر الدايركت ✉️\nأو هاتفياً: 07768886667\n📍 زيونة – خدمي دريم سيتي مول\n\n#ابتسامة_المسواك #ايماكس #فينير #تجميل_اسنان #هوليود_سمايل #بغداد',
    ctaAr: 'أرسل لنا رسالة دايركت للحصول على استشارة مجانية مع طبيب التجميل ✉️',
    coverHeadlineAr: 'ابتسامة إيماكس بجلستين فقط! 🦷✨',
    targetAudienceAr: 'المهتمون بابتسامات هوليوود وتجميل الأسنان الطبيعي في بغداد',
    scheduledDate: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0],
    status: 'draft',
  };
}

export function generate30DayCalendar(): ContentItem[] {
  const calendar: ContentItem[] = [];
  const baseDate = new Date();

  for (let i = 1; i <= 30; i++) {
    const itemDate = new Date(baseDate.getTime() + i * 86400000).toISOString().split('T')[0];
    const dayOfWeek = new Date(baseDate.getTime() + i * 86400000).getDay();

    // Schedule 3 Reels per week (e.g. Sunday=0, Tuesday=2, Thursday=4)
    // 1 Carousel per week (e.g. Saturday=6)
    // Daily Stories
    if (dayOfWeek === 0 || dayOfWeek === 2 || dayOfWeek === 4) {
      const isPersonal = i % 2 === 0;
      calendar.push({
        ...generateDentalContent({
          accountId: isPersonal ? 'drmustafa_hadi' : 'almeswaksmile_iq',
          format: 'reel',
        }),
        id: `cal_reel_${i}`,
        scheduledDate: itemDate,
        status: i <= 3 ? 'approved' : 'draft',
      });
    } else if (dayOfWeek === 6) {
      calendar.push({
        ...generateDentalContent({
          accountId: 'drmustafa_hadi',
          format: 'carousel',
          series: 'دكتور مصطفى يجاوب',
        }),
        id: `cal_car_${i}`,
        scheduledDate: itemDate,
        status: i <= 3 ? 'approved' : 'draft',
      });
    }
  }

  return calendar;
}
