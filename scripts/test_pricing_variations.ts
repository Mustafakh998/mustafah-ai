import { classifyPilotIntent, generateIraqiDialectResponse } from '../src/lib/ai/iraqiEngine';

const MANDATORY_TEMPLATE = `بالنسبة لأسعار تقويم الأسنان، تختلف حسب الحالة ونوع العلاج والخطة المناسبة إلك.

حتى نكدر نعطيك التفاصيل الصحيحة، نفضّل يتم تقييم حالتك والتواصل ويانه مباشرة لمعرفة التفاصيل.

يسعدنا نساعدك ونرتب إلك استشارة ويا د. مصطفى هادي ❤️`;

const queries = [
  'شكد سعر التقويم؟',
  'شكد يكلف التقويم؟',
  'أريد أقساط للتقويم',
  'شكد الدفعة الأولى؟',
  'سعر التقويم الشفاف؟',
  'orthodontic price',
  'braces cost',
  'monthly installments for braces',
];

console.log('================================================================');
console.log('MUSTAFAH-AI — STRICT ORTHODONTIC PRICING VARIATIONS AUDIT');
console.log('================================================================\n');

let allPassed = true;

for (const q of queries) {
  const classification = classifyPilotIntent(q);
  const resp = generateIraqiDialectResponse(q, 'drmustafa_hadi');

  const intentMatch = classification.intent === 'orthodontic_inquiry';
  const handoffMatch = resp.requiresHumanHandoff === true;
  const replyMatch = resp.replyText.trim() === MANDATORY_TEMPLATE.trim();
  const noPriceFigures =
    !resp.replyText.includes('1,000,000') &&
    !resp.replyText.includes('1,500,000') &&
    !resp.replyText.includes('1,200,000') &&
    !resp.replyText.includes('دينار') &&
    !resp.replyText.includes('$');

  const queryPassed = intentMatch && handoffMatch && replyMatch && noPriceFigures;
  if (!queryPassed) allPassed = false;

  console.log(`QUERY: "${q}"`);
  console.log(`  -> Intent: ${classification.intent} [${intentMatch ? 'PASS' : 'FAIL'}]`);
  console.log(`  -> Requires Handoff: ${resp.requiresHumanHandoff} [${handoffMatch ? 'PASS' : 'FAIL'}]`);
  console.log(`  -> Template Matched Exactly: [${replyMatch ? 'PASS' : 'FAIL'}]`);
  console.log(`  -> Zero Pricing Disclosed: [${noPriceFigures ? 'PASS' : 'FAIL'}]`);
  console.log('--------------------------------------------------');
}

if (allPassed) {
  console.log('\n✅ ALL 8 ORTHODONTIC PRICING VARIATIONS STRICTLY ENFORCED.');
  process.exit(0);
} else {
  console.error('\n❌ SOME VARIATIONS FAILED PRICING PROHIBITION AUDIT.');
  process.exit(1);
}
