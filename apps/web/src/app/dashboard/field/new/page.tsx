'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react';
import { fieldService } from '@/services/field.service';
import { usersService } from '@/services/users.service';
import { useWarehouses, useStockBalances } from '@/hooks/warehouse/use-warehouse';
import { useProducts } from '@/hooks/products/use-products';
import { useRouter } from 'next/navigation';
import { toast, formatApiError } from '@/lib/toast';

type ItemRow = { variantId: string; qty: number };

type VariantOption = {
  variantId: string;
  label: string;
  quantity: number;
};

export default function NewFieldTaskPage() {
  const router = useRouter();
  const { data: warehouses } = useWarehouses();
  const [workers, setWorkers] = useState<any[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const { data: balances, isLoading: balancesLoading, isError: balancesError } = useStockBalances(
    warehouseId ? { warehouseId } : undefined,
  );
  const { data: products, isLoading: productsLoading } = useProducts();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    assigneeId: '',
    title: '',
    description: '',
    customerName: '',
    customerPhone: '',
    address: '',
  });
  const [items, setItems] = useState<ItemRow[]>([{ variantId: '', qty: 1 }]);

  useEffect(() => {
    usersService.getCompanyUsers().then((data) => {
      const list = Array.isArray(data) ? data : [];
      setWorkers(list.filter((m: any) => m.role === 'FIELD_WORKER'));
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouseId || !form.assigneeId) {
      toast.error('Ombor va xodim tanlang');
      return;
    }
    const plannedItems = items.filter((i) => i.variantId && i.qty > 0);
    if (!plannedItems.length) {
      toast.error('Kamida bitta mahsulot qatori kerak');
      return;
    }
    setSubmitting(true);
    try {
      await fieldService.createTask({
        ...form,
        sourceWarehouseId: warehouseId,
        plannedItems,
      });
      router.push('/dashboard/field');
    } catch (err: any) {
      toast.error(formatApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const variantOptions: VariantOption[] = useMemo(() => {
    if (!warehouseId) return [];

    const byVariant = new Map<string, VariantOption>();

    for (const b of balances || []) {
      const qty = Number(b.quantity) || 0;
      if (qty <= 0) continue;
      const name = b.productVariant?.product?.name || 'Mahsulot';
      const sku = b.productVariant?.sku;
      byVariant.set(b.productVariantId, {
        variantId: b.productVariantId,
        label: sku ? `${name} · ${sku} (${qty})` : `${name} (${qty})`,
        quantity: qty,
      });
    }

    for (const p of products || []) {
      for (const v of p.variants || []) {
        if (byVariant.has(v.id)) continue;
        const bal = (v.stockBalances || []).find((sb: any) => sb.warehouseId === warehouseId);
        const qty = bal ? Number(bal.quantity) : 0;
        if (qty <= 0) continue;
        byVariant.set(v.id, {
          variantId: v.id,
          label: v.sku ? `${p.name} · ${v.sku} (${qty})` : `${p.name} (${qty})`,
          quantity: qty,
        });
      }
    }

    return Array.from(byVariant.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [warehouseId, balances, products]);

  const stockLoading = Boolean(warehouseId) && (balancesLoading || productsLoading);
  const warehouseName = (warehouses || []).find((w: any) => w.id === warehouseId)?.name;

  return (
    <div className="max-w-3xl space-y-8 pb-20">
      <Link href="/dashboard/field" className="inline-flex items-center gap-2 text-gray-400 hover:text-white font-bold text-sm">
        <ArrowLeft size={18} /> Orqaga
      </Link>
      <h1 className="text-3xl font-black">Yangi dala vazifasi</h1>
      <form onSubmit={handleSubmit} className="space-y-5 glass-card p-8 rounded-3xl border border-white/5">
        <div>
          <label className="text-xs font-black text-gray-500 uppercase">Ombor</label>
          <select required className="mt-2 w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 font-bold" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
            <option value="">Tanlang</option>
            {(warehouses || []).map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-black text-gray-500 uppercase">Dala xodimi</label>
          <select required className="mt-2 w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 font-bold" value={form.assigneeId} onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}>
            <option value="">Tanlang</option>
            {workers.map((w: any) => <option key={w.id} value={w.user.id}>{w.user.fullName}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-black text-gray-500 uppercase">Vazifa nomi</label>
          <input required className="mt-2 w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 font-bold text-white" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        {warehouseId && (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm">
            {stockLoading ? (
              <p className="text-gray-500 flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" /> Mahsulotlar yuklanmoqda…
              </p>
            ) : balancesError ? (
              <p className="text-amber-400">
                Ombor qoldig‘ini yuklab bo‘lmadi. Ombor ruxsatingizni tekshiring yoki sahifani yangilang.
              </p>
            ) : variantOptions.length === 0 ? (
              <p className="text-gray-400">
                <strong className="text-white">{warehouseName || 'Tanlangan ombor'}</strong> da qoldiq yo‘q.
                Avval{' '}
                <Link href="/dashboard/inventory" className="text-cyan-400 underline">
                  Ombor → kirim
                </Link>{' '}
                qiling, keyin vazifaga biriktiring.
              </p>
            ) : (
              <p className="text-gray-500">
                {variantOptions.length} ta mahsulot (qoldiq &gt; 0). Qavs ichida — mavjud miqdor.
              </p>
            )}
          </div>
        )}
        {items.map((row, i) => (
          <div key={i} className="flex gap-2">
            <select
              required
              disabled={!warehouseId || variantOptions.length === 0}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm font-bold disabled:opacity-50"
              value={row.variantId}
              onChange={(e) => {
                const n = [...items];
                n[i].variantId = e.target.value;
                setItems(n);
              }}
            >
              <option value="">Mahsulot tanlang</option>
              {variantOptions.map((opt) => (
                <option key={opt.variantId} value={opt.variantId}>
                  {opt.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              max={variantOptions.find((o) => o.variantId === row.variantId)?.quantity || undefined}
              className="w-20 bg-white/5 border border-white/10 rounded-xl px-2 py-2 font-bold"
              value={row.qty}
              onChange={(e) => {
                const n = [...items];
                n[i].qty = Number(e.target.value);
                setItems(n);
              }}
            />
            {items.length > 1 && (
              <button
                type="button"
                onClick={() => setItems(items.filter((_, idx) => idx !== i))}
                className="p-2 text-red-400"
                aria-label="Qatorni o‘chirish"
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>
        ))}
        <button type="button" onClick={() => setItems([...items, { variantId: '', qty: 1 }])} className="text-cyan-400 font-bold text-sm flex items-center gap-1"><Plus size={16} /> Qator</button>
        <button type="submit" disabled={submitting} className="w-full py-4 bg-cyan-600 rounded-2xl font-black flex justify-center gap-2 text-white">
          {submitting ? <Loader2 className="animate-spin" /> : 'Biriktirish'}
        </button>
      </form>
    </div>
  );
}






