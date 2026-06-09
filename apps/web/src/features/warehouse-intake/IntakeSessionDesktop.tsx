'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Barcode,
  CheckCircle2,
  Loader2,
  Minus,
  Plus,
  ScanLine,
  Trash2,
  XCircle,
} from 'lucide-react';
import type { WarehouseIntake } from '@/services/warehouse-intake.service';
import { useWarehouseIntakeMutations } from '@/hooks/warehouse-intake/use-warehouse-intake';
import { toast, formatApiError } from '@/lib/toast';
import { confirmAction } from '@/components/ConfirmDialog';
import {
  canEditLineQty,
  canManualAdd,
  intakeStatusLabel,
  intakeStatusStyle,
  intakeTotals,
  lineQty,
  scanModeLabel,
} from '@/features/warehouse-intake/intake-utils';
import { QuickProductModal } from '@/features/warehouse-intake/QuickProductModal';
import { ManualLineModal } from '@/features/warehouse-intake/ManualLineModal';
import { IntakeNakladnoyButton } from '@/features/warehouse-intake/IntakeNakladnoyButton';

type Props = {
  intake: WarehouseIntake;
  onUpdated: () => void;
};

export function IntakeSessionDesktop({ intake, onUpdated }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [barcode, setBarcode] = useState('');
  const [scanQty, setScanQty] = useState(1);
  const [lastScanMsg, setLastScanMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickBarcode, setQuickBarcode] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState('');

  const settings = intake.intakeSettings;
  const { positions, units } = intakeTotals(intake);
  const isDraft = intake.status === 'DRAFT';

  const { scan, quickProduct, addLine, updateLine, removeLine, complete, cancel } =
    useWarehouseIntakeMutations(intake.id);

  const focusInput = useCallback(() => {
    if (!isDraft) return;
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [isDraft]);

  useEffect(() => {
    focusInput();
  }, [focusInput, intake.lines.length]);

  const showBulkQty =
    settings?.scanMode === 'SINGLE_SCAN_QTY' && settings?.allowBulkQty !== false;

  const handleScan = async (code?: string) => {
    const value = (code ?? barcode).trim();
    if (!value || !isDraft) return;

    try {
      await scan.mutateAsync({
        barcode: value,
        quantity: showBulkQty ? scanQty : 1,
      });
      setBarcode('');
      setLastScanMsg({ ok: true, text: `${value} qo‘shildi` });
      focusInput();
    } catch (err: unknown) {
      const msg = formatApiError(err, 'Skaner xatosi');
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404 && settings?.allowQuickProduct) {
        setQuickBarcode(value);
        setQuickOpen(true);
        setBarcode('');
        setLastScanMsg({ ok: false, text: 'Katalogda yo‘q — tez qo‘shish' });
      } else {
        setLastScanMsg({ ok: false, text: msg });
        toast.error(msg);
      }
      focusInput();
    }
  };

  const onBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleScan();
    }
  };

  const handleComplete = async () => {
    const ok = await confirmAction(
      `${positions} ta mahsulot, jami ${units} dona omborga kiritilsinmi?`,
      { title: 'Kirimni tasdiqlash', confirmLabel: 'Tasdiqlash' },
    );
    if (!ok) return;
    try {
      await complete.mutateAsync();
      toast.success('Kirim yakunlandi');
      onUpdated();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const handleCancel = async () => {
    const ok = await confirmAction('Qoralama hujjat bekor qilinsinmi?', {
      title: 'Bekor qilish',
      confirmLabel: 'Bekor qilish',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await cancel.mutateAsync();
      toast.success('Hujjat bekor qilindi');
      onUpdated();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const saveLineQty = async (lineId: string) => {
    const qty = Number(editQty);
    if (!Number.isFinite(qty) || qty <= 0) return;
    try {
      await updateLine.mutateAsync({ lineId, quantity: qty });
      setEditingLineId(null);
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  return (
    <div className="space-y-6 min-w-[1024px]">
      <div className="flex items-center gap-4 pb-4 border-b border-white/5">
        <Link
          href="/dashboard/warehouse-intake"
          className="p-2 rounded-xl hover:bg-white/5 text-gray-400 hover:text-white"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-black tracking-tight">
              Ombor <span className="text-blue-500">kirimi</span>
            </h1>
            <span className="font-mono text-sm text-gray-400 bg-white/5 px-3 py-1 rounded-lg border border-white/10">
              {intake.reference}
            </span>
            <span
              className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${intakeStatusStyle(intake.status)}`}
            >
              {intakeStatusLabel(intake.status)}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">{intake.warehouse?.name}</p>
        </div>
        {settings && (
          <span className="text-xs font-bold text-blue-400/80 bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-xl">
            {scanModeLabel(settings)}
          </span>
        )}
      </div>

      <div className="grid grid-cols-[1fr_360px] gap-6 items-start">
        <div className="space-y-6">
          {isDraft && (
            <div className="glass-card rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/40">
                <ScanLine size={14} className="text-blue-400" />
                Skaner
              </div>

              <div className="flex gap-3 items-stretch">
                {showBulkQty && (
                  <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl px-2">
                    <button
                      type="button"
                      onClick={() => setScanQty((q) => Math.max(1, q - 1))}
                      className="p-2 hover:bg-white/10 rounded-lg"
                    >
                      <Minus size={16} />
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={scanQty}
                      onChange={(e) => setScanQty(Math.max(1, Number(e.target.value) || 1))}
                      className="w-14 bg-transparent text-center font-black text-sm outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setScanQty((q) => q + 1)}
                      className="p-2 hover:bg-white/10 rounded-lg"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                )}

                <div className="relative flex-1">
                  <Barcode
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400"
                    size={20}
                  />
                  <input
                    ref={inputRef}
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    onKeyDown={onBarcodeKeyDown}
                    disabled={scan.isPending}
                    placeholder="Barcode yoki SKU — Enter"
                    className="w-full h-14 pl-12 pr-4 font-mono text-lg bg-white/5 border-2 border-blue-500/30 rounded-xl outline-none focus:border-blue-500 disabled:opacity-60"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => void handleScan()}
                  disabled={scan.isPending || !barcode.trim()}
                  className="px-6 h-14 rounded-xl bg-blue-600 text-white font-black text-sm hover:bg-blue-500 disabled:opacity-50 flex items-center gap-2"
                >
                  {scan.isPending ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <ScanLine size={18} />
                  )}
                  Skaner
                </button>
              </div>

              {lastScanMsg && (
                <p
                  className={`text-sm font-bold ${lastScanMsg.ok ? 'text-emerald-400' : 'text-amber-400'}`}
                >
                  {lastScanMsg.text}
                </p>
              )}

              {canManualAdd(settings) && (
                <button
                  type="button"
                  onClick={() => setManualOpen(true)}
                  className="text-xs font-black text-gray-400 hover:text-white underline-offset-2 hover:underline"
                >
                  Qo&apos;lda qator qo&apos;shish
                </button>
              )}
            </div>
          )}

          <div className="glass-card rounded-2xl overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5 text-[10px] font-black uppercase tracking-widest text-white/40">
                  <th className="px-4 py-4">Mahsulot</th>
                  <th className="px-4 py-4">SKU / Barcode</th>
                  <th className="px-4 py-4 text-right">Miqdor</th>
                  <th className="px-4 py-4 text-center">Skaner</th>
                  <th className="px-4 py-4 text-center">Rejim</th>
                  {isDraft && <th className="px-4 py-4 w-12" />}
                </tr>
              </thead>
              <tbody>
                {!intake.lines.length && (
                  <tr>
                    <td colSpan={isDraft ? 6 : 5} className="px-4 py-16 text-center text-gray-500">
                      Hali mahsulot qo&apos;shilmagan. Skanerlang yoki qo&apos;lda qo&apos;shing.
                    </td>
                  </tr>
                )}
                {intake.lines.map((line) => {
                  const pv = line.productVariant;
                  const qty = lineQty(line);
                  const editing = editingLineId === line.id;
                  return (
                    <tr key={line.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <div className="font-bold text-sm">{pv?.name}</div>
                        <div className="text-xs text-gray-500">{pv?.product?.name}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-400">
                        {[pv?.sku, pv?.barcode].filter(Boolean).join(' · ') || '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {editing && isDraft && canEditLineQty(settings) ? (
                          <input
                            autoFocus
                            value={editQty}
                            onChange={(e) => setEditQty(e.target.value)}
                            onBlur={() => void saveLineQty(line.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') void saveLineQty(line.id);
                              if (e.key === 'Escape') setEditingLineId(null);
                            }}
                            className="w-20 text-right bg-white/10 border border-blue-500/40 rounded-lg px-2 py-1 font-black text-sm"
                          />
                        ) : (
                          <button
                            type="button"
                            disabled={!isDraft || !canEditLineQty(settings)}
                            onClick={() => {
                              setEditingLineId(line.id);
                              setEditQty(String(qty));
                            }}
                            className="font-black text-sm disabled:cursor-default hover:text-blue-400 disabled:hover:text-inherit"
                          >
                            {qty}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-400">
                        {line.scanCount || 0}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-[10px] font-black uppercase text-gray-500">
                          {line.entryMode === 'SCAN' ? 'Skaner' : 'Qo\'lda'}
                        </span>
                      </td>
                      {isDraft && (
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={async () => {
                              const ok = await confirmAction('Qator o‘chirilsinmi?', {
                                variant: 'danger',
                              });
                              if (!ok) return;
                              try {
                                await removeLine.mutateAsync(line.id);
                              } catch (err) {
                                toast.error(formatApiError(err));
                              }
                            }}
                            className="p-2 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              {!!intake.lines.length && (
                <tfoot>
                  <tr className="bg-white/[0.02]">
                    <td colSpan={isDraft ? 6 : 5} className="px-4 py-3 text-sm font-black text-gray-400">
                      Jami: {positions} pozitsiya · {units} dona
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        <div className="glass-card rounded-2xl p-6 space-y-5 sticky top-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-white/40">Xulosa</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Ombor</span>
              <span className="font-bold">{intake.warehouse?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Pozitsiyalar</span>
              <span className="font-black text-lg">{positions}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Jami dona</span>
              <span className="font-black text-lg text-blue-400">{units}</span>
            </div>
            {intake.note && (
              <div className="pt-2 border-t border-white/5">
                <span className="text-[10px] uppercase tracking-widest text-white/30 font-black">
                  Izoh
                </span>
                <p className="text-gray-400 mt-1 text-sm">{intake.note}</p>
              </div>
            )}
          </div>

          {isDraft && (
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => void handleComplete()}
                disabled={complete.isPending || !intake.lines.length}
                className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {complete.isPending ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <CheckCircle2 size={18} />
                )}
                Tasdiqlash va omborga kirim
              </button>
              <button
                type="button"
                onClick={() => void handleCancel()}
                disabled={cancel.isPending}
                className="w-full py-3 rounded-xl border border-red-500/20 text-red-400 font-black text-sm hover:bg-red-500/10 flex items-center justify-center gap-2"
              >
                <XCircle size={16} />
                Bekor qilish
              </button>
            </div>
          )}

          {intake.status === 'COMPLETED' && (
            <div className="pt-2">
              <IntakeNakladnoyButton intakeId={intake.id} reference={intake.reference} />
            </div>
          )}
        </div>
      </div>

      <QuickProductModal
        open={quickOpen}
        barcode={quickBarcode}
        defaultQty={showBulkQty ? scanQty : 1}
        loading={quickProduct.isPending}
        onClose={() => {
          setQuickOpen(false);
          focusInput();
        }}
        onSubmit={async (dto) => {
          await quickProduct.mutateAsync(dto);
          setQuickOpen(false);
          setLastScanMsg({ ok: true, text: `${dto.name} qo‘shildi` });
          focusInput();
        }}
      />

      <ManualLineModal
        open={manualOpen}
        warehouseId={intake.warehouseId}
        loading={addLine.isPending}
        onClose={() => setManualOpen(false)}
        onSelect={async (variantId, quantity) => {
          await addLine.mutateAsync({ productVariantId: variantId, quantity });
          setManualOpen(false);
          toast.success('Qator qo‘shildi');
          focusInput();
        }}
      />
    </div>
  );
}
