'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  Minus,
  Package,
  Pencil,
  Plus,
  ShoppingCart,
  Trash2,
  X,
} from 'lucide-react';
import { PosCustomerStrip, type PosCustomerSelection } from './PosCustomerStrip';
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
  onUpdateQuantity: (variantId: string, delta: number) => void;
  onRemove: (variantId: string) => void;
  onCheckout: () => void;
  onEditPrice: (item: PosCartItem) => void;
  showPriceEdit: boolean;
  /* multi-cart */
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
  onUpdateQuantity,
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
            className="md:hidden fixed inset-0 bg-black/80 backdrop-blur-md z-[60]"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed md:relative top-0 right-0 bottom-0 z-[70] md:z-0 w-full xs:w-[400px] md:w-[450px] flex flex-col"
          >
            <div className="flex-1 glass-card md:rounded-[3rem] border-l md:border border-white/5 flex flex-col overflow-hidden bg-[#0a0a0a] md:bg-white/[0.01] shadow-2xl">

              {/* ── Cart Tabs ─────────────────────────────────── */}
              <div className="flex items-center gap-1 px-4 pt-4 pb-0 overflow-x-auto no-scrollbar">
                {sessions.map((session, idx) => {
                  const isActive = session.id === activeId;
                  const sessionItemCount = session.cart.reduce(
                    (a, b) => a + b.quantity,
                    0,
                  );
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
                          ? 'bg-white/10 border-white/10 text-white'
                          : 'bg-transparent border-transparent text-gray-500 hover:text-gray-300 hover:bg-white/5'
                        }
                      `}
                    >
                      <ShoppingCart size={11} />
                      <span>{session.label}</span>
                      {sessionItemCount > 0 && (
                        <span
                          className={`
                            min-w-[16px] h-4 px-1 rounded-full text-[9px] font-black flex items-center justify-center
                            ${isActive ? 'bg-blue-500 text-white' : 'bg-white/10 text-gray-400'}
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
                          className="ml-0.5 opacity-0 group-hover:opacity-100 w-3.5 h-3.5 flex items-center justify-center rounded-full hover:bg-red-500/30 hover:text-red-400 transition-all text-gray-600"
                          title="Savatchani o'chirish"
                        >
                          <X size={10} />
                        </span>
                      )}
                    </motion.button>
                  );
                })}

              </div>

              {/* thin separator line under tabs */}
              <div className="h-px bg-white/10 mx-4 mt-2" />

              {/* ── Header ───────────────────────────────────── */}
              <div className="p-6 md:p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.03]">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                    <ShoppingCart size={20} className="md:w-6 md:h-6" />
                  </div>
                  <div>
                    <h3 className="font-black text-lg md:text-xl">Savatcha</h3>
                    <p className="text-[10px] md:text-xs font-bold text-gray-500">
                      {cart.length} xil mahsulot
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onAddCart}
                    className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl hover:bg-emerald-500/20 border border-emerald-500/20 transition-all active:scale-95"
                    title="Yangi mijoz uchun savatcha ochish"
                  >
                    <Plus size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={onClearCart}
                    className="p-2.5 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition-all active:scale-95"
                    title="Joriy savatchani tozalash"
                  >
                    <Trash2 size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={onCloseMobile}
                    className="md:hidden p-2.5 bg-white/5 rounded-xl text-gray-500"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* ── Customer Strip ───────────────────────────── */}
              <div className="px-6 md:px-8 pt-4">
                <PosCustomerStrip value={customer} onChange={onCustomerChange} />
              </div>

              {/* ── Cart Items ───────────────────────────────── */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 space-y-3 md:space-y-4">
                <AnimatePresence mode="popLayout">
                  {cart.map((item) => (
                    <motion.div
                      layout
                      key={item.variantId}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="flex items-center gap-3 md:gap-4 p-3 md:p-4 bg-white/5 border border-white/5 rounded-2xl group hover:bg-white/[0.08] transition-all"
                    >
                      <div className="w-10 h-10 md:w-12 md:h-12 bg-white/5 rounded-xl flex items-center justify-center border border-white/5 overflow-hidden">
                        {item.image ? (
                          <img src={item.image} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Package size={18} className="text-gray-600 md:w-5 md:h-5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h5 className="font-bold text-[10px] md:text-xs truncate">
                          {item.name}
                        </h5>
                        <p className="text-[8px] md:text-[10px] text-gray-500 truncate">
                          {item.variantName}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="font-black text-emerald-400 text-[10px] md:text-xs">
                            {formatMoney(item.price, item.currency)}
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
                              className="p-1 rounded-lg bg-white/5 text-gray-400 hover:text-blue-400"
                              title="Narxni o'zgartirish"
                            >
                              <Pencil size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 md:gap-3 bg-black/40 p-1 md:p-1.5 rounded-xl border border-white/5">
                        <button
                          type="button"
                          onClick={() => onUpdateQuantity(item.variantId, -1)}
                          className="w-5 h-5 md:w-6 md:h-6 rounded-lg hover:bg-white/10 flex items-center justify-center text-gray-500"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="font-black text-[10px] md:text-xs w-5 md:w-6 text-center">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => onUpdateQuantity(item.variantId, 1)}
                          className="w-5 h-5 md:w-6 md:h-6 rounded-lg hover:bg-white/10 flex items-center justify-center text-gray-500"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRemove(item.variantId)}
                        className="p-1.5 text-gray-600 hover:text-red-500 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {cart.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center gap-4 py-16 md:py-20 opacity-50">
                    <ShoppingCart
                      size={48}
                      className="text-gray-800 md:w-[60px] md:h-[60px]"
                    />
                    <p className="text-gray-500 font-bold text-xs md:text-sm">
                      Savatcha bo&apos;sh
                    </p>
                  </div>
                )}
              </div>

              {/* ── Footer / Checkout ────────────────────────── */}
              <div className="p-6 md:p-8 bg-white/[0.03] border-t border-white/5 space-y-4 md:space-y-6">
                <div className="space-y-2 md:space-y-3">
                  <div className="flex justify-between text-gray-500 text-xs md:text-sm font-bold">
                    <span>Oraliq summa</span>
                    <span>{formatMoney(totalAmount)}</span>
                  </div>
                  <div className="flex justify-between pt-3 md:pt-4 border-t border-white/10">
                    <span className="font-black text-base md:text-lg">UMUMIY</span>
                    <span className="font-black text-xl md:text-2xl text-emerald-400">
                      {formatMoney(totalAmount)}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={cart.length === 0}
                  onClick={onCheckout}
                  className="w-full py-4 md:py-5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black rounded-2xl shadow-xl shadow-blue-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3 md:gap-4 group"
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

/** Mobile floating bar */
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
        className="w-full p-4 bg-blue-600 rounded-3xl shadow-2xl shadow-blue-500/40 flex items-center justify-between group active:scale-[0.98] transition-all"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center relative">
            <ShoppingCart size={24} />
            {itemCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-[10px] font-black rounded-full flex items-center justify-center border-2 border-blue-600">
                {itemCount}
              </span>
            )}
          </div>
          <div>
            <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest">
              Savat
            </p>
            <p className="font-black text-lg">{formatMoney(totalAmount)}</p>
          </div>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center group-hover:translate-x-1 transition-transform">
          <ChevronRight size={24} />
        </div>
      </button>
    </div>
  );
}
