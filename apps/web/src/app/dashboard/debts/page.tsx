'use client';

import React, { useState } from 'react';
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Search, 
  Filter, 
  Building2, 
  ChevronRight, 
  Loader2,
  DollarSign,
  AlertCircle,
  X,
  CreditCard,
  FileText,
  Settings2,
  Calendar,
  Layers,
  ArrowRightLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDebts, useDebtActions, usePendingPaymentRecords, useDebtDetail } from '@/hooks/debts/use-debts';
import { useDebtsRealtime } from '@/hooks/debts/use-debts-realtime';
import { debtsService } from '@/services/debts.service';
import { toast } from '@/lib/toast';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { allocateDebtPaymentsFifo } from '@/lib/debt-allocation';
import {
  DebtType,
  PartnerDebtGroup,
  groupDebtsByPartner,
  formatMoney,
  formatKpiTotals,
  formatDualCurrency,
  partnerHasActiveDebt,
} from '@/features/debts/debts-utils';
import { DebtsKpiCards } from '@/features/debts/components/DebtsKpiCards';
import { DebtsTable } from '@/features/debts/components/DebtsTable';
import { DebtsReportArchive } from '@/features/debts/components/DebtsReportArchive';
import { DebtPaymentModal } from '@/features/debts/components/DebtPaymentModal';
import { DebtsPartnerDrawer } from '@/features/debts/components/DebtsPartnerDrawer';
import { DebtsTimelineDrawer } from '@/features/debts/components/DebtsTimelineDrawer';


export default function DebtsPage() {
  const [activeTab, setActiveTab] = useState<DebtType>('receivable');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDebt, setSelectedDebt] = useState<any>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [resolvedPendingDebtIds, setResolvedPendingDebtIds] = useState<Record<string, boolean>>({});
  const [detailDebtId, setDetailDebtId] = useState<string | null>(null);
  const [detailPartnerId, setDetailPartnerId] = useState<string | null>(null);
  const [returnPartnerId, setReturnPartnerId] = useState<string | null>(null);
  const [partnerDrawerFallback, setPartnerDrawerFallback] = useState<PartnerDebtGroup | null>(null);
  const [bulkPaymentAmount, setBulkPaymentAmount] = useState('');
  const [bulkPaymentCurrency, setBulkPaymentCurrency] = useState<'UZS' | 'USD'>('USD');
  const [bulkPaymentNotes, setBulkPaymentNotes] = useState('');
  const debouncedSearch = useDebouncedValue(searchTerm, 250);

  useDebtsRealtime(true);

  const { data: debtList, isLoading } = useDebts({
    tab: activeTab,
    search: debouncedSearch,
    page: 1,
    limit: 80,
  });
  const debtsSummary = debtList?.summary;
  const partnerGroups: PartnerDebtGroup[] = debtList?.items ?? [];
  const { data: pendingPayments } = usePendingPaymentRecords();
  const {
    createPayment,
    applyPaymentByCreditor,
    recordPartnerBulkPayment,
    confirmPartnerBulkPayments,
    confirmPayment,
    rejectPayment,
  } = useDebtActions();
  const { data: debtDetail, isLoading: isLoadingDetail } = useDebtDetail(detailDebtId);

  const pendingByDebtId = React.useMemo(() => {
    const map: Record<string, any> = {};
    (pendingPayments || []).forEach((payment: any) => {
      if (!map[payment.debtEntryId]) {
        map[payment.debtEntryId] = payment;
      }
    });
    return map;
  }, [pendingPayments]);

  /** UZS va USD ni aralashtirib yig‘maslik — har bir valyuta bo‘yicha alohida. */
  const receivableByCur = React.useMemo(
    () => ({
      uzs: Number(debtsSummary?.receivable?.uzs || 0),
      usd: Number(debtsSummary?.receivable?.usd || 0),
    }),
    [debtsSummary],
  );
  const payableByCur = React.useMemo(
    () => ({
      uzs: Number(debtsSummary?.payable?.uzs || 0),
      usd: Number(debtsSummary?.payable?.usd || 0),
    }),
    [debtsSummary],
  );
  const netByCur = React.useMemo(
    () => ({
      uzs: Number(debtsSummary?.net?.uzs || 0),
      usd: Number(debtsSummary?.net?.usd || 0),
    }),
    [debtsSummary],
  );

  React.useEffect(() => {
    if (!detailPartnerId) return;
    const updated = partnerGroups.find(
      (g: PartnerDebtGroup) => g.partnerCompanyId === detailPartnerId,
    );
    if (updated) setPartnerDrawerFallback(updated);
  }, [partnerGroups, detailPartnerId]);

  const partnerGroupsWithPending = React.useMemo(
    () =>
      partnerGroups.map((g) => ({
        ...g,
        hasPendingPayment: g.entries.some(
          (e) => pendingByDebtId[e.id] && !resolvedPendingDebtIds[e.id],
        ),
      })),
    [partnerGroups, pendingByDebtId, resolvedPendingDebtIds],
  );

  const openPaymentForDebt = (debt: any) => {
    setSelectedDebt(debt);
    setPaymentAmount(String(debt.remainingAmount || ''));
    setPaymentNotes('');
    setShowPaymentModal(true);
  };

  const handleExportAkt = async (
    partnerId: string,
    partnerName: string,
    format: 'pdf' | 'excel',
    group?: PartnerDebtGroup | null,
    options?: { fromArchive?: boolean },
  ) => {
    if (!options?.fromArchive && group && !partnerHasActiveDebt(group)) {
      toast.info('Ochiq qarz yo‘q. Akt sverkani pastdagi «Akt sverka arxivi» bo‘limidan yuklang.');
      return;
    }
    try {
      if (format === 'pdf') {
        await debtsService.downloadPartnerAktPdf(partnerId, partnerName);
        toast.success('Akt sverka (PDF) tayyor');
      } else {
        await debtsService.downloadPartnerAktExcel(partnerId, partnerName);
        toast.success('Akt sverka (Excel) tayyor');
      }
    } catch (err) {
      console.error(err);
      const message =
        (err as Error)?.message ||
        (err as any)?.response?.data?.message ||
        'Eksportda xatolik';
      toast.error(Array.isArray(message) ? message.join('\n') : String(message));
    }
  };

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDebt) return;
    const payload = {
      debtId: selectedDebt.id,
      amount: Number(paymentAmount),
      paymentMethod: 'CASH',
      notes: paymentNotes,
    };
    try {
      if (selectedDebt.isIncoming) {
        await applyPaymentByCreditor.mutateAsync(payload);
        toast.success("To'lov qabul qilindi");
      } else {
        await createPayment.mutateAsync(payload);
        toast.success("To'lov qayd etildi — tasdiqlash kutiladi");
      }
      setShowPaymentModal(false);
      setSelectedDebt(null);
      setPaymentAmount('');
      setPaymentNotes('');
    } catch (err) {
      console.error(err);
      const message =
        (err as any)?.response?.data?.message ||
        (err as any)?.message ||
        "To'lovda xatolik yuz berdi";
      toast.error(Array.isArray(message) ? message.join('\n') : String(message));
    }
  };


  const openPartnerDetail = (group: PartnerDebtGroup) => {
    if (!group.partnerCompanyId) {
      toast.error('Hamkor identifikatori topilmadi');
      return;
    }
    if (!partnerHasActiveDebt(group)) {
      toast.info('Ochiq qarz yo‘q. Tarix va akt sverka — pastdagi «Akt sverka arxivi» bo‘limida.');
      return;
    }
    setDetailDebtId(null);
    setReturnPartnerId(null);
    setPartnerDrawerFallback(group);
    setDetailPartnerId(group.partnerCompanyId);
  };

  const fallbackLedgerEntries = React.useMemo(() => {
    if (!partnerDrawerFallback) return [];
    return partnerDrawerFallback.entries.map((e: any) => ({
      id: e.id,
      amount: Number(e.amount),
      remainingAmount: Number(e.remainingAmount),
      status: e.status,
      currency: e.currency || 'UZS',
      createdAt: e.createdAt,
      isIncoming: e.isIncoming,
      receiptId: null,
      payments: [],
    }));
  }, [partnerDrawerFallback]);

  const ledgerEntriesForTab = React.useMemo(() => fallbackLedgerEntries, [fallbackLedgerEntries]);

  const ledgerTotalsForTab = React.useMemo(() => {
    if (partnerDrawerFallback) {
      return {
        amount: partnerDrawerFallback.totalAmount,
        remaining: partnerDrawerFallback.totalRemaining,
      };
    }
    return { amount: { uzs: 0, usd: 0 }, remaining: { uzs: 0, usd: 0 } };
  }, [partnerDrawerFallback]);

  const partnerDisplay = partnerDrawerFallback?.partner;

  const detailPartnerGroup = React.useMemo(() => {
    if (!detailPartnerId) return null;
    const fromList = partnerGroupsWithPending.find(
      (g) => g.partnerCompanyId === detailPartnerId,
    );
    if (fromList) return fromList;
    if (!partnerDrawerFallback) return null;
    return {
      ...partnerDrawerFallback,
      hasPendingPayment: partnerDrawerFallback.entries.some(
        (e) => pendingByDebtId[e.id] && !resolvedPendingDebtIds[e.id],
      ),
    };
  }, [
    detailPartnerId,
    partnerGroupsWithPending,
    partnerDrawerFallback,
    pendingByDebtId,
    resolvedPendingDebtIds,
  ]);

  const refreshPartnerDrawer = async () => {
    if (!detailPartnerId) return;
    try {
      const updated = await debtsService.getPartnerGroupOne(detailPartnerId, activeTab);
      if (updated) setPartnerDrawerFallback(updated);
    } catch (err) {
      console.error('Hamkor drawer yangilashda xato:', err);
    }
  };

  React.useEffect(() => {
    if (!detailPartnerId || !partnerDrawerFallback) return;
    const rem = partnerDrawerFallback.totalRemaining;
    if (rem.usd > 0) setBulkPaymentCurrency('USD');
    else if (rem.uzs > 0) setBulkPaymentCurrency('UZS');
    setBulkPaymentAmount('');
    setBulkPaymentNotes('');
  }, [detailPartnerId, partnerDrawerFallback?.partnerCompanyId]);

  const bulkEligibleEntries = React.useMemo(() => {
    return ledgerEntriesForTab.filter(
      (e: any) =>
        (String(e.currency || 'UZS').toUpperCase() === bulkPaymentCurrency) &&
        Number(e.remainingAmount) > 0 &&
        e.status !== 'PAID' &&
        !pendingByDebtId[e.id],
    );
  }, [ledgerEntriesForTab, bulkPaymentCurrency, pendingByDebtId]);

  const bulkRemainingTotal = React.useMemo(
    () =>
      bulkEligibleEntries.reduce(
        (s: number, e: any) => s + Number(e.remainingAmount || 0),
        0,
      ),
    [bulkEligibleEntries],
  );

  const bulkPreview = React.useMemo(() => {
    const amt = Number(bulkPaymentAmount) || 0;
    if (amt <= 0 || !bulkEligibleEntries.length) return null;
    return allocateDebtPaymentsFifo(bulkEligibleEntries, amt);
  }, [bulkEligibleEntries, bulkPaymentAmount]);

  const partnerPendingEntries = React.useMemo(() => {
    return ledgerEntriesForTab.filter(
      (e: any) =>
        pendingByDebtId[e.id] &&
        !resolvedPendingDebtIds[e.id] &&
        String(e.currency || 'UZS').toUpperCase() === bulkPaymentCurrency,
    );
  }, [ledgerEntriesForTab, pendingByDebtId, resolvedPendingDebtIds, bulkPaymentCurrency]);

  const partnerPendingTotal = React.useMemo(
    () =>
      partnerPendingEntries.reduce(
        (s: number, e: any) => s + Number(pendingByDebtId[e.id]?.amount || 0),
        0,
      ),
    [partnerPendingEntries, pendingByDebtId],
  );

  const handleBulkPayment = async () => {
    if (!detailPartnerId) return;
    const amount = Number(bulkPaymentAmount);
    if (!amount || amount <= 0) {
      toast.error('To‘lov summasini kiriting');
      return;
    }
    if (amount > bulkRemainingTotal + 0.01) {
      toast.error(
        `Qolgan qarz: ${formatMoney(bulkRemainingTotal, bulkPaymentCurrency)}`,
      );
      return;
    }
    try {
      const res = await recordPartnerBulkPayment.mutateAsync({
        partnerCompanyId: detailPartnerId,
        amount,
        currency: bulkPaymentCurrency,
        paymentMethod: 'CASH',
        notes: bulkPaymentNotes.trim() || undefined,
      });
      toast.success(
        `${res.entriesTouched} ta yozuvga qayd etildi — haqdor tasdiqlashini kutadi`,
      );
      setBulkPaymentAmount('');
      setBulkPaymentNotes('');
      await refreshPartnerDrawer();
    } catch (err: unknown) {
      console.error(err);
      const message =
        (err as { response?: { data?: { message?: string | string[] } } })?.response
          ?.data?.message || "To'lovda xatolik";
      toast.error(Array.isArray(message) ? message.join('\n') : String(message));
    }
  };

  const handleBulkConfirm = async () => {
    if (!detailPartnerId) return;
    const pendingIds = partnerPendingEntries.map((e: { id: string }) => e.id);
    try {
      const res = await confirmPartnerBulkPayments.mutateAsync({
        partnerCompanyId: detailPartnerId,
        currency: bulkPaymentCurrency,
      });
      setResolvedPendingDebtIds((prev) => {
        const next = { ...prev };
        for (const id of pendingIds) next[id] = true;
        return next;
      });
      setPartnerDrawerFallback((prev) => {
        if (!prev) return prev;
        const curKey = bulkPaymentCurrency === 'USD' ? 'usd' : 'uzs';
        const paid = Number(res.confirmedTotal || 0);
        const newRemaining = Math.max(0, Number(prev.totalRemaining[curKey]) - paid);
        const allPaid =
          (curKey === 'usd' ? prev.totalRemaining.uzs : prev.totalRemaining.usd) <= 0.009 &&
          newRemaining <= 0.009;
        return {
          ...prev,
          totalRemaining: {
            ...prev.totalRemaining,
            [curKey]: newRemaining,
          },
          aggregateStatus: allPaid ? 'PAID' : newRemaining < prev.totalAmount[curKey] ? 'PARTIAL' : prev.aggregateStatus,
          hasPendingPayment: false,
          entries: prev.entries.map((e: any) => {
            if (!pendingIds.includes(e.id)) return e;
            const pendingAmt = Number(pendingByDebtId[e.id]?.amount || 0);
            const rem = Math.max(0, Number(e.remainingAmount) - pendingAmt);
            return {
              ...e,
              remainingAmount: rem,
              status: rem <= 0.009 ? 'PAID' : 'PARTIAL',
            };
          }),
        };
      });
      toast.success(
        `${res.confirmedCount} ta yozuv tasdiqlandi · ${formatMoney(res.confirmedTotal, bulkPaymentCurrency)}`,
      );
      void refreshPartnerDrawer();
    } catch (err: unknown) {
      console.error(err);
      const message =
        (err as { response?: { data?: { message?: string | string[] } } })?.response
          ?.data?.message || 'Tasdiqlashda xatolik';
      toast.error(Array.isArray(message) ? message.join('\n') : String(message));
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'PAID':
      case 'CONFIRMED':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'PARTIAL': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      default: return 'bg-red-500/10 text-red-400 border-red-500/20';
    }
  };

  const debtStatusLabelUz = (status: string) => {
    if (status === 'PAID' || status === 'CONFIRMED') return 'Tasdiqlandi';
    if (status === 'PARTIAL') return 'Qisman';
    return 'Ochiq';
  };

  // Compile-safe static styles for the Finance KPI cards
  const kpiStyles = {
    receivable: {
      bgIcon: 'bg-emerald-500/10 border border-emerald-500/20 shadow-lg shadow-emerald-500/5',
      textIcon: 'text-emerald-400',
      glow: 'shadow-emerald-500/5 hover:border-emerald-500/20 bg-emerald-500/[0.01]'
    },
    payable: {
      bgIcon: 'bg-red-500/10 border border-red-500/20 shadow-lg shadow-red-500/5',
      textIcon: 'text-red-400',
      glow: 'shadow-red-500/5 hover:border-red-500/20 bg-red-500/[0.01]'
    },
    net: {
      bgIcon: 'bg-blue-500/10 border border-blue-500/20 shadow-lg shadow-blue-500/5',
      textIcon: 'text-blue-400',
      glow: 'shadow-blue-500/5 hover:border-blue-500/20 bg-blue-500/[0.01]'
    }
  };

  return (
    <div className="space-y-10 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/5">
        <div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2">Moliya <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-500">Markazi</span></h1>
          <p className="text-gray-400 text-sm md:text-base">Debitorlik va kreditorlik qarzlar, to'lovlar va balans nazorati.</p>
        </div>
      </div>

      {/* KPI Cards */}
      <DebtsKpiCards
        receivable={receivableByCur}
        payable={payableByCur}
        net={netByCur}
      />

      {/* Tabs & Search */}
      <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
        {/* Elastic sliding pill tabs container */}
        <div className="p-1.5 bg-white/5 border border-white/10 rounded-2xl w-full lg:w-fit overflow-x-auto scrollbar-none flex flex-row flex-nowrap gap-1">
          {[
            { id: 'receivable', label: 'Bizga qarzdorlar' },
            { id: 'payable', label: 'Biz qarzdormiz' }
          ].map((tab) => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as DebtType)}
              className="relative px-6 py-2.5 rounded-xl text-xs md:text-sm font-black transition-all duration-300 z-10 whitespace-nowrap flex-shrink-0 flex-1 lg:flex-none"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeDebtTab"
                  className="absolute inset-0 bg-white rounded-lg shadow-md z-[-1]"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <span className={`transition-colors duration-300 ${activeTab === tab.id ? 'text-black' : 'text-gray-400 hover:text-white'}`}>
                {tab.label}
              </span>
            </button>
          ))}
        </div>

        {/* Spacious Search bar */}
        <div className="relative flex-1 w-full lg:max-w-md group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-emerald-500 transition-colors w-4.5 h-4.5" />
          <input 
            type="text" 
            placeholder="Hamkor nomi bo'yicha qidirish..."
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-xs md:text-sm focus:outline-none focus:border-emerald-500/50 transition-all text-white font-bold h-12"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Main Table */}
      <DebtsTable
        isLoading={isLoading}
        partnerGroupsWithPending={partnerGroupsWithPending}
        activeTab={activeTab}
        openPartnerDetail={openPartnerDetail}
        handleExportAkt={handleExportAkt}
      />

      <DebtsReportArchive
        activeTab={activeTab}
        onExportPdf={(id, name) => handleExportAkt(id, name, 'pdf', null, { fromArchive: true })}
        onExportExcel={(id, name) => handleExportAkt(id, name, 'excel', null, { fromArchive: true })}
      />

      {/* Hamkor bo‘yicha batafsil — barcha qarz yozuvlari */}
      <DebtsPartnerDrawer
        isOpen={!!detailPartnerId && !detailDebtId}
        onClose={() => {
          setDetailPartnerId(null);
          setPartnerDrawerFallback(null);
        }}
        partnerId={detailPartnerId}
        partnerDisplay={partnerDisplay}
        activeTab={activeTab}
        ledgerEntries={ledgerEntriesForTab}
        ledgerTotals={ledgerTotalsForTab}
        partnerPendingEntries={partnerPendingEntries}
        partnerPendingTotal={partnerPendingTotal}
        bulkPaymentCurrency={bulkPaymentCurrency}
        setBulkPaymentCurrency={setBulkPaymentCurrency}
        bulkPaymentAmount={bulkPaymentAmount}
        setBulkPaymentAmount={setBulkPaymentAmount}
        bulkPaymentNotes={bulkPaymentNotes}
        setBulkPaymentNotes={setBulkPaymentNotes}
        bulkPreview={bulkPreview}
        bulkRemainingTotal={bulkRemainingTotal}
        isPendingBulkPayment={recordPartnerBulkPayment.isPending}
        isPendingConfirmBulk={confirmPartnerBulkPayments.isPending}
        onBulkPaymentSubmit={handleBulkPayment}
        onBulkConfirmSubmit={handleBulkConfirm}
        pendingByDebtId={pendingByDebtId}
        resolvedPendingDebtIds={resolvedPendingDebtIds}
        setResolvedPendingDebtIds={setResolvedPendingDebtIds}
        onShowTimeline={(entryId) => {
          setReturnPartnerId(detailPartnerId);
          setDetailPartnerId(null);
          setDetailDebtId(entryId);
        }}
        onOpenPayment={openPaymentForDebt}
        onConfirmPayment={async (pendingId, entryId) => {
          try {
            await confirmPayment.mutateAsync(pendingId);
            setResolvedPendingDebtIds((prev) => ({ ...prev, [entryId]: true }));
          } catch (err) {
            console.error(err);
            toast.error("To'lovni tasdiqlashda xatolik");
          }
        }}
        onRejectPayment={async (pendingId, entryId) => {
          try {
            await rejectPayment.mutateAsync({ id: pendingId });
            setResolvedPendingDebtIds((prev) => ({ ...prev, [entryId]: true }));
          } catch (err) {
            console.error(err);
            toast.error("To'lovni rad etishda xatolik");
          }
        }}
        onDownloadPdf={(id, name) => handleExportAkt(id, name, 'pdf', detailPartnerGroup)}
        onDownloadExcel={(id, name) => handleExportAkt(id, name, 'excel', detailPartnerGroup)}
        detailPartnerGroup={detailPartnerGroup}
      />

      {/* Slide-over Transaction History Timeline Panel (bitta yozuv) */}
      <AnimatePresence>
        {detailDebtId && (
          <DebtsTimelineDrawer
            isOpen={!!detailDebtId}
            onClose={() => setDetailDebtId(null)}
            isLoading={isLoadingDetail}
            debtDetail={debtDetail}
            returnPartnerId={returnPartnerId}
            onReturnToPartner={(partnerId) => {
              setDetailDebtId(null);
              setDetailPartnerId(partnerId);
              setReturnPartnerId(null);
            }}
            onDownloadPdf={(id, name) => handleExportAkt(id, name, 'pdf')}
          />
        )}
      </AnimatePresence>

      {/* Payment Modal */}
      <DebtPaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        selectedDebt={selectedDebt}
        paymentAmount={paymentAmount}
        setPaymentAmount={setPaymentAmount}
        paymentNotes={paymentNotes}
        setPaymentNotes={setPaymentNotes}
        onSubmit={handleCreatePayment}
        isPending={createPayment.isPending || applyPaymentByCreditor.isPending}
      />
    </div>
  );
}
