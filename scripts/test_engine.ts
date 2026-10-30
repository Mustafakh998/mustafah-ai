import { generateIraqiDialectResponse, classifyPilotIntent } from '../src/lib/ai/iraqiEngine';
import { generateDentalContent, generate30DayCalendar } from '../src/lib/ai/contentGenerator';
import { INITIAL_ACCOUNTS, CLINIC_SERVICES } from '../src/lib/data/initialData';

console.log('================================================================');
console.log('MUSTAFAH-AI — AUTOMATED PRODUCTION VERIFICATION SUITE');
console.log('================================================================\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, description: string) {
  totalTests++;
  if (condition) {
    console.log(`✅ [PASS] ${description}`);
    passedTests++;
  } else {
    console.error(`❌ [FAIL] ${description}`);
  }
}

// -----------------------------------------------------------------------------
// SECTION 1: MANDATORY ORTHODONTIC PRICING PROHIBITION & APPROVED TEMPLATE
// -----------------------------------------------------------------------------
console.log('--- 1. Testing Strict Orthodontic Pricing Prohibition & Template ---');
const resOrthoPrice = generateIraqiDialectResponse('شكد سعر التقويم؟', 'drmustafa_hadi');

assert(
  resOrthoPrice.replyText.includes('بالنسبة لأسعار تقويم الأسنان، تختلف حسب الحالة ونوع العلاج والخطة المناسبة إلك.'),
  'Assistant provides approved opening for orthodontic price inquiry'
);
assert(
  resOrthoPrice.replyText.includes('حتى نكدر نعطيك التفاصيل الصحيحة، نفضّل يتم تقييم حالتك والتواصل ويانه مباشرة لمعرفة التفاصيل.'),
  'Assistant emphasizes direct clinical assessment and consultation'
);
assert(
  resOrthoPrice.replyText.includes('يسعدنا نساعدك ونرتب إلك استشارة ويا د. مصطفى هادي ❤️'),
  'Assistant concludes with approved CTA for consultation with Dr. Mustafa Hadi'
);
assert(
  !resOrthoPrice.replyText.includes('1,200,000') &&
  !resOrthoPrice.replyText.includes('1,000,000') &&
  !resOrthoPrice.replyText.includes('1,500,000') &&
  !resOrthoPrice.replyText.includes('2,500,000') &&
  !resOrthoPrice.replyText.includes('دينار'),
  'No orthodontic price, numbers or ranges are disclosed in price response'
);
assert(
  resOrthoPrice.requiresHumanHandoff === true,
  'Questions about orthodontic prices are strictly escalated to human reception'
);

// -----------------------------------------------------------------------------
// SECTION 2: ORTHODONTIC INSTALLMENT INQUIRIES & ESCALATION
// -----------------------------------------------------------------------------
console.log('\n--- 2. Testing Orthodontic Installment & Financing Escalation ---');
const resInstallment = generateIraqiDialectResponse('يصير اسوي تقويم باقساط شهرية وشكد المقدمة؟', 'drmustafa_hadi');

assert(
  resInstallment.requiresHumanHandoff === true,
  'Questions about orthodontic installments or down payments are escalated'
);
assert(
  resInstallment.replyText.includes('بالنسبة لأسعار تقويم الأسنان، تختلف حسب الحالة'),
  'Installment inquiry receives the mandatory approved policy template'
);
assert(
  !resInstallment.replyText.includes('1,200,000') && !resInstallment.replyText.includes('1,000,000'),
  'Old orthodontic price ranges do not appear in installment response'
);

// -----------------------------------------------------------------------------
// SECTION 3: CLINICAL ORTHODONTIC INQUIRIES DISCLOSE ZERO PRICES
// -----------------------------------------------------------------------------
console.log('\n--- 3. Testing Clinical Inquiries Disclose Zero Pricing ---');
const clinicalQueries = ['أريد تقويم شفاف.', 'عندي عضة مفتوحة.', 'أسناني متراكبة.'];
for (const q of clinicalQueries) {
  const res = generateIraqiDialectResponse(q, 'drmustafa_hadi');
  assert(
    !res.replyText.includes('1,200,000') &&
    !res.replyText.includes('1,000,000') &&
    !res.replyText.includes('1,500,000') &&
    !res.replyText.includes('دينار'),
    `Clinical query "${q}" discloses no price or currency figures`
  );
  assert(
    res.replyText.includes('د. مصطفى هادي — طبيب أسنان يشرحلك قبل لا يعالجك'),
    `Clinical query "${q}" maintains approved brand identity`
  );
}

// -----------------------------------------------------------------------------
// SECTION 4: LOCATION AND CLINIC PHONE
// -----------------------------------------------------------------------------
console.log('\n--- 4. Testing Clinic Location & Phone Verification ---');
const resLoc = generateIraqiDialectResponse('وين مكانكم بالعيادة بالضبط بزيونة؟', 'almeswaksmile_iq');
assert(
  resLoc.intent === 'location_and_directions',
  'Correctly identified location inquiry'
);
assert(
  resLoc.replyText.includes('زيونة') && resLoc.replyText.includes('دريم سيتي'),
  'Reply contains verified Zayouna & Dream City Mall location'
);
assert(
  resLoc.replyText.includes('07768886667'),
  'Reply contains verified reception hotline (07768886667)'
);

// -----------------------------------------------------------------------------
// SECTION 5: APPOINTMENT REQUEST EXTRACTION & RECEPTION ESCALATION
// -----------------------------------------------------------------------------
console.log('\n--- 5. Testing Appointment Extraction & Non-Prescriptive Request ---');
const resApt = generateIraqiDialectResponse(
  'اريد احجز كشفية يم دكتور مصطفى يوم السبت الساعة 5 العصر، رقمي 07712345678',
  'drmustafa_hadi',
  'علي'
);
assert(
  resApt.intent === 'consultation_request',
  'Correctly classified consultation request'
);
assert(
  resApt.extractedPatientInfo?.phone === '07712345678',
  'Extracted Iraqi mobile phone (07712345678)'
);
assert(
  resApt.extractedPatientInfo?.preferredDate === 'السبت',
  'Extracted requested day (السبت)'
);
assert(
  resApt.requiresHumanHandoff === true,
  'Requires human reception availability confirmation'
);
assert(
  resApt.replyText.includes('ما نكدر نأكد الحجز النهائي آلياً') || resApt.replyText.includes('لتأكيد الحجز'),
  'Protects clinic from false chair confirmation promises'
);

// -----------------------------------------------------------------------------
// SECTION 6: MEDICAL GUARDRAILS (PROHIBITING ONLINE DIAGNOSIS & PRESCRIPTION)
// -----------------------------------------------------------------------------
console.log('\n--- 6. Testing Medical Guardrail & Prescription Blocking ---');
const resUrgent = generateIraqiDialectResponse(
  'دكتور سني ديموتني من الوجع، انطيني اسم مضاد حيوي ومسكن قوي اخذه هسة؟',
  'drmustafa_hadi'
);
assert(
  resUrgent.intent === 'urgent_clinical_question',
  'Triggered medical diagnosis / emergency prescription guardrail'
);
assert(
  resUrgent.requiresHumanHandoff === true,
  'Mandated urgent reception escalation'
);
assert(
  resUrgent.replyText.includes('الأمانة الطبية') || resUrgent.replyText.includes('فحص سريري'),
  'Politely enforced clinical liability and need for in-person exam'
);

// -----------------------------------------------------------------------------
// SECTION 7: HUMAN ESCALATION PROTOCOL
// -----------------------------------------------------------------------------
console.log('\n--- 7. Testing Human Escalation Protocol ---');
const resHuman = generateIraqiDialectResponse(
  'ما اريد احجي ويا روبوت.. حولي على موظف الاستقبال أو دكتور حقيقي',
  'almeswaksmile_iq'
);
assert(
  resHuman.intent === 'human_attention_required',
  'Detected request for human takeover'
);
assert(
  resHuman.requiresHumanHandoff === true,
  'Set human takeover flag to true'
);

// -----------------------------------------------------------------------------
// SECTION 8: MUSTAFAH-AI BRANDING & CLINIC WORKSPACE ISOLATION
// -----------------------------------------------------------------------------
console.log('\n--- 8. Testing MustafaH-AI Branding & Clinic Workspace Isolation ---');
const resProfile = generateIraqiDialectResponse('أريد أحجي ويا الدكتور', 'drmustafa_hadi');
assert(
  resProfile.replyText.includes('MustafaH-AI') || resProfile.replyText.includes('دكتور مصطفى هادي'),
  'Assistant identity reflects MustafaH-AI and Dr. Mustafa Hadi'
);

const personalAccount = INITIAL_ACCOUNTS.find((a) => a.id === 'drmustafa_hadi');
const clinicAccount = INITIAL_ACCOUNTS.find((a) => a.id === 'almeswaksmile_iq');

assert(
  personalAccount?.status === 'connected',
  'Personal developer brand (@drmustafa_hadi) is active'
);
assert(
  clinicAccount?.status === 'demo_mode',
  'Clinic account (@almeswaksmile.iq) remains isolated and locked in demo mode'
);
assert(
  clinicAccount?.name === 'Almeswak Dental Clinic' && clinicAccount?.handle === 'almeswaksmile.iq',
  'Clinic identity and handle (@almeswaksmile.iq) are strictly preserved'
);

const orthoService = CLINIC_SERVICES.find((s) => s.id === 'orthodontics');
assert(
  Boolean(orthoService && !orthoService.priceRangeIQD.includes('1,200,000') && !orthoService.priceRangeIQD.includes('1,000,000')),
  'Knowledge base service schema contains no orthodontic price numbers'
);

// -----------------------------------------------------------------------------
// SECTION 9: CONTENT STUDIO & 30-DAY CONTENT CALENDAR
// -----------------------------------------------------------------------------
console.log('\n--- 9. Testing Content Studio & 30-Day Content Calendar ---');
const reel = generateDentalContent({
  accountId: 'drmustafa_hadi',
  series: 'خل نحچي عن التقويم',
  format: 'reel',
});
assert(Boolean(reel.hookAr && reel.hookAr.length > 10), 'Reel includes attention-grabbing hook in Arabic');
assert(Boolean(reel.scriptAr && reel.scriptAr.length > 50), 'Reel includes full Iraqi Arabic spoken script');
assert(Boolean(reel.visualDirectionAr && reel.visualDirectionAr.length > 20), 'Reel includes visual direction and camera staging');
assert(Boolean(reel.captionAr && reel.captionAr.includes('#')), 'Reel includes ready caption with hashtags');
assert(Boolean(reel.ctaAr), 'Reel includes clear call to action');
assert(Boolean(reel.coverHeadlineAr), 'Reel includes cover headline');
assert(Boolean(reel.targetAudienceAr), 'Reel specifies target audience');

const calendar = generate30DayCalendar();
assert(calendar.length >= 15, `Calendar generated ${calendar.length} scheduled posts over 30 days`);
const reelsCount = calendar.filter((c) => c.format === 'reel').length;
const carouselsCount = calendar.filter((c) => c.format === 'carousel').length;
assert(reelsCount >= 10, `Calendar maintains 3 reels weekly cadence (${reelsCount} reels)`);
assert(carouselsCount >= 4, `Calendar maintains 1 carousel weekly cadence (${carouselsCount} carousels)`);

console.log('\n================================================================');
console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} Passed (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log('================================================================');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
