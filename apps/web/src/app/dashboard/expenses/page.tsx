'use client';

import React, { useMemo, useState } from 'react';
import {
  Wallet2,
  Plus,
  Loader2,
  CheckCircle2,
  XCircle,
  Pencil,
  Trash2,
  Search,
} from 'lucide-react';
import { ModuleGate } from '@/components/ModuleGate';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import { CreateExpenseModal } from '@/features/expenses/CreateExpenseModal';
import {
  useExpenseCategories,
  useExpenseMutations,
  useExpenses,
  useExpenseSummary,
} from '@/hooks/expenses/use-expenses';
import { usePermissions } from '@/hooks/use-permissions';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { toast, formatApiError } from '@/lib/toast';
import { confirmAction } from '@/components/ConfirmDialog';
import { RejectReasonModal } from '@/components/RejectReasonModal';
import type { ExpenseRow } from '@/services/expenses.service';

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Kutilmoqda',
  APPROVED: 'Tasdiqlangan',
  REJECTED: 'Rad etilgan',
};

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-amber-500/20 text-amber-300',
  APPROVED: 'bg-emerald-500/20 text-emerald-300',
  REJECTED: 'bg-red-500/20 text-red-300',
};

function formatMoney(amount: number, currency: string) {
  return `${amount.toLocaleString('uz-UZ')} ${currency}`;
}

function sumByCurrency(totals: Record<string, number> | undefined, currency: string) {
  return totals?.[currency] ?? 0;
}

export default function ExpensesPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search, 250);

  const monthStart = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  }, []);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const { can, loading: permLoading } = usePermissions();
  const { data: categories = [], isPending: catPending } = useExpenseCategories();
  const { data: summary } = useExpenseSummary(monthStart, today);
  const { data: listData, isPending: listPending, isFetching } = useExpenses({
    status: statusFilter || undefined,
    search: debouncedSearch.trim() || undefined,
    from: monthStart,
    to: today,
    page: 1,
    limit: 100,
  });
  const mutations = useExpenseMutations();

  const items = listData?.items ?? [];
  const canCreate = can('expenses.create');
  const canApprove = can('expenses.approve');
  const canReject = can('expenses.reject');

  const handleCreate = async (payload: Parameters<typeof mutations.create.mutateAsync>[0]) => {
    try {
      if (editing) {
        await mutations.update.mutateAsync({ id: editing.id, ...payload });
        toast.success('Xarajat yangilandi');
      } else {
        await mutations.create.mutateAsync(payload);
        toast.success('Xarajat yuborildi — tasdiqlash kutilmoqda');
      }
      setModalOpen(false);
      setEditing(null);
    } catch (e) {
      toast.error(formatApiError(e));
      throw e;
    }
  };

  const handleApprove = async (id: string) => {
    setBusyId(id);
    try {
      await mutations.approve.mutateAsync(id);
      toast.success('Tasdiqlandi');
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (id: string, reason: string) => {
    setBusyId(id);
    try {
      await mutations.reject.mutateAsync({ id, reason });
      toast.success('Rad etildi');
      setRejectingId(null);
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setBusyId(null);
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

  const loading = catPending || listPending || permLoading;

  return (
    <ModuleGate moduleKey="EXPENSES" moduleLabel="Ichki xarajatlar">
      <div className="space-y-8 pb-20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight flex items-center gap-3">
              <Wallet2 className="text-amber-400" /> Ichki xarajatlar
            </h1>
            <p className="text-gray-400 mt-2">Ofis, transport va boshqa chiqimlar — tasdiqlash oqimi</p>
          </div>
          {canCreate && (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-amber-600 hover:bg-amber-500 font-black text-sm"
            >
              <Plus size={18} /> Yangi xarajat
            </button>
          )}
        </div>

        {summary && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="glass-card p-5 rounded-2xl border border-amber-500/20">
              <p className="text-xs font-black uppercase text-amber-400/80 tracking-widest">Kutilmoqda</p>
              <p className="text-2xl font-black text-white mt-2">
                {formatMoney(sumByCurrency(summary.pending, 'UZS'), 'UZS')}
              </p>
              <p className="text-sm text-gray-500 mt-1">{summary.counts.pending} ta yozuv</p>
            </div>
            <div className="glass-card p-5 rounded-2xl border border-emerald-500/20">
              <p className="text-xs font-black uppercase text-emerald-400/80 tracking-widest">Tasdiqlangan (oy)</p>
              <p className="text-2xl font-black text-white mt-2">
                {formatMoney(sumByCurrency(summary.approved, 'UZS'), 'UZS')}
              </p>
              <p className="text-sm text-gray-500 mt-1">{summary.counts.approved} ta</p>
            </div>
            <div className="glass-card p-5 rounded-2xl border border-white/10">
              <p className="text-xs font-black uppercase text-gray-500 tracking-widest">Rad etilgan</p>
              <p className="text-2xl font-black text-gray-400 mt-2">
                {formatMoney(sumByCurrency(summary.rejected, 'UZS'), 'UZS')}
              </p>
              <p className="text-sm text-gray-500 mt-1">{summary.counts.rejected} ta</p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 items-center">
          {['', 'PENDING', 'APPROVED', 'REJECTED'].map((s) => (
            <button
              key={s || 'all'}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-2 rounded-xl text-sm font-bold border ${
                statusFilter === s
                  ? 'bg-amber-600 border-amber-500 text-white'
                  : 'bg-white/5 border-white/10 text-gray-400'
              }`}
            >
              {s ? STATUS_LABEL[s] : 'Hammasi'}
            </button>
          ))}
          <div className="relative flex-1 min-w-[200px] max-w-sm ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Qidirish…"
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-bold"
            />
          </div>
          {isFetching && !loading && (
            <span className="text-xs text-amber-500/80 font-bold">Yangilanmoqda…</span>
          )}
        </div>

        {loading ? (
          <PageSkeleton rows={5} />
        ) : (
          <div className="grid gap-4">
            {items.length === 0 && (
              <p className="text-gray-500 font-bold text-center py-16">Xarajatlar yo‘q</p>
            )}
            {items.map((row) => (
              <div
                key={row.id}
                className="glass-card p-6 rounded-3xl border border-white/5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black text-xl text-white">
                      {formatMoney(row.amount, row.currency)}
                    </p>
                    <span
                      className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                        STATUS_STYLE[row.status] || 'bg-white/10 text-gray-300'
                      }`}
                    >
                      {STATUS_LABEL[row.status] || row.status}
                    </span>
                    <span className="text-xs font-bold text-gray-500">{row.category.name}</span>
                  </div>
                  <p className="text-sm text-gray-400 mt-2">
                    {new Date(row.expenseDate).toLocaleDateString('uz-UZ')} · {row.createdBy.fullName}
                  </p>
                  {row.description && (
                    <p className="text-sm text-gray-300 mt-1">{row.description}</p>
                  )}
                  {row.rejectReason && (
                    <p className="text-sm text-red-400 mt-1">Sabab: {row.rejectReason}</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 shrink-0">
                  {row.status === 'PENDING' && canCreate && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(row);
                          setModalOpen(true);
                        }}
                        className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10"
                        title="Tahrirlash"
                      >
                        <Pencil size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(row)}
                        disabled={busyId === row.id}
                        className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20"
                        title="O‘chirish"
                      >
                        <Trash2 size={18} />
                      </button>
                    </>
                  )}
                  {row.status === 'PENDING' && canApprove && (
                    <button
                      type="button"
                      onClick={() => handleApprove(row.id)}
                      disabled={busyId === row.id}
                      className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-black text-sm disabled:opacity-50"
                    >
                      {busyId === row.id ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : (
                        <CheckCircle2 size={18} />
                      )}
                      Tasdiqlash
                    </button>
                  )}
                  {row.status === 'PENDING' && canReject && (
                    <button
                      type="button"
                      onClick={() => setRejectingId(row.id)}
                      disabled={busyId === row.id}
                      className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/5 border border-white/10 font-bold text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                    >
                      <XCircle size={18} /> Rad etish
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <CreateExpenseModal
          open={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
          categories={categories}
          initial={editing}
          onSubmit={handleCreate}
          busy={mutations.create.isPending || mutations.update.isPending}
        />
        <RejectReasonModal
          open={!!rejectingId}
          busy={!!rejectingId && busyId === rejectingId}
          onClose={() => {
            if (busyId) return;
            setRejectingId(null);
          }}
          onSubmit={(reason) => (rejectingId ? handleReject(rejectingId, reason) : undefined)}
        />
      </div>
    </ModuleGate>
  );
}
