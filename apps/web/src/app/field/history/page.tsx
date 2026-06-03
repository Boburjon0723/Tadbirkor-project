'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { FIELD_TASK_STATUS_LABEL } from '@/lib/field-status';
import { mergeTaskReportRows, totalInstalledQty } from '@/lib/field-report';
import { useMyFieldHistory } from '@/hooks/field/use-field';
import { PageSkeleton } from '@/components/ui/page-skeleton';

export default function FieldHistoryPage() {
  const { data: tasks = [], isPending } = useMyFieldHistory();

  if (isPending && !tasks.length) {
    return <PageSkeleton rows={4} />;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black">Tarix</h1>
      {tasks.length === 0 && <p className="text-gray-500 font-bold">Tasdiqlangan vazifa yo‘q</p>}
      {tasks.map((t: any) => {
        const rows = mergeTaskReportRows(t);
        const installed = totalInstalledQty(rows);
        return (
          <Link
            key={t.id}
            href={`/field/tasks/${t.id}?from=history`}
            prefetch
            className="block p-4 rounded-2xl bg-white/5 border border-white/10 active:bg-white/10"
          >
            <div className="flex justify-between items-start gap-3">
              <div className="min-w-0">
                <p className="font-bold truncate">{t.title}</p>
                <p className="text-xs text-emerald-400 mt-1 font-bold">
                  {FIELD_TASK_STATUS_LABEL[t.status] || t.status}
                </p>
                {installed > 0 && (
                  <p className="text-xs text-gray-400 mt-2">
                    Jami o‘rnatildi: <span className="text-white font-black">{installed} dona</span>
                  </p>
                )}
              </div>
              <ChevronRight className="text-gray-600 shrink-0 mt-1" size={20} />
            </div>
          </Link>
        );
      })}
    </div>
  );
}
