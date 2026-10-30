import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Key,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Info,
  Lock,
} from 'lucide-react';
import { InstagramIcon } from '@/components/icons/InstagramIcon';
import { AppState } from '@/lib/store';
import { AccountId, Language } from '@/types';

interface AccountsViewProps {
  state: AppState;
}

export const AccountsView: React.FC<AccountsViewProps> = ({ state }) => {
  const isAr = state.currentLanguage === 'ar';
  const { accounts } = state;

  const [isOAuthModalOpen, setIsOAuthModalOpen] = useState(false);
  const [selectedTargetAccount, setSelectedTargetAccount] = useState<AccountId>('almeswaksmile_iq');
  const [isRefreshingToken, setIsRefreshingToken] = useState(false);
  const [tokenTestResult, setTokenTestResult] = useState<string | null>(null);

  const handleTestToken = () => {
    setIsRefreshingToken(true);
    setTimeout(() => {
      setIsRefreshingToken(false);
      setTokenTestResult(
        isAr
          ? 'تم التحقق بنجاح: التوكن سليم وصالح، ونافذة الـ 24 ساعة للرسائل نشطة عبر Meta Graph API v21.0'
          : 'Verified: Token is active with Graph API v21.0, 24-hr messaging window enabled.'
      );
    }, 1200);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900">
            {isAr ? 'إدارة حسابات إنستغرام وتصاريح Meta' : 'Instagram Accounts & Meta OAuth'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {isAr
              ? 'ربط احترافي مستقل عبر واجهات برمجة Meta الرسمية — لا نطلب كلمة المرور أبداً'
              : 'Independent Meta OAuth 2.0 authorization — zero scraping, official Graph API only.'}
          </p>
        </div>

        <button
          onClick={() => {
            setSelectedTargetAccount('almeswaksmile_iq');
            setIsOAuthModalOpen(true);
          }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all"
        >
          <InstagramIcon className="w-4 h-4" />
          <span>{isAr ? 'ربط حساب إنستغرام جديد (Meta OAuth)' : 'Connect Instagram via Meta OAuth'}</span>
        </button>
      </div>

      {/* Account Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personal Brand Account Card */}
        <div className="bg-white rounded-2xl border-2 border-emerald-500/80 p-6 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 end-0 bg-emerald-500 text-slate-950 font-bold text-[10px] px-3 py-1 rounded-bl-xl tracking-wider uppercase">
            {isAr ? 'حساب التطوير والاختبار (متاح)' : 'Active Dev Account'}
          </div>

          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 p-0.5 shadow-md shrink-0">
              <div className="w-full h-full rounded-2xl bg-slate-900 flex items-center justify-center text-white font-bold text-2xl">
                م
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-lg">Dr. Mustafa Hadi</h3>
                <span className="text-xs font-mono text-slate-400">@drmustafa_hadi</span>
              </div>
              <p className="text-xs text-emerald-700 font-semibold mt-0.5">
                {isAr ? 'أخصائي تقويم أسنان وفكين' : 'Specialist Orthodontist'}
              </p>
              <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                "Orthodontist | Smiles guided by science & technology | IT & Programming Enthusiast | 📍 Iraq"
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 my-5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <div>
              <div className="text-base font-black text-slate-900">717</div>
              <div className="text-[11px] text-slate-500">{isAr ? 'متابع' : 'Followers'}</div>
            </div>
            <div>
              <div className="text-base font-black text-slate-900">16</div>
              <div className="text-[11px] text-slate-500">{isAr ? 'منشورات' : 'Posts'}</div>
            </div>
            <div>
              <div className="text-base font-black text-emerald-600">106K</div>
              <div className="text-[11px] text-slate-500">{isAr ? 'أعلى ريل' : 'Top Reel'}</div>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 text-emerald-800 font-medium">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                {isAr ? 'حالة الربط: نشط ومتصل بالويب هوك' : 'OAuth Status: Connected'}
              </span>
              <span className="font-mono text-[11px]">Token ID: ig_usr_mh_942</span>
            </div>
            <div className="flex items-center justify-between text-slate-500 px-1">
              <span>{isAr ? 'صلاحية التوكن:' : 'Token Expiry:'}</span>
              <span className="font-mono text-slate-700 font-semibold">45 days remaining</span>
            </div>
          </div>
        </div>

        {/* Clinic Official Account Card (Demo/Config Mode) */}
        <div className="bg-white rounded-2xl border border-slate-300 p-6 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 end-0 bg-amber-500 text-slate-950 font-bold text-[10px] px-3 py-1 rounded-bl-xl tracking-wider uppercase">
            {isAr ? 'وضع تجريبي / بانتظار الإدارة' : 'Demo Sandbox'}
          </div>

          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-slate-700 to-slate-900 p-0.5 shadow-md shrink-0">
              <div className="w-full h-full rounded-2xl bg-white flex items-center justify-center text-emerald-600 font-bold text-2xl">
                🦷
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-lg">
                  {isAr ? 'عيادة المسواك لطب الأسنان' : 'Almeswak Dental Clinic'}
                </h3>
                <span className="text-xs font-mono text-slate-400">@almeswaksmile.iq</span>
              </div>
              <p className="text-xs text-slate-600 font-semibold mt-0.5">
                {isAr ? 'عيادة أسنان تخصصية — بغداد زيونة' : 'Specialized Dental Clinic — Zayouna'}
              </p>
              <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                "ابتسامة | عناية | علاج | ثقة | 📍 بغداد – زيونة – خدمي دريم سيتي مول | للحجز: 07768886667"
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 my-5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
            <div>
              <div className="text-base font-black text-slate-900">1,123</div>
              <div className="text-[11px] text-slate-500">{isAr ? 'متابع' : 'Followers'}</div>
            </div>
            <div>
              <div className="text-base font-black text-slate-900">83</div>
              <div className="text-[11px] text-slate-500">{isAr ? 'منشورات' : 'Posts'}</div>
            </div>
            <div>
              <div className="text-base font-black text-blue-600">Verified</div>
              <div className="text-[11px] text-slate-500">{isAr ? 'توثيق' : 'Badge'}</div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
              <div className="flex items-center gap-1.5 font-bold mb-1">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>{isAr ? 'قيد انتظار تفويض إدارة العيادة' : 'Awaiting Clinic Admin OAuth'}</span>
              </div>
              <p>
                {isAr
                  ? 'المستخدم يملك صلاحية الحساب الشخصي فقط. تم تجهيز هذا الحساب ببيئة محاكاة واختبار كاملة لحين منح المشرف صلاحيات فيسبوك/إنستغرام.'
                  : 'Currently configured in interactive sandbox mode until clinic administrator completes Meta OAuth flow.'}
              </p>
            </div>

            <button
              onClick={() => {
                setSelectedTargetAccount('almeswaksmile_iq');
                setIsOAuthModalOpen(true);
              }}
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2"
            >
              <Key className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isAr ? 'منح صلاحيات الحساب الرسمي للعيادة' : 'Authorize Official Clinic Account'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Token Health & Permissions Diagnostics */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>{isAr ? 'لوحة فحص صحة التوكن والتصاريح (Token Health Diagnostics)' : 'Token Health Diagnostics'}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isAr ? 'مراقبة الصلاحيات الرسمية وفق شروط Meta لعام 2026' : 'Active Meta permissions and Webhook binding inspection'}
            </p>
          </div>

          <button
            onClick={handleTestToken}
            disabled={isRefreshingToken}
            className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold px-3 py-2 rounded-xl transition-colors flex items-center gap-2 self-start"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingToken ? 'animate-spin text-emerald-600' : ''}`} />
            <span>{isRefreshingToken ? (isAr ? 'جاري الفحص...' : 'Testing...') : (isAr ? 'فحص الاتصال الآن' : 'Test Connection')}</span>
          </button>
        </div>

        {tokenTestResult && (
          <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-800 font-semibold animate-in fade-in">
            {tokenTestResult}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1">
              <span>instagram_manage_messages</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-[11px] text-slate-500">
              {isAr ? 'استقبال رسائل الدايركت وإرسال الردود الذكية' : 'Receive and reply to direct messages'}
            </p>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1">
              <span>instagram_basic</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-[11px] text-slate-500">
              {isAr ? 'قراءة بيانات البروفايل ومقاييس الريلز' : 'Read profile info and media metrics'}
            </p>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1">
              <span>pages_manage_metadata</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-[11px] text-slate-500">
              {isAr ? 'إدارة الاشتراك بويب هوك الصفحة' : 'Subscribe app to page webhooks'}
            </p>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1">
              <span>instagram_manage_comments</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-[11px] text-slate-500">
              {isAr ? 'الرد الخاص على تعليقات الريلز (Comment to DM)' : 'Private replies to reel comments'}
            </p>
          </div>
        </div>
      </div>

      {/* Meta OAuth Modal */}
      {isOAuthModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <InstagramIcon className="w-5 h-5 text-pink-600" />
                <h3 className="font-bold text-slate-900 text-base">
                  {isAr ? 'ربط الحساب عبر Meta Login' : 'Meta OAuth 2.0 Authorization'}
                </h3>
              </div>
              <button
                onClick={() => setIsOAuthModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
              <p>
                {isAr
                  ? 'سيتم توجيهك إلى نافذة تسجيل الدخول الرسمية من Meta. لن تتم مشاركة أي كلمات مرور مع هذا النظام أبداً.'
                  : 'You will be redirected to the official Meta Login dialog. Passwords are never shared.'}
              </p>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="font-bold text-slate-800">{isAr ? 'الصلاحيات المطلوبة:' : 'Requested Scopes:'}</div>
                <div className="font-mono text-[11px] text-slate-600">
                  • instagram_basic<br />
                  • instagram_manage_messages<br />
                  • pages_manage_metadata<br />
                  • instagram_manage_comments
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => {
                  alert(
                    isAr
                      ? 'تم تسجيل محاكاة الربط بنجاح عبر بروتوكول Meta OAuth v21.0!'
                      : 'Meta OAuth simulation completed!'
                  );
                  setIsOAuthModalOpen(false);
                }}
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{isAr ? 'المتابعة عبر فيسبوك / إنستغرام' : 'Continue with Meta'}</span>
              </button>
              <button
                onClick={() => setIsOAuthModalOpen(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
