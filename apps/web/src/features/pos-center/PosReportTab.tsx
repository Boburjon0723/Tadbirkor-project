'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  ShoppingCart,
  Package,
  Banknote,
  CreditCard,
  AlertTriangle,
  DollarSign,
  Receipt,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { formatSaleAmountMap } from '@/lib/currency';
import { reportsService, type PosReportSummary } from '@/services/reports.service';
import { motion } from 'framer-motion';

const fmt = (v: number) => Math.round(v).toLocaleString();
const fmtUsd = (v: number) => v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

function monthRange(cursor: Date) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  return {
    dateFrom: new Date(year, month, 1).toISOString().slice(0, 10),
    dateTo: new Date(year, month + 1, 0).toISOString().slice(0, 10),
  };
}

function formatMonthTitle(date: Date) {
  return date.toLocaleDateString('uz-UZ', { month: 'long', year: 'numeric' });
}

export function PosReportTab() {
  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const [data, setData] = useState<PosReportSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const range = useMemo(() => monthRange(monthCursor), [monthCursor]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await reportsService.getPosSummary({
          dateFrom: range.dateFrom,
          dateTo: range.dateTo,
        });
        if (!cancelled) setData(res);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [range.dateFrom, range.dateTo]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="animate-spin text-blue-500" size={40} />
        <p className="text-gray-500 text-xs font-black uppercase tracking-widest">Hisobot yuklanmoqda...</p>
      </div>
    );
  }

  if (!data) return null;

  const uzs = {
    net: Number(data.netSales?.UZS || 0),
    gross: Number(data.grossSales?.UZS || 0),
    discount: Number(data.discounts?.UZS || 0),
    cash: Number(data.cashSales?.UZS || 0),
    card: Number(data.cardSales?.UZS || 0),
    credit: Number(data.creditSales?.UZS || 0),
  };

  const usd = {
    net: Number(data.netSales?.USD || 0),
    gross: Number(data.grossSales?.USD || 0),
    discount: Number(data.discounts?.USD || 0),
    cash: Number(data.cashSales?.USD || 0),
    card: Number(data.cardSales?.USD || 0),
    credit: Number(data.creditSales?.USD || 0),
  };

  const hasUsd = usd.net > 0 || usd.cash > 0 || usd.card > 0 || usd.credit > 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() =>
            setMonthCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))
          }
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 font-black capitalize text-sm">
          <CalendarDays size={16} className="text-blue-300" />
          {formatMonthTitle(monthCursor)}
        </div>
        <button
          type="button"
          onClick={() =>
            setMonthCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))
          }
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5"
        >
          <ChevronRight size={16} />
        </button>
        <button
          type="button"
          onClick={() => setMonthCursor(new Date())}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold"
        >
          Hozirgi oy
        </button>
      </div>

      <p className="text-gray-500 text-xs font-bold px-1">
        Manba: yopilgan kassa cheklari (PosSale), {range.dateFrom} — {range.dateTo}. B2B qarz
        daftari kirmaydi.
      </p>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-5 bg-white/[0.03] border border-white/5 rounded-2xl shadow-lg">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400"><Receipt size={18} /></div>
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Cheklar soni</p>
          </div>
          <p className="text-3xl font-black text-white tabular-nums">{data.receiptsCount}</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="p-5 bg-white/[0.03] border border-white/5 rounded-2xl shadow-lg">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400"><Package size={18} /></div>
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Sotilgan dona</p>
          </div>
          <p className="text-3xl font-black text-white tabular-nums">{Math.round(data.itemsSold)}</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="p-5 bg-white/[0.03] border border-white/5 rounded-2xl shadow-lg col-span-2 lg:col-span-1">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400"><AlertTriangle size={18} /></div>
            <p className="text-[9px] font-black uppercase tracking-widest text-gray-500">Ochiq qarzlar (jami)</p>
          </div>
          <p className="text-3xl font-black text-amber-400 tabular-nums">
            {formatSaleAmountMap(data.openReceivablesTotal)}
          </p>
        </motion.div>
      </div>

      <CurrencySection
        title="UZS — O'zbek so'mi"
        currency="UZS"
        values={uzs}
        delay={0.15}
        formatFn={fmt}
      />

      {hasUsd && (
        <CurrencySection
          title="USD — AQSh dollari"
          currency="USD"
          values={usd}
          delay={0.3}
          formatFn={fmtUsd}
        />
      )}
    </div>
  );
}

function CurrencySection({
  title,
  currency,
  values,
  delay,
  formatFn,
}: {
  title: string;
  currency: string;
  values: { net: number; gross: number; discount: number; cash: number; card: number; credit: number };
  delay: number;
  formatFn: (v: number) => string;
}) {
  const colorStyles = currency === 'USD'
    ? { headerBg: 'bg-emerald-500/5 border-emerald-500/10', badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' }
    : { headerBg: 'bg-blue-500/5 border-blue-500/10', badge: 'bg-blue-500/15 text-blue-400 border-blue-500/20' };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={`p-5 md:p-6 rounded-[2rem] border ${colorStyles.headerBg} space-y-5`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${colorStyles.badge}`}>
            {currency === 'USD' ? <DollarSign size={14} /> : <Banknote size={14} />}
          </div>
          <p className="text-sm font-black text-white">{title}</p>
        </div>
        <span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-black border ${colorStyles.badge}`}>{currency}</span>
      </div>

      <div className="p-4 bg-white/[0.03] border border-white/5 rounded-2xl">
        <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Sof savdo</p>
        <p className="text-2xl md:text-3xl font-black text-white tabular-nums">
          {formatFn(values.net)} <span className="text-sm text-gray-500">{currency}</span>
        </p>
        {values.discount > 0 && (
          <p className="text-[10px] text-gray-500 mt-1">
            Chegirma: <span className="text-amber-400">-{formatFn(values.discount)}</span> · Yalpi: {formatFn(values.gross)}
          </p>
        )}
      </div>

      <div className="grid gap-3 grid-cols-3">
        <div className="p-4 bg-white/[0.03] border border-white/5 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <Banknote size={14} className="text-emerald-400" />
            <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Naqd</p>
          </div>
          <p className="text-lg font-black text-emerald-400 tabular-nums">{formatFn(values.cash)}</p>
        </div>
        <div className="p-4 bg-white/[0.03] border border-white/5 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard size={14} className="text-blue-400" />
            <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Karta</p>
          </div>
          <p className="text-lg font-black text-blue-400 tabular-nums">{formatFn(values.card)}</p>
        </div>
        <div className="p-4 bg-white/[0.03] border border-white/5 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <ShoppingCart size={14} className="text-amber-400" />
            <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Nasiya</p>
          </div>
          <p className="text-lg font-black text-amber-400 tabular-nums">{formatFn(values.credit)}</p>
        </div>
      </div>
    </motion.div>
  );
}
