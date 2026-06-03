'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { trialShortLabelUz } from '@/lib/trial';

const steps = [
  "Kompaniya profili yaratildi",
  "Modullar sozlandi",
  "Rollar tayyorlandi",
  "Dashboard shakllantirildi",
  `${trialShortLabelUz()} faollashtirildi`,
];

export default function LoadingSetupPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const router = useRouter();

  useEffect(() => {
    if (currentStep < steps.length) {
      const timeout = setTimeout(() => {
        setCurrentStep(currentStep + 1);
      }, 600);
      return () => clearTimeout(timeout);
    } else {
      const finalTimeout = setTimeout(() => {
        router.push('/onboarding/success');
      }, 800);
      return () => clearTimeout(finalTimeout);
    }
  }, [currentStep, router]);

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-12">
          <motion.div
            animate={{ 
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0]
            }}
            transition={{ repeat: Infinity, duration: 3 }}
            className="w-20 h-20 bg-blue-600 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-blue-500/20"
          >
            <Zap size={40} className="fill-white text-white" />
          </motion.div>
          <h1 className="text-2xl font-bold mb-2">Tizimingiz tayyorlanmoqda</h1>
          <p className="text-gray-500 text-sm">Axis ERP biznesingizga moslashmoqda...</p>
        </div>

        <div className="space-y-4">
          {steps.map((step, idx) => (
            <div key={idx} className="flex items-center gap-4">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all duration-300 ${
                idx < currentStep 
                  ? 'bg-emerald-500 border-emerald-500 text-white' 
                  : idx === currentStep 
                    ? 'border-blue-500 text-blue-500' 
                    : 'border-white/10 text-transparent'
              }`}>
                {idx < currentStep ? <Check size={14} /> : idx === currentStep ? <Loader2 size={14} className="animate-spin" /> : null}
              </div>
              <span className={`text-sm font-medium transition-all duration-300 ${
                idx < currentStep ? 'text-gray-300' : idx === currentStep ? 'text-white' : 'text-gray-600'
              }`}>
                {step}
              </span>
            </div>
          ))}
        </div>

        {/* Progress Bar */}
        <div className="mt-12 h-1 w-full bg-white/5 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${(currentStep / steps.length) * 100}%` }}
            className="h-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.5)]"
          />
        </div>
      </div>
    </div>
  );
}
