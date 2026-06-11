'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  Zap,
  ArrowRight,
  ChevronLeft,
  Clock,
  LayoutGrid,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { companiesService } from '@/services/companies.service';
import { refreshOnboardingSession } from '@/lib/onboarding-session';
import { moduleKeysToDisplay } from '@/lib/onboarding-modules';

const steps = [
  { id: 1, name: 'Hisob' },
  { id: 2, name: 'Kompaniya' },
  { id: 3, name: 'Biznes' },
  { id: 4, name: 'Modullar' },
  { id: 5, name: 'Jamoa' },
  { id: 6, name: 'Yakunlash' },
];

const laterModules = [
  { title: 'Ishlab chiqarish Pro', icon: <Zap /> },
  { title: 'Click/Payme', icon: <LayoutGrid /> },
  { title: 'AI analitika', icon: <Zap /> },
];

type EnabledModuleCard = {
  id: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
};

export default function ModulesResultPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [enabledModules, setEnabledModules] = React.useState<EnabledModuleCard[]>(
    moduleKeysToDisplay([]),
  );

  React.useEffect(() => {
    const loadModules = async () => {
      try {
        const localModulesRaw = localStorage.getItem('onboarding_enabled_modules');
        const localModules = localModulesRaw ? (JSON.parse(localModulesRaw) as string[]) : [];

        const remoteConfig = await companiesService.getFeatures();
        const remoteModules = remoteConfig?.enabledModules || [];

        const merged = Array.from(
          new Set([...localModules, ...remoteModules].map((m) => m.toUpperCase())),
        );
        setEnabledModules(moduleKeysToDisplay(merged));
      } catch (error) {
        console.error('Enabled modules fetch failed:', error);
      }
    };

    void loadModules();
  }, []);

  const hasPos = enabledModules.some((m) => m.id === 'pos');

  const handleSetupTeam = async () => {
    await refreshOnboardingSession(queryClient);
    router.push('/onboarding/team');
  };

  const handleSkipTeam = async () => {
    await refreshOnboardingSession(queryClient);
    router.push('/onboarding/review');
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      <div className="w-full bg-[#080808] border-b border-white/5 py-6 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="text-blue-500 fill-blue-500 w-6 h-6" />
            <span className="font-bold text-lg">Axis ERP</span>
          </div>
          <div className="hidden md:flex items-center gap-12">
            {steps.map((step) => (
              <div key={step.id} className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    step.id === 4
                      ? 'bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.4)]'
                      : step.id < 4
                        ? 'bg-emerald-500'
                        : 'bg-white/5 text-gray-500'
                  }`}
                >
                  {step.id < 4 ? <CheckCircle2 size={16} /> : step.id}
                </div>
                <span
                  className={`text-sm font-medium ${step.id === 4 ? 'text-white' : 'text-gray-500'}`}
                >
                  {step.name}
                </span>
              </div>
            ))}
          </div>
          <div className="text-sm text-gray-500 md:hidden">4/6 bosqich</div>
        </div>
      </div>

      <div className="flex-1 max-w-5xl mx-auto w-full p-6 lg:p-12">
        <div className="text-center mb-16">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-20 h-20 bg-blue-600/20 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <LayoutGrid size={40} />
          </motion.div>
          <p className="text-blue-400 text-sm font-bold uppercase tracking-widest mb-3">
            4-bosqich · onboarding davom etmoqda
          </p>
          <h1 className="text-3xl md:text-5xl font-bold mb-4">Modullar tanlandi</h1>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto">
            Savollaringiz va biznes turiga qarab quyidagi bo‘limlar yoqiladi.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
          {enabledModules.map((module, idx) => (
            <motion.div
              key={module.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="p-8 bg-white/5 border border-white/10 rounded-[2.5rem] relative group hover:border-blue-500/30 transition-all"
            >
              <div className="w-12 h-12 bg-blue-600/10 text-blue-500 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                {module.icon}
              </div>
              <h3 className="font-bold mb-2 text-lg">{module.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed mb-6">{module.desc}</p>
              <div className="flex items-center gap-2 px-3 py-1 bg-blue-600/10 text-blue-400 rounded-full text-[10px] font-bold uppercase tracking-wider w-fit">
                <CheckCircle2 size={12} />
                Yoqilgan
              </div>
            </motion.div>
          ))}
        </div>

        {!hasPos && (
          <div className="pt-12 border-t border-white/5">
            <h4 className="text-gray-500 font-bold uppercase tracking-widest text-xs mb-8 text-center">
              Keyinroq yoqish mumkin
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 opacity-50 grayscale">
              {[{ title: 'POS / Kassa', icon: <LayoutGrid /> }, ...laterModules].map(
                (module, idx) => (
                  <div
                    key={idx}
                    className="p-6 bg-white/5 border border-white/5 rounded-3xl flex flex-col items-center gap-3"
                  >
                    <div className="text-gray-400">{module.icon}</div>
                    <span className="text-xs font-bold">{module.title}</span>
                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white/10 text-gray-400 rounded-full text-[9px] font-bold uppercase">
                      <Clock size={10} />
                      Keyinroq
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>
        )}

        <div className="mt-20 flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push('/onboarding/questions')}
            className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors"
          >
            <ChevronLeft size={20} />
            Orqaga
          </button>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => void handleSkipTeam()}
              className="px-6 py-4 text-gray-400 font-bold hover:text-white transition-all"
            >
              Jamoani keyinroq sozlayman
            </button>
            <button
              type="button"
              onClick={() => void handleSetupTeam()}
              className="px-10 py-5 bg-white text-black font-bold rounded-2xl hover:bg-gray-200 transition-all flex items-center gap-2 shadow-xl shadow-white/5"
            >
              Jamoani sozlash
              <ArrowRight size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
