'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  Building2, 
  LayoutGrid, 
  Users, 
  CheckCircle2, 
  Zap, 
  ArrowRight, 
  ChevronLeft,
  Calendar,
  ShieldCheck,
  Loader2
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { trialPeriodLabelUz } from '@/lib/trial';

const steps = [
  { id: 1, name: "Hisob" },
  { id: 2, name: "Kompaniya" },
  { id: 3, name: "Biznes" },
  { id: 4, name: "Modullar" },
  { id: 5, name: "Jamoa" },
  { id: 6, name: "Yakunlash" }
];

import { useQueryClient } from '@tanstack/react-query';
import { authService } from '@/services/auth.service';
import { onboardingService } from '@/services/onboarding.service';
import { useSession } from '@/hooks/use-session';
import {
  computeOnboardingProgress,
  shouldOnboardingLayoutRedirect,
} from '@/lib/onboarding';
import { patchSessionCompanyActive } from '@/lib/session-cache';
import { refreshOnboardingSession } from '@/lib/onboarding-session';
import { moduleKeysToDisplay } from '@/lib/onboarding-modules';
import { toast, formatApiError } from '@/lib/toast';

export default function FinalReviewPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session, isPending: sessionPending } = useSession();
  const [loading, setLoading] = React.useState(false);

  const me = session?.me;
  const enabledModuleCards = React.useMemo(
    () => moduleKeysToDisplay(session?.features?.enabledModules || []),
    [session?.features?.enabledModules],
  );
  const employeesEnabled = (session?.features?.enabledModules || [])
    .map((m) => m.toUpperCase())
    .includes('EMPLOYEES');

  React.useEffect(() => {
    if (sessionPending || !session?.me) return;
    const progress = computeOnboardingProgress(
      { role: session.me.role, company: session.me.company },
      session.features,
    );
    if (
      shouldOnboardingLayoutRedirect('/onboarding/review', progress.requiredPath)
    ) {
      router.replace(progress.requiredPath);
    }
  }, [session, sessionPending, router]);

  const handleFinish = async () => {
    setLoading(true);
    try {
      const company = await onboardingService.complete();
      const statusFromComplete =
        String(company?.status || '').toLowerCase() === 'active';

      let statusOk = statusFromComplete;
      if (!statusOk) {
        const me = await authService.getMe();
        statusOk =
          String(me?.company?.status || '').toLowerCase() === 'active';
      }

      if (!statusOk) {
        toast.error(
          'Yakunlash saqlanmadi. Chiqib qayta kiring yoki administrator bilan bog‘laning.',
        );
        return;
      }

      patchSessionCompanyActive(queryClient);
      await refreshOnboardingSession(queryClient);

      const status = await onboardingService.getStatus();
      if (!status?.isCompleted && status?.nextPath !== '/dashboard') {
        toast.error(
          'Yakunlash to‘liq saqlanmadi. Qayta urinib ko‘ring yoki administrator bilan bog‘laning.',
        );
        if (status?.nextPath) {
          router.replace(status.nextPath);
        }
        return;
      }

      window.location.assign('/dashboard');
    } catch (err) {
      console.error(err);
      toast.error(
        formatApiError(err, 'Yakunlashda xatolik. Qayta urinib ko‘ring.'),
      );
    } finally {
      setLoading(false);
    }
  };

  if (sessionPending || !me) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-500" size={40} />
      </div>
    );
  }

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
                  step.id === 6 ? 'bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 'bg-emerald-500'
                }`}>
                  {step.id < 6 ? <CheckCircle2 size={16} /> : step.id}
                </div>
                <span className={`text-sm font-medium ${step.id === 6 ? 'text-white' : 'text-gray-500'}`}>
                  {step.name}
                </span>
              </div>
            ))}
          </div>
          <div className="text-sm text-gray-500 md:hidden">6/6 bosqich</div>
        </div>
      </div>

      <div className="flex-1 max-w-4xl mx-auto w-full p-6 lg:p-12">
        <div className="mb-12">
          <h1 className="text-3xl font-bold mb-3">Hammasi tayyor</h1>
          <p className="text-gray-500">Quyidagi sozlamalar bilan tizimingiz ishga tushadi.</p>
        </div>

        <div className="space-y-6">
          {/* Company Summary */}
          <div className="p-8 bg-white/5 border border-white/10 rounded-[2.5rem]">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 bg-blue-600/10 text-blue-500 rounded-2xl flex items-center justify-center">
                <Building2 />
              </div>
              <div>
                <h3 className="font-bold text-lg">Kompaniya</h3>
                <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">Asosiy ma'lumotlar</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Kompaniya</p>
                <p className="font-medium">{me?.company?.name || 'Kiritilmagan'}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Faoliyat turi</p>
                <p className="font-medium">{me?.company?.businessType || 'Ulgurji savdo'}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">STIR (TIN)</p>
                <p className="font-medium font-mono">{me?.company?.tin || 'Kiritilmagan'}</p>
              </div>
            </div>
          </div>

          {/* Modules Summary */}
          <div className="p-8 bg-white/5 border border-white/10 rounded-[2.5rem]">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 bg-purple-600/10 text-purple-500 rounded-2xl flex items-center justify-center">
                <LayoutGrid />
              </div>
              <div>
                <h3 className="font-bold text-lg">Yoqilgan modullar</h3>
                <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">Biznes jarayonlari</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {enabledModuleCards.map((m) => (
                <div
                  key={m.id}
                  className="px-4 py-2 bg-white/5 border border-white/5 rounded-xl text-sm flex items-center gap-2"
                >
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  {m.title}
                </div>
              ))}
            </div>
          </div>

          {/* Team Summary */}
          <div className="p-8 bg-white/5 border border-white/10 rounded-[2.5rem]">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 bg-amber-600/10 text-amber-500 rounded-2xl flex items-center justify-center">
                <Users />
              </div>
              <div>
                <h3 className="font-bold text-lg">Rollar va jamoa</h3>
                <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">Xodimlar ruxsati</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-white/5 border border-white/5 rounded-2xl">
                <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Egasi</p>
                <p className="font-bold text-sm">{me?.user?.fullName || 'Siz'}</p>
              </div>
              <div className="p-4 bg-white/5 border border-white/5 rounded-2xl">
                <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Xodimlar moduli</p>
                <p className="font-bold text-sm">
                  {employeesEnabled ? 'Yoqilgan — jamoa qo‘shishingiz mumkin' : 'Hozircha o‘chiq'}
                </p>
              </div>
            </div>
          </div>

          {/* Trial Summary */}
          <div className="p-8 bg-emerald-500/5 border border-emerald-500/20 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-6 text-center md:text-left">
              <div className="w-14 h-14 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center">
                <ShieldCheck size={32} />
              </div>
              <div>
                <h3 className="font-bold text-lg text-emerald-500">{trialPeriodLabelUz()} boshlandi</h3>
                <p className="text-sm text-gray-500 flex items-center gap-2 justify-center md:justify-start mt-1">
                  <Calendar size={14} />
                  Tugash sanasi: {me?.company?.trialEndsAt ? new Date(me.company.trialEndsAt).toLocaleDateString() : 'Aniqlanmoqda'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-16 flex items-center justify-between">
          <button 
            onClick={() => router.push('/onboarding/employees')}
            className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors"
          >
            <ChevronLeft size={20} />
            Orqaga qaytib tahrirlash
          </button>
          <button 
            onClick={handleFinish}
            disabled={loading}
            className="px-12 py-5 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all flex items-center gap-2 shadow-xl shadow-blue-500/20 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" /> : (
              <>
                Dashboardga o‘tish
                <ArrowRight size={20} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
