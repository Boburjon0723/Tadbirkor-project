'use client';

import { RefreshCw, WifiOff, ServerCrash, Radio } from 'lucide-react';
import type { ConnectionIssue } from '@/hooks/use-connection-health';

const COPY: Record<
  ConnectionIssue,
  { title: string; body: string; icon: typeof WifiOff }
> = {
  offline: {
    title: 'Internet ulanishi uzildi',
    body: 'Tarmoq qaytganida «Sahifani yangilash» tugmasini bosing yoki brauzerda F5 bosing.',
    icon: WifiOff,
  },
  server: {
    title: 'Server bilan aloqa uzildi',
    body: 'Uzoq vaqt ochiq qolgan sahifalar eskirishi mumkin. Davom etish uchun sahifani yangilang.',
    icon: ServerCrash,
  },
  socket: {
    title: 'Real vaqt yangilanishlari to‘xtadi',
    body: 'Ombor va buyurtmalar avtomatik yangilanmayapti. Iltimos, sahifani yangilang.',
    icon: Radio,
  },
};

type Props = {
  issue: ConnectionIssue | null;
  onRefresh: () => void;
  onDismiss?: () => void;
};

export function ConnectionRefreshBanner({ issue, onRefresh, onDismiss }: Props) {
  if (!issue) return null;

  const { title, body, icon: Icon } = COPY[issue];

  return (
    <div
      role="alert"
      className="mb-6 p-4 md:p-5 rounded-2xl border border-rose-500/35 bg-rose-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
    >
      <div className="flex items-start gap-3 min-w-0">
        <Icon className="text-rose-400 shrink-0 mt-0.5" size={22} />
        <div className="min-w-0">
          <p className="font-black text-rose-100 text-sm">{title}</p>
          <p className="text-xs text-rose-100/80 mt-1 leading-relaxed">{body}</p>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="px-4 py-2.5 rounded-xl border border-white/10 text-gray-300 text-xs font-bold hover:bg-white/5"
          >
            Keyinroq
          </button>
        ) : null}
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-rose-500 text-white font-black text-xs uppercase tracking-wider hover:bg-rose-400 transition-colors"
        >
          <RefreshCw size={16} />
          Sahifani yangilash
        </button>
      </div>
    </div>
  );
}
