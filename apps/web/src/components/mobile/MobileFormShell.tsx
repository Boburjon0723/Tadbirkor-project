'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useKeyboardInset } from '@/hooks/use-keyboard-inset';

const MAX_WIDTH: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '4xl': 'max-w-4xl',
};

type Props = {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: keyof typeof MAX_WIDTH;
  zIndex?: number;
  /** Desktop: markazdagi modal; mobil: to‘liq ekran */
  desktopCentered?: boolean;
};

export function MobileFormShell({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  maxWidth = 'lg',
  zIndex = 100,
  desktopCentered = true,
}: Props) {
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const keyboardActive = open && isMobileViewport;
  const { inset: keyboardInset, viewportHeight, offsetTop } =
    useKeyboardInset(keyboardActive);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const sync = () => setIsMobileViewport(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (!keyboardActive) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [keyboardActive]);

  const handleFieldFocus = useCallback(
    (e: React.FocusEvent) => {
      if (!isMobileViewport) return;
      const el = e.target;
      if (!(el instanceof HTMLElement)) return;
      if (!el.matches('input, textarea, select')) return;
      window.setTimeout(() => {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 280);
    },
    [isMobileViewport],
  );

  const mobilePanelStyle = isMobileViewport
    ? {
        position: 'fixed' as const,
        top: offsetTop,
        left: 0,
        right: 0,
        height: viewportHeight ?? undefined,
        maxHeight: viewportHeight ?? undefined,
        zIndex: zIndex + 1,
      }
    : undefined;

  const desktopWrap = desktopCentered
    ? 'md:items-center md:justify-center md:p-3 lg:p-4'
    : 'md:items-end md:justify-center md:p-3 lg:p-4';

  return (
    <AnimatePresence initial={false}>
      {open && (
        <div
          className={`fixed inset-0 flex flex-col ${desktopWrap}`}
          style={{ zIndex }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
          />

          <motion.div
            initial={
              isMobileViewport
                ? { opacity: 0, y: '100%' }
                : { opacity: 0, scale: 0.96, y: 12 }
            }
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={
              isMobileViewport
                ? { opacity: 0, y: '100%' }
                : { opacity: 0, scale: 0.96, y: 12 }
            }
            transition={
              isMobileViewport
                ? { type: 'spring', damping: 28, stiffness: 320 }
                : { duration: 0.18 }
            }
            style={mobilePanelStyle}
            className={`relative flex flex-col w-full h-full md:h-auto md:max-h-[92vh] ${MAX_WIDTH[maxWidth]} md:w-full bg-[#0a0a0a] md:border md:border-white/10 md:rounded-2xl shadow-2xl overflow-hidden pt-[env(safe-area-inset-top)] md:!pt-0 md:!top-auto md:!left-auto md:!right-auto md:!h-auto md:!max-h-[92vh]`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="desktop-modal-header">
              <div className="flex items-start gap-3">
                {icon && <div className="shrink-0">{icon}</div>}
                <div className="flex-1 min-w-0">
                  <h2 className="desktop-modal-title">{title}</h2>
                  {subtitle && (
                    <p className="text-xs md:text-sm text-gray-500 mt-0.5">{subtitle}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-xl hover:bg-white/5 text-gray-400 shrink-0"
                  aria-label="Yopish"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div
              onFocusCapture={handleFieldFocus}
              className="desktop-modal-body scroll-pb-28 md:scroll-pb-4"
            >
              {children}
            </div>

            {footer && (
              <div
                className={`desktop-modal-footer bg-[#0a0a0a]/95 backdrop-blur-xl ${
                  keyboardInset > 0
                    ? '!py-2'
                    : 'pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:!pb-4'
                }`}
              >
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
