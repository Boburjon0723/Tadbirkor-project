'use client';

import React from 'react';
import { useMyFieldStock } from '@/hooks/field/use-field';
import { PageSkeleton } from '@/components/ui/page-skeleton';

export default function FieldStockPage() {
  const { data: stock = [], isPending } = useMyFieldStock();

  if (isPending && !stock.length) {
    return <PageSkeleton rows={4} />;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black">Mening tovarlarim</h1>
      {stock.length === 0 && <p className="text-gray-500">Qo‘lingizda tovar yo‘q</p>}
      {stock.map((s: any) => (
        <div key={s.id} className="p-4 rounded-2xl bg-white/5 border border-white/10">
          <p className="font-bold">{s.productVariant?.product?.name}</p>
          <p className="text-sm text-gray-500">{s.productVariant?.name}</p>
          <p className="text-cyan-400 font-black mt-2">{s.quantity} dona</p>
        </div>
      ))}
    </div>
  );
}
