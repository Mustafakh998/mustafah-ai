import React from 'react';
import { X } from 'lucide-react';
import { motion } from 'motion/react';
import { Language, NavTabId } from '@/types';
import { NAV_SECTIONS, sectionForTab } from '@/lib/navigation';

interface SidebarProps {
  currentTab: NavTabId;
  onSelectTab: (tab: NavTabId) => void;
  language: Language;
  unreadCount: number;
  newAppointmentsCount: number;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  language,
  unreadCount,
  newAppointmentsCount,
  isMobileOpen,
  onCloseMobile,
}) => {
  const isAr = language === 'ar';
  const activeSection = sectionForTab(currentTab).id;
  const badges: Record<string, number> = { patients: unreadCount + newAppointmentsCount };

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-30 lg:hidden" onClick={onCloseMobile} aria-hidden />
      )}

      <aside
        className={`fixed lg:static inset-y-0 start-0 z-40 w-64 bg-slate-900 text-slate-100 flex flex-col border-e border-slate-800 shrink-0 select-none transition-transform lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : isAr ? 'translate-x-full' : '-translate-x-full'
        }`}
      >
        {/* Brand */}
        <div className="p-5 border-b border-slate-800/80 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-900/30 font-bold text-xl">
            م
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-bold text-white tracking-wide text-base block">MustafaH-AI</span>
            <p className="text-xs text-slate-400 truncate">
              {isAr ? 'د. مصطفى هادي — بغداد' : 'Dr. Mustafa Hadi — Baghdad'}
            </p>
          </div>
          <button onClick={onCloseMobile} className="lg:hidden p-1 text-slate-400 hover:text-white" aria-label="Close menu">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sections */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {NAV_SECTIONS.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            const badge = badges[section.id] ?? 0;

            return (
              <button
                key={section.id}
                onClick={() => {
                  if (!isActive) onSelectTab(section.tabs[0].id);
                  onCloseMobile();
                }}
                aria-current={isActive ? 'page' : undefined}
                className={`relative w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors text-start ${
                  isActive ? 'text-white' : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-xl bg-emerald-600 shadow-md shadow-emerald-950/40"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  />
                )}
                <Icon className={`relative w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="relative flex-1 truncate">{isAr ? section.labelAr : section.labelEn}</span>
                {badge > 0 && (
                  <span
                    className={`relative text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                      isActive ? 'bg-white text-emerald-700' : 'bg-emerald-500 text-white'
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>{isAr ? 'متصل بـ Meta' : 'Connected to Meta'}</span>
          <span className="ms-auto font-mono text-slate-500">v2.6</span>
        </div>
      </aside>
    </>
  );
};
