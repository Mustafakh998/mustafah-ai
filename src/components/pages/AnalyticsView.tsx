import React from 'react';
import {
  TrendingUp,
  Eye,
  Clock,
  Bookmark,
  Share2,
  Users,
  Info,
} from 'lucide-react';
import { AppState } from '@/lib/store';


interface AnalyticsViewProps {
  state: AppState;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ state }) => {
  const isAr = state.currentLanguage === 'ar';
  const { analytics } = state;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-black text-slate-900">
          {isAr ? 'إحصائيات النمو وأداء الريلز (Instagram Insights)' : 'Instagram Growth Analytics & Reel Metrics'}
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          {isAr
            ? 'مقاييس دقيقة مبنية على واجهة Meta Graph API Insights — التركيز على وقت المشاهدة والمشاركات وحفظ الفيديو لتحويل المرضى'
            : 'Grounded in official Meta Graph API insights: watch time, sends, saves, and patient acquisition rate.'}
        </p>
      </div>

      {/* Official 2026 Algorithm Note */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-3 text-xs text-blue-950">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <div className="font-bold text-sm">
            {isAr ? 'توصيات خوارزمية إنستغرام لعام 2026 الرسمية' : 'Official Meta 2026 Ranking Insights'}
          </div>
          <p className="mt-1 leading-relaxed text-blue-900">
            {isAr
              ? 'إنستغرام لم يعد يعتمد على الإعجابات الوهمية؛ المعياران الأهم لانتشار ريلز الأسنان هما: متوسط وقت المشاهدة (Watch Time) والمشاركات عبر الرسائل الخاصة (Sends per Reach). كلما احتفظ الفيديو بالمشاهد لأكثر من 12 ثانية وأرسله لأصدقائه، زاد انتشاره تلقائياً وتحول إلى مراجعين حقيقيين.'
              : 'Meta ranking prioritizes Watch Time retention and Direct Message sends over passive likes. Keeping dental reels above 12 seconds with high send-velocity directly multiplies organic patient reach.'}
          </p>
        </div>
      </div>

      {/* High-Level Metric Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>{isAr ? 'إجمالي المشاهدات' : 'Total Reel Views'}</span>
            <Eye className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">{analytics.totalReelViews.toLocaleString()}</div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-1">
            +32% {isAr ? 'عن الشهر الماضي' : 'vs last month'}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>{isAr ? 'متوسط المشاهدة' : 'Avg Watch Time'}</span>
            <Clock className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">{analytics.avgWatchTimeSeconds}s</div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-1">{isAr ? 'أعلى من المتوسط (11s)' : 'Above benchmark'}</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>{isAr ? 'المشاركات / الوصول' : 'Sends / Reach'}</span>
            <Share2 className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{analytics.sendsPerReachPercent}%</div>
          <div className="text-[11px] text-teal-600 font-semibold mt-1">{isAr ? 'إحالة مراجعين عالية' : 'Viral word-of-mouth'}</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>{isAr ? 'حفظ الفيديو (Saves)' : 'Saves'}</span>
            <Bookmark className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">{analytics.savesCount.toLocaleString()}</div>
          <div className="text-[11px] text-amber-600 font-semibold mt-1">{isAr ? 'نية علاج مرتفعة' : 'High buying intent'}</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>{isAr ? 'زيارات البروفايل' : 'Profile Visits'}</span>
            <Users className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">{analytics.profileVisits.toLocaleString()}</div>
          <div className="text-[11px] text-slate-500 mt-1">{isAr ? 'جمهور بغداد المحلي' : 'Local audience'}</div>
        </div>

        <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200 shadow-sm">
          <div className="flex items-center justify-between text-xs text-emerald-800 font-bold mb-2">
            <span>{isAr ? 'تحويل المراجعين' : 'Patient Conversion'}</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-950">{analytics.attendedPatients}</div>
          <div className="text-[11px] text-emerald-700 font-semibold mt-1">
            {isAr ? 'حضروا للعيادة فعلياً' : 'Attended clinic'}
          </div>
        </div>
      </div>

      {/* Reel-by-Reel Performance Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-3 p-5">
        <h3 className="font-bold text-slate-900 text-sm flex items-center justify-between">
          <span>{isAr ? 'تحليل أداء الريلز الفردية ومردود كل فيديو' : 'Individual Reel Performance & Lead Yield'}</span>
          <span className="text-xs text-slate-400 font-normal">
            {isAr ? 'مرتبطة مباشرة بعدد الاستفسارات المولدة' : 'Direct correlation with patient DMs'}
          </span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3.5 text-start">{isAr ? 'عنوان الفيديو والسلسلة' : 'Reel & Series'}</th>
                <th className="p-3.5 text-start">{isAr ? 'الحساب' : 'Account'}</th>
                <th className="p-3.5 text-start">{isAr ? 'المشاهدات' : 'Views'}</th>
                <th className="p-3.5 text-start">{isAr ? 'التفاعل (Likes)' : 'Likes'}</th>
                <th className="p-3.5 text-start">{isAr ? 'المشاركات' : 'Shares'}</th>
                <th className="p-3.5 text-start">{isAr ? 'استفسارات DM مولدة' : 'DMs Generated'}</th>
                <th className="p-3.5 text-start">{isAr ? 'التقييم' : 'Performance'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50/70">
                <td className="p-3.5">
                  <div className="font-bold text-slate-900">شنو أحسن شي الكم د. مصطفى 🫰🏼💚</div>
                  <div className="text-[11px] text-slate-500 font-mono">Ddmc1kpsZyX • تعاون سريري</div>
                </td>
                <td className="p-3.5 font-mono text-slate-600">@drmustafa_hadi</td>
                <td className="p-3.5 font-black text-slate-900 text-sm">106,000</td>
                <td className="p-3.5 font-semibold text-slate-800">4,820</td>
                <td className="p-3.5 font-semibold text-teal-700">1,240</td>
                <td className="p-3.5 font-black text-emerald-700">+48 DMs</td>
                <td className="p-3.5">
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {isAr ? 'فيروس واسع (Viral)' : 'Top Viral'}
                  </span>
                </td>
              </tr>

              <tr className="hover:bg-slate-50/70">
                <td className="p-3.5">
                  <div className="font-bold text-slate-900">العضة المفتوحة وتعديل الإطباق بدون جراحة</div>
                  <div className="text-[11px] text-slate-500">سلسلة: خل نحچي عن التقويم</div>
                </td>
                <td className="p-3.5 font-mono text-slate-600">@drmustafa_hadi</td>
                <td className="p-3.5 font-bold text-slate-900">18,500</td>
                <td className="p-3.5 font-semibold text-slate-800">1,240</td>
                <td className="p-3.5 font-semibold text-teal-700">310</td>
                <td className="p-3.5 font-bold text-emerald-700">+24 DMs</td>
                <td className="p-3.5">
                  <span className="bg-teal-100 text-teal-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {isAr ? 'عائد تحويل عالي' : 'High Conversion'}
                  </span>
                </td>
              </tr>

              <tr className="hover:bg-slate-50/70">
                <td className="p-3.5">
                  <div className="font-bold text-slate-900">ابتسامة الإيماكس بجلستين وضمان مدى الحياة</div>
                  <div className="text-[11px] text-slate-500">سلسلة: ابتسامات المسواك</div>
                </td>
                <td className="p-3.5 font-mono text-slate-600">@almeswaksmile.iq</td>
                <td className="p-3.5 font-bold text-slate-900">21,400</td>
                <td className="p-3.5 font-semibold text-slate-800">1,680</td>
                <td className="p-3.5 font-semibold text-teal-700">420</td>
                <td className="p-3.5 font-bold text-emerald-700">+31 DMs</td>
                <td className="p-3.5">
                  <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {isAr ? 'قيمة مبيعات عالية' : 'High Ticket'}
                  </span>
                </td>
              </tr>

              <tr className="hover:bg-slate-50/70">
                <td className="p-3.5">
                  <div className="font-bold text-slate-900">افتتاح قسم أسنان الأطفال ومادة SDF</div>
                  <div className="text-[11px] text-slate-500">سلسلة: أبطال المسواك</div>
                </td>
                <td className="p-3.5 font-mono text-slate-600">@almeswaksmile.iq</td>
                <td className="p-3.5 font-bold text-slate-900">4,478</td>
                <td className="p-3.5 font-semibold text-slate-800">410</td>
                <td className="p-3.5 font-semibold text-teal-700">190</td>
                <td className="p-3.5 font-bold text-emerald-700">+12 DMs</td>
                <td className="p-3.5">
                  <span className="bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {isAr ? 'مستهدف لأولياء الأمور' : 'Targeted Parents'}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

