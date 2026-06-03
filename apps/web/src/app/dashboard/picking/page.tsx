'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Package, Loader2, ChevronRight, Filter } from 'lucide-react';
import { usePickTasks } from '@/hooks/logistics/use-picking';

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Kutilmoqda',
  IN_PROGRESS: 'Jarayonda',
  COMPLETED: 'Tugallangan',
  CANCELLED: 'Bekor',
};

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  IN_PROGRESS: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  COMPLETED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  CANCELLED: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

export default function PickingPage() {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const { data: tasks = [], isLoading } = usePickTasks(
    statusFilter ? { status: statusFilter } : undefined,
  );

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/5">
        <div>
          <h1 className="text-3xl font-black tracking-tight">
            Saralash <span className="text-amber-400">(Picking)</span>
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Jo&apos;natma uchun ombordan mahsulotlarni saralash va skanerlash.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-gray-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white"
          >
            <option value="">Barcha holatlar</option>
            <option value="PENDING">Kutilmoqda</option>
            <option value="IN_PROGRESS">Jarayonda</option>
            <option value="COMPLETED">Tugallangan</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-amber-500" size={40} />
        </div>
      ) : tasks.length === 0 ? (
        <div className="glass-card rounded-3xl p-12 text-center border border-white/5">
          <Package className="mx-auto text-gray-600 mb-4" size={48} />
          <p className="text-gray-400">Hozircha picking vazifalari yo&apos;q.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task: any) => (
            <Link
              key={task.id}
              href={`/dashboard/picking/${task.id}`}
              className="block glass-card rounded-2xl p-5 border border-white/5 hover:border-amber-500/30 transition-colors"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-bold text-white truncate">
                    {task.productNameSnapshot || task.productVariant?.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {task.dispatch?.dispatchNumber || task.dispatchId?.slice(0, 8)} ·{' '}
                    {task.warehouse?.name}
                  </p>
                  <p className="text-sm text-gray-400 mt-2">
                    {Number(task.quantityPicked)} / {Number(task.quantityRequired)} dona
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg border ${STATUS_STYLE[task.status] || STATUS_STYLE.PENDING}`}
                  >
                    {STATUS_LABEL[task.status] || task.status}
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
