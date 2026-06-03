'use client';

import React, { useState } from 'react';
import { 
  PackageCheck, 
  Search, 
  Filter, 
  Clock, 
  CheckCircle2, 
  XCircle,
  Loader2,
  ChevronRight,
  Building2,
  ArrowRight,
  FileText,
  FileSpreadsheet,
  Printer,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useGoodsReceipts } from '@/hooks/logistics/use-logistics';
import { AcceptReceiptModal } from '@/components/AcceptReceiptModal';
import { ReceiptDetailsDrawer } from '@/features/receipts/ReceiptDetailsDrawer';
import { receiptsService } from '@/services/receipts.service';
import {
  formatReceiptTotal,
  printReceiptsList,
  receiptDisplayId,
  receiptDisplayStatusLabel,
  receiptStatusBadgeStyle,
} from '@/features/receipts/receipt-export';

export default function ReceiptsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [drawerReceipt, setDrawerReceipt] = useState<any>(null);
  const [isAcceptModalOpen, setIsAcceptModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'done'>('all');

  const { data: receiptList, isLoading } = useGoodsReceipts({ page: 1, limit: 50 });
  const receipts = receiptList?.items ?? (Array.isArray(receiptList) ? receiptList : []);
  const receiptSummary = receiptList?.summary;

  // Compile-safe static dictionary mapping for theme glows
  const statColorStyles: Record<string, { bgIcon: string; textIcon: string; glow: string }> = {
    amber: {
      bgIcon: 'bg-amber-500/10 border border-amber-500/20 shadow-lg shadow-amber-500/5',
      textIcon: 'text-amber-400',
      glow: 'shadow-amber-500/5 hover:border-amber-500/20'
    },
    emerald: {
      bgIcon: 'bg-emerald-500/10 border border-emerald-500/20 shadow-lg shadow-emerald-500/5',
      textIcon: 'text-emerald-400',
      glow: 'shadow-emerald-500/5 hover:border-emerald-500/20'
    },
    red: {
      bgIcon: 'bg-red-500/10 border border-red-500/20 shadow-lg shadow-red-500/5',
      textIcon: 'text-red-400',
      glow: 'shadow-red-500/5 hover:border-red-500/20'
    }
  };

  const filteredReceipts = receipts?.filter((receipt: any) => {
    if (statusFilter === 'pending' && receipt.status !== 'PENDING') return false;
    if (
      statusFilter === 'done' &&
      !['ACCEPTED', 'PARTIALLY_ACCEPTED', 'REJECTED'].includes(receipt.status)
    ) {
      return false;
    }
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return (
      String(receipt.sellerCompany?.name || '').toLowerCase().includes(q) ||
      String(receipt.sellerCompany?.tin || '').toLowerCase().includes(q) ||
      String(receipt.id || '').toLowerCase().includes(q) ||
      receiptDisplayId(receipt.id).toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-10 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/5">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2">Yuklarni <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-500">Qabul Qilish</span></h1>
          <p className="text-gray-400 text-sm md:text-base">Sotuvchilardan kelgan yuklarni tekshirish va omborga qabul qilish.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => printReceiptsList(filteredReceipts || [])}
            disabled={!filteredReceipts?.length}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs font-black text-gray-300 hover:bg-white/10 disabled:opacity-40"
          >
            <Printer size={16} />
            Ro&apos;yxatni chop etish
          </button>
          <button
            type="button"
            onClick={() => receiptsService.exportAllReceiptsExcel()}
            disabled={!receipts?.length}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs font-black text-gray-300 hover:bg-white/10 disabled:opacity-40"
          >
            <FileSpreadsheet size={16} className="text-emerald-400" />
            Excel (barchasi)
          </button>
        </div>
      </div>

      {/* KPI Cards (Fixed dynamic colors & added neon glows) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {[
          { title: "Kutilayotgan qabullar", value: receiptSummary?.pending ?? (receipts?.filter((r: any) => r.status === 'PENDING').length || 0), icon: Clock, color: "amber" },
          { title: "Qabul qilingan", value: receiptSummary?.accepted ?? (receipts?.filter((r: any) => ['ACCEPTED', 'PARTIALLY_ACCEPTED'].includes(r.status)).length || 0), icon: CheckCircle2, color: "emerald" },
          { title: "Rad etilganlar", value: receiptSummary?.rejected ?? (receipts?.filter((r: any) => r.status === 'REJECTED').length || 0), icon: XCircle, color: "red" },
        ].map((stat, idx) => {
          const colors = statColorStyles[stat.color] || statColorStyles.emerald;
          return (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08, type: 'spring', stiffness: 100 }}
              whileHover={{ y: -4, scale: 1.01 }}
              className={`glass-card p-6 md:p-8 rounded-[2.5rem] relative overflow-hidden group shadow-lg border border-white/5 hover:border-white/10 transition-all duration-300 ${colors.glow}`}
            >
              <div className="relative flex flex-col gap-4">
                <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center transition-all duration-300 ${colors.bgIcon} ${colors.textIcon}`}>
                  <stat.icon size={24} className="md:size-[28px] shrink-0" />
                </div>
                <div>
                  <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">{stat.title}</p>
                  <h3 className="text-2xl md:text-3xl font-black text-white mt-1 tabular-nums">{stat.value}</h3>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Search & Filters */}
      <div className="glass-card p-5 rounded-[2.5rem] flex flex-col lg:flex-row gap-4 items-center bg-white/[0.01] border border-white/5 shadow-md">
        <div className="relative flex-1 w-full group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-emerald-500 transition-colors w-4.5 h-4.5" />
          <input 
            type="text" 
            placeholder="Sotuvchi nomi yoki buyurtma № bo'yicha qidirish..."
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-xs md:text-sm focus:outline-none focus:border-emerald-500/50 transition-all text-white font-bold h-12"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2 w-full lg:w-auto">
          {(
            [
              { id: 'all', label: 'Barchasi' },
              { id: 'pending', label: 'Kutilmoqda' },
              { id: 'done', label: 'Qabul qilingan' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-4 py-3 rounded-xl text-xs font-black transition-all h-12 ${
                statusFilter === tab.id
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white/5 border border-white/10 text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="glass-card rounded-[2.5rem] md:rounded-[3rem] overflow-hidden bg-white/[0.01] border border-white/5 shadow-xl">
        {isLoading ? (
          <div className="py-32 flex flex-col items-center justify-center gap-6">
            <Loader2 className="animate-spin text-emerald-500" size={50} />
            <p className="text-gray-400 font-black uppercase tracking-[0.2em] text-xs">Yuklanmoqda...</p>
          </div>
        ) : (
          <>
            {/* Desktop View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/[0.02] border-b border-white/5">
                    <th className="px-4 xl:px-8 py-5 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Qabul №</th>
                    <th className="px-4 xl:px-8 py-5 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Sotuvchi</th>
                    <th className="px-4 xl:px-8 py-5 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Summa</th>
                    <th className="px-4 xl:px-8 py-5 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Status</th>
                    <th className="px-4 xl:px-8 py-5 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 text-right">Amallar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredReceipts?.length === 0 ? (
                    <tr><td colSpan={5} className="py-24 text-center text-gray-500 font-bold text-sm">Hech qanday qabul qilinadigan yuklar yo'q</td></tr>
                  ) : filteredReceipts?.map((receipt: any, idx: number) => (
                    <motion.tr 
                      key={receipt.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.04, duration: 0.25 }}
                      className="hover:bg-white/[0.02] transition-colors group"
                    >
                      <td className="px-4 xl:px-8 py-5 font-black text-sm text-white">RCP-{receipt.id.slice(0, 8).toUpperCase()}</td>
                      <td className="px-4 xl:px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-white/5 rounded-xl flex items-center justify-center text-blue-400 border border-white/5 group-hover:scale-105 transition-all shadow-lg shrink-0">
                            <Building2 size={14} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-xs md:text-sm text-white truncate max-w-[150px] xl:max-w-[200px]">{receipt.sellerCompany.name}</p>
                            <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest">
                              STIR: {receipt.sellerCompany?.tin || '—'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 xl:px-8 py-5">
                         <p className="font-black text-xs md:text-sm text-emerald-400">{formatReceiptTotal(receipt)}</p>
                         <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">{receipt.items?.length || 0} xil mahsulot</p>
                      </td>
                      <td className="px-4 xl:px-8 py-5">
                        <span className={`px-3 py-1 rounded-full text-[8px] md:text-[9px] font-black uppercase tracking-widest border max-w-[200px] text-center leading-tight ${receiptStatusBadgeStyle(receipt)}`}>
                          {receiptDisplayStatusLabel(receipt)}
                        </span>
                      </td>
                      <td className="px-4 xl:px-8 py-5 text-right">
                        {receipt.status === 'PENDING' ? (
                          <button 
                            onClick={() => {
                              setSelectedReceipt(receipt);
                              setIsAcceptModalOpen(true);
                            }}
                            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-2 text-xs ml-auto h-10 w-fit"
                          >
                            <span>Qabul qilish</span>
                            <ArrowRight size={14} className="shrink-0" />
                          </button>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            {['ACCEPTED', 'PARTIALLY_ACCEPTED'].includes(receipt.status) && (
                              <button 
                                onClick={() => receiptsService.downloadReceiptPdf(receipt.id, receipt.id.slice(0, 8).toUpperCase())}
                                className="p-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-emerald-500/20 text-gray-500 hover:text-emerald-400 transition-all group/btn h-10 w-10 flex items-center justify-center active:scale-95"
                                title="PDF yuklab olish"
                              >
                                <FileText size={16} className="group-hover/btn:scale-105 transition-transform" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setDrawerReceipt(receipt)}
                              className="p-2.5 bg-white/5 rounded-xl hover:bg-white/10 transition-all text-gray-500 hover:text-white h-10 w-10 flex items-center justify-center active:scale-95"
                              title="Tafsilotlar"
                            >
                              <ChevronRight size={16} />
                            </button>
                          </div>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="md:hidden p-4 space-y-4">
              {filteredReceipts?.length === 0 ? (
                <div className="py-20 text-center text-gray-500 font-bold text-sm">Qabullar topilmadi</div>
              ) : filteredReceipts?.map((receipt: any, idx: number) => (
                <motion.div 
                  key={receipt.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04, duration: 0.25 }}
                  className="p-5 bg-white/5 border border-white/5 rounded-3xl space-y-4"
                >
                  <div className="flex justify-between items-start">
                    <p className="font-black text-white text-base">{receiptDisplayId(receipt.id)}</p>
                    <span className={`px-2.5 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border ${receiptStatusBadgeStyle(receipt)}`}>
                      {receiptDisplayStatusLabel(receipt)}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
                      <Building2 size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Sotuvchi</p>
                      <p className="font-black text-white text-sm truncate">{receipt.sellerCompany.name}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-white/5">
                    <div>
                      <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Summa</p>
                      <p className="font-black text-emerald-400 text-sm">
                        {formatReceiptTotal(receipt)}
                      </p>
                    </div>
                    {receipt.status === 'PENDING' ? (
                      <button 
                        onClick={() => {
                          setSelectedReceipt(receipt);
                          setIsAcceptModalOpen(true);
                        }}
                        className="px-5 py-2.5 bg-emerald-600 text-white font-black rounded-xl shadow-md active:scale-95 transition-all flex items-center gap-2 text-xs"
                      >
                        <span>Qabul</span>
                        <ArrowRight size={14} />
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        {['ACCEPTED', 'PARTIALLY_ACCEPTED'].includes(receipt.status) && (
                          <button 
                            onClick={() => receiptsService.downloadReceiptPdf(receipt.id, receipt.id.slice(0, 8).toUpperCase())}
                            className="p-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-emerald-500/20 text-gray-400 hover:text-emerald-400 active:scale-95 transition-all"
                            title="PDF yuklab olish"
                          >
                            <FileText size={16} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setDrawerReceipt(receipt)}
                          className="p-2.5 bg-white/5 rounded-xl text-gray-500 hover:text-white active:scale-95 transition-all"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </div>

      <ReceiptDetailsDrawer
        receipt={drawerReceipt}
        onClose={() => setDrawerReceipt(null)}
        onAccept={(r) => {
          setDrawerReceipt(null);
          setSelectedReceipt(r);
          setIsAcceptModalOpen(true);
        }}
      />

      {selectedReceipt && (
        <AcceptReceiptModal 
          isOpen={isAcceptModalOpen}
          onClose={() => {
            setIsAcceptModalOpen(false);
            setSelectedReceipt(null);
            setDrawerReceipt(null);
          }}
          receipt={selectedReceipt}
        />
      )}
    </div>
  );
}
