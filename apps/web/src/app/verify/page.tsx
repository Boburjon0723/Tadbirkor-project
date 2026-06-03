'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, RefreshCcw, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/context/LanguageContext';

export default function VerifyOTPPage() {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(60);
  const { t } = useTranslation();
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => {
      if (timer > 0) setTimer(timer - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const handleChange = (element: HTMLInputElement, index: number) => {
    if (isNaN(Number(element.value))) return false;

    setOtp([...otp.map((d, idx) => (idx === index ? element.value : d))]);

    if (element.nextSibling && element.value) {
      (element.nextSibling as HTMLInputElement).focus();
    }
  };

  const handleVerify = () => {
    // MVP logic: just proceed to company setup
    router.push('/onboarding/company');
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-8 w-20 h-20 bg-blue-600/20 rounded-3xl flex items-center justify-center mx-auto text-blue-500 border border-blue-500/20"
        >
          <ShieldCheck size={40} />
        </motion.div>

        <h1 className="text-3xl font-bold mb-4">Tasdiqlash kodi</h1>
        <p className="text-gray-500 mb-12">
          Telefon raqamingizga yuborilgan 6 xonali kodni kiriting.
        </p>

        <div className="flex justify-between gap-2 mb-12">
          {otp.map((data, index) => (
            <input
              key={index}
              type="text"
              maxLength={1}
              className="w-12 h-16 bg-white/5 border border-white/10 rounded-2xl text-center text-2xl font-bold focus:border-blue-500 focus:outline-none transition-all"
              value={data}
              onChange={(e) => handleChange(e.target, index)}
              onFocus={(e) => e.target.select()}
            />
          ))}
        </div>

        <button
          onClick={handleVerify}
          className="w-full py-5 bg-white text-black font-bold rounded-2xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2 mb-8 shadow-xl shadow-white/5"
        >
          Tasdiqlash
          <ArrowRight size={20} />
        </button>

        <div className="flex flex-col items-center gap-4">
          <p className="text-sm text-gray-500">
            Kod kelmadimi? {timer > 0 ? `${timer} soniyadan keyin qayta yuborishingiz mumkin.` : ''}
          </p>
          <button 
            disabled={timer > 0}
            className="flex items-center gap-2 text-sm font-bold text-blue-500 disabled:opacity-30 disabled:grayscale transition-all"
            onClick={() => setTimer(60)}
          >
            <RefreshCcw size={16} />
            Kodni qayta yuborish
          </button>
        </div>
      </div>
    </div>
  );
}
