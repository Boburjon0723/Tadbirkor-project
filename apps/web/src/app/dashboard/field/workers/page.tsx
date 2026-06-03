'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { fieldService } from '@/services/field.service';

export default function FieldWorkersPage() {
  const [data, setData] = useState<any>({ stocks: [], workers: [] });
  const [kpi, setKpi] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    Promise.all([fieldService.workerBalances(), fieldService.kpi()])
      .then(([bal, k]) => {
        setData(bal);
        setKpi(k);
      })
      .catch((err: unknown) => {
        const ax = err as { response?: { data?: { message?: string | string[] }; status?: number } };
        const msg = ax?.response?.data?.message;
        const text = Array.isArray(msg) ? msg.join(', ') : msg;
        if (ax?.response?.status === 403) {
          setError(text || 'Ushbu sahifani ko‘rish uchun ruxsat yo‘q (Egasi yoki Menejer bilan kiring).');
        } else {
          setError(text || 'Ma’lumotlarni yuklab bo‘lmadi.');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="py-24 flex justify-center">
        <Loader2 className="animate-spin text-cyan-500" size={40} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 pb-20">
        <Link href="/dashboard/field" className="inline-flex items-center gap-2 text-gray-400 font-bold text-sm">
          <ArrowLeft size={18} /> Orqaga
        </Link>
        <p className="text-red-400 font-bold">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <Link href="/dashboard/field" className="inline-flex items-center gap-2 text-gray-400 font-bold text-sm">
        <ArrowLeft size={18} /> Orqaga
      </Link>
      <h1 className="text-3xl font-black">Ishchi balansi va KPI</h1>
      {kpi?.workers?.length > 0 && (
        <div className="grid gap-3">
          {kpi.workers.map((w: any) => (
            <div key={w.userId} className="p-4 rounded-2xl bg-white/5 border border-white/10">
              <p className="font-black">{w.name}</p>
              <p className="text-xs text-gray-500 mt-1">
                Vazifalar: {w.approved} · O‘rnatildi: {w.usedQty} · Qaytdi: {w.returnedQty}
              </p>
            </div>
          ))}
        </div>
      )}
      <h2 className="font-black text-lg">Qo‘ldagi tovarlar</h2>
      <div className="space-y-2">
        {(data.stocks || []).map((s: any) => (
          <div key={s.id} className="p-3 rounded-xl bg-white/5 border border-white/5 text-sm">
            <span className="font-bold">{s.user?.fullName}</span>
            <span className="text-gray-500"> — {s.productVariant?.product?.name}: </span>
            <span className="text-cyan-400 font-black">{s.quantity}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
