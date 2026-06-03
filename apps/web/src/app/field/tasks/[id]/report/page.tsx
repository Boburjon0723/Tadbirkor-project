'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { fieldService } from '@/services/field.service';
import { toast, formatApiError } from '@/lib/toast';

type Row = {
  variantId: string;
  label: string;
  plannedQty: number;
  usedQty: number;
  returnedQty: number;
  lostQty: number;
};

export default function FieldReportPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [task, setTask] = useState<any>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fieldService.myTask(id!).then((t) => {
      setTask(t);
      const planned = Array.isArray(t.plannedItems) ? t.plannedItems : [];
      setRows(
        planned.map((p: any) => ({
          variantId: p.variantId,
          label: p.label || 'Mahsulot',
          plannedQty: Number(p.qty) || 0,
          usedQty: 0,
          returnedQty: Number(p.qty) || 0,
          lostQty: 0,
        })),
      );
    });
  }, [id]);

  const patchRow = (index: number, patch: Partial<Row>) => {
    setRows((prev) => {
      const next = [...prev];
      const row = { ...next[index], ...patch };
      if ('usedQty' in patch || 'lostQty' in patch) {
        row.returnedQty = Math.max(0, row.plannedQty - row.usedQty - row.lostQty);
      }
      next[index] = row;
      return next;
    });
  };

  const submit = async () => {
    for (const row of rows) {
      const total = row.usedQty + row.returnedQty + row.lostQty;
      if (total !== row.plannedQty) {
        toast.error(
          `${row.label}: jami ${total} bo‘lishi kerak (reja: ${row.plannedQty}). O‘rnatilgan + qaytarilgan + yo‘qolgan = ${row.plannedQty}`,
        );
        return;
      }
    }

    setBusy(true);
    let gpsLat: number | undefined;
    let gpsLng: number | undefined;
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 }),
      );
      gpsLat = pos.coords.latitude;
      gpsLng = pos.coords.longitude;
    } catch {
      /* GPS ixtiyoriy */
    }
    try {
      await fieldService.submitReport(id!, {
        items: rows.map((r) => ({
          variantId: r.variantId,
          usedQty: r.usedQty,
          returnedQty: r.returnedQty,
          lostQty: r.lostQty,
        })),
        photos: [],
        comment,
        gpsLat,
        gpsLng,
      });
      router.push('/field');
    } catch (e: any) {
      toast.error(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  if (!task) {
    return (
      <div className="py-20 flex justify-center">
        <Loader2 className="animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <Link href={`/field/tasks/${id}`} className="text-cyan-400 text-sm font-bold">
        ← Orqaga
      </Link>
      <div>
        <h1 className="text-xl font-black">Tugatdim</h1>
        <p className="text-sm text-gray-500 mt-1">{task.title}</p>
        <p className="text-xs text-amber-400/90 mt-2">
          Faqat shu vazifaga biriktirilgan mahsulotlar. Boshqa tovarlar ko‘rinmaydi.
        </p>
      </div>

      {rows.map((row, i) => (
        <div key={row.variantId} className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
          <div className="flex justify-between items-start gap-2">
            <p className="font-black text-white">{row.label}</p>
            <span className="text-[10px] font-black text-cyan-400 uppercase shrink-0">
              Reja: {row.plannedQty}
            </span>
          </div>
          <div>
            <label className="text-xs text-gray-400">O‘rnatildi / ishlatildi</label>
            <input
              type="number"
              min={0}
              max={row.plannedQty}
              className="w-full mt-1 bg-black/30 rounded-lg px-3 py-2 font-bold"
              value={row.usedQty}
              onChange={(e) => patchRow(i, { usedQty: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="text-xs text-gray-400">Qaytariladi (qoldi)</label>
            <input
              type="number"
              min={0}
              max={row.plannedQty}
              className="w-full mt-1 bg-black/30 rounded-lg px-3 py-2"
              value={row.returnedQty}
              onChange={(e) => patchRow(i, { returnedQty: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="text-xs text-gray-400">Yo‘qolgan</label>
            <input
              type="number"
              min={0}
              max={row.plannedQty}
              className="w-full mt-1 bg-black/30 rounded-lg px-3 py-2"
              value={row.lostQty}
              onChange={(e) => patchRow(i, { lostQty: Number(e.target.value) })}
            />
          </div>
        </div>
      ))}

      <textarea
        className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm"
        placeholder="Izoh (ixtiyoriy)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <button
        type="button"
        disabled={busy}
        onClick={submit}
        className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-black"
      >
        {busy ? <Loader2 className="animate-spin mx-auto" /> : 'Tugatdim — yuborish'}
      </button>
    </div>
  );
}
