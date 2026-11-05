import React from 'react';
import {
  Globe,
  Bot,
  Phone,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  MessageSquarePlus,
  Menu,
} from 'lucide-react';

import { AccountId, Language, InstagramAccount } from '@/types';

interface HeaderProps {
  accounts: InstagramAccount[];
  selectedAccountId: AccountId | 'all';
  onSelectAccount: (acc: AccountId | 'all') => void;
  language: Language;
  onToggleLanguage: () => void;
  isAiAutoReplyEnabled: boolean;
  onToggleAiAutoReply: () => void;
  onOpenSimulateModal: () => void;
  onOpenOnboardModal?: () => void;
  onOpenMenu: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  accounts,
  selectedAccountId,
  onSelectAccount,
  language,
  onToggleLanguage,
  isAiAutoReplyEnabled,
  onToggleAiAutoReply,
  onOpenSimulateModal,
  onOpenOnboardModal,
  onOpenMenu,
}) => {
  const isAr = language === 'ar';
  const selectedAcc = accounts.find((a) => a.id === selectedAccountId);

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-3 sm:px-6 flex items-center justify-between gap-2 shrink-0 shadow-sm z-10">
      {/* Left: Account Selector & Status */}
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        <button
          onClick={onOpenMenu}
          className="lg:hidden p-2 -ms-1 rounded-xl text-slate-600 hover:bg-slate-100"
          aria-label={isAr ? 'القائمة' : 'Open menu'}
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <label className="text-xs font-medium text-slate-500 hidden sm:inline">
            {isAr ? 'الحساب النشط:' : 'Active Workspace:'}
          </label>
          <div className="relative min-w-0">
            <select
              value={selectedAccountId}
              onChange={(e) => onSelectAccount(e.target.value as AccountId | 'all')}
              className="bg-slate-100 hover:bg-slate-200/80 border border-slate-300 text-slate-800 text-sm font-semibold rounded-xl px-3 py-1.5 pe-8 max-w-[45vw] sm:max-w-xs truncate focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer transition-colors"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.id === 'drmustafa_hadi'
                    ? isAr
                      ? 'د. مصطفى هادي (@drmustafa_hadi) — نشط ومربوط (Pilot)'
                      : 'Dr. Mustafa Hadi (@drmustafa_hadi) — Active Pilot'
                    : acc.id === 'almeswaksmile_iq'
                    ? isAr
                      ? 'عيادة المسواك (@almeswaksmile.iq) — مقفلة (بانتظار التفويض)'
                      : 'Almeswak Clinic (@almeswaksmile.iq) — Locked (Pending Auth)'
                    : `${isAr ? acc.nameAr : acc.name} (@${acc.handle}) — ${acc.status === 'connected' ? (isAr ? 'نشط ومربوط' : 'Active') : acc.status}`}
                </option>
              ))}
              <option value="all">
                {isAr ? 'كل الحسابات (عرض مجمّع)' : 'All Accounts (Unified Hub)'}
              </option>
            </select>
          </div>
        </div>

        {/* Account Status Badge */}
        {selectedAccountId === 'drmustafa_hadi' ? (
          <span className="hidden xl:inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            {isAr ? 'حساب المطور (مربوط)' : 'Personal Dev (Connected)'}
          </span>
        ) : selectedAccountId === 'almeswaksmile_iq' ? (
          <span className="hidden xl:inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-300">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
            {isAr ? 'مساحة مقفلة ومعزولة (بانتظار الإدارة)' : 'Locked & Isolated (Pending Admin Auth)'}
          </span>
        ) : selectedAccountId === 'all' ? (
          <span className="hidden xl:inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
            {isAr ? 'إدارة موحدة' : 'Unified View'}
          </span>
        ) : (
          <span className="hidden xl:inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
            {isAr ? 'مستأجر سحابي نشط' : 'Active Cloud Tenant'}
          </span>
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {/* Clinic Hotline */}
        <div className="hidden 2xl:flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700">
          <Phone className="w-3.5 h-3.5 text-emerald-600" />
          <span>{isAr ? 'خط الحجز:' : 'Reception:'}</span>
          <span className="font-bold text-slate-900 font-mono">
            {selectedAcc?.phone || '07768886667'}
          </span>
        </div>

        {/* Register New Clinic Button */}
        {onOpenOnboardModal && (
          <button
            onClick={onOpenOnboardModal}
            className="hidden sm:flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
            title={isAr ? 'تسجيل عيادة جديدة وتفعيل الاشتراك' : 'Onboard New Clinic & Plan'}
          >
            <PlusCircle className="w-3.5 h-3.5 text-indigo-600" />
            <span>{isAr ? '+ عيادة جديدة' : '+ New Clinic'}</span>
          </button>
        )}

        {/* Simulate Inbound DM Button */}
        <button
          onClick={onOpenSimulateModal}
          title={isAr ? 'تجربة رسالة DM جديدة' : 'Simulate Inbound DM'}
          className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
        >
          <MessageSquarePlus className="w-4 h-4 text-emerald-600" />
          <span className="hidden md:inline">{isAr ? 'تجربة رسالة' : 'Test a DM'}</span>
        </button>

        {/* AI Auto-Reply Switch */}
        <button
          onClick={onToggleAiAutoReply}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
            isAiAutoReplyEnabled
              ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
              : 'bg-slate-100 text-slate-600 border-slate-300'
          }`}
          title={isAr ? 'تبديل تفعيل الرد الآلي للذكاء الاصطناعي' : 'Toggle AI Auto-Reply'}
        >
          <Bot className="w-3.5 h-3.5" />
          <span className="hidden md:inline">
            {isAiAutoReplyEnabled
              ? isAr
                ? 'رد الذكاء: مفعّل'
                : 'AI Reply: ON'
              : isAr
              ? 'رد الذكاء: متوقف'
              : 'AI Reply: OFF'}
          </span>
        </button>

        {/* Language Switcher */}
        <button
          onClick={onToggleLanguage}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-colors"
        >
          <Globe className="w-3.5 h-3.5 text-slate-600" />
          <span>{isAr ? 'English' : 'عربي'}</span>
        </button>
      </div>
    </header>
  );
};
