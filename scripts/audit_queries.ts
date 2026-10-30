import { generateIraqiDialectResponse } from '../src/lib/ai/iraqiEngine';

const queries = [
  'شكد سعر التقويم؟',
  'أريد تقسيط التقويم.',
  'أريد تقويم شفاف.',
  'عندي عضة مفتوحة.',
  'أسناني متراكبة.',
  'أريد أحجز موعد.',
  'عندي ألم قوي بالضرس.',
  'أريد أحجي ويا الدكتور.'
];

console.log('================================================================');
console.log('MUSTAFAH-AI — BAGHDAD DIALECT VERIFICATION AUDIT');
console.log('================================================================\n');

for (const q of queries) {
  const res = generateIraqiDialectResponse(q, 'drmustafa_hadi');
  console.log(`QUERY: "${q}"`);
  console.log(`INTENT: ${res.intent}`);
  console.log(`CONFIDENCE: ${res.confidence}`);
  console.log(`TREATMENT_DETECTED: ${res.treatmentDetected || 'none'}`);
  console.log(`REQUIRES_HANDOFF: ${res.requiresHumanHandoff}`);
  console.log(`HANDOFF_REASON: ${res.handoffReason || 'N/A'}`);
  console.log(`REPLY_TEXT:`);
  console.log(res.replyText);
  console.log('\n' + '-'.repeat(60) + '\n');
}

