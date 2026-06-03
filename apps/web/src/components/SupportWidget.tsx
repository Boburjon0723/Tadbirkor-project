'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Loader2, CheckCircle2, Headphones, HelpCircle, Mail, Phone } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { supportService, type SupportContext } from '@/services/support.service';

const TOPICS = [
  'Umumiy savol',
  'Hamkorlik va takliflar',
  'Tizim xatoligi (Bug)',
  'To\'lov va obuna',
  'Boshqa'
] as const;

export function SupportWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isAuth, setIsAuth] = useState(false);
  const [ctx, setCtx] = useState<SupportContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);

  const pathname = usePathname();
  const isDashboardRoute = pathname?.startsWith('/dashboard') || pathname?.startsWith('/pos') || pathname?.startsWith('/field');

  // Form Fields
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [topic, setTopic] = useState<string>(TOPICS[0]);
  const [message, setMessage] = useState('');
  const [responseMsg, setResponseMsg] = useState('');

  const telegramUsername = ctx?.config.telegramUsername || 'Boburjon3601';
  const supportPhone = ctx?.config.phone || '+998950203601';

  // Fetch context if logged in
  useEffect(() => {
    if (isOpen && !ctx) {
      setLoading(true);
      supportService.getContext()
        .then((data) => {
          setCtx(data);
          setIsAuth(true);
          setName(data.user?.fullName || '');
          setContact(data.user?.phone || data.user?.email || '');
        })
        .catch(() => {
          // Non-authenticated / Guest
          setIsAuth(false);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen, ctx]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || sending) return;

    setSending(true);
    try {
      if (isAuth) {
        // Authenticated message
        const res = await supportService.sendMessage({ message, topic });
        setResponseMsg(res.message);
      } else {
        // Guest/Public message
        const res = await supportService.sendPublicMessage({
          name: name.trim() || 'Mehmon',
          contact: contact.trim() || 'Aloqa ma\'lumoti kiritilmagan',
          message: message.trim(),
          topic
        });
        setResponseMsg(res.message);
      }
      setSuccess(true);
      setMessage('');
      setTimeout(() => {
        setSuccess(false);
        setIsOpen(false);
      }, 3500);
    } catch (err) {
      console.error(err);
      alert('Xabarni yuborib bo\'lmadi. Iltimos, keyinroq qayta urining.');
    } finally {
      setSending(false);
    }
  };

  // Enable opening the widget via window events (so buttons inside Privacy/Terms pages can open it!)
  useEffect(() => {
    const handleOpenWidget = () => setIsOpen(true);
    window.addEventListener('open-support-widget', handleOpenWidget);
    return () => window.removeEventListener('open-support-widget', handleOpenWidget);
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans">
      {/* Floating Action Button */}
      {!isDashboardRoute && (
        <motion.button
          whileHover={{ scale: 1.05, rotate: 5 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(!isOpen)}
          className="w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all cursor-pointer relative z-10"
        >
          <AnimatePresence mode="wait">
            {isOpen ? (
              <motion.div
                key="close"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
              >
                <X size={24} />
              </motion.div>
            ) : (
              <motion.div
                key="chat"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="relative"
              >
                <MessageCircle size={26} className="fill-white/10" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-blue-600 animate-pulse" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      )}

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute bottom-20 right-0 w-[360px] md:w-[400px] max-h-[85vh] bg-[#0c0c0e]/95 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-6 bg-gradient-to-r from-blue-600/20 to-purple-600/10 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white">
                  <Headphones size={20} />
                </div>
                <div>
                  <h4 className="font-black text-sm text-white">Axis ERP Yordam</h4>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-gray-400">Jamoa onlayn</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 max-h-[500px]">
              {loading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="animate-spin text-blue-500" size={32} />
                  <span className="text-xs font-bold text-gray-500">Yuklanmoqda...</span>
                </div>
              ) : success ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="py-12 flex flex-col items-center text-center space-y-4"
                >
                  <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400">
                    <CheckCircle2 size={36} />
                  </div>
                  <div>
                    <h5 className="font-bold text-lg text-white">Xabar yuborildi!</h5>
                    <p className="text-sm text-gray-400 mt-2 px-6 leading-relaxed">
                      {responseMsg || 'Xabaringiz muvaffaqiyatli qabul qilindi. Tez orada siz bilan bog\'lanamiz.'}
                    </p>
                  </div>
                </motion.div>
              ) : (
                <div className="space-y-4">
                  {/* Quick Contact Buttons */}
                  <div className="grid grid-cols-2 gap-3">
                    <a
                      href={`https://t.me/${telegramUsername}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-[#229ED9]/10 border border-[#229ED9]/25 hover:bg-[#229ED9]/20 transition-all text-xs font-black text-[#55bef0]"
                    >
                      <Send size={14} className="fill-current" />
                      Telegram
                    </a>
                    <a
                      href={`tel:${supportPhone}`}
                      className="flex items-center justify-center gap-2 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 hover:bg-emerald-500/20 transition-all text-xs font-black text-emerald-400"
                    >
                      <Phone size={14} />
                      Qo&apos;ng&apos;iroq qilish
                    </a>
                  </div>

                  <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-white/5"></div>
                    <span className="flex-shrink mx-4 text-[9px] font-black text-gray-600 uppercase tracking-widest">Yoki xabar qoldiring</span>
                    <div className="flex-grow border-t border-white/5"></div>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="text-xs text-gray-400 leading-relaxed bg-white/[0.02] p-4 border border-white/5 rounded-2xl">
                    👋 Savolingiz yoki texnik muammoni yozing. Railway-bot orqali xabaringiz to&apos;g&apos;ridan-to&apos;g&apos;ri qo&apos;llab-quvvatlash jamoamizga yetkaziladi.
                  </div>

                  {/* Name field (only for guests) */}
                  {!isAuth && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                        Ismingiz <span className="text-blue-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ismingizni kiriting"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-sm font-medium text-white outline-none focus:border-blue-500/50"
                      />
                    </div>
                  )}

                  {/* Contact field (only for guests) */}
                  {!isAuth && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                        Aloqa ma&apos;lumotingiz <span className="text-blue-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={contact}
                        onChange={(e) => setContact(e.target.value)}
                        placeholder="Telefon yoki Telegram username"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-sm font-medium text-white outline-none focus:border-blue-500/50"
                      />
                    </div>
                  )}

                  {/* Topic Select */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                      Mavzu
                    </label>
                    <select
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      className="w-full bg-[#141416] border border-white/10 rounded-2xl py-3 px-4 text-sm font-bold text-white outline-none focus:border-blue-500/50"
                    >
                      {TOPICS.map((t) => (
                        <option key={t} value={t} className="bg-[#141416] text-white">
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Message field */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                      Xabaringiz <span className="text-blue-500">*</span>
                    </label>
                    <textarea
                      required
                      rows={4}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Qanday yordam bera olamiz?"
                      className="w-full resize-none bg-white/5 border border-white/10 rounded-2xl py-3 px-4 text-sm font-medium text-white outline-none focus:border-blue-500/50"
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={sending || !message.trim()}
                    className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-sm flex items-center justify-center gap-2 transition-all shadow-[0_4px_12px_rgba(37,99,235,0.2)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer mt-6"
                  >
                    {sending ? (
                      <>
                        <Loader2 className="animate-spin" size={18} />
                        Yuborilmoqda...
                      </>
                    ) : (
                      <>
                        <Send size={18} />
                        Xabar yuborish
                      </>
                    )}
                  </button>
                </form>
              </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-white/[0.01] border-t border-white/5 text-center text-[10px] text-gray-600 font-bold">
              Powered by Axis ERP Telegram Bot
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
