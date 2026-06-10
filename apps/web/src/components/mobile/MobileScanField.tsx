'use client';

import React, { useState } from 'react';
import { Camera, Loader2, ScanLine } from 'lucide-react';
import { MobileCameraBarcodeScanner } from '@/components/mobile/MobileCameraBarcodeScanner';

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (barcode?: string) => void;
  busy?: boolean;
  placeholder?: string;
  qty?: string;
  onQtyChange?: (value: string) => void;
  showQty?: boolean;
  accentClass?: string;
  scannerTitle?: string;
};

export function MobileScanField({
  value,
  onChange,
  onSubmit,
  busy = false,
  placeholder = 'Barcode / SKU skaner...',
  qty,
  onQtyChange,
  showQty = false,
  accentClass = 'bg-teal-600',
  scannerTitle = 'Kamera skaner',
}: Props) {
  const [cameraOpen, setCameraOpen] = useState(false);

  const handleScan = (code: string) => {
    onChange(code);
    setCameraOpen(false);
    requestAnimationFrame(() => onSubmit(code));
  };

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(value.trim());
        }}
        className="flex flex-col gap-3"
      >
        <div className="flex gap-2">
          <input
            autoFocus
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-white text-base"
            enterKeyHint="done"
          />
          <button
            type="button"
            onClick={() => setCameraOpen(true)}
            className="shrink-0 w-14 h-14 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-white active:scale-95 transition-transform"
            aria-label="Kamera skaner"
          >
            <Camera size={22} />
          </button>
        </div>

        <div className="flex gap-2">
          {showQty && onQtyChange && (
            <input
              type="number"
              min={0}
              inputMode="decimal"
              value={qty ?? '1'}
              onChange={(e) => onQtyChange(e.target.value)}
              className="w-24 bg-black/40 border border-white/10 rounded-xl px-3 py-3.5 text-white text-center text-base"
              aria-label="Miqdor"
            />
          )}
          <button
            type="submit"
            disabled={busy || !value.trim()}
            className={`flex-1 flex items-center justify-center gap-2 h-14 rounded-xl font-black active:scale-[0.98] transition-transform disabled:opacity-50 ${accentClass || 'bg-teal-600 text-white'}`}
          >
            {busy ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <ScanLine size={20} />
            )}
            Skaner
          </button>
        </div>
      </form>

      <MobileCameraBarcodeScanner
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onScan={handleScan}
        busy={busy}
        title={scannerTitle}
      />
    </>
  );
}
