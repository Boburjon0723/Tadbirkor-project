'use client';

import React from 'react';
import { Loader2, LineChart as LineChartIcon } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import { formatSaleAmount } from '@/lib/currency';
import { compactNumber } from './reports-types';

type ChartPoint = {
  date: string;
  Kirim: number;
  Sotuv: number;
  Foyda: number;
};

type Props = {
  loading: boolean;
  chartData: ChartPoint[];
  chartCurrency: 'UZS' | 'USD';
  onChartCurrencyChange: (c: 'UZS' | 'USD') => void;
};

export function ReportsDailyChart({
  loading,
  chartData,
  chartCurrency,
  onChartCurrencyChange,
}: Props) {
  const hasChartData = chartData.some((d) => d.Kirim || d.Sotuv);

  return (
    <div className="p-6 rounded-[2rem] bg-white/[0.02] border border-white/5 space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-500/10 text-purple-400 rounded-2xl flex items-center justify-center border border-white/5">
            <LineChartIcon size={18} />
          </div>
          <div>
            <h3 className="font-black text-lg">Kunlik dinamika</h3>
            <p className="text-[11px] text-gray-500">Sana bo‘yicha kirim, sotuv va foyda</p>
          </div>
        </div>
        <div className="inline-flex p-1 rounded-2xl bg-white/5 border border-white/5">
          {(['UZS', 'USD'] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChartCurrencyChange(c)}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                chartCurrency === c
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {loading && chartData.length === 0 ? (
        <div className="h-80 flex items-center justify-center text-gray-500">
          <Loader2 className="animate-spin" size={28} />
        </div>
      ) : !hasChartData ? (
        <div className="h-72 flex flex-col items-center justify-center text-gray-500 gap-3">
          <LineChartIcon size={36} className="opacity-50" />
          <p className="text-sm font-bold">Tanlangan davrda harakat yo‘q</p>
          <p className="text-[11px]">Boshqa davrni yoki omborni tanlab ko‘ring</p>
        </div>
      ) : (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
              <XAxis dataKey="date" stroke="#9ca3af" fontSize={11} />
              <YAxis stroke="#9ca3af" fontSize={11} tickFormatter={(v) => compactNumber(Number(v))} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0a0a0a',
                  border: '1px solid #ffffff20',
                  borderRadius: '12px',
                  fontSize: '12px',
                }}
                labelStyle={{ color: '#fff', fontWeight: 700 }}
                formatter={(value: any) =>
                  formatSaleAmount(Number(value ?? 0), chartCurrency) as any
                }
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="Kirim" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="Sotuv" stroke="#10b981" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="Foyda" stroke="#3b82f6" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
