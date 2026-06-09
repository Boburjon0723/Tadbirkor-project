'use client';

import React, { useState, useEffect } from 'react';
import {
  Loader2,
  AlertCircle,
  Crown,
  LayoutGrid,
  Shield,
  User,
  Building2,
  Lock,
  Workflow,
  MessageCircle,
} from 'lucide-react';
import { SettingsSupportTab } from '@/components/settings/SettingsSupportTab';
import { useSession, SESSION_QUERY_KEY, type SessionData } from '@/hooks/use-session';
import { useQueryClient } from '@tanstack/react-query';
import { ModuleSettingsGrouped } from '@/components/settings/ModuleSettingsGrouped';
import { SettingsProfileTab } from '@/components/settings/SettingsProfileTab';
import { SettingsCompanyForm } from '@/components/settings/SettingsCompanyForm';
import { SettingsIntakeSection } from '@/components/settings/SettingsIntakeSection';
import { SettingsEmployeesRolesTab } from '@/components/settings/SettingsEmployeesRolesTab';
import { SettingsArchitectureTab } from '@/components/settings/SettingsArchitectureTab';
import { SettingsSecurityTab } from '@/components/settings/SettingsSecurityTab';
import { SettingsPricingTab } from '@/components/settings/SettingsPricingTab';
import { isSettingsTab } from '@/components/settings/settings-tabs';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: session, isPending: sessionPending } = useSession();
  const me = session?.me;
  const [activeTab, setActiveTab] = useState('profil');

  useEffect(() => {
    const t =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('tab')
        : null;
    if (isSettingsTab(t)) setActiveTab(t);
  }, []);

  const trialEndDate = me?.company?.trialEndsAt
    ? new Date(me.company.trialEndsAt)
    : null;
  const now = new Date();
  const remainingTrialDays = trialEndDate
    ? Math.max(
        0,
        Math.ceil(
          (trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        ),
      )
    : 0;
  const isTrialActive = Boolean(
    trialEndDate && trialEndDate.getTime() > now.getTime(),
  );
  const trialDaysConfigured = Number(me?.company?.trialDays) || 7;
  const isExpiringSoon =
    isTrialActive && remainingTrialDays <= Math.min(2, trialDaysConfigured);
  const canWrite = me?.company?.canWrite !== false;
  const subscriptionPlanLabel =
    me?.company?.subscriptionLabel ||
    (isTrialActive ? `${trialDaysConfigured} kunlik bepul sinov` : 'Sinov tugagan');

  if (sessionPending || !me) {
    return (
      <div className="py-32 flex justify-center">
        <Loader2 className="animate-spin text-blue-500" size={40} />
      </div>
    );
  }

  const tabs = [
    { id: 'profil', label: 'Profil', icon: User },
    { id: 'kompaniya', label: 'Kompaniya', icon: Building2 },
    { id: 'modullar', label: 'Modullar', icon: LayoutGrid },
    { id: 'rollar', label: 'Rollar', icon: Shield },
    { id: 'arxitektura', label: 'Arxitektura', icon: Workflow },
    { id: 'xavfsizlik', label: 'Xavfsizlik', icon: Lock },
    { id: 'yordam', label: 'Yordam', icon: MessageCircle },
    { id: 'tariflar', label: 'Obuna', icon: Crown },
  ] as const;

  return (
    <div className="max-w-5xl space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight mb-2">Sozlamalar</h1>
          <p className="text-gray-400">Tizimni o&apos;zingizga mos ravishda boshqaring.</p>
        </div>
        <div
          className={`px-4 py-2 rounded-2xl border flex items-center gap-3 ${
            isExpiringSoon
              ? 'bg-amber-500/10 border-amber-500/20'
              : 'bg-white/5 border-white/5'
          }`}
        >
          <Crown
            className={isExpiringSoon ? 'text-amber-400' : 'text-blue-400'}
            size={16}
          />
          <div className="text-xs font-black uppercase tracking-widest">
            <span className="text-gray-500 mr-2">{subscriptionPlanLabel}</span>
            <span
              className={isExpiringSoon ? 'text-amber-400' : 'text-emerald-400'}
            >
              {isTrialActive ? `${remainingTrialDays} kun qoldi` : 'Tugagan'}
            </span>
          </div>
        </div>
      </div>

      <div className="w-full overflow-x-auto scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex flex-row md:flex-wrap gap-2 p-1.5 bg-white/5 border border-white/5 rounded-3xl w-max md:w-fit min-w-full md:min-w-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 sm:px-6 rounded-2xl text-sm font-black transition-all shrink-0 ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        {activeTab === 'profil' && me?.user && (
          <SettingsProfileTab user={me.user} />
        )}
        {activeTab === 'kompaniya' && (
          <div className="max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            {!canWrite && (
              <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-sm font-bold flex items-start gap-3">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                Sinov muddati tugagan — ma’lumotlarni ko‘rasiz, lekin saqlash bloklangan. Obuna: «Obuna» tab.
              </div>
            )}
            <SettingsCompanyForm
              company={me?.company}
              onUpdate={(updated) => {
                const prev = queryClient.getQueryData<SessionData>(SESSION_QUERY_KEY);
                if (prev?.me) {
                  queryClient.setQueryData<SessionData>(SESSION_QUERY_KEY, {
                    ...prev,
                    me: { ...prev.me, company: updated },
                  });
                }
              }}
              canWrite={canWrite}
            />
            <div className="mt-8">
              <SettingsIntakeSection canWrite={canWrite} />
            </div>
          </div>
        )}
        {activeTab === 'modullar' && <ModuleSettingsGrouped />}
        {activeTab === 'rollar' && <SettingsEmployeesRolesTab />}
        {activeTab === 'arxitektura' && <SettingsArchitectureTab />}
        {activeTab === 'xavfsizlik' && <SettingsSecurityTab />}
        {activeTab === 'yordam' && <SettingsSupportTab />}
        {activeTab === 'tariflar' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {isExpiringSoon && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-3 text-amber-300 text-sm font-bold animate-pulse">
                <AlertCircle size={18} />
                Sizning sinov muddatingiz tugashiga juda oz qoldi!
              </div>
            )}
            <SettingsPricingTab isTrialActive={isTrialActive} />
          </div>
        )}
      </div>
    </div>
  );
}
