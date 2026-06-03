'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ClipboardList, Loader2, Plus, ChevronRight } from 'lucide-react';
import { useInventoryCounts, useInventoryCountActions } from '@/hooks/warehouse/use-inventory-count';
import { useWarehouses } from '@/hooks/warehouse/use-warehouse';
import { toast, formatApiError } from '@/lib/toast';

const STATUS_LABEL: Record<string, string> = {
  IN_PROGRESS: 'Jarayonda',
  PENDING_APPROVAL: 'Tasdiqlash kutilmoqda',
  COMPLETED: 'Tugallangan',
  CANCELLED: 'Bekor',
  DRAFT: 'Qoralama',
};

export default function InventoryCountListPage() {
  const router = useRouter();
  const [warehouseId, setWarehouseId] = useState('');
  const { data: counts = [], isLoading } = useInventoryCounts();
  const { data: warehouses = [] } = useWarehouses();
  const { start } = useInventoryCountActions();

  const handleStart = async () => {
    if (!warehouseId) {
      toast.error('Omborni tanlang');
      return;
    }
    try {
      const doc: any = await start.mutateAsync({ warehouseId });
      toast.success(`Inventarizatsiya boshlandi: ${doc?.reference || ''}`);
      if (doc?.id) router.push(`/dashboard/inventory-count/${doc.id}`);
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/5">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            Jismoniy <span className="text-teal-400">inventarizatsiya</span>
          </h1>
          <p className="text-gray-400 text-sm mt-1">Sanash, farqni aniqlash va ombor blokirovkasi.</p>
        </div>
      </div>

      <div className="glass-card rounded-3xl p-6 border border-white/10 flex flex-col md:flex-row gap-4 items-end">
        <div className="flex-1 w-full">
          <label className="text-xs font-bold text-gray-500 uppercase">Ombor</label>
          <select
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            className="mt-2 w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white"
          >
            <option value="">Tanlang...</option>
            {warehouses.map((w: any) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={handleStart}
          disabled={start.isPending}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-black disabled:opacity-50"
        >
          {start.isPending ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
          Yangi sanash
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-teal-500" size={40} />
        </div>
      ) : counts.length === 0 ? (
        <div className="glass-card rounded-3xl p-12 text-center">
          <ClipboardList className="mx-auto text-gray-600 mb-4" size={48} />
          <p className="text-gray-400">Hujjatlar yo&apos;q. Yuqoridan yangi inventarizatsiya boshlang.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {counts.map((c: any) => (
            <Link
              key={c.id}
              href={`/dashboard/inventory-count/${c.id}`}
              className="block glass-card rounded-2xl p-5 border border-white/5 hover:border-teal-500/30"
            >
              <div className="flex justify-between items-center gap-4">
                <div>
                  <p className="font-black text-white">{c.reference}</p>
                  <p className="text-sm text-gray-500">
                    {c.warehouse?.name} · {c._count?.items ?? 0} ta qator
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black uppercase px-2 py-1 rounded-lg bg-white/5 text-gray-300">
                    {STATUS_LABEL[c.status] || c.status}
                  </span>
                  <ChevronRight className="text-gray-600" size={20} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
