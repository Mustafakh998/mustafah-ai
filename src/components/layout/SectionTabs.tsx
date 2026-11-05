import React from 'react';
import { motion } from 'motion/react';
import { Language, NavTabId } from '@/types';
import { sectionForTab } from '@/lib/navigation';

interface SectionTabsProps {
  currentTab: NavTabId;
  onSelectTab: (tab: NavTabId) => void;
  language: Language;
  badges: Partial<Record<NavTabId, number>>;
}

/** Sub-tabs for the pages inside the active sidebar section. */
export const SectionTabs: React.FC<SectionTabsProps> = ({ currentTab, onSelectTab, language, badges }) => {
  const isAr = language === 'ar';
  const section = sectionForTab(currentTab);

  return (
    <div className="bg-white border-b border-slate-200 px-3 sm:px-6 shrink-0">
      <div role="tablist" className="flex gap-1 overflow-x-auto -mb-px">
        {section.tabs.map((tab) => {
          const isActive = tab.id === currentTab;
          const badge = badges[tab.id] ?? 0;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelectTab(tab.id)}
              className={`relative flex items-center gap-2 px-3 sm:px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors ${
                isActive ? 'text-emerald-700' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="section-tab-underline"
                  className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-emerald-600"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              {isAr ? tab.labelAr : tab.labelEn}
              {badge > 0 && (
                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500 text-white">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
