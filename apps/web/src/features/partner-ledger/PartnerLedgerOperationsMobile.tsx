'use client';

import React from 'react';
import { List, Loader2, Package, Pencil, Send, Trash2 } from 'lucide-react';
import type { LedgerOperation } from '@/services/partner-ledger.service';
import { formatLedgerAmount } from './partner-ledger-utils';
import { MOBILE_LIST_ITEM, MOBILE_LIST_SURFACE } from '@/lib/mobile-pwa';
import { operationHasDetail } from './PartnerLedgerOperationDetailModal';

type Props = {
  operations: LedgerOperation[];
  isLoading: boolean;
  canManage: boolean;
  sendingBatchId: string | null;
  sendPending: boolean;
  onOpenDetail: (op: LedgerOperation) => void;
  onEdit: (op: LedgerOperation) => void;
  onDelete: (op: LedgerOperation) => void;
  onSendSaleOrder: (op: LedgerOperation) => void;
};

export function PartnerLedgerOperationsMobile({
  operations,
  isLoading,
  canManage,
  sendingBatchId,
  sendPending,
  onOpenDetail,
  onEdit,
  onDelete,
  onSendSaleOrder,
}: Props) {
  if (isLoading) {
    return (
      <div className={`${MOBILE_LIST_SURFACE} py-12 flex justify-center`}>
        <Loader2 className="animate-spin text-gray-500" size={28} />
      </div>
    );
  }

  if (operations.length === 0) {
    return (
      <p className="text-gray-500 text-sm font-bold py-8 text-center">Operatsiyalar yo‘q</p>
    );
  }

  return (
    <div className={`${MOBILE_LIST_SURFACE} -mx-6`}>
      {operations.map((op) => {
        const canViewDetail = operationHasDetail(op);
        return (
          <div
            key={op.id}
            className={`${MOBILE_LIST_ITEM} ${canViewDetail ? 'cursor-pointer' : ''}`}
            onClick={() => canViewDetail && onOpenDetail(op)}
            onKeyDown={(e) => {
              if (canViewDetail && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onOpenDetail(op);
              }
            }}
            role={canViewDetail ? 'button' : undefined}
            tabIndex={canViewDetail ? 0 : undefined}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] text-gray-500 font-bold">
                  {new Date(op.operationDate).toLocaleDateString('uz-UZ')}
                </p>
                <p className="font-bold text-blue-400 text-sm mt-0.5">{op.typeLabel}</p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {op.fromStock ? (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-500/15 text-emerald-300">
                      <Package size={9} /> ombor
                    </span>
                  ) : null}
                  {op.isSaleOrder && op.saleOrderStatus ? (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-blue-500/15 text-blue-300">
                      {op.saleOrderStatus}
                    </span>
                  ) : null}
                </div>
              </div>
              <p className="font-black text-white text-sm shrink-0">
                {formatLedgerAmount(op.balanceDelta, op.currency)}
              </p>
            </div>

            {(op.productSummary || op.saleOrderComment || op.notes) && (
              <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                {op.productSummary || op.saleOrderComment || op.notes}
              </p>
            )}

            {(canManage || canViewDetail) && (
              <div
                className="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-white/5"
                onClick={(e) => e.stopPropagation()}
              >
                {canViewDetail && (
                  <button
                    type="button"
                    onClick={() => onOpenDetail(op)}
                    className="p-2 rounded-lg hover:bg-white/10 text-gray-400"
                    title="Batafsil"
                  >
                    <List size={16} />
                  </button>
                )}
                {canManage && op.isSaleOrder && op.sourceId ? (
                  <button
                    type="button"
                    onClick={() => onSendSaleOrder(op)}
                    disabled={sendPending && sendingBatchId === op.sourceId}
                    className="p-2 rounded-lg hover:bg-blue-500/10 text-blue-300 disabled:opacity-50"
                    title="Buyurtmani jo'natish"
                  >
                    {sendPending && sendingBatchId === op.sourceId ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Send size={16} />
                    )}
                  </button>
                ) : null}
                {canManage && !op.fromStock ? (
                  <>
                    <button
                      type="button"
                      onClick={() => onEdit(op)}
                      className="p-2 rounded-lg hover:bg-white/10 text-gray-400"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(op)}
                      className="p-2 rounded-lg hover:bg-red-500/10 text-red-400"
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                ) : null}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
