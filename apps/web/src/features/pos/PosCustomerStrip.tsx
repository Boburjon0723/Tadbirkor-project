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
  tone?: 'catalog' | 'cart';
};

export function PosCustomerStrip({ value, onChange, tone = 'catalog' }: Props) {
  const isCart = tone === 'cart';
  const wrap = isCart
    ? 'bg-[var(--pos-cart-card)] border-[var(--pos-cart-border)]'
    : 'bg-[var(--pos-input-bg)] border-[var(--pos-border)]';
  const labelColor = isCart ? 'text-[var(--pos-cart-muted)]' : 'text-[var(--pos-muted)]';
  const textColor = isCart ? 'text-[var(--pos-cart-text)]' : 'text-[var(--pos-text)]';
  const inputBg = isCart
    ? 'bg-[var(--pos-cart-bg)] border-[var(--pos-cart-border)] text-[var(--pos-cart-text)]'
    : 'bg-[var(--pos-input-bg)] border-[var(--pos-border)] text-[var(--pos-text)]';
  const iconColor = isCart ? 'text-cyan-300' : 'text-[var(--pos-accent)]';
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
    <div className={`${wrap} rounded-2xl p-3 space-y-2`}>
      <div className="flex items-center gap-2">
        <User size={16} className={`${iconColor} shrink-0`} />
        <span className={`text-[10px] font-black uppercase tracking-widest ${labelColor}`}>
          Mijoz
        </span>
        <span className={`text-sm font-bold ${textColor} truncate flex-1`}>{label}</span>
        {(value.retailCustomerId || value.customerName) && (
          <button
            type="button"
            onClick={clear}
            className={`p-1 rounded-lg hover:opacity-80 ${labelColor}`}
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
        className={`w-full ${inputBg} rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-[var(--pos-accent)]`}
      />
      {pickerOpen && isFetching && (
        <div className="flex justify-center py-1">
          <Loader2 className="animate-spin text-[var(--pos-accent)]" size={16} />
        </div>
      )}
      {showRecentLabel && (
        <p className={`text-[10px] font-black uppercase tracking-widest ${labelColor} px-1`}>
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
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-[var(--pos-accent)]/20 text-sm font-bold"
              >
                {c.name}
                {c.phone ? <span className={`${labelColor} ml-2`}>{c.phone}</span> : null}
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
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--pos-accent-soft)] text-[var(--pos-accent)] text-sm font-black"
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
            className={`flex-1 ${inputBg} rounded-xl px-3 py-2 text-xs font-bold`}
          />
          <button
            type="button"
            onClick={() => void quickAdd()}
            className="px-4 py-2 rounded-xl bg-[var(--pos-accent)] text-white text-xs font-black"
          >
            Saqlash
          </button>
        </div>
      )}
    </div>
  );
}
