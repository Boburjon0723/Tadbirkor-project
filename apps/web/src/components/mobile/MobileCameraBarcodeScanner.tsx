'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, CheckCircle2, Loader2, X, XCircle, Zap } from 'lucide-react';

export type ScannerLogEntry = {
  id: string;
  ok: boolean;
  title: string;
  detail?: string;
};
import type { IScannerControls } from '@zxing/browser';

type Props = {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
  busy?: boolean;
  title?: string;
  /** POS: oxirgi skaner natijalari (pastda ko‘rsatiladi) */
  scanLog?: ScannerLogEntry[];
};

async function pickBackCameraId(): Promise<string | undefined> {
  const { BrowserMultiFormatReader } = await import('@zxing/browser');
  const devices = await BrowserMultiFormatReader.listVideoInputDevices();
  if (!devices.length) return undefined;
  const back = devices.find((d) =>
    /back|rear|environment|orqa|задн/i.test(d.label),
  );
  return (back ?? devices[devices.length - 1])?.deviceId;
}

export function MobileCameraBarcodeScanner({
  open,
  onClose,
  onScan,
  busy = false,
  title = 'Kamera skaner',
  scanLog = [],
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const lastScanRef = useRef({ code: '', at: 0 });
  const onScanRef = useRef(onScan);

  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const stopCamera = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    const video = videoRef.current;
    const stream = video?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (video) video.srcObject = null;
  }, []);

  useEffect(() => {
    if (!open) {
      stopCamera();
      setError(null);
      setStarting(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setStarting(true);
      setError(null);
      try {
        if (!window.isSecureContext) {
          throw new Error('Kamera HTTPS yoki localhost da ishlaydi');
        }

        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        const reader = new BrowserMultiFormatReader();
        const deviceId = await pickBackCameraId();

        await new Promise((r) => requestAnimationFrame(r));
        if (cancelled || !videoRef.current) return;

        controlsRef.current = await reader.decodeFromVideoDevice(
          deviceId,
          videoRef.current,
          (result) => {
            if (!result || busy) return;
            const code = result.getText().trim();
            if (code.length < 3) return;

            const now = Date.now();
            if (
              lastScanRef.current.code === code &&
              now - lastScanRef.current.at < 1800
            ) {
              return;
            }
            lastScanRef.current = { code, at: now };
            onScanRef.current(code);
          },
        );
      } catch (e) {
        if (!cancelled) {
          const msg =
            e instanceof Error ? e.message : 'Kamera ochib bo‘lmadi';
          setError(
            msg.includes('Permission') || msg.includes('NotAllowed')
              ? 'Kameraga ruxsat bering (Sozlamalar → Brauzer)'
              : msg,
          );
        }
      } finally {
        if (!cancelled) setStarting(false);
      }
    })();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [open, stopCamera, busy]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[200] bg-black flex flex-col"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <header className="mobile-header-bar-compact shrink-0 px-4 flex items-center justify-between bg-black/80 backdrop-blur-md z-10">
            <div className="flex items-center gap-2 text-white min-w-0">
              <Camera size={20} className="text-cyan-400 shrink-0" />
              <span className="text-sm font-bold truncate">{title}</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 p-2.5 min-w-[44px] min-h-[44px] rounded-xl bg-white/10 text-white active:scale-95 touch-manipulation flex items-center justify-center"
              aria-label="Yopish"
            >
              <X size={22} />
            </button>
          </header>

          <div className="relative flex-1 min-h-0 bg-black">
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              playsInline
              muted
              autoPlay
            />

            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-[min(88vw,320px)] aspect-[4/3] rounded-2xl border-2 border-cyan-400/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
            </div>

            {(starting || busy) && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <Loader2 size={40} className="animate-spin text-cyan-400" />
              </div>
            )}

            {error && (
              <div className="absolute inset-x-4 bottom-24 p-4 rounded-2xl bg-red-500/20 border border-red-500/30 text-red-200 text-sm text-center">
                {error}
              </div>
            )}
          </div>

          <footer className="shrink-0 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-black/90 border-t border-white/10 space-y-2 max-h-[40vh]">
            {scanLog.length > 0 ? (
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 px-1">
                  Skaner qilingan
                </p>
                <ul className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar">
                  {scanLog.map((entry) => (
                    <li
                      key={entry.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs ${
                        entry.ok
                          ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-100'
                          : 'bg-red-500/10 border-red-500/25 text-red-100'
                      }`}
                    >
                      {entry.ok ? (
                        <CheckCircle2 size={14} className="shrink-0 text-emerald-400" />
                      ) : (
                        <XCircle size={14} className="shrink-0 text-red-400" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-bold truncate">{entry.title}</p>
                        {entry.detail ? (
                          <p className="text-[10px] opacity-80 truncate">{entry.detail}</p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-center text-xs text-gray-400 flex items-center justify-center gap-1.5 py-1">
                <Zap size={14} className="text-cyan-400 shrink-0" />
                Barcodeni ramka ichiga tuting — avtomatik qo‘shiladi
              </p>
            )}
          </footer>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
