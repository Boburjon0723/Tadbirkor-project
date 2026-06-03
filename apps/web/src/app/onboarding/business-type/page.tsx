'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Truck, 
  Store, 
  Warehouse, 
  Factory, 
  HeartHandshake, 
  Layers,
  ArrowRight, 
  ChevronLeft,
  Check,
  Zap,
  CheckCircle2
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { onboardingService } from '@/services/onboarding.service';
import { BUSINESS_TYPE_LABELS } from '@/lib/onboarding';
import { refreshOnboardingSession } from '@/lib/onboarding-session';
import { toast, formatApiError } from '@/lib/toast';
import { Loader2 } from 'lucide-react';

const steps = [
  { id: 1, name: "Hisob" },
  { id: 2, name: "Kompaniya" },
  { id: 3, name: "Biznes" },
  { id: 4, name: "Modullar" },
  { id: 5, name: "Jamoa" },
  { id: 6, name: "Yakunlash" }
];

const businessTypes = [
  { 
    id: 'wholesale', 
    title: 'Ulgurji savdo', 
    icon: <Truck />, 
    desc: "Hamkorlarga mahsulot sotish, invoice, ombor va qarz nazorati." 
  },
  { 
    id: 'retail', 
    title: 'Chakana savdo', 
    icon: <Store />, 
    desc: "Mahsulot, ombor va oddiy savdo jarayonlarini boshqarish." 
  },
  { 
    id: 'logistics', 
    title: 'Ombor / distribyutor', 
    icon: <Warehouse />, 
    desc: "Kirim, chiqim, jo‘natma va hamkorlar bilan ishlash." 
  },
  { 
    id: 'manufacturing', 
    title: 'Ishlab chiqarish', 
    icon: <Factory />, 
    desc: "Xomashyo, tayyor mahsulot va ombor jarayonlari." 
  },
  { 
    id: 'service', 
    title: 'Xizmat ko‘rsatish', 
    icon: <HeartHandshake />, 
    desc: "Mijozlar, invoice va qarz nazorati." 
  },
  { 
    id: 'mixed', 
    title: 'Aralash biznes', 
    icon: <Layers />, 
    desc: "Bir nechta jarayonni birga ishlatadigan bizneslar uchun." 
  },
];

export default function BusinessTypePage() {
  const [selectedType, setSelectedType] = useState('wholesale');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();

  const handleNext = async () => {
    const businessType =
      BUSINESS_TYPE_LABELS[selectedType] || BUSINESS_TYPE_LABELS.wholesale;
    setLoading(true);
    try {
      await onboardingService.updateCompany({ businessType });
      await refreshOnboardingSession(queryClient);
      router.push('/onboarding/questions');
    } catch (err) {
      toast.error(formatApiError(err, 'Faoliyat turini saqlab bo‘lmadi.'));
    } finally {
      setLoading(false);
    }
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
        <div className="w-full max-w-5xl">
          <div className="text-center mb-12">
            <h1 className="text-3xl font-bold mb-4">Biznesingiz qaysi turga yaqin?</h1>
            <p className="text-gray-500">Javobingizga qarab tizim sizga kerakli bo‘limlarni taklif qiladi.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {businessTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => setSelectedType(type.id)}
                className={`p-8 rounded-[2.5rem] border text-left transition-all duration-300 relative group overflow-hidden ${
                  selectedType === type.id 
                    ? 'bg-blue-600/10 border-blue-500 shadow-xl shadow-blue-500/10' 
                    : 'bg-white/5 border-white/10 hover:border-white/30'
                }`}
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-all ${
                  selectedType === type.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-white/5 text-gray-400 group-hover:text-white'
                }`}>
                  {React.cloneElement(type.icon as React.ReactElement, { size: 28 })}
                </div>
                <h3 className="font-bold mb-3 text-xl">{type.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{type.desc}</p>
                
                {selectedType === type.id && (
                  <motion.div 
                    layoutId="active-check"
                    className="absolute top-8 right-8 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center"
                  >
                    <Check size={14} className="text-white" />
                  </motion.div>
                )}
              </button>
            ))}
          </div>

          <div className="mt-16 flex items-center justify-between">
            <button 
              onClick={() => router.push('/onboarding/role')}
              className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors"
            >
              <ChevronLeft size={20} />
              Orqaga
            </button>
            <button 
              onClick={handleNext}
              disabled={loading}
              className="px-12 py-5 bg-white text-black font-bold rounded-2xl hover:bg-gray-200 transition-all flex items-center gap-2 shadow-xl shadow-white/5 disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" /> : (
                <>
                  Davom etish
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
