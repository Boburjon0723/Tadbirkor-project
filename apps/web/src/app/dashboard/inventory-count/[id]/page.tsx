'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, CheckCircle2, ScanLine } from 'lucide-react';
import {
  useInventoryCount,
  useInventoryCountActions,
} from '@/hooks/warehouse/use-inventory-count';
import { usePermissions } from '@/hooks/use-permissions';
import { toast, formatApiError } from '@/lib/toast';
import { confirmAction } from '@/components/ConfirmDialog';

export default function InventoryCountDetailPage() {
  const params = useParams();
  const id = String(params.id || '');
  const queryClient = useQueryClient();
  const { data: count, isLoading, refetch } = useInventoryCount(id);
  const { recordCount, scan, approveItem, complete, cancel } = useInventoryCountActions();
  const { can } = usePermissions();
  const canAdjust = can('warehouse.adjust');
  const canManageCount = can('warehouse.manage');

  // Butun hujjatni qayta yuklamasdan, faqat bitta qatorni cache'da yangilash (skaner tezligi)
  const patchItem = (updated: any) => {
    if (!updated?.id) return;
    queryClient.setQueryData(['inventory-count', id], (old: any) => {
      if (!old) return old;
      const items = (old.items || []).map((it: any) =>
        it.id === updated.id ? { ...it, ...updated } : it,
      );
      const status = updated.needsApproval ? 'PENDING_APPROVAL' : old.status;
      return { ...old, items, status };
    });
  };
  const [qtyByItem, setQtyByItem] = useState<Record<string, string>>({});
  const [scanBarcode, setScanBarcode] = useState('');
  const [scanQty, setScanQty] = useState('1');

  const isActive = count && ['IN_PROGRESS', 'PENDING_APPROVAL'].includes(count.status);

  const handleRecord = async (itemId: string) => {
    const val = Number(qtyByItem[itemId]);
    if (!Number.isFinite(val) || val < 0) {
      toast.error('Miqdor kiriting');
      return;
    }
    try {
      const res = await recordCount.mutateAsync({ itemId, countedQuantity: val });
      patchItem(res);
      toast.success('Saqlandi');
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanBarcode.trim()) return;
    try {
      const res = await scan.mutateAsync({
        countId: id,
        barcode: scanBarcode.trim(),
        countedQuantity: Number(scanQty) || 1,
      });
      setScanBarcode('');
      patchItem(res);
      toast.success('Skaner saqlandi');
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const handleApprove = async (itemId: string) => {
    try {
      const res = await approveItem.mutateAsync(itemId);
      patchItem(res);
      toast.success('Farq tasdiqlandi');
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const handleComplete = async () => {
    try {
      const res = await complete.mutateAsync(id);
      if (res?.id) queryClient.setQueryData(['inventory-count', id], res);
      else await refetch();
      toast.success('Inventarizatsiya yakunlandi');
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const handleCancel = async () => {
    if (
      !(await confirmAction(
        'Inventarizatsiyani bekor qilishni tasdiqlaysizmi? Ombor bloklari olib tashlanadi.',
        { variant: 'danger', confirmLabel: 'Bekor qilish' },
      ))
    ) {
      return;
    }
    try {
      await cancel.mutateAsync(id);
      toast.success('Bekor qilindi');
      await refetch();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  if (isLoading || !count) {
    return (
      <div className="flex justify-center py-32">
        <Loader2 className="animate-spin text-teal-500" size={40} />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 max-w-3xl mx-auto">
      <Link href="/dashboard/inventory-count" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white">
        <ArrowLeft size={16} />
        Ro&apos;yxat
      </Link>

      <div className="glass-card rounded-3xl p-6 border border-white/10">
        <h1 className="text-2xl font-black text-white">{count.reference}</h1>
        <p className="text-gray-500 text-sm mt-1">
          {count.warehouse?.name} · {count.status}
        </p>
        {isActive && (canManageCount || canAdjust) && (
          <div className="flex flex-wrap items-center gap-3 mt-4">
            {canManageCount && (
              <button
                type="button"
                onClick={handleComplete}
                disabled={complete.isPending}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-sm"
              >
                Yakunlash
              </button>
            )}
            {canAdjust && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={cancel.isPending}
                className="px-4 py-2 rounded-xl bg-white/10 text-gray-300 font-bold text-sm hover:bg-white/15"
              >
                Bekor qilish
              </button>
            )}
            {canAdjust && !canManageCount && (
              <p className="text-xs text-gray-500 w-full">
                Yakunlash va farq tasdiqi menejer yoki egasi tomonidan amalga oshiriladi.
              </p>
            )}
          </div>
        )}
      </div>

      {isActive && canAdjust && (
        <form
          onSubmit={handleScan}
          className="glass-card rounded-2xl p-4 border border-teal-500/20 flex flex-col sm:flex-row gap-3"
        >
          <input
            autoFocus
            value={scanBarcode}
            onChange={(e) => setScanBarcode(e.target.value)}
            placeholder="Barcode / SKU skaner..."
            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white"
          />
          <input
            type="number"
            min={0}
            value={scanQty}
            onChange={(e) => setScanQty(e.target.value)}
            className="w-24 bg-black/40 border border-white/10 rounded-xl px-3 py-3 text-white text-center"
          />
          <button
            type="submit"
            disabled={scan.isPending}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-teal-600 text-white font-black"
          >
            {scan.isPending ? <Loader2 className="animate-spin" size={18} /> : <ScanLine size={18} />}
            Skaner
          </button>
        </form>
      )}

      <div className="space-y-3">
        {count.items?.map((item: any) => {
          const name =
            item.productVariant?.product?.name
              ? `${item.productVariant.product.name} — ${item.productVariant.name}`
              : item.productVariant?.name;
          return (
            <div key={item.id} className="glass-card rounded-2xl p-4 border border-white/5">
              <p className="font-bold text-white">{name}</p>
              <p className="text-sm text-gray-500 mt-1">
                Tizim: {Number(item.systemQuantity)} · Holat: {item.status}
                {item.countedQuantity != null && (
                  <> · Sanalgan: {Number(item.countedQuantity)}</>
                )}
                {item.variance != null && (
                  <span className={Number(item.variance) !== 0 ? ' text-amber-400' : ''}>
                    {' '}
                    · Farq: {Number(item.variance)}
                  </span>
                )}
              </p>

              {isActive && canAdjust && item.status === 'PENDING' && (
                <div className="flex gap-2 mt-3">
                  <input
                    type="number"
                    min={0}
                    placeholder="Sanalgan"
                    value={qtyByItem[item.id] ?? ''}
                    onChange={(e) =>
                      setQtyByItem((prev) => ({ ...prev, [item.id]: e.target.value }))
                    }
                    className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white"
                  />
                  <button
                    type="button"
                    onClick={() => handleRecord(item.id)}
                    className="px-4 py-2 rounded-xl bg-teal-600 text-white font-bold text-sm"
                  >
                    Saqlash
                  </button>
                </div>
              )}

              {item.status === 'COUNTED' && canManageCount && (
                <button
                  type="button"
                  onClick={() => handleApprove(item.id)}
                  className="mt-3 flex items-center gap-2 text-sm text-amber-400 font-bold"
                >
                  <CheckCircle2 size={16} />
                  Farqni tasdiqlash (manager)
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
