'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Barcode,
  Camera,
  CheckCircle2,
  Loader2,
  Minus,
  MoreVertical,
  Plus,
  ScanLine,
  Trash2,
  XCircle,
} from 'lucide-react';
import { MobileCameraBarcodeScanner } from '@/components/mobile/MobileCameraBarcodeScanner';
import type { WarehouseIntake } from '@/services/warehouse-intake.service';
import { useWarehouseIntakeMutations } from '@/hooks/warehouse-intake/use-warehouse-intake';
import { toast, formatApiError } from '@/lib/toast';
import { confirmAction } from '@/components/ConfirmDialog';
import {
  intakeStatusMobileLabel,
  intakeStatusPillClass,
  intakeTotals,
  lineQty,
  scanModeMobileLabel,
} from '@/features/warehouse-intake/intake-utils';
import { QuickProductMobileSheet } from '@/features/warehouse-intake/mobile/QuickProductMobileSheet';
import { IntakeConfirmMobileSheet } from '@/features/warehouse-intake/mobile/IntakeConfirmMobileSheet';
import { IntakeSuccessMobile } from '@/features/warehouse-intake/mobile/IntakeSuccessMobile';
import { IntakeNakladnoyButton } from '@/features/warehouse-intake/IntakeNakladnoyButton';

type ScanChip = { ok: boolean; text: string };

type Props = {
  intake: WarehouseIntake;
  onUpdated: () => void;
};

export function IntakeMobileSession({ intake, onUpdated }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [barcode, setBarcode] = useState('');
  const [scanQty, setScanQty] = useState(1);
  const [chips, setChips] = useState<ScanChip[]>([]);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickBarcode, setQuickBarcode] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successData, setSuccessData] = useState<{
    intakeId: string;
    reference: string;
    units: number;
  } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  const settings = intake.intakeSettings;
  const isDraft = intake.status === 'DRAFT';
  const { positions, units } = intakeTotals(intake);

  const { scan, quickProduct, removeLine, complete, cancel } =
    useWarehouseIntakeMutations(intake.id);

  const showBulkQty =
    settings?.scanMode === 'SINGLE_SCAN_QTY' && settings?.allowBulkQty !== false;

  const focusInput = useCallback(() => {
    if (!isDraft) return;
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [isDraft]);

  useEffect(() => {
    focusInput();
  }, [focusInput, intake.lines.length]);

  const pushChip = (chip: ScanChip) => {
    setChips((prev) => [chip, ...prev].slice(0, 3));
  };

  const handleScan = async (code?: string) => {
    const value = (code ?? barcode).trim();
    if (!value || !isDraft) return;

    try {
      const updated = await scan.mutateAsync({
        barcode: value,
        quantity: showBulkQty ? scanQty : 1,
      });
      setBarcode('');
      const added = updated.lines.find(
        (l) =>
          l.scannedBarcode === value ||
          l.productVariant?.barcode === value ||
          l.productVariant?.sku === value,
      );
      const label = added?.productVariant?.name ?? value;
      pushChip({
        ok: true,
        text: `${label} +${showBulkQty ? scanQty : 1}`,
      });
      toast.success(`${label} qo‘shildi`);
      focusInput();
    } catch (err: unknown) {
      const msg = formatApiError(err, 'Skaner xatosi');
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404 && settings?.allowQuickProduct) {
        setQuickBarcode(value);
        setQuickOpen(true);
        setBarcode('');
        pushChip({ ok: false, text: "Katalogda yo'q" });
        toast.info('Mahsulot katalogda yo‘q — tez qo‘shish oynasi ochildi');
      } else if (status === 404) {
        pushChip({ ok: false, text: "Katalogda yo'q" });
        toast.error(
          `«${value}» katalogda topilmadi. Mahsulot «Ombor» bo‘limida barcode bilan ro‘yxatdan o‘tgan bo‘lishi kerak (ombor qoldig‘i 0 bo‘lsa ham kirim qilish mumkin).`,
        );
      } else {
        pushChip({ ok: false, text: msg.slice(0, 28) });
        toast.error(msg);
      }
      focusInput();
    }
  };

  const handleComplete = async () => {
    try {
      await complete.mutateAsync();
      setConfirmOpen(false);
      setSuccessData({ intakeId: intake.id, reference: intake.reference, units });
      onUpdated();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const handleCancel = async () => {
    setMenuOpen(false);
    const ok = await confirmAction('Qoralama bekor qilinsinmi?', {
      variant: 'danger',
      confirmLabel: 'Bekor qilish',
    });
    if (!ok) return;
    try {
      await cancel.mutateAsync();
      toast.success('Bekor qilindi');
      router.push('/dashboard/warehouse-intake');
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  if (successData) {
    return (
      <IntakeSuccessMobile
        intakeId={successData.intakeId}
        reference={successData.reference}
        units={successData.units}
        onBackToList={() => router.push('/dashboard/warehouse-intake')}
      />
    );
  }

  return (
    <div className="lg:hidden fixed inset-0 z-[100] bg-[#0e1511] text-[#dde4dd] flex flex-col overflow-hidden">
      <header className="mobile-header-bar-compact flex-shrink-0 px-4 flex items-center gap-3 border-b border-white/10 bg-[#0e1511]/95 backdrop-blur-xl">
        <Link
          href="/dashboard/warehouse-intake"
          className="p-2 -ml-2 active:scale-95 text-emerald-400"
        >
          <ArrowLeft size={22} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold truncate font-mono">{intake.reference}</h1>
        </div>
        <span
          className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase ${intakeStatusPillClass(intake.status)}`}
        >
          {intakeStatusMobileLabel(intake.status)}
        </span>
        {isDraft && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="p-2 active:scale-95"
            >
              <MoreVertical size={20} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 intake-glass rounded-xl py-1 min-w-[160px] z-50">
                <button
                  type="button"
                  onClick={() => void handleCancel()}
                  className="w-full px-4 py-3 text-left text-sm text-red-400 flex items-center gap-2"
                >
                  <XCircle size={16} />
                  Bekor qilish
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      <main className="flex-1 flex flex-col overflow-hidden min-h-0">
        {isDraft && (
          <section className="flex-shrink-0 p-5 bg-gradient-to-b from-[#161d19] to-[#0e1511] space-y-4">
            <div className="flex justify-between items-center gap-2">
              <div className="flex items-center gap-2 bg-[#2f3632]/50 px-3 py-1.5 rounded-full border border-white/5">
                <Barcode size={16} className="text-emerald-400" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#bbcabf]">
                  {scanModeMobileLabel(settings)}
                </span>
              </div>
              {showBulkQty && (
                <div className="flex items-center intake-glass rounded-xl p-0.5">
                  <button
                    type="button"
                    onClick={() => setScanQty((q) => Math.max(1, q - 1))}
                    className="w-10 h-10 flex items-center justify-center active:bg-white/10 rounded-lg"
                  >
                    <Minus size={18} />
                  </button>
                  <span className="w-10 text-center font-bold text-emerald-400">{scanQty}</span>
                  <button
                    type="button"
                    onClick={() => setScanQty((q) => q + 1)}
                    className="w-10 h-10 flex items-center justify-center active:bg-white/10 rounded-lg"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="relative">
                <input
                  ref={inputRef}
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleScan();
                    }
                  }}
                  disabled={scan.isPending}
                  enterKeyHint="go"
                  inputMode="text"
                  placeholder="Barcode yoki SKU"
                  className="w-full h-20 intake-glass rounded-[20px] px-4 text-xl font-mono text-center border-2 border-emerald-500/30 outline-none focus:border-emerald-500 intake-scanner-pulse disabled:opacity-60"
                  autoComplete="off"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCameraOpen(true)}
                  disabled={scan.isPending}
                  className="h-14 rounded-xl bg-white/10 border border-emerald-500/30 text-emerald-300 font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-40"
                >
                  <Camera size={20} />
                  Kamera
                </button>
                <button
                  type="button"
                  onClick={() => void handleScan()}
                  disabled={scan.isPending || !barcode.trim()}
                  className="h-14 rounded-xl bg-emerald-500 text-[#00422b] font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-40 shadow-lg shadow-emerald-500/20"
                >
                  {scan.isPending ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <ScanLine size={20} />
                  )}
                  Qo&apos;shish
                </button>
              </div>

              <p className="text-[11px] text-center text-[#86948a] leading-relaxed px-2">
                Qidiruv mahsulot <span className="text-[#bbcabf]">katalogi</span> bo‘yicha.
                Omborda qoldiq 0 bo‘lsa ham kirim qilish mumkin.
              </p>
            </div>

            {!!chips.length && (
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {chips.map((c, i) => (
                  <div
                    key={`${c.text}-${i}`}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold ${
                      c.ok
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                        : 'bg-red-500/10 border-red-500/20 text-red-300'
                    }`}
                  >
                    {c.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                    {c.text}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-0 pb-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#bbcabf] mb-1">
            Qabul qilingan tovarlar
          </div>
          {!intake.lines.length && isDraft && (
            <p className="text-center text-[#86948a] py-10 text-sm">
              Barcode skaner qiling yoki qo&apos;lda kiriting
            </p>
          )}
          {!intake.lines.length && !isDraft && (
            <p className="text-center text-[#86948a] py-10 text-sm">
              Ushbu hujjatda mahsulot qatori yo&apos;q
            </p>
          )}
          {intake.lines.map((line) => {
            const pv = line.productVariant;
            const qty = lineQty(line);
            const img = pv?.product?.imageUrl;
            return (
              <div
                key={line.id}
                className="intake-glass p-4 rounded-[20px] flex items-center gap-3 active:scale-[0.99]"
              >
                <div className="w-12 h-12 rounded-lg bg-[#2f3632] flex items-center justify-center overflow-hidden shrink-0">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Barcode size={20} className="text-[#86948a]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate">{pv?.name}</div>
                  <div className="font-mono text-[11px] text-[#bbcabf] truncate">
                    {pv?.barcode || pv?.sku || '—'}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xl font-bold text-emerald-400">{qty}</div>
                  <div className="text-[10px] font-bold uppercase text-[#86948a]">dona</div>
                </div>
                {isDraft && (
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
                    className="p-2 text-[#86948a] active:text-red-400"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            );
          })}
        </section>
      </main>

      {!isDraft && intake.status === 'COMPLETED' && (
        <footer className="flex-shrink-0 px-5 py-4 border-t border-white/15 bg-[#0e1511]/95 backdrop-blur-xl pb-safe">
          <IntakeNakladnoyButton intakeId={intake.id} reference={intake.reference} />
        </footer>
      )}

      {isDraft && (
        <footer className="flex-shrink-0 h-[72px] px-5 flex items-center justify-between border-t border-white/15 bg-[#0e1511]/95 backdrop-blur-xl pb-safe">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#bbcabf]">
              Jami
            </span>
            <p className="text-sm font-bold">
              {positions} poz · <span className="text-emerald-400">{units} dona</span>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={!intake.lines.length || complete.isPending}
            className="h-12 px-6 bg-emerald-500 text-[#00422b] font-bold rounded-xl flex items-center gap-2 active:scale-95 disabled:opacity-40 shadow-lg shadow-emerald-500/20"
          >
            Tasdiqlash
          </button>
        </footer>
      )}

      <MobileCameraBarcodeScanner
        open={cameraOpen && isDraft}
        onClose={() => {
          setCameraOpen(false);
          focusInput();
        }}
        onScan={(code) => void handleScan(code)}
        busy={scan.isPending || quickProduct.isPending}
      />

      <QuickProductMobileSheet
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
          pushChip({ ok: true, text: `${dto.name} qo‘shildi` });
          focusInput();
        }}
      />

      <IntakeConfirmMobileSheet
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleComplete}
        lines={intake.lines}
        positions={positions}
        units={units}
        loading={complete.isPending}
      />
    </div>
  );
}
