'use client';

import React from 'react';
import Link from 'next/link';
import { MapPin, ChevronRight } from 'lucide-react';
import { FIELD_TASK_STATUS_LABEL } from '@/lib/field-status';
import { useMyFieldTasks } from '@/hooks/field/use-field';
import { PageSkeleton } from '@/components/ui/page-skeleton';

export default function FieldHomePage() {
  const { data: tasks = [], isPending, isFetching } = useMyFieldTasks();
  const showSkeleton = isPending && !tasks.length;

  if (showSkeleton) {
    return <PageSkeleton rows={4} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-black">Bugungi vazifalar</h1>
        {isFetching && !isPending && (
          <span className="text-[10px] font-bold text-cyan-500/80 uppercase">Yangilanmoqda</span>
        )}
      </div>
      {tasks.length === 0 && <p className="text-gray-500 font-bold">Vazifa yo‘q</p>}
      {tasks.map((t: any) => (
        <Link
          key={t.id}
          href={`/field/tasks/${t.id}`}
          prefetch
          className="block p-5 rounded-2xl bg-white/5 border border-white/10"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="font-black text-lg">{t.title}</p>
              <p className="text-xs text-gray-500 mt-1">{FIELD_TASK_STATUS_LABEL[t.status] || t.status}</p>
              {t.address && (
                <p className="text-xs text-gray-400 flex items-center gap-1 mt-2">
                  <MapPin size={12} /> {t.address}
                </p>
              )}
            </div>
            <ChevronRight className="text-gray-600" />
          </div>
        </Link>
      ))}
    </div>
  );
}
