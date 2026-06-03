'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Loader2, Truck, ChevronRight, Send } from 'lucide-react';
import { useDispatchPickTasks } from '@/hooks/logistics/use-picking';
import { useDispatchActions } from '@/hooks/logistics/use-logistics';
import { usePermissions } from '@/hooks/use-permissions';
import { toast, formatApiError } from '@/lib/toast';

const DISPATCH_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Saralash / PGI kutilmoqda',
  SENT: 'Yuborilgan (PGI bajarildi)',
  CANCELLED: 'Bekor qilingan',
};

export default function DispatchPickingPage() {
  const params = useParams();
  const router = useRouter();
  const dispatchId = String(params.dispatchId || '');
  const { data: tasks = [], isLoading, refetch } = useDispatchPickTasks(dispatchId);
  const { sendDispatch } = useDispatchActions();
  const { can } = usePermissions();
  const canSendPgiPermission = can('dispatches.send');
  const [pgiJustSent, setPgiJustSent] = useState(false);

  const allCompleted =
    tasks.length > 0 && tasks.every((t: any) => t.status === 'COMPLETED');
  const dispatchNumber = tasks[0]?.dispatch?.dispatchNumber;
  const dispatchStatus = String(tasks[0]?.dispatch?.status || '').toUpperCase();
  const orderId = tasks[0]?.dispatch?.orderId as string | undefined;

  const isSent = dispatchStatus === 'SENT' || pgiJustSent;
  const canSendPgi =
    canSendPgiPermission &&
    allCompleted &&
    dispatchStatus === 'DRAFT' &&
    !sendDispatch.isPending;

  useEffect(() => {
    if (!pgiJustSent || !isSent) return;
    const timer = window.setTimeout(() => {
      router.replace('/dashboard/picking');
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [pgiJustSent, isSent, router]);

  const handleSend = async () => {
    if (!canSendPgi || isSent) return;
    try {
      await sendDispatch.mutateAsync(dispatchId);
      setPgiJustSent(true);
      toast.success("Jo'natma yuborildi (PGI)");
      await refetch();
    } catch (err) {
      toast.error(formatApiError(err));
    }
  };

  return (
    <div className="space-y-6 pb-20 max-w-2xl mx-auto">
      <Link href="/dashboard/picking" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white">
        <ArrowLeft size={16} />
        Barcha vazifalar
      </Link>

      <div className="glass-card rounded-3xl p-6 border border-white/10">
        <div className="flex items-center gap-3 mb-2">
          <Truck className={isSent ? 'text-emerald-500' : 'text-amber-500'} size={28} />
          <div>
            <h1 className="text-xl font-black text-white">
              {dispatchNumber || `Jo'natma ${dispatchId.slice(0, 8)}`}
            </h1>
            <p className="text-sm text-gray-500">Saralash vazifalari</p>
            {dispatchStatus && (
              <p
                className={`text-[10px] font-black uppercase tracking-widest mt-1 ${
                  isSent ? 'text-emerald-400' : 'text-amber-400/90'
                }`}
              >
                {DISPATCH_STATUS_LABEL[dispatchStatus] || dispatchStatus}
              </p>
            )}
          </div>
        </div>

        {isSent && (
          <div className="mt-4 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 space-y-2">
            <p className="flex items-center gap-2 text-sm font-bold text-emerald-300">
              <CheckCircle2 size={18} />
              Yuk yuborildi (PGI)
            </p>
            <p className="text-xs text-gray-400 leading-relaxed">
              Jo&apos;natma allaqachon yuborilgan. Qayta PGI qilish shart emas — xaridor &quot;Kelgan
              yuklar&quot;dan qabul qiladi.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Link
                href="/dashboard/picking"
                className="px-3 py-1.5 rounded-lg text-[10px] font-black bg-white/10 text-white border border-white/10"
              >
                Saralash ro&apos;yxati
              </Link>
              {orderId && (
                <Link
                  href={`/dashboard/orders?highlight=${orderId}`}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-black bg-blue-500/15 text-blue-300 border border-blue-500/25"
                >
                  Buyurtmaga
                </Link>
              )}
            </div>
            {pgiJustSent && (
              <p className="text-[10px] text-gray-500">Bir necha soniyadan keyin ro&apos;yxatga o&apos;tasiz…</p>
            )}
          </div>
        )}

        {allCompleted && dispatchStatus === 'DRAFT' && !isSent && !canSendPgiPermission && (
          <p className="mt-4 text-xs text-gray-400 leading-relaxed rounded-xl border border-white/10 bg-white/5 p-3">
            Barcha vazifalar tugallandi. Yukni yuborish (PGI) menejer yoki egasi tomonidan
            amalga oshiriladi.
          </p>
        )}

        {canSendPgi && !isSent && (
          <button
            type="button"
            onClick={handleSend}
            disabled={sendDispatch.isPending}
            className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 text-black font-black disabled:opacity-50"
          >
            {sendDispatch.isPending ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <Send size={18} />
            )}
            Yukni yuborish (PGI)
          </button>
        )}

      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-amber-500" size={36} />
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task: any) => (
            <Link
              key={task.id}
              href={`/dashboard/picking/${task.id}`}
              className="flex items-center justify-between glass-card rounded-2xl p-4 border border-white/5 hover:border-amber-500/20"
            >
              <div>
                <p className="font-bold text-white">{task.productNameSnapshot}</p>
                <p className="text-sm text-gray-500">
                  {Number(task.quantityPicked)} / {Number(task.quantityRequired)} · {task.status}
                </p>
              </div>
              <ChevronRight className="text-gray-600" size={20} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
