'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowRight, 
  ChevronLeft,
  Check,
  Zap,
  CheckCircle2,
  Info
} from 'lucide-react';
import { useRouter } from 'next/navigation';

const steps = [
  { id: 1, name: "Hisob" },
  { id: 2, name: "Kompaniya" },
  { id: 3, name: "Biznes" },
  { id: 4, name: "Modullar" },
  { id: 5, name: "Jamoa" },
  { id: 6, name: "Yakunlash" }
];

const questions = [
  {
    id: 'hasWarehouse',
    q: "Siz ombor yuritasizmi?",
    options: [
      { id: 'yes', label: 'Ha, bitta omborim bor' },
      { id: 'many', label: 'Ha, bir nechta omborim bor' },
      { id: 'no', label: 'Yo‘q, hozircha kerak emas' }
    ]
  },
  {
    id: 'hasPartners',
    q: "Hamkorlar bilan buyurtma yoki invoice almashasizmi?",
    options: [
      { id: 'always', label: 'Ha, doimiy' },
      { id: 'sometimes', label: 'Ba’zida' },
      { id: 'no', label: 'Yo‘q' }
    ]
  },
  {
    id: 'hasDebt',
    q: "Nasiya yoki qarzga ishlaysizmi?",
    options: [
      { id: 'yes', label: 'Ha, qarz daftari kerak' },
      { id: 'sometimes', label: 'Ba’zida bo‘ladi' },
      { id: 'no', label: 'Yo‘q' }
    ]
  },
  {
    id: 'q4',
    q: "Mahsulotlaringizda variantlar bormi?",
    helper: "Masalan: rang, o‘lcham, qadoq, og‘irlik, barcode.",
    options: [
      { id: 'yes', label: 'Ha' },
      { id: 'no', label: 'Yo‘q' },
      { id: 'later', label: 'Keyinroq sozlayman' }
    ]
  },
  {
    id: 'q5',
    q: "Jamoa va xodimlar uchun rollar kerakmi?",
    helper: "Menejer, omborchi, sotuvchi kabi rollar alohida kirish bilan ishlaydi.",
    options: [
      { id: 'now', label: 'Ha, hozir qo‘shaman' },
      { id: 'later', label: 'Ha, keyinroq sozlayman' },
      { id: 'no', label: 'Yo‘q, hozircha o‘zim ishlayman' }
    ]
  },
  {
    id: 'q6',
    q: "POS / kassa interfeysi kerakmi?",
    options: [
      { id: 'yes', label: 'Ha, chakana sotuv uchun kerak' },
      { id: 'later', label: 'Keyinroq yoqaman' },
      { id: 'no', label: 'Hozir kerak emas' }
    ],
    info: "POS moduli kassa ekrani, chek va chakana sotuv uchun ishlatiladi."
  }
];

import { useQueryClient } from '@tanstack/react-query';
import { onboardingService } from '@/services/onboarding.service';
import { refreshOnboardingSession } from '@/lib/onboarding-session';
import { toast, formatApiError } from '@/lib/toast';

export default function BusinessQuestionsPage() {
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();

  const handleSelect = async (optionId: string) => {
    const newAnswers = { ...answers, [questions[currentQ].id]: optionId };
    setAnswers(newAnswers);
    
    if (currentQ < questions.length - 1) {
      setTimeout(() => setCurrentQ(currentQ + 1), 300);
    } else {
      setLoading(true);
      try {
        const result = await onboardingService.submitAnswers(newAnswers);
        if (result?.enabledModules) {
          localStorage.setItem('onboarding_enabled_modules', JSON.stringify(result.enabledModules));
        }
        await refreshOnboardingSession(queryClient);
        router.replace('/onboarding/modules');
      } catch (err) {
        console.error(err);
        toast.error(
          formatApiError(err, 'Modullarni saqlab bo‘lmadi. Qayta urinib ko‘ring.'),
        );
      } finally {
        setLoading(false);
      }
    }
  };

  const handleBack = () => {
    if (currentQ > 0) setCurrentQ(currentQ - 1);
    else router.push('/onboarding/business-type');
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
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
                  step.id === 3 ? 'bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 
                  step.id < 3 ? 'bg-emerald-500' : 'bg-white/5 text-gray-500'
                }`}>
                  {step.id < 3 ? <CheckCircle2 size={16} /> : step.id}
                </div>
                <span className={`text-sm font-medium ${step.id === 3 ? 'text-white' : 'text-gray-500'}`}>
                  {step.name}
                </span>
              </div>
            ))}
          </div>
          <div className="text-sm text-gray-500 md:hidden">3/6 bosqich</div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-2xl">
          <div className="mb-8 flex items-center gap-4">
             <div className="px-3 py-1 bg-blue-600/10 border border-blue-500/20 rounded-full text-[10px] font-bold text-blue-500 uppercase tracking-widest">
               Savol {currentQ + 1} / {questions.length}
             </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentQ}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-12"
            >
              <div>
                <h1 className="text-3xl md:text-4xl font-bold mb-4 leading-tight">{questions[currentQ].q}</h1>
                {questions[currentQ].helper && (
                  <p className="text-gray-500 text-lg">{questions[currentQ].helper}</p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4">
                {questions[currentQ].options.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => handleSelect(option.id)}
                    className={`p-6 rounded-2xl border text-left transition-all duration-300 flex items-center justify-between group ${
                      answers[questions[currentQ].id] === option.id 
                        ? 'bg-blue-600 border-blue-600 shadow-lg shadow-blue-600/20' 
                        : 'bg-white/5 border-white/5 hover:border-white/20'
                    }`}
                  >
                    <span className="font-medium text-lg">{option.label}</span>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                      answers[questions[currentQ].id] === option.id 
                        ? 'bg-white border-white' 
                        : 'border-white/10 group-hover:border-white/30'
                    }`}>
                      {answers[questions[currentQ].id] === option.id && <Check size={14} className="text-blue-600" />}
                    </div>
                  </button>
                ))}
              </div>

              {questions[currentQ].info && (
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex items-start gap-3 text-sm text-gray-500 leading-relaxed">
                  <Info className="shrink-0 text-blue-500" size={18} />
                  {questions[currentQ].info}
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-16 flex items-center justify-start">
            <button 
              onClick={handleBack}
              className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors"
            >
              <ChevronLeft size={20} />
              Orqaga
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
