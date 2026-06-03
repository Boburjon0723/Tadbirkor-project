'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  UserPlus, 
  Clock, 
  User, 
  ArrowRight, 
  ChevronLeft,
  Check,
  Zap,
  CheckCircle2
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

const teamOptions = [
  { 
    id: 'now', 
    title: 'Ha, hozir qo‘shaman', 
    icon: <UserPlus />, 
    desc: "Xodimlarga login, parol va rol beraman." 
  },
  { 
    id: 'later', 
    title: 'Ha, lekin keyinroq', 
    icon: <Clock />, 
    desc: "Tizimga kirgandan keyin qo‘shaman." 
  },
  { 
    id: 'alone', 
    title: 'Yo‘q, hozircha o‘zim ishlayman', 
    icon: <User />, 
    desc: "Barcha bo‘limlarni o‘zim boshqaraman." 
  },
];

export default function TeamSetupPage() {
  const [selectedOption, setSelectedOption] = useState('now');
  const router = useRouter();

  const handleNext = () => {
    if (selectedOption === 'now') {
      router.push('/onboarding/employees');
    } else {
      router.push('/onboarding/review');
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
                  step.id === 5 ? 'bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 
                  step.id < 5 ? 'bg-emerald-500' : 'bg-white/5 text-gray-500'
                }`}>
                  {step.id < 5 ? <CheckCircle2 size={16} /> : step.id}
                </div>
                <span className={`text-sm font-medium ${step.id === 5 ? 'text-white' : 'text-gray-500'}`}>
                  {step.name}
                </span>
              </div>
            ))}
          </div>
          <div className="text-sm text-gray-500 md:hidden">5/6 bosqich</div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-4xl">
          <div className="text-center mb-12">
            <div className="w-16 h-16 bg-blue-600/10 text-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
               <Users size={32} />
            </div>
            <h1 className="text-3xl font-bold mb-4">Jamoangiz bormi?</h1>
            <p className="text-gray-500">Xodimlaringizni qo‘shing va ularga kerakli bo‘limlarni ko‘rsatadigan rollar bering.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {teamOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => setSelectedOption(option.id)}
                className={`p-8 rounded-[2.5rem] border text-left transition-all duration-300 relative group flex flex-col ${
                  selectedOption === option.id 
                    ? 'bg-blue-600/10 border-blue-500 shadow-xl shadow-blue-500/10' 
                    : 'bg-white/5 border-white/5 hover:border-white/20'
                }`}
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-6 transition-all ${
                  selectedOption === option.id ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 group-hover:text-white'
                }`}>
                  {option.icon}
                </div>
                <h3 className="font-bold mb-2 text-lg leading-snug">{option.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed mb-8 flex-1">{option.desc}</p>
                
                {selectedOption === option.id && (
                  <div className="absolute top-8 right-8 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                    <Check size={14} className="text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>

          <div className="mt-16 flex items-center justify-between">
            <button 
              onClick={() => router.back()}
              className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors"
            >
              <ChevronLeft size={20} />
              Orqaga
            </button>
            <button 
              onClick={handleNext}
              className="px-12 py-5 bg-white text-black font-bold rounded-2xl hover:bg-gray-200 transition-all flex items-center gap-2 shadow-xl shadow-white/5"
            >
              {selectedOption === 'now' ? 'Xodimlarni qo‘shish' : 'Davom etish'}
              <ArrowRight size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
