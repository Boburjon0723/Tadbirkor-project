'use client';

import React from 'react';
import { Plus, ShoppingCart, X } from 'lucide-react';
import { getSessionCustomerSubtitle } from './pos-customer.util';
import type { CartSession } from './usePosMultiCart';

type Props = {
  sessions: CartSession[];
  activeId: string;
  onSwitch: (id: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
};

export function PosMobileSessionsBar({
  sessions,
  activeId,
  onSwitch,
  onAdd,
  onRemove,
  disabled = false,
}: Props) {
  if (sessions.length <= 1) return null;

  return (
    <div className="flex items-stretch gap-1.5 overflow-x-auto no-scrollbar pb-2 -mx-0.5 px-0.5">
      {sessions.map((session) => {
        const isActive = session.id === activeId;
        const itemCount = session.cart.length;
        const subtitle = getSessionCustomerSubtitle(session);

        return (
          <button
            key={session.id}
            type="button"
            disabled={disabled}
            onClick={() => onSwitch(session.id)}
            className={`relative shrink-0 min-w-[5.5rem] max-w-[7.5rem] pl-3 pr-7 py-2.5 min-h-[42px] rounded-xl border text-left transition-all active:scale-[0.97] disabled:opacity-50 ${
              isActive
                ? 'bg-[var(--pos-accent)]/15 border-cyan-500/40 text-[var(--pos-cart-text)] shadow-lg shadow-cyan-900/10'
                : 'bg-[var(--pos-cart-card)] border-[var(--pos-cart-border)] text-[var(--pos-cart-muted)]'
            }`}
          >
            <div className="flex items-center gap-1 min-h-[14px]">
              <ShoppingCart size={11} className={`shrink-0 block ${isActive ? 'text-cyan-300' : ''}`} />
              <span className="text-[11px] font-black truncate leading-none">{session.label}</span>
            </div>
            {subtitle ? (
              <p
                className={`text-[9px] font-bold truncate mt-0.5 ${
                  isActive ? 'text-[var(--pos-cart-text)]/80' : 'text-[var(--pos-cart-muted)]'
                }`}
              >
                {subtitle}
              </p>
            ) : null}
            {itemCount > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-[var(--pos-accent)] text-white text-[9px] font-black flex items-center justify-center">
                {itemCount}
              </span>
            )}
            {sessions.length > 1 && (
              <span
                role="button"
                tabIndex={0}
                aria-label={`${session.label} savatini o'chirish`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!disabled) onRemove(session.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.stopPropagation();
                    if (!disabled) onRemove(session.id);
                  }
                }}
                className="absolute bottom-1.5 right-1.5 w-4 h-4 rounded-full bg-red-500/20 text-red-400 inline-flex items-center justify-center"
              >
                <X size={10} className="block shrink-0" />
              </span>
            )}
          </button>
        );
      })}

      <button
        type="button"
        disabled={disabled}
        onClick={onAdd}
        className="shrink-0 w-11 min-h-[42px] rounded-xl border border-dashed border-[var(--pos-cart-border)] bg-[var(--pos-cart-card)] text-cyan-300 inline-flex flex-col items-center justify-center gap-0.5 active:scale-95 disabled:opacity-50"
        aria-label="Yangi mijoz savati"
        title="Yangi savat (Mijoz 2, 3...)"
      >
        <Plus size={18} />
        <span className="text-[8px] font-black uppercase">Yangi</span>
      </button>
    </div>
  );
}
