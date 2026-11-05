'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bot, GraduationCap, Loader2, Plus, Send, ShieldCheck, Trash2 } from 'lucide-react';
import { Language } from '@/types';
import { Card, ErrorState, Item, Skeleton, Stagger, fetchJson } from '@/components/ui/kit';
import { toast } from '@/lib/toast';

interface Example {
  id: string;
  customerMessage: string;
  staffReply: string;
  source: 'curated' | 'learned';
}
interface StyleData {
  configured: boolean;
  needsMigration?: boolean;
  curated: Example[];
  learned: Example[];
}
interface TestResult {
  replyText: string;
  intent: string;
  mode: 'auto' | 'draft';
}

export const ReplyStyleView: React.FC<{ language: Language }> = ({ language }) => {
  const isAr = language === 'ar';
  const [data, setData] = useState<StyleData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customer, setCustomer] = useState('');
  const [reply, setReply] = useState('');
  const [saving, setSaving] = useState(false);
  const [testMsg, setTestMsg] = useState('شكد سعر التقويم؟ وعدكم أقساط؟');
  const [test, setTest] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await fetchJson<StyleData>('/api/ai/style'));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    fetchJson<StyleData>('/api/ai/style')
      .then(setData)
      .catch((e) => setError((e as Error).message));
  }, []);

  const save = async () => {
    if (!customer.trim() || !reply.trim()) return;
    setSaving(true);
    try {
      await fetchJson('/api/ai/style', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerMessage: customer, staffReply: reply }),
      });
      setCustomer('');
      setReply('');
      toast(isAr ? 'تمت إضافة المثال، المساعد راح يتعلم منه' : 'Example added');
      load();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await fetchJson(`/api/ai/style?id=${id}`, { method: 'DELETE' });
      setData((d) => (d ? { ...d, curated: d.curated.filter((x) => x.id !== id) } : d));
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const runTest = async () => {
    if (!testMsg.trim()) return;
    setTesting(true);
    setTest(null);
    try {
      setTest(await fetchJson<TestResult>('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: testMsg, patientName: 'أحمد' }),
      }));
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setTesting(false);
    }
  };

  return (
    <Stagger className="space-y-5 max-w-5xl mx-auto">
      <Item>
        <Card className="p-5 space-y-2">
          <h1 className="text-lg font-black text-slate-900 flex items-center gap-2"><GraduationCap className="w-5 h-5 text-emerald-600" /> {isAr ? 'علّم المساعد أسلوبكم بالرد' : 'Teach the assistant your reply style'}</h1>
          <p className="text-sm text-slate-600">
            {isAr
              ? 'المساعد يقرأ أمثلتكم هنا وآخر ردود الفريق الحقيقية بالدايركت، ويقلد نفس النبرة والكلمات. كل ما تردون أكثر، يتعلم أكثر.'
              : 'The assistant reads the examples here plus your team’s latest real DM replies, and copies the same tone and wording.'}
          </p>
          <div className="flex items-start gap-2 text-xs text-slate-600 bg-slate-50 rounded-xl p-3">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              {isAr
                ? 'يرسل تلقائياً فقط للأسئلة البسيطة (العنوان، الدوام، معلومات عامة). أسئلة الأسعار، الحجز، والطوارئ تنحفظ كمسودة بالمحادثات وتنتظر موافقتكم.'
                : 'Auto-sends only simple questions (location, hours, general info). Pricing, booking, and emergencies are saved as drafts in the inbox for your approval.'}
            </span>
          </div>
        </Card>
      </Item>

      {error && <ErrorState error={error} isAr={isAr} onRetry={load} />}
      {data?.needsMigration && (
        <ErrorState isAr={isAr} error={isAr ? 'جدول الأمثلة غير موجود بعد. شغّل ملف supabase/migrations/20261105000000_reply_style_examples.sql بمحرر SQL في Supabase.' : 'The examples table does not exist yet. Run supabase/migrations/20261105000000_reply_style_examples.sql in the Supabase SQL editor.'} />
      )}
      {data && !data.configured && (
        <ErrorState isAr={isAr} error={isAr ? 'قاعدة البيانات (Supabase) غير مربوطة، فما نكدر نحفظ الأمثلة.' : 'Supabase is not configured, so examples cannot be saved.'} />
      )}

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Add example */}
        <Item>
          <Card className="p-5 space-y-3 h-full">
            <h2 className="font-bold text-slate-900">{isAr ? 'أضف مثال' : 'Add an example'}</h2>
            <textarea value={customer} onChange={(e) => setCustomer(e.target.value)} rows={2} dir="rtl" maxLength={1000}
              placeholder={isAr ? 'رسالة المراجع… مثلاً: دكتور التقويم يوجع؟' : 'Patient message…'}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={4} dir="rtl" maxLength={2000}
              placeholder={isAr ? 'شلون ترد عليه أنت…' : 'How you would reply…'}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            <button onClick={save} disabled={saving || !customer.trim() || !reply.trim() || data?.configured === false || data?.needsMigration}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-4 py-2 rounded-xl disabled:opacity-40 transition-colors">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} {isAr ? 'احفظ المثال' : 'Save example'}
            </button>
          </Card>
        </Item>

        {/* Test */}
        <Item>
          <Card className="p-5 space-y-3 h-full">
            <h2 className="font-bold text-slate-900 flex items-center gap-2"><Bot className="w-5 h-5 text-violet-500" /> {isAr ? 'جرّب المساعد' : 'Try the assistant'}</h2>
            <div className="flex gap-2">
              <input value={testMsg} onChange={(e) => setTestMsg(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && runTest()} dir="rtl"
                className="flex-1 min-w-0 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
              <button onClick={runTest} disabled={testing} className="bg-violet-600 hover:bg-violet-700 text-white px-3 rounded-xl disabled:opacity-50" aria-label="Test">
                {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
            <AnimatePresence mode="wait">
              {testing && <motion.div key="l" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><Skeleton className="h-24" /></motion.div>}
              {test && (
                <motion.div key="r" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                  <span className={`inline-block text-[11px] font-bold px-2.5 py-1 rounded-full ${test.mode === 'auto' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
                    {test.mode === 'auto' ? (isAr ? 'ينرسل تلقائياً' : 'Would auto-send') : isAr ? 'ينحفظ كمسودة للموافقة' : 'Saved as draft for approval'}
                  </span>
                  <div className="bg-slate-50 rounded-2xl rounded-ss-sm p-3.5 text-sm text-slate-800 whitespace-pre-wrap leading-relaxed" dir="rtl">{test.replyText}</div>
                  <div className="text-[10px] text-slate-400 font-mono">intent: {test.intent}</div>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </Item>
      </div>

      {!data && !error && <Skeleton className="h-40" />}
      {data && (
        <Item className="grid lg:grid-cols-2 gap-5">
          <ExampleList title={isAr ? `أمثلتكم (${data.curated.length})` : `Your examples (${data.curated.length})`} items={data.curated} onDelete={remove} isAr={isAr}
            empty={isAr ? 'ما أضفتوا أمثلة بعد.' : 'No examples yet.'} />
          <ExampleList title={isAr ? `متعلّم من ردود الفريق (${data.learned.length})` : `Learned from team replies (${data.learned.length})`} items={data.learned} isAr={isAr}
            empty={isAr ? 'لما الفريق يرد من صندوق المحادثات، الردود تظهر هنا تلقائياً.' : 'Replies sent from the inbox appear here automatically.'} />
        </Item>
      )}
    </Stagger>
  );
};

const ExampleList: React.FC<{ title: string; items: Example[]; isAr: boolean; empty: string; onDelete?: (id: string) => void }> = ({ title, items, isAr, empty, onDelete }) => (
  <Card className="p-5 space-y-3">
    <h2 className="font-bold text-slate-900 text-sm">{title}</h2>
    {items.length === 0 && <p className="text-xs text-slate-500">{empty}</p>}
    <AnimatePresence initial={false}>
      {items.map((e) => (
        <motion.div key={e.id} layout exit={{ opacity: 0, height: 0 }} className="rounded-xl border border-slate-200 p-3 space-y-1.5 text-xs" dir="rtl">
          <div className="text-slate-500">👤 {e.customerMessage}</div>
          <div className="text-slate-800 bg-emerald-50 rounded-lg p-2">💬 {e.staffReply}</div>
          {onDelete && (
            <button onClick={() => onDelete(e.id)} className="text-rose-600 hover:text-rose-700 inline-flex items-center gap-1 text-[11px] font-semibold">
              <Trash2 className="w-3.5 h-3.5" /> {isAr ? 'حذف' : 'Delete'}
            </button>
          )}
        </motion.div>
      ))}
    </AnimatePresence>
  </Card>
);
