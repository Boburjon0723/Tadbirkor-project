'use client';

import React, { useState } from 'react';
import { User, UserPlus, X, Loader2 } from 'lucide-react';
import { retailCustomersService } from '@/services/retail-customers.service';
import {
  usePosCustomerPicker,
  usePrefetchPosCustomers,
} from '@/hooks/pos/use-pos-customer-picker';
import { toast } from '@/lib/toast';

export type PosCustomerSelection = {
  retailCustomerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
};

type Props = {
  value: PosCustomerSelection;
  onChange: (v: PosCustomerSelection) => void;
};

export function PosCustomerStrip({ value, onChange }: Props) {
  const [query, setQuery] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showQuick, setShowQuick] = useState(false);
  const [quickPhone, setQuickPhone] = useState('');
  const prefetchRecent = usePrefetchPosCustomers();
  const { data: results = [], isFetching } = usePosCustomerPicker(
    pickerOpen ? query : '',
  );

  const label =
    value.customerName ||
    (value.retailCustomerId ? 'Mijoz tanlangan' : 'Mehmon');

  const clear = () => {
    onChange({ retailCustomerId: null, customerName: null, customerPhone: null });
    setQuery('');
    setPickerOpen(false);
    setShowQuick(false);
  };

  const pick = (c: { id: string; name: string; phone?: string | null }) => {
    onChange({
      retailCustomerId: c.id,
      customerName: c.name,
      customerPhone: c.phone || null,
    });
    setQuery('');
    setPickerOpen(false);
    setShowQuick(false);
  };

  const quickAdd = async () => {
    const name = query.trim();
    if (!name) return;
    try {
      const created = await retailCustomersService.create({
        name,
        phone: quickPhone.trim() || undefined,
      });
      pick(created);
      toast.success(`${created.name} qo‘shildi`);
    } catch {
      toast.error('Mijoz qo‘shishda xato');
    }
  };

  const showList = pickerOpen && results.length > 0;
  const showRecentLabel = pickerOpen && !query.trim() && results.length > 0;

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-3 space-y-2">
      <div className="flex items-center gap-2">
        <User size={16} className="text-blue-400 shrink-0" />
        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
          Mijoz
        </span>
        <span className="text-sm font-bold text-white truncate flex-1">{label}</span>
        {(value.retailCustomerId || value.customerName) && (
          <button
            type="button"
            onClick={clear}
            className="p-1 rounded-lg hover:bg-white/10 text-gray-500"
            aria-label="Tozalash"
          >
            <X size={14} />
          </button>
        )}
      </div>
      <input
        value={query}
        onFocus={() => {
          setPickerOpen(true);
          prefetchRecent();
        }}
        onBlur={() => {
          window.setTimeout(() => setPickerOpen(false), 150);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setPickerOpen(true);
          if (!value.retailCustomerId) {
            onChange({
              retailCustomerId: null,
              customerName: e.target.value.trim() || null,
              customerPhone: value.customerPhone,
            });
          }
        }}
        placeholder="Ism yoki telefon qidirish..."
        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-blue-500/50"
      />
      {pickerOpen && isFetching && (
        <div className="flex justify-center py-1">
          <Loader2 className="animate-spin text-blue-500" size={16} />
        </div>
      )}
      {showRecentLabel && (
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-600 px-1">
          Oxirgi mijozlar
        </p>
      )}
      {showList && (
        <ul className="max-h-32 overflow-y-auto space-y-1">
          {results.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(c)}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-blue-600/20 text-sm font-bold"
              >
                {c.name}
                {c.phone ? <span className="text-gray-500 ml-2">{c.phone}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
      {pickerOpen && query.trim() && results.length === 0 && !isFetching && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setShowQuick(true)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-600/20 text-blue-300 text-sm font-black"
        >
          <UserPlus size={16} /> &quot;{query.trim()}&quot; ni yangi mijoz qilish
        </button>
      )}
      {showQuick && (
        <div className="flex gap-2">
          <input
            value={quickPhone}
            onChange={(e) => setQuickPhone(e.target.value)}
            placeholder="Telefon (ixtiyoriy)"
            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold"
          />
          <button
            type="button"
            onClick={() => void quickAdd()}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-black"
          >
            Saqlash
          </button>
        </div>
      )}
    </div>
  );
}
