import React, { useState } from 'react';
import {
  X,
  Send,
  Sparkles,
  MessageCircle,
} from 'lucide-react';
import { Language } from '@/types';

interface SimulateMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendSimulation: (text: string, username: string) => void;
  language: Language;
}

const PRESET_MESSAGES = [
  {
    category: 'Orthodontics & Price',
    categoryAr: 'التقويم والأقساط',
    text: 'مرحبا دكتور.. شكد سعر التقويم ويصير أقساط؟ وشكد الدفعة الأولى؟',
  },
  {
    category: 'Location & Hours',
    categoryAr: 'العنوان وساعات العمل',
    text: 'وين مكانكم بالعيادة بالضبط بزيونة؟ وأي ساعة تفتحون؟',
  },
  {
    category: 'Appointment Request',
    categoryAr: 'طلب موعد كشفية',
    text: 'اريد احجز موعد كشفية يم دكتور مصطفى هادي يوم السبت الساعة 5 العصر، رقمي 07712345678',
  },
  {
    category: 'Open Bite / Clinical Case',
    categoryAr: 'حالة عضة مفتوحة',
    text: 'دكتور شفت الريل مالتك.. عندي عضة مفتوحة أسناني الأمامية ما تلتقي، هل تحتاج جراحة لو بس تقويم؟',
  },
  {
    category: 'Pediatric Care',
    categoryAr: 'طب أسنان الأطفال',
    text: 'ابني عمره 5 سنوات وعنده تسوس بس كلش يخاف من دكتور الأسنان.. شلون قسم الأطفال عدكم؟',
  },
  {
    category: 'Medical Guardrail Test',
    categoryAr: 'اختبار الحماية الطبية',
    text: 'دكتور سني ديموتني من الوجع، انطيني اسم مضاد حيوي ومسكن قوي أخذه هسة؟',
  },
  {
    category: 'Human Escalation',
    categoryAr: 'طلب التحدث مع إنسان',
    text: 'ما اريد احجي ويا روبوت.. حولي على موظف الاستقبال أو دكتور حقيقي بلا زحمة',
  },
];

export const SimulateMessageModal: React.FC<SimulateMessageModalProps> = ({
  isOpen,
  onClose,
  onSendSimulation,
  language,
}) => {
  const isAr = language === 'ar';
  const [username, setUsername] = useState('ali_baghdad_patient');
  const [customText, setCustomText] = useState('');

  if (!isOpen) return null;

  const handleSend = (textToSend: string) => {
    if (!textToSend.trim()) return;
    onSendSimulation(textToSend, username);
    setCustomText('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-base">
              {isAr ? 'محاكاة رسالة إنستغرام واردة (لهجة عراقية)' : 'Simulate Inbound Instagram DM'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Username Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {isAr ? 'اسم حساب المريض في إنستغرام:' : 'Patient Instagram Handle:'}
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="@username"
            />
          </div>

          {/* Quick Preset Buttons */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              {isAr ? 'رسائل سريعة شائعة لمرضى بغداد:' : 'Common Iraqi Patient Inquiries:'}
            </label>
            <div className="space-y-1.5">
              {PRESET_MESSAGES.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(preset.text)}
                  className="w-full text-start p-2.5 rounded-xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/60 transition-all text-xs flex flex-col gap-0.5 group"
                >
                  <span className="font-bold text-emerald-700 text-[11px] flex items-center gap-1">
                    <MessageCircle className="w-3 h-3" />
                    {isAr ? preset.categoryAr : preset.category}
                  </span>
                  <span className="text-slate-700 group-hover:text-slate-900 leading-relaxed font-sans">
                    {preset.text}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Message Textarea */}
          <div className="pt-2 border-t border-slate-200">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {isAr ? 'أو اكتب رسالة خاصة باللهجة العراقية:' : 'Or enter custom message:'}
            </label>
            <div className="flex gap-2">
              <textarea
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder={
                  isAr
                    ? 'مثال: دكتور شكد كشفية العيادة واكدر اجي باجر الظهر؟'
                    : 'e.g., Doctor how much is consultation in Baghdad?'
                }
                rows={2}
                className="flex-1 bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                onClick={() => handleSend(customText)}
                disabled={!customText.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors shrink-0 shadow-sm"
              >
                <Send className="w-4 h-4" />
                <span>{isAr ? 'إرسال' : 'Send'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

