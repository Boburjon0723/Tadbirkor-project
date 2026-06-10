'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  ChevronRight,
  ClipboardList,
  Edit3,
  History,
  Loader2,
  Package,
  PackagePlus,
  Plus,
  Search,
  Settings,
  X,
} from 'lucide-react';
import { useWarehouseIntakeList, useWarehouseIntakeMutations } from '@/hooks/warehouse-intake/use-warehouse-intake';
import { useWarehouses } from '@/hooks/warehouse/use-warehouse';
import { useSession } from '@/hooks/use-session';
import { CreateIntakeMobileSheet } from '@/features/warehouse-intake/mobile/CreateIntakeMobileSheet';
import { IntakeNakladnoyButton } from '@/features/warehouse-intake/IntakeNakladnoyButton';
import {
  formatIntakeDate,
  intakeStatusMobileLabel,
  intakeStatusPillClass,
  intakeTotals,
} from '@/features/warehouse-intake/intake-utils';
import {
  getIntakeMobileCapabilities,
  shouldLockIntakeWarehouseOnCreate,
} from '@/lib/role-access';
import { toast, formatApiError } from '@/lib/toast';

type StatusFilter = 'all' | 'DRAFT' | 'COMPLETED' | 'CANCELLED';

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Hammasi' },
  { key: 'DRAFT', label: 'Qoralama' },
  { key: 'COMPLETED', label: 'Yakunlangan' },
  { key: 'CANCELLED', label: 'Bekor' },
];

export function IntakeMobileList() {
  const router = useRouter();
  const { data: session } = useSession();
  const role = session?.role ?? 'warehouse';
  const caps = getIntakeMobileCapabilities(role);
  const isOperator = caps.view === 'operator';

  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    isOperator ? 'DRAFT' : 'all',
  );
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const listParams = useMemo(
    () => ({
      status: statusFilter === 'all' ? undefined : statusFilter,
      warehouseId: caps.showWarehouseFilter && warehouseFilter ? warehouseFilter : undefined,
    }),
    [statusFilter, warehouseFilter, caps.showWarehouseFilter],
  );

  const { data: intakes = [], isLoading } = useWarehouseIntakeList(listParams);
  const { data: warehouses = [] } = useWarehouses();
  const { create } = useWarehouseIntakeMutations();

  const defaultWarehouseId = warehouses[0]?.id;
  const lockWarehouse = shouldLockIntakeWarehouseOnCreate(role, warehouses.length);

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const todayItems = intakes.filter(
      (i) =>
        i.status === 'COMPLETED' &&
        new Date(i.completedAt || i.createdAt).toDateString() === today,
    );
    const draftCount = intakes.filter((i) => i.status === 'DRAFT').length;
    const todayUnits = todayItems.reduce((s, i) => s + intakeTotals(i).units, 0);
    return { todayCount: todayItems.length, draftCount, todayUnits };
  }, [intakes]);

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
    <div className="lg:hidden fixed inset-0 z-[60] bg-[#050505] text-[#dde4dd] flex flex-col">
      <header className="shrink-0 bg-[#080808]/95 backdrop-blur-xl border-b border-white/10 px-4 h-14 flex items-center gap-3">
        <Link
          href="/dashboard"
          className="p-2 -ml-2 rounded-xl text-[#bbcabf] active:bg-white/5"
          aria-label="Asosiy"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold text-white truncate">
            {isOperator ? 'Skaner kirimi' : 'Ombor kirimi'}
          </h1>
          <p className="text-[10px] text-[#86948a] truncate">{caps.roleLabel}</p>
        </div>
        <div className="flex items-center gap-1">
          {caps.showSearch && (
            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              className="p-2 rounded-xl text-[#bbcabf] active:bg-white/5"
              aria-label="Qidirish"
            >
              {searchOpen ? <X size={20} /> : <Search size={20} />}
            </button>
          )}
          {caps.showSettingsLink && (
            <Link
              href="/dashboard/warehouse-intake/settings"
              className="p-2 rounded-xl text-[#bbcabf] active:bg-white/5"
              aria-label="Sozlamalar"
            >
              <Settings size={20} />
            </Link>
          )}
        </div>
      </header>

      {searchOpen && caps.showSearch && (
        <div className="shrink-0 px-4 py-3 border-b border-white/5 bg-[#080808]/80">
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="KIR-... yoki ombor nomi"
            className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-sm font-semibold outline-none focus:border-blue-500/40"
          />
        </div>
      )}

      <main className="flex-1 overflow-y-auto px-4 pt-4 pb-24">
        {isOperator ? (
          <div className="mb-5">
            <h2 className="text-xl font-extrabold text-white">Mahsulot qabul qilish</h2>
            <p className="text-sm text-[#bbcabf] mt-1">
              Barcode skaner qiling yoki qo&apos;lda kiriting
            </p>
            {warehouses.length === 1 && (
              <p className="text-xs text-emerald-400/90 mt-2 font-semibold">
                Ombor: {warehouses[0].name}
              </p>
            )}
          </div>
        ) : (
          <div className="mb-5">
            <h2 className="text-xl font-extrabold text-white">Kirim boshqaruvi</h2>
            <p className="text-sm text-[#bbcabf] mt-1">
              Barcha omborlar bo&apos;yicha qabul qilish va nazorat
            </p>
          </div>
        )}

        {caps.showStats && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: 'Bugun', value: stats.todayCount, icon: PackagePlus },
              { label: 'Qoralama', value: stats.draftCount, icon: ClipboardList },
              { label: 'Dona', value: stats.todayUnits, icon: Package },
            ].map((card) => (
              <div
                key={card.label}
                className="glass-card rounded-xl p-3 text-center"
              >
                <div className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-1">
                  {card.label}
                </div>
                <div className="text-lg font-black text-white">{card.value}</div>
              </div>
            ))}
          </div>
        )}

        {caps.showHistoryLink && (
          <div className="flex gap-2 mb-4">
            <Link
              href="/dashboard/warehouse"
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-[#bbcabf] active:bg-white/10"
            >
              <History size={14} />
              Ombor tarixi
            </Link>
          </div>
        )}

        {caps.showWarehouseFilter && warehouses.length > 1 && (
          <select
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
            className="w-full mb-4 h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-sm font-bold outline-none"
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
        )}

        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-3 mb-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setStatusFilter(f.key)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold active:scale-95 transition-all ${
                statusFilter === f.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/5 text-[#bbcabf] border border-white/10'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="animate-spin text-blue-500" size={32} />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {!filtered.length && (
              <p className="text-center text-[#86948a] py-12 text-sm">
                {isOperator
                  ? 'Qoralama kirim yo‘q — yangi kirim boshlang'
                  : 'Kirim hujjatlari topilmadi'}
              </p>
            )}
            {filtered.map((item) => {
              const totals = intakeTotals(item);
              const lineCount = item._count?.lines ?? totals.positions;
              const isCancelled = item.status === 'CANCELLED';
              return (
                <div
                  key={item.id}
                  className={`glass-card rounded-2xl p-4 ${
                    isCancelled ? 'opacity-70' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      router.push(`/dashboard/warehouse-intake/${item.id}`)
                    }
                    className="w-full text-left active:scale-[0.99] transition-transform"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 block">
                          {item.reference}
                        </span>
                        <h3 className="text-base font-bold text-white truncate">
                          {item.warehouse?.name || 'Ombor'}
                        </h3>
                      </div>
                      <span
                        className={`shrink-0 ml-2 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase ${intakeStatusPillClass(item.status)}`}
                      >
                        {intakeStatusMobileLabel(item.status)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-[#bbcabf]">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {formatIntakeDate(item.completedAt || item.createdAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Package size={12} />
                        {lineCount} · {totals.units} dona
                      </span>
                    </div>
                    {item.status === 'DRAFT' && (
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5 text-xs text-amber-400/90">
                        <Edit3 size={14} />
                        Davom ettirish
                        <ChevronRight size={14} className="ml-auto" />
                      </div>
                    )}
                  </button>
                  {caps.showNakladnoyOnList && item.status === 'COMPLETED' && (
                    <div className="mt-3 pt-3 border-t border-white/5">
                      <IntakeNakladnoyButton
                        intakeId={item.id}
                        reference={item.reference}
                        compact
                        label="Nakladnoy"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      <button
        type="button"
        onClick={() => setCreateOpen(true)}
        className="fixed right-5 w-14 h-14 rounded-full bg-blue-600 text-white shadow-2xl flex items-center justify-center active:scale-90 z-[70] bottom-[calc(1.5rem+env(safe-area-inset-bottom))]"
        aria-label="Yangi kirim"
      >
        <Plus size={26} strokeWidth={2.5} />
      </button>

      <CreateIntakeMobileSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        warehouses={warehouses}
        defaultWarehouseId={defaultWarehouseId}
        lockWarehouse={lockWarehouse}
        showPartnerPicker={caps.showPartnerOnCreate}
        onSubmit={handleCreate}
        loading={create.isPending}
      />
    </div>
  );
}
