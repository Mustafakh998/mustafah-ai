import React, { useState } from 'react';
import {
  Users,
  Search,
  Filter,
  Download,
  CalendarCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  Phone,
  MessageSquare,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { AppState } from '@/lib/store';
import { Lead, LeadStatus, Language } from '@/types';

interface LeadsCrmViewProps {
  state: AppState;
  onUpdateStatus: (leadId: string, status: LeadStatus) => void;
  onNavigate: (tab: any) => void;
}

const COLUMNS: { id: LeadStatus; labelAr: string; labelEn: string; color: string }[] = [
  { id: 'new_inquiry', labelAr: 'استفسار جديد', labelEn: 'New Inquiries', color: 'border-slate-300 bg-slate-50' },
  { id: 'qualified', labelAr: 'مؤهل طبياً (Iraqi AI)', labelEn: 'Qualified Leads', color: 'border-blue-300 bg-blue-50/40' },
  { id: 'appointment_requested', labelAr: 'طلب موعد وتاريخ', labelEn: 'Booking Requested', color: 'border-amber-300 bg-amber-50/40' },
  { id: 'confirmed', labelAr: 'موعد مؤكد (الاستقبال)', labelEn: 'Confirmed', color: 'border-teal-300 bg-teal-50/40' },
  { id: 'attended', labelAr: 'حضر للعيادة (مكتمل)', labelEn: 'Attended Patients', color: 'border-emerald-400 bg-emerald-50/50' },
  { id: 'lost', labelAr: 'غير نشط / ملغي', labelEn: 'Lost / Inactive', color: 'border-rose-200 bg-rose-50/30' },
];

export const LeadsCrmView: React.FC<LeadsCrmViewProps> = ({
  state,
  onUpdateStatus,
  onNavigate,
}) => {
  const isAr = state.currentLanguage === 'ar';
  const { leads, analytics, selectedAccountId } = state;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const filteredLeads = leads.filter((l) => {
    if (selectedAccountId !== 'all' && l.accountId !== selectedAccountId) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return l.patientName.toLowerCase().includes(q) || l.instagramUsername.toLowerCase().includes(q);
    }
    return true;
  });

  const exportCsv = () => {
    const headers = ['ID', 'Name', 'Instagram', 'Phone', 'Treatment', 'Status', 'Inquiry Date', 'Value IQD'];
    const rows = filteredLeads.map((l) => [
      l.id,
      l.patientName,
      `@${l.instagramUsername}`,
      l.phone || '',
      l.treatmentNameAr,
      l.status,
      l.inquiryDate,
      l.estimatedValueIQD,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `almeswak_leads_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900">
            {isAr ? 'خط أنابيب المراجعين (Leads CRM & Pipeline)' : 'Leads CRM & Conversion Pipeline'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {isAr
              ? 'متابعة مسار تحويل كل مريض من رسالة إنستغرام الأولى وحتى الحضور الفعلي في زيونة'
              : 'End-to-end pipeline tracking from Instagram DM inquiry to clinic attendance in Baghdad.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute top-2.5 start-3" />
            <input
              type="text"
              placeholder={isAr ? 'بحث بالاسم أو المعرف...' : 'Search leads...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl ps-9 pe-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <button
            onClick={exportCsv}
            className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 border border-slate-300 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isAr ? 'تصدير CSV' : 'Export CSV'}</span>
          </button>
        </div>
      </div>

      {/* Metrics Attribution Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm text-center">
        <div>
          <div className="text-[11px] text-slate-500">{isAr ? 'نسبة التأهيل' : 'Inquiry to Qualified'}</div>
          <div className="text-lg font-black text-blue-700">
            {analytics.totalInquiries > 0
              ? Math.round((analytics.qualifiedLeads / analytics.totalInquiries) * 100)
              : 0}
            %
          </div>
        </div>
        <div>
          <div className="text-[11px] text-slate-500">{isAr ? 'المؤهلون إلى حجز' : 'Qualified to Booking'}</div>
          <div className="text-lg font-black text-amber-700">
            {analytics.qualifiedLeads > 0
              ? Math.round((analytics.appointmentRequests / analytics.qualifiedLeads) * 100)
              : 0}
            %
          </div>
        </div>
        <div>
          <div className="text-[11px] text-slate-500">{isAr ? 'نسبة الحضور الفعلي' : 'Booking to Attended'}</div>
          <div className="text-lg font-black text-emerald-700">
            {analytics.appointmentRequests > 0
              ? Math.round((analytics.attendedPatients / analytics.appointmentRequests) * 100)
              : 0}
            %
          </div>
        </div>
        <div>
          <div className="text-[11px] text-slate-500">{isAr ? 'كلفة المؤهل الواحد' : 'Cost / Qualified'}</div>
          <div className="text-lg font-black text-slate-900">${analytics.costPerQualifiedInquiryUSD}</div>
        </div>
        <div>
          <div className="text-[11px] text-slate-500">{isAr ? 'كلفة المريض الحاضر' : 'Cost / Attended'}</div>
          <div className="text-lg font-black text-emerald-700 font-mono">${analytics.costPerAttendedPatientUSD}</div>
        </div>
      </div>

      {/* Kanban Board Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const colLeads = filteredLeads.filter((l) => l.status === col.id);

          return (
            <div
              key={col.id}
              className={`rounded-2xl border ${col.color} p-3 flex flex-col min-h-[450px] shadow-sm`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200/80">
                <span className="font-bold text-xs text-slate-800">{isAr ? col.labelAr : col.labelEn}</span>
                <span className="text-[10px] bg-white font-bold px-1.5 py-0.5 rounded-full text-slate-700 border border-slate-200">
                  {colLeads.length}
                </span>
              </div>

              {/* Cards Container */}
              <div className="space-y-2 flex-1 overflow-y-auto">
                {colLeads.length === 0 ? (
                  <div className="h-full min-h-[80px] flex items-center justify-center text-center p-3 text-slate-400 border border-dashed border-slate-200/80 rounded-xl my-1">
                    <span className="text-[11px] font-medium text-slate-400">{isAr ? 'لا توجد سجلات' : 'No records'}</span>
                  </div>
                ) : (
                  colLeads.map((lead) => (
                  <div
                    key={lead.id}
                    onClick={() => setSelectedLead(lead)}
                    className="p-3 bg-white rounded-xl border border-slate-200/90 shadow-sm hover:shadow-md hover:border-emerald-400 transition-all cursor-pointer space-y-2 text-start"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900 truncate">{lead.patientName}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {lead.accountId === 'drmustafa_hadi' ? 'د. مصطفى' : 'العيادة'}
                      </span>
                    </div>

                    <div className="text-[11px] font-mono text-slate-500">@{lead.instagramUsername}</div>

                    <div className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded inline-block">
                      {lead.treatmentNameAr}
                    </div>

                    <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed bg-slate-50 p-1.5 rounded">
                      "{lead.lastMessageText}"
                    </p>

                    {lead.phone && (
                      <div className="text-[11px] font-mono font-bold text-slate-700 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-emerald-600" />
                        <span>{lead.phone}</span>
                      </div>
                    )}

                    {/* Quick Move Buttons */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                      <span>{new Date(lead.inquiryDate).toLocaleDateString()}</span>
                      <select
                        value={lead.status}
                        onChange={(e) => {
                          e.stopPropagation();
                          onUpdateStatus(lead.id, e.target.value as LeadStatus);
                        }}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-1.5 py-0.5 rounded border border-slate-300 text-[10px] cursor-pointer"
                      >
                        <option value="new_inquiry">{isAr ? 'استفسار جديد' : 'New'}</option>
                        <option value="qualified">{isAr ? 'مؤهل' : 'Qualified'}</option>
                        <option value="appointment_requested">{isAr ? 'طلب موعد' : 'Requested'}</option>
                        <option value="confirmed">{isAr ? 'مؤكد' : 'Confirmed'}</option>
                        <option value="attended">{isAr ? 'حضر للعيادة' : 'Attended'}</option>
                        <option value="lost">{isAr ? 'ملغي' : 'Lost'}</option>
                      </select>
                    </div>
                  </div>
                )))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Lead Details Modal */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-slate-900 text-base">{selectedLead.patientName}</h3>
                <span className="text-xs text-slate-400 font-mono">@{selectedLead.instagramUsername}</span>
              </div>
              <button
                onClick={() => setSelectedLead(null)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-400 block text-[10px]">{isAr ? 'العلاج المطلوب:' : 'Treatment:'}</span>
                <span className="font-bold text-slate-800">{selectedLead.treatmentNameAr}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-400 block text-[10px]">{isAr ? 'رقم الهاتف:' : 'Phone:'}</span>
                <span className="font-mono font-bold text-emerald-700">{selectedLead.phone || 'غير مسجل'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-400 block text-[10px]">{isAr ? 'مصدر الحملة:' : 'Source Campaign:'}</span>
                <span className="font-semibold text-slate-800">{selectedLead.campaignSource}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-400 block text-[10px]">{isAr ? 'القيمة المتوقعة:' : 'Estimated Value:'}</span>
                <span className="font-mono font-bold text-slate-900">
                  {selectedLead.estimatedValueIQD.toLocaleString()} د.ع
                </span>
              </div>
            </div>

            <div>
              <span className="text-xs font-bold text-slate-700 block mb-1">
                {isAr ? 'ملاحظات فريق الاستقبال والعيادة:' : 'Staff Notes:'}
              </span>
              <p className="p-3 bg-slate-50 rounded-xl text-xs text-slate-700 leading-relaxed border border-slate-200">
                {selectedLead.staffNotes}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {selectedLead.phone && (
                  <a
                    href={`https://wa.me/964${selectedLead.phone.replace(/^0/, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>{isAr ? 'واتساب' : 'WhatsApp'}</span>
                  </a>
                )}
                <button
                  onClick={() => {
                    setSelectedLead(null);
                    onNavigate('inbox');
                  }}
                  className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>{isAr ? 'فتح المحادثة' : 'Open Chat'}</span>
                </button>
              </div>

              <button
                onClick={() => setSelectedLead(null)}
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

