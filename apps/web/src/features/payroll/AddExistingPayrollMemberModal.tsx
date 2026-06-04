'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, UserPlus, Search } from 'lucide-react';
import { payrollApi } from '@/services/payroll-api.service';
import { ROLE_LABELS, type SystemRole } from '@/lib/roles';
import { toast, formatApiError } from '@/lib/toast';

type Candidate = {
  id: string;
  role: string;
  user: { fullName: string; login: string; phone?: string | null };
  warehouse?: { name: string } | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onAdded: (companyUserId: string, fullName: string) => void;
};

export function AddExistingPayrollMemberModal({ open, onClose, onAdded }: Props) {
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  useEffect(() => {
    if (!open) return;
    setSearch('');
    setLoading(true);
    void payrollApi
      .listRosterCandidates()
      .then((rows) => setCandidates(rows as Candidate[]))
      .catch((e) => {
        toast.error(formatApiError(e));
        setCandidates([]);
      })
      .finally(() => setLoading(false));
  }, [open]);

  const filtered = candidates.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      c.user.fullName.toLowerCase().includes(q) ||
      c.user.login.toLowerCase().includes(q)
    );
  });

  const handleAdd = async (id: string) => {
    const picked = candidates.find((x) => x.id === id);
    setSavingId(id);
    try {
      const res = await payrollApi.addMemberToRoster(id);
      toast.success('Xodim oylik ro‘yxatiga qo‘shildi');
      onAdded(id, res.fullName || picked?.user.fullName || 'Xodim');
      onClose();
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <AnimatePresence initial={false}>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="pointer-events-auto w-full max-w-lg glass-card rounded-3xl border border-white/10 p-6 space-y-4 max-h-[85vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black flex items-center gap-2">
                    <UserPlus size={22} className="text-blue-400" />
                    Mavjud xodimni qo‘shish
                  </h3>
                  <p className="text-sm text-gray-500 mt-1 font-bold">
                    Kompaniya → Xodimlar ro‘yxatidan oylikka olish
                  </p>
                </div>
                <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-white/5">
                  <X size={20} />
                </button>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Ism yoki login..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-bold"
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 min-h-[120px]">
                {loading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="animate-spin text-violet-400" size={28} />
                  </div>
                ) : filtered.length === 0 ? (
                  <p className="text-center text-gray-500 font-bold py-10 text-sm">
                    {candidates.length === 0
                      ? 'Barcha kompaniya xodimlari allaqachon oylik ro‘yxatida'
                      : 'Topilmadi'}
                  </p>
                ) : (
                  filtered.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/10"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-white truncate">{c.user.fullName}</p>
                        <p className="text-xs text-gray-500 font-bold truncate">
                          {ROLE_LABELS[c.role as SystemRole] || c.role}
                          {c.warehouse?.name ? ` · ${c.warehouse.name}` : ''}
                          {' · '}
                          {c.user.login}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={!!savingId}
                        onClick={() => void handleAdd(c.id)}
                        className="shrink-0 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-black disabled:opacity-50"
                      >
                        {savingId === c.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          'Qo‘shish'
                        )}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
