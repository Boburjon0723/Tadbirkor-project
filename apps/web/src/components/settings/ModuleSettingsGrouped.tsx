'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, Settings2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { companiesService } from '@/services/companies.service';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { patchSessionFeatures } from '@/lib/session-cache';
import {
  MODULE_SETTING_GROUPS,
  modulesBySettingGroup,
  type ModuleSettingDefinition,
} from '@/lib/module-settings-catalog';

export function ModuleSettingsGrouped() {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(true);
  const [hasFeatureConfig, setHasFeatureConfig] = useState(false);
  const [enabledModules, setEnabledModules] = useState<string[]>([]);
  const [updatingModule, setUpdatingModule] = useState<string | null>(null);
  const [toggleMessage, setToggleMessage] = useState<string | null>(null);
  const [selectedModuleKey, setSelectedModuleKey] = useState<string | null>(null);

  useEffect(() => {
    const loadModules = async () => {
      try {
        const data = await companiesService.getFeatures();
        setHasFeatureConfig(data.hasFeatureConfig);
        setEnabledModules((data.enabledModules || []).map((m) => m.toUpperCase()));
      } catch (error) {
        console.error('Modullarni yuklashda xato:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadModules();
  }, []);

  const isEnabled = (moduleKey: string) => {
    if (!hasFeatureConfig) return true;
    return enabledModules.includes(moduleKey.toUpperCase());
  };

  const selectedModule =
    MODULE_SETTING_GROUPS.flatMap((g) => modulesBySettingGroup(g.id)).find(
      (item) => item.key === selectedModuleKey,
    ) || null;

  const handleToggleModule = async (moduleKey: string) => {
    const currentlyEnabled = isEnabled(moduleKey);
    const nextEnabled = !currentlyEnabled;
    setUpdatingModule(moduleKey);
    setToggleMessage(null);
    try {
      const data = await companiesService.updateModule({
        moduleKey,
        enabled: nextEnabled,
      });
      setHasFeatureConfig(data.hasFeatureConfig);
      setEnabledModules((data.enabledModules || []).map((m) => m.toUpperCase()));
      patchSessionFeatures(queryClient, data);
      setToggleMessage(`${moduleKey} moduli ${nextEnabled ? 'yoqildi' : 'o‘chirildi'}.`);
    } catch (error: unknown) {
      console.error('Modul holatini yangilashda xato:', error);
      const err = error as { response?: { data?: { message?: string | string[] } } };
      const msg = err.response?.data?.message;
      const text = Array.isArray(msg) ? msg[0] : msg;
      setToggleMessage(
        typeof text === 'string' && text.length > 0
          ? text
          : 'Modul holatini saqlashda xato yuz berdi.',
      );
    } finally {
      setUpdatingModule(null);
    }
  };

  if (isLoading) {
    return (
      <div className="py-16 flex justify-center">
        <Loader2 className="animate-spin text-blue-500" size={30} />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between px-1 flex-wrap gap-3">
        <div className="text-xs font-bold text-gray-500 max-w-xl">
          {hasFeatureConfig
            ? 'Modullar biznes guruhlari bo‘yicha tartiblangan. Sidebar menyu shu guruhlarga mos keladi.'
            : 'Feature konfiguratsiya topilmadi, default modullar ko‘rsatilmoqda.'}
        </div>
        {!hasFeatureConfig && (
          <button
            type="button"
            onClick={async () => {
              try {
                setIsLoading(true);
                await api.post('/system/init-modules');
                window.location.reload();
              } catch (error) {
                console.error(error);
                toast.error('Xato yuz berdi');
              } finally {
                setIsLoading(false);
              }
            }}
            className="text-[10px] font-black text-blue-400 hover:text-blue-300 border border-blue-500/20 px-3 py-1.5 rounded-xl bg-blue-500/5 transition-all"
          >
            TIZIMNI SOZLASH (SEED)
          </button>
        )}
      </div>

      {toggleMessage && (
        <div className="text-xs font-bold text-blue-300 px-1">{toggleMessage}</div>
      )}

      {MODULE_SETTING_GROUPS.map((group) => {
        const items = modulesBySettingGroup(group.id);
        if (!items.length) return null;
        const enabledCount = items.filter((m) => isEnabled(m.key)).length;
        return (
          <section key={group.id} className="space-y-4">
            <div className="flex items-baseline justify-between gap-4 px-1">
              <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500">
                {group.title}
              </h3>
              <span className="text-[10px] font-bold text-gray-600">
                {enabledCount} / {items.length} yoqilgan
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map((m) => (
                <ModuleCard
                  key={m.key}
                  module={m}
                  enabled={isEnabled(m.key)}
                  updating={updatingModule === m.key}
                  onToggle={() => void handleToggleModule(m.key)}
                  onOpenSettings={() => setSelectedModuleKey(m.key)}
                />
              ))}
            </div>
          </section>
        );
      })}

      {selectedModule && (
        <div className="glass-card p-6 rounded-[2rem] bg-white/[0.01] border border-white/5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-black text-lg">{selectedModule.name} sozlamalari</h4>
            <button
              type="button"
              onClick={() => setSelectedModuleKey(null)}
              className="text-xs font-black text-gray-400 hover:text-white"
            >
              YOPISH
            </button>
          </div>
          <p className="text-sm text-gray-400 font-bold">{selectedModule.details}</p>
          <div className="text-xs text-gray-500 font-bold">
            Joriy holat: {isEnabled(selectedModule.key) ? 'Faol' : 'Nofaol'}
          </div>
        </div>
      )}
    </div>
  );
}

function ModuleCard({
  module: m,
  enabled,
  updating,
  onToggle,
  onOpenSettings,
}: {
  module: ModuleSettingDefinition;
  enabled: boolean;
  updating: boolean;
  onToggle: () => void;
  onOpenSettings: () => void;
}) {
  const Icon = m.icon;
  return (
    <div className="glass-card p-6 rounded-[2rem] bg-white/[0.01] border border-white/5 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/5">
            <Icon size={20} className="text-blue-400" />
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label={`${m.name} modulini ${enabled ? 'o‘chirish' : 'yoqish'}`}
            disabled={updating}
            onClick={onToggle}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 ${
              enabled ? 'bg-blue-600' : 'bg-white/10'
            }`}
          >
            <span
              className={`absolute top-[2px] left-[2px] h-5 w-5 rounded-full border border-white/20 bg-white shadow transition-transform ${
                enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
              aria-hidden
            />
          </button>
        </div>
        <h4 className="font-black text-lg mb-1">{m.name}</h4>
        <p className="text-xs text-gray-500 font-bold mb-4">{m.desc}</p>
      </div>
      <div className="flex items-center justify-between">
        <div
          className={`text-[10px] font-black ${enabled ? 'text-emerald-400' : 'text-gray-500'} flex items-center gap-1`}
        >
          <Settings2 size={12} /> {enabled ? 'YOQILGAN' : 'O‘CHIRILGAN'}
        </div>
        <button
          type="button"
          onClick={onOpenSettings}
          className="text-[10px] font-black text-blue-300 hover:text-blue-200"
        >
          SOZLAMALAR
        </button>
      </div>
    </div>
  );
}
