'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, Printer, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { toast, formatApiError } from '@/lib/toast';
import { markPosPrinterReady } from '@/features/pos/pos-receipt-print.util';

export type PosReceiptSettings = {
  autoPrint: boolean;
  receiptFormat: 'thermal' | 'a4' | 'none';
};

const DEFAULTS: PosReceiptSettings = {
  autoPrint: true,
  receiptFormat: 'thermal',
};

type Props = {
  canWrite?: boolean;
};

export function SettingsPosReceiptSection({ canWrite = true }: Props) {
  const [settings, setSettings] = useState<PosReceiptSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/companies/pos-receipt-settings');
        if (!cancelled) {
          const merged = { ...DEFAULTS, ...data?.settings };
          setSettings(merged);
          if (merged.receiptFormat !== 'none') markPosPrinterReady();
        }
      } catch {
        if (!cancelled) setSettings(DEFAULTS);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await api.patch('/companies/pos-receipt-settings', settings);
      const merged = { ...DEFAULTS, ...data?.settings };
      setSettings(merged);
      if (merged.receiptFormat !== 'none') markPosPrinterReady();
      toast.success('Kassa chek sozlamalari saqlandi');
    } catch (err) {
      toast.error(formatApiError(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-8 flex justify-center">
        <Loader2 className="animate-spin text-blue-500" />
      </div>
    );
  }

  const readOnly = !canWrite;

  return (
    <div className="glass-card rounded-2xl p-6 space-y-6 border border-white/5">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
          <Printer size={20} />
        </div>
        <div>
          <h3 className="font-black text-lg">Kassa chek va printer</h3>
          <p className="text-xs text-gray-500">
            Savdo yakunlanganda avtomatik chop etish
          </p>
        </div>
      </div>

      <p className="text-xs text-gray-500 leading-relaxed">
        Termal printer uchun kompyuter yoki telefonda ushbu printerni{' '}
        <span className="text-gray-400">standart printer</span> qilib belgilang.
        Keyin quyidagi formatni tanlang — savdo tugagach chek avtomatik chiqadi.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(
          [
            ['thermal', 'Termal (58/80mm)', 'Do‘kon termal printeri'],
            ['a4', 'A4 invoys', 'Oddiy printer'],
            ['none', 'Cheksiz', 'Chop etmaslik'],
          ] as const
        ).map(([key, title, desc]) => (
          <label
            key={key}
            className={`p-4 rounded-xl border cursor-pointer transition-colors ${
              settings.receiptFormat === key
                ? 'border-cyan-500/50 bg-cyan-500/10'
                : 'border-white/10 bg-white/[0.02]'
            } ${readOnly ? 'opacity-70 cursor-default' : ''}`}
          >
            <input
              type="radio"
              className="sr-only"
              disabled={readOnly}
              checked={settings.receiptFormat === key}
              onChange={() =>
                setSettings((s) => ({
                  ...s,
                  receiptFormat: key,
                  autoPrint: key === 'none' ? false : s.autoPrint,
                }))
              }
            />
            <div className="font-bold text-sm">{title}</div>
            <div className="text-[10px] text-gray-500 mt-1">{desc}</div>
          </label>
        ))}
      </div>

      {settings.receiptFormat !== 'none' && (
        <label className="flex items-center justify-between gap-4 py-2">
          <div>
            <span className="text-sm font-bold text-gray-300 block">
              Avtomatik chop etish
            </span>
            <span className="text-xs text-gray-500">
              Printer ulangan bo&apos;lsa — chek avtomatik chiqadi (tanlash oynasisiz)
            </span>
          </div>
          <input
            type="checkbox"
            disabled={readOnly}
            checked={settings.autoPrint}
            onChange={(e) =>
              setSettings((s) => ({ ...s, autoPrint: e.target.checked }))
            }
            className="w-5 h-5 accent-cyan-500"
          />
        </label>
      )}

      {!settings.autoPrint && settings.receiptFormat !== 'none' && (
        <p className="text-xs text-amber-400/90">
          O‘chirilgan — savdodan keyin chek chiqarilmaydi.
        </p>
      )}

      {readOnly ? (
        <p className="text-xs text-gray-500">Faqat menejer/egasi tahrirlashi mumkin.</p>
      ) : (
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-cyan-600 text-white font-black text-sm hover:bg-cyan-500 disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Saqlash
        </button>
      )}
    </div>
  );
}
