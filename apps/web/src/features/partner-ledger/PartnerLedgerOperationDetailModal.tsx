'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, FileSpreadsheet, Package } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { LedgerOperation } from '@/services/partner-ledger.service';
import { partnerLedgerService } from '@/services/partner-ledger.service';
import { formatLedgerAmount } from './partner-ledger-utils';
import { toast, formatApiError } from '@/lib/toast';

type Props = {
  open: boolean;
  operation: LedgerOperation | null;
  contactName: string;
  onClose: () => void;
};

export function PartnerLedgerOperationDetailModal({
  open,
  operation,
  contactName,
  onClose,
}: Props) {
  const [exportBusy, setExportBusy] = useState(false);
  const operationId = operation?.id ?? '';
  const modalTransition = { duration: 0.12, ease: 'easeOut' as const };

  const { data, isPending, isError } = useQuery({
    queryKey: ['partner-ledger', 'operation-lines', operationId],
    queryFn: () => partnerLedgerService.getOperationLines(operationId),
    enabled: open && Boolean(operationId),
  });

  const handleExport = async () => {
    if (!operationId) return;
    setExportBusy(true);
    try {
      await partnerLedgerService.exportOperationExcel(operationId, contactName);
      toast.success('Excel yuklandi');
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setExportBusy(false);
    }
  };

  const lineCount = data?.lines?.length ?? 0;
  const isInbound = operation?.type === 'MATERIAL_IN';
  const priceLabel = isInbound ? 'Kirim narxi' : 'Sotuv narxi';
  const linesTitle = isInbound ? 'Kirim qilingan mahsulotlar' : 'Sotilgan mahsulotlar';

  return (
    <AnimatePresence initial={false}>
      {open && operation && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/75 z-[200]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={modalTransition}
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            transition={modalTransition}
            className="fixed inset-x-3 top-[6vh] bottom-[6vh] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-3xl z-[210] glass-card rounded-3xl border border-white/10 shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-white/10 shrink-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-black text-white">{operation.typeLabel}</h2>
                  {operation.fromStock ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-500/15 text-emerald-300">
                      <Package size={10} /> ombor
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {contactName} · {new Date(operation.operationDate).toLocaleDateString('uz-UZ')}
                </p>
                <p className="text-xl font-black text-blue-400 mt-2">
                  {formatLedgerAmount(operation.balanceDelta, operation.currency)}
                </p>
                {operation.notes ? (
                  <p className="text-xs text-gray-400 mt-2 leading-relaxed">{operation.notes}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-white/10 text-gray-400 shrink-0"
              >
                <X size={22} />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
              {isPending ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="animate-spin text-gray-500" size={28} />
                </div>
              ) : isError ? (
                <p className="text-center text-gray-500 text-sm py-12">Ma&apos;lumot yuklanmadi</p>
              ) : !data?.lines?.length ? (
                <div className="py-8 text-center space-y-3">
                  {data?.summaryOnly ? (
                    <p className="text-sm text-gray-400 leading-relaxed max-w-lg mx-auto">
                      {data.summaryOnly}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-500">Mahsulot qatorlari topilmadi</p>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-white/10">
                  <p className="text-[10px] font-black uppercase text-gray-500 px-3 pt-3 pb-2">
                    {linesTitle}
                  </p>
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-[#0f1117] z-10">
                      <tr className="text-left text-[10px] uppercase text-gray-500 border-b border-white/10">
                        <th className="p-3 w-10">#</th>
                        <th className="p-3">Mahsulot</th>
                        <th className="p-3">SKU</th>
                        <th className="p-3">Miqdor</th>
                        <th className="p-3">{priceLabel}</th>
                        <th className="p-3">Jami</th>
                        <th className="p-3">Ombor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.lines.map((line, i) => (
                        <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                          <td className="p-3 text-gray-500 font-bold">{i + 1}</td>
                          <td className="p-3 font-bold min-w-[140px]">
                            {line.productName}
                            {line.variantName !== line.productName ? (
                              <span className="block text-xs text-gray-500 font-normal mt-0.5">
                                {line.variantName}
                              </span>
                            ) : null}
                          </td>
                          <td className="p-3 font-mono text-xs text-gray-400">{line.sku || '—'}</td>
                          <td className="p-3 whitespace-nowrap">
                            {line.quantity} {line.unit}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            {formatLedgerAmount(line.salePrice, line.currency).replace(/^\+/, '')}
                          </td>
                          <td className="p-3 font-black text-blue-400 whitespace-nowrap">
                            {formatLedgerAmount(line.lineTotal, line.currency).replace(/^\+/, '')}
                          </td>
                          <td className="p-3 text-gray-500 text-xs">{line.warehouseName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-white/10 shrink-0 bg-black/20">
              <p className="text-xs text-gray-500 font-bold">
                {lineCount > 0 ? `${lineCount} ta mahsulot` : operation.productSummary ? "Qisqa ro'yxat" : '—'}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleExport()}
                  disabled={exportBusy}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600/20 border border-blue-500/30 text-sm font-bold text-blue-200 hover:bg-blue-600/30 disabled:opacity-50"
                >
                  {exportBusy ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <FileSpreadsheet size={16} />
                  )}
                  Excel
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-bold hover:bg-white/10"
                >
                  Yopish
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function operationHasDetail(op: LedgerOperation) {
  return (
    op.hasLineDetail ||
    Boolean(op.productSummary && (op.type === 'SALE_OUT' || op.type === 'MATERIAL_IN'))
  );
}
