import React, { useState } from 'react';
import {
  ShieldCheck,
  Webhook,
  Key,
  Users,
  Database,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Code2,
  Trash2,
  Terminal,
} from 'lucide-react';
import { AppState } from '@/lib/store';
import { Language } from '@/types';

interface AdminViewProps {
  state: AppState;
  onResetData: () => void;
}

export const AdminView: React.FC<AdminViewProps> = ({ state, onResetData }) => {
  const isAr = state.currentLanguage === 'ar';
  const { webhookEventsLog } = state;

  const [testWebhookStatus, setTestWebhookStatus] = useState<string | null>(null);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);

  const handleTestWebhookHandshake = async () => {
    setIsTestingWebhook(true);
    try {
      const res = await fetch(
        '/api/webhooks/instagram?hub.mode=subscribe&hub.challenge=test_challenge_baghdad_992&hub.verify_token=almeswak_ai_baghdad_secure_verify_2026'
      );
      const text = await res.text();
      if (res.ok && text === 'test_challenge_baghdad_992') {
        setTestWebhookStatus(
          isAr
            ? 'نجح فحص الويب هوك: تم الرد برمز hub.challenge وحالة 200 OK مطابقة لمواصفات Meta الرسمية!'
            : 'Success: Webhook returned 200 OK with matching challenge string.'
        );
      } else {
        setTestWebhookStatus(
          isAr ? 'فشل الفحص: تأكد من رمز التحقق META_VERIFY_TOKEN' : 'Failed: Check verification token.'
        );
      }
    } catch (err: any) {
      setTestWebhookStatus(`Error testing webhook: ${err.message}`);
    } finally {
      setIsTestingWebhook(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-black text-slate-900">
          {isAr ? 'إدارة النظام وتشخيص الويب هوك (Administration & Diagnostics)' : 'Administration & Webhook Diagnostics'}
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          {isAr
            ? 'فحص جاهزية البنية التحتية، أحداث الويب هوك الواردة، ومصفوفة صلاحيات الفريق'
            : 'Inspect webhook subscriptions, incoming payloads, and role-based access.'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Webhook Configuration & Tester */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Webhook className="w-4 h-4 text-emerald-600" />
              <span>{isAr ? 'إعدادات ربط Meta Webhook المعتمدة' : 'Meta Webhook Configuration'}</span>
            </h3>
            <span className="text-[10px] bg-emerald-50 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
              Graph API v21.0+
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-slate-500 block text-[11px] font-semibold mb-1">
                Callback URL (مسار الاستقبال المباشر):
              </span>
              <div className="p-2.5 bg-slate-100 rounded-xl font-mono text-slate-800 select-all border border-slate-200 text-[11px]">
                https://almeswak-ai.vercel.app/api/webhooks/instagram
              </div>
            </div>

            <div>
              <span className="text-slate-500 block text-[11px] font-semibold mb-1">
                Verify Token (رمز التحقق):
              </span>
              <div className="p-2.5 bg-slate-100 rounded-xl font-mono text-slate-800 select-all border border-slate-200 text-[11px]">
                almeswak_ai_baghdad_secure_verify_2026
              </div>
            </div>

            <button
              onClick={handleTestWebhookHandshake}
              disabled={isTestingWebhook}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTestingWebhook ? 'animate-spin text-emerald-400' : ''}`} />
              <span>
                {isTestingWebhook
                  ? isAr
                    ? 'جاري فحص المصافحة...'
                    : 'Testing...'
                  : isAr
                  ? 'اختبار مصافحة GET مع خادم Meta'
                  : 'Test Webhook GET Handshake'}
              </span>
            </button>

            {testWebhookStatus && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-900 font-semibold animate-in fade-in">
                {testWebhookStatus}
              </div>
            )}
          </div>
        </div>

        {/* Role-Based Permissions Matrix */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 pb-3 border-b border-slate-200">
            <Users className="w-4 h-4 text-blue-600" />
            <span>{isAr ? 'مصفوفة صلاحيات فريق العيادة (Role-Based Permissions)' : 'Role-Based Access Control'}</span>
          </h3>

          <div className="space-y-2.5 text-xs">
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
              <div className="font-bold text-slate-900 mb-0.5">
                {isAr ? 'موظفة الاستقبال (Receptionist)' : 'Receptionist'}
              </div>
              <p className="text-[11px] text-slate-500">
                {isAr
                  ? 'صلاحية صندوق الرسائل، تثبيت المواعيد، إرسال تذكيرات الواتساب، وتحديث حالة الحضور (دون صلاحية صرف إعلاني).'
                  : 'Manage DM inbox, confirm bookings, send WhatsApp reminders, update attendance.'}
              </p>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
              <div className="font-bold text-slate-900 mb-0.5">
                {isAr ? 'د. مصطفى هادي (Lead Orthodontist)' : 'Dr. Mustafa Hadi'}
              </div>
              <p className="text-[11px] text-slate-500">
                {isAr
                  ? 'صلاحية كاملة على حسابه الشخصي @drmustafa_hadi، استوديو المحتوى والريلز، ومراجعة الحالات السريرية المعقدة.'
                  : 'Full control of @drmustafa_hadi, Content Studio, clinical review, ad planner.'}
              </p>
            </div>

            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
              <div className="font-bold text-slate-900 mb-0.5">
                {isAr ? 'إدارة العيادة (Clinic Admin)' : 'Clinic Administrator'}
              </div>
              <p className="text-[11px] text-slate-500">
                {isAr
                  ? 'صلاحية ربط الحسابات عبر فيسبوك، تعديل قائمة الأسعار، وتفويض الصرف الإعلاني.'
                  : 'Meta OAuth authorization, approve pricing sheets, authorize ad spend.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Webhook Events Log */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Terminal className="w-4 h-4 text-slate-700" />
            <span>{isAr ? 'سجل أحداث الويب هوك الحية (Live Webhook Events Log)' : 'Live Webhook Events Log'}</span>
          </h3>
          <span className="text-xs font-mono text-slate-400">Total: {webhookEventsLog.length} events</span>
        </div>

        <div className="space-y-2">
          {webhookEventsLog.map((evt) => (
            <div
              key={evt.id}
              className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <div>
                  <div className="font-mono text-slate-800 font-bold">
                    {evt.eventType} • @{evt.senderId}
                  </div>
                  <div className="text-slate-500 font-sans mt-0.5 text-[11px]">"{evt.payloadSnippet}"</div>
                </div>
              </div>
              <div className="text-end">
                <span className="text-[10px] font-mono text-slate-400">
                  {new Date(evt.timestamp).toLocaleTimeString()}
                </span>
                <span className="block text-[10px] font-bold text-emerald-700 uppercase">
                  {evt.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Danger Zone: Reset Demo Data */}
      <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-xs">
        <div>
          <div className="font-bold text-rose-900">
            {isAr ? 'إعادة ضبط البيانات إلى الحالة الأولية' : 'Reset Application State to Seed Data'}
          </div>
          <p className="text-rose-700 mt-0.5">
            {isAr
              ? 'يمسح كل الرسائل والمواعيد المسجلة محلياً ويعيد تهيئة البيانات المعتمدة لعيادة المسواك ود. مصطفى'
              : 'Clears local storage and re-initializes seed clinical leads and conversations.'}
          </p>
        </div>
        <button
          onClick={() => {
            if (confirm(isAr ? 'هل أنت متأكد من رغبتك بإعادة ضبط البيانات؟' : 'Reset all data?')) {
              onResetData();
            }
          }}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-colors shadow-sm flex items-center gap-1.5 shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>{isAr ? 'إعادة الضبط' : 'Reset Data'}</span>
        </button>
      </div>
    </div>
  );
};
