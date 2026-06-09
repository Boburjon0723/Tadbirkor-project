'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronRight,
  ClipboardList,
  Loader2,
  Monitor,
  PackagePlus,
  Plus,
  Search,
} from 'lucide-react';
import { ModuleGate } from '@/components/ModuleGate';
import { useWarehouseIntakeList, useWarehouseIntakeMutations } from '@/hooks/warehouse-intake/use-warehouse-intake';
import { useWarehouses } from '@/hooks/warehouse/use-warehouse';
import { CreateIntakeModal } from '@/features/warehouse-intake/CreateIntakeModal';
import {
  formatIntakeDate,
  intakeStatusLabel,
  intakeStatusStyle,
  intakeTotals,
} from '@/features/warehouse-intake/intake-utils';
import { toast, formatApiError } from '@/lib/toast';
import { IntakeMobileList } from '@/features/warehouse-intake/mobile/IntakeMobileList';
import { IntakeNakladnoyButton } from '@/features/warehouse-intake/IntakeNakladnoyButton';

type StatusFilter = 'all' | 'DRAFT' | 'COMPLETED' | 'CANCELLED';

export default function WarehouseIntakeListPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const listParams = useMemo(
    () => ({
      status: statusFilter === 'all' ? undefined : statusFilter,
      warehouseId: warehouseFilter || undefined,
    }),
    [statusFilter, warehouseFilter],
  );

  const { data: intakes = [], isLoading } = useWarehouseIntakeList(listParams);
  const { data: warehouses = [] } = useWarehouses();
  const { create } = useWarehouseIntakeMutations();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return intakes;
    return intakes.filter((i) => i.reference.toLowerCase().includes(q));
  }, [intakes, search]);

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const todayItems = intakes.filter(
      (i) => i.status === 'COMPLETED' && new Date(i.completedAt || i.createdAt).toDateString() === today,
    );
    const draftCount = intakes.filter((i) => i.status === 'DRAFT').length;
    const todayUnits = todayItems.reduce((s, i) => s + intakeTotals(i).units, 0);
    const last = intakes[0];
    return {
      todayCount: todayItems.length,
      draftCount,
      todayUnits,
      lastAt: last ? formatIntakeDate(last.completedAt || last.createdAt) : '—',
    };
  }, [intakes]);

  const handleCreate = async (dto: {
    warehouseId: string;
    note?: string;
    partnerLedgerContactId?: string;
  }) => {
    const created = await create.mutateAsync(dto);
    setCreateOpen(false);
    toast.success('Kirim boshlandi');
    router.push(`/dashboard/warehouse-intake/${created.id}`);
    return created;
  };

  return (
    <ModuleGate moduleKey="WAREHOUSE_INTAKE" moduleLabel="Ombor kirimi">
      <div className="hidden lg:block space-y-8 pb-12 min-w-[1024px]">
        <div className="flex items-end justify-between gap-6 pb-6 border-b border-white/5">
          <div>
            <h1 className="text-3xl font-black tracking-tight">
              Ombor <span className="text-blue-500">kirimi</span>
            </h1>
            <p className="text-gray-500 text-sm mt-2">
              Qo&apos;lda va skaner orqali mahsulot qabul qilish (desktop)
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 text-white font-black text-sm hover:bg-blue-500"
          >
            <Plus size={18} />
            Yangi kirim
          </button>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Bugungi kirimlar', value: stats.todayCount, icon: PackagePlus },
            { label: 'Qoralama', value: stats.draftCount, icon: ClipboardList },
            { label: 'Bugungi dona', value: stats.todayUnits, icon: Monitor },
            { label: 'Oxirgi faollik', value: stats.lastAt, icon: ChevronRight, small: true },
          ].map((card) => (
            <div key={card.label} className="glass-card rounded-2xl p-5">
              <div className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-2">
                {card.label}
              </div>
              <div
                className={`font-black ${card.small ? 'text-sm text-gray-300' : 'text-2xl text-white'}`}
              >
                {card.value}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Raqam bo‘yicha qidirish (KIR-...)"
              className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm font-bold outline-none focus:border-blue-500/40"
            />
          </div>
          <select
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold outline-none"
          >
            <option value="" className="bg-[#111]">
              Barcha omborlar
            </option>
            {warehouses.map((w: { id: string; name: string }) => (
              <option key={w.id} value={w.id} className="bg-[#111]">
                {w.name}
              </option>
            ))}
          </select>
          <div className="flex gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
            {(
              [
                ['all', 'Hammasi'],
                ['DRAFT', 'Qoralama'],
                ['COMPLETED', 'Yakunlangan'],
                ['CANCELLED', 'Bekor'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-colors ${
                  statusFilter === key
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="glass-card rounded-2xl overflow-hidden">
          {isLoading ? (
            <div className="py-20 flex justify-center">
              <Loader2 className="animate-spin text-blue-500" size={32} />
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5 text-[10px] font-black uppercase tracking-widest text-white/40">
                  <th className="px-5 py-4">Raqam</th>
                  <th className="px-5 py-4">Ombor</th>
                  <th className="px-5 py-4">Holat</th>
                  <th className="px-5 py-4">Qatorlar</th>
                  <th className="px-5 py-4">Sana</th>
                  <th className="px-5 py-4" />
                </tr>
              </thead>
              <tbody>
                {!filtered.length && (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center text-gray-500">
                      Kirim hujjatlari topilmadi
                    </td>
                  </tr>
                )}
                {filtered.map((item) => {
                  const totals = intakeTotals(item);
                  const lineCount = item._count?.lines ?? item.lines?.length ?? totals.positions;
                  return (
                    <tr
                      key={item.id}
                      className="border-b border-white/5 hover:bg-white/[0.03] cursor-pointer"
                      onClick={() => router.push(`/dashboard/warehouse-intake/${item.id}`)}
                    >
                      <td className="px-5 py-4 font-mono font-bold text-sm">{item.reference}</td>
                      <td className="px-5 py-4 text-sm">{item.warehouse?.name || '—'}</td>
                      <td className="px-5 py-4">
                        <span
                          className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${intakeStatusStyle(item.status)}`}
                        >
                          {intakeStatusLabel(item.status)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-400">
                        {lineCount} · {totals.units} dona
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-500">
                        {formatIntakeDate(item.completedAt || item.createdAt)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {item.status === 'COMPLETED' && (
                            <IntakeNakladnoyButton
                              intakeId={item.id}
                              reference={item.reference}
                              compact
                              label="Chop etish"
                            />
                          )}
                          <span className="text-xs font-black text-blue-400">
                            {item.status === 'DRAFT' ? 'Davom ettirish' : "Ko'rish"}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <CreateIntakeModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          warehouses={warehouses}
          onSubmit={handleCreate}
          loading={create.isPending}
        />
      </div>

      <IntakeMobileList />
    </ModuleGate>
  );
}
