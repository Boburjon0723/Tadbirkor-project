'use client';

import React from 'react';
import { CalendarRange, Warehouse as WarehouseIcon, ChevronDown, Loader2 } from 'lucide-react';
import { todayStr } from './reports-types';

type Props = {
  dateFrom: string;
  dateTo: string;
  warehouseId: string;
  warehouses: any[] | undefined;
  selectedWarehouseName: string;
  whDropdownOpen: boolean;
  isFetching: boolean;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onWarehouseIdChange: (id: string) => void;
  onWhDropdownToggle: () => void;
  onWhDropdownClose: () => void;
  onApply: () => void;
};

export function ReportsFilterBar({
  dateFrom,
  dateTo,
  warehouseId,
  warehouses,
  selectedWarehouseName,
  whDropdownOpen,
  isFetching,
  onDateFromChange,
  onDateToChange,
  onWarehouseIdChange,
  onWhDropdownToggle,
  onWhDropdownClose,
  onApply,
}: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-white/[0.02] border border-white/5 rounded-3xl">
      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
          <CalendarRange size={12} /> Boshlanish
        </label>
        <input
          type="date"
          value={dateFrom}
          max={dateTo || todayStr()}
          onChange={(e) => onDateFromChange(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm font-bold text-white outline-none focus:border-blue-500/50 transition-all"
        />
      </div>
      <div className="space-y-2">
        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
          <CalendarRange size={12} /> Tugash
        </label>
        <input
          type="date"
          value={dateTo}
          min={dateFrom || undefined}
          max={todayStr()}
          onChange={(e) => onDateToChange(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm font-bold text-white outline-none focus:border-blue-500/50 transition-all"
        />
      </div>
      <div className="space-y-2 relative">
        <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
          <WarehouseIcon size={12} /> Ombor
        </label>
        <button
          type="button"
          onClick={onWhDropdownToggle}
          className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm font-bold text-white outline-none focus:border-blue-500/50 transition-all flex items-center justify-between text-left"
        >
          <span>{selectedWarehouseName}</span>
          <ChevronDown
            size={16}
            className={`text-gray-500 transition-transform ${whDropdownOpen ? 'rotate-180' : ''}`}
          />
        </button>
        {whDropdownOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={onWhDropdownClose} aria-hidden />
            <div className="absolute top-full left-0 right-0 mt-2 bg-[#121212] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50">
              <div className="max-h-60 overflow-y-auto p-1">
                <button
                  type="button"
                  onClick={() => onWarehouseIdChange('')}
                  className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${
                    !warehouseId ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-white/5'
                  }`}
                >
                  Hamma omborlar
                </button>
                {warehouses?.map((w: any) => (
                  <button
                    type="button"
                    key={w.id}
                    onClick={() => onWarehouseIdChange(w.id)}
                    className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${
                      warehouseId === w.id ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-white/5'
                    }`}
                  >
                    {w.name}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      <button
        type="button"
        onClick={onApply}
        disabled={isFetching}
        className="md:self-end px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-black transition-all disabled:opacity-50"
      >
        {isFetching ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="animate-spin" size={14} /> Yuklanmoqda...
          </span>
        ) : (
          'Filtrlash'
        )}
      </button>
    </div>
  );
}
