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
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => close(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md rounded-[2rem] border border-white/10 bg-[#0a0a0a] p-8 shadow-2xl"
            >
              <div className="flex items-start gap-4 mb-6">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                    isDanger ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                  }`}
                >
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">
                    {state.title || 'Tasdiqlash'}
                  </h3>
                  <p className="text-gray-400 text-sm mt-2 leading-relaxed">
                    {state.message}
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => close(false)}
                  className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 font-bold text-gray-400 hover:bg-white/10 transition-all"
                >
                  {state.cancelLabel || 'Bekor qilish'}
                </button>
                <button
                  type="button"
                  onClick={() => close(true)}
                  className={`flex-1 py-3 rounded-xl font-black text-white transition-all ${
                    isDanger
                      ? 'bg-red-600 hover:bg-red-500'
                      : 'bg-blue-600 hover:bg-blue-500'
                  }`}
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
