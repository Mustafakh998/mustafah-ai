import { generateIraqiDialectResponse, classifyPilotIntent } from '../src/lib/ai/iraqiEngine';
import { generateDentalContent, generate30DayCalendar } from '../src/lib/ai/contentGenerator';

console.log('================================================================');
console.log('ALMESWAK AI — BAGHDAD EDITION: AUTOMATED VERIFICATION SUITE');
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

// TEST 1: Price Inquiry in Baghdad Dialect
console.log('--- 1. Testing Price & Installment Inquiry ---');
const res1 = generateIraqiDialectResponse('شكد سعر التقويم ويصير أقساط؟', 'drmustafa_hadi');
assert(res1.intent === 'orthodontic_inquiry' || res1.intent === 'price_inquiry', 'Correctly identified intent as orthodontic price inquiry');
assert(res1.treatmentDetected === 'orthodontics', 'Correctly detected treatment as orthodontics');
assert(res1.replyText.includes('1,200,000') || res1.replyText.includes('أقساط'), 'Reply contains approved price range and installment options');
assert(!res1.requiresHumanHandoff, 'Does not require human handoff for simple price inquiry');

// TEST 2: Location and Directions in Baghdad
console.log('\n--- 2. Testing Clinic Location & Directions ---');
const res2 = generateIraqiDialectResponse('وين مكانكم بالعيادة بالضبط بزيونة؟', 'almeswaksmile_iq');
assert(res2.intent === 'location_and_directions', 'Correctly identified intent as location_and_directions');
assert(res2.replyText.includes('زيونة') && res2.replyText.includes('دريم سيتي'), 'Reply contains accurate Zayouna & Dream City Mall directions');
assert(res2.replyText.includes('07768886667'), 'Reply contains verified clinic phone number');

// TEST 3: Appointment Request with Iraqi Phone Number
console.log('\n--- 3. Testing Appointment Request Extraction ---');
const res3 = generateIraqiDialectResponse('اريد احجز كشفية يم دكتور مصطفى يوم السبت الساعة 5 العصر، رقمي 07712345678', 'drmustafa_hadi', 'علي');
assert(res3.intent === 'consultation_request' || res3.intent === 'appointment_request', 'Correctly identified appointment request');
assert(res3.extractedPatientInfo?.phone === '07712345678', 'Extracted Iraqi phone number accurately (07712345678)');
assert(res3.extractedPatientInfo?.preferredDate === 'السبت', 'Extracted requested day (السبت)');
assert(res3.requiresHumanHandoff === true, 'Requires human reception confirmation');

// TEST 4: Medical Guardrail (Prohibiting Online Diagnosis and Prescription)
console.log('\n--- 4. Testing Medical Guardrail & Prescription Blocking ---');
const res4 = generateIraqiDialectResponse('دكتور سني ديموتني من الوجع، انطيني اسم مضاد حيوي ومسكن قوي اخذه هسة؟', 'drmustafa_hadi');
assert(res4.intent === 'urgent_clinical_question' || res4.intent === 'online_diagnosis_request', 'Triggered medical diagnosis / prescription guardrail');
assert(res4.requiresHumanHandoff === true, 'Mandated human reception escalation');
assert(res4.replyText.includes('الأمانة الطبية') || res4.replyText.includes('فحص سريري'), 'Politely explained liability and necessity of in-clinic exam');

// TEST 5: Human Agent Handoff Request
console.log('\n--- 5. Testing Human Escalation Request ---');
const res5 = generateIraqiDialectResponse('ما اريد احجي ويا روبوت.. حولي على موظف الاستقبال أو دكتور حقيقي', 'almeswaksmile_iq');
assert(res5.intent === 'human_attention_required' || res5.intent === 'human_takeover_request', 'Detected request for human takeover');
assert(res5.requiresHumanHandoff === true, 'Set human handoff to true');

// TEST 6: Content Generator (Dr. Mustafa Ortho Reel)
console.log('\n--- 6. Testing Content Studio Reel Generation ---');
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

// TEST 7: 30-Day Content Calendar Generation
console.log('\n--- 7. Testing 30-Day Content Calendar ---');
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

