'use client';

import React, { useState } from 'react';
import { Loader2, UserPlus } from 'lucide-react';
import { MobileFormShell } from '@/components/mobile/MobileFormShell';

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { name: string; phone?: string; tag?: string }) => Promise<void>;
  busy?: boolean;
};

export function AddPartnerLedgerContactModal({ open, onClose, onSubmit, busy }: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [tag, setTag] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await onSubmit({
      name: name.trim(),
      phone: phone.trim() || undefined,
      tag: tag.trim() || undefined,
    });
    setName('');
    setPhone('');
    setTag('');
  };

  return (
    <MobileFormShell
      open={open}
      onClose={onClose}
      maxWidth="md"
      zIndex={200}
      icon={
        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white">
          <UserPlus size={20} />
        </div>
      }
      title="Hamkor qo‘shish"
      footer={
        <button
          type="submit"
          form="add-partner-ledger-contact"
          disabled={busy}
          className="w-full py-3.5 rounded-xl bg-white text-gray-900 font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {busy && <Loader2 className="animate-spin" size={16} />}
          Saqlash
        </button>
      }
    >
      <form id="add-partner-ledger-contact" onSubmit={handleSubmit} className="space-y-3">
        <input
          placeholder="Ism *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 font-bold"
          required
        />
        <input
          placeholder="Telefon"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 font-bold"
        />
        <input
          placeholder="Teg (masalan: kraskachi)"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 font-bold"
        />
      </form>
    </MobileFormShell>
  );
}
