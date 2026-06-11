'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Building2, 
  MapPin, 
  Phone, 
  Hash, 
  ArrowRight, 
  ChevronLeft,
  CheckCircle2,
  Zap,
  Loader2
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/context/LanguageContext';

import { useQueryClient } from '@tanstack/react-query';
import { onboardingService } from '@/services/onboarding.service';
import { authService } from '@/services/auth.service';
import { refreshOnboardingSession } from '@/lib/onboarding-session';
import { trialShortLabelUz } from '@/lib/trial';

const steps = [
  { id: 1, name: "Hisob" },
  { id: 2, name: "Kompaniya" },
  { id: 3, name: "Biznes" },
  { id: 4, name: "Modullar" },
  { id: 5, name: "Jamoa" },
  { id: 6, name: "Yakunlash" }
];

export default function CompanySetupPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    tin: '',
    phone: '',
    address: '',
  });

  useEffect(() => {
    authService.getMe().then(data => {
      if (data.company) {
        setFormData(prev => ({
          ...prev,
          name: data.company.name || '',
          tin: data.company.tin || '',
          phone: data.user.phone || '',
          address: data.company.address || '',
        }));
      }
      setFetching(false);
    }).catch(() => setFetching(false));
  }, []);

  const handleNext = async () => {
    if (!formData.name.trim()) {
      setError("Kompaniya nomi majburiy.");
      return;
    }

    if (formData.tin.length !== 9) {
      setError("STIR aynan 9 ta raqamdan iborat bo'lishi shart.");
      return;
    }

    if (!formData.phone.trim()) {
      setError('Telefon raqami majburiy — Telegram bot sizni shu raqam orqali taniydi.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onboardingService.createCompany({
        name: formData.name.trim(),
        tin: formData.tin,
        phone: formData.phone,
        address: formData.address,
      });
      await refreshOnboardingSession(queryClient);
      router.push('/onboarding/role');
    } catch (err: any) {
      setError(err.response?.data?.message || "Xatolik yuz berdi");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col font-sans">
      {/* Top Progress Stepper */}
      <div className="w-full bg-[#080808] border-b border-white/5 py-6 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="text-blue-500 fill-blue-500 w-6 h-6" />
            <span className="font-bold text-lg">Axis ERP</span>
          </div>
          <div className="hidden md:flex items-center gap-12">
            {steps.map((step) => (
              <div key={step.id} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step.id === 2 ? 'bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 
                  step.id < 2 ? 'bg-emerald-500' : 'bg-white/5 text-gray-500'
                }`}>
                  {step.id < 2 ? <CheckCircle2 size={16} /> : step.id}
                </div>
                <span className={`text-sm font-medium ${step.id === 2 ? 'text-white' : 'text-gray-500'}`}>
                  {step.name}
                </span>
              </div>
            ))}
          </div>
          <div className="text-sm text-gray-500 md:hidden">2/6 bosqich</div>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row max-w-7xl mx-auto w-full p-6 lg:p-12 gap-12">
        {/* Left/Center - Form */}
        <div className="flex-1 max-w-2xl">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h1 className="text-3xl font-bold mb-3">Kompaniyangiz haqida</h1>
            <p className="text-gray-500 mb-10">Tizimni kompaniyangizga moslash uchun asosiy ma’lumotlarni kiriting.</p>

            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-sm flex items-center gap-3">
                <CheckCircle2 size={18} className="rotate-45" />
                {error}
              </div>
            )}

            <form className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase ml-1">Kompaniya nomi</label>
                  <div className="relative">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                      type="text"
                      placeholder="Masalan: Baraka Market"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-blue-500 transition-all"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase ml-1">STIR / INN (majburiy)</label>
                  <div className="relative">
                    <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                      type="text"
                      inputMode="numeric"
                      maxLength={9}
                      placeholder="Masalan: 030120041"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-blue-500 transition-all"
                      value={formData.tin}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        if (val.length <= 9) {
                          setFormData({...formData, tin: val});
                        }
                      }}
                    />
                  </div>
                  {formData.tin && formData.tin.length !== 9 && (
                    <p className="text-[10px] text-amber-500 ml-1">STIR aynan 9 ta raqamdan iborat bo'lishi kerak</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase ml-1">Telefon *</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                      required
                      type="text"
                      placeholder="+998 90 123 45 67"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-blue-500 transition-all"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase ml-1">Manzil</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                      type="text"
                      placeholder="Toshkent sh, Yunusobod..."
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-blue-500 transition-all"
                      value={formData.address}
                      onChange={(e) => setFormData({...formData, address: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <p className="text-sm text-gray-500 pt-2">
                Biznes turini keyingi bosqichda tanlaysiz — bu yerda faqat kompaniya rekvizitlari kerak.
              </p>
            </form>

            <div className="mt-12 flex items-center justify-between">
              <button 
                onClick={() => router.back()}
                className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors"
              >
                <ChevronLeft size={20} />
                Orqaga
              </button>
              <button 
                onClick={handleNext}
                disabled={loading}
                className="px-10 py-4 bg-white text-black font-bold rounded-2xl hover:bg-gray-200 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="animate-spin" /> : (
                  <>
                    Keyingi qadam
                    <ArrowRight size={20} />
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>

        {/* Right - Side Preview Card */}
        <div className="hidden lg:block w-80">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="p-8 bg-blue-600/5 border border-blue-500/20 rounded-[2.5rem] sticky top-12"
          >
            <h4 className="font-bold mb-6 text-blue-400 uppercase tracking-widest text-xs">Siz uchun tayyorlanadi:</h4>
            <ul className="space-y-6">
              {[
                { icon: <Building2 className="text-blue-500" />, text: "Kompaniya profili" },
                { icon: <CheckCircle2 className="text-emerald-500" />, text: trialShortLabelUz() },
                { icon: <Zap className="text-amber-500" />, text: "Moslashuvchan dashboard" }
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-4 text-sm font-medium">
                  <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center">
                    {item.icon}
                  </div>
                  {item.text}
                </li>
              ))}
            </ul>
            <div className="mt-10 p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20 text-[11px] text-blue-300 leading-relaxed">
              Ma’lumotlaringiz avtomatik saqlanadi. Savollaringiz bormi? <span className="underline cursor-pointer">Yordam markazi</span>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
