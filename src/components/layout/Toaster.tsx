'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { subscribeToasts, ToastMessage } from '@/lib/toast';

const STYLES = {
  success: { cls: 'bg-emerald-600', Icon: CheckCircle2 },
  error: { cls: 'bg-rose-600', Icon: AlertCircle },
  info: { cls: 'bg-slate-800', Icon: Info },
};

export const Toaster: React.FC = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(
    () =>
      subscribeToasts((t) => {
        setToasts((prev) => [...prev, t]);
        setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 3500);
      }),
    []
  );

  const dismiss = (id: number) => setToasts((prev) => prev.filter((x) => x.id !== id));

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:end-4 z-[100] flex flex-col gap-2 sm:w-96 pointer-events-none"
    >
      <AnimatePresence initial={false}>
      {toasts.map((t) => {
        const { cls, Icon } = STYLES[t.kind];
        return (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
            role="status"
            className={`${cls} pointer-events-auto text-white text-sm font-semibold rounded-xl shadow-lg px-4 py-3 flex items-start gap-3`}
          >
            <Icon className="w-5 h-5 shrink-0 mt-0.5" />
            <span className="flex-1">{t.text}</span>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="opacity-70 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        );
      })}
      </AnimatePresence>
    </div>
  );
};
