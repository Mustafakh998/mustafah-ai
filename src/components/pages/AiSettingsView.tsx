import React, { useState } from 'react';
import {
  Sliders,
  ShieldAlert,
  Sparkles,
  RefreshCw,
  Cpu,
  AlertTriangle,
} from 'lucide-react';
import { AppState } from '@/lib/store';

import { generateIraqiDialectResponse } from '@/lib/ai/iraqiEngine';

interface AiSettingsViewProps {
  state: AppState;
}

export const AiSettingsView: React.FC<AiSettingsViewProps> = ({ state }) => {
  const isAr = state.currentLanguage === 'ar';

  const [dialectTone, setDialectTone] = useState<'baghdad_polite' | 'baghdad_street' | 'standard_arabic'>('baghdad_polite');
  const [minConfidence, setMinConfidence] = useState(0.85);
  const [blockDiagnosis, setBlockDiagnosis] = useState(true);
  const [blockOrthoPricing, setBlockOrthoPricing] = useState(true);
  const [blockPrescriptions, setBlockPrescriptions] = useState(true);
  const [escalateOnPhone, setEscalateOnPhone] = useState(true);
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');

  // Test Playground
  const [testInput, setTestInput] = useState('شكد سعر التقويم ويصير فحص اونلاين بالصور؟');
  const [testResult, setTestResult] = useState<ReturnType<typeof generateIraqiDialectResponse> | null>(null);

  const handleRunTest = () => {
    const res = generateIraqiDialectResponse(testInput, 'drmustafa_hadi', 'أحمد البغدادي');
    setTestResult(res);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-black text-slate-900">
          {isAr ? 'إعدادات محرك الذكاء الاصطناعي باللهجة العراقية' : 'Iraqi Arabic AI Engine Settings'}
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          {isAr
            ? 'ضبط دقة فهم لهجة بغداد، قيود الأمان الطبي، وضوابط تحويل الحالات إلى موظف الاستقبال'
            : 'Configure Baghdad dialect nuance, medical guardrails, and human escalation thresholds.'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Settings Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Dialect Persona Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Sliders className="w-4 h-4 text-emerald-600" />
              <span>{isAr ? 'نبرة اللهجة البغدادية وأسلوب الترحيب' : 'Baghdad Dialect Style & Persona'}</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setDialectTone('baghdad_polite')}
                className={`p-3.5 rounded-xl border text-start transition-all ${
                  dialectTone === 'baghdad_polite'
                    ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950 font-bold shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <div className="text-xs font-bold mb-1">
                  {isAr ? 'بغدادي مؤدب وراقي (الموصى به)' : 'Polite Baghdad (Recommended)'}
                </div>
                <div className="text-[11px] text-slate-500 font-normal leading-relaxed">
                  &quot;أهلاً وسهلاً بيك نورتنا 💚 تدلل عيوني، كشفية التقويم يم دكتور مصطفى...&quot;
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDialectTone('baghdad_street')}
                className={`p-3.5 rounded-xl border text-start transition-all ${
                  dialectTone === 'baghdad_street'
                    ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950 font-bold shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <div className="text-xs font-bold mb-1">
                  {isAr ? 'عامي شبابي عفوي' : 'Casual Street Slang'}
                </div>
                <div className="text-[11px] text-slate-500 font-normal leading-relaxed">
                  &quot;هلا عيني! شتكول نسويلك موعد السبت العصر يم د. مصطفى ونرتبلك الأسنان...&quot;
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDialectTone('standard_arabic')}
                className={`p-3.5 rounded-xl border text-start transition-all ${
                  dialectTone === 'standard_arabic'
                    ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950 font-bold shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <div className="text-xs font-bold mb-1">
                  {isAr ? 'فصحى طبية رسمية' : 'Formal Medical Arabic'}
                </div>
                <div className="text-[11px] text-slate-500 font-normal leading-relaxed">
                  &quot;أهلاً بحضرتك.. بالنسبة لأسعار تقويم الأسنان، تختلف حسب الحالة والخطة المناسبة إلك...&quot;
                </div>
              </button>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 block">
                  {isAr ? 'الحد الأدنى لثقة الذكاء الاصطناعي (Confidence Threshold):' : 'Confidence Threshold:'}
                </span>
                <span className="text-[11px] text-slate-500">
                  {isAr
                    ? 'إذا قلت ثقة المساعد عن هذه النسبة يتم تحويل المحادثة لموظف الاستقبال'
                    : 'Transfers to reception staff if intent confidence falls below threshold'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-700 font-mono">
                  {Math.round(minConfidence * 100)}%
                </span>
                <input
                  type="range"
                  min="0.6"
                  max="0.95"
                  step="0.05"
                  value={minConfidence}
                  onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
                  className="w-24 accent-emerald-600"
                />
              </div>
            </div>
          </div>

          {/* Medical Liability & Guardrails Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <span>{isAr ? 'ضوابط الأمان والمسؤولية الطبية (Medical Guardrails)' : 'Medical Liability & Safety Guardrails'}</span>
            </h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    {isAr ? 'حظر التشخيص السريري عبر الإنترنت (Online Diagnosis Block)' : 'Block Online Medical Diagnosis'}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {isAr
                      ? 'منع المساعد من تأكيد خطة علاجية نهائية من الصور وإلزامه بطلب فحص سريري وأشعة بالعيادة'
                      : 'Prohibits binding medical diagnoses over DM; mandates in-clinic exam.'}
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={blockDiagnosis}
                  onChange={(e) => setBlockDiagnosis(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 rounded"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span>{isAr ? 'حماية أسعار واستشارات التقويم (Ortho Pricing Guardrail)' : 'Orthodontic Pricing Guardrail'}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      blockOrthoPricing ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {blockOrthoPricing ? (isAr ? 'مفعّل' : 'Active') : (isAr ? 'معطّل' : 'Off')}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                    {isAr
                      ? 'تفضيل عدم كشف أسعار أو أقساط التقويم آلياً والرد بالصيغة الاستشارية المعتمدة مع تحويل الاستفسار للاستقبال'
                      : 'Optionally conceal orthodontic prices and installments; use consultation template and escalate to reception.'}
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={blockOrthoPricing}
                  onChange={(e) => setBlockOrthoPricing(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    {isAr ? 'حظر وصف الأدوية والمسكنات والمضادات الحيوية' : 'Block Drug & Prescription Advice'}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {isAr
                      ? 'منع ذكر جرعات الأموكسيسيلين، البروفين، أو المسكنات بدون إشراف طبيب مباشر'
                      : 'Strictly blocks medication advice (Amoxicillin, Brufen) over messaging.'}
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={blockPrescriptions}
                  onChange={(e) => setBlockPrescriptions(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 rounded"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    {isAr ? 'تحويل فوري للاستقبال عند تزويد رقم الهاتف' : 'Auto-Handoff on Phone Number Detection'}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {isAr
                      ? 'عندما يكتب المريض رقمه في المحادثة، يتم تنبيه الاستقبال هاتفياً فوراً'
                      : 'Instantly alerts reception dashboard when patient provides a phone number.'}
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={escalateOnPhone}
                  onChange={(e) => setEscalateOnPhone(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 rounded"
                />
              </div>
            </div>
          </div>

          {/* Model Selection Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Cpu className="w-4 h-4 text-blue-600" />
              <span>{isAr ? 'نموذج الذكاء الاصطناعي ومزود الخدمة' : 'LLM Model Provider'}</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { id: 'gemini-2.5-flash', name: 'Google Gemini 2.5 Flash', desc: 'استجابة فائقة السرعة ودقة لهجة' },
                { id: 'custom-llm', name: 'Custom OpenAI-Compatible', desc: 'ربط سيرفر مخصص / vLLM' },
                { id: 'deterministic-rules', name: 'Deterministic Rule Engine', desc: 'نظام الكلمات المفتاحية (بدون تكلفة)' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedModel(m.id)}
                  className={`p-3 rounded-xl border text-start text-xs transition-all ${
                    selectedModel === m.id
                      ? 'border-blue-600 bg-blue-50/70 font-bold text-blue-950'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="font-bold">{m.name}</div>
                  <div className="text-[10px] text-slate-500 font-normal mt-0.5">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Col: Interactive Test Console */}
        <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <span className="font-bold text-xs text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                {isAr ? 'منصة اختبار الردود الفورية' : 'Live Prompt Playground'}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Baghdad-Engine</span>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs text-slate-300 font-semibold mb-1 block">
                  {isAr ? 'رسالة المريض للتجربة:' : 'Patient Test Message:'}
                </label>
                <textarea
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans leading-relaxed"
                />
              </div>

              <button
                onClick={handleRunTest}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{isAr ? 'تحليل الرسالة وتوليد الرد' : 'Simulate Engine Reply'}</span>
              </button>

              {testResult && (
                <div className="p-3 bg-slate-800/90 rounded-xl border border-slate-700 space-y-2 text-xs animate-in fade-in">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>
                      Intent: <strong className="text-emerald-400">{testResult.intent}</strong>
                    </span>
                    <span>
                      Confidence: <strong className="text-blue-400">{Math.round(testResult.confidence * 100)}%</strong>
                    </span>
                  </div>

                  {testResult.requiresHumanHandoff && (
                    <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 text-[11px] flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>{testResult.handoffReason}</span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-700 text-slate-200 text-xs leading-relaxed whitespace-pre-wrap font-sans">
                    {testResult.replyText}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-400 mt-4">
            {isAr
              ? 'يتم تطبيق هذه الإعدادات تلقائياً على كل الرسائل الواردة لـ @drmustafa_hadi و @almeswaksmile.iq'
              : 'Applies automatically to incoming Meta webhooks for both accounts.'}
          </div>
        </div>
      </div>
    </div>
  );
};

