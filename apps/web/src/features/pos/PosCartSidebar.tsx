'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  Package,
  Pencil,
  Plus,
  ShoppingCart,
  Trash2,
  X,
} from 'lucide-react';
import { formatStockQuantity } from '@/lib/product-units';
import { PosCustomerStrip, type PosCustomerSelection } from './PosCustomerStrip';
import { PosQuantityInput } from './PosQuantityInput';
import type { PosCartItem } from './types';
import type { SaleCurrency } from '@/lib/currency';
import type { CartSession } from './usePosMultiCart';

type Props = {
  cart: PosCartItem[];
  customer: PosCustomerSelection;
  totalAmount: number;
  isCartOpenMobile: boolean;
  formatMoney: (value: number, currency?: SaleCurrency) => string;
  onCustomerChange: (v: PosCustomerSelection) => void;
  onClearCart: () => void;
  onCloseMobile: () => void;
  onSetQuantity: (variantId: string, quantity: number) => void;
  onRemove: (variantId: string) => void;
  onCheckout: () => void;
  onEditPrice: (item: PosCartItem) => void;
  showPriceEdit: boolean;
  sessions: CartSession[];
  activeId: string;
  onAddCart: () => void;
  onSwitchCart: (id: string) => void;
  onRemoveCart: (id: string) => void;
};

export function PosCartSidebar({
  cart,
  customer,
  totalAmount,
  isCartOpenMobile,
  formatMoney,
  onCustomerChange,
  onClearCart,
  onCloseMobile,
  onSetQuantity,
  onRemove,
  onCheckout,
  onEditPrice,
  showPriceEdit,
  sessions,
  activeId,
  onAddCart,
  onSwitchCart,
  onRemoveCart,
}: Props) {
  const showDesktop =
    typeof window !== 'undefined' && window.innerWidth >= 768;

  return (
    <AnimatePresence>
      {(isCartOpenMobile || showDesktop) && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCloseMobile}
            className="md:hidden fixed inset-0 z-[60]"
            style={{ background: 'var(--pos-overlay)' }}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed md:relative top-0 right-0 bottom-0 z-[70] md:z-0 w-full xs:w-[400px] md:w-[450px] flex flex-col"
          >
            <div className="pos-cart-panel flex-1 md:rounded-[3rem] border-l md:border border-[var(--pos-cart-border)] flex flex-col overflow-hidden bg-[var(--pos-cart-bg)] text-[var(--pos-cart-text)] shadow-2xl shadow-black/25">

              <div className="flex items-center gap-1 px-4 pt-4 pb-0 overflow-x-auto no-scrollbar">
                {sessions.map((session) => {
                  const isActive = session.id === activeId;
                  const sessionItemCount = session.cart.length;
                  return (
                    <motion.button
                      key={session.id}
                      layout
                      type="button"
                      onClick={() => onSwitchCart(session.id)}
                      className={`
                        group relative flex items-center gap-1.5 px-3 py-1.5 rounded-t-xl text-xs font-bold
                        whitespace-nowrap transition-all shrink-0 border border-b-0
                        ${isActive
                          ? 'bg-[var(--pos-cart-accent-soft)] border-[var(--pos-cart-border)] text-[var(--pos-cart-text)]'
                          : 'bg-transparent border-transparent text-[var(--pos-cart-muted)] hover:text-[var(--pos-cart-text)] hover:bg-[var(--pos-cart-card)]'
                        }
                      `}
                    >
                      <ShoppingCart size={11} />
                      <span>{session.label}</span>
                      {sessionItemCount > 0 && (
                        <span
                          className={`
                            min-w-[16px] h-4 px-1 rounded-full text-[9px] font-black flex items-center justify-center
                            ${isActive ? 'bg-[var(--pos-accent)] text-white' : 'bg-[var(--pos-cart-card)] text-[var(--pos-cart-muted)]'}
                          `}
                        >
                          {sessionItemCount}
                        </span>
                      )}
                      {sessions.length > 1 && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveCart(session.id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.stopPropagation();
                              onRemoveCart(session.id);
                            }
                          }}
                          className="ml-0.5 opacity-0 group-hover:opacity-100 w-3.5 h-3.5 flex items-center justify-center rounded-full hover:bg-red-500/30 hover:text-red-400 transition-all text-[var(--pos-cart-muted)]"
                          title="Savatchani o'chirish"
                        >
                          <X size={10} />
                        </span>
                      )}
                    </motion.button>
                  );
                })}
              </div>

              <div className="h-px bg-[var(--pos-cart-border)] mx-4 mt-2" />

              <div className="p-6 md:p-8 border-b border-[var(--pos-cart-border)] flex items-center justify-between bg-[var(--pos-cart-header)]">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-[var(--pos-accent)] flex items-center justify-center shadow-lg">
                    <ShoppingCart size={20} className="md:w-6 md:h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-black text-lg md:text-xl">Savatcha</h3>
                    <p className="text-[10px] md:text-xs font-bold text-[var(--pos-cart-muted)]">
                      {cart.length} xil mahsulot
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onAddCart}
                    className="p-2.5 bg-[var(--pos-cart-accent-soft)] text-[var(--pos-money)] rounded-xl hover:brightness-110 border border-[var(--pos-cart-border)] transition-all active:scale-95"
                    title="Yangi mijoz uchun savatcha ochish"
                  >
                    <Plus size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={onClearCart}
                    className="p-2.5 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 transition-all active:scale-95"
                    title="Joriy savatchani tozalash"
                  >
                    <Trash2 size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={onCloseMobile}
                    className="md:hidden p-2.5 bg-[var(--pos-cart-card)] rounded-xl text-[var(--pos-cart-muted)]"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="px-6 md:px-8 pt-4">
                <PosCustomerStrip
                  value={customer}
                  onChange={onCustomerChange}
                  tone="cart"
                />
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 space-y-3 md:space-y-4">
                <AnimatePresence mode="popLayout">
                  {cart.map((item) => (
                    <motion.div
                      layout
                      key={item.variantId}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="flex items-center gap-3 md:gap-4 p-3 md:p-4 bg-[var(--pos-cart-card)] border border-[var(--pos-cart-border)] rounded-2xl group hover:brightness-110 transition-all"
                    >
                      <div className="w-10 h-10 md:w-12 md:h-12 bg-[var(--pos-cart-bg)] rounded-xl flex items-center justify-center border border-[var(--pos-cart-border)] overflow-hidden">
                        {item.image ? (
                          <img src={item.image} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Package size={18} className="text-[var(--pos-cart-muted)] md:w-5 md:h-5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h5 className="font-bold text-[10px] md:text-xs truncate">
                          {item.name}
                        </h5>
                        <p className="text-[8px] md:text-[10px] text-[var(--pos-cart-muted)] truncate">
                          {item.variantName}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <p className="font-black text-[var(--pos-money)] text-[10px] md:text-xs">
                            {formatMoney(item.price, item.currency)}
                            <span className="text-[var(--pos-cart-muted)] font-bold">
                              {' '}
                              / {formatStockQuantity(1, item.unit).split(' ').pop()}
                            </span>
                          </p>
                          {item.price < item.listPrice - 0.001 && (
                            <span className="text-[9px] text-amber-400 font-bold line-through opacity-60">
                              {formatMoney(item.listPrice, item.currency)}
                            </span>
                          )}
                          {showPriceEdit && (
                            <button
                              type="button"
                              onClick={() => onEditPrice(item)}
                              className="p-1 rounded-lg bg-[var(--pos-cart-bg)] text-[var(--pos-cart-muted)] hover:text-[var(--pos-accent)]"
                              title="Narxni o'zgartirish"
                            >
                              <Pencil size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                      <PosQuantityInput
                        quantity={item.quantity}
                        unit={item.unit}
                        maxStock={item.stockQuantity}
                        tone="cart"
                        onChange={(qty) => onSetQuantity(item.variantId, qty)}
                      />
                      <button
                        type="button"
                        onClick={() => onRemove(item.variantId)}
                        className="p-1.5 text-[var(--pos-cart-muted)] hover:text-red-400 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {cart.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center gap-4 py-16 md:py-20 opacity-50">
                    <ShoppingCart size={48} className="text-[var(--pos-cart-muted)] md:w-[60px] md:h-[60px]" />
                    <p className="text-[var(--pos-cart-muted)] font-bold text-xs md:text-sm">
                      Savatcha bo&apos;sh
                    </p>
                  </div>
                )}
              </div>

              <div className="p-6 md:p-8 bg-[var(--pos-cart-header)] border-t border-[var(--pos-cart-border)] space-y-4 md:space-y-6">
                <div className="space-y-2 md:space-y-3">
                  <div className="flex justify-between text-[var(--pos-cart-muted)] text-xs md:text-sm font-bold">
                    <span>Oraliq summa</span>
                    <span>{formatMoney(totalAmount)}</span>
                  </div>
                  <div className="flex justify-between pt-3 md:pt-4 border-t border-[var(--pos-cart-border)]">
                    <span className="font-black text-base md:text-lg">UMUMIY</span>
                    <span className="font-black text-xl md:text-2xl text-[var(--pos-money)]">
                      {formatMoney(totalAmount)}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={cart.length === 0}
                  onClick={onCheckout}
                  className="w-full py-4 md:py-5 bg-[var(--pos-accent)] hover:brightness-110 disabled:opacity-50 text-white font-black rounded-2xl shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 md:gap-4 group"
                >
                  TO&apos;LOVGA O&apos;TISH
                  <ChevronRight
                    size={20}
                    className="md:w-6 md:h-6 group-hover:translate-x-1 transition-transform"
                  />
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function PosMobileCartBar({
  itemCount,
  totalAmount,
  formatMoney,
  onOpen,
}: {
  itemCount: number;
  totalAmount: number;
  formatMoney: (value: number) => string;
  onOpen: () => void;
}) {
  return (
    <div className="md:hidden fixed bottom-6 left-4 right-4 z-50">
      <button
        type="button"
        onClick={onOpen}
        className="w-full p-4 bg-[var(--pos-cart-bg)] text-[var(--pos-cart-text)] rounded-3xl shadow-2xl shadow-black/30 flex items-center justify-between group active:scale-[0.98] transition-all border border-[var(--pos-cart-border)]"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[var(--pos-cart-card)] flex items-center justify-center relative">
            <ShoppingCart size={24} />
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-[10px] font-black rounded-full flex items-center justify-center border-2 border-[var(--pos-cart-bg)]">
                {itemCount}
              </span>
            )}
          </div>
          <div>
            <p className="text-[10px] font-black text-[var(--pos-cart-muted)] uppercase tracking-widest">
              Savat
            </p>
            <p className="font-black text-lg text-[var(--pos-money)]">{formatMoney(totalAmount)}</p>
          </div>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-[var(--pos-accent)] text-white flex items-center justify-center group-hover:translate-x-1 transition-transform">
          <ChevronRight size={24} />
        </div>
      </button>
    </div>
  );
}
