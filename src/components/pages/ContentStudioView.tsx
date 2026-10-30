import React, { useState } from 'react';
import {
  Video,
  Sparkles,
  Copy,
  CalendarPlus,
  Check,
  Film,
  Layers,
  Target,
  FileText,
  Share2,
} from 'lucide-react';
import { AppState } from '@/lib/store';
import { AccountId, ContentItem, Language } from '@/types';
import { generateDentalContent } from '@/lib/ai/contentGenerator';

interface ContentStudioViewProps {
  state: AppState;
  onAddContentItem: (item: ContentItem) => void;
  onNavigate: (tab: any) => void;
}

export const ContentStudioView: React.FC<ContentStudioViewProps> = ({
  state,
  onAddContentItem,
  onNavigate,
}) => {
  const isAr = state.currentLanguage === 'ar';
  const [selectedAccount, setSelectedAccount] = useState<AccountId>('drmustafa_hadi');
  const [selectedFormat, setSelectedFormat] = useState<'reel' | 'carousel'>('reel');
  const [selectedSeries, setSelectedSeries] = useState('خل نحچي عن التقويم');
  const [customTopic, setCustomTopic] = useState('');
  const [generatedItem, setGeneratedItem] = useState<ContentItem | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const isPersonal = selectedAccount === 'drmustafa_hadi';

  const SERIES_OPTIONS = isPersonal
    ? [
        'خل نحچي عن التقويم',
        'دكتور مصطفى يجاوب',
        'معلومة أسنان بدقيقة',
        'صح لو غلط؟',
        'من العيادة',
        'سؤال من متابع',
      ]
    : [
        'ابتسامات المسواك',
        'أبطال المسواك (أطفالنا)',
        'يوميات المسواك',
        'قبل وبعد بالمسواك',
        'معايير الثقة والتعقيم',
      ];

  const handleGenerate = () => {
    const item = generateDentalContent({
      accountId: selectedAccount,
      format: selectedFormat,
      series: selectedSeries,
      topic: customTopic,
    });
    setGeneratedItem(item);
  };

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleScheduleToCalendar = () => {
    if (!generatedItem) return;
    onAddContentItem(generatedItem);
    alert(isAr ? 'تمت إضافة السكربت إلى تقويم النشر بنجاح!' : 'Scheduled to calendar!');
    onNavigate('content_calendar');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-black text-slate-900">
          {isAr ? 'استوديو صناعة المحتوى السريري (Iraqi Content Studio)' : 'Iraqi Dental Content Studio'}
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          {isAr
            ? 'توليد ريلز وكاروسيل احترافي باللهجة العراقية مع هوك خاطف، سيناريو كامل، وتوجيه بصري لبناء الثقة وتحويل المراجعين'
            : 'Generate high-retention Reels & Carousels with hooks, full Iraqi scripts, visual cues, and conversion CTAs.'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Generator Form */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>{isAr ? 'إعدادات توليد الريل / البوست' : 'Script Generator Setup'}</span>
          </h3>

          {/* Account Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {isAr ? 'مساحة الحساب المستهدف:' : 'Target Workspace:'}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedAccount('drmustafa_hadi');
                  setSelectedSeries('خل نحچي عن التقويم');
                }}
                className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${
                  selectedAccount === 'drmustafa_hadi'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-950 shadow-sm'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                د. مصطفى هادي
                <span className="block text-[10px] font-normal text-slate-500">براند شخصي وتقويم</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedAccount('almeswaksmile_iq');
                  setSelectedSeries('ابتسامات المسواك');
                }}
                className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${
                  selectedAccount === 'almeswaksmile_iq'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-950 shadow-sm'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                عيادة المسواك
                <span className="block text-[10px] font-normal text-slate-500">إيماكس وأطفال وثقة</span>
              </button>
            </div>
          </div>

          {/* Format Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {isAr ? 'نوع القالب:' : 'Content Format:'}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSelectedFormat('reel')}
                className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  selectedFormat === 'reel'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-950'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Film className="w-3.5 h-3.5" />
                <span>{isAr ? 'ريل فيديو (Reel)' : 'Reel'}</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedFormat('carousel')}
                className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  selectedFormat === 'carousel'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-950'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{isAr ? 'سلايدر صور (Carousel)' : 'Carousel'}</span>
              </button>
            </div>
          </div>

          {/* Series Dropdown */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {isAr ? 'السلسلة الدورية:' : 'Series Theme:'}
            </label>
            <select
              value={selectedSeries}
              onChange={(e) => setSelectedSeries(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {SERIES_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Topic / Prompt */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {isAr ? 'موضوع الحالة أو السؤال (اختياري):' : 'Custom Topic / Angle:'}
            </label>
            <input
              type="text"
              placeholder={isAr ? 'مثال: العضة المفتوحة، أسنان الأطفال، خلع الضواحك...' : 'e.g., Open bite without surgery...'}
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <button
            onClick={handleGenerate}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2 active:scale-95"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isAr ? 'توليد السكربت بالعامية البغدادية' : 'Generate Complete Script'}</span>
          </button>
        </div>

        {/* Right 2 Columns: Full Output Display */}
        <div className="lg:col-span-2 space-y-4">
          {generatedItem ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5 animate-in fade-in">
              {/* Header Details */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {generatedItem.seriesNameAr}
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      @{generatedItem.accountId === 'drmustafa_hadi' ? 'drmustafa_hadi' : 'almeswaksmile.iq'}
                    </span>
                  </div>
                  <h3 className="font-black text-slate-900 text-base">{generatedItem.titleAr}</h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      handleCopyToClipboard(
                        `📌 عنوان الغلاف:\n${generatedItem.coverHeadlineAr}\n\n🪝 الهوك:\n${generatedItem.hookAr}\n\n🎬 السيناريو:\n${generatedItem.scriptAr}\n\n🎥 التوجيه البصري:\n${generatedItem.visualDirectionAr}\n\n📝 الكابشن:\n${generatedItem.captionAr}`
                      )
                    }
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{isCopied ? (isAr ? 'تم النسخ!' : 'Copied!') : (isAr ? 'نسخ السكربت' : 'Copy All')}</span>
                  </button>

                  <button
                    onClick={handleScheduleToCalendar}
                    className="p-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                  >
                    <CalendarPlus className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{isAr ? 'جدولة بالتقويم' : 'Add to Calendar'}</span>
                  </button>
                </div>
              </div>

              {/* 1. Cover Headline & Hook */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 bg-slate-900 text-white rounded-xl space-y-1">
                  <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                    {isAr ? 'عنوان الغلاف (Cover Headline):' : 'Cover Headline:'}
                  </span>
                  <div className="font-bold text-sm text-slate-100">{generatedItem.coverHeadlineAr}</div>
                </div>

                <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider">
                    {isAr ? 'الخطاف (Hook في أول 3 ثوانٍ):' : 'Hook (First 3s):'}
                  </span>
                  <div className="font-bold text-xs text-amber-950">{generatedItem.hookAr}</div>
                </div>
              </div>

              {/* 2. Full Script */}
              <div>
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5 block">
                  {isAr ? 'السيناريو الكامل (اللهجة العراقية البغدادية):' : 'Full Iraqi Script:'}
                </span>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-800 leading-relaxed font-sans whitespace-pre-wrap">
                  {generatedItem.scriptAr}
                </div>
              </div>

              {/* 3. Visual Direction */}
              <div>
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5 block flex items-center gap-1">
                  <Film className="w-3.5 h-3.5 text-blue-600" />
                  <span>{isAr ? 'التوجيه البصري وزاوية التصوير (Visual Direction):' : 'Visual Direction:'}</span>
                </span>
                <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200 text-xs text-blue-950 leading-relaxed">
                  {generatedItem.visualDirectionAr}
                </div>
              </div>

              {/* 4. Caption & CTA */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1 block">
                    {isAr ? 'دعوة اتخاذ الإجراء (CTA):' : 'Call to Action:'}
                  </span>
                  <p className="p-3 bg-emerald-50 text-emerald-950 rounded-xl border border-emerald-200 text-xs font-medium">
                    {generatedItem.ctaAr}
                  </p>
                </div>

                <div>
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1 block">
                    {isAr ? 'الجمهور المستهدف:' : 'Target Audience:'}
                  </span>
                  <p className="p-3 bg-slate-50 text-slate-700 rounded-xl border border-slate-200 text-xs">
                    {generatedItem.targetAudienceAr}
                  </p>
                </div>
              </div>

              {/* Full Caption */}
              <div>
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1 block">
                  {isAr ? 'الكابشن والهاشتاغات الجاهزة للنسخ:' : 'Ready Caption:'}
                </span>
                <p className="p-3 bg-slate-50 text-slate-700 rounded-xl border border-slate-200 text-xs whitespace-pre-wrap leading-relaxed font-sans">
                  {generatedItem.captionAr}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 space-y-3">
              <Sparkles className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="font-bold text-slate-700 text-sm">
                {isAr ? 'بانتظار توليد السكربت' : 'Script Generator Ready'}
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {isAr
                  ? 'اختر الحساب والسلسلة واضغط زر "توليد السكربت" لإنشاء ريل تسويقي كامل يحقق تفاعلاً وتحويلاً حقيقياً'
                  : 'Select an account and theme, then click generate to craft high-conversion dental reels.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
