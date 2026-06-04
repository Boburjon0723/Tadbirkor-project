'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Loader2, X } from 'lucide-react';
import {
  payrollLeaveApi,
  type LeaveRequestRow,
} from '@/services/payroll-leave.service';
import { usePayrollModule } from '@/hooks/use-payroll-module';
import { toast, formatApiError } from '@/lib/toast';
function formatLeaveDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('uz-UZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function PayrollLeaveRequestsPanel({ canReview }: { canReview: boolean }) {
  const qc = useQueryClient();
  const { payrollEnabled } = usePayrollModule();
  const [status, setStatus] = useState<'PENDING' | ''>('PENDING');

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['payroll', 'leave-requests', status],
    queryFn: () =>
      payrollLeaveApi.listLeave({
        status: status || undefined,
        mine: !canReview,
      }),
    enabled: payrollEnabled && canReview,
    retry: false,
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => payrollLeaveApi.approve(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['payroll'] });
      toast.success('Dam olish tasdiqlandi');
    },
    onError: (e) => toast.error(formatApiError(e)),
  });

  const rejectMut = useMutation({
    mutationFn: (id: string) => payrollLeaveApi.reject(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['payroll'] });
      toast.success('Rad etildi');
    },
    onError: (e) => toast.error(formatApiError(e)),
  });

  if (!canReview) return null;

  return (
    <div className="glass-card rounded-2xl border border-white/5 p-4 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-black text-white">Dam olish so‘rovlari</h2>
          <p className="text-xs font-bold text-gray-500 mt-1">
            Telegram va platforma — owner/menejer tasdiqlaydi
          </p>
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as 'PENDING' | '')}
          className="w-full sm:w-auto bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold"
        >
          <option value="PENDING" className="bg-[#111]">
            Kutilmoqda
          </option>
          <option value="" className="bg-[#111]">
            Barchasi
          </option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-violet-400" />
        </div>
      ) : requests.length === 0 ? (
        <p className="text-sm font-bold text-gray-500 py-4">So‘rovlar yo‘q</p>
      ) : (
        <ul className="space-y-3">
          {requests.map((r: LeaveRequestRow) => (
            <li
              key={r.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-white/5 border border-white/10"
            >
              <div>
                <p className="font-black text-white">{r.companyUser.user.fullName}</p>
                <p className="text-sm font-bold text-gray-400 mt-1">
                  {r.daysCount} kun · {formatLeaveDate(r.startDate)} —{' '}
                  {formatLeaveDate(r.endDate)}
                </p>
                {r.reason && (
                  <p className="text-xs text-gray-500 mt-1">Sabab: {r.reason}</p>
                )}
                <span
                  className={`inline-block mt-2 text-[10px] font-black uppercase px-2 py-0.5 rounded-lg ${
                    r.status === 'PENDING'
                      ? 'bg-amber-500/15 text-amber-400'
                      : r.status === 'APPROVED'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-red-500/15 text-red-400'
                  }`}
                >
                  {r.status}
                </span>
              </div>
              {r.status === 'PENDING' && (
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto shrink-0">
                  <button
                    type="button"
                    disabled={approveMut.isPending}
                    onClick={() => approveMut.mutate(r.id)}
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-sm w-full sm:w-auto"
                  >
                    <Check size={16} />
                    Tasdiqlash
                  </button>
                  <button
                    type="button"
                    disabled={rejectMut.isPending}
                    onClick={() => rejectMut.mutate(r.id)}
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 font-bold text-sm w-full sm:w-auto"
                  >
                    <X size={16} />
                    Rad
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
