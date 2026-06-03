'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Check,
  ChevronLeft,
  ArrowRight,
  Zap,
  Package,
  Building2,
  ShoppingCart,
  Wallet,
  FileText,
  Users,
  BarChart3
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/context/LanguageContext';

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const { t } = useTranslation();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const router = useRouter();

  const onboardingSteps = [
    {
      id: 'q1',
      question: t.onboarding_wizard.q1.q,
      options: t.onboarding_wizard.q1.options,
    },
    {
      id: 'q2',
      question: t.onboarding_wizard.q2.q,
      options: t.onboarding_wizard.q2.options,
    },
    {
      id: 'q3',
      question: t.onboarding_wizard.q3.q,
      options: t.onboarding_wizard.q3.options,
    },
    {
      id: 'q4',
      question: t.onboarding_wizard.q4.q,
      options: t.onboarding_wizard.q4.options,
    },
    {
      id: 'q5',
      question: t.onboarding_wizard.q5.q,
      options: t.onboarding_wizard.q5.options,
    },
    {
      id: 'q6',
      question: t.onboarding_wizard.q6.q,
      options: t.onboarding_wizard.q6.options,
    },
    {
      id: 'result',
      question: t.onboarding_wizard.result.title,
      isResult: true
    }
  ];

  const handleNext = () => {
    if (currentStep < onboardingSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const handleOptionSelect = (option: string) => {
    setAnswers({ ...answers, [onboardingSteps[currentStep].id]: option });
    setTimeout(handleNext, 400);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-2xl relative z-10">
        {/* Progress Bar */}
        {!onboardingSteps[currentStep].isResult && (
          <div className="flex gap-2 mb-12">
            {onboardingSteps.filter(s => !s.isResult).map((_, idx) => (
              <div 
                key={idx}
                className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                  idx <= currentStep ? 'bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.5)]' : 'bg-white/5'
                }`}
              />
            ))}
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center"
          >
            {onboardingSteps[currentStep].isResult ? (
              <div className="space-y-8">
                <div className="w-20 h-20 bg-emerald-500/20 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce">
                  <Check size={40} />
                </div>
                <h1 className="text-4xl font-bold">{t.onboarding_wizard.result.title}</h1>
                <p className="text-gray-400">{t.onboarding_wizard.result.desc}</p>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-lg mx-auto">
                  {t.onboarding_wizard.result.items.map((item: any, idx: number) => (
                    <div key={idx} className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col items-center gap-2">
                      <div className="w-8 h-8 bg-blue-600/20 rounded-lg flex items-center justify-center text-blue-500">
                        <Check size={16} />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider">{item}</span>
                    </div>
                  ))}
                </div>

                <p className="text-emerald-500 font-bold text-sm">
                  {t.onboarding_wizard.result.footer}
                </p>

                <button
                  onClick={() => router.push('/dashboard')}
                  className="px-12 py-5 bg-white text-black font-bold rounded-[2rem] hover:bg-gray-200 transition-all flex items-center gap-3 mx-auto shadow-xl shadow-white/5"
                >
                  {t.onboarding_wizard.result.button}
                  <ArrowRight size={20} />
                </button>
              </div>
            ) : (
              <>
                <h1 className="text-3xl md:text-4xl font-bold mb-4">{onboardingSteps[currentStep].question}</h1>
                <p className="text-gray-400 mb-12">{t.onboarding_wizard.subtitle}</p>

                <div className="grid grid-cols-1 gap-4 text-left">
                  {onboardingSteps[currentStep].options?.map((option: any, idx: number) => (
                    <button
                      key={idx}
                      onClick={() => handleOptionSelect(option)}
                      className={`p-6 rounded-2xl border transition-all duration-300 flex items-center justify-between group ${
                        answers[onboardingSteps[currentStep].id] === option
                          ? 'bg-blue-600/10 border-blue-500 shadow-lg shadow-blue-500/10' 
                          : 'bg-white/5 border-white/5 hover:border-white/20'
                      }`}
                    >
                      <span className="font-medium">{option}</span>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        answers[onboardingSteps[currentStep].id] === option 
                          ? 'bg-blue-600 border-blue-600' 
                          : 'border-white/10 group-hover:border-white/30'
                      }`}>
                        {answers[onboardingSteps[currentStep].id] === option && <Check size={14} className="text-white" />}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="mt-12 flex items-center justify-start">
                  <button
                    onClick={handleBack}
                    disabled={currentStep === 0}
                    className={`flex items-center gap-2 text-gray-500 hover:text-white transition-colors ${
                      currentStep === 0 ? 'opacity-0 pointer-events-none' : ''
                    }`}
                  >
                    <ChevronLeft size={20} />
                    Orqaga
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
