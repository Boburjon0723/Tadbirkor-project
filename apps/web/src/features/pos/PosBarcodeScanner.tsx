'use client';

import { useCallback, useState } from 'react';
import { ScanLine, Loader2, AlertCircle } from 'lucide-react';
import { posService } from '@/services/pos.service';
import { toast, formatApiError } from '@/lib/toast';
import { useBarcodeScanner } from './hooks/use-barcode-scan';

const playBeep = (type: 'success' | 'error') => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
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
  } catch (e) {
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
  stock: number | null;
};

type CartVariantInput = {
  id: string;
  productId: string;
  productName: string;
  name: string;
  salePrice?: number;
  currency?: string;
};

type Props = {
  warehouseId: string | null;
  onAddItem: (variant: CartVariantInput) => void;
  disabled?: boolean;
};

export function PosBarcodeScanner({ warehouseId, onAddItem, disabled }: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'notfound'>('idle');

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
        });
        setStatus('idle');
      } catch (err: unknown) {
        playBeep('error');
        setStatus('idle');
        toast.error(formatApiError(err, "Aloqa xatosi, qayta skanlang"));
      }
    },
    [warehouseId, onAddItem],
  );

  useBarcodeScanner(handleScan, !disabled && !!warehouseId);

  if (disabled) return null;

  return (
    <div className="flex items-center gap-2 text-xs font-bold shrink-0 px-1">
      {status === 'idle' && (
        <>
          <ScanLine size={14} className="text-emerald-500" />
          <span className="text-gray-500">Skaner tayyor</span>
        </>
      )}
      {status === 'loading' && (
        <>
          <Loader2 size={14} className="text-blue-500 animate-spin" />
          <span className="text-gray-400">Qidirilmoqda...</span>
        </>
      )}
      {status === 'notfound' && (
        <>
          <AlertCircle size={14} className="text-red-500" />
          <span className="text-red-400">Mahsulot topilmadi</span>
        </>
      )}
    </div>
  );
}
