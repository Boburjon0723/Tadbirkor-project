'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, ArrowRight, Zap, ShieldCheck, LayoutGrid, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { trialPeriodLabelUz } from '@/lib/trial';

export default function OnboardingSuccessPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Celebration background elements */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="w-full max-w-lg text-center relative z-10">
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", damping: 12, stiffness: 100 }}
          className="w-24 h-24 bg-emerald-500 rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 shadow-2xl shadow-emerald-500/20"
        >
          <CheckCircle2 size={48} className="text-white" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4 bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-400">
            Tizimingiz tayyor!
          </h1>
          <p className="text-gray-500 text-lg mb-12">
            Axis ERP biznesingizga moslashtirildi. Endi dashboard orqali ishni boshlashingiz mumkin.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-4 mb-12">
          {[
            { icon: <ShieldCheck className="text-emerald-500" />, text: `${trialPeriodLabelUz()} faollashdi` },
            { icon: <LayoutGrid className="text-blue-500" />, text: "Kerakli modullar yoqildi" },
            { icon: <Users className="text-amber-500" />, text: "Role-based interface tayyor" },
          ].map((item, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + idx * 0.1 }}
              className="p-5 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-4 text-left"
            >
              <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center">
                {item.icon}
              </div>
              <span className="font-bold text-sm">{item.text}</span>
            </motion.div>
          ))}
        </div>

        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          onClick={() => router.push('/dashboard')}
          className="w-full py-6 bg-white text-black font-black rounded-[2rem] hover:bg-gray-200 transition-all flex items-center justify-center gap-3 shadow-2xl shadow-white/10 group"
        >
          Dashboardga o‘tish
          <ArrowRight className="group-hover:translate-x-1 transition-transform" />
        </motion.button>
      </div>
    </div>
  );
}
