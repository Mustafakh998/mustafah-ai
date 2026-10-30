import React, { useState } from 'react';
import {
  CalendarCheck,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  UserX,
  Phone,
  MessageCircle,
  Calendar,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { AppState } from '@/lib/store';
import { Appointment, AppointmentStatus, Language, TreatmentType } from '@/types';

interface AppointmentsViewProps {
  state: AppState;
  onUpdateStatus: (appointmentId: string, status: AppointmentStatus) => void;
  onCreateAppointment: (apt: any) => void;
}

export const AppointmentsView: React.FC<AppointmentsViewProps> = ({
  state,
  onUpdateStatus,
  onCreateAppointment,
}) => {
  const isAr = state.currentLanguage === 'ar';
  const { appointments, selectedAccountId } = state;

  const [statusFilter, setStatusFilter] = useState<'all' | AppointmentStatus>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New appointment form state
  const [patientName, setPatientName] = useState('');
  const [phone, setPhone] = useState('');
  const [treatment, setTreatment] = useState<TreatmentType>('orthodontics');
  const [preferredDate, setPreferredDate] = useState(new Date().toISOString().split('T')[0]);
  const [preferredTime, setPreferredTime] = useState('05:00 PM');
  const [doctor, setDoctor] = useState('Dr. Mustafa Hadi');
  const [notes, setNotes] = useState('');

  const filteredAppointments = appointments.filter((a) => {
    if (selectedAccountId !== 'all' && a.accountId !== selectedAccountId) return false;
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    return true;
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName.trim() || !phone.trim()) return;

    onCreateAppointment({
      leadId: `manual_lead_${Date.now()}`,
      patientName,
      phone,
      accountId: selectedAccountId === 'almeswaksmile_iq' ? 'almeswaksmile_iq' : 'drmustafa_hadi',
      treatment,
      treatmentNameAr: treatment === 'orthodontics' ? 'تقويم أسنان' : treatment === 'cosmetic_emax' ? 'ابتسامة إيماكس' : 'طب أسنان',
      preferredDate,
      preferredTime,
      assignedDoctor: doctor,
      assignedDoctorAr: doctor === 'Dr. Mustafa Hadi' ? 'د. مصطفى هادي' : 'فريق العيادة',
      status: 'confirmed',
      receptionNotes: notes || 'تم الحجز يدوياً بواسطة مكتب الاستقبال',
    });

    setIsAddModalOpen(false);
    setPatientName('');
    setPhone('');
    setNotes('');
  };

  const getStatusBadge = (status: AppointmentStatus) => {
    switch (status) {
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800">
            <CheckCircle2 className="w-3 h-3" />
            {isAr ? 'موعد مؤكد' : 'Confirmed'}
          </span>
        );
      case 'attended':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3 h-3" />
            {isAr ? 'حضر للعيادة' : 'Attended'}
          </span>
        );
      case 'awaiting_confirmation':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
            <Clock className="w-3 h-3" />
            {isAr ? 'بانتظار التأكيد' : 'Awaiting Call'}
          </span>
        );
      case 'no_show':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
            <UserX className="w-3 h-3" />
            {isAr ? 'لم يحضر (No-show)' : 'No-show'}
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
            {isAr ? 'ملغي' : 'Cancelled'}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
            <Clock className="w-3 h-3" />
            {isAr ? 'طلب حجز جديد' : 'New Request'}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900">
            {isAr ? 'جدول المواعيد وتأكيدات الاستقبال' : 'Appointments & Reception Confirmation'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {isAr
              ? 'تأكيد المواعيد المحجوزة عبر إنستغرام يدوياً وإرسال تذكيرات الحضور عبر الواتساب'
              : 'Manual availability confirmation and WhatsApp reminder generator for DM inquiries.'}
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>{isAr ? 'إضافة موعد كشفية جديد' : 'New Appointment'}</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto text-xs font-semibold pb-1">
        {(['all', 'new_request', 'awaiting_confirmation', 'confirmed', 'attended', 'no_show'] as const).map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 rounded-xl border transition-all shrink-0 ${
              statusFilter === st
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {st === 'all'
              ? isAr
                ? 'كل المواعيد'
                : 'All'
              : st === 'new_request'
              ? isAr
                ? 'طلبات جديدة'
                : 'New Requests'
              : st === 'awaiting_confirmation'
              ? isAr
                ? 'بانتظار الاتصال'
                : 'Awaiting'
              : st === 'confirmed'
              ? isAr
                ? 'مؤكدة'
                : 'Confirmed'
              : st === 'attended'
              ? isAr
                ? 'حضروا للعيادة'
                : 'Attended'
              : isAr
              ? 'لم يحضر'
              : 'No-show'}
          </button>
        ))}
      </div>

      {/* Appointments Table / Cards */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-4 text-start">{isAr ? 'المراجع' : 'Patient'}</th>
                <th className="p-4 text-start">{isAr ? 'العلاج المطلوب' : 'Treatment'}</th>
                <th className="p-4 text-start">{isAr ? 'التاريخ والوقت' : 'Date & Time'}</th>
                <th className="p-4 text-start">{isAr ? 'الطبيب' : 'Doctor'}</th>
                <th className="p-4 text-start">{isAr ? 'الحالة' : 'Status'}</th>
                <th className="p-4 text-start">{isAr ? 'إجراءات الاستقبال' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAppointments.map((apt) => (
                <tr key={apt.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="p-4">
                    <div className="font-bold text-slate-900 text-sm">{apt.patientName}</div>
                    <div className="text-[11px] font-mono text-emerald-700 font-semibold mt-0.5">
                      {apt.phone}
                    </div>
                  </td>

                  <td className="p-4">
                    <div className="font-semibold text-slate-800">{apt.treatmentNameAr}</div>
                    <div className="text-[11px] text-slate-400">
                      {apt.accountId === 'drmustafa_hadi' ? '@drmustafa_hadi' : '@almeswaksmile.iq'}
                    </div>
                  </td>

                  <td className="p-4">
                    <div className="font-bold text-slate-900">{apt.preferredDate}</div>
                    <div className="text-[11px] text-slate-500">{apt.preferredTime}</div>
                  </td>

                  <td className="p-4">
                    <div className="font-medium text-slate-700">{apt.assignedDoctorAr}</div>
                  </td>

                  <td className="p-4">{getStatusBadge(apt.status)}</td>

                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      {/* WhatsApp Reminder Button */}
                      <a
                        href={`https://wa.me/964${apt.phone.replace(/^0/, '')}?text=${encodeURIComponent(
                          `أهلاً وسهلاً بحضرتك ${apt.patientName} 💚 نود تذكيرك بموعد كشفية الأسنان في عيادة المسواك (زيونة - خدمي دريم سيتي مول، مجاور مطعم صيف وشتاء، ط6 ش6) يوم ${apt.preferredDate} الساعة ${apt.preferredTime} مع ${apt.assignedDoctorAr}. نتمنى لك ابتسامة مشرقة!`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold flex items-center gap-1 transition-colors"
                        title={isAr ? 'إرسال تذكير واتساب رسمي' : 'Send WhatsApp Reminder'}
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span className="hidden xl:inline">{isAr ? 'تذكير واتساب' : 'WhatsApp'}</span>
                      </a>

                      {/* Status Dropdown */}
                      <select
                        value={apt.status}
                        onChange={(e) => onUpdateStatus(apt.id, e.target.value as AppointmentStatus)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold py-1.5 px-2 rounded-xl border border-slate-300 cursor-pointer"
                      >
                        <option value="new_request">{isAr ? 'طلب جديد' : 'New'}</option>
                        <option value="awaiting_confirmation">{isAr ? 'بانتظار التأكيد' : 'Awaiting'}</option>
                        <option value="confirmed">{isAr ? 'تأكيد الحضور' : 'Confirm'}</option>
                        <option value="attended">{isAr ? 'حضر للعيادة' : 'Attended'}</option>
                        <option value="no_show">{isAr ? 'لم يحضر (No-show)' : 'No-show'}</option>
                        <option value="cancelled">{isAr ? 'إلغاء' : 'Cancel'}</option>
                      </select>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Appointment Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-base">
                {isAr ? 'تسجيل موعد كشفية جديد' : 'New Appointment Booking'}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{isAr ? 'اسم المريض:' : 'Patient Name:'}</label>
                <input
                  type="text"
                  required
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder={isAr ? 'مثال: محمد البغدادي' : 'Patient Full Name'}
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">{isAr ? 'رقم الهاتف (العراق):' : 'Phone Number:'}</label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="077xxxxxxxx"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{isAr ? 'الخدمة:' : 'Treatment:'}</label>
                  <select
                    value={treatment}
                    onChange={(e) => setTreatment(e.target.value as TreatmentType)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="orthodontics">{isAr ? 'تقويم أسنان' : 'Orthodontics'}</option>
                    <option value="cosmetic_emax">{isAr ? 'ابتسامة إيماكس' : 'E-max Cosmetic'}</option>
                    <option value="pediatric">{isAr ? 'طب أسنان أطفال' : 'Pediatric'}</option>
                    <option value="teeth_whitening">{isAr ? 'تبييض أسنان' : 'Whitening'}</option>
                    <option value="general_restorative">{isAr ? 'حشوات وعلاج' : 'General'}</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{isAr ? 'الطبيب:' : 'Doctor:'}</label>
                  <select
                    value={doctor}
                    onChange={(e) => setDoctor(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Dr. Mustafa Hadi">د. مصطفى هادي (التقويم)</option>
                    <option value="Dr. Ahmed Hashem">د. أحمد هاشم (تجميل)</option>
                    <option value="Dr. Saja Al-Husseini">د. سجى الحسيني (أطفال)</option>
                    <option value="Dr. Mohammed Tuzlu">د. محمد طوزلو</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{isAr ? 'التاريخ:' : 'Date:'}</label>
                  <input
                    type="date"
                    required
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{isAr ? 'الوقت:' : 'Time:'}</label>
                  <input
                    type="text"
                    required
                    value={preferredTime}
                    onChange={(e) => setPreferredTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="05:00 PM"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">{isAr ? 'ملاحظات الاستقبال:' : 'Notes:'}</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder={isAr ? 'أي تفاصيل عن الحالة أو وقت الاتصال...' : 'Additional notes...'}
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-sm"
                >
                  {isAr ? 'تأكيد الحجز' : 'Save Appointment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

