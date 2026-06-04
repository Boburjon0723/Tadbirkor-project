'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Palmtree, Check, Ban } from 'lucide-react';
import type { LeaveRequestRow } from '@/services/payroll-leave.service';
import { formatPayrollMonth } from '@/lib/payroll-labels';

const STATUS_STYLE: Record<string, string> = {
  APPROVED: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  PENDING: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  REJECTED: 'bg-red-500/15 text-red-400 border-red-500/25',
  CANCELLED: 'bg-white/10 text-gray-500 border-white/10',
};

const STATUS_LABEL: Record<string, string> = {
  APPROVED: 'Tasdiqlangan',
  PENDING: 'Kutilmoqda',
  REJECTED: 'Rad etilgan',
  CANCELLED: 'Bekor',
};

function formatLeaveDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('uz-UZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

type Props = {
  open: boolean;
  onClose: () => void;
  employeeName: string;
  year: number;
  month: number;
  leaves: LeaveRequestRow[];
  loading?: boolean;
  canManage?: boolean;
  onRecordLeave: (payload: {
    daysCount: number;
    startDate: string;
    reason?: string;
  }) => Promise<void>;
  onApprove?: (id: string) => Promise<void>;
  onReject?: (id: string) => Promise<void>;
  busy?: boolean;
};

export function EmployeeLeaveModal({
  open,
  onClose,
  employeeName,
  year,
  month,
  leaves,
  loading,
  canManage,
  onRecordLeave,
  onApprove,
  onReject,
  busy,
}: Props) {
  const [daysCount, setDaysCount] = useState('1');
  const [startDate, setStartDate] = useState('');
  const [reason, setReason] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDaysCount('1');
    setStartDate(new Date().toISOString().slice(0, 10));
    setReason('');
    setActionId(null);
  }, [open]);

  const handleRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    const days = Number(daysCount);
    if (!days || days < 1 || !startDate) return;
    await onRecordLeave({
      daysCount: days,
      startDate,
      reason: reason.trim() || undefined,
    });
  };

  const approved = leaves.filter((l) => l.status === 'APPROVED');
  const pending = leaves.filter((l) => l.status === 'PENDING');

  return (
    <AnimatePresence initial={false}>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-[100]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed inset-0 z-[101] flex flex-col sm:items-center sm:justify-center sm:p-4 pointer-events-none"
          >
            <div
              className="pointer-events-auto flex flex-col w-full h-[100dvh] max-h-[100dvh] sm:h-auto sm:max-h-[92vh] sm:max-w-lg overflow-hidden bg-[#0a0a0a] sm:glass-card rounded-none sm:rounded-2xl border-0 sm:border sm:border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 sm:p-6 pt-[max(1rem,env(safe-area-inset-top))] border-b border-white/5 shrink-0">
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <h3 className="text-xl font-black flex items-center gap-2">
                      <Palmtree className="text-emerald-400" size={22} />
                      Dam olish kunlari
                    </h3>
                    <p className="text-sm font-bold text-gray-500 mt-1">{employeeName}</p>
                    <p className="text-xs font-bold text-gray-600 mt-0.5">
                      {formatPayrollMonth(year, month)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-2.5 rounded-xl hover:bg-white/5 -mr-1"
                    aria-label="Yopish"
                  >
                    <X size={20} />
                  </button>
                </div>
                <p className="text-xs font-bold text-gray-500 mt-3">
                  Tasdiqlangan: {approved.length} · Kutilmoqda: {pending.length}
                </p>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-4 custom-scrollbar">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">
                    Tarix
                  </p>
                  {loading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="animate-spin text-emerald-400" size={24} />
                    </div>
                  ) : leaves.length === 0 ? (
                    <p className="text-sm font-bold text-gray-500 py-4 text-center">
                      Bu oyda dam olish yozuvi yo‘q
                    </p>
                  ) : (
                    <ul className="space-y-2 sm:max-h-[220px] sm:overflow-y-auto">
                      {leaves.map((l) => (
                        <li
                          key={l.id}
                          className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2"
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <p className="text-sm font-black text-white">
                                {formatLeaveDate(l.startDate)} — {formatLeaveDate(l.endDate)}
                              </p>
                              <p className="text-xs font-bold text-gray-500 mt-0.5">
                                {l.daysCount} kun
                                {l.reason ? ` · ${l.reason}` : ''}
                              </p>
                            </div>
                            <span
                              className={`shrink-0 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase border ${
                                STATUS_STYLE[l.status] || STATUS_STYLE.CANCELLED
                              }`}
                            >
                              {STATUS_LABEL[l.status] || l.status}
                            </span>
                          </div>
                          {canManage && l.status === 'PENDING' && onApprove && onReject && (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={busy || actionId === l.id}
                                onClick={async () => {
                                  setActionId(l.id);
                                  try {
                                    await onApprove(l.id);
                                  } finally {
                                    setActionId(null);
                                  }
                                }}
                                className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-emerald-600/80 text-xs font-black"
                              >
                                <Check size={12} />
                                Tasdiqlash
                              </button>
                              <button
                                type="button"
                                disabled={busy || actionId === l.id}
                                onClick={async () => {
                                  setActionId(l.id);
                                  try {
                                    await onReject(l.id);
                                  } finally {
                                    setActionId(null);
                                  }
                                }}
                                className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-white/10 text-xs font-black"
                              >
                                <Ban size={12} />
                                Rad
                              </button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {canManage && (
                  <form
                    onSubmit={handleRecord}
                    className="space-y-3 pt-2 border-t border-white/5"
                  >
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400/90">
                      Dam olish qo‘shish (darhol tasdiqlanadi)
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block space-y-1">
                        <span className="text-[10px] font-black uppercase text-gray-500">
                          Kunlar soni
                        </span>
                        <input
                          type="number"
                          min={1}
                          max={60}
                          value={daysCount}
                          onChange={(e) => setDaysCount(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 font-bold"
                          required
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-[10px] font-black uppercase text-gray-500">
                          Boshlanish
                        </span>
                        <input
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 font-bold"
                          required
                        />
                      </label>
                    </div>
                    <label className="block space-y-1">
                      <span className="text-[10px] font-black uppercase text-gray-500">
                        Sabab / izoh
                      </span>
                      <input
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Masalan: Kasallik, ta’til"
                        className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 font-bold"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={busy}
                      className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-black disabled:opacity-50 flex justify-center gap-2"
                    >
                      {busy && <Loader2 className="animate-spin" size={16} />}
                      Dam olishni saqlash
                    </button>
                  </form>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
