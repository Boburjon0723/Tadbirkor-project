'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, Save, ScanLine } from 'lucide-react';
import { warehouseIntakeService, type WarehouseIntakeSettings } from '@/services/warehouse-intake.service';
import { toast, formatApiError } from '@/lib/toast';

const DEFAULTS: WarehouseIntakeSettings = {
  scanMode: 'SINGLE_SCAN_QTY',
  allowBulkQty: true,
  allowQuickProduct: false,
  maxQtyPerScan: null,
};

type Props = {
  canWrite?: boolean;
};

export function SettingsIntakeSection({ canWrite = true }: Props) {
  const [settings, setSettings] = useState<WarehouseIntakeSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await warehouseIntakeService.getIntakeSettings();
        if (!cancelled) setSettings({ ...DEFAULTS, ...data.settings });
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
      const res = await warehouseIntakeService.updateIntakeSettings(settings);
      setSettings(res.settings);
      toast.success('Kirim sozlamalari saqlandi');
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
        <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
          <ScanLine size={20} />
        </div>
        <div>
          <h3 className="font-black text-lg">Ombor kirimi qoidalari</h3>
          <p className="text-xs text-gray-500">
            Skaner rejimi va tez mahsulot — kompaniya bo&apos;yicha
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label
          className={`p-4 rounded-xl border cursor-pointer transition-colors ${
            settings.scanMode === 'SINGLE_SCAN_QTY'
              ? 'border-blue-500/50 bg-blue-500/10'
              : 'border-white/10 bg-white/[0.02]'
          } ${readOnly ? 'opacity-70 cursor-default' : ''}`}
        >
          <input
            type="radio"
            className="sr-only"
            disabled={readOnly}
            checked={settings.scanMode === 'SINGLE_SCAN_QTY'}
            onChange={() => setSettings((s) => ({ ...s, scanMode: 'SINGLE_SCAN_QTY' }))}
          />
          <div className="font-black text-sm">Tez rejim</div>
          <div className="text-xs text-gray-500 mt-1">1 skaner + miqdor kiritish</div>
        </label>
        <label
          className={`p-4 rounded-xl border cursor-pointer transition-colors ${
            settings.scanMode === 'EACH_SCAN_ONE'
              ? 'border-blue-500/50 bg-blue-500/10'
              : 'border-white/10 bg-white/[0.02]'
          } ${readOnly ? 'opacity-70 cursor-default' : ''}`}
        >
          <input
            type="radio"
            className="sr-only"
            disabled={readOnly}
            checked={settings.scanMode === 'EACH_SCAN_ONE'}
            onChange={() =>
              setSettings((s) => ({
                ...s,
                scanMode: 'EACH_SCAN_ONE',
                allowBulkQty: false,
              }))
            }
          />
          <div className="font-black text-sm">Qattiq rejim</div>
          <div className="text-xs text-gray-500 mt-1">Har skaner faqat 1 dona</div>
        </label>
      </div>

      <label className="flex items-center justify-between gap-4 py-2">
        <span className="text-sm font-bold text-gray-300">Qo&apos;lda miqdor kiritish</span>
        <input
          type="checkbox"
          disabled={readOnly || settings.scanMode === 'EACH_SCAN_ONE'}
          checked={settings.allowBulkQty}
          onChange={(e) => setSettings((s) => ({ ...s, allowBulkQty: e.target.checked }))}
          className="w-5 h-5 accent-blue-500"
        />
      </label>

      <label className="flex items-center justify-between gap-4 py-2">
        <div>
          <span className="text-sm font-bold text-gray-300 block">Tez mahsulot (noma&apos;lum barcode)</span>
          <span className="text-xs text-amber-500/80">Katalogda yo&apos;q bo&apos;lsa yangi yaratish</span>
        </div>
        <input
          type="checkbox"
          disabled={readOnly}
          checked={settings.allowQuickProduct}
          onChange={(e) => setSettings((s) => ({ ...s, allowQuickProduct: e.target.checked }))}
          className="w-5 h-5 accent-blue-500"
        />
      </label>

      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-white/40">
          Bir qatorda maks. miqdor (bo&apos;sh = cheksiz)
        </label>
        <input
          type="number"
          min={1}
          disabled={readOnly}
          value={settings.maxQtyPerScan ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            setSettings((s) => ({
              ...s,
              maxQtyPerScan: v === '' ? null : Math.max(1, Number(v) || 1),
            }));
          }}
          placeholder="Cheksiz"
          className="w-full max-w-xs bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500/40 disabled:opacity-60"
        />
      </div>

      {readOnly ? (
        <p className="text-xs text-gray-500">Faqat menejer/egasi tahrirlashi mumkin.</p>
      ) : (
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 text-white font-black text-sm hover:bg-blue-500 disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Saqlash
        </button>
      )}
    </div>
  );
}
