'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Loader2, ArrowRightLeft, X, Calendar, Layers, FileText } from 'lucide-react';
import { formatMoney } from '../debts-utils';

interface DebtsTimelineDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  debtDetail: any;
  returnPartnerId: string | null;
  onReturnToPartner: (partnerId: string) => void;
  onDownloadPdf: (partnerId: string, partnerName: string) => void;
}

export function DebtsTimelineDrawer({
  isOpen,
  onClose,
  isLoading,
  debtDetail,
  returnPartnerId,
  onReturnToPartner,
  onDownloadPdf,
}: DebtsTimelineDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex justify-end">
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
        className="relative w-full max-w-lg md:max-w-xl bg-[#0c0c0e]/95 border-l border-white/10 shadow-2xl backdrop-blur-3xl h-full flex flex-col justify-between z-[200]"
      >
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-6">
            <Loader2 className="animate-spin text-emerald-500" size={50} />
            <p className="text-gray-400 font-black uppercase tracking-[0.2em] text-xs">Yuklanmoqda...</p>
          </div>
        ) : debtDetail ? (
          <>
            {/* Drawer Header */}
            <div className="p-6 md:p-8 border-b border-white/5 flex items-start justify-between">
              <div>
                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                  <ArrowRightLeft size={10} />
                  Oldi-Berdi Tarixi
                </p>
                <h3 className="text-2xl font-black text-white">
                  {debtDetail.debtorId === debtDetail.debtor?.id
                    ? debtDetail.creditor?.name
                    : debtDetail.debtor?.name}
                </h3>
                <p className="text-gray-500 text-xs mt-1">
                  Barcha qayd etilgan qarz va to'lovlar monitoringi
                </p>
              </div>
              <div className="flex items-center gap-2">
                {returnPartnerId && (
                  <button
                    onClick={() => onReturnToPartner(returnPartnerId)}
                    className="text-[10px] font-bold text-gray-500 hover:text-white px-2 py-1 rounded-lg hover:bg-white/5"
                  >
                    ← Hamkorga
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/5 rounded-xl text-gray-500 hover:text-white transition-all"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 space-y-8">
              {/* Visual Progress Ring / Bar */}
              <div className="p-6 bg-white/[0.01] border border-white/5 rounded-3xl space-y-4 shadow-inner">
                <div className="flex justify-between text-xs font-bold text-gray-400">
                  <span>Qarz to'langanligi darajasi</span>
                  <span className="text-emerald-400">
                    {Math.round(
                      ((Number(debtDetail.amount) - Number(debtDetail.remainingAmount)) /
                        Number(debtDetail.amount)) *
                        100,
                    )}
                    %
                  </span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-2.5 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${Math.round(
                        ((Number(debtDetail.amount) - Number(debtDetail.remainingAmount)) /
                          Number(debtDetail.amount)) *
                          100,
                      )}%`,
                    }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
                  <div>
                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">
                      Boshlang'ich qarz
                    </p>
                    <p className="font-bold text-white text-sm mt-0.5">
                      {formatMoney(Number(debtDetail.amount), debtDetail.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">
                      Qolgan summa
                    </p>
                    <p className="font-black text-emerald-400 text-sm mt-0.5">
                      {formatMoney(Number(debtDetail.remainingAmount), debtDetail.currency)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Timeline Feed */}
              <div className="space-y-6">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Jarayonlar xronologiyasi
                </p>

                <div className="relative border-l border-white/5 ml-3 pl-6 space-y-6">
                  {/* Payments Logs */}
                  {debtDetail.payments?.map((payment: any) => (
                    <div key={payment.id} className="relative group">
                      {/* Bullet */}
                      <span className="absolute -left-[30px] top-1 w-3.5 h-3.5 rounded-full border-2 border-[#0c0c0e] bg-blue-500 shadow-md group-hover:scale-110 transition-transform" />

                      <div className="p-4 bg-white/5 border border-white/5 rounded-2xl hover:border-white/10 transition-all space-y-2.5">
                        <div className="flex justify-between items-start gap-4">
                          <div>
                            <p className="text-xs font-black text-white">To'lov qayd etildi</p>
                            <p className="text-[9px] text-gray-500 font-bold flex items-center gap-1 mt-0.5">
                              <Calendar size={10} />
                              {new Date(payment.createdAt).toLocaleDateString('uz-UZ', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${
                              payment.status === 'CONFIRMED'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : payment.status === 'PENDING'
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                  : 'bg-red-500/10 text-red-400 border-red-500/20'
                            }`}
                          >
                            {payment.status === 'CONFIRMED'
                              ? 'Tasdiqlandi'
                              : payment.status === 'PENDING'
                                ? 'Kutilmoqda'
                                : 'Rad etildi'}
                          </span>
                        </div>
                        <p className="font-black text-emerald-400 text-sm">
                          {formatMoney(Number(payment.amount), debtDetail.currency)}
                        </p>
                        {payment.notes && (
                          <p className="text-xs text-gray-400 bg-white/[0.02] border border-white/5 rounded-lg p-2.5 italic">
                            {payment.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Base creation point */}
                  <div className="relative group">
                    {/* Base Bullet */}
                    <span className="absolute -left-[30px] top-1 w-3.5 h-3.5 rounded-full border-2 border-[#0c0c0e] bg-emerald-500 shadow-md" />

                    <div className="p-4 bg-white/5 border border-white/5 rounded-2xl space-y-2.5">
                      <div>
                        <p className="text-xs font-black text-white">Qarzdorlik vujudga keldi</p>
                        <p className="text-[9px] text-gray-500 font-bold flex items-center gap-1 mt-0.5">
                          <Calendar size={10} />
                          {new Date(debtDetail.createdAt).toLocaleDateString('uz-UZ', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <p className="font-black text-red-400 text-sm">
                        +{formatMoney(Number(debtDetail.amount), debtDetail.currency)}
                      </p>
                      <p className="text-xs text-gray-400 flex items-center gap-2">
                        <Layers size={13} className="text-gray-500 shrink-0" />
                        <span>Qabul hujjati / B2B buyurtma rasmiylashtirildi</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-6 md:p-8 border-t border-white/5 flex gap-4 bg-white/[0.01]">
              {Number(debtDetail.remainingAmount || 0) > 0.009 && debtDetail.partnerCompanyId && (
                <button
                  onClick={() => {
                    onDownloadPdf(
                      debtDetail.partnerCompanyId,
                      debtDetail.partner?.name || 'hamkor',
                    );
                  }}
                  className="flex-1 py-3 bg-white/5 border border-white/10 rounded-xl hover:bg-emerald-500/20 text-gray-400 hover:text-emerald-400 transition-all font-black text-xs h-12 active:scale-95 flex items-center justify-center gap-2"
                >
                  <FileText size={16} />
                  Akt Sverka yuklash
                </button>
              )}
              <button
                onClick={onClose}
                className="px-6 py-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all font-bold text-gray-400 hover:text-white text-xs h-12 active:scale-95"
              >
                Yopish
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
            <X size={40} className="text-gray-500" />
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
