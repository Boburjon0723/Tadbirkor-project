'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

export type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger';
};

type ConfirmState = ConfirmOptions & {
  open: boolean;
  resolve: (value: boolean) => void;
};

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

let globalConfirm: ((options: ConfirmOptions) => Promise<boolean>) | null = null;

export function registerGlobalConfirm(
  fn: (options: ConfirmOptions) => Promise<boolean>,
) {
  globalConfirm = fn;
}

/** Komponent tashqarisida (handler ichida) ishlatish uchun */
export async function confirmAction(
  message: string,
  options?: Omit<ConfirmOptions, 'message'>,
): Promise<boolean> {
  if (globalConfirm) {
    return globalConfirm({ message, ...options });
  }
  return window.confirm(message);
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null);
  const stateRef = useRef<ConfirmState | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      const next: ConfirmState = {
        ...options,
        open: true,
        resolve,
      };
      stateRef.current = next;
      setState(next);
    });
  }, []);

  useEffect(() => {
    registerGlobalConfirm(confirm);
    return () => {
      registerGlobalConfirm(() => Promise.resolve(false));
    };
  }, [confirm]);

  const close = (result: boolean) => {
    stateRef.current?.resolve(result);
    stateRef.current = null;
    setState(null);
  };

  const isDanger = state?.variant === 'danger';

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <AnimatePresence>
        {state?.open && (
          <motion.div
            className="desktop-modal-overlay z-[200]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="desktop-modal-backdrop"
              onClick={() => close(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="desktop-modal-panel max-w-md p-4 md:p-5"
            >
              <div className="flex items-start gap-3 mb-4">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isDanger ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                  }`}
                >
                  <AlertTriangle size={20} />
                </div>
                <div className="min-w-0">
                  <h3 className="desktop-modal-title">
                    {state.title || 'Tasdiqlash'}
                  </h3>
                  <p className="text-gray-400 text-sm mt-1.5 leading-relaxed">
                    {state.message}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => close(false)}
                  className="btn-dash-secondary flex-1"
                >
                  {state.cancelLabel || 'Bekor qilish'}
                </button>
                <button
                  type="button"
                  onClick={() => close(true)}
                  className={`flex-1 ${isDanger ? 'btn-dash-danger' : 'btn-dash-primary'}`}
                >
                  {state.confirmLabel || 'Ha, davom etish'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm must be used within ConfirmProvider');
  }
  return ctx;
}
