'use client';

import React, { useMemo, useState } from 'react';
import { Search, User, Check, Loader2, X } from 'lucide-react';
import { usePartnerLedgerContactsSelect } from '@/hooks/partner-ledger/use-partner-ledger';

type ContactRow = {
  id: string;
  name: string;
  phone?: string | null;
  tag?: string | null;
  side: string;
};

type Props = {
  value: string;
  onChange: (contactId: string) => void;
  disabled?: boolean;
  hint?: string;
  /** Import modal kabi tor joylar uchun */
  compact?: boolean;
};

function sideLabel(side: string) {
  if (side === 'we_owe') return 'biz qarzdormiz';
  if (side === 'they_owe') return 'ular qarzdor';
  return null;
}

export function PartnerLedgerContactSelect({
  value,
  onChange,
  disabled,
  hint,
  compact,
}: Props) {
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<ContactRow | null>(null);
  const { data: contacts = [], isPending } = usePartnerLedgerContactsSelect(search);

  const selected = useMemo(() => {
    if (!value) return null;
    return contacts.find((c) => c.id === value) ?? (picked?.id === value ? picked : null);
  }, [contacts, value, picked]);

  const pick = (id: string) => {
    if (disabled) return;
    if (!id) {
      setPicked(null);
      onChange('');
      return;
    }
    const row = contacts.find((c) => c.id === id);
    if (row) setPicked(row);
    onChange(id);
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
          <User size={14} className="text-blue-400" />
          Hamkor (ixtiyoriy)
        </label>
        {hint ? (
          <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{hint}</p>
        ) : null}
      </div>

      <div className="relative">
        <Search
          size={16}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Ism yoki telefon bo‘yicha qidirish..."
          disabled={disabled}
          className="w-full pl-11 pr-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-2xl text-sm text-white placeholder:text-gray-600 outline-none focus:border-blue-500/50 disabled:opacity-50"
        />
      </div>

      <div
        className={`rounded-2xl border border-white/10 bg-[#0a0a0a] overflow-hidden ${
          compact ? 'max-h-[200px]' : 'max-h-[240px]'
        } flex flex-col`}
      >
        {isPending ? (
          <div className="py-10 flex justify-center">
            <Loader2 className="animate-spin text-blue-500" size={24} />
          </div>
        ) : (
          <ul className="overflow-y-auto custom-scrollbar divide-y divide-white/5">
            <li>
              <button
                type="button"
                disabled={disabled}
                onClick={() => pick('')}
                className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                  !value
                    ? 'bg-blue-600/15 border-l-2 border-l-blue-500'
                    : 'hover:bg-white/5'
                } disabled:opacity-50`}
              >
                <span
                  className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                    !value ? 'border-blue-500 bg-blue-600' : 'border-white/20'
                  }`}
                >
                  {!value ? <Check size={12} className="text-white" /> : null}
                </span>
                <span className="text-sm font-bold text-gray-400">Hamkor tanlanmagan</span>
              </button>
            </li>
            {contacts.map((c: ContactRow) => {
              const active = value === c.id;
              const side = sideLabel(c.side);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => pick(c.id)}
                    className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors ${
                      active
                        ? 'bg-blue-600/15 border-l-2 border-l-blue-500'
                        : 'hover:bg-white/5'
                    } disabled:opacity-50`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                        active ? 'border-blue-500 bg-blue-600' : 'border-white/20'
                      }`}
                    >
                      {active ? <Check size={12} className="text-white" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="text-sm font-black text-white block truncate">{c.name}</span>
                      <span className="text-xs text-gray-500 block truncate">
                        {c.phone || 'Telefon yo‘q'}
                        {c.tag ? ` · ${c.tag}` : ''}
                      </span>
                      {side ? (
                        <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wide">
                          {side}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
            {contacts.length === 0 && search.trim() ? (
              <li className="px-4 py-6 text-center text-sm text-gray-500 font-medium">
                Qidiruv bo‘yicha hamkor topilmadi
              </li>
            ) : null}
            {contacts.length === 0 && !search.trim() ? (
              <li className="px-4 py-6 text-center text-sm text-gray-500 font-medium">
                Hamkor daftarida kontakt yo‘q. Avval «Hamkor daftari» bo‘limida qo‘shing.
              </li>
            ) : null}
          </ul>
        )}
      </div>

      {value && selected ? (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-blue-500/10 border border-blue-500/25">
          <p className="text-xs text-blue-300 font-bold min-w-0 truncate">
            Tanlangan: <span className="text-white">{selected.name}</span>
            {selected.phone ? ` · ${selected.phone}` : ''}
          </p>
          <button
            type="button"
            disabled={disabled}
            onClick={() => pick('')}
            className="shrink-0 p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white"
            title="Tanlovni bekor qilish"
          >
            <X size={16} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
