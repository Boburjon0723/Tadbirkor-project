'use client';

import { AlertCircle, Camera, CheckCircle2, Loader2, ScanLine } from 'lucide-react';
import { MobileCameraBarcodeScanner } from '@/components/mobile/MobileCameraBarcodeScanner';
import { usePosBarcodeScan } from './hooks/use-pos-barcode-scan';

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

type ScanControl = ReturnType<typeof usePosBarcodeScan>;

type Props = {
  warehouseId: string | null;
  onAddItem: (variant: CartVariantInput) => void;
  disabled?: boolean;
  /** Mobil: alohida status qatorini yashirish (header tugmalari ishlatiladi) */
  hideMobileChrome?: boolean;
  /** Tashqaridan boshqarish — ikki marta hook chaqirilmasligi uchun */
  scanControl: ScanControl;
};

export function ScannerStatusPill({
  status,
  statusHint,
}: {
  status: 'idle' | 'loading' | 'notfound' | 'added';
  statusHint: string | null;
}) {
  if (status === 'idle') {
    return (
      <>
        <ScanLine size={14} className="text-[var(--pos-money)] shrink-0" />
        <span className="text-[var(--pos-muted)] truncate">
          {statusHint ?? 'Skaner tayyor'}
        </span>
      </>
    );
  }
  if (status === 'loading') {
    return (
      <>
        <Loader2 size={14} className="text-[var(--pos-accent)] animate-spin shrink-0" />
        <span className="text-[var(--pos-muted)] truncate">Qidirilmoqda...</span>
      </>
    );
  }
  if (status === 'notfound') {
    return (
      <>
        <AlertCircle size={14} className="text-red-500 shrink-0" />
        <span className="text-red-400 truncate">{statusHint ?? 'Topilmadi'}</span>
      </>
    );
  }
  return (
    <>
      <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
      <span className="text-emerald-300 truncate font-black">
        {statusHint ?? "Qo'shildi"}
      </span>
    </>
  );
}

function PosBarcodeScannerView({
  scan,
  hideMobileChrome,
  warehouseId,
}: {
  scan: ScanControl;
  hideMobileChrome?: boolean;
  warehouseId: string | null;
}) {
  return (
    <>
      <div className="hidden md:flex items-center gap-2 text-xs font-bold shrink-0 px-1 mb-1">
        <ScannerStatusPill status={scan.status} statusHint={scan.statusHint} />
      </div>

      {!hideMobileChrome && (
        <div className="md:hidden flex items-center gap-2 rounded-xl bg-[var(--pos-input-bg)] border border-[var(--pos-border)] px-3 py-2">
          <div className="flex flex-1 items-center gap-2 text-xs font-bold min-w-0">
            <ScannerStatusPill status={scan.status} statusHint={scan.statusHint} />
          </div>
          <button
            type="button"
            onClick={scan.openCamera}
            disabled={!warehouseId || scan.isLoading}
            className="shrink-0 h-10 px-3 rounded-lg bg-[var(--pos-accent)] text-white font-bold text-xs flex items-center gap-1.5 active:scale-95 disabled:opacity-40"
          >
            <Camera size={16} />
            Kamera
          </button>
        </div>
      )}

      <MobileCameraBarcodeScanner
        open={scan.cameraOpen}
        onClose={scan.closeCamera}
        onScan={(code) => void scan.handleScan(code)}
        busy={scan.isLoading}
        title="POS kamera skaner"
        scanLog={scan.scanLog}
      />
    </>
  );
}

export function PosBarcodeScanner({
  warehouseId,
  onAddItem,
  disabled,
  hideMobileChrome = false,
  scanControl,
}: Props) {
  if (disabled) return null;

  return (
    <PosBarcodeScannerView
      scan={scanControl}
      hideMobileChrome={hideMobileChrome}
      warehouseId={warehouseId}
    />
  );
}
