import { useState, useEffect } from 'react';
import {
  AccountId,
  Language,
  InstagramAccount,
  Lead,
  Appointment,
  Conversation,
  ContentItem,
  AdCampaign,
  AnalyticsMetrics,
  LeadStatus,
  AppointmentStatus,
} from '@/types';
import {
  INITIAL_ACCOUNTS,
  INITIAL_LEADS,
  INITIAL_APPOINTMENTS,
  INITIAL_CONVERSATIONS,
  INITIAL_CONTENT_ITEMS,
  INITIAL_CAMPAIGNS,
  INITIAL_ANALYTICS,
} from '@/lib/data/initialData';
import { generateIraqiDialectResponse } from '@/lib/ai/iraqiEngine';

export interface AppState {
  currentLanguage: Language;
  selectedAccountId: AccountId | 'all';
  accounts: InstagramAccount[];
  leads: Lead[];
  appointments: Appointment[];
  conversations: Conversation[];
  activeConversationId: string;
  contentItems: ContentItem[];
  campaigns: AdCampaign[];
  analytics: AnalyticsMetrics;
  isAiAutoReplyEnabled: boolean;
  webhookEventsLog: Array<{
    id: string;
    timestamp: string;
    eventType: string;
    senderId: string;
    payloadSnippet: string;
    status: 'received' | 'processed' | 'failed';
  }>;
}

const STORAGE_KEY = 'almeswak_ai_baghdad_state_v1';

export function useAppStore() {
  const [state, setState] = useState<AppState>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error('Failed to parse saved state:', e);
        }
      }
    }
    return {
      currentLanguage: 'ar',
      selectedAccountId: 'drmustafa_hadi',
      accounts: INITIAL_ACCOUNTS,
      leads: INITIAL_LEADS,
      appointments: INITIAL_APPOINTMENTS,
      conversations: INITIAL_CONVERSATIONS,
      activeConversationId: 'conv_1',
      contentItems: INITIAL_CONTENT_ITEMS,
      campaigns: INITIAL_CAMPAIGNS,
      analytics: INITIAL_ANALYTICS,
      isAiAutoReplyEnabled: true,
      webhookEventsLog: [
        {
          id: 'evt_1',
          timestamp: '2026-10-30T01:10:00Z',
          eventType: 'instagram_messages',
          senderId: 'nour_al_huda99',
          payloadSnippet: 'مرحبا دكتور.. عندي بروز بالأسنان الفوك، شكد يطول التقويم؟',
          status: 'processed',
        },
        {
          id: 'evt_2',
          timestamp: '2026-10-29T21:15:00Z',
          eventType: 'instagram_messages',
          senderId: 'ali_alkarkhi98',
          payloadSnippet: 'دكتور بلا زحمة يصير اجي السبت الساعة 5 العصر للكشفية؟',
          status: 'processed',
        },
      ],
    };
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [state]);

  const setLanguage = (lang: Language) => {
    setState((prev) => ({ ...prev, currentLanguage: lang }));
  };

  const setSelectedAccount = (accountId: AccountId | 'all') => {
    setState((prev) => ({ ...prev, selectedAccountId: accountId }));
  };

  const setActiveConversation = (id: string) => {
    setState((prev) => ({ ...prev, activeConversationId: id }));
  };

  const toggleAiAutoReply = () => {
    setState((prev) => ({ ...prev, isAiAutoReplyEnabled: !prev.isAiAutoReplyEnabled }));
  };

  // Lead Actions
  const updateLeadStatus = (leadId: string, newStatus: LeadStatus) => {
    setState((prev) => {
      const updatedLeads = prev.leads.map((lead) =>
        lead.id === leadId ? { ...lead, status: newStatus } : lead
      );

      // Recalculate metrics
      const qualified = updatedLeads.filter((l) => l.status !== 'new_inquiry' && l.status !== 'lost').length;
      const booked = updatedLeads.filter((l) => l.status === 'confirmed' || l.status === 'attended').length;
      const attended = updatedLeads.filter((l) => l.status === 'attended').length;

      return {
        ...prev,
        leads: updatedLeads,
        analytics: {
          ...prev.analytics,
          qualifiedLeads: qualified,
          confirmedAppointments: booked,
          attendedPatients: attended,
          costPerQualifiedInquiryUSD: qualified > 0 ? +(prev.analytics.totalAdSpendUSD / qualified).toFixed(2) : 0,
          costPerAttendedPatientUSD: attended > 0 ? +(prev.analytics.totalAdSpendUSD / attended).toFixed(2) : 0,
        },
      };
    });
  };

  // Appointment Actions
  const updateAppointmentStatus = (appointmentId: string, newStatus: AppointmentStatus) => {
    setState((prev) => {
      const updatedAppointments = prev.appointments.map((apt) =>
        apt.id === appointmentId ? { ...apt, status: newStatus } : apt
      );

      // If marked attended, sync with lead status
      const apt = prev.appointments.find((a) => a.id === appointmentId);
      let updatedLeads = prev.leads;
      if (apt && newStatus === 'attended') {
        updatedLeads = prev.leads.map((l) => (l.id === apt.leadId ? { ...l, status: 'attended' } : l));
      } else if (apt && newStatus === 'confirmed') {
        updatedLeads = prev.leads.map((l) => (l.id === apt.leadId ? { ...l, status: 'confirmed' } : l));
      }

      return {
        ...prev,
        appointments: updatedAppointments,
        leads: updatedLeads,
      };
    });
  };

  const createAppointment = (newApt: Omit<Appointment, 'id' | 'createdAt'>) => {
    const id = `apt_${Date.now()}`;
    const fullApt: Appointment = {
      ...newApt,
      id,
      createdAt: new Date().toISOString(),
    };

    setState((prev) => ({
      ...prev,
      appointments: [fullApt, ...prev.appointments],
      leads: prev.leads.map((lead) =>
        lead.id === newApt.leadId ? { ...lead, status: 'appointment_requested' } : lead
      ),
      analytics: {
        ...prev.analytics,
        appointmentRequests: prev.analytics.appointmentRequests + 1,
      },
    }));
  };

  // Chat Actions
  const sendMessage = (conversationId: string, text: string, sender: 'assistant' | 'staff' = 'staff') => {
    const messageId = `msg_${Date.now()}`;
    const newMsg = {
      id: messageId,
      conversationId,
      sender,
      text,
      timestamp: new Date().toISOString(),
    };

    setState((prev) => {
      const convs = prev.conversations.map((conv) => {
        if (conv.id === conversationId) {
          return {
            ...conv,
            lastMessage: text,
            lastMessageTime: newMsg.timestamp,
            unread: false,
            messages: [...conv.messages, newMsg],
          };
        }
        return conv;
      });
      return { ...prev, conversations: convs };
    });
  };

  // Simulate user incoming message (or real webhook event)
  const simulateIncomingUserMessage = (userText: string, username = 'patient_iq') => {
    const activeConv = state.conversations.find((c) => c.id === state.activeConversationId) || state.conversations[0];
    const targetAccountId = activeConv?.accountId || 'drmustafa_hadi';

    // 1. Add User Message
    const userMsgId = `usr_${Date.now()}`;
    const userMsg = {
      id: userMsgId,
      conversationId: activeConv.id,
      sender: 'user' as const,
      text: userText,
      timestamp: new Date().toISOString(),
    };

    // 2. Run Iraqi AI Language Engine
    const aiResult = generateIraqiDialectResponse(userText, targetAccountId, activeConv.patientName);

    // 3. Log webhook event
    const webhookEvt = {
      id: `evt_${Date.now()}`,
      timestamp: new Date().toISOString(),
      eventType: 'instagram_messages',
      senderId: username,
      payloadSnippet: userText.slice(0, 70),
      status: 'processed' as const,
    };

    setState((prev) => {
      const updatedConversations = prev.conversations.map((c) => {
        if (c.id === activeConv.id) {
          const msgs = [...c.messages, userMsg];

          // If AI auto-reply is on and not handed over, generate AI response
          if (prev.isAiAutoReplyEnabled && c.status !== 'human_takeover') {
            const aiMsg = {
              id: `ai_${Date.now() + 1}`,
              conversationId: c.id,
              sender: 'assistant' as const,
              text: aiResult.replyText,
              timestamp: new Date(Date.now() + 1000).toISOString(),
              intent: aiResult.intent,
              confidence: aiResult.confidence,
              suggestedReply: aiResult.replyText,
            };
            msgs.push(aiMsg);
          }

          return {
            ...c,
            lastMessage: userText,
            lastMessageTime: userMsg.timestamp,
            treatmentInterest: aiResult.treatmentDetected || c.treatmentInterest,
            status: aiResult.requiresHumanHandoff ? ('human_takeover' as const) : c.status,
            messages: msgs,
            patientPhone: aiResult.extractedPatientInfo?.phone || c.patientPhone,
            preferredDate: aiResult.extractedPatientInfo?.preferredDate || c.preferredDate,
          };
        }
        return c;
      });

      return {
        ...prev,
        conversations: updatedConversations,
        webhookEventsLog: [webhookEvt, ...prev.webhookEventsLog.slice(0, 19)],
        analytics: {
          ...prev.analytics,
          totalInquiries: prev.analytics.totalInquiries + 1,
        },
      };
    });
  };

  const toggleConversationTakeover = (conversationId: string) => {
    setState((prev) => ({
      ...prev,
      conversations: prev.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, status: c.status === 'human_takeover' ? 'active_ai' : 'human_takeover' }
          : c
      ),
    }));
  };

  // Content Actions
  const addContentItem = (item: ContentItem) => {
    setState((prev) => ({
      ...prev,
      contentItems: [item, ...prev.contentItems],
    }));
  };

  const updateContentStatus = (itemId: string, status: ContentItem['status']) => {
    setState((prev) => ({
      ...prev,
      contentItems: prev.contentItems.map((c) => (c.id === itemId ? { ...c, status } : c)),
    }));
  };

  // Campaign Actions (with Human Approval Gate)
  const toggleCampaignStatus = (campaignId: string) => {
    setState((prev) => ({
      ...prev,
      campaigns: prev.campaigns.map((camp) =>
        camp.id === campaignId
          ? {
              ...camp,
              status: camp.status === 'active' ? 'paused' : 'active',
              requiresHumanApproval: false,
            }
          : camp
      ),
    }));
  };

  const resetAllData = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
    setState({
      currentLanguage: 'ar',
      selectedAccountId: 'drmustafa_hadi',
      accounts: INITIAL_ACCOUNTS,
      leads: INITIAL_LEADS,
      appointments: INITIAL_APPOINTMENTS,
      conversations: INITIAL_CONVERSATIONS,
      activeConversationId: 'conv_1',
      contentItems: INITIAL_CONTENT_ITEMS,
      campaigns: INITIAL_CAMPAIGNS,
      analytics: INITIAL_ANALYTICS,
      isAiAutoReplyEnabled: true,
      webhookEventsLog: [],
    });
  };

  return {
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
    resetAllData,
  };
}
