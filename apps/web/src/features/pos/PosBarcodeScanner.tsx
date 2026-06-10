'use client';

import { useCallback, useState } from 'react';
import { Camera, ScanLine, Loader2, AlertCircle } from 'lucide-react';
import { posService } from '@/services/pos.service';
import { toast, formatApiError } from '@/lib/toast';
import { useBarcodeScanner } from './hooks/use-barcode-scan';
import { MobileCameraBarcodeScanner } from '@/components/mobile/MobileCameraBarcodeScanner';

const playBeep = (type: 'success' | 'error') => {
  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      osc.start();
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.3);
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch {
    // Ignore audio errors
  }
};

export type PosQuickSearchItem = {
  id: string;
  productId: string;
  productName: string | null;
  name: string;
  sku: string;
  barcode: string | null;
  salePrice: number;
  currency: string;
  unit?: string;
  stock: number | null;
};

type CartVariantInput = {
  id: string;
  productId: string;
  productName: string;
  name: string;
  salePrice?: number;
  currency?: string;
  unit?: string;
  stockQuantity?: number;
};

type Props = {
  warehouseId: string | null;
  onAddItem: (variant: CartVariantInput) => void;
  disabled?: boolean;
};

export function PosBarcodeScanner({
  warehouseId,
  onAddItem,
  disabled,
}: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'notfound'>('idle');
  const [cameraOpen, setCameraOpen] = useState(false);

  const handleScan = useCallback(
    async (barcode: string) => {
      if (!warehouseId) {
        toast.error('Skanerlash uchun avval omborni tanlang');
        return;
      }

      setStatus('loading');
      try {
        const results = (await posService.quickSearch(
          barcode,
          warehouseId,
        )) as PosQuickSearchItem[];

        const item = results[0];
        if (!item) {
          playBeep('error');
          setStatus('notfound');
          setTimeout(() => setStatus('idle'), 2000);
          return;
        }

        if (item.stock === 0) {
          playBeep('error');
          toast.warning(`${item.name} — omborda qoldiq yo'q`);
        } else {
          playBeep('success');
        }

        onAddItem({
          id: item.id,
          productId: item.productId,
          productName: item.productName ?? item.name,
          name: item.name,
          salePrice: item.salePrice,
          currency: item.currency,
          unit: item.unit,
          stockQuantity: item.stock ?? undefined,
        });
        setStatus('idle');
      } catch (err: unknown) {
        playBeep('error');
        setStatus('idle');
        toast.error(formatApiError(err, 'Aloqa xatosi, qayta skanlang'));
      }
    },
    [warehouseId, onAddItem],
  );

  useBarcodeScanner(handleScan, !disabled && !!warehouseId);

  if (disabled) return null;

  const statusContent = (
    <>
      {status === 'idle' && (
        <>
          <ScanLine size={14} className="text-[var(--pos-money)] shrink-0" />
          <span className="text-[var(--pos-muted)] truncate">Skaner tayyor</span>
        </>
      )}
      {status === 'loading' && (
        <>
          <Loader2 size={14} className="text-[var(--pos-accent)] animate-spin shrink-0" />
          <span className="text-[var(--pos-muted)] truncate">Qidirilmoqda...</span>
        </>
      )}
      {status === 'notfound' && (
        <>
          <AlertCircle size={14} className="text-red-500 shrink-0" />
          <span className="text-red-400 truncate">Topilmadi</span>
        </>
      )}
    </>
  );

  return (
    <>
      <div className="hidden md:flex items-center gap-2 text-xs font-bold shrink-0 px-1 mb-1">
        {statusContent}
      </div>

      <div className="md:hidden flex items-center gap-2 rounded-xl bg-[var(--pos-input-bg)] border border-[var(--pos-border)] px-3 py-2">
        <div className="flex flex-1 items-center gap-2 text-xs font-bold min-w-0">
          {statusContent}
        </div>
        <button
          type="button"
          onClick={() => setCameraOpen(true)}
          disabled={!warehouseId || status === 'loading'}
          className="shrink-0 h-10 px-3 rounded-lg bg-[var(--pos-accent)] text-white font-bold text-xs flex items-center gap-1.5 active:scale-95 disabled:opacity-40"
        >
          <Camera size={16} />
          Kamera
        </button>
      </div>

      <MobileCameraBarcodeScanner
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onScan={(code) => void handleScan(code)}
        busy={status === 'loading'}
        title="POS kamera skaner"
      />
    </>
  );
}
