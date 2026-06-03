'use client';

import React from 'react';
import { Percent } from 'lucide-react';
import type { ReportStatCard } from './reports-types';

type Props = {
  stats: ReportStatCard[] | null;
  loading: boolean;
};

export function ReportsStatsCards({ stats, loading }: Props) {
  if (!loading && stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {stats.map((s) => (
          <div
            key={s.key}
            className={`p-6 rounded-[2rem] bg-white/[0.02] border border-white/5 ring-1 ${s.ring} space-y-5`}
          >
            <div className="flex items-start justify-between">
              <div
                className={`w-12 h-12 ${s.bg} rounded-2xl flex items-center justify-center ${s.color} border border-white/5`}
              >
                <s.icon size={20} />
              </div>
              {s.key === 'profit' && s.margin && (
                <div className="flex flex-col items-end gap-1">
                  {s.margin.UZS !== 0 && (
                    <span className="text-[10px] font-black px-2 py-1 rounded-lg bg-blue-500/10 text-blue-300 inline-flex items-center gap-1">
                      <Percent size={10} />
                      {s.margin.UZS.toFixed(1)} UZS
                    </span>
                  )}
                  {s.margin.USD !== 0 && (
                    <span className="text-[10px] font-black px-2 py-1 rounded-lg bg-blue-500/10 text-blue-300 inline-flex items-center gap-1">
                      <Percent size={10} />
                      {s.margin.USD.toFixed(1)} USD
                    </span>
                  )}
                </div>
              )}
            </div>
            <div>
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{s.label}</p>
              <p className="text-[10px] text-gray-600 mt-1">{s.sub}</p>
            </div>
            <div className="space-y-1">
              <p
                className={`text-2xl font-black ${
                  s.key === 'profit' && s.value.UZS < 0 ? 'text-rose-400' : 'text-white'
                }`}
              >
                {s.format(s.value.UZS, 'UZS')}
              </p>
              <p
                className={`text-sm font-bold ${
                  s.key === 'profit' && s.value.USD < 0 ? 'text-rose-400' : 'text-gray-400'
                }`}
              >
                {s.format(s.value.USD, 'USD')}
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (loading && !stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="p-6 rounded-[2rem] bg-white/[0.02] border border-white/5 animate-pulse h-44"
          />
        ))}
      </div>
    );
  }

  return null;
}
