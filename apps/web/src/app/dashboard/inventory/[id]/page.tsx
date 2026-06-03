'use client';

import React from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useProduct } from '@/hooks/products/use-products';
import { ArrowLeft, Package, Layers, Barcode, Boxes, Loader2 } from 'lucide-react';
import { formatStockQuantity } from '@/lib/product-units';

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const warehouseId = searchParams.get('warehouseId') || '';

  const { data: product, isLoading, isError } = useProduct(id, warehouseId || undefined);

  if (isLoading) {
    return (
      <div className="p-20 text-center flex flex-col items-center gap-4 text-gray-400">
        <Loader2 className="animate-spin" size={32} />
        Yuklanmoqda...
      </div>
    );
  }
  if (isError || !product) {
    return <div className="p-20 text-center text-red-500">Mahsulot topilmadi</div>;
  }

  const formatMoney = (value: number) => {
    return new Intl.NumberFormat('uz-UZ').format(value) + ' so‘m';
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
        <button
          onClick={() => router.back()}
          className="w-fit p-3 md:p-4 bg-white/5 border border-white/10 rounded-xl md:rounded-2xl hover:bg-white/10 transition-all text-gray-400 hover:text-white"
        >
          <ArrowLeft size={20} className="md:w-6 md:h-6" />
        </button>
        <div>
          <h1 className="text-2xl md:text-3xl font-black">{product.name}</h1>
          <p className="text-gray-400 text-sm md:text-base">
            {product.category?.name || 'Kategoriyasiz'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="glass-card p-8 rounded-[2.5rem] border border-white/5 bg-white/[0.02]">
            <h3 className="text-xl font-black mb-6 flex items-center gap-3">
              <div className="w-1.5 h-6 bg-blue-500 rounded-full" />
              Variantlar va Qoldiqlar
            </h3>

            <div className="space-y-4">
              {product.variants?.map((v: any) => {
                const stock =
                  v.stockBalances?.reduce(
                    (sum: number, b: any) => sum + Number(b.quantity),
                    0,
                  ) || 0;
                return (
                  <div
                    key={v.id}
                    className="p-6 bg-white/5 border border-white/10 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-6 group hover:border-blue-500/30 transition-all"
                  >
                    <div className="flex items-center gap-4 md:gap-5">
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
                        <Boxes size={20} className="md:w-6 md:h-6" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-base md:text-lg truncate">{v.name}</p>
                        <div className="flex flex-wrap items-center gap-3 mt-1">
                          <span className="text-[10px] md:text-xs text-gray-500 flex items-center gap-1">
                            <Layers size={10} className="md:w-3 md:h-3" /> {v.sku || "SKU yo'q"}
                          </span>
                          <span className="text-[10px] md:text-xs text-gray-500 flex items-center gap-1">
                            <Barcode size={10} className="md:w-3 md:h-3" />{' '}
                            {v.barcode || 'Barkod yo‘q'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-6 md:gap-10">
                      <div className="text-center md:text-right">
                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">
                          Qoldiq
                        </p>
                        <p className="text-xl md:text-2xl font-black text-emerald-400">
                          {formatStockQuantity(stock, product.unit)}
                        </p>
                      </div>
                      <div className="text-center md:text-right">
                        <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-1">
                          Sotuv Narxi
                        </p>
                        <p className="text-lg md:text-xl font-black">
                          {formatMoney(Number(v.salePrice))}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-card p-6 rounded-[2rem] border border-white/5">
            <div className="flex items-center gap-3 mb-4">
              <Package className="text-blue-400" size={20} />
              <h4 className="font-black">Mahsulot</h4>
            </div>
            {product.description ? (
              <p className="text-sm text-gray-400 leading-relaxed">{product.description}</p>
            ) : (
              <p className="text-sm text-gray-600">Tavsif kiritilmagan</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
