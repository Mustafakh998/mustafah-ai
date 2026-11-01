export type Language = 'ar' | 'en';

export type AccountId = 'drmustafa_hadi' | 'almeswaksmile_iq';

export type NavTabId =
  | 'overview'
  | 'pilot_demo'
  | 'accounts'
  | 'inbox'
  | 'ai_settings'
  | 'knowledge_base'
  | 'leads_crm'
  | 'appointments'
  | 'content_studio'
  | 'content_calendar'
  | 'ad_campaigns'
  | 'analytics'
  | 'admin';

export type PilotIntentType =
  | 'general_dental_education'
  | 'personal_professional_inquiry'
  | 'orthodontic_inquiry'
  | 'consultation_request'
  | 'collaboration_request'
  | 'urgent_clinical_question'
  | 'human_attention_required'
  | 'location_and_directions';

export interface InstagramAccount {
  id: AccountId;
  handle: string;
  name: string;
  nameAr: string;
  category: string;
  categoryAr: string;
  followers: number;
  following: number;
  postsCount: number;
  avatarUrl: string;
  isVerified: boolean;
  status: 'connected' | 'demo_mode' | 'disconnected' | 'token_expiring';
  tokenExpiresAt: string;
  role: 'personal_brand' | 'clinic_official';
  bio: string;
  bioAr: string;
  location: string;
  locationAr: string;
  phone: string;
  permissions: {
    instagram_basic: boolean;
    instagram_manage_messages: boolean;
    pages_manage_metadata: boolean;
    instagram_manage_comments: boolean;
  };
}

export type LeadStatus =
  | 'new_inquiry'
  | 'qualified'
  | 'appointment_requested'
  | 'confirmed'
  | 'attended'
  | 'lost';

export type TreatmentType =
  | 'orthodontics'
  | 'cosmetic_emax'
  | 'pediatric'
  | 'teeth_whitening'
  | 'general_restorative'
  | 'facial_aesthetics'
  | 'consultation';

export interface Lead {
  id: string;
  accountId: AccountId;
  instagramUsername: string;
  patientName: string;
  phone?: string;
  treatment: TreatmentType;
  treatmentNameAr: string;
  status: LeadStatus;
  inquiryDate: string;
  campaignSource: string;
  estimatedValueIQD: number;
  staffNotes: string;
  confidenceScore: number;
  lastMessageText: string;
  lastMessageTime: string;
  isHandedOverToHuman: boolean;
  unreadCount?: number;
}

export type AppointmentStatus =
  | 'new_request'
  | 'awaiting_confirmation'
  | 'confirmed'
  | 'attended'
  | 'cancelled'
  | 'no_show';

export interface Appointment {
  id: string;
  leadId: string;
  patientName: string;
  phone: string;
  accountId: AccountId;
  treatment: TreatmentType;
  treatmentNameAr: string;
  preferredDate: string;
  preferredTime: string;
  assignedDoctor: string;
  assignedDoctorAr: string;
  status: AppointmentStatus;
  receptionNotes: string;
  createdAt: string;
  confirmedAt?: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  sender: 'user' | 'assistant' | 'staff';
  text: string;
  timestamp: string;
  intent?: string;
  confidence?: number;
  suggestedReply?: string;
}

export interface Conversation {
  id: string;
  accountId: AccountId;
  instagramUsername: string;
  patientName: string;
  status: 'active_ai' | 'human_takeover' | 'booked' | 'archived';
  treatmentInterest?: TreatmentType;
  unread: boolean;
  lastMessage: string;
  lastMessageTime: string;
  messages: ChatMessage[];
  patientPhone?: string;
  preferredDate?: string;
}

export interface TreatmentService {
  id: TreatmentType;
  nameEn: string;
  nameAr: string;
  doctorInCharge: string;
  doctorInChargeAr: string;
  priceRangeIQD: string;
  priceRangeUSD: string;
  durationInfoAr: string;
  guaranteeAr?: string;
  descriptionAr: string;
  faqs: { qAr: string; aAr: string }[];
}

export interface ContentItem {
  id: string;
  accountId: AccountId;
  title: string;
  titleAr: string;
  format: 'reel' | 'carousel' | 'story';
  seriesNameAr: string;
  hookAr: string;
  scriptAr: string;
  visualDirectionAr: string;
  captionAr: string;
  ctaAr: string;
  coverHeadlineAr: string;
  targetAudienceAr: string;
  scheduledDate: string;
  status: 'draft' | 'review_needed' | 'approved' | 'published';
  views?: number;
  likes?: number;
  shares?: number;
  inquiriesGenerated?: number;
}

export interface AdCampaign {
  id: string;
  name: string;
  nameAr: string;
  accountId: AccountId;
  objective: 'click_to_instagram_direct' | 'reel_engagement' | 'retargeting';
  allocatedBudgetUSD: number;
  spentUSD: number;
  status: 'active' | 'paused' | 'draft_pending_approval';
  targetLocation: string;
  targetAudienceAr: string;
  reach: number;
  impressions: number;
  conversationsStarted: number;
  qualifiedInquiries: number;
  appointmentRequests: number;
  confirmedAppointments: number;
  attendedPatients: number;
  requiresHumanApproval: boolean;
}

export interface AnalyticsMetrics {
  totalInquiries: number;
  qualifiedLeads: number;
  appointmentRequests: number;
  confirmedAppointments: number;
  attendedPatients: number;
  totalAdSpendUSD: number;
  costPerQualifiedInquiryUSD: number;
  costPerAttendedPatientUSD: number;
  reach: number;
  totalReelViews: number;
  avgWatchTimeSeconds: number;
  likesPerReachPercent: number;
  sendsPerReachPercent: number;
  savesCount: number;
  profileVisits: number;
  followerGrowth: number;
}

export * from './tenant';
