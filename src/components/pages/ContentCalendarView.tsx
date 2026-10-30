import React, { useState } from 'react';
import {
  Calendar as CalendarIcon,
  Filter,
  CheckCircle2,
  Clock,
  Sparkles,
  Film,
  Layers,
  ArrowRight,
  Eye,
} from 'lucide-react';
import { AppState } from '@/lib/store';
import { ContentItem, Language, AccountId } from '@/types';

interface ContentCalendarViewProps {
  state: AppState;
  onUpdateStatus: (itemId: string, status: ContentItem['status']) => void;
  onNavigate: (tab: any) => void;
}

export const ContentCalendarView: React.FC<ContentCalendarViewProps> = ({
  state,
  onUpdateStatus,
  onNavigate,
}) => {
  const isAr = state.currentLanguage === 'ar';
  const { contentItems, selectedAccountId } = state;

  const [filterStatus, setFilterStatus] = useState<'all' | ContentItem['status']>('all');
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);

  const filteredItems = contentItems.filter((item) => {
    if (selectedAccountId !== 'all' && item.accountId !== selectedAccountId) return false;
    if (filterStatus !== 'all' && item.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900">
            {isAr ? 'تقويم النشر وجدولة الريلز (30 يوم)' : '30-Day Publishing & Review Calendar'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {isAr
              ? 'الوتيرة المعتمدة: 3 ريلز أسبوعياً + 1 كاروسيل أسبوعياً + ستوريات تفاعلية 5 أيام أسبوعياً — مع مراجعة بشرية قبل النشر'
              : 'Recommended cadence: 3 Reels weekly + 1 Carousel weekly + Daily stories with mandatory human review.'}
          </p>
        </div>

        <button
          onClick={() => onNavigate('content_studio')}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all"
        >
          <Sparkles className="w-4 h-4" />
          <span>{isAr ? 'توليد محتوى جديد للاستوديو' : 'Create New Content'}</span>
        </button>
      </div>

      {/* Recommended Cadence Strip */}
      <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-600 text-white">
            <Film className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-emerald-950">
              {isAr ? 'وتيرة النشر الاستراتيجية لخوارزمية إنستغرام 2026' : 'Strategic Instagram Publishing Cadence'}
            </div>
            <div className="text-emerald-800 text-[11px]">
              {isAr
                ? '3 ريلز/أسبوع (أحد، ثلاثاء، خميس) • 1 كاروسيل/أسبوع (سبت) • ستوريات تفاعلية واستبيانات يومياً'
                : '3 Reels weekly + 1 Carousel + Stories 5+ days with polls & question stickers'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(['all', 'draft', 'review_needed', 'approved', 'published'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                filterStatus === st
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {st === 'all'
                ? isAr
                  ? 'الكل'
                  : 'All'
                : st === 'draft'
                ? isAr
                  ? 'مسودة'
                  : 'Draft'
                : st === 'review_needed'
                ? isAr
                  ? 'بانتظار المراجعة'
                  : 'Review Needed'
                : st === 'approved'
                ? isAr
                  ? 'معتمد'
                  : 'Approved'
                : isAr
                ? 'منشور'
                : 'Published'}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            onClick={() => setSelectedItem(item)}
            className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-400 transition-all cursor-pointer space-y-3 text-start"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-slate-500 font-semibold">{item.scheduledDate}</span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  item.status === 'published'
                    ? 'bg-blue-100 text-blue-800'
                    : item.status === 'approved'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {item.status === 'published'
                  ? isAr
                    ? 'تم النشر'
                    : 'Published'
                  : item.status === 'approved'
                  ? isAr
                    ? 'معتمد للنشر'
                    : 'Approved'
                  : isAr
                  ? 'بانتظار المراجعة'
                  : 'Needs Review'}
              </span>
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[10px] bg-slate-100 font-bold px-2 py-0.5 rounded text-slate-700">
                  {item.seriesNameAr}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {item.accountId === 'drmustafa_hadi' ? '@drmustafa_hadi' : '@almeswaksmile.iq'}
                </span>
              </div>
              <h4 className="font-bold text-slate-900 text-sm line-clamp-1">{item.titleAr}</h4>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600 space-y-1">
              <div className="font-bold text-slate-800 text-[11px]">{isAr ? 'الهوك (أول 3 ثوانٍ):' : 'Hook:'}</div>
              <p className="line-clamp-2 italic">"{item.hookAr}"</p>
            </div>

            {/* If published, show actual metrics */}
            {item.views ? (
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">{isAr ? 'المشاهدات' : 'Views'}</span>
                  <span className="font-bold text-slate-800">{item.views.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">{isAr ? 'التفاعل' : 'Likes'}</span>
                  <span className="font-bold text-emerald-700">{item.likes}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">{isAr ? 'استفسارات DM' : 'DMs'}</span>
                  <span className="font-bold text-blue-700">+{item.inquiriesGenerated}</span>
                </div>
              </div>
            ) : (
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-400 text-[11px]">{isAr ? 'اضغط للمراجعة والاعتماد' : 'Click to review'}</span>
                <span className="text-emerald-600 font-bold text-xs flex items-center gap-1">
                  <span>{isAr ? 'عرض' : 'View'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Review Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 border border-slate-200 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <span className="text-xs font-bold text-emerald-700">{selectedItem.seriesNameAr}</span>
                <h3 className="font-bold text-slate-900 text-base">{selectedItem.titleAr}</h3>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed">
              <div className="p-3 bg-slate-900 text-white rounded-xl">
                <span className="text-emerald-400 font-bold text-[10px] block mb-1">
                  {isAr ? 'عنوان الغلاف:' : 'Cover Headline:'}
                </span>
                <span className="font-bold text-sm">{selectedItem.coverHeadlineAr}</span>
              </div>

              <div>
                <span className="font-bold text-slate-800 block mb-1">{isAr ? 'السيناريو العراقي الكامل:' : 'Full Script:'}</span>
                <p className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 whitespace-pre-wrap font-sans">
                  {selectedItem.scriptAr}
                </p>
              </div>

              <div>
                <span className="font-bold text-slate-800 block mb-1">{isAr ? 'التوجيه البصري:' : 'Visual Direction:'}</span>
                <p className="p-3 bg-blue-50/70 rounded-xl border border-blue-200 text-blue-950">
                  {selectedItem.visualDirectionAr}
                </p>
              </div>

              <div>
                <span className="font-bold text-slate-800 block mb-1">{isAr ? 'الكابشن والهاشتاغات:' : 'Caption:'}</span>
                <p className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 whitespace-pre-wrap font-sans">
                  {selectedItem.captionAr}
                </p>
              </div>
            </div>

            {/* Approval Controls */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    onUpdateStatus(selectedItem.id, 'approved');
                    setSelectedItem(null);
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isAr ? 'اعتماد للنشر (Human Approved)' : 'Approve for Publishing'}</span>
                </button>
              </div>

              <button
                onClick={() => setSelectedItem(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs"
              >
                {isAr ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
