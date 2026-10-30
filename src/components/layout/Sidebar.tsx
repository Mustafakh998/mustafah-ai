import React from 'react';
import {
  LayoutDashboard,
  MessageSquare,
  Bot,
  Database,
  Users,
  CalendarCheck,
  Video,
  Calendar,
  DollarSign,
  TrendingUp,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { InstagramIcon } from '@/components/icons/InstagramIcon';
import { AccountId, Language, NavTabId } from '@/types';

interface SidebarProps {
  currentTab: NavTabId;
  onSelectTab: (tab: NavTabId) => void;
  language: Language;
  unreadCount: number;
  newAppointmentsCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  language,
  unreadCount,
  newAppointmentsCount,
}) => {
  const isAr = language === 'ar';

  const NAV_ITEMS: {
    id: NavTabId;
    labelAr: string;
    labelEn: string;
    icon: React.ElementType;
    badge?: number;
    highlightBadge?: string;
  }[] = [
    { id: 'overview', labelAr: 'نظرة عامة', labelEn: 'Overview', icon: LayoutDashboard },
    { id: 'pilot_demo', labelAr: 'عرض الإدارة التفاعلي', labelEn: 'Management Live Demo', icon: Sparkles, highlightBadge: 'DEMO' },
    { id: 'accounts', labelAr: 'حسابات إنستغرام', labelEn: 'Instagram Accounts', icon: InstagramIcon },
    { id: 'inbox', labelAr: 'صندوق المحادثات', labelEn: 'DM Inbox', icon: MessageSquare, badge: unreadCount },
    { id: 'ai_settings', labelAr: 'إعدادات المساعد الذكي', labelEn: 'AI Agent Settings', icon: Bot },
    { id: 'knowledge_base', labelAr: 'قاعدة المعرفة الطبية', labelEn: 'Knowledge Base', icon: Database },
    { id: 'leads_crm', labelAr: 'إدارة المراجعين (CRM)', labelEn: 'Leads CRM', icon: Users },
    { id: 'appointments', labelAr: 'المواعيد والحجوزات', labelEn: 'Appointments', icon: CalendarCheck, badge: newAppointmentsCount },
    { id: 'content_studio', labelAr: 'استوديو المحتوى', labelEn: 'Content Studio', icon: Video },
    { id: 'content_calendar', labelAr: 'تقويم النشر (30 يوم)', labelEn: 'Content Calendar', icon: Calendar },
    { id: 'ad_campaigns', labelAr: 'حملات الإعلانات (<$100)', labelEn: 'Ad Campaigns', icon: DollarSign },
    { id: 'analytics', labelAr: 'إحصائيات النمو', labelEn: 'Growth Analytics', icon: TrendingUp },
    { id: 'admin', labelAr: 'الإدارة وتشخيص الربط', labelEn: 'Administration', icon: ShieldCheck },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-100 flex flex-col border-e border-slate-800 shrink-0 select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800/80 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-900/30 font-bold text-xl">
          م
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-white tracking-wide text-base">ALMESWAK AI</span>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-semibold px-1.5 py-0.5 rounded border border-emerald-500/30">
              BAGHDAD
            </span>
          </div>
          <p className="text-xs text-slate-400">
            {isAr ? 'نظام التحويل ونمو العيادة' : 'Patient Acquisition System'}
          </p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-start relative ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
                  : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span className="flex-1 truncate">{isAr ? item.labelAr : item.labelEn}</span>
              {item.highlightBadge && !isActive && (
                <span className="text-[10px] font-black tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  {item.highlightBadge}
                </span>
              )}
              {item.badge && item.badge > 0 ? (
                <span
                  className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                    isActive ? 'bg-white text-emerald-700' : 'bg-emerald-500 text-white'
                  }`}
                >
                  {item.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 text-xs text-slate-400">
        <div className="flex items-center justify-between mb-1">
          <span className="text-slate-500">{isAr ? 'نسخة النظام' : 'Version'}</span>
          <span className="text-emerald-400 font-mono text-[11px]">v2.6-Baghdad</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>{isAr ? 'الويب هوك و Meta متصلان' : 'Meta Webhooks Active'}</span>
        </div>
      </div>
    </aside>
  );
};
