'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { partnerLedgerService } from '@/services/partner-ledger.service';
import type { WarehouseIntake } from '@/services/warehouse-intake.service';

type WarehouseOption = { id: string; name: string };

type Props = {
  open: boolean;
  onClose: () => void;
  warehouses: WarehouseOption[];
  defaultWarehouseId?: string;
  onSubmit: (dto: {
    warehouseId: string;
    note?: string;
    partnerLedgerContactId?: string;
  }) => Promise<WarehouseIntake>;
  loading?: boolean;
};

export function CreateIntakeModal({
  open,
  onClose,
  warehouses,
  defaultWarehouseId,
  onSubmit,
  loading,
}: Props) {
  const [warehouseId, setWarehouseId] = useState(defaultWarehouseId || '');
  const [note, setNote] = useState('');
  const [partnerId, setPartnerId] = useState('');
  const [contacts, setContacts] = useState<{ id: string; name: string }[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setWarehouseId(defaultWarehouseId || warehouses[0]?.id || '');
    setNote('');
    setPartnerId('');
  }, [open, defaultWarehouseId, warehouses]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        setContactsLoading(true);
        const rows = await partnerLedgerService.listContactsForSelect();
        if (!cancelled) setContacts(rows || []);
      } catch {
        if (!cancelled) setContacts([]);
      } finally {
        if (!cancelled) setContactsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouseId) return;
    await onSubmit({
      warehouseId,
      note: note.trim() || undefined,
      partnerLedgerContactId: partnerId || undefined,
    });
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-6">
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.form
            onSubmit={handleSubmit}
            className="relative w-full max-w-lg glass-card rounded-3xl p-8 space-y-6"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Yangi ombor kirimi</h2>
                <p className="text-sm text-gray-500 mt-1">Qoralama hujjat ochiladi</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-white/10 text-gray-400"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-white/40">
                Ombor *
              </label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500/50"
                required
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id} className="bg-[#111]">
                    {w.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-white/40">
                Izoh
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm resize-none outline-none focus:border-blue-500/50"
                placeholder="Ixtiyoriy izoh..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-white/40">
                Hamkor daftari (ixtiyoriy)
              </label>
              <select
                value={partnerId}
                onChange={(e) => setPartnerId(e.target.value)}
                disabled={contactsLoading}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-blue-500/50 disabled:opacity-50"
              >
                <option value="" className="bg-[#111]">
                  Tanlanmagan
                </option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#111]">
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-xl border border-white/10 text-sm font-black text-gray-400 hover:bg-white/5"
              >
                Bekor
              </button>
              <button
                type="submit"
                disabled={loading || !warehouseId}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-sm font-black hover:bg-blue-500 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                Boshlash
              </button>
            </div>
          </motion.form>
        </div>
      )}
    </AnimatePresence>
  );
}
