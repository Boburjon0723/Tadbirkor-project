'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  ChevronRight,
  Edit3,
  Loader2,
  Package,
  Plus,
  Search,
} from 'lucide-react';
import { useWarehouseIntakeList, useWarehouseIntakeMutations } from '@/hooks/warehouse-intake/use-warehouse-intake';
import { useWarehouses } from '@/hooks/warehouse/use-warehouse';
import { useSession } from '@/hooks/use-session';
import { CreateIntakeMobileSheet } from '@/features/warehouse-intake/mobile/CreateIntakeMobileSheet';
import {
  formatIntakeDate,
  intakeStatusMobileLabel,
  intakeStatusPillClass,
  intakeTotals,
} from '@/features/warehouse-intake/intake-utils';
import { toast, formatApiError } from '@/lib/toast';

type StatusFilter = 'all' | 'DRAFT' | 'COMPLETED' | 'CANCELLED';

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Hammasi' },
  { key: 'DRAFT', label: 'Qoralama' },
  { key: 'COMPLETED', label: 'Yakunlangan' },
  { key: 'CANCELLED', label: 'Bekor qilingan' },
];

export function IntakeMobileList() {
  const router = useRouter();
  const { data: session } = useSession();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const listParams = useMemo(
    () => ({
      status: statusFilter === 'all' ? undefined : statusFilter,
    }),
    [statusFilter],
  );

  const { data: intakes = [], isLoading } = useWarehouseIntakeList(listParams);
  const { data: warehouses = [] } = useWarehouses();
  const { create } = useWarehouseIntakeMutations();

  const defaultWarehouseId = warehouses[0]?.id;
  const lockWarehouse =
    warehouses.length === 1 ||
    (session?.role === 'warehouse' && warehouses.length <= 1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return intakes;
    return intakes.filter(
      (i) =>
        i.reference.toLowerCase().includes(q) ||
        i.warehouse?.name?.toLowerCase().includes(q),
    );
  }, [intakes, search]);

  const handleCreate = async (dto: {
    warehouseId: string;
    note?: string;
    partnerLedgerContactId?: string;
  }) => {
    try {
      const created = await create.mutateAsync(dto);
      setCreateOpen(false);
      toast.success('Kirim boshlandi');
      router.push(`/dashboard/warehouse-intake/${created.id}`);
      return created;
    } catch (err) {
      toast.error(formatApiError(err));
      throw err;
    }
  };

  return (
    <div className="lg:hidden min-h-[100dvh] bg-[#050505] text-[#dde4dd] pb-28">
      <div className="sticky top-0 z-40 bg-[#0e1511]/90 backdrop-blur-xl border-b border-white/10 px-6 h-14 flex items-center justify-between">
        <h1 className="text-base font-bold">Ombor kirimi</h1>
        <Search size={20} className="text-[#bbcabf]" />
      </div>

      <main className="px-6 pt-5">
        <div className="mb-6">
          <h2 className="text-2xl font-extrabold text-white mb-1">Xarid va Qabul</h2>
          <p className="text-sm text-[#bbcabf]">
            Qo&apos;lda va skaner orqali mahsulot qabul qilish
          </p>
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-6 px-6 pb-3 mb-4">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setStatusFilter(f.key)}
              className={`flex-shrink-0 px-5 py-2 rounded-full text-xs font-semibold active:scale-95 transition-all ${
                statusFilter === f.key
                  ? 'bg-[#0566d9] text-white'
                  : 'intake-glass text-[#bbcabf]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="animate-spin text-emerald-500" size={32} />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {!filtered.length && (
              <p className="text-center text-[#86948a] py-12 text-sm">
                Kirim hujjatlari topilmadi
              </p>
            )}
            {filtered.map((item) => {
              const totals = intakeTotals(item);
              const lineCount = item._count?.lines ?? totals.positions;
              const isCancelled = item.status === 'CANCELLED';
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => router.push(`/dashboard/warehouse-intake/${item.id}`)}
                  className={`intake-glass rounded-[20px] p-5 text-left w-full active:scale-[0.98] transition-all ${
                    isCancelled ? 'opacity-70' : ''
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-400 mb-1 block">
                        REF: {item.reference}
                      </span>
                      <h3 className="text-base font-bold text-white">
                        {item.warehouse?.name || 'Ombor'}
                      </h3>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider ${intakeStatusPillClass(item.status)}`}
                    >
                      {intakeStatusMobileLabel(item.status)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-[#bbcabf] mb-3">
                    <span className="flex items-center gap-1.5">
                      <Calendar size={14} />
                      {formatIntakeDate(item.completedAt || item.createdAt)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Package size={14} />
                      {lineCount} ta · {totals.units} dona
                    </span>
                  </div>
                  {item.status === 'DRAFT' && (
                    <div className="flex items-center gap-2 pt-3 border-t border-white/5 text-xs text-[#bbcabf]">
                      <Edit3 size={14} className="text-[#ffb95f]" />
                      Davom ettirish
                      <ChevronRight size={16} className="ml-auto" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </main>

      <button
        type="button"
        onClick={() => setCreateOpen(true)}
        className="fixed bottom-24 right-6 w-16 h-16 rounded-full bg-[#0566d9] text-white shadow-2xl flex items-center justify-center active:scale-90 z-50"
        aria-label="Yangi kirim"
      >
        <Plus size={28} strokeWidth={2.5} />
      </button>

      <CreateIntakeMobileSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        warehouses={warehouses}
        defaultWarehouseId={defaultWarehouseId}
        lockWarehouse={lockWarehouse}
        onSubmit={handleCreate}
        loading={create.isPending}
      />
    </div>
  );
}
