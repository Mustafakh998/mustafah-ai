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
  SubscriptionTier,
  TreatmentType,
  CommentAutomationRule,
  ReviewRequest,
} from '@/types';
import {
  INITIAL_ACCOUNTS,
  INITIAL_LEADS,
  INITIAL_APPOINTMENTS,
  INITIAL_CONVERSATIONS,
  INITIAL_CONTENT_ITEMS,
  INITIAL_CAMPAIGNS,
  INITIAL_ANALYTICS,
  INITIAL_COMMENT_RULES,
  INITIAL_REVIEW_REQUESTS,
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
  commentRules: CommentAutomationRule[];
  reviewRequests: ReviewRequest[];
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

export const CLEAN_ANALYTICS: AnalyticsMetrics = {
  totalInquiries: 0,
  qualifiedLeads: 0,
  appointmentRequests: 0,
  confirmedAppointments: 0,
  attendedPatients: 0,
  totalAdSpendUSD: 0,
  costPerQualifiedInquiryUSD: 0,
  costPerAttendedPatientUSD: 0,
  reach: 0,
  totalReelViews: 0,
  avgWatchTimeSeconds: 0,
  likesPerReachPercent: 0,
  sendsPerReachPercent: 0,
  savesCount: 0,
  profileVisits: 0,
  followerGrowth: 0,
};

export const CLEAN_INITIAL_STATE: AppState = {
  currentLanguage: 'ar',
  selectedAccountId: 'drmustafa_hadi',
  accounts: INITIAL_ACCOUNTS,
  leads: [],
  appointments: [],
  conversations: [],
  activeConversationId: '',
  contentItems: [],
  campaigns: [],
  commentRules: INITIAL_COMMENT_RULES,
  reviewRequests: INITIAL_REVIEW_REQUESTS,
  analytics: CLEAN_ANALYTICS,
  isAiAutoReplyEnabled: true,
  webhookEventsLog: [],
};

const STORAGE_KEY = 'mustafah_ai_state_v3_clean';

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
    return CLEAN_INITIAL_STATE;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [state]);

  // Real-time backend synchronization hook
  useEffect(() => {
    let isSubscribed = true;

    const syncWithRemoteBackend = async () => {
      try {
        const targetAccount = state.selectedAccountId !== 'all' ? state.selectedAccountId : 'drmustafa_hadi';
        const res = await fetch(`/api/conversations?accountId=${targetAccount}`);
        if (!res.ok || !isSubscribed) return;
        const data = await res.json();

        if (data.success && Array.isArray(data.conversations)) {
          setState((prev) => {
            const remoteConvs: Conversation[] = data.conversations;
            const remoteLeads: Lead[] = data.leads || [];
            const remoteApts: Appointment[] = data.appointments || [];

            // If no remote data yet, preserve local state
            if (remoteConvs.length === 0 && remoteLeads.length === 0) {
              return prev;
            }

            let activeId = prev.activeConversationId;
            if (!activeId || !remoteConvs.some((c) => c.id === activeId)) {
              activeId = remoteConvs[0]?.id || prev.activeConversationId;
            }

            const totalInquiries = Math.max(prev.analytics.totalInquiries, remoteConvs.length);
            const qualifiedLeads = remoteLeads.filter(
              (l) => l.status !== 'new_inquiry' && l.status !== 'lost'
            ).length;
            const confirmedAppointments = remoteApts.filter(
              (a) => a.status === 'confirmed' || a.status === 'attended'
            ).length;
            const attendedPatients = remoteApts.filter((a) => a.status === 'attended').length;

            return {
              ...prev,
              conversations: remoteConvs.length > 0 ? remoteConvs : prev.conversations,
              leads: remoteLeads.length > 0 ? remoteLeads : prev.leads,
              appointments: remoteApts.length > 0 ? remoteApts : prev.appointments,
              activeConversationId: activeId,
              analytics: {
                ...prev.analytics,
                totalInquiries,
                qualifiedLeads: Math.max(prev.analytics.qualifiedLeads, qualifiedLeads),
                confirmedAppointments: Math.max(prev.analytics.confirmedAppointments, confirmedAppointments),
                attendedPatients: Math.max(prev.analytics.attendedPatients, attendedPatients),
              },
            };
          });
        }
      } catch (err) {
        // Quietly ignore network polling errors
      }
    };

    // Immediate initial sync
    syncWithRemoteBackend();

    // 4-second live polling interval
    const intervalId = setInterval(syncWithRemoteBackend, 4000);

    return () => {
      isSubscribed = false;
      clearInterval(intervalId);
    };
  }, [state.selectedAccountId]);

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

      const apt = prev.appointments.find((a) => a.id === appointmentId);
      let updatedLeads = prev.leads;
      if (apt && newStatus === 'attended') {
        updatedLeads = prev.leads.map((l) => (l.id === apt.leadId ? { ...l, status: 'attended' } : l));
      } else if (apt && newStatus === 'confirmed') {
        updatedLeads = prev.leads.map((l) => (l.id === apt.leadId ? { ...l, status: 'confirmed' } : l));
      }

      const attended = updatedAppointments.filter((a) => a.status === 'attended').length;
      const confirmed = updatedAppointments.filter((a) => a.status === 'confirmed' || a.status === 'attended').length;

      return {
        ...prev,
        appointments: updatedAppointments,
        leads: updatedLeads,
        analytics: {
          ...prev.analytics,
          attendedPatients: attended,
          confirmedAppointments: confirmed,
        },
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

    setState((prev) => {
      const leadExists = prev.leads.some((l) => l.id === newApt.leadId);
      const updatedLeads: Lead[] = leadExists
        ? prev.leads.map((lead) =>
            lead.id === newApt.leadId ? { ...lead, status: 'confirmed' as const } : lead
          )
        : [
            {
              id: newApt.leadId,
              accountId: newApt.accountId,
              instagramUsername: 'direct_patient',
              patientName: newApt.patientName,
              phone: newApt.phone,
              treatment: newApt.treatment,
              treatmentNameAr: newApt.treatmentNameAr,
              status: 'confirmed' as const,
              inquiryDate: new Date().toISOString(),
              campaignSource: 'Manual Direct Reception Booking',
              estimatedValueIQD: 0,
              staffNotes: newApt.receptionNotes || 'حجز موعد كشفية',
              confidenceScore: 1.0,
              lastMessageText: 'تم تأكيد حجز الموعد يدوياً',
              lastMessageTime: new Date().toISOString(),
              isHandedOverToHuman: true,
              unreadCount: 0,
            },
            ...prev.leads,
          ];

      return {
        ...prev,
        appointments: [fullApt, ...prev.appointments],
        leads: updatedLeads,
        analytics: {
          ...prev.analytics,
          appointmentRequests: prev.analytics.appointmentRequests + 1,
          confirmedAppointments: prev.analytics.confirmedAppointments + 1,
        },
      };
    });
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

    // Persist staff reply to backend/Supabase
    fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'staff_reply',
        conversationId,
        text,
        sender,
      }),
    }).catch((err) => console.error('Failed to sync staff reply to Supabase:', err));
  };

  // Simulate user incoming message (or real webhook event)
  const simulateIncomingUserMessage = (userText: string, username = 'patient_iq') => {
    const targetAccountId =
      state.selectedAccountId !== 'all' ? state.selectedAccountId : 'drmustafa_hadi';

    let activeConv =
      state.conversations.find((c) => c.id === state.activeConversationId) ||
      state.conversations[0];

    const isNewConv = !activeConv;
    const convId = activeConv?.id || `conv_${Date.now()}`;
    const patientName =
      activeConv?.patientName ||
      (username === 'patient_iq' ? 'مراجع إنستغرام تجريبي' : `@${username}`);

    if (isNewConv) {
      activeConv = {
        id: convId,
        accountId: targetAccountId,
        instagramUsername: username,
        patientName,
        status: 'active_ai',
        lastMessage: userText,
        lastMessageTime: new Date().toISOString(),
        unread: true,
        messages: [],
      };
    }

    // 1. Add User Message
    const userMsgId = `usr_${Date.now()}`;
    const userMsg = {
      id: userMsgId,
      conversationId: convId,
      sender: 'user' as const,
      text: userText,
      timestamp: new Date().toISOString(),
    };

    // 2. Run Iraqi AI Language Engine (context-aware with conversation history)
    const historySnippet = (activeConv?.messages || []).map((m) => ({ sender: m.sender, text: m.text }));
    const aiResult = generateIraqiDialectResponse(userText, targetAccountId, patientName, historySnippet);

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
      let convs = prev.conversations;
      const existingConv = convs.find((c) => c.id === convId);

      const msgs = existingConv ? [...existingConv.messages, userMsg] : [userMsg];

      if (prev.isAiAutoReplyEnabled && (!existingConv || existingConv.status !== 'human_takeover')) {
        const aiMsg = {
          id: `ai_${Date.now() + 1}`,
          conversationId: convId,
          sender: 'assistant' as const,
          text: aiResult.replyText,
          timestamp: new Date(Date.now() + 1000).toISOString(),
          intent: aiResult.intent,
          confidence: aiResult.confidence,
          suggestedReply: aiResult.replyText,
        };
        msgs.push(aiMsg);
      }

      const updatedConv = {
        ...(existingConv || activeConv!),
        lastMessage: userText,
        lastMessageTime: userMsg.timestamp,
        treatmentInterest: aiResult.treatmentDetected || existingConv?.treatmentInterest || 'general_restorative',
        status: aiResult.requiresHumanHandoff ? ('human_takeover' as const) : (existingConv?.status || 'active_ai'),
        messages: msgs,
        patientPhone: aiResult.extractedPatientInfo?.phone || existingConv?.patientPhone,
        preferredDate: aiResult.extractedPatientInfo?.preferredDate || existingConv?.preferredDate,
      };

      if (existingConv) {
        convs = convs.map((c) => (c.id === convId ? updatedConv : c));
      } else {
        convs = [updatedConv, ...convs];
      }

      // Automatically create or update lead in CRM
      let updatedLeads = prev.leads;
      const existingLead = updatedLeads.find(
        (l) => l.instagramUsername === username || l.id === `lead_${username}`
      );

      if (existingLead) {
        updatedLeads = updatedLeads.map((l) =>
          l.id === existingLead.id
            ? {
                ...l,
                phone: aiResult.extractedPatientInfo?.phone || l.phone,
                treatment: (aiResult.treatmentDetected as TreatmentType) || l.treatment,
                status: aiResult.requiresHumanHandoff ? 'qualified' : l.status,
                lastMessageText: userText,
                lastMessageTime: new Date().toISOString(),
                unreadCount: (l.unreadCount || 0) + 1,
              }
            : l
        );
      } else {
        const detectedTreatment = (aiResult.treatmentDetected as TreatmentType) || 'general_restorative';
        const newLead: Lead = {
          id: `lead_${Date.now()}`,
          accountId: targetAccountId,
          instagramUsername: username,
          patientName,
          phone: aiResult.extractedPatientInfo?.phone,
          treatment: detectedTreatment,
          treatmentNameAr:
            detectedTreatment === 'orthodontics'
              ? 'تقويم أسنان'
              : detectedTreatment === 'cosmetic_emax'
              ? 'ابتسامة إيماكس'
              : 'كشفية أسنان',
          status: aiResult.requiresHumanHandoff ? 'qualified' : 'new_inquiry',
          inquiryDate: new Date().toISOString(),
          campaignSource: 'Organic Instagram DM',
          estimatedValueIQD: 0,
          staffNotes: userText,
          confidenceScore: aiResult.confidence || 0.9,
          lastMessageText: userText,
          lastMessageTime: new Date().toISOString(),
          isHandedOverToHuman: !!aiResult.requiresHumanHandoff,
          unreadCount: 1,
        };
        updatedLeads = [newLead, ...updatedLeads];
      }

      return {
        ...prev,
        conversations: convs,
        activeConversationId: convId,
        leads: updatedLeads,
        webhookEventsLog: [webhookEvt, ...prev.webhookEventsLog.slice(0, 19)],
        analytics: {
          ...prev.analytics,
          totalInquiries: prev.analytics.totalInquiries + 1,
          qualifiedLeads: prev.analytics.qualifiedLeads + (aiResult.requiresHumanHandoff ? 1 : 0),
        },
      };
    });

    // Persist simulated message to backend/Supabase
    fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'simulate',
        text: userText,
        username,
        accountId: targetAccountId,
        conversationId: convId,
        history: historySnippet,
      }),
    }).catch((err) => console.error('Failed to sync simulated message to Supabase:', err));
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

  const addCampaign = (camp: AdCampaign) => {
    setState((prev) => ({
      ...prev,
      campaigns: [camp, ...prev.campaigns],
    }));
  };

  const boostPostOrProfile = (params: {
    accountId: AccountId;
    objective: AdCampaign['objective'];
    headline: string;
    body: string;
    targetNeighborhoods: string[];
    dailyBudgetUSD: number;
    durationDays: number;
    boostedContentId?: string;
  }) => {
    const totalBudget = params.dailyBudgetUSD * params.durationDays;
    const isProfile = params.objective === 'profile_visits';
    const newCamp: AdCampaign = {
      id: `boost_${Date.now()}`,
      name: isProfile ? 'Boost Instagram Profile Visits' : 'Boost High-Retention Reel / Post',
      nameAr: isProfile
        ? `ترويج الملف الشخصي (@${params.accountId})`
        : `ترويج منشور سريري عالي التفاعل ($${totalBudget})`,
      accountId: params.accountId,
      objective: params.objective,
      allocatedBudgetUSD: totalBudget,
      spentUSD: 0,
      status: 'active',
      targetLocation: `Baghdad (${params.targetNeighborhoods.join(', ')})`,
      targetAudienceAr: `بغداد (${params.targetNeighborhoods.join('، ')}) — الفئة المستهدفة للأعمار 18-40 سنة`,
      reach: 0,
      impressions: 0,
      conversationsStarted: 0,
      qualifiedInquiries: 0,
      appointmentRequests: 0,
      confirmedAppointments: 0,
      attendedPatients: 0,
      requiresHumanApproval: false,
      boostedContentId: params.boostedContentId,
      dailyBudgetUSD: params.dailyBudgetUSD,
      durationDays: params.durationDays,
      targetNeighborhoods: params.targetNeighborhoods,
      adCreativeHeadline: params.headline,
      adCreativeBody: params.body,
      callToActionType: isProfile ? 'visit_profile' : 'send_message',
    };

    setState((prev) => ({
      ...prev,
      campaigns: [newCamp, ...prev.campaigns],
    }));
    return newCamp;
  };

  // Automation: Comment-to-DM Rules
  const toggleCommentRule = (ruleId: string) => {
    setState((prev) => ({
      ...prev,
      commentRules: (prev.commentRules || INITIAL_COMMENT_RULES).map((r) =>
        r.id === ruleId ? { ...r, isActive: !r.isActive } : r
      ),
    }));
  };

  const addCommentRule = (rule: CommentAutomationRule) => {
    setState((prev) => ({
      ...prev,
      commentRules: [rule, ...(prev.commentRules || INITIAL_COMMENT_RULES)],
    }));
  };

  // Local SEO: Google Maps Review Requests
  const sendReviewRequest = (requestId: string) => {
    setState((prev) => {
      const updated = (prev.reviewRequests || INITIAL_REVIEW_REQUESTS).map((req) =>
        req.id === requestId ? { ...req, status: 'sent' as const } : req
      );
      return {
        ...prev,
        reviewRequests: updated,
      };
    });
  };

  // CRM: Lapsed Patient Re-engagement
  const reengageLead = (leadId: string, customMessage?: string) => {
    const lead = state.leads.find((l) => l.id === leadId);
    if (!lead) return;

    const patientName = lead.patientName || 'عزيزي المراجع';
    const msgText =
      customMessage ||
      `مرحباً عيوني ${patientName} 🌸 إن شاء الله تكون بألف خير وصحة.\nتواصلت ويانا قبل فترة بخصوص استفسارك عن ${lead.treatmentNameAr || 'علاج الأسنان'} وحبينا نتطمن عليك ونشوف إذا تحب نجدول لحضرتك موعد كشفية واستشارة مجانية بالعيادة هذا الأسبوع.\nعيادة د. مصطفى هادي بزيونة بخدمتك دائماً 💚`;

    // Send or queue message in conversation
    const activeConv = state.conversations.find((c) => c.instagramUsername === lead.instagramUsername);
    if (activeConv) {
      sendMessage(activeConv.id, msgText, 'staff');
    }

    setState((prev) => ({
      ...prev,
      leads: prev.leads.map((l) =>
        l.id === leadId
          ? {
              ...l,
              status: 'qualified',
              staffNotes: `${l.staffNotes || ''}\n[${new Date().toLocaleDateString('ar-IQ')}]: تم إرسال رسالة إعادة تنشيط دافئة.`,
              lastMessageText: msgText,
              lastMessageTime: new Date().toISOString(),
            }
          : l
      ),
    }));
  };

  const registerClinic = (params: {
    name: string;
    city: string;
    phone: string;
    plan: SubscriptionTier;
    leadDoctor?: string;
  }) => {
    const cleanSlug =
      params.name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .slice(0, 20) || `clinic_${Date.now()}`;
    const accountId = `tenant_${cleanSlug}_${Date.now()}`;

    const newAccount: InstagramAccount = {
      id: accountId,
      handle: `${cleanSlug}.iq`,
      name: params.name,
      nameAr: params.name,
      category: 'Dental Clinic',
      categoryAr: 'عيادة أسنان تخصصية',
      followers: 0,
      following: 0,
      postsCount: 0,
      avatarUrl:
        'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=200&auto=format&fit=crop&q=80',
      isVerified: false,
      status: 'connected',
      tokenExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      role: 'clinic_official',
      bio: `Official account of ${params.name} | 📍 ${params.city}`,
      bioAr: `الحساب الرسمي لـ ${params.name} | 📍 ${params.city} | هاتف: ${params.phone}`,
      location: params.city,
      locationAr: params.city,
      phone: params.phone,
      permissions: {
        instagram_basic: true,
        instagram_manage_messages: true,
        pages_manage_metadata: true,
        instagram_manage_comments: true,
      },
    };

    setState((prev) => ({
      ...prev,
      accounts: [...prev.accounts, newAccount],
      selectedAccountId: newAccount.id,
    }));
  };

  const resetAllData = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('mustafah_ai_state_v1');
      localStorage.removeItem('almeswak_ai_baghdad_state_v1');
    }
    setState(CLEAN_INITIAL_STATE);
  };

  const loadDemoData = () => {
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
      commentRules: INITIAL_COMMENT_RULES,
      reviewRequests: INITIAL_REVIEW_REQUESTS,
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
    addCampaign,
    boostPostOrProfile,
    toggleCommentRule,
    addCommentRule,
    sendReviewRequest,
    reengageLead,
    registerClinic,
    resetAllData,
    loadDemoData,
  };
}
