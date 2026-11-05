import React, { useEffect, useState } from 'react';
import { STUDIO_HANDOFF_KEY } from '@/components/pages/GrowthPlanView';
import {
  Video,
  Sparkles,
  Copy,
  CalendarPlus,
  Check,
  Film,
  Layers,
  FileText,
  Smartphone,
  Heart,
  MessageCircle,
  Bookmark,
  DollarSign,
  ChevronRight,
  ChevronLeft,
  Music,
  Send,
  Camera,
} from 'lucide-react';
import { AppState } from '@/lib/store';
import { AccountId, ContentItem, NavTabId } from '@/types';
import { toast } from '@/lib/toast';
import { generateDentalContent } from '@/lib/ai/contentGenerator';

interface ContentStudioViewProps {
  state: AppState;
  onAddContentItem: (item: ContentItem) => void;
  onNavigate: (tab: NavTabId) => void;
}

export const ContentStudioView: React.FC<ContentStudioViewProps> = ({
  state,
  onAddContentItem,
  onNavigate,
}) => {
  const isAr = state.currentLanguage === 'ar';
  const [selectedAccount, setSelectedAccount] = useState<AccountId>('drmustafa_hadi');
  // An idea picked in the Growth Plan arrives pre-filled. This view only mounts on the client after a tab click.
  const [handoff] = useState<{ format?: string; topic?: string } | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      return JSON.parse(sessionStorage.getItem(STUDIO_HANDOFF_KEY) || 'null');
    } catch {
      return null;
    }
  });
  const [selectedFormat, setSelectedFormat] = useState<'reel' | 'post' | 'carousel' | 'story'>(() =>
    handoff?.format && ['reel', 'post', 'carousel', 'story'].includes(handoff.format)
      ? (handoff.format as 'reel' | 'post' | 'carousel' | 'story')
      : 'reel'
  );
  const [selectedSeries, setSelectedSeries] = useState('خل نحچي عن التقويم');
  const [customTopic, setCustomTopic] = useState(() => (typeof handoff?.topic === 'string' ? handoff.topic : ''));
  const [generatedItem, setGeneratedItem] = useState<ContentItem | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [usedAccountData, setUsedAccountData] = useState(false);

  useEffect(() => {
    sessionStorage.removeItem(STUDIO_HANDOFF_KEY); // use the handoff once
  }, []);

  // Tab switch between Script and Live Instagram Simulator
  const [outputTab, setOutputTab] = useState<'script' | 'simulator'>('script');
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

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

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/ai/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: selectedAccount,
          format: selectedFormat,
          series: selectedSeries,
          topic: customTopic,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.item) {
          setGeneratedItem(data.item);
          setUsedAccountData(Boolean(data.usedAccountData));
          setActiveSlideIndex(0);
          return;
        }
      }
    } catch (err) {
      console.warn('Network call failed, falling back to local generator:', err);
    } finally {
      setIsGenerating(false);
    }

    // Client-side fallback with semantic matching
    setUsedAccountData(false);
    const item = generateDentalContent({
      accountId: selectedAccount,
      format: selectedFormat,
      series: selectedSeries,
      topic: customTopic,
    });
    setGeneratedItem(item);
    setActiveSlideIndex(0);
  };

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleScheduleToCalendar = () => {
    if (!generatedItem) return;
    onAddContentItem(generatedItem);
    toast(isAr ? 'تمت إضافة المحتوى إلى تقويم النشر بنجاح!' : 'Scheduled to calendar!');
    onNavigate('content_calendar');
  };

  return (
    <div className="space-y-6 text-start">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900">
            {isAr ? 'استوديو صناعة المحتوى السريري الشامل (Omni-Format Studio)' : 'Omni-Format Dental Content Studio'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {isAr
              ? 'توليد ريلز، بوستات صور، كاروسيل تعليمي، وستوريات تفاعلية 24 ساعة باللهجة العراقية مع محاكي إنستغرام مباشر'
              : 'Create Reels, Feed Posts, Multi-Slide Carousels, and 24h Interactive Stories with live Instagram mobile simulator.'}
          </p>
        </div>

        <button
          onClick={() => onNavigate('marketing_strategy')}
          className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
        >
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span>{isAr ? 'استراتيجية النشر والنمو' : 'Growth Strategy Playbook'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Generator Form */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>{isAr ? 'إعدادات توليد المحتوى الطبي' : 'Content Generator Setup'}</span>
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

          {/* Format Selector: 4 Formats */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {isAr ? 'صيغة المحتوى (Format):' : 'Content Format:'}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSelectedFormat('reel')}
                className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  selectedFormat === 'reel'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-950 shadow-sm'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Video className="w-3.5 h-3.5" />
                <span>{isAr ? 'ريلز وفيديو' : 'Reel / Video'}</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedFormat('post')}
                className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  selectedFormat === 'post'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-950 shadow-sm'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>{isAr ? 'منشور صورة' : 'Single Post'}</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedFormat('carousel')}
                className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  selectedFormat === 'carousel'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-950 shadow-sm'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{isAr ? 'كاروسيل 5 شرائح' : 'Carousel'}</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedFormat('story')}
                className={`p-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  selectedFormat === 'story'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-950 shadow-sm'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isAr ? 'ستوري تفاعلي' : 'Story 24h'}</span>
              </button>
            </div>
          </div>

          {/* Series Theme Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {isAr ? 'ثيمة السلسلة الطبية:' : 'Series Theme:'}
            </label>
            <select
              value={selectedSeries}
              onChange={(e) => setSelectedSeries(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:outline-none focus:border-emerald-600 bg-white"
            >
              {SERIES_OPTIONS.map((series) => (
                <option key={series} value={series}>
                  {series}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Topic / Angle */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {isAr ? 'موضوع مخصص أو زاوية طبية معينة:' : 'Custom Topic / Angle:'}
            </label>
            <input
              type="text"
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
              placeholder={
                isAr
                  ? 'مثال: علاج الابتسامة اللثوية (Gummy Smile) بالزرعات المصغرة TADs'
                  : 'e.g. Gummy smile treatments, Damon braces vs traditional'
              }
              className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:border-emerald-600 font-sans"
            />
            <div className="flex flex-wrap gap-1 mt-2">
              {[
                { label: 'عضة مفتوحة', en: 'Open Bite' },
                { label: 'ابتسامة لثوية', en: 'Gummy Smile' },
                { label: 'تقويم دامون', en: 'Damon System' },
                { label: 'قلع الضواحك', en: 'Extraction Fear' },
                { label: 'تقويم بعد الـ30', en: 'Adult Braces' },
              ].map((pill) => (
                <button
                  key={pill.label}
                  type="button"
                  onClick={() => setCustomTopic(pill.label)}
                  className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] transition-colors"
                >
                  {isAr ? pill.label : pill.en}
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
          >
            <Sparkles className="w-4 h-4 text-emerald-200" />
            <span>
              {isGenerating
                ? isAr
                  ? 'جاري التوليد بالذكاء الاصطناعي العراقي...'
                  : 'Generating Script...'
                : isAr
                ? `توليد ${selectedFormat === 'reel' ? 'الريلز' : selectedFormat === 'carousel' ? 'الكاروسيل' : selectedFormat === 'story' ? 'الستوري' : 'البوست'} بالعامية البغدادية`
                : 'Generate Complete Script'}
            </span>
          </button>
        </div>

        {/* Right 2 Columns: Full Output Display + Live Instagram Simulator */}
        <div className="lg:col-span-2 space-y-4">
          {generatedItem ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5 animate-in fade-in">
              {/* Output Tab Switcher */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setOutputTab('script')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      outputTab === 'script'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>{isAr ? 'السيناريو والتفاصيل السريرية' : 'Full Script & Cues'}</span>
                  </button>

                  <button
                    onClick={() => setOutputTab('simulator')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      outputTab === 'simulator'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>{isAr ? 'محاكي إنستغرام المباشر' : 'Live IG Simulator'}</span>
                  </button>
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

              {/* View 1: SCRIPT TAB */}
              {outputTab === 'script' && (
                <div className="space-y-4">
                  {(generatedItem.rationaleAr || generatedItem.bestTimeAr) && (
                    <div className="p-3 rounded-xl bg-violet-50 border border-violet-200 text-xs text-violet-950 space-y-1" dir="rtl">
                      {generatedItem.rationaleAr && <div>💡 {generatedItem.rationaleAr}</div>}
                      {generatedItem.bestTimeAr && <div>🕒 {generatedItem.bestTimeAr}</div>}
                    </div>
                  )}
                  {generatedItem.status === 'review_needed' && (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-900">
                      {isAr ? '⚠️ محتوى طبي من الذكاء الاصطناعي: راجعه قبل النشر.' : '⚠️ AI-written medical content: review before posting.'}
                    </div>
                  )}
                  {/* Header Details */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                          {generatedItem.format}
                        </span>
                        <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {generatedItem.seriesNameAr}
                        </span>
                        <span className="text-xs font-mono text-slate-400">
                          @{generatedItem.accountId === 'drmustafa_hadi' ? 'drmustafa_hadi' : 'almeswaksmile.iq'}
                        </span>
                      </div>
                      <h3 className="font-black text-slate-900 text-base">{generatedItem.titleAr}</h3>
                      {usedAccountData && (
                        <span className="inline-block mt-1 text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full">
                          {isAr ? 'مبني على بيانات حسابك' : 'Based on your account data'}
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => onNavigate('ad_campaigns')}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl flex items-center gap-1 shadow-sm transition-all"
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>{isAr ? 'ترويج هذا المنشور بإعلان' : 'Boost This Post'}</span>
                    </button>
                  </div>

                  {/* Cover Headline & Hook */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3.5 bg-slate-900 text-white rounded-xl space-y-1">
                      <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                        {isAr ? 'عنوان الغلاف (Cover Headline):' : 'Cover Headline:'}
                      </span>
                      <div className="font-bold text-sm text-slate-100">{generatedItem.coverHeadlineAr}</div>
                    </div>

                    <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider">
                        {isAr ? 'الخطاف (Hook أول 3 ثوانٍ / السؤال الافتتاحي):' : 'Hook (First 3s):'}
                      </span>
                      <div className="font-bold text-xs text-amber-950">{generatedItem.hookAr}</div>
                    </div>
                  </div>

                  {/* Full Script */}
                  <div>
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5 block">
                      {isAr ? 'السيناريو والشرح الكامل (اللهجة العراقية البغدادية):' : 'Full Iraqi Script:'}
                    </span>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-800 leading-relaxed font-sans whitespace-pre-wrap">
                      {generatedItem.scriptAr}
                    </div>
                  </div>

                  {/* Multi-Slide Carousel Breakdown (If Carousel) */}
                  {generatedItem.format === 'carousel' && generatedItem.slidesAr && (
                    <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-2">
                      <span className="text-xs font-bold text-blue-900 uppercase tracking-wider block flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-blue-600" />
                        <span>{isAr ? 'توزيع شرائح الكاروسيل (5 Slides):' : '5-Slide Breakdown:'}</span>
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                        {generatedItem.slidesAr.map((slide, idx) => (
                          <div key={idx} className="p-2.5 bg-white rounded-xl border border-blue-200 text-[11px] space-y-1">
                            <span className="font-black text-blue-600 text-[10px] block">Slide {idx + 1}</span>
                            <p className="text-slate-800 font-medium">{slide}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Story Stickers (If Story) */}
                  {generatedItem.format === 'story' && generatedItem.storyStickersAr && (
                    <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-2">
                      <span className="text-xs font-bold text-amber-900 uppercase tracking-wider block flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                        <span>{isAr ? 'الستيكرات التفاعلية المقترحة للستوري:' : 'Suggested Interactive Stickers:'}</span>
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {generatedItem.storyStickersAr.map((sticker, idx) => (
                          <div key={idx} className="p-2.5 bg-white rounded-xl border border-amber-200 text-xs font-bold text-amber-950 flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-[10px]">
                              {idx + 1}
                            </span>
                            <span>{sticker}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Visual Direction & Sound */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1 block flex items-center gap-1">
                        <Film className="w-3.5 h-3.5 text-blue-600" />
                        <span>{isAr ? 'التوجيه البصري وزاوية التصوير:' : 'Visual Direction:'}</span>
                      </span>
                      <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200 text-xs text-blue-950 leading-relaxed">
                        {generatedItem.visualDirectionAr}
                      </div>
                    </div>

                    <div>
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1 block flex items-center gap-1">
                        <Music className="w-3.5 h-3.5 text-purple-600" />
                        <span>{isAr ? 'الصوت والموسيقى المقترحة:' : 'Audio Recommendation:'}</span>
                      </span>
                      <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200 text-xs text-purple-950 leading-relaxed">
                        {generatedItem.audioRecommendationAr || 'موسيقى هادئة تكنولوجية تعكس رصانة د. مصطفى'}
                      </div>
                    </div>
                  </div>

                  {/* Caption & CTA */}
                  <div>
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1 block">
                      {isAr ? 'الكابشن والهاشتاغات الجاهزة للنسخ:' : 'Ready Caption & Hashtags:'}
                    </span>
                    <p className="p-3 bg-slate-50 text-slate-700 rounded-xl border border-slate-200 text-xs whitespace-pre-wrap leading-relaxed font-sans">
                      {generatedItem.captionAr}
                    </p>
                  </div>
                </div>
              )}

              {/* View 2: LIVE INSTAGRAM SIMULATOR */}
              {outputTab === 'simulator' && (
                <div className="py-4 flex justify-center">
                  {/* Phone Mockup Frame */}
                  <div className="w-full max-w-sm bg-slate-900 rounded-[40px] p-3 shadow-2xl border-4 border-slate-800 text-white relative">
                    {/* Phone Notch */}
                    <div className="w-32 h-4 bg-slate-800 rounded-full mx-auto mb-2" />

                    {/* Instagram Frame Container */}
                    <div className="bg-black rounded-[32px] overflow-hidden flex flex-col min-h-[580px] relative text-start">
                      {/* Top Bar */}
                      <div className="p-3 flex items-center justify-between border-b border-white/10 text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 to-rose-500 p-0.5">
                            <div className="w-full h-full bg-slate-900 rounded-full flex items-center justify-center font-bold text-[10px]">
                              م
                            </div>
                          </div>
                          <div>
                            <span className="font-bold text-[11px] block">
                              {generatedItem.accountId === 'drmustafa_hadi' ? 'drmustafa_hadi' : 'almeswaksmile.iq'}
                            </span>
                            <span className="text-[9px] text-slate-400">Baghdad, Iraq • زيونة</span>
                          </div>
                        </div>

                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          {generatedItem.format.toUpperCase()}
                        </span>
                      </div>

                      {/* Content Area Based on Format */}
                      <div className="flex-1 bg-gradient-to-b from-slate-950 via-slate-900 to-black p-4 flex flex-col justify-between relative">
                        {/* 1. If Reel: 9:16 overlay preview */}
                        {generatedItem.format === 'reel' && (
                          <>
                            <div className="space-y-2 mt-4">
                              <span className="text-[10px] uppercase font-bold text-emerald-400 bg-black/60 px-2 py-0.5 rounded-full inline-block">
                                🪝 First 3s Hook
                              </span>
                              <h4 className="text-base font-black text-white leading-snug drop-shadow-md">
                                {generatedItem.hookAr}
                              </h4>
                            </div>

                            <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 space-y-1">
                              <span className="text-[9px] text-slate-300 block">{generatedItem.coverHeadlineAr}</span>
                              <p className="text-xs text-white font-medium line-clamp-3">
                                {generatedItem.scriptAr}
                              </p>
                            </div>
                          </>
                        )}

                        {/* 2. If Carousel: Interactive Swipe Stepper */}
                        {generatedItem.format === 'carousel' && (
                          <div className="space-y-4 my-auto">
                            <div className="flex items-center justify-between text-[11px] text-slate-400">
                              <span>Carousel Slide</span>
                              <span className="font-mono font-bold text-white">
                                {activeSlideIndex + 1} / {(generatedItem.slidesAr?.length || 5)}
                              </span>
                            </div>

                            <div className="p-6 rounded-2xl bg-gradient-to-br from-blue-950/80 to-slate-900 border border-blue-500/30 min-h-[220px] flex flex-col justify-between shadow-lg">
                              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">
                                {activeSlideIndex === 0 ? 'COVER SLIDE' : `STEP 0${activeSlideIndex + 1}`}
                              </span>
                              <h4 className="text-sm sm:text-base font-black text-white leading-relaxed">
                                {generatedItem.slidesAr
                                  ? generatedItem.slidesAr[activeSlideIndex]
                                  : generatedItem.titleAr}
                              </h4>
                              <span className="text-[10px] text-slate-400">
                                Swipe left to continue ➔
                              </span>
                            </div>

                            {/* Stepper Buttons */}
                            <div className="flex items-center justify-center gap-3">
                              <button
                                disabled={activeSlideIndex === 0}
                                onClick={() => setActiveSlideIndex((prev) => Math.max(0, prev - 1))}
                                className="p-2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                              <div className="flex gap-1">
                                {(generatedItem.slidesAr || [1, 2, 3, 4, 5]).map((_, i) => (
                                  <div
                                    key={i}
                                    className={`w-2 h-2 rounded-full transition-all ${
                                      i === activeSlideIndex ? 'w-4 bg-blue-500' : 'bg-white/30'
                                    }`}
                                  />
                                ))}
                              </div>
                              <button
                                disabled={activeSlideIndex === (generatedItem.slidesAr?.length || 5) - 1}
                                onClick={() =>
                                  setActiveSlideIndex((prev) =>
                                    Math.min((generatedItem.slidesAr?.length || 5) - 1, prev + 1)
                                  )
                                }
                                className="p-2 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white"
                              >
                                <ChevronLeft className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )}

                        {/* 3. If Story: 24h Interactive Stickers */}
                        {generatedItem.format === 'story' && (
                          <div className="space-y-4 my-auto">
                            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                              <span className="text-[10px] font-bold text-amber-400 uppercase">Interactive Story</span>
                              <h4 className="text-sm font-black text-white">{generatedItem.coverHeadlineAr}</h4>
                            </div>

                            {/* Simulated Interactive Poll Sticker */}
                            <div className="p-3.5 rounded-2xl bg-white text-slate-900 shadow-xl space-y-2 text-center">
                              <span className="font-bold text-xs block">
                                {generatedItem.hookAr || 'أسنانك الأمامية تلتقي لو معلقة بالهواء؟'}
                              </span>
                              <div className="grid grid-cols-2 gap-2 text-xs font-black">
                                <span className="p-2 rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-300">
                                  نعم متطابقة 👍
                                </span>
                                <span className="p-2 rounded-xl bg-rose-100 text-rose-900 border border-rose-300">
                                  لا بيها عضة 🦷
                                </span>
                              </div>
                            </div>

                            {/* Simulated DM Link Sticker */}
                            <div className="p-2.5 rounded-xl bg-emerald-500 text-white font-bold text-xs text-center shadow-lg flex items-center justify-center gap-1.5">
                              <Send className="w-3.5 h-3.5" />
                              <span>راسلنا لحجز كشفية بزيونة ✉️</span>
                            </div>
                          </div>
                        )}

                        {/* 4. If Single Post: Feed Graphic Mockup */}
                        {generatedItem.format === 'post' && (
                          <div className="space-y-3 my-auto">
                            <div className="p-6 rounded-2xl bg-slate-800 border border-slate-700 min-h-[220px] flex flex-col justify-between">
                              <span className="text-[10px] font-bold text-teal-400 uppercase tracking-widest">
                                CLINICAL CASE REVEAL
                              </span>
                              <h4 className="text-base font-black text-white leading-snug">
                                {generatedItem.coverHeadlineAr}
                              </h4>
                              <p className="text-[11px] text-slate-300 line-clamp-3">
                                {generatedItem.visualDirectionAr}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Bottom Actions Row */}
                        <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-300">
                          <div className="flex items-center gap-3">
                            <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
                            <MessageCircle className="w-4 h-4 text-white" />
                            <Send className="w-4 h-4 text-white" />
                          </div>
                          <Bookmark className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 space-y-3">
              <Sparkles className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="font-bold text-slate-700 text-sm">
                {isAr ? 'بانتظار توليد المحتوى' : 'Omni-Studio Ready'}
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {isAr
                  ? 'اختر الصيغة (ريلز، بوست، كاروسيل، أو ستوري) واضغط زر التوليد لتشاهد السيناريو والمحاكي التفاعلي فوراً'
                  : 'Select any of the 4 formats and click generate to review scripts and live mobile simulation.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
