'use client';

import React, { useState } from 'react';
import { Search, ShoppingBag, Loader2, ChevronRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { usePosSales } from '@/hooks/pos/use-pos';
import { posService } from '@/services/pos.service';
import { formatSaleAmount, normalizeSaleCurrency } from '@/lib/currency';
import {
  posPaymentMethodBadgeClass,
  posPaymentMethodLabel,
  primaryPaymentMethod,
} from '@/lib/pos-payment-label';

export function PosSalesHistoryTab() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const { data: sales, isLoading } = usePosSales();

  const { data: saleDetail, isLoading: isDetailLoading } = useQuery({
    queryKey: ['pos-sale', selectedSaleId],
    queryFn: () => posService.findOne(selectedSaleId!),
    enabled: !!selectedSaleId,
  });

  const formatMoney = (value: number, currency?: string) =>
    formatSaleAmount(value, normalizeSaleCurrency(currency));

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'VOIDED':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'DRAFT':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const filteredSales = (sales || []).filter(
    (s: { saleNumber: string; cashier?: { fullName?: string } }) =>
      s.saleNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.cashier?.fullName?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="glass-card p-4 md:p-6 rounded-3xl flex flex-col lg:flex-row gap-4 items-center bg-white/[0.02]">
        <div className="relative flex-1 w-full group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
          <input
            type="text"
            placeholder="Chek raqami yoki kassir..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-blue-500/50 font-bold"
          />
        </div>
      </div>

      <div className="glass-card rounded-3xl p-4 md:p-10 bg-white/[0.01] border border-white/5">
        {isLoading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="animate-spin text-blue-500" size={40} />
          </div>
        ) : filteredSales.length === 0 ? (
          <p className="text-center text-gray-500 font-bold py-16">Sotuv topilmadi</p>
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-[10px] font-black uppercase tracking-widest text-gray-500 text-left">
                    <th className="px-4 pb-2">Chek</th>
                    <th className="px-4 pb-2">Vaqt</th>
                    <th className="px-4 pb-2">Kassir</th>
                    <th className="px-4 pb-2">To&apos;lov</th>
                    <th className="px-4 pb-2">Summa</th>
                    <th className="px-4 pb-2 text-center">Holat</th>
                    <th className="px-4 pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.map((sale: {
                    id: string;
                    saleNumber: string;
                    createdAt: string;
                    cashier?: { fullName?: string };
                    warehouse?: { name?: string };
                    totalAmount: number;
                    currency?: string;
                    status: string;
                    payments?: { method?: string }[];
                  }) => {
                    const payMethod = primaryPaymentMethod(sale.payments);
                    return (
                    <tr key={sale.id} className="bg-white/[0.02] hover:bg-white/[0.05]">
                      <td className="px-4 py-4 rounded-l-2xl border border-white/5 font-bold text-sm">
                        {sale.saleNumber}
                      </td>
                      <td className="px-4 py-4 border-y border-white/5 text-sm text-gray-400">
                        {new Date(sale.createdAt).toLocaleString('uz-UZ')}
                      </td>
                      <td className="px-4 py-4 border-y border-white/5 text-sm">
                        {sale.cashier?.fullName || '—'}
                      </td>
                      <td className="px-4 py-4 border-y border-white/5">
                        {payMethod ? (
                          <span
                            className={`text-[9px] font-black uppercase px-2 py-1 rounded-full border ${posPaymentMethodBadgeClass(payMethod)}`}
                          >
                            {posPaymentMethodLabel(payMethod)}
                          </span>
                        ) : (
                          <span className="text-gray-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 border-y border-white/5 font-black text-emerald-400">
                        {formatMoney(Number(sale.totalAmount), sale.currency)}
                      </td>
                      <td className="px-4 py-4 border-y border-white/5 text-center">
                        <span
                          className={`text-[9px] font-black uppercase px-2 py-1 rounded-full border ${getStatusStyle(sale.status)}`}
                        >
                          {sale.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 rounded-r-2xl border border-white/5 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedSaleId(sale.id)}
                          className="p-2 hover:bg-white/10 rounded-lg"
                        >
                          <ChevronRight size={18} />
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="md:hidden space-y-3">
              {filteredSales.map((sale: {
                id: string;
                saleNumber: string;
                createdAt: string;
                totalAmount: number;
                currency?: string;
                status: string;
                payments?: { method?: string }[];
              }) => {
                const payMethod = primaryPaymentMethod(sale.payments);
                return (
                <button
                  key={sale.id}
                  type="button"
                  onClick={() => setSelectedSaleId(sale.id)}
                  className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-left flex justify-between items-center"
                >
                  <div>
                    <p className="font-black">{sale.saleNumber}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(sale.createdAt).toLocaleString('uz-UZ')}
                      {payMethod ? ` · ${posPaymentMethodLabel(payMethod)}` : ''}
                    </p>
                  </div>
                  <p className="font-black text-emerald-400">
                    {formatMoney(Number(sale.totalAmount), sale.currency)}
                  </p>
                </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {selectedSaleId && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setSelectedSaleId(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-2xl glass-card rounded-[2rem] p-8 bg-[#0a0a0a] border border-white/10 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex justify-between mb-6">
                <h3 className="text-2xl font-black">
                  Chek <span className="text-blue-500">{saleDetail?.saleNumber}</span>
                </h3>
                <button type="button" onClick={() => setSelectedSaleId(null)}>
                  <X size={20} className="text-gray-500" />
                </button>
              </div>
              {isDetailLoading ? (
                <Loader2 className="animate-spin mx-auto text-blue-500" />
              ) : saleDetail ? (
                <div className="space-y-4 text-sm">
                  {saleDetail.items?.map((item: {
                    id: string;
                    quantity: number;
                    unitPrice: number;
                    lineTotal?: number;
                    productVariant?: { name?: string; product?: { name?: string } };
                  }) => (
                    <div
                      key={item.id}
                      className="flex justify-between p-3 bg-white/5 rounded-xl"
                    >
                      <span>
                        {item.productVariant?.product?.name} — {item.productVariant?.name}
                      </span>
                      <span className="font-black">
                        {formatMoney(
                          Number(item.lineTotal ?? item.quantity * item.unitPrice),
                          saleDetail.currency,
                        )}
                      </span>
                    </div>
                  ))}
                  {saleDetail.payments?.length > 0 && (
                    <div className="p-4 bg-white/5 rounded-xl space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                        To&apos;lov
                      </p>
                      {saleDetail.payments.map((p: { id: string; method: string; amount: number }) => (
                        <div key={p.id} className="flex justify-between items-center">
                          <span
                            className={`text-xs font-black uppercase px-2 py-1 rounded-full border ${posPaymentMethodBadgeClass(p.method)}`}
                          >
                            {posPaymentMethodLabel(p.method)}
                          </span>
                          <span className="font-black">
                            {formatMoney(Number(p.amount), saleDetail.currency)}
                          </span>
                        </div>
                      ))}
                      {saleDetail.cashReceived != null && (
                        <p className="text-xs text-gray-500">
                          Qabul qilingan:{' '}
                          {formatMoney(Number(saleDetail.cashReceived), saleDetail.currency)}
                          {saleDetail.cashChange != null &&
                            Number(saleDetail.cashChange) > 0 &&
                            ` · Qaytim: ${formatMoney(Number(saleDetail.cashChange), saleDetail.currency)}`}
                        </p>
                      )}
                    </div>
                  )}
                  <p className="text-right text-xl font-black text-emerald-400">
                    Jami: {formatMoney(Number(saleDetail.totalAmount), saleDetail.currency)}
                  </p>
                </div>
              ) : null}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
