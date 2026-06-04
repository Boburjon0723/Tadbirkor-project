'use client';

import React, { useMemo, useState } from 'react';
import {
  Banknote,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  Trash2,
  Wallet2,
} from 'lucide-react';
import { ModuleGate } from '@/components/ModuleGate';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import { CreateExpenseModal } from '@/features/expenses/CreateExpenseModal';
import {
  useExpenseCategories,
  useExpenseMutations,
  useExpenses,
} from '@/hooks/expenses/use-expenses';
import { usePermissions } from '@/hooks/use-permissions';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { toast, formatApiError } from '@/lib/toast';
import { confirmAction } from '@/components/ConfirmDialog';
import type { ExpenseRow } from '@/services/expenses.service';

const PAYROLL_CATEGORY_NAMES = ['Xodimlar oyligi', 'Xodimlar avansi'];

function formatMoney(amount: number, currency = 'UZS') {
  return `${Math.round(amount).toLocaleString('uz-UZ')} ${currency}`;
}

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function monthRange(monthCursor: Date) {
  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  return {
    from: toDateInput(new Date(year, month, 1)),
    to: toDateInput(new Date(year, month + 1, 0)),
  };
}

function formatMonthTitle(date: Date) {
  return date.toLocaleDateString('uz-UZ', { month: 'long', year: 'numeric' });
}

function defaultExpenseDate(monthCursor: Date) {
  const today = new Date();
  const sameMonth =
    today.getFullYear() === monthCursor.getFullYear() &&
    today.getMonth() === monthCursor.getMonth();
  return sameMonth ? toDateInput(today) : toDateInput(new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1));
}

function categoryName(row: ExpenseRow) {
  return row.category?.name || 'Boshqa';
}

function isPayrollRow(row: ExpenseRow) {
  return PAYROLL_CATEGORY_NAMES.includes(categoryName(row));
}

export default function ExpensesPage() {
  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search, 250);

  const { from, to } = useMemo(() => monthRange(monthCursor), [monthCursor]);
  const { can, loading: permLoading } = usePermissions();
  const { data: categories = [], isPending: catPending } = useExpenseCategories();
  const { data: listData, isPending: listPending, isFetching } = useExpenses({
    categoryId: categoryFilter || undefined,
    search: debouncedSearch.trim() || undefined,
    from,
    to,
    page: 1,
    limit: 100,
  });
  const mutations = useExpenseMutations();

  const items = listData?.items ?? [];
  const totals = useMemo(() => {
    const total = items.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const payroll = items.filter(isPayrollRow).reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const byCategory = new Map<string, { id: string; name: string; amount: number; count: number }>();

    for (const row of items) {
      const key = row.categoryId || categoryName(row);
      const prev = byCategory.get(key) || {
        id: row.categoryId,
        name: categoryName(row),
        amount: 0,
        count: 0,
      };
      prev.amount += Number(row.amount || 0);
      prev.count += 1;
      byCategory.set(key, prev);
    }

    return {
      total,
      payroll,
      other: total - payroll,
      byCategory: Array.from(byCategory.values()).sort((a, b) => b.amount - a.amount),
    };
  }, [items]);

  const canCreate = can('expenses.create');
  const canManage = can('expenses.manage');
  const loading = catPending || listPending || permLoading;

  const moveMonth = (delta: number) => {
    setMonthCursor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  };

  const handleCreate = async (payload: Parameters<typeof mutations.create.mutateAsync>[0]) => {
    try {
      if (editing) {
        await mutations.update.mutateAsync({ id: editing.id, ...payload });
        toast.success('Xarajat yangilandi');
      } else {
        await mutations.create.mutateAsync(payload);
        toast.success('Xarajat qo‘shildi');
      }
      setModalOpen(false);
      setEditing(null);
    } catch (e) {
      toast.error(formatApiError(e));
      throw e;
    }
  };

  const handleDelete = async (row: ExpenseRow) => {
    const ok = await confirmAction('Ushbu xarajatni o‘chirasizmi?', {
      title: 'O‘chirish',
      variant: 'danger',
      confirmLabel: 'O‘chirish',
    });
    if (!ok) return;

    setBusyId(row.id);
    try {
      await mutations.remove.mutateAsync(row.id);
      toast.success('O‘chirildi');
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ModuleGate moduleKey="EXPENSES" moduleLabel="Ichki xarajatlar">
      <div className="space-y-6 pb-20">
        <section className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-amber-300">
              Oylik xarajat daftari
            </p>
            <h1 className="mt-2 flex items-center gap-3 text-3xl font-black tracking-tight text-white">
              <Wallet2 className="text-amber-400" size={30} />
              Xarajatlar
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => moveMonth(-1)}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10"
              title="Oldingi oy"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex min-w-[190px] items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 font-black capitalize">
              <CalendarDays size={18} className="text-amber-300" />
              {formatMonthTitle(monthCursor)}
            </div>
            <button
              type="button"
              onClick={() => moveMonth(1)}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10"
              title="Keyingi oy"
            >
              <ChevronRight size={18} />
            </button>
            <button
              type="button"
              onClick={() => setMonthCursor(new Date())}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold hover:bg-white/10"
            >
              Hozirgi oy
            </button>
            {canCreate && (
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setModalOpen(true);
                }}
                className="flex items-center gap-2 rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-black text-white hover:bg-amber-500"
              >
                <Plus size={18} /> Xarajat qo‘shish
              </button>
            )}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-white/10 bg-white/5 p-5">
            <p className="text-xs font-black uppercase tracking-widest text-gray-400">Jami xarajat</p>
            <p className="mt-2 text-2xl font-black text-white">{formatMoney(totals.total)}</p>
            <p className="mt-1 text-sm font-bold text-gray-500">{items.length} ta yozuv</p>
          </div>
          <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 p-5">
            <p className="text-xs font-black uppercase tracking-widest text-emerald-300">Oylik va avans</p>
            <p className="mt-2 text-2xl font-black text-white">{formatMoney(totals.payroll)}</p>
            <p className="mt-1 text-sm font-bold text-gray-500">Payroll alohida hisob, bu yerda pul chiqimi</p>
          </div>
          <div className="rounded-lg border border-blue-400/20 bg-blue-500/10 p-5">
            <p className="text-xs font-black uppercase tracking-widest text-blue-300">Boshqa xarajatlar</p>
            <p className="mt-2 text-2xl font-black text-white">{formatMoney(totals.other)}</p>
            <p className="mt-1 text-sm font-bold text-gray-500">Ijara, transport, ofis va boshqalar</p>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_1fr]">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-black text-white">Kategoriya bo‘yicha</h2>
              <Banknote size={20} className="text-amber-300" />
            </div>
            <div className="mt-4 space-y-3">
              {totals.byCategory.length === 0 && (
                <p className="py-8 text-center text-sm font-bold text-gray-500">
                  Bu oyda kategoriya summasi yo‘q
                </p>
              )}
              {totals.byCategory.map((row) => {
                const percent = totals.total ? Math.round((row.amount / totals.total) * 100) : 0;
                return (
                  <button
                    key={row.id || row.name}
                    type="button"
                    onClick={() => setCategoryFilter(row.id)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 p-3 text-left hover:bg-white/10"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-black text-white">{row.name}</span>
                      <span className="text-sm font-bold text-gray-300">{formatMoney(row.amount)}</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-amber-400" style={{ width: `${percent}%` }} />
                    </div>
                    <p className="mt-1 text-xs font-bold text-gray-500">
                      {row.count} ta yozuv, {percent}%
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-4 md:flex-row md:items-center">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white"
              >
                <option value="" className="bg-gray-900">Barcha kategoriyalar</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id} className="bg-gray-900">
                    {category.name}
                  </option>
                ))}
              </select>
              <div className="relative min-w-[220px] flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Izoh yoki kategoriya bo‘yicha qidirish..."
                  className="w-full rounded-lg border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm font-bold text-white"
                />
              </div>
              {isFetching && !loading && (
                <span className="text-xs font-bold text-amber-300">Yangilanmoqda...</span>
              )}
            </div>

            {loading ? (
              <PageSkeleton rows={5} />
            ) : (
              <div className="space-y-3">
                {items.length === 0 && (
                  <div className="rounded-lg border border-white/10 bg-white/5 py-14 text-center font-bold text-gray-500">
                    Bu oy uchun xarajat topilmadi
                  </div>
                )}
                {items.map((row) => (
                  <div
                    key={row.id}
                    className="rounded-lg border border-white/10 bg-white/[0.04] p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-white/10 px-2.5 py-1 text-xs font-black text-gray-200">
                            {categoryName(row)}
                          </span>
                          {isPayrollRow(row) && (
                            <span className="rounded-md bg-emerald-500/15 px-2.5 py-1 text-xs font-black text-emerald-300">
                              Payroll
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-lg font-black text-white">
                          {row.description || 'Izohsiz xarajat'}
                        </p>
                        <p className="mt-1 text-sm font-bold text-gray-500">
                          {new Date(row.expenseDate).toLocaleDateString('uz-UZ')} · {row.createdBy.fullName}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-3 md:justify-end">
                        <p className="text-xl font-black text-white">{formatMoney(row.amount, row.currency)}</p>
                        {(canCreate || canManage) && (
                          <div className="flex gap-2">
                            {canCreate && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditing(row);
                                  setModalOpen(true);
                                }}
                                className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10"
                                title="Tahrirlash"
                              >
                                <Pencil size={16} />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDelete(row)}
                              disabled={busyId === row.id}
                              className="flex h-10 w-10 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                              title="O‘chirish"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <CreateExpenseModal
          open={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
          categories={categories}
          initial={editing}
          defaultDate={defaultExpenseDate(monthCursor)}
          onSubmit={handleCreate}
          busy={mutations.create.isPending || mutations.update.isPending}
        />
      </div>
    </ModuleGate>
  );
}
