'use client';

import React from 'react';
import { motion } from 'motion/react';
import { AlertCircle, KeyRound, RefreshCw } from 'lucide-react';

/** Container whose children fade/slide in one after another. Wrap children in <Item>. */
export const Stagger: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <motion.div
    className={className}
    initial="hidden"
    animate="show"
    variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
  >
    {children}
  </motion.div>
);

export const Item: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <motion.div
    className={className}
    variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 24 } } }}
  >
    {children}
  </motion.div>
);

export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm ${className}`}>{children}</div>
);

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse rounded-xl bg-slate-200/70 ${className}`} />
);

/** Animated 0–100 score ring. */
export const ScoreRing: React.FC<{ score: number; size?: number; label?: string }> = ({ score, size = 112, label }) => {
  const r = size / 2 - 9;
  const c = 2 * Math.PI * r;
  const color = score >= 75 ? '#059669' : score >= 50 ? '#d97706' : '#e11d48';
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#e2e8f0" strokeWidth={9} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={9}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - score / 100) }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black text-slate-900">{score}</span>
        {label && <span className="text-[11px] text-slate-500 font-semibold">{label}</span>}
      </div>
    </div>
  );
};

/** Horizontal bar that grows to `value` (0..1). */
export const Bar: React.FC<{ value: number; className?: string }> = ({ value, className = 'bg-emerald-500' }) => (
  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
    <motion.div
      className={`h-full rounded-full ${className}`}
      initial={{ width: 0 }}
      animate={{ width: `${Math.min(100, Math.max(2, value * 100))}%` }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
    />
  </div>
);

export const Stat: React.FC<{ label: string; value: string; hint?: string }> = ({ label, value, hint }) => (
  <Card className="p-4">
    <div className="text-xs font-semibold text-slate-500">{label}</div>
    <div className="text-2xl font-black text-slate-900 mt-1">{value}</div>
    {hint && <div className="text-[11px] text-slate-400 mt-0.5">{hint}</div>}
  </Card>
);

/** Error card. Shows token setup steps when the problem is a missing/invalid Instagram token. */
export const ErrorState: React.FC<{ error: string; isAr: boolean; onRetry?: () => void }> = ({ error, isAr, onRetry }) => {
  const isToken = /TOKEN|token|OAuth|190|401/.test(error);
  return (
    <Card className="p-6 border-amber-300 bg-amber-50/60">
      <div className="flex items-start gap-3">
        {isToken ? <KeyRound className="w-6 h-6 text-amber-600 shrink-0" /> : <AlertCircle className="w-6 h-6 text-amber-600 shrink-0" />}
        <div className="space-y-2 text-sm text-slate-700 min-w-0">
          <div className="font-bold text-slate-900">
            {isToken ? (isAr ? 'اربط حساب إنستغرام أولاً' : 'Connect your Instagram account first') : isAr ? 'صار خطأ' : 'Something went wrong'}
          </div>
          {isToken ? (
            <ol className="list-decimal ps-5 space-y-1">
              <li>{isAr ? 'افتح ملف ‎.env.local‎ بمجلد المشروع.' : 'Open .env.local in the project folder.'}</li>
              <li>
                {isAr ? 'أضف السطر:' : 'Add the line:'}{' '}
                <code className="bg-white border px-1.5 py-0.5 rounded text-xs" dir="ltr">DR_MUSTAFA_ACCESS_TOKEN=...</code>
              </li>
              <li>{isAr ? 'أعد تشغيل السيرفر (npm run dev).' : 'Restart the server (npm run dev).'}</li>
            </ol>
          ) : null}
          <p className="text-xs text-slate-500 break-words" dir="auto">{error}</p>
          {onRetry && (
            <button onClick={onRetry} className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 hover:text-amber-900">
              <RefreshCw className="w-3.5 h-3.5" /> {isAr ? 'حاول مرة ثانية' : 'Try again'}
            </button>
          )}
        </div>
      </div>
    </Card>
  );
};

/** Fetch helper that throws the server's error message. */
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error || data.message || `HTTP ${res.status}`);
  return data as T;
}

const COMPETITORS_KEY = 'growth_competitors_v1';
export const loadCompetitors = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(COMPETITORS_KEY) || '[]');
  } catch {
    return [];
  }
};
export const saveCompetitors = (list: string[]) => localStorage.setItem(COMPETITORS_KEY, JSON.stringify(list));
