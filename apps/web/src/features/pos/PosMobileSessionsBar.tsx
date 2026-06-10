'use client';

import React from 'react';
import { Plus, ShoppingCart, X } from 'lucide-react';
import type { CartSession } from './usePosMultiCart';

type Props = {
  sessions: CartSession[];
  activeId: string;
  onSwitch: (id: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
};

function sessionCustomerLabel(session: CartSession): string | null {
  if (session.customer.customerName) return session.customer.customerName;
  if (session.customer.retailCustomerId) return 'Tanlangan';
  return null;
}

export function PosMobileSessionsBar({
  sessions,
  activeId,
  onSwitch,
  onAdd,
  onRemove,
  disabled = false,
}: Props) {
  return (
    <div className="flex items-stretch gap-1.5 overflow-x-auto no-scrollbar pb-2 -mx-0.5 px-0.5">
      {sessions.map((session) => {
        const isActive = session.id === activeId;
        const itemCount = session.cart.length;
        const subtitle = sessionCustomerLabel(session);

        return (
          <button
            key={session.id}
            type="button"
            disabled={disabled}
            onClick={() => onSwitch(session.id)}
            className={`relative shrink-0 min-w-[5.5rem] max-w-[7.5rem] px-3 py-2 rounded-xl border text-left transition-all active:scale-[0.97] disabled:opacity-50 ${
              isActive
                ? 'bg-[var(--pos-accent)]/15 border-cyan-500/40 text-[var(--pos-cart-text)] shadow-lg shadow-cyan-900/10'
                : 'bg-[var(--pos-cart-card)] border-[var(--pos-cart-border)] text-[var(--pos-cart-muted)]'
            }`}
          >
            <div className="flex items-center gap-1 pr-4">
              <ShoppingCart size={11} className={isActive ? 'text-cyan-300' : ''} />
              <span className="text-[11px] font-black truncate">{session.label}</span>
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
                className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center"
              >
                <X size={10} />
              </span>
            )}
          </button>
        );
      })}

      <button
        type="button"
        disabled={disabled}
        onClick={onAdd}
        className="shrink-0 w-11 rounded-xl border border-dashed border-[var(--pos-cart-border)] bg-[var(--pos-cart-card)] text-cyan-300 flex flex-col items-center justify-center gap-0.5 active:scale-95 disabled:opacity-50"
        aria-label="Yangi mijoz savati"
        title="Yangi savat (Mijoz 2, 3...)"
      >
        <Plus size={18} />
        <span className="text-[8px] font-black uppercase">Yangi</span>
      </button>
    </div>
  );
}
