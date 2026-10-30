import React, { useState } from 'react';
import {
  MessageSquare,
  Search,
  Filter,
  User,
  Bot,
  UserCheck,
  Send,
  Phone,
  CalendarCheck,
  Sparkles,
  MapPin,
  Clock,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { AppState } from '@/lib/store';
import { AccountId, Language, Conversation, ChatMessage, TreatmentType } from '@/types';

interface InboxViewProps {
  state: AppState;
  onSendMessage: (conversationId: string, text: string, sender: 'assistant' | 'staff') => void;
  onToggleTakeover: (conversationId: string) => void;
  onSelectConversation: (id: string) => void;
  onCreateAppointment: (apt: any) => void;
  onNavigate: (tab: any) => void;
}

export const InboxView: React.FC<InboxViewProps> = ({
  state,
  onSendMessage,
  onToggleTakeover,
  onSelectConversation,
  onCreateAppointment,
  onNavigate,
}) => {
  const isAr = state.currentLanguage === 'ar';
  const { conversations, activeConversationId, selectedAccountId } = state;

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active_ai' | 'human_takeover' | 'booked'>('all');
  const [replyInput, setReplyInput] = useState('');

  // Filter conversations
  const filteredConvs = conversations.filter((c) => {
    if (selectedAccountId !== 'all' && c.accountId !== selectedAccountId) return false;
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return c.patientName.toLowerCase().includes(q) || c.instagramUsername.toLowerCase().includes(q);
    }
    return true;
  });

  const activeConv = conversations.find((c) => c.id === activeConversationId) || conversations[0];

  const handleSend = () => {
    if (!replyInput.trim() || !activeConv) return;
    onSendMessage(activeConv.id, replyInput.trim(), 'staff');
    setReplyInput('');
  };

  const handleApplySuggested = (suggested: string) => {
    if (!activeConv) return;
    onSendMessage(activeConv.id, suggested, 'assistant');
  };

  const handleQuickBookAppointment = () => {
    if (!activeConv) return;
    onCreateAppointment({
      leadId: `lead_from_${activeConv.id}`,
      patientName: activeConv.patientName,
      phone: activeConv.patientPhone || '07700000000',
      accountId: activeConv.accountId,
      treatment: activeConv.treatmentInterest || 'orthodontics',
      treatmentNameAr: activeConv.treatmentInterest === 'cosmetic_emax' ? 'ابتسامة إيماكس' : 'تقويم أسنان',
      preferredDate: activeConv.preferredDate || new Date().toISOString().split('T')[0],
      preferredTime: '05:00 PM',
      assignedDoctor: activeConv.accountId === 'drmustafa_hadi' ? 'Dr. Mustafa Hadi' : 'Clinic Team',
      assignedDoctorAr: activeConv.accountId === 'drmustafa_hadi' ? 'د. مصطفى هادي' : 'فريق العيادة',
      status: 'new_request',
      receptionNotes: `تم الحجز السريع من صندوق المحادثات لمريض الإنستغرام @${activeConv.instagramUsername}`,
    });
    alert(isAr ? 'تم تحويل المحادثة إلى طلب موعد في جدول الحجوزات بنجاح!' : 'Appointment created successfully!');
    onNavigate('appointments');
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-130px)]">
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Conversations List */}
        <div className="w-80 border-e border-slate-200 flex flex-col shrink-0 bg-slate-50/50">
          {/* Search & Filters */}
          <div className="p-3 border-b border-slate-200 space-y-2 bg-white">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute top-2.5 start-2.5" />
              <input
                type="text"
                placeholder={isAr ? 'بحث بالاسم أو المعرف...' : 'Search conversations...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-100 rounded-xl ps-8 pe-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto text-[11px] font-semibold text-slate-600 pb-1">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2 py-1 rounded-lg shrink-0 transition-colors ${
                  statusFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 hover:bg-slate-200'
                }`}
              >
                {isAr ? 'الكل' : 'All'}
              </button>
              <button
                onClick={() => setStatusFilter('active_ai')}
                className={`px-2 py-1 rounded-lg shrink-0 transition-colors ${
                  statusFilter === 'active_ai' ? 'bg-emerald-600 text-white' : 'bg-slate-100 hover:bg-slate-200'
                }`}
              >
                {isAr ? 'رد آلي' : 'AI Active'}
              </button>
              <button
                onClick={() => setStatusFilter('human_takeover')}
                className={`px-2 py-1 rounded-lg shrink-0 transition-colors ${
                  statusFilter === 'human_takeover' ? 'bg-amber-600 text-white' : 'bg-slate-100 hover:bg-slate-200'
                }`}
              >
                {isAr ? 'تدخل بشري' : 'Human'}
              </button>
              <button
                onClick={() => setStatusFilter('booked')}
                className={`px-2 py-1 rounded-lg shrink-0 transition-colors ${
                  statusFilter === 'booked' ? 'bg-blue-600 text-white' : 'bg-slate-100 hover:bg-slate-200'
                }`}
              >
                {isAr ? 'محجوز' : 'Booked'}
              </button>
            </div>
          </div>

          {/* Conversations Scrollable List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredConvs.map((conv) => {
              const isSelected = activeConv?.id === conv.id;
              return (
                <div
                  key={conv.id}
                  onClick={() => onSelectConversation(conv.id)}
                  className={`p-3.5 cursor-pointer transition-all text-start relative ${
                    isSelected ? 'bg-emerald-50/70 border-s-4 border-emerald-600' : 'hover:bg-slate-100/70'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs truncate">
                      <span>{conv.patientName}</span>
                      {conv.unread && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(conv.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500 font-mono mb-1">
                    @{conv.instagramUsername} • {conv.accountId === 'drmustafa_hadi' ? 'د. مصطفى' : 'العيادة'}
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-1 leading-snug">
                    {conv.lastMessage}
                  </p>

                  <div className="mt-2 flex items-center justify-between">
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        conv.status === 'human_takeover'
                          ? 'bg-amber-100 text-amber-800'
                          : conv.status === 'booked'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {conv.status === 'human_takeover'
                        ? isAr
                          ? 'استقبال بشري'
                          : 'Human Agent'
                        : conv.status === 'booked'
                        ? isAr
                          ? 'حجز موعد'
                          : 'Booked'
                        : isAr
                        ? 'مساعد الذكاء'
                        : 'AI Active'}
                    </span>

                    {conv.treatmentInterest && (
                      <span className="text-[10px] text-slate-500 font-medium">
                        {conv.treatmentInterest === 'orthodontics'
                          ? 'تقويم'
                          : conv.treatmentInterest === 'cosmetic_emax'
                          ? 'إيماكس'
                          : conv.treatmentInterest === 'pediatric'
                          ? 'أطفال'
                          : 'علاج'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Center Column: Active Conversation */}
        <div className="flex-1 flex flex-col bg-white">
          {activeConv ? (
            <>
              {/* Chat Header */}
              <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-sm shadow-sm">
                    {activeConv.patientName[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{activeConv.patientName}</span>
                      <span className="text-xs text-slate-400 font-mono">@{activeConv.instagramUsername}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2">
                      <span>
                        {isAr ? 'الحساب المستهدف:' : 'Via:'}{' '}
                        {activeConv.accountId === 'drmustafa_hadi' ? '@drmustafa_hadi' : '@almeswaksmile.iq'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onToggleTakeover(activeConv.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                      activeConv.status === 'human_takeover'
                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                    }`}
                  >
                    {activeConv.status === 'human_takeover' ? (
                      <>
                        <UserCheck className="w-3.5 h-3.5 text-amber-600" />
                        <span>{isAr ? 'الاستقبال يستلم (إرجاع للذكاء؟)' : 'Staff Mode (Switch to AI)'}</span>
                      </>
                    ) : (
                      <>
                        <Bot className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{isAr ? 'الذكاء مجيب (تدخل بشري؟)' : 'AI Mode (Takeover)'}</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleQuickBookAppointment}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-colors"
                  >
                    <CalendarCheck className="w-3.5 h-3.5" />
                    <span>{isAr ? 'تثبيت موعد كشفية' : 'Book Appointment'}</span>
                  </button>
                </div>
              </div>

              {/* Messages Flow */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/60">
                {activeConv.messages.map((msg) => {
                  const isUser = msg.sender === 'user';
                  const isStaff = msg.sender === 'staff';

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isUser ? 'items-start' : 'items-end'}`}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5 text-[10px] text-slate-400">
                        {isUser ? (
                          <span className="font-semibold text-slate-600">{activeConv.patientName}</span>
                        ) : isStaff ? (
                          <span className="font-semibold text-blue-600 flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {isAr ? 'موظفة الاستقبال' : 'Reception Staff'}
                          </span>
                        ) : (
                          <span className="font-semibold text-emerald-600 flex items-center gap-1">
                            <Bot className="w-3 h-3" />
                            {isAr ? 'مساعد الذكاء العراقي' : 'Iraqi AI'}
                          </span>
                        )}
                        <span>
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div
                        className={`max-w-[75%] p-3.5 rounded-2xl text-xs leading-relaxed shadow-sm whitespace-pre-wrap ${
                          isUser
                            ? 'bg-white text-slate-800 border border-slate-200 rounded-tl-sm'
                            : isStaff
                            ? 'bg-blue-600 text-white rounded-tr-sm'
                            : 'bg-slate-900 text-slate-100 rounded-tr-sm'
                        }`}
                      >
                        {msg.text}
                      </div>

                      {/* AI Intent & Confidence Badge */}
                      {msg.intent && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                          <span>Intent: {msg.intent}</span>
                          <span>•</span>
                          <span>Conf: {Math.round((msg.confidence || 0.9) * 100)}%</span>
                        </div>
                      )}

                      {/* AI Suggested Reply Pill (if present on user message) */}
                      {msg.suggestedReply && isUser && (
                        <div className="mt-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 max-w-[80%] text-xs text-emerald-950 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-bold text-emerald-800">
                            <span className="flex items-center gap-1">
                              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                              {isAr ? 'الرد المقترح بالعامية البغدادية:' : 'Suggested Iraqi Reply:'}
                            </span>
                            <button
                              onClick={() => handleApplySuggested(msg.suggestedReply!)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-0.5 rounded-lg text-[10px] font-bold transition-colors"
                            >
                              {isAr ? 'اعتماد وإرسال فوراً' : 'Accept & Send'}
                            </button>
                          </div>
                          <p className="font-sans leading-relaxed text-slate-700 italic">
                            "{msg.suggestedReply}"
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Quick Canned Buttons */}
              <div className="px-4 py-2 border-t border-slate-200 bg-slate-50 flex items-center gap-2 overflow-x-auto text-[11px]">
                <span className="text-slate-400 text-xs shrink-0 font-medium">
                  {isAr ? 'ردود سريعة:' : 'Quick Canned:'}
                </span>
                <button
                  onClick={() =>
                    setReplyInput(
                      'أهلاً بيك نورتنا 💚 عنواننا: بغداد – زيونة – خدمي دريم سيتي مول (مجاور مطعم صيف وشتاء، الطابق السادس شقة 6).'
                    )
                  }
                  className="px-2.5 py-1 bg-white hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-300 shrink-0 flex items-center gap-1"
                >
                  <MapPin className="w-3 h-3 text-emerald-600" />
                  <span>{isAr ? 'العنوان' : 'Location'}</span>
                </button>
                <button
                  onClick={() =>
                    setReplyInput(
                      'أوقات الدوام في عيادة المسواك من السبت إلى الخميس: من الساعة 2:00 ظهراً وحتى 9:00 مساءً ⏰ الجمعة عطلة.'
                    )
                  }
                  className="px-2.5 py-1 bg-white hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-300 shrink-0 flex items-center gap-1"
                >
                  <Clock className="w-3 h-3 text-blue-600" />
                  <span>{isAr ? 'أوقات الدوام' : 'Working Hours'}</span>
                </button>
                <button
                  onClick={() =>
                    setReplyInput(
                      'كلفة كشفية وفحص التقويم مجانية عند بدء العلاج، ونوفر نظام أقساط شهرية مريحة جداً تناسب ميزانيتك 💚'
                    )
                  }
                  className="px-2.5 py-1 bg-white hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-300 shrink-0 flex items-center gap-1"
                >
                  <DollarSign className="w-3 h-3 text-amber-600" />
                  <span>{isAr ? 'الأقساط والكشفية' : 'Prices & Installments'}</span>
                </button>
              </div>

              {/* Chat Input Bar */}
              <div className="p-3 border-t border-slate-200 bg-white flex items-center gap-2">
                <input
                  type="text"
                  placeholder={
                    isAr
                      ? 'اكتب رداً للمريض (أو استخدم الرد المقترح للذكاء الاصطناعي)...'
                      : 'Type a message to the patient...'
                  }
                  value={replyInput}
                  onChange={(e) => setReplyInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  className="flex-1 bg-slate-100 rounded-xl px-4 py-2.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-sans"
                />
                <button
                  onClick={handleSend}
                  disabled={!replyInput.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isAr ? 'إرسال' : 'Send'}</span>
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
              {isAr ? 'اختر محادثة لعرض التفاصيل' : 'Select a conversation to view'}
            </div>
          )}
        </div>

        {/* Right Column: Patient Profile & Actionable Card */}
        {activeConv && (
          <div className="w-72 border-s border-slate-200 p-4 shrink-0 bg-slate-50/70 overflow-y-auto space-y-4">
            <div>
              <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-2">
                {isAr ? 'بيانات المراجع المستخلصة' : 'Extracted Patient Profile'}
              </h4>
              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2.5 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">{isAr ? 'الاسم:' : 'Name:'}</span>
                  <span className="font-bold text-slate-800">{activeConv.patientName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">{isAr ? 'الهاتف:' : 'Phone:'}</span>
                  <span className="font-mono font-bold text-emerald-700">
                    {activeConv.patientPhone || (isAr ? 'بانتظار تزويد الرقم' : 'Pending')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">{isAr ? 'الاهتمام بالعلاج:' : 'Treatment:'}</span>
                  <span className="font-semibold text-slate-800">
                    {activeConv.treatmentInterest === 'orthodontics'
                      ? 'تقويم الأسنان (Dr. Mustafa)'
                      : activeConv.treatmentInterest === 'cosmetic_emax'
                      ? 'ابتسامة إيماكس (Dr. Ahmed)'
                      : 'علاج واستشارة'}
                  </span>
                </div>
                {activeConv.preferredDate && (
                  <div>
                    <span className="text-slate-400 block text-[10px]">{isAr ? 'الموعد المفضل:' : 'Preferred Date:'}</span>
                    <span className="font-semibold text-slate-800">{activeConv.preferredDate}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Direct WhatsApp CTA */}
            {activeConv.patientPhone ? (
              <a
                href={`https://wa.me/964${activeConv.patientPhone.replace(/^0/, '')}?text=${encodeURIComponent(
                  `أهلاً وسهلاً بحضرتك ${activeConv.patientName} من عيادة المسواك في زيونة بخصوص استفسارك على إنستغرام.`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>{isAr ? 'فتح المحادثة عبر واتساب' : 'Open in WhatsApp'}</span>
              </a>
            ) : null}

            {/* Fast Appointment Button */}
            <button
              onClick={handleQuickBookAppointment}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2"
            >
              <CalendarCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isAr ? 'إنشاء حجز في جدول المواعيد' : 'Create Appointment Entry'}</span>
            </button>

            {/* Quick Clinic Info Box */}
            <div className="p-3 bg-slate-100 rounded-xl text-[11px] text-slate-600 space-y-1">
              <div className="font-bold text-slate-800">{isAr ? 'تذكير موظف الاستقبال:' : 'Reception Protocol:'}</div>
              <p>
                {isAr
                  ? 'لا يتم تصنيف المراجع كموعد مؤكد إلا بعد الاتصال به هاتفياً أو تأكيد حضوره المباشر في سجلات العيادة.'
                  : 'Appointments must be verified manually via phone call before marking as confirmed.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
