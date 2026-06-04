'use client';

import React, { useEffect, useState } from 'react';
import { Settings2, Loader2 } from 'lucide-react';
import { payrollLeaveApi } from '@/services/payroll-leave.service';
import { toast, formatApiError } from '@/lib/toast';

export function PayrollWorkDaysSettings({
  onChange,
}: {
  onChange?: (mode: 'AUTO' | 'MANUAL') => void;
}) {
  const [mode, setMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    void payrollLeaveApi
      .getSettings()
      .then((s) => {
        setMode(s.workedDaysMode);
        onChange?.(s.workedDaysMode);
      })
      .catch(() => setMode('AUTO'))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = async (next: 'AUTO' | 'MANUAL') => {
    if (next === mode || saving) return;
    setSaving(true);
    try {
      await payrollLeaveApi.updateSettings(next);
      setMode(next);
      onChange?.(next);
      toast.success(
        next === 'AUTO'
          ? 'Ish kunlari: dam olish avtomatik ayiriladi'
          : 'Ish kunlari: qo‘lda kiritiladi',
      );
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-gray-400">
      <Settings2 size={14} className="text-violet-400 shrink-0" />
      <span className="hidden sm:inline whitespace-nowrap">Ish kunlari:</span>
      {loading ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <select
          value={mode}
          disabled={saving}
          onChange={(e) => void handleChange(e.target.value as 'AUTO' | 'MANUAL')}
          className="bg-transparent outline-none cursor-pointer text-gray-200 font-black"
        >
          <option value="AUTO" className="bg-[#111]">
            Avtomatik
          </option>
          <option value="MANUAL" className="bg-[#111]">
            Qo‘lda
          </option>
        </select>
      )}
    </div>
  );
}
