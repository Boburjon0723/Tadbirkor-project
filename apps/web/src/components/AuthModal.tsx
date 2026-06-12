'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Building2, User, KeyRound, Mail, Phone, ArrowRight, Loader2, CheckCircle2, AlertCircle, Zap, Hash, Eye, EyeOff } from 'lucide-react';
import { useTranslation } from '@/context/LanguageContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';

import { authService } from '@/services/auth.service';
import { fetchPostAuthPath } from '@/lib/onboarding';
import { prefetchSession } from '@/hooks/use-session';
import { trackMetaPixelEvent } from '@/lib/meta-pixel';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal = ({ isOpen, onClose }: AuthModalProps) => {
  const [mode, setMode] = React.useState<'login' | 'register'>('register');
  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [forgotLoading, setForgotLoading] = React.useState(false);
  const [forgotHint, setForgotHint] = React.useState<string | null>(null);
  const [loginFailed, setLoginFailed] = React.useState(false);
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();

  React.useEffect(() => {
    setStep(1);
    setError(null);
    setLoginFailed(false);
    setForgotHint(null);
  }, [mode]);

  const [formData, setFormData] = React.useState({
    companyName: '',
    fullName: '',
    login: '',
    password: '',
    email: '',
    phone: ''
  });

  const handleForgotPassword = async () => {
    const login = formData.login.trim();
    if (!login) {
      setError('Avval login kiriting, keyin «Parolni unutdingizmi» ni bosing.');
      return;
    }
    setForgotLoading(true);
    setForgotHint(null);
    try {
      const { botUrl, instructions } = await authService.getPasswordResetTelegramLink(login);
      window.open(botUrl, '_blank', 'noopener,noreferrer');
      setForgotHint(
        instructions ||
          'Telegram bot ochildi. «Telefon raqamni ulashish» tugmasini bosing va yangi parol kiriting.',
      );
      setError(null);
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          'Telegram havolasini yaratib bo‘lmadi. Keyinroq urinib ko‘ring.',
      );
    } finally {
      setForgotLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setLoginFailed(false);
    setForgotHint(null);

    try {
      if (mode === 'register') {
        const normalizedRegisterData = {
          ...formData,
          companyName: String(formData.companyName || '').trim(),
          fullName: String(formData.fullName || '').trim(),
          login: String(formData.login || '').trim(),
          password: String(formData.password || ''),
          email: String(formData.email || '').trim() || undefined,
          phone: String(formData.phone || '').trim(),
        };
        await authService.register({
          ...normalizedRegisterData,
        });
        trackMetaPixelEvent('CompleteRegistration');
      } else {
        await authService.login(formData.login, formData.password);
      }

      const redirectTo = await fetchPostAuthPath(mode);
      if (mode === 'login') {
        await prefetchSession(queryClient);
      }
      setSuccess(true);
      onClose();
      router.push(redirectTo);
    } catch (err: any) {
      const message = err.response?.data?.message || err.message || 'Tizimda xatolik yuz berdi';
      setError(message);
      if (mode === 'login') {
        setLoginFailed(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-5xl max-h-[95dvh] md:max-h-[90dvh] bg-[#080808] border border-white/10 rounded-[1.5rem] md:rounded-[2.5rem] overflow-y-auto md:overflow-hidden flex flex-col md:flex-row shadow-2xl custom-scrollbar"
          >
            {/* Left Side - Info */}
            <div className="hidden md:flex md:w-5/12 shrink-0 bg-blue-600 p-8 md:p-12 text-white flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-32 -mt-32" />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-12">
                  <Zap size={24} className="fill-white" />
                  <span className="text-xl font-bold">Axis ERP</span>
                </div>
                <h2 className="text-3xl font-bold mb-4 leading-tight">
                  {t.auth.side_title}
                </h2>
                <p className="text-blue-100 leading-relaxed">
                  {t.auth.side_subtitle}
                </p>
              </div>

              <div className="relative z-10 space-y-4">
                <div className="flex items-center gap-3 text-sm font-medium bg-white/10 p-4 rounded-2xl border border-white/10">
                  <CheckCircle2 size={18} className="text-white" />
                  7 kunlik bepul sinov
                </div>
                <div className="flex items-center gap-3 text-sm font-medium bg-white/10 p-4 rounded-2xl border border-white/10">
                  <CheckCircle2 size={18} className="text-white" />
                  Karta talab qilinmaydi
                </div>
              </div>
            </div>

            {/* Right Side - Form */}
            <div className="md:w-7/12 flex-1 p-6 sm:p-8 md:p-12 md:overflow-y-auto md:max-h-[90dvh] custom-scrollbar bg-[#080808]">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-2xl font-bold mb-2">
                    {mode === 'register' ? t.auth.register_title : t.auth.login_title}
                  </h3>
                  <p className="text-gray-500 text-sm">
                    {mode === 'register' ? t.auth.register_subtitle : t.auth.login_subtitle}
                  </p>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-gray-500">
                  <X size={20} />
                </button>
              </div>

              {/* Step Progress Indicators */}
              {mode === 'register' && !success && (
                <div className="flex items-center gap-2 mb-6">
                  {[1, 2, 3].map((s) => (
                    <div 
                      key={s}
                      className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                        step >= s ? 'bg-blue-500' : 'bg-white/10'
                      }`}
                    />
                  ))}
                </div>
              )}

              {error && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }} 
                  animate={{ opacity: 1, x: 0 }}
                  className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-sm flex flex-col gap-3"
                >
                  <div className="flex items-center gap-3">
                    <AlertCircle size={18} className="shrink-0" />
                    <span>{error}</span>
                  </div>
                  {mode === 'login' && loginFailed && (
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      disabled={forgotLoading}
                      className="w-full py-3 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-xl text-blue-300 text-xs font-black transition-all disabled:opacity-50"
                    >
                      {forgotLoading ? 'Telegram ochilmoqda...' : 'Parolni unutdingizmi? — Telegram botda tiklash'}
                    </button>
                  )}
                </motion.div>
              )}

              {forgotHint && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-blue-300 text-sm font-bold"
                >
                  {forgotHint}
                </motion.div>
              )}

              {success ? (
                <div className="py-20 text-center space-y-4">
                  <div className="w-16 h-16 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 size={32} />
                  </div>
                  <h4 className="text-xl font-bold">Muvaffaqiyatli!</h4>
                  <p className="text-gray-500">Hisobingiz yaratildi. Yo'naltirilmoqda...</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {mode === 'register' ? (
                    <AnimatePresence mode="wait">
                      {step === 1 && (
                        <motion.div
                          key="step1"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ duration: 0.2 }}
                          className="space-y-4"
                        >
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase ml-1">
                              {t.auth.fields.fullName} <span className="text-blue-500">*</span>
                            </label>
                            <div className="relative">
                              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                              <input 
                                required
                                type="text"
                                placeholder="Ism va familiyangiz"
                                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-blue-500 transition-all text-white"
                                value={formData.fullName}
                                onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase ml-1">
                              {t.auth.fields.companyName} <span className="text-blue-500">*</span>
                            </label>
                            <div className="relative">
                              <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                              <input 
                                required
                                type="text"
                                placeholder="Kompaniyangiz nomi"
                                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-blue-500 transition-all text-white"
                                value={formData.companyName}
                                onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                              />
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={!formData.fullName.trim() || !formData.companyName.trim()}
                            onClick={() => setStep(2)}
                            className="w-full py-4 bg-white text-black font-bold rounded-2xl hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 mt-8"
                          >
                            Davom etish
                            <ArrowRight size={20} />
                          </button>
                        </motion.div>
                      )}

                      {step === 2 && (
                        <motion.div
                          key="step2"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ duration: 0.2 }}
                          className="space-y-4"
                        >
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase ml-1">
                              {t.auth.fields.phone} <span className="text-blue-500">*</span>
                            </label>
                            <div className="relative">
                              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                              <input 
                                required
                                type="tel"
                                inputMode="tel"
                                placeholder="+998 __ ___ __ __"
                                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-blue-500 transition-all text-white"
                                value={formData.phone}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (/^[0-9+]*$/.test(val) || val === '') {
                                    setFormData({...formData, phone: val});
                                  }
                                }}
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase ml-1">
                              {t.auth.fields.email} (ixtiyoriy)
                            </label>
                            <div className="relative">
                              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                              <input 
                                type="email"
                                placeholder="email@manzil.uz"
                                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-blue-500 transition-all text-white"
                                value={formData.email}
                                onChange={(e) => setFormData({...formData, email: e.target.value})}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 mt-8">
                            <button
                              type="button"
                              onClick={() => setStep(1)}
                              className="py-4 bg-white/5 border border-white/10 text-white font-bold rounded-2xl hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                            >
                              Orqaga
                            </button>
                            <button
                              type="button"
                              disabled={!formData.phone.trim()}
                              onClick={() => setStep(3)}
                              className="py-4 bg-white text-black font-bold rounded-2xl hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                            >
                              Davom etish
                              <ArrowRight size={20} />
                            </button>
                          </div>
                        </motion.div>
                      )}

                      {step === 3 && (
                        <motion.div
                          key="step3"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ duration: 0.2 }}
                          className="space-y-4"
                        >
                          <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase ml-1">
                              Kirish nomi <span className="text-blue-500">*</span>
                            </label>
                            <div className="relative">
                              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                              <input 
                                required
                                type="text"
                                placeholder="Kirish nomini tanlang"
                                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-blue-500 transition-all text-white"
                                value={formData.login}
                                onChange={(e) => setFormData({...formData, login: e.target.value})}
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase ml-1">
                              {t.auth.fields.password} <span className="text-blue-500">*</span>
                            </label>
                            <div className="relative">
                              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                              <input 
                                required
                                type={showPassword ? "text" : "password"}
                                placeholder="••••••••"
                                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-12 text-sm focus:outline-none focus:border-blue-500 transition-all text-white"
                                value={formData.password}
                                onChange={(e) => setFormData({...formData, password: e.target.value})}
                              />
                              <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-white rounded-lg transition-colors focus:outline-none"
                                aria-label={showPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
                              >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 mt-8">
                            <button
                              type="button"
                              onClick={() => setStep(2)}
                              className="py-4 bg-white/5 border border-white/10 text-white font-bold rounded-2xl hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                            >
                              Orqaga
                            </button>
                            <button
                              type="submit"
                              disabled={loading || !formData.login.trim() || !formData.password.trim()}
                              className="py-4 bg-white text-black font-bold rounded-2xl hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                            >
                              {loading ? <Loader2 className="animate-spin" /> : (
                                <>
                                  {t.auth.button}
                                  <ArrowRight size={20} />
                                </>
                              )}
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase ml-1">Kirish nomi</label>
                        <div className="relative">
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                          <input 
                            required
                            type="text"
                            placeholder="Kirish nomini kiriting"
                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-blue-500 transition-all text-white"
                            value={formData.login}
                            onChange={(e) => setFormData({...formData, login: e.target.value})}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase ml-1">{t.auth.fields.password}</label>
                        <div className="relative">
                          <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                          <input 
                            required
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-12 text-sm focus:outline-none focus:border-blue-500 transition-all text-white"
                            value={formData.password}
                            onChange={(e) => setFormData({...formData, password: e.target.value})}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-white rounded-lg transition-colors focus:outline-none"
                            aria-label={showPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
                          >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>

                      <p className="text-[11px] text-gray-500 font-bold text-center mt-2">
                        <button
                          type="button"
                          onClick={handleForgotPassword}
                          disabled={forgotLoading || !formData.login.trim()}
                          className="text-blue-400 hover:text-blue-300 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {forgotLoading ? 'Telegram ochilmoqda...' : 'Parolni unutdingizmi?'}
                        </button>
                      </p>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 bg-white text-black font-bold rounded-2xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2 mt-8 disabled:opacity-50"
                      >
                        {loading ? <Loader2 className="animate-spin" /> : (
                          <>
                            Kirish
                            <ArrowRight size={20} />
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  <div className="text-center mt-8 space-y-4">
                    <button
                      type="button"
                      onClick={() => setMode(mode === 'register' ? 'login' : 'register')}
                      className="text-sm text-gray-500 hover:text-white transition-colors"
                    >
                      {mode === 'register' ? 'Accountingiz bormi? Kirish' : "Akkauntingiz yo'qmi? Ro'yxatdan o'tish"}
                    </button>
                    {mode === 'register' && (
                      <p className="text-[10px] text-gray-600 max-w-xs mx-auto leading-relaxed">
                        Men{" "}
                        <Link href="/terms" target="_blank" className="text-blue-500 hover:underline">
                          foydalanish shartlari
                        </Link>{" "}
                        va{" "}
                        <Link href="/privacy" target="_blank" className="text-blue-500 hover:underline">
                          maxfiylik siyosati
                        </Link>{" "}
                        bilan tanishib chiqdim va shartlarga roziman.
                      </p>
                    )}
                  </div>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
