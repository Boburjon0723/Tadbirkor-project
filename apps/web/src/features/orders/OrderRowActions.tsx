'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2,
  XCircle,
  Truck,
  Pencil,
  X,
  FileText,
  FileSpreadsheet,
  ChevronRight,
  Settings2,
  type LucideIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { orderCanDispatchMore } from './orders-utils';

type ActionItem = {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  className: string;
};

type Props = {
  activeTab: 'my' | 'incoming';
  order: any;
  variant: 'table' | 'mobile';
  onOpenDetails?: () => void;
  onReject: () => void;
  onAccept: () => void;
  onDispatch: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onPrintInvoice: () => void;
  onExportPdf: () => void;
  onExportExcel: () => void;
};

export function OrderRowActions({
  activeTab,
  order,
  variant,
  onOpenDetails,
  onReject,
  onAccept,
  onDispatch,
  onEdit,
  onCancel,
  onDelete,
  onPrintInvoice,
  onExportPdf,
  onExportExcel,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const isTable = variant === 'table';

  const btn = isTable
    ? 'p-2.5 rounded-xl transition-all h-10 w-10 flex items-center justify-center shrink-0'
    : 'p-3 rounded-2xl border active:scale-90 transition-all shrink-0';

  const actions: ActionItem[] = [];

  if (activeTab === 'incoming' && (order.status === 'DRAFT' || order.status === 'SENT')) {
    actions.push({
      label: 'Qabul qilish',
      icon: CheckCircle2,
      onClick: onAccept,
      className: 'text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300',
    });
    actions.push({
      label: 'Rad etish',
      icon: XCircle,
      onClick: onReject,
      className: 'text-red-400 hover:bg-red-500/10 hover:text-red-300',
    });
  }

  if (activeTab === 'incoming' && orderCanDispatchMore(order)) {
    actions.push({
      label: order.isPartialDispatch || order.status === 'PARTIALLY_DISPATCHED'
        ? "Qolganini jo'natish"
        : "Jo'natma yaratish",
      icon: Truck,
      onClick: onDispatch,
      className: 'text-amber-400 hover:bg-amber-500/10 hover:text-amber-300',
    });
  }

  if (activeTab === 'my' && order.status === 'DRAFT') {
    actions.push({
      label: 'Tahrirlash',
      icon: Pencil,
      onClick: onEdit,
      className: 'text-amber-400 hover:bg-amber-500/10 hover:text-amber-300',
    });
  }

  if (
    activeTab === 'my' &&
    !['DISPATCHED', 'RECEIVED', 'COMPLETED', 'CANCELLED'].includes(order.status)
  ) {
    actions.push({
      label: 'Bekor qilish',
      icon: XCircle,
      onClick: onCancel,
      className: 'text-red-400 hover:bg-red-500/10 hover:text-red-300',
    });
  }

  if (activeTab === 'my' && ['DRAFT', 'CANCELLED', 'REJECTED'].includes(order.status)) {
    actions.push({
      label: "O'chirish",
      icon: X,
      onClick: onDelete,
      className: 'text-red-400 hover:bg-red-500/10 hover:text-red-300',
    });
  }

  actions.push({
    label: 'PDF yuklash',
    icon: FileText,
    onClick: onExportPdf,
    className: 'text-blue-400 hover:bg-blue-500/10 hover:text-blue-300',
  });
  actions.push({
    label: 'Invoice chop etish',
    icon: FileText,
    onClick: onPrintInvoice,
    className: 'text-indigo-400 hover:bg-indigo-500/10 hover:text-indigo-300',
  });
  actions.push({
    label: 'Excel ga eksport',
    icon: FileSpreadsheet,
    onClick: onExportExcel,
    className: 'text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300',
  });

  const shouldCollapse = actions.length >= 3;

  const updateMenuPosition = useCallback(() => {
    const el = menuBtnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const menuWidth = 208;
    let left = r.right - menuWidth;
    if (left < 8) left = 8;
    if (left + menuWidth > window.innerWidth - 8) {
      left = window.innerWidth - menuWidth - 8;
    }
    setMenuPos({ top: r.bottom + 8, left });
  }, []);

  useEffect(() => {
    if (!isOpen || !shouldCollapse) return;
    updateMenuPosition();
    const onScroll = () => updateMenuPosition();
    window.addEventListener('resize', onScroll);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [isOpen, shouldCollapse, updateMenuPosition]);

  const menuPortal =
    typeof document !== 'undefined' &&
    isOpen &&
    shouldCollapse &&
    createPortal(
      <>
        <div
          className="fixed inset-0 z-[200]"
          aria-hidden
          onClick={() => setIsOpen(false)}
        />
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -6 }}
            transition={{ duration: 0.15 }}
            style={{ top: menuPos.top, left: menuPos.left }}
            className="fixed z-[210] w-52 bg-[#0c0c0e]/95 border border-white/10 rounded-2xl p-1.5 shadow-2xl backdrop-blur-2xl flex flex-col gap-0.5"
          >
            {actions.map((act) => (
              <button
                key={act.label}
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  act.onClick();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-xs font-bold transition-all ${act.className}`}
              >
                <act.icon size={15} className="shrink-0" />
                <span>{act.label}</span>
              </button>
            ))}
          </motion.div>
        </AnimatePresence>
      </>,
      document.body,
    );

  return (
    <div className="inline-flex items-center justify-end gap-2">
      {shouldCollapse ? (
        <button
          ref={menuBtnRef}
          type="button"
          onClick={() => {
            if (!isOpen) updateMenuPosition();
            setIsOpen((v) => !v);
          }}
          className={`${btn} bg-white/5 border border-white/5 text-gray-400 hover:text-white hover:bg-white/10 ${isOpen ? 'bg-white/10 text-white' : ''}`}
          title="Amallar"
        >
          <Settings2 size={16} />
        </button>
      ) : (
        <div className="inline-flex items-center gap-2">
          {actions.map((act) => (
            <button
              key={act.label}
              type="button"
              onClick={act.onClick}
              className={`${btn} ${act.className} border border-white/5 bg-white/5`}
              title={act.label}
            >
              <act.icon size={16} />
            </button>
          ))}
        </div>
      )}

      {menuPortal}

      {isTable ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetails?.();
          }}
          className={`${btn} bg-white/5 border border-white/5 hover:bg-white/10 transition-all text-gray-500 hover:text-white`}
          title="Batafsil"
        >
          <ChevronRight size={16} />
        </button>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetails?.();
          }}
          className={`${btn} bg-blue-600 border border-blue-500/30 text-white shadow-md hover:bg-blue-500`}
          title="Batafsil"
        >
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
}
