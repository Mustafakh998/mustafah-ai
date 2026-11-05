'use client';

import React, { useState, useEffect } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { useAppStore } from '@/lib/store';
import { Sidebar } from '@/components/layout/Sidebar';
import { NavTabId } from '@/types';
import { Header } from '@/components/layout/Header';
import { SectionTabs } from '@/components/layout/SectionTabs';
import { Toaster } from '@/components/layout/Toaster';
import { OverviewView } from '@/components/pages/OverviewView';
import { PilotDemoView } from '@/components/pages/PilotDemoView';
import { AccountsView } from '@/components/pages/AccountsView';
import { InboxView } from '@/components/pages/InboxView';
import { AiSettingsView } from '@/components/pages/AiSettingsView';
import { KnowledgeBaseView } from '@/components/pages/KnowledgeBaseView';
import { LeadsCrmView } from '@/components/pages/LeadsCrmView';
import { AppointmentsView } from '@/components/pages/AppointmentsView';
import { ContentStudioView } from '@/components/pages/ContentStudioView';
import { ContentCalendarView } from '@/components/pages/ContentCalendarView';
import { AdCampaignsView } from '@/components/pages/AdCampaignsView';
import { MarketingStrategyView } from '@/components/pages/MarketingStrategyView';
import { AnalyticsView } from '@/components/pages/AnalyticsView';
import { AdminView } from '@/components/pages/AdminView';
import { GrowthAuditView } from '@/components/pages/GrowthAuditView';
import { SimilarPagesView } from '@/components/pages/SimilarPagesView';
import { GrowthPlanView } from '@/components/pages/GrowthPlanView';
import { ReplyStyleView } from '@/components/pages/ReplyStyleView';
import { SimulateMessageModal } from '@/components/modals/SimulateMessageModal';
import { ClinicOnboardingModal } from '@/components/modals/ClinicOnboardingModal';

export default function Home() {
  const {
    state,
    setLanguage,
    setSelectedAccount,
    setActiveConversation,
    toggleAiAutoReply,
    updateLeadStatus,
    updateAppointmentStatus,
    createAppointment,
    sendMessage,
    simulateIncomingUserMessage,
    toggleConversationTakeover,
    addContentItem,
    updateContentStatus,
    toggleCampaignStatus,
    addCampaign,
    boostPostOrProfile,
    toggleCommentRule,
    addCommentRule,
    sendReviewRequest,
    reengageLead,
    registerClinic,
    resetAllData,
    loadDemoData,
  } = useAppStore();

  const [currentTab, setCurrentTab] = useState<NavTabId>('overview');
  const [isSimulateModalOpen, setIsSimulateModalOpen] = useState(false);
  const [isOnboardModalOpen, setIsOnboardModalOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // Sync RTL / LTR document direction with language
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dir = state.currentLanguage === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.lang = state.currentLanguage;
    }
  }, [state.currentLanguage]);

  // Derived unread counts for badges
  const unreadMessagesCount = state.conversations.filter((c) => c.unread).length;
  const newAppointmentsCount = state.appointments.filter((a) => a.status === 'new_request').length;

  return (
    <MotionConfig reducedMotion="user">
    <div className="flex h-screen w-full bg-slate-100 overflow-hidden font-sans">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        language={state.currentLanguage}
        unreadCount={unreadMessagesCount}
        newAppointmentsCount={newAppointmentsCount}
        isMobileOpen={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
      />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <Header
          accounts={state.accounts}
          selectedAccountId={state.selectedAccountId}
          onSelectAccount={setSelectedAccount}
          language={state.currentLanguage}
          onToggleLanguage={() => setLanguage(state.currentLanguage === 'ar' ? 'en' : 'ar')}
          isAiAutoReplyEnabled={state.isAiAutoReplyEnabled}
          onToggleAiAutoReply={toggleAiAutoReply}
          onOpenSimulateModal={() => setIsSimulateModalOpen(true)}
          onOpenOnboardModal={() => setIsOnboardModalOpen(true)}
          onOpenMenu={() => setIsMobileNavOpen(true)}
        />

        <SectionTabs
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          language={state.currentLanguage}
          badges={{ inbox: unreadMessagesCount, appointments: newAppointmentsCount }}
        />

        {/* Tab View Container */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8">
          <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={currentTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
          {currentTab === 'growth_audit' && <GrowthAuditView language={state.currentLanguage} onNavigate={setCurrentTab} />}
          {currentTab === 'similar_pages' && <SimilarPagesView language={state.currentLanguage} onNavigate={setCurrentTab} />}
          {currentTab === 'growth_plan' && <GrowthPlanView language={state.currentLanguage} onNavigate={setCurrentTab} />}
          {currentTab === 'reply_style' && <ReplyStyleView language={state.currentLanguage} />}

          {currentTab === 'overview' && (
            <OverviewView
              state={state}
              onNavigate={setCurrentTab}
              onOpenSimulateModal={() => setIsSimulateModalOpen(true)}
            />
          )}

          {currentTab === 'pilot_demo' && (
            <PilotDemoView
              state={state}
              onNavigate={setCurrentTab}
              onOpenSimulateModal={() => setIsSimulateModalOpen(true)}
            />
          )}

          {currentTab === 'accounts' && <AccountsView state={state} />}

          {currentTab === 'inbox' && (
            <InboxView
              state={state}
              onSendMessage={sendMessage}
              onToggleTakeover={toggleConversationTakeover}
              onSelectConversation={setActiveConversation}
              onCreateAppointment={createAppointment}
              onNavigate={setCurrentTab}
            />
          )}

          {currentTab === 'ai_settings' && <AiSettingsView state={state} />}

          {currentTab === 'knowledge_base' && <KnowledgeBaseView state={state} />}

          {currentTab === 'leads_crm' && (
            <LeadsCrmView
              state={state}
              onUpdateStatus={updateLeadStatus}
              onNavigate={setCurrentTab}
            />
          )}

          {currentTab === 'appointments' && (
            <AppointmentsView
              state={state}
              onUpdateStatus={updateAppointmentStatus}
              onCreateAppointment={createAppointment}
            />
          )}

          {currentTab === 'content_studio' && (
            <ContentStudioView
              state={state}
              onAddContentItem={addContentItem}
              onNavigate={setCurrentTab}
            />
          )}

          {currentTab === 'content_calendar' && (
            <ContentCalendarView
              state={state}
              onUpdateStatus={updateContentStatus}
              onNavigate={setCurrentTab}
            />
          )}

          {currentTab === 'ad_campaigns' && (
            <AdCampaignsView
              state={state}
              onToggleCampaignStatus={toggleCampaignStatus}
              onAddCampaign={addCampaign}
              onBoostPostOrProfile={boostPostOrProfile}
              onNavigate={setCurrentTab}
            />
          )}

          {currentTab === 'marketing_strategy' && (
            <MarketingStrategyView
              state={state}
              onNavigate={setCurrentTab}
              onToggleCommentRule={toggleCommentRule}
              onAddCommentRule={addCommentRule}
              onSendReviewRequest={sendReviewRequest}
              onReengageLead={reengageLead}
            />
          )}

          {currentTab === 'analytics' && <AnalyticsView state={state} />}

          {currentTab === 'admin' && (
            <AdminView
              state={state}
              onResetData={resetAllData}
              onLoadDemoData={loadDemoData}
            />
          )}
          </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Simulated Inbound DM Modal */}
      <SimulateMessageModal
        isOpen={isSimulateModalOpen}
        onClose={() => setIsSimulateModalOpen(false)}
        onSendSimulation={(text, username) => {
          simulateIncomingUserMessage(text, username);
          // If not in inbox, prompt or automatically navigate to inbox to see real-time AI reply
          if (currentTab !== 'inbox') {
            setCurrentTab('inbox');
          }
        }}
        language={state.currentLanguage}
      />

      {/* New Clinic Onboarding Modal */}
      <ClinicOnboardingModal
        isOpen={isOnboardModalOpen}
        onClose={() => setIsOnboardModalOpen(false)}
        language={state.currentLanguage}
        onClinicCreated={registerClinic}
      />

      <Toaster />
    </div>
    </MotionConfig>
  );
}
