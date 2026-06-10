'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { MobileScanField } from '@/components/mobile/MobileScanField';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePickTaskActions } from '@/hooks/logistics/use-picking';
import { pickingService } from '@/services/picking.service';
import { toast, formatApiError } from '@/lib/toast';

export default function PickTaskPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = String(params.taskId || '');
  const queryClient = useQueryClient();
  const [barcode, setBarcode] = useState('');
  const [qty, setQty] = useState('1');
  const { scan, complete } = usePickTaskActions();

  // Vazifani butun qayta yuklamasdan, javobdagi yangi maydonlarni cache'ga birlashtirish
  const patchTask = (updated: any) => {
    if (!updated?.id) return;
    queryClient.setQueryData(['pick-task', taskId], (old: any) =>
      old ? { ...old, ...updated } : old,
    );
  };

  const { data: task, isLoading } = useQuery({
    queryKey: ['pick-task', taskId],
    queryFn: () => pickingService.getPickTask(taskId),
    enabled: Boolean(taskId),
  });

  const handleScan = async (code?: string) => {
    const scanned = (code ?? barcode).trim();
    if (!scanned) return;
    try {
      const res = await scan.mutateAsync({
        taskId,
        barcode: scanned,
        quantity: Number(qty) || 1,
      });
      setBarcode('');
      patchTask(res);
      toast.success('Skaner qabul qilindi');
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  const handleComplete = async () => {
    try {
      const res = await complete.mutateAsync(taskId);
      patchTask(res);
      toast.success('Vazifa tugallandi');
      if (task?.dispatchId) {
        router.push(`/dashboard/picking/dispatch/${task.dispatchId}`);
      }
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-32">
        <Loader2 className="animate-spin text-amber-500" size={40} />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="text-center py-20 text-gray-400">
        Vazifa topilmadi.{' '}
        <Link href="/dashboard/picking" className="text-amber-400 underline">
          Ro&apos;yxatga qaytish
        </Link>
      </div>
    );
  }

  const required = Number(task.quantityRequired);
  const picked = Number(task.quantityPicked);
  const done = task.status === 'COMPLETED';

  return (
    <div className="w-full max-w-lg md:mx-auto space-y-4 md:space-y-6 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-20">
      <Link
        href={task.dispatchId ? `/dashboard/picking/dispatch/${task.dispatchId}` : '/dashboard/picking'}
        className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white"
      >
        <ArrowLeft size={16} />
        Orqaga
      </Link>

      <div className="glass-card rounded-3xl p-8 border border-white/10">
        <p className="text-xs font-black uppercase text-amber-500 tracking-widest mb-2">Picking</p>
        <h1 className="text-2xl font-black text-white mb-1">{task.productNameSnapshot}</h1>
        <p className="text-gray-500 text-sm">
          SKU: {task.productVariant?.sku || '—'} · Barcode: {task.productVariant?.barcode || '—'}
        </p>

        <div className="mt-6 p-4 rounded-2xl bg-white/5 border border-white/10">
          <p className="text-3xl font-black text-center text-white">
            {picked} <span className="text-gray-500 text-lg">/ {required}</span>
          </p>
          <p className="text-center text-xs text-gray-500 mt-1">donа saralandi</p>
        </div>

        {!done && (
          <div className="mt-6">
            <MobileScanField
              value={barcode}
              onChange={setBarcode}
              onSubmit={handleScan}
              busy={scan.isPending}
              qty={qty}
              onQtyChange={setQty}
              showQty
              placeholder="Barcode / SKU skaner..."
              accentClass="bg-amber-500 text-black"
              scannerTitle="Saralash skaner"
            />
          </div>
        )}

        {picked >= required && !done && (
          <button
            type="button"
            onClick={handleComplete}
            disabled={complete.isPending}
            className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 text-black font-black"
          >
            <CheckCircle2 size={18} />
            Tugatish
          </button>
        )}

        {done && (
          <p className="mt-4 text-center text-emerald-400 font-bold flex items-center justify-center gap-2">
            <CheckCircle2 size={18} />
            Tugallangan
          </p>
        )}
      </div>
    </div>
  );
}
