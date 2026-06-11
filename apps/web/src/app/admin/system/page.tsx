'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Server, RefreshCw } from 'lucide-react';
import { platformService } from '@/services/platform.service';

export default function AdminSystemPage() {
  const { data: redis, isLoading: redisLoading, refetch: refetchRedis } = useQuery({
    queryKey: ['platform-redis-health'],
    queryFn: () => platformService.getRedisHealth(),
  });

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['platform-stats'],
    queryFn: () => platformService.getStats(),
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <Server className="text-indigo-400" size={28} />
            Tizim holati
          </h1>
          <p className="text-neutral-400 text-sm mt-1">Redis kesh va platforma statistikasi</p>
        </div>
        <button
          type="button"
          onClick={() => {
            void refetchRedis();
            void refetchStats();
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-bold text-neutral-300 hover:bg-white/10"
        >
          <RefreshCw size={16} />
          Yangilash
        </button>
      </div>

      <section className="p-6 rounded-2xl border border-white/10 bg-white/[0.02] space-y-4">
        <h2 className="text-sm font-black uppercase tracking-widest text-neutral-500">
          Redis kesh
        </h2>
        {redisLoading ? (
          <Loader2 className="animate-spin text-indigo-400" size={24} />
        ) : redis ? (
          <dl className="grid gap-3 text-sm">
            <div className="flex justify-between gap-4 py-2 border-b border-white/5">
              <dt className="text-neutral-500">Backend</dt>
              <dd className="font-bold">{String(redis.cache?.backend ?? '—')}</dd>
            </div>
            <div className="flex justify-between gap-4 py-2 border-b border-white/5">
              <dt className="text-neutral-500">Redis ulangan</dt>
              <dd className="font-bold">
                {redis.cache?.redisConfigured ? 'Ha' : 'Yo‘q (memory)'}
              </dd>
            </div>
            <div className="flex justify-between gap-4 py-2">
              <dt className="text-neutral-500">PING</dt>
              <dd
                className={`font-bold ${
                  redis.ping === 'PONG' ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {String(redis.ping ?? '—')}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-neutral-500 text-sm">Ma&apos;lumot yo‘q</p>
        )}
      </section>

      <section className="p-6 rounded-2xl border border-white/10 bg-white/[0.02] space-y-4">
        <h2 className="text-sm font-black uppercase tracking-widest text-neutral-500">
          Kompaniyalar
        </h2>
        {statsLoading ? (
          <Loader2 className="animate-spin text-indigo-400" size={24} />
        ) : stats ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Jami', value: stats.total },
              { label: 'Faol', value: stats.active },
              { label: 'Sinov', value: stats.trial },
              { label: 'Tugagan', value: stats.expired },
            ].map((s) => (
              <div key={s.label} className="p-3 rounded-xl bg-black/30 border border-white/5">
                <p className="text-[10px] text-neutral-500 uppercase font-black">{s.label}</p>
                <p className="text-xl font-black mt-1">{s.value}</p>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
