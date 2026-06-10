'use client';

import React from 'react';
import Link from 'next/link';
import { AlertCircle, Loader2, Package, Warehouse } from 'lucide-react';
import { MOBILE_LIST_ITEM, MOBILE_LIST_SURFACE } from '@/lib/mobile-pwa';

type BalanceRow = {
  id: string;
  quantity: unknown;
  reservedQuantity?: unknown;
  blockedQuantity?: unknown;
  warehouse?: { id?: string; name?: string };
  productVariant: {
    id?: string;
    name?: string;
    product?: { name?: string; id?: string };
  };
};

type Group = {
  warehouse: { id?: string; name?: string };
  items: BalanceRow[];
};

type Props = {
  groups: Group[];
  isLoading: boolean;
};

function freeQty(b: BalanceRow) {
  return Math.max(
    0,
    Number(b.quantity) -
      Number(b.reservedQuantity ?? 0) -
      Number(b.blockedQuantity ?? 0),
  );
}

export function WarehouseBalancesMobileList({ groups, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className={`${MOBILE_LIST_SURFACE} py-16 flex flex-col items-center gap-3`}>
        <Loader2 className="animate-spin text-purple-500" size={32} />
        <p className="text-gray-500 text-xs font-bold">Yuklanmoqda...</p>
      </div>
    );
  }

  if (!groups.length) {
    return (
      <div className={`${MOBILE_LIST_SURFACE} py-16 text-center text-gray-500 font-bold text-sm`}>
        Hali qoldiqlar mavjud emas
      </div>
    );
  }

  return (
    <div className={MOBILE_LIST_SURFACE}>
      {groups.map((group, groupIdx) => (
        <section key={group.warehouse?.id || `g-${groupIdx}`}>
          <div className="flex items-center gap-2 px-4 py-3 bg-white/[0.02] border-b border-white/5">
            <Warehouse size={16} className="text-blue-400 shrink-0" />
            <h3 className="font-black text-sm text-blue-400 uppercase tracking-widest truncate">
              {group.warehouse?.name || "Noma'lum ombor"}
            </h3>
            <span className="ml-auto text-[10px] font-black text-gray-500 uppercase">
              {group.items.length} ta
            </span>
          </div>

          <div className="divide-y divide-white/5">
            {group.items.map((b) => {
              const free = freeQty(b);
              const low = Number(b.quantity) < 10;
              const productId = b.productVariant?.product?.id;

              return (
                <article key={b.id} className={MOBILE_LIST_ITEM}>
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 shrink-0">
                      <Package size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm leading-tight truncate">
                        {b.productVariant?.product?.name || 'Mahsulot'}
                      </p>
                      <p className="text-[10px] text-gray-500 font-bold uppercase truncate mt-0.5">
                        {b.productVariant?.name}
                      </p>
                    </div>
                    {low && (
                      <span className="shrink-0 flex items-center gap-1 text-[9px] font-black uppercase text-red-400 bg-red-400/10 px-2 py-1 rounded-full">
                        <AlertCircle size={10} />
                        Kam
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-4 gap-2 mt-4">
                    <div className="text-center p-2 rounded-xl bg-white/[0.03]">
                      <p className="text-[9px] font-black text-gray-500 uppercase">Jami</p>
                      <p className="font-black text-lg mt-0.5">{Number(b.quantity)}</p>
                    </div>
                    <div className="text-center p-2 rounded-xl bg-amber-500/5">
                      <p className="text-[9px] font-black text-gray-500 uppercase">Rezerv</p>
                      <p className="font-black text-lg mt-0.5 text-amber-400">
                        {Number(b.reservedQuantity ?? 0)}
                      </p>
                    </div>
                    <div className="text-center p-2 rounded-xl bg-white/[0.03]">
                      <p className="text-[9px] font-black text-gray-500 uppercase">Blok</p>
                      <p className="font-black text-lg mt-0.5 text-gray-400">
                        {Number(b.blockedQuantity ?? 0)}
                      </p>
                    </div>
                    <div className="text-center p-2 rounded-xl bg-emerald-500/5">
                      <p className="text-[9px] font-black text-gray-500 uppercase">Erkin</p>
                      <p
                        className={`font-black text-lg mt-0.5 ${
                          free < 10 ? 'text-red-400' : 'text-emerald-400'
                        }`}
                      >
                        {free}
                      </p>
                    </div>
                  </div>

                  {productId && (
                    <Link
                      href={`/dashboard/inventory/${productId}`}
                      className="mt-3 block text-center text-xs font-bold text-blue-400 py-2 rounded-xl bg-blue-500/10 active:scale-[0.98] transition-transform"
                    >
                      Mahsulot kartasi
                    </Link>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
