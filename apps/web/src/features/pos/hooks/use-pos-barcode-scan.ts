'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { posService } from '@/services/pos.service';
import { toast, formatApiError } from '@/lib/toast';
import { playPosScanSound } from '../pos-scan-feedback.util';
import { getScanAddQuantityLabel } from '../pos-scan-quantity.util';
import { useBarcodeScanner } from './use-barcode-scan';
import type { PosQuickSearchItem } from '../PosBarcodeScanner';

export type PosScanVariantInput = {
  id: string;
  productId: string;
  productName: string;
  name: string;
  salePrice?: number;
  currency?: string;
  unit?: string;
  stockQuantity?: number;
};

type ScannerStatus = 'idle' | 'loading' | 'notfound' | 'added';

export type PosScanLogEntry = {
  id: string;
  ok: boolean;
  title: string;
  detail?: string;
};

type Options = {
  warehouseId: string | null;
  onAddItem: (variant: PosScanVariantInput) => void;
  disabled?: boolean;
};

export function usePosBarcodeScan({
  warehouseId,
  onAddItem,
  disabled,
}: Options) {
  const [status, setStatus] = useState<ScannerStatus>('idle');
  const [statusHint, setStatusHint] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [scanLog, setScanLog] = useState<PosScanLogEntry[]>([]);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastReadyWarehouseRef = useRef<string | null>(null);
  const scanLogIdRef = useRef(0);

  const pushScanLog = useCallback((entry: Omit<PosScanLogEntry, 'id'>) => {
    scanLogIdRef.current += 1;
    setScanLog((prev) =>
      [{ ...entry, id: String(scanLogIdRef.current) }, ...prev].slice(0, 8),
    );
  }, []);

  const clearHintTimer = useCallback(() => {
    if (hintTimerRef.current) {
      clearTimeout(hintTimerRef.current);
      hintTimerRef.current = null;
    }
  }, []);

  const flashStatus = useCallback(
    (next: ScannerStatus, hint: string | null, ms: number) => {
      clearHintTimer();
      setStatus(next);
      setStatusHint(hint);
      hintTimerRef.current = setTimeout(() => {
        setStatus('idle');
        setStatusHint(null);
        hintTimerRef.current = null;
      }, ms);
    },
    [clearHintTimer],
  );

  useEffect(() => () => clearHintTimer(), [clearHintTimer]);

  useEffect(() => {
    if (disabled || !warehouseId) return;
    if (lastReadyWarehouseRef.current === warehouseId) return;
    lastReadyWarehouseRef.current = warehouseId;
    playPosScanSound('ready');
  }, [warehouseId, disabled]);

  const handleScan = useCallback(
    async (barcode: string) => {
      if (!warehouseId) {
        toast.error('Skanerlash uchun avval omborni tanlang');
        return;
      }

      clearHintTimer();
      setStatus('loading');
      setStatusHint(null);

      try {
        const results = (await posService.quickSearch(
          barcode,
          warehouseId,
        )) as PosQuickSearchItem[];

        const item = results[0];
        if (!item) {
          playPosScanSound('error');
          pushScanLog({ ok: false, title: 'Topilmadi', detail: barcode });
          flashStatus('notfound', 'Topilmadi', 2000);
          toast.warning(`Barkod topilmadi: ${barcode}`);
          return;
        }

        const displayName = item.productName?.trim() || item.name;
        const { label: qtyLabel, needsQuantityModal } = getScanAddQuantityLabel(
          item.unit,
        );

        if (item.stock === 0) {
          playPosScanSound('error');
          pushScanLog({ ok: false, title: displayName, detail: "Qoldiq yo'q" });
          flashStatus('notfound', "Qoldiq yo'q", 2000);
          toast.warning(`${displayName} — omborda qoldiq yo'q`);
          return;
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

        if (needsQuantityModal) {
          playPosScanSound('ready');
          pushScanLog({ ok: true, title: displayName, detail: 'Miqdor kiritish' });
          setCameraOpen(false);
          flashStatus('added', `${displayName} — miqdor`, 2500);
          toast.info(`${displayName} — miqdorni kiriting`, { duration: 2800 });
          return;
        }

        playPosScanSound('success');
        const hint = `+${qtyLabel}`;
        pushScanLog({ ok: true, title: displayName, detail: hint });
        flashStatus('added', hint, 2200);
        toast.success(`${hint} · ${displayName}`, { duration: 2200 });
      } catch (err: unknown) {
        playPosScanSound('error');
        setStatus('idle');
        setStatusHint(null);
        toast.error(formatApiError(err, 'Aloqa xatosi, qayta skanlang'));
      }
    },
    [warehouseId, onAddItem, clearHintTimer, flashStatus, pushScanLog],
  );

  useBarcodeScanner(handleScan, !disabled && !!warehouseId);

  const openCamera = useCallback(() => {
    playPosScanSound('ready');
    setScanLog([]);
    setCameraOpen(true);
  }, []);

  const closeCamera = useCallback(() => setCameraOpen(false), []);

  return {
    status,
    statusHint,
    cameraOpen,
    openCamera,
    closeCamera,
    handleScan,
    isLoading: status === 'loading',
    scanLog,
  };
}
