import {
  LayoutDashboard,
  Users,
  Video,
  TrendingUp,
  Bot,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { NavTabId } from '@/types';

export interface NavTab {
  id: NavTabId;
  labelAr: string;
  labelEn: string;
}

export interface NavSection {
  id: string;
  labelAr: string;
  labelEn: string;
  icon: LucideIcon;
  tabs: NavTab[];
}

// The 14 pages, grouped into 6 sidebar sections. Each section shows its pages as sub-tabs.
export const NAV_SECTIONS: NavSection[] = [
  {
    id: 'dashboard',
    labelAr: 'الرئيسية',
    labelEn: 'Dashboard',
    icon: LayoutDashboard,
    tabs: [
      { id: 'overview', labelAr: 'نظرة عامة', labelEn: 'Overview' },
      { id: 'analytics', labelAr: 'إحصائيات النمو', labelEn: 'Analytics' },
      { id: 'pilot_demo', labelAr: 'العرض التفاعلي', labelEn: 'Live Demo' },
    ],
  },
  {
    id: 'patients',
    labelAr: 'المراجعين',
    labelEn: 'Patients',
    icon: Users,
    tabs: [
      { id: 'inbox', labelAr: 'المحادثات', labelEn: 'Inbox' },
      { id: 'leads_crm', labelAr: 'المراجعين (CRM)', labelEn: 'Leads' },
      { id: 'appointments', labelAr: 'المواعيد', labelEn: 'Appointments' },
    ],
  },
  {
    id: 'content',
    labelAr: 'المحتوى',
    labelEn: 'Content',
    icon: Video,
    tabs: [
      { id: 'content_studio', labelAr: 'استوديو المحتوى', labelEn: 'Studio' },
      { id: 'content_calendar', labelAr: 'تقويم النشر', labelEn: 'Calendar' },
    ],
  },
  {
    id: 'growth',
    labelAr: 'النمو والإعلانات',
    labelEn: 'Growth',
    icon: TrendingUp,
    tabs: [
      { id: 'growth_audit', labelAr: 'تحليل الحساب', labelEn: 'Account Audit' },
      { id: 'similar_pages', labelAr: 'الصفحات المشابهة', labelEn: 'Similar Pages' },
      { id: 'growth_plan', labelAr: 'خطة النمو', labelEn: 'Growth Plan' },
      { id: 'ad_campaigns', labelAr: 'الإعلانات', labelEn: 'Ads' },
      { id: 'marketing_strategy', labelAr: 'دليل التسويق', labelEn: 'Playbook' },
    ],
  },
  {
    id: 'ai',
    labelAr: 'المساعد الذكي',
    labelEn: 'AI Assistant',
    icon: Bot,
    tabs: [
      { id: 'reply_style', labelAr: 'أسلوب الرد', labelEn: 'Reply Style' },
      { id: 'ai_settings', labelAr: 'الإعدادات', labelEn: 'Settings' },
      { id: 'knowledge_base', labelAr: 'قاعدة المعرفة', labelEn: 'Knowledge Base' },
    ],
  },
  {
    id: 'settings',
    labelAr: 'الإعدادات',
    labelEn: 'Settings',
    icon: Settings,
    tabs: [
      { id: 'accounts', labelAr: 'حسابات إنستغرام', labelEn: 'Instagram Accounts' },
      { id: 'admin', labelAr: 'الإدارة والتشخيص', labelEn: 'Administration' },
    ],
  },
];

export const sectionForTab = (tab: NavTabId): NavSection =>
  NAV_SECTIONS.find((s) => s.tabs.some((t) => t.id === tab)) ?? NAV_SECTIONS[0];
