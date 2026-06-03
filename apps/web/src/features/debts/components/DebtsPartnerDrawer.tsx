'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Building2,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileText,
} from 'lucide-react';
import {
  formatMoney,
  formatDualCurrency,
  partnerHasActiveDebt,
} from '../debts-utils';

interface DebtsPartnerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  partnerId: string | null;
  partnerDisplay: any;
  activeTab: 'receivable' | 'payable';
  ledgerEntries: any[];
  ledgerTotals: {
    amount: { uzs: number; usd: number };
    remaining: { uzs: number; usd: number };
  };
  partnerPendingEntries: any[];
  partnerPendingTotal: number;
  bulkPaymentCurrency: 'UZS' | 'USD';
  setBulkPaymentCurrency: (cur: 'UZS' | 'USD') => void;
  bulkPaymentAmount: string;
  setBulkPaymentAmount: (amt: string) => void;
  bulkPaymentNotes: string;
  setBulkPaymentNotes: (notes: string) => void;
  bulkPreview: any;
  bulkRemainingTotal: number;
  isPendingBulkPayment: boolean;
  isPendingConfirmBulk: boolean;
  onBulkPaymentSubmit: () => void;
  onBulkConfirmSubmit: () => void;
  pendingByDebtId: Record<string, any>;
  resolvedPendingDebtIds: Record<string, boolean>;
  setResolvedPendingDebtIds: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  onShowTimeline: (entryId: string) => void;
  onOpenPayment: (entry: any) => void;
  onConfirmPayment: (pendingId: string, entryId: string) => void;
  onRejectPayment: (pendingId: string, entryId: string) => void;
  onDownloadPdf: (partnerId: string, partnerName: string) => void;
  onDownloadExcel: (partnerId: string, partnerName: string) => void;
  detailPartnerGroup: any;
}

export function DebtsPartnerDrawer({
  isOpen,
  onClose,
  partnerId,
  partnerDisplay,
  activeTab,
  ledgerEntries,
  ledgerTotals,
  partnerPendingEntries,
  partnerPendingTotal,
  bulkPaymentCurrency,
  setBulkPaymentCurrency,
  bulkPaymentAmount,
  setBulkPaymentAmount,
  bulkPaymentNotes,
  setBulkPaymentNotes,
  bulkPreview,
  bulkRemainingTotal,
  isPendingBulkPayment,
  isPendingConfirmBulk,
  onBulkPaymentSubmit,
  onBulkConfirmSubmit,
  pendingByDebtId,
  resolvedPendingDebtIds,
  setResolvedPendingDebtIds,
  onShowTimeline,
  onOpenPayment,
  onConfirmPayment,
  onRejectPayment,
  onDownloadPdf,
  onDownloadExcel,
  detailPartnerGroup,
}: DebtsPartnerDrawerProps) {
  if (!isOpen) return null;

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'PAID':
      case 'CONFIRMED':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'PARTIAL':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      default:
        return 'bg-red-500/10 text-red-400 border-red-500/20';
    }
  };

  const debtStatusLabelUz = (status: string) => {
    if (status === 'PAID' || status === 'CONFIRMED') return 'Tasdiqlandi';
    if (status === 'PARTIAL') return 'Qisman';
    return 'Ochiq';
  };

  return (
    <div className="fixed inset-0 z-[115] flex justify-end">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.12, ease: 'easeOut' }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
        className="fixed inset-y-0 right-0 w-full md:max-w-2xl bg-[#0c0c0e]/98 border-l border-white/10 shadow-2xl backdrop-blur-3xl h-full flex flex-col z-[200]"
      >
        {partnerDisplay ? (
          <>
            {/* Drawer Header */}
            <div className="p-6 md:p-8 border-b border-white/5 flex items-start justify-between shrink-0">
              <div>
                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                  <Building2 size={10} />
                  Hamkor qarz tafsilotlari
                </p>
                <h3 className="text-2xl font-black text-white">{partnerDisplay.name}</h3>
                <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mt-1">
                  STIR: {partnerDisplay.tin}
                </p>
                <p className="text-gray-500 text-xs mt-2">
                  {ledgerEntries.length} ta yozuv ({activeTab === 'receivable' ? 'bizga qarz' : 'biz qarzdor'})
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/5 rounded-xl text-gray-500 hover:text-white transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 space-y-6">
              <div className="p-5 bg-white/[0.02] border border-white/5 rounded-3xl grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Jami qarz</p>
                  <p className="font-bold text-white text-sm mt-1">
                    {formatDualCurrency(ledgerTotals.amount)}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Qolgan</p>
                  <p className={`font-black text-sm mt-1 ${activeTab === 'receivable' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatDualCurrency(ledgerTotals.remaining)}
                  </p>
                </div>
              </div>

              {activeTab === 'receivable' && partnerPendingEntries.length > 0 && (
                <div className="p-5 bg-amber-500/5 border border-amber-500/20 rounded-3xl space-y-4">
                  <div>
                    <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest">
                      Kutilayotgan umumiy to‘lov
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Hamkor to‘lov qayd etgan — tasdiqlanganda yozuvlar FIFO bo‘yicha yopiladi.
                    </p>
                  </div>
                  <p className="text-sm font-black text-amber-300">
                    {partnerPendingEntries.length} ta yozuv ·{' '}
                    {formatMoney(partnerPendingTotal, bulkPaymentCurrency)}
                  </p>
                  <button
                    type="button"
                    disabled={isPendingConfirmBulk}
                    onClick={onBulkConfirmSubmit}
                    className="w-full py-3.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-black flex items-center justify-center gap-2"
                  >
                    {isPendingConfirmBulk ? (
                      <Loader2 className="animate-spin" size={18} />
                    ) : (
                      <CheckCircle2 size={18} />
                    )}
                    Umumiy to‘lovni tasdiqlash
                  </button>
                </div>
              )}

              {activeTab === 'payable' && bulkRemainingTotal > 0 && (
                <div className="p-5 bg-red-500/5 border border-red-500/20 rounded-3xl space-y-4">
                  <div>
                    <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">
                      Umumiy to‘lov qayd etdim
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Masalan 2 500 USD berdim — eng eski yozuvlardan FIFO bo‘yicha taqsimlanadi, keyin haqdor tasdiqlaydi.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(['USD', 'UZS'] as const).map((cur) => {
                      const key = cur === 'USD' ? 'usd' : 'uzs';
                      const rem = ledgerTotals.remaining[key] ?? 0;
                      if (rem <= 0) return null;
                      return (
                        <button
                          key={cur}
                          type="button"
                          onClick={() => setBulkPaymentCurrency(cur)}
                          className={`px-3 py-1.5 rounded-xl text-[10px] font-black border ${
                            bulkPaymentCurrency === cur
                              ? 'bg-red-600 text-white border-red-500'
                              : 'bg-white/5 text-gray-400 border-white/10'
                          }`}
                        >
                          {cur} · {formatMoney(rem, cur)}
                        </button>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">
                        To‘langan summa
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={bulkPaymentCurrency === 'USD' ? 0.01 : 1}
                        value={bulkPaymentAmount}
                        onChange={(e) => setBulkPaymentAmount(e.target.value)}
                        placeholder={
                          bulkPaymentCurrency === 'USD' ? '2500.00' : '5000000'
                        }
                        className="mt-1 w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-sm font-black text-red-400 focus:outline-none focus:border-red-500/40"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest">
                        Izoh (ixtiyoriy)
                      </label>
                      <input
                        type="text"
                        value={bulkPaymentNotes}
                        onChange={(e) => setBulkPaymentNotes(e.target.value)}
                        placeholder="Naqd, bank o‘tkazmasi..."
                        className="mt-1 w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-sm font-bold text-white focus:outline-none focus:border-red-500/40"
                      />
                    </div>
                  </div>
                  {bulkPreview && bulkPreview.allocations.length > 0 && (
                    <p className="text-xs text-red-300/90 font-semibold">
                      {bulkPreview.allocations.length} ta yozuvga{' '}
                      {formatMoney(bulkPreview.appliedTotal, bulkPaymentCurrency)}{' '}
                      taqsimlanadi (tasdiqlash kutiladi)
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={
                      isPendingBulkPayment ||
                      !bulkPaymentAmount ||
                      Number(bulkPaymentAmount) <= 0
                    }
                    onClick={onBulkPaymentSubmit}
                    className="w-full py-3.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-black flex items-center justify-center gap-2"
                  >
                    {isPendingBulkPayment ? (
                      <Loader2 className="animate-spin" size={18} />
                    ) : (
                      <CheckCircle2 size={18} />
                    )}
                    To‘lov qayd etdim
                  </button>
                </div>
              )}

              <div className="space-y-3">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Qarz yozuvlari</p>
                {ledgerEntries.length === 0 ? (
                  <p className="text-gray-500 text-sm font-bold py-8 text-center">Yozuvlar yo'q</p>
                ) : (
                  ledgerEntries.map((entry: any) => {
                    const pending = pendingByDebtId[entry.id] && !resolvedPendingDebtIds[entry.id];
                    return (
                      <div
                        key={entry.id}
                        className="p-4 bg-white/[0.03] border border-white/5 rounded-2xl hover:border-white/10 transition-all space-y-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-black text-white">
                              {new Date(entry.createdAt).toLocaleDateString('uz-UZ', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </p>
                            <p className="text-[9px] text-gray-500 font-bold mt-0.5">
                              {entry.receiptId ? `Qabul: ${entry.receiptId.slice(0, 8)}…` : 'Qarz yozuvi'}
                            </p>
                          </div>
                          <span className={`px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${getStatusStyle(entry.status)}`}>
                            {debtStatusLabelUz(entry.status)}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm">
                          <div>
                            <span className="text-[9px] text-gray-500 font-black uppercase">Jami </span>
                            <span className="font-bold text-gray-300">
                              {formatMoney(entry.amount, (entry.currency || 'UZS') as 'UZS' | 'USD')}
                            </span>
                          </div>
                          <div>
                            <span className="text-[9px] text-gray-500 font-black uppercase">Qolgan </span>
                            <span className={`font-black ${activeTab === 'receivable' ? 'text-emerald-400' : 'text-red-400'}`}>
                              {formatMoney(entry.remainingAmount, (entry.currency || 'UZS') as 'UZS' | 'USD')}
                            </span>
                          </div>
                        </div>
                        {pending && (
                          <p className="text-[10px] text-amber-400 font-bold">To'lov tasdiqlanishi kutilmoqda</p>
                        )}
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => onShowTimeline(entry.id)}
                            className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black text-blue-400 hover:bg-blue-500/10 transition-all text-center flex items-center justify-center"
                          >
                            Tarix / to'lovlar
                          </button>
                          {entry.status !== 'PAID' && Number(entry.remainingAmount) > 0 && !pending && (
                            <button
                              type="button"
                              onClick={() => onOpenPayment(entry)}
                              className="w-full py-2.5 rounded-xl bg-blue-600/20 border border-blue-500/30 text-[10px] font-black text-blue-300 hover:bg-blue-600/30 transition-all text-center flex items-center justify-center"
                            >
                              {activeTab === 'receivable'
                                ? "To'lov qabul qilish"
                                : "To'lov qayd etish"}
                            </button>
                          )}
                          {pending && (
                            <>
                              <button
                                type="button"
                                onClick={() => onConfirmPayment(pendingByDebtId[entry.id].id, entry.id)}
                                className="w-full py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black text-emerald-400 text-center flex items-center justify-center"
                              >
                                Tasdiqlash
                              </button>
                              <button
                                type="button"
                                onClick={() => onRejectPayment(pendingByDebtId[entry.id].id, entry.id)}
                                className="w-full py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-[10px] font-black text-red-400 text-center flex items-center justify-center"
                              >
                                Rad etish
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-6 md:p-8 border-t border-white/5 bg-white/[0.01] shrink-0 space-y-3">
              {detailPartnerGroup && partnerHasActiveDebt(detailPartnerGroup) && (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      onDownloadPdf(partnerId!, partnerDisplay?.name || 'hamkor')
                    }
                    className="py-3 bg-emerald-600/10 border border-emerald-500/20 rounded-xl hover:bg-emerald-600/20 text-emerald-400 transition-all font-black text-xs h-12 flex items-center justify-center gap-2"
                  >
                    <FileText size={16} />
                    Akt Sverka PDF
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onDownloadExcel(partnerId!, partnerDisplay?.name || 'hamkor')
                    }
                    className="py-3 bg-blue-600/10 border border-blue-500/20 rounded-xl hover:bg-blue-600/20 text-blue-400 transition-all font-black text-xs h-12 flex items-center justify-center gap-2"
                  >
                    <FileText size={16} />
                    Akt Sverka Excel
                  </button>
                </div>
              )}
              <button
                onClick={onClose}
                className="w-full py-3.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all font-black text-gray-400 hover:text-white text-xs h-12"
              >
                Yopish
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
            <AlertCircle className="text-gray-500" size={40} />
            <p className="text-gray-400 text-sm font-bold text-center">Hamkor ma'lumotlari topilmadi</p>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-gray-300"
            >
              Yopish
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
