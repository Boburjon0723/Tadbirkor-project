'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  MessageCircle,
  Send,
  Loader2,
  Mail,
  Phone,
  Clock,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import { supportService, type SupportContext } from '@/services/support.service';
import { toast, formatApiError } from '@/lib/toast';

type ChatMessage = {
  id: string;
  role: 'user' | 'support';
  text: string;
  at: string;
};

const TOPICS = [
  'Umumiy savol',
  'Texnik muammo',
  'Import / Excel',
  'To\'lov va obuna',
  'Boshqa',
] as const;

const WELCOME: ChatMessage = {
  id: 'welcome',
  role: 'support',
  text: 'Assalomu alaykum! Savolingizni yozing — jamoamiz tez orada javob beradi. Telegram orqali ham bog\'lanishingiz mumkin.',
  at: new Date().toISOString(),
};

export function SettingsSupportTab() {
  const [ctx, setCtx] = useState<SupportContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [topic, setTopic] = useState<string>(TOPICS[0]);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await supportService.getContext();
        setCtx(data);
      } catch (err) {
        console.error(err);
        toast.error(formatApiError(err, 'Support ma\'lumotini yuklab bo\'lmadi.'));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages]);

  const telegramLink = (withDraft = false) => {
    const username = ctx?.config.telegramUsername;
    if (!username) return null;
    const parts: string[] = [];
    if (ctx?.company?.name) parts.push(`Kompaniya: ${ctx.company.name}`);
    if (ctx?.user?.fullName) parts.push(`Men: ${ctx.user.fullName}`);
    parts.push(`Mavzu: ${topic}`);
    if (withDraft && draft.trim()) {
      parts.push('', draft.trim());
    }
    const text = encodeURIComponent(parts.join('\n'));
    return text
      ? `https://t.me/${username}?text=${text}`
      : `https://t.me/${username}`;
  };

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text,
      at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setDraft('');
    setSending(true);

    try {
      const res = await supportService.sendMessage({ message: text, topic });
      setMessages((prev) => [
        ...prev,
        {
          id: `s-${Date.now()}`,
          role: 'support',
          text: res.message,
          at: new Date().toISOString(),
        },
      ]);
      if (res.deliveredToTelegram) {
        toast.success('Xabar yuborildi');
      } else {
        toast.info('Xabar qayd etildi. Telegram orqali ham yozing.');
      }
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
      setDraft(text);
      toast.error(formatApiError(err, 'Xabar yuborilmadi.'));
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex justify-center">
        <Loader2 className="animate-spin text-blue-500" size={36} />
      </div>
    );
  }

  const cfg = ctx?.config;

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="space-y-4">
        <div className="glass-card p-6 rounded-[2rem] border border-white/5 bg-white/[0.01]">
          <div className="flex items-center gap-3 mb-4">
            <MessageCircle className="text-blue-400" size={22} />
            <h3 className="font-black text-lg">Qo&apos;llab-quvvatlash</h3>
          </div>
          <p className="text-sm text-gray-400 leading-relaxed mb-6">
            Tadbirkor jamoasi bilan bog&apos;laning. Chat orqali xabar qoldiring yoki Telegramda
            davom eting.
          </p>

          <div className="space-y-3 text-sm">
            {cfg?.email && (
              <a
                href={`mailto:${cfg.email}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:border-blue-500/30 transition-all"
              >
                <Mail size={16} className="text-blue-400 shrink-0" />
                <span className="font-bold text-gray-300">{cfg.email}</span>
              </a>
            )}
            {cfg?.phone && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                <Phone size={16} className="text-emerald-400 shrink-0" />
                <span className="font-bold text-gray-300">{cfg.phone}</span>
              </div>
            )}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
              <Clock size={16} className="text-amber-400 shrink-0" />
              <span className="font-bold text-gray-300">{cfg?.hours}</span>
            </div>
          </div>

          {telegramLink() && (
            <a
              href={telegramLink(true) || telegramLink() || '#'}
              target="_blank"
              rel="noreferrer"
              className="mt-6 w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-[#229ED9]/20 border border-[#229ED9]/40 text-[#7dd3fc] font-black text-sm hover:bg-[#229ED9]/30 transition-all"
            >
              <ExternalLink size={16} />
              Telegramda ochish
            </a>
          )}
        </div>

        <div className="glass-card p-5 rounded-2xl border border-white/5 text-xs text-gray-500 font-bold leading-relaxed">
          <CheckCircle2 size={14} className="inline mr-1 text-emerald-400" />
          Xabarlar kompaniya va profilingiz bilan birga yuboriladi — tezroq yordam berish uchun.
        </div>
      </div>

      <div className="glass-card rounded-[2rem] border border-white/5 bg-white/[0.01] flex flex-col min-h-[420px] max-h-[min(70vh,560px)] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5 flex flex-wrap items-center gap-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
            Mavzu
          </span>
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm font-bold text-white outline-none focus:border-blue-500/50"
          >
            {TOPICS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-5 space-y-4 min-h-[280px]"
        >
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-md'
                    : 'bg-white/10 text-gray-200 border border-white/10 rounded-bl-md'
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-white/5 flex gap-2">
          <textarea
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder="Xabaringizni yozing..."
            className="flex-1 resize-none bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-sm font-medium text-white outline-none focus:border-blue-500/50 placeholder:text-gray-600"
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={sending || !draft.trim()}
            className="shrink-0 px-5 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black flex items-center justify-center transition-all"
          >
            {sending ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Send size={20} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
