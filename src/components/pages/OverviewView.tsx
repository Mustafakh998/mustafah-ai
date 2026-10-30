import React from 'react';
import {
  Users,
  CalendarCheck,
  CheckCircle2,
  TrendingUp,
  DollarSign,
  MessageSquare,
  Eye,
  Clock,
  Bookmark,
  Share2,
  Heart,
  ArrowUpRight,
  Phone,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { AppState, useAppStore } from '@/lib/store';
import { Language, NavTabId } from '@/types';

interface OverviewViewProps {
  state: AppState;
  onNavigate: (tab: NavTabId) => void;
  onOpenSimulateModal: () => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  state,
  onNavigate,
  onOpenSimulateModal,
}) => {
  const isAr = state.currentLanguage === 'ar';
  const { analytics, leads, appointments, accounts } = state;

  // Filter based on active account selection if needed
  const personalAcc = accounts.find((a) => a.id === 'drmustafa_hadi');
  const clinicAcc = accounts.find((a) => a.id === 'almeswaksmile_iq');

  // Conversion calculations
  const inquiryToQualifiedRate =
    analytics.totalInquiries > 0
      ? Math.round((analytics.qualifiedLeads / analytics.totalInquiries) * 100)
      : 0;
  const qualifiedToBookingRate =
    analytics.qualifiedLeads > 0
      ? Math.round((analytics.appointmentRequests / analytics.qualifiedLeads) * 100)
      : 0;
  const bookingToAttendedRate =
    analytics.appointmentRequests > 0
      ? Math.round((analytics.attendedPatients / analytics.appointmentRequests) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Top Banner / Hero */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-emerald-500/20 text-emerald-300 text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                {isAr ? 'عيادة المسواك — فرع زيونة، بغداد' : 'Almeswak Clinic — Zayouna, Baghdad'}
              </span>
              <span className="bg-slate-700/60 text-slate-300 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                {isAr ? 'ميزانية الإعلانات: < $100 شهرياً' : 'Ad Budget: < $100/mo'}
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight">
              {isAr
                ? 'منظومة تحويل استفسارات إنستغرام إلى مراجعين حقيقيين'
                : 'Instagram Inquiries to Attended Patient Conversion Engine'}
            </h1>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl leading-relaxed">
              {isAr
                ? 'نظام يركز على النتائج الفعلية: استفسارات مؤهلة، مواعيد مؤكدة، وتكلفة استحواذ مدروسة بالدينار والدولار — بدون الهوس بالمقاييس الوهمية.'
                : 'Optimized for actual clinic outcomes: qualified leads, confirmed bookings, and low acquisition cost — zero vanity metrics.'}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={onOpenSimulateModal}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-lg shadow-emerald-900/40 flex items-center gap-2 active:scale-95"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isAr ? 'تجربة محادثة باللهجة العراقية' : 'Test Iraqi AI DM'}</span>
            </button>
            <button
              onClick={() => onNavigate('inbox')}
              className="bg-slate-800/80 hover:bg-slate-700 text-white font-semibold px-4 py-2.5 rounded-xl text-xs transition-all border border-slate-700 flex items-center gap-2"
            >
              <MessageSquare className="w-4 h-4 text-emerald-400" />
              <span>{isAr ? 'صندوق الرسائل' : 'Live Inbox'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Primary Business KPIs (The Conversion Metrics that Matter) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
            {isAr ? 'المؤشرات الأساسية لتحويل المرضى (Primary KPIs)' : 'Primary Patient Conversion KPIs'}
          </h2>
          <span className="text-xs text-slate-500 font-medium">
            {isAr ? 'تحديث فوري مرتبط بحسابات إنستغرام' : 'Real-time Instagram Sync'}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* Card 1: Total Inquiries */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
              <span>{isAr ? 'إجمالي الاستفسارات' : 'Inquiries (DMs)'}</span>
              <MessageSquare className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-black text-slate-900">{analytics.totalInquiries}</div>
            <div className="text-[11px] text-emerald-600 font-semibold mt-1">
              +14% {isAr ? 'هذا الأسبوع' : 'this week'}
            </div>
          </div>

          {/* Card 2: Qualified Leads */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
              <span>{isAr ? 'استفسارات مؤهلة' : 'Qualified Leads'}</span>
              <Users className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-2xl font-black text-slate-900">{analytics.qualifiedLeads}</div>
            <div className="text-[11px] text-slate-500 mt-1">
              {inquiryToQualifiedRate}% {isAr ? 'نسبة التأهيل' : 'qualify rate'}
            </div>
          </div>

          {/* Card 3: Appointment Requests */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
              <span>{isAr ? 'طلبات الحجز' : 'Booking Requests'}</span>
              <CalendarCheck className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-black text-slate-900">{analytics.appointmentRequests}</div>
            <div className="text-[11px] text-slate-500 mt-1">
              {qualifiedToBookingRate}% {isAr ? 'من المؤهلين' : 'of qualified'}
            </div>
          </div>

          {/* Card 4: Confirmed Appointments */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
              <span>{isAr ? 'مواعيد مؤكدة' : 'Confirmed'}</span>
              <CheckCircle2 className="w-4 h-4 text-teal-600" />
            </div>
            <div className="text-2xl font-black text-slate-900">{analytics.confirmedAppointments}</div>
            <div className="text-[11px] text-teal-600 font-semibold mt-1">
              {isAr ? 'تأكيد الاستقبال' : 'Reception verified'}
            </div>
          </div>

          {/* Card 5: Attended Patients */}
          <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between text-emerald-800 text-xs mb-2 font-bold">
              <span>{isAr ? 'مراجعون حضروا للعيادة' : 'Attended Patients'}</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-950">{analytics.attendedPatients}</div>
            <div className="text-[11px] text-emerald-700 font-semibold mt-1">
              {bookingToAttendedRate}% {isAr ? 'نسبة الحضور' : 'show-up rate'}
            </div>
          </div>

          {/* Card 6: Cost Per Attended Patient */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
              <span>{isAr ? 'كلفة المريض الحاضر' : 'Cost / Attended'}</span>
              <DollarSign className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-slate-900">
              ${analytics.costPerAttendedPatientUSD}
            </div>
            <div className="text-[11px] text-emerald-600 font-semibold mt-1">
              {isAr ? 'استحواذ استثنائي' : 'Exceptional CAC'}
            </div>
          </div>
        </div>
      </div>

      {/* Patient Conversion Funnel Visualizer */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center justify-between">
          <span>{isAr ? 'مراحل قمع تحويل المرضى (Conversion Pipeline)' : 'Patient Conversion Pipeline'}</span>
          <span className="text-xs font-normal text-slate-500">
            {isAr ? 'من أول رسالة دايركت حتى الجلوس على كرسي العيادة' : 'From DM to Dental Chair'}
          </span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="text-xs font-semibold text-slate-500">{isAr ? '1. استفسار أولي' : '1. Inbound Inquiries'}</div>
            <div className="text-xl font-bold text-slate-800 mt-1">{analytics.totalInquiries}</div>
            <p className="text-xs text-slate-500 mt-2">
              {isAr ? 'رسائل عبر الإنستغرام أو تعليقات تحولت لرسائل' : 'Inbound DMs & comment leads'}
            </p>
          </div>

          <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-200">
            <div className="text-xs font-semibold text-blue-700">{isAr ? '2. مريض مؤهل بالعراقية' : '2. Qualified (Iraqi AI)'}</div>
            <div className="text-xl font-bold text-blue-950 mt-1">{analytics.qualifiedLeads}</div>
            <div className="text-xs text-blue-600 mt-2 font-medium">
              {inquiryToQualifiedRate}% {isAr ? 'تحويل الاستفسار' : 'qualification rate'}
            </div>
          </div>

          <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200">
            <div className="text-xs font-semibold text-amber-700">{isAr ? '3. طلب موعد وتاريخ' : '3. Appointment Requested'}</div>
            <div className="text-xl font-bold text-amber-950 mt-1">{analytics.appointmentRequests}</div>
            <div className="text-xs text-amber-600 mt-2 font-medium">
              {qualifiedToBookingRate}% {isAr ? 'طلبوا موعداً' : 'requested booking'}
            </div>
          </div>

          <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-300">
            <div className="text-xs font-semibold text-emerald-800">{isAr ? '4. حضور فعلي للعيادة' : '4. Attended Appointment'}</div>
            <div className="text-xl font-bold text-emerald-950 mt-1">{analytics.attendedPatients}</div>
            <div className="text-xs text-emerald-700 mt-2 font-bold">
              {bookingToAttendedRate}% {isAr ? 'التزموا بالحضور' : 'attendance rate'}
            </div>
          </div>
        </div>
      </div>

      {/* Secondary KPIs: Engagement & Media Growth */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
            {isAr ? 'المقاييس الثانوية للمحتوى والريلز (Secondary KPIs)' : 'Secondary Content & Reach KPIs'}
          </h2>
          <span className="text-xs text-slate-500">
            {isAr ? 'بيانات ريلز د. مصطفى والعيادة' : 'Reels Watch Time & Engagement'}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>{isAr ? 'مشاهدات الريلز' : 'Reel Views'}</span>
              <Eye className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <div className="text-xl font-bold text-slate-800">{analytics.totalReelViews.toLocaleString()}</div>
            <div className="text-[11px] text-slate-500 mt-1">{isAr ? 'يتضمن ريل 106K' : 'Includes 106K viral'}</div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>{isAr ? 'متوسط وقت المشاهدة' : 'Avg Watch Time'}</span>
              <Clock className="w-3.5 h-3.5 text-indigo-500" />
            </div>
            <div className="text-xl font-bold text-slate-800">{analytics.avgWatchTimeSeconds}s</div>
            <div className="text-[11px] text-emerald-600 font-semibold mt-1">{isAr ? 'احتفاظ عالي' : 'High retention'}</div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>{isAr ? 'حفظ الفيديو (Saves)' : 'Saves'}</span>
              <Bookmark className="w-3.5 h-3.5 text-amber-500" />
            </div>
            <div className="text-xl font-bold text-slate-800">{analytics.savesCount.toLocaleString()}</div>
            <div className="text-[11px] text-slate-500 mt-1">{isAr ? 'مؤشر رغبة علاج' : 'High intent indicator'}</div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>{isAr ? 'المشاركات (Sends/Reach)' : 'Sends / Reach'}</span>
              <Share2 className="w-3.5 h-3.5 text-teal-500" />
            </div>
            <div className="text-xl font-bold text-slate-800">{analytics.sendsPerReachPercent}%</div>
            <div className="text-[11px] text-slate-500 mt-1">{isAr ? 'إحالات أهل وأصدقاء' : 'Word-of-mouth'}</div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>{isAr ? 'زيارات البروفايل' : 'Profile Visits'}</span>
              <Users className="w-3.5 h-3.5 text-purple-500" />
            </div>
            <div className="text-xl font-bold text-slate-800">{analytics.profileVisits.toLocaleString()}</div>
            <div className="text-[11px] text-slate-500 mt-1">{isAr ? 'من بغداد والمناطق' : 'Baghdad locals'}</div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>{isAr ? 'نمو المتابعين' : 'Follower Growth'}</span>
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="text-xl font-bold text-slate-800">+{analytics.followerGrowth}</div>
            <div className="text-[11px] text-emerald-600 font-semibold mt-1">{isAr ? 'متابعون مهتمون' : 'Organic targeted'}</div>
          </div>
        </div>
      </div>

      {/* Two Column Section: Actionable Queue & Quick Navigation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Appointment Requests Awaiting Confirmation */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                {isAr ? 'طلبات المواعيد بانتظار تأكيد الاستقبال' : 'Pending Appointment Confirmations'}
              </h3>
              <p className="text-xs text-slate-500">
                {isAr ? 'مواعيد واردة من رسائل إنستغرام تحتاج اتصال تأكيدي' : 'Incoming patient booking requests from DMs'}
              </p>
            </div>
            <button
              onClick={() => onNavigate('appointments')}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1"
            >
              <span>{isAr ? 'عرض الكل' : 'View All'}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {appointments.slice(0, 3).map((apt) => (
              <div
                key={apt.id}
                className="p-3.5 rounded-xl border border-slate-200/90 hover:border-emerald-300 hover:bg-emerald-50/30 transition-all flex items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{apt.patientName}</span>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                        apt.status === 'confirmed'
                          ? 'bg-teal-100 text-teal-800'
                          : apt.status === 'attended'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {isAr
                        ? apt.status === 'confirmed'
                          ? 'مؤكد'
                          : apt.status === 'attended'
                          ? 'حضر للعيادة'
                          : 'طلب جديد'
                        : apt.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                    <span>{apt.treatmentNameAr}</span>
                    <span>•</span>
                    <span>{apt.preferredDate} ({apt.preferredTime})</span>
                    <span>•</span>
                    <span className="font-mono">{apt.phone}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={`https://wa.me/964${apt.phone.replace(/^0/, '')}?text=${encodeURIComponent(
                      `أهلاً وسهلاً بحضرتك ${apt.patientName} من عيادة المسواك في زيونة بخصوص موعدك ليوم ${apt.preferredDate}`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold flex items-center gap-1 transition-colors"
                    title={isAr ? 'مراسلة عبر واتساب' : 'WhatsApp'}
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{isAr ? 'واتساب' : 'WhatsApp'}</span>
                  </a>
                  <button
                    onClick={() => onNavigate('appointments')}
                    className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                  >
                    {isAr ? 'إدارة' : 'Manage'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Account Access Diagnostic Card */}
        <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                {isAr ? 'حالة حسابات إنستغرام' : 'Instagram Status'}
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>

            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-100">@drmustafa_hadi</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-bold border border-emerald-500/40">
                    {isAr ? 'نشط (مربوط)' : 'Active'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {isAr ? 'حساب المطور الشخصي جاهز للرسائل والريلز' : 'Personal developer brand live'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-100">@almeswaksmile.iq</span>
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-bold border border-amber-500/40">
                    {isAr ? 'وضع تجريبي' : 'Sandbox Mode'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {isAr ? 'يعمل بالمحاكاة بانتظار تصريح إدارة العيادة' : 'Demo sandbox until admin OAuth'}
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 mt-4">
            <button
              onClick={() => onNavigate('accounts')}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <span>{isAr ? 'إدارة تصاريح الربط والتوكن' : 'Manage Meta OAuth & Tokens'}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
