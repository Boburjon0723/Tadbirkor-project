'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  UserPlus,
  Loader2,
  Phone,
  Wallet,
  ChevronRight,
  X,
  Settings2,
  PlusCircle,
  MinusCircle,
  BookOpen,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import {
  retailCustomersService,
  type RetailCustomerSummary,
  type RetailLedgerEntry,
  type CurrencyBalance,
} from '@/services/retail-customers.service';
import { retailReceivablesService } from '@/services/retail-receivables.service';
import { usePosCreditEnabled } from '@/hooks/use-pos-credit';
import { useSession } from '@/hooks/use-session';
import {
  useRetailCustomersSummary,
  useRetailCustomerLedger,
  useInvalidateRetailCustomers,
} from '@/hooks/retail/use-retail-customers';
import { formatCustomerBalance } from '@/lib/retail-customer-balance';
import { toast, formatApiError } from '@/lib/toast';

function BalanceBadge({
  totalDebt,
  prepaidBalance,
  netBalance,
  size = 'sm',
}: {
  totalDebt: number;
  prepaidBalance: number;
  netBalance: number;
  size?: 'sm' | 'lg';
}) {
  const b = formatCustomerBalance(totalDebt, prepaidBalance, netBalance);
  const large = size === 'lg';
  const toneClass =
    b.tone === 'debt'
      ? 'text-amber-400'
      : b.tone === 'prepaid'
        ? 'text-emerald-400'
        : 'text-gray-500';

  return (
    <div className={`text-right shrink-0 ${large ? '' : 'min-w-[88px]'}`}>
      <p className="text-[9px] font-black text-gray-500 uppercase tracking-wider">
        {b.label}
      </p>
      <p
        className={`font-black tabular-nums ${toneClass} ${
          large ? 'text-2xl md:text-3xl' : 'text-sm'
        }`}
      >
        {b.text}
        {large && b.tone !== 'zero' ? (
          <span className="text-xs text-gray-500 font-bold ml-1">UZS</span>
        ) : null}
      </p>
    </div>
  );
}

export function PosCustomersTab() {
  const { enabled: creditEnabled, loading: creditLoading } = usePosCreditEnabled();
  const { data: session } = useSession();
  const sessionRole = (session?.me?.role || session?.role || '').toUpperCase();
  const sessionPerms = session?.me?.permissions ?? [];
  const canWrite = session?.me?.company?.canWrite !== false;
  const canRecordCredit =
    sessionRole === 'OWNER' || sessionPerms.includes('pos.credit');
  const invalidateRetail = useInvalidateRetailCustomers();
  const {
    data: rows = [],
    isLoading: loading,
    refetch: refetchSummary,
  } = useRetailCustomersSummary();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const {
    data: ledger,
    isLoading: ledgerLoading,
    isFetching: ledgerFetching,
    refetch: refetchLedger,
  } = useRetailCustomerLedger(selectedId);
  const selectedPreview = useMemo(
    () => rows.find((c) => c.id === selectedId) ?? null,
    [rows, selectedId],
  );
  const [payReceivableId, setPayReceivableId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [opAmount, setOpAmount] = useState('');
  const [opNote, setOpNote] = useState('');
  const [opType, setOpType] = useState<'credit_in' | 'debit_out'>('credit_in');
  const [opSaving, setOpSaving] = useState(false);
  const [opCurrency, setOpCurrency] = useState<'UZS' | 'USD'>('UZS');
  const [selectedEntry, setSelectedEntry] = useState<RetailLedgerEntry | null>(null);
  const [clientReady, setClientReady] = useState(false);

  useEffect(() => {
    setClientReady(true);
  }, []);

  const pickBalances = (
    row?: {
      balances?: { UZS: CurrencyBalance; USD: CurrencyBalance };
      prepaidBalance?: number;
      prepaidBalanceUsd?: number;
      debtUZS?: number;
      debtUSD?: number;
      totalDebt?: number;
    } | null,
  ) => {
    if (row?.balances?.UZS) return row.balances;
    const prepaidUZS = Number(row?.prepaidBalance ?? 0);
    const prepaidUSD = Number(row?.prepaidBalanceUsd ?? 0);
    const debtUZS = Number(row?.debtUZS ?? row?.totalDebt ?? 0);
    const debtUSD = Number(row?.debtUSD ?? 0);
    return {
      UZS: {
        totalDebt: debtUZS,
        prepaidBalance: prepaidUZS,
        netBalance: prepaidUZS - debtUZS,
      },
      USD: {
        totalDebt: debtUSD,
        prepaidBalance: prepaidUSD,
        netBalance: prepaidUSD - debtUSD,
      },
    };
  };

  const [saleItemsLoading, setSaleItemsLoading] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await retailCustomersService.create({
        name: name.trim(),
        phone: phone.trim() || undefined,
      });
      setName('');
      setPhone('');
      invalidateRetail();
      await refetchSummary();
      toast.success('Mijoz qo‘shildi');
    } catch {
      toast.error('Saqlashda xato');
    }
  };

  const submitPayment = async (receivableId: string) => {
    const amount = Number(payAmount);
    if (!amount || amount <= 0) {
      toast.error('To‘lov summasini kiriting');
      return;
    }
    try {
      await retailReceivablesService.recordPayment(receivableId, { amount });
      toast.success('To‘lov qayd etildi');
      setPayReceivableId(null);
      setPayAmount('');
      if (selectedId) {
        invalidateRetail(selectedId);
        await refetchLedger();
      }
      await refetchSummary();
    } catch (e: unknown) {
      toast.error(formatApiError(e, 'To‘lovda xato'));
    }
  };

  const selectedBalances = pickBalances(ledger ?? selectedPreview);
  const selectedPrepaidForOp = selectedBalances[opCurrency].prepaidBalance;
  const selectedDebtForOp = selectedBalances[opCurrency].totalDebt;
  const selectedDebtRemaining = Math.max(
    0,
    selectedDebtForOp - selectedPrepaidForOp,
  );

  const submitOperation = async () => {
    if (!selectedId) return;
    if (!canWrite) {
      toast.error('Sinov tugagan — operatsiya uchun obunani faollashtiring');
      return;
    }
    const amount = Number(opAmount);
    if (!amount || amount <= 0) {
      toast.error('Summani kiriting');
      return;
    }
    if (opType === 'debit_out' && selectedPrepaidForOp < amount - 0.001) {
      toast.error(
        `Avans yetarli emas (${selectedPrepaidForOp.toLocaleString()} ${opCurrency}). Qarz to'lovi uchun «Ochiq nasiya cheklari» bo'limidan foydalaning.`,
      );
      return;
    }
    setOpSaving(true);
    try {
      const payload = {
        amount,
        currency: opCurrency,
        notes: opNote.trim() || undefined,
      };
      if (opType === 'credit_in') {
        const res = await retailCustomersService.recordPrepaid(selectedId, payload);
        const applied = Number((res as { appliedToDebt?: number }).appliedToDebt ?? 0);
        const prepaid = Number((res as { prepaidAdded?: number }).prepaidAdded ?? 0);
        if (applied > 0 && prepaid > 0) {
          toast.success(
            `Qarzga ${applied.toLocaleString()} yozildi, ${prepaid.toLocaleString()} avansga qoldi`,
          );
        } else if (applied > 0) {
          toast.success(`Qarzga ${applied.toLocaleString()} to'lov qabul qilindi`);
        } else {
          toast.success('Avans qabul qilindi');
        }
      } else {
        await retailCustomersService.recordWithdraw(selectedId, payload);
        toast.success('Debet — pul qaytarildi');
      }
      setOpAmount('');
      setOpNote('');
      invalidateRetail(selectedId);
      await Promise.all([refetchLedger(), refetchSummary()]);
    } catch (e: unknown) {
      toast.error(formatApiError(e, 'Operatsiyada xato'));
    } finally {
      setOpSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedEntry?.id || !selectedId) return;
    const hasItems = (selectedEntry.posSale?.items?.length ?? 0) > 0;
    const itemCount =
      selectedEntry.posSaleItemCount ??
      selectedEntry.posSale?.items?.length ??
      0;
    if (hasItems || itemCount === 0 || !selectedEntry.posSaleId) return;

    let cancelled = false;
    setSaleItemsLoading(true);
    void retailCustomersService
      .getLedgerSaleItems(selectedId, selectedEntry.id)
      .then(({ items }) => {
        if (cancelled) return;
        setSelectedEntry((prev) =>
          prev && prev.id === selectedEntry.id
            ? {
                ...prev,
                posSale: prev.posSale
                  ? { ...prev.posSale, items }
                  : prev.posSale,
              }
            : null,
        );
      })
      .catch(() => {
        if (!cancelled) toast.error('Mahsulotlar yuklanmadi');
      })
      .finally(() => {
        if (!cancelled) setSaleItemsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedEntry?.id, selectedId, selectedEntry?.posSaleId]);

  if (!clientReady || creditLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-blue-500" size={36} />
      </div>
    );
  }

  const hasAnyBalance = rows.some((c) => {
    const b = pickBalances(c);
    return (
      Math.abs(b.UZS.netBalance) > 0.001 ||
      Math.abs(b.USD.netBalance) > 0.001 ||
      b.UZS.totalDebt > 0 ||
      b.USD.totalDebt > 0
    );
  });

  return (
    <div className="space-y-6">
      {!creditEnabled && (
        <div className="p-6 bg-amber-500/10 border border-amber-500/30 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="font-black text-amber-200">Nasiya o‘chirilgan</p>
            <p className="text-sm text-gray-400 font-bold mt-1">
              Yangi qarz sotuvi va avans qabul qilish uchun Kompaniya sozlamalarida POS
              nasiyani yoqing. Mavjud qarzlar ro‘yxatda ko‘rinadi.
            </p>
          </div>
          <Link
            href="/dashboard/settings?tab=kompaniya"
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-amber-600 font-black text-sm shrink-0"
          >
            <Settings2 size={16} /> Yoqish
          </Link>
        </div>
      )}

      <p className="text-xs text-gray-500 font-bold px-1">
        Faqat chakana POS mijozlari (kassa / nasiya). B2B hamkorlar «Hamkorlar» bo‘limida.
      </p>

      <form
        onSubmit={handleAdd}
        className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col md:flex-row gap-3"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ism *"
          className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 font-bold text-sm"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Telefon"
          className="md:w-44 bg-black/40 border border-white/10 rounded-xl px-4 py-3 font-bold text-sm"
        />
        <button
          type="submit"
          className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 rounded-xl font-black text-sm"
        >
          <UserPlus size={16} /> Qo‘shish
        </button>
      </form>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="animate-spin text-blue-500" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-center text-gray-500 font-bold py-12">Mijoz yo‘q</p>
          ) : (
            rows.map((c) => {
              const b = pickBalances(c);
              const lines = (['UZS', 'USD'] as const).filter(
                (cur) =>
                  b[cur].totalDebt > 0 ||
                  b[cur].prepaidBalance > 0 ||
                  Math.abs(b[cur].netBalance) > 0.001,
              );
              const showBalance = lines.length > 0;

              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full p-5 rounded-2xl border text-left transition-all ${
                    selectedId === c.id
                      ? 'bg-blue-600/15 border-blue-500/40'
                      : 'bg-white/5 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-11 h-11 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                        <Users size={20} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-black truncate">{c.name}</p>
                        {c.phone ? (
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                            <Phone size={10} /> {c.phone}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    {showBalance ? (
                      <div className="text-right space-y-1 shrink-0">
                        {lines.map((cur) => (
                          <BalanceBadge
                            key={cur}
                            totalDebt={b[cur].totalDebt}
                            prepaidBalance={b[cur].prepaidBalance}
                            netBalance={b[cur].netBalance}
                          />
                        ))}
                      </div>
                    ) : (
                      <span className="text-[10px] font-black text-gray-600 uppercase shrink-0">
                        0
                      </span>
                    )}
                    <ChevronRight size={18} className="text-gray-500 shrink-0 mt-2" />
                  </div>
                  {showBalance && (
                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-white/10 text-[10px] font-bold">
                      {lines.map((cur) => (
                        <span
                          key={cur}
                          className="px-2 py-1 rounded-lg bg-white/5 text-gray-400"
                        >
                          {cur}:{' '}
                          <span
                            className={
                              b[cur].netBalance >= 0
                                ? 'text-emerald-400'
                                : 'text-amber-400'
                            }
                          >
                            {b[cur].netBalance >= 0 ? '+' : ''}
                            {b[cur].netBalance.toLocaleString()}
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              );
            })
          )}
          {!loading && rows.length > 0 && !hasAnyBalance && creditEnabled && (
            <p className="text-center text-xs text-gray-600 font-bold px-4">
              Hozircha qarz yoki avans yo‘q. Nasiya sotuv yoki avans qabul qilinganda
              balans shu yerda chiqadi.
            </p>
          )}
        </div>

        <div className="glass-card rounded-3xl p-6 border border-white/10 min-h-[320px]">
          {!selectedId ? (
            <p className="text-gray-500 font-bold text-center py-20">
              Mijozni tanlang — qarz (−) yoki avans (+) shu yerda
            </p>
          ) : selectedPreview || ledger ? (
            <div className="space-y-6">
              {ledgerFetching && !ledger && (
                <div className="flex items-center gap-2 text-xs text-amber-500/80 font-bold">
                  <Loader2 size={14} className="animate-spin" />
                  Operatsiyalar yuklanmoqda…
                </div>
              )}
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h3 className="text-xl font-black">
                    {ledger?.customer.name ?? selectedPreview?.name}
                  </h3>
                  {(ledger?.customer.phone ?? selectedPreview?.phone) && (
                    <p className="text-sm text-gray-500">
                      {ledger?.customer.phone ?? selectedPreview?.phone}
                    </p>
                  )}
                </div>
                <button type="button" onClick={() => setSelectedId(null)}>
                  <X size={18} className="text-gray-500" />
                </button>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                {(['UZS', 'USD'] as const).map((cur) => {
                  const b = pickBalances(ledger ?? selectedPreview)[cur];
                  const debtRemaining = Math.max(
                    0,
                    b.totalDebt - b.prepaidBalance,
                  );
                  return (
                    <div
                      key={cur}
                      className="p-4 bg-white/5 rounded-2xl border border-white/10"
                    >
                      <p className="text-[9px] font-black text-gray-500 uppercase mb-2">
                        {cur}
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div>
                          <p className="text-gray-500 font-bold">Qarz (ochiq)</p>
                          <p className="font-black text-amber-400/80">
                            {b.totalDebt.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 font-bold">Qarz qoldi</p>
                          <p className="font-black text-amber-400">
                            {debtRemaining.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 font-bold">Avans</p>
                          <p className="font-black text-emerald-400">
                            +{b.prepaidBalance.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500 font-bold">Balans</p>
                          <p
                            className={`font-black ${
                              b.netBalance >= 0
                                ? 'text-emerald-400'
                                : 'text-amber-400'
                            }`}
                          >
                            {b.netBalance >= 0 ? '+' : ''}
                            {b.netBalance.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-4">
                <div className="flex items-center gap-2">
                  <BookOpen size={16} className="text-blue-400" />
                  <p className="text-xs font-black text-gray-300 uppercase tracking-wider">
                    Bugalteriya — operatsiya
                  </p>
                </div>
                {!creditEnabled ? (
                  <p className="text-xs text-gray-500 font-bold">
                    Qo‘lda operatsiya uchun Sozlamalar → Kompaniyada POS nasiyani yoqing.
                  </p>
                ) : !canRecordCredit ? (
                  <p className="text-xs text-gray-500 font-bold">
                    Sizda «Nasiya» ruxsati yo‘q. Jamoa → xodim rolida «POS nasiya» ni yoqing.
                  </p>
                ) : !canWrite ? (
                  <p className="text-xs text-amber-400 font-bold">
                    Sinov muddati tugagan — avans va to‘lov operatsiyalari bloklangan.
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setOpType('credit_in')}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          opType === 'credit_in'
                            ? 'bg-emerald-600/20 border-emerald-500/50'
                            : 'bg-black/30 border-white/10'
                        }`}
                      >
                        <p className="text-[9px] font-black text-gray-500 uppercase flex items-center gap-1">
                          <ArrowDownLeft size={12} className="text-emerald-400" />
                          Kredit
                        </p>
                        <p className="text-xs font-bold text-emerald-300 mt-1">
                          {selectedDebtForOp > 0
                            ? 'To‘lov (qarzga)'
                            : 'Avans kirim'}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setOpType('debit_out')}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          opType === 'debit_out'
                            ? 'bg-amber-600/20 border-amber-500/50'
                            : 'bg-black/30 border-white/10'
                        }`}
                      >
                        <p className="text-[9px] font-black text-gray-500 uppercase flex items-center gap-1">
                          <ArrowUpRight size={12} className="text-amber-400" />
                          Debet
                        </p>
                        <p className="text-xs font-bold text-amber-300 mt-1">
                          Avans qaytarish
                        </p>
                      </button>
                    </div>
                    {opType === 'debit_out' && selectedPrepaidForOp <= 0 && (
                      <p className="text-[10px] text-amber-400/90 font-bold">
                        Mijozda avans yo‘q — bu tugma faqat oldin qabul qilingan avansni qaytarish uchun.
                        Qarz yopish: pastdagi «Ochiq nasiya cheklari» → To‘lov qilish.
                      </p>
                    )}
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        {(['UZS', 'USD'] as const).map((cur) => (
                          <button
                            key={cur}
                            type="button"
                            onClick={() => setOpCurrency(cur)}
                            className={`flex-1 py-2 rounded-lg font-black text-xs border ${
                              opCurrency === cur
                                ? 'bg-blue-600/30 border-blue-500/50 text-white'
                                : 'bg-black/30 border-white/10 text-gray-500'
                            }`}
                          >
                            {cur}
                          </button>
                        ))}
                      </div>
                      <input
                        type="number"
                        min={0}
                        value={opAmount}
                        onChange={(e) => setOpAmount(e.target.value)}
                        placeholder={`Summa (${opCurrency})`}
                        className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm font-bold"
                      />
                      <input
                        value={opNote}
                        onChange={(e) => setOpNote(e.target.value)}
                        placeholder="Izoh (ixtiyoriy)"
                        className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm font-bold"
                      />
                      <button
                        type="button"
                        disabled={opSaving || !opAmount || Number(opAmount) <= 0}
                        onClick={() => void submitOperation()}
                        className={`flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                          opType === 'credit_in'
                            ? 'bg-emerald-600'
                            : 'bg-amber-600'
                        }`}
                      >
                        {opSaving ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : opType === 'credit_in' ? (
                          <PlusCircle size={16} />
                        ) : (
                          <MinusCircle size={16} />
                        )}
                        {opType === 'credit_in'
                          ? selectedDebtForOp > 0
                            ? 'To‘lov qabul qilish (qarzga)'
                            : 'Kredit — avans qabul qilish'
                          : 'Debet — avans qaytarish'}
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-600 font-bold leading-relaxed">
                      {selectedDebtForOp > 0 ? (
                        <>
                          Mijoz bergan summa avval{' '}
                          <span className="text-amber-400">ochiq qarzga</span> yoziladi
                          {selectedDebtRemaining > 0
                            ? ` (qoldi: ${selectedDebtRemaining.toLocaleString()} ${opCurrency})`
                            : ''}
                          . Ortiqcha qismi avansga tushadi.
                        </>
                      ) : (
                        <>
                          POS nasiya sotuvi avtomatik{' '}
                          <span className="text-amber-400">Debet</span> qatorida chiqadi.
                        </>
                      )}
                    </p>
                  </>
                )}
              </div>

              <div className="rounded-2xl border border-white/10 overflow-hidden">
                <div className="grid grid-cols-[76px_1fr_52px_60px_60px_68px] gap-1 px-3 py-2.5 bg-white/[0.03] text-[8px] font-black text-gray-500 uppercase tracking-wider">
                  <span>Sana</span>
                  <span>Operatsiya turi</span>
                  <span>Val</span>
                  <span className="text-right text-amber-400/80">Debet</span>
                  <span className="text-right text-emerald-400/80">Kredit</span>
                  <span className="text-right">Balans</span>
                </div>
                <div className="max-h-[36vh] overflow-y-auto custom-scrollbar divide-y divide-white/5">
                  {ledgerLoading && !ledger ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="animate-spin text-blue-500" size={28} />
                    </div>
                  ) : (ledger?.entries?.length ?? 0) === 0 ? (
                    <p className="text-gray-500 text-sm font-bold text-center py-10 px-4">
                      Operatsiyalar yo'q. Eski nasiya cheklari yuklanganda avtomatik
                      tiklanadi — mijozni qayta tanlang.
                    </p>
                  ) : (
                    (ledger?.entries ?? []).map((e) => {
                      const opStyle =
                        e.operation === 'CREDIT_SALE'
                          ? { badge: 'bg-amber-500/15 text-amber-400 border-amber-500/20', label: '📋 Nasiya sotuv' }
                          : e.operation === 'PREPAID_USE'
                            ? { badge: 'bg-blue-500/15 text-blue-400 border-blue-500/20', label: '💰 Avansdan yechildi' }
                            : e.operation === 'PREPAID_IN'
                              ? { badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20', label: '💵 Avans kirim' }
                              : e.operation === 'PREPAID_OUT'
                                ? { badge: 'bg-orange-500/15 text-orange-400 border-orange-500/20', label: '↩ Pul qaytarish' }
                                : e.operation === 'DEBT_PAYMENT'
                                  ? { badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20', label: '✅ Qarz to\'lovi' }
                                  : { badge: 'bg-gray-500/15 text-gray-400 border-gray-500/20', label: e.operationLabel };
                      const hasItems =
                        (e.posSaleItemCount ?? e.posSale?.items?.length ?? 0) > 0;
                      return (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => setSelectedEntry(e)}
                          className={`w-full grid grid-cols-[76px_1fr_52px_60px_60px_68px] gap-1 px-3 py-3 text-xs text-left transition-all ${hasItems ? 'hover:bg-blue-500/10 cursor-pointer' : 'hover:bg-white/[0.02] cursor-pointer'}`}
                        >
                          <div className="text-gray-500 font-bold tabular-nums leading-tight">
                            <p>{new Date(e.createdAt).toLocaleDateString('uz-UZ', { day: '2-digit', month: '2-digit', year: '2-digit' })}</p>
                            <p className="text-[9px] text-gray-600">{new Date(e.createdAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                          <div className="min-w-0">
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black border ${opStyle.badge}`}>
                              {opStyle.label}
                            </span>
                            {e.note ? (
                              <p className="text-[9px] text-gray-600 mt-1 truncate">{e.note}</p>
                            ) : null}
                            {hasItems && (
                              <p className="text-[9px] text-blue-500/70 mt-0.5">
                                📦 {e.posSaleItemCount ?? e.posSale?.items?.length ?? 0}{' '}
                                xil mahsulot · bosing
                              </p>
                            )}
                          </div>
                          <p className="font-black text-gray-400 text-[10px]">{e.currency}</p>
                          <p className="text-right font-black text-amber-400 tabular-nums">
                            {e.debit > 0 ? e.debit.toLocaleString() : '—'}
                          </p>
                          <p className="text-right font-black text-emerald-400 tabular-nums">
                            {e.credit > 0 ? e.credit.toLocaleString() : '—'}
                          </p>
                          <p className={`text-right font-black tabular-nums ${e.balanceAfter > 0 ? 'text-emerald-400' : e.balanceAfter < 0 ? 'text-amber-400' : 'text-gray-500'}`}>
                            {e.balanceAfter > 0 ? `+${e.balanceAfter.toLocaleString()}` : e.balanceAfter.toLocaleString()}
                          </p>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {selectedEntry && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedEntry(null)}>
                  <div className="w-full max-w-md bg-[#0c0c0e]/95 border border-white/10 rounded-3xl p-6 max-h-[85vh] overflow-y-auto shadow-2xl backdrop-blur-2xl" onClick={(ev) => ev.stopPropagation()}>
                    {/* Header */}
                    <div className="flex justify-between items-start mb-5">
                      <div>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black border ${
                          selectedEntry.operation === 'CREDIT_SALE' ? 'bg-amber-500/15 text-amber-400 border-amber-500/20'
                          : selectedEntry.operation === 'PREPAID_IN' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
                          : selectedEntry.operation === 'PREPAID_OUT' ? 'bg-orange-500/15 text-orange-400 border-orange-500/20'
                          : selectedEntry.operation === 'PREPAID_USE' ? 'bg-blue-500/15 text-blue-400 border-blue-500/20'
                          : selectedEntry.operation === 'DEBT_PAYMENT' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
                          : 'bg-gray-500/15 text-gray-400 border-gray-500/20'
                        }`}>
                          {selectedEntry.operation === 'CREDIT_SALE' ? '📋 Nasiya sotuv'
                            : selectedEntry.operation === 'PREPAID_IN' ? '💵 Avans kirim'
                            : selectedEntry.operation === 'PREPAID_OUT' ? '↩ Pul qaytarish'
                            : selectedEntry.operation === 'PREPAID_USE' ? '💰 Avansdan yechildi'
                            : selectedEntry.operation === 'DEBT_PAYMENT' ? '✅ Qarz to\'lovi'
                            : selectedEntry.operationLabel}
                        </span>
                        <p className="text-xs text-gray-400 mt-2 flex items-center gap-2">
                          <span>📅 {new Date(selectedEntry.createdAt).toLocaleDateString('uz-UZ', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                          <span className="text-gray-600">·</span>
                          <span>🕐 {new Date(selectedEntry.createdAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</span>
                        </p>
                      </div>
                      <button type="button" onClick={() => setSelectedEntry(null)} className="p-1.5 hover:bg-white/5 rounded-lg transition-colors">
                        <X size={16} className="text-gray-500" />
                      </button>
                    </div>

                    {/* Amount Summary */}
                    <div className="grid grid-cols-2 gap-3 mb-5">
                      <div className="p-3 bg-white/[0.03] border border-white/5 rounded-xl">
                        <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Summa</p>
                        <p className={`font-black text-lg tabular-nums ${selectedEntry.debit > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {selectedEntry.debit > 0 ? `-${selectedEntry.debit.toLocaleString()}` : `+${selectedEntry.credit.toLocaleString()}`}
                          <span className="text-[10px] text-gray-500 ml-1">{selectedEntry.currency}</span>
                        </p>
                      </div>
                      <div className="p-3 bg-white/[0.03] border border-white/5 rounded-xl">
                        <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Qolgan balans</p>
                        <p className={`font-black text-lg tabular-nums ${selectedEntry.balanceAfter >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {selectedEntry.balanceAfter >= 0 ? '+' : ''}{selectedEntry.balanceAfter.toLocaleString()}
                          <span className="text-[10px] text-gray-500 ml-1">{selectedEntry.currency}</span>
                        </p>
                      </div>
                    </div>

                    {/* Product items from POS sale */}
                    {saleItemsLoading ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="animate-spin text-blue-500" size={24} />
                      </div>
                    ) : selectedEntry.posSale?.items?.length ? (
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">
                            📦 Chek #{selectedEntry.posSale.saleNumber} — mahsulotlar
                          </p>
                          <span className="text-[9px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md">
                            {selectedEntry.posSale.items.length} xil
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {selectedEntry.posSale.items.map((it, idx) => (
                            <div
                              key={it.id}
                              className="flex justify-between items-center gap-2 p-3 bg-white/[0.03] border border-white/5 rounded-xl text-sm"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="text-[10px] text-gray-600 font-bold tabular-nums shrink-0 w-5">{idx + 1}.</span>
                                <div className="min-w-0">
                                  <p className="font-bold text-white truncate text-xs">{it.productName}</p>
                                  <p className="text-[10px] text-gray-500 mt-0.5">
                                    {it.quantity} dona × {it.unitPrice.toLocaleString()} {selectedEntry.posSale!.currency}
                                  </p>
                                </div>
                              </div>
                              <p className="font-black text-blue-300 shrink-0 text-xs tabular-nums">
                                {it.lineTotal.toLocaleString()}
                              </p>
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between items-center pt-3 border-t border-white/5">
                          <p className="text-[10px] font-bold text-gray-500 uppercase">Jami chek summasi</p>
                          <p className="font-black text-base text-white tabular-nums">
                            {selectedEntry.posSale.totalAmount.toLocaleString()}{' '}
                            <span className="text-xs text-gray-400">{selectedEntry.posSale.currency}</span>
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="py-6 text-center">
                        <p className="text-sm text-gray-500 font-bold">
                          {selectedEntry.operation === 'PREPAID_IN'
                            ? '💵 Qo\'lda avans kirim operatsiyasi'
                            : selectedEntry.operation === 'PREPAID_OUT'
                              ? '↩ Pul qaytarish operatsiyasi'
                              : selectedEntry.operation === 'DEBT_PAYMENT'
                                ? '✅ Qarz to\'lovi'
                                : 'Mahsulot tafsiloti mavjud emas'}
                        </p>
                        <p className="text-[10px] text-gray-600 mt-1">Mahsulot ro'yxati faqat POS sotuv operatsiyalarida mavjud</p>
                      </div>
                    )}
                    {selectedEntry.note && (
                      <div className="mt-4 p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Izoh</p>
                        <p className="text-xs text-gray-400 font-bold">{selectedEntry.note}</p>
                      </div>
                    )}
                    {selectedEntry.createdBy?.fullName && (
                      <p className="mt-3 text-[10px] text-gray-600 font-bold text-right">
                        👤 {selectedEntry.createdBy.fullName}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <details className="group">
                <summary className="text-xs font-black text-gray-500 uppercase cursor-pointer list-none flex items-center gap-2">
                  <ChevronRight
                    size={14}
                    className="group-open:rotate-90 transition-transform"
                  />
                  Ochiq nasiya cheklari ({ledger?.receivables?.length ?? 0})
                </summary>
                <div className="space-y-3 mt-3 max-h-[28vh] overflow-y-auto custom-scrollbar">
                {(ledger?.receivables?.length ?? 0) === 0 ? (
                  <p className="text-gray-500 text-sm font-bold">
                    {ledgerLoading && !ledger
                      ? 'Yuklanmoqda…'
                      : 'Nasiya cheklari yo‘q'}
                  </p>
                ) : (
                  (ledger?.receivables ?? []).map((r) => (
                    <div
                      key={r.id}
                      className="p-4 bg-white/5 border border-white/5 rounded-2xl space-y-3"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <p className="font-black text-sm">
                            Chek {r.posSale?.saleNumber || '—'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {r.createdAt
                              ? new Date(r.createdAt).toLocaleDateString('uz-UZ')
                              : ''}{' '}
                            · {r.status}
                          </p>
                        </div>
                        <p className="font-black text-amber-400 shrink-0">
                          {Number(r.remainingAmount).toLocaleString()} {r.currency}
                        </p>
                      </div>
                      {r.payments.length > 0 && (
                        <div className="pl-3 border-l-2 border-emerald-500/30 space-y-1">
                          {r.payments.map((p) => (
                            <p key={p.id} className="text-xs text-gray-400">
                              +{Number(p.amount).toLocaleString()} —{' '}
                              {p.createdBy?.fullName || '—'},{' '}
                              {new Date(p.createdAt).toLocaleDateString('uz-UZ')}
                              {p.notes ? ` · ${p.notes}` : ''}
                            </p>
                          ))}
                        </div>
                      )}
                      {creditEnabled &&
                        canRecordCredit &&
                        canWrite &&
                        (r.status === 'OPEN' || r.status === 'PARTIAL') &&
                        (payReceivableId === r.id ? (
                          <div className="flex gap-2">
                            <input
                              type="number"
                              value={payAmount}
                              onChange={(e) => setPayAmount(e.target.value)}
                              className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm font-bold"
                            />
                            <button
                              type="button"
                              onClick={() => void submitPayment(r.id)}
                              className="px-3 py-2 bg-emerald-600 rounded-lg font-black text-xs"
                            >
                              OK
                            </button>
                            <button
                              type="button"
                              onClick={() => setPayReceivableId(null)}
                              className="px-3 py-2 bg-white/10 rounded-lg text-xs font-bold"
                            >
                              ×
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setPayReceivableId(r.id);
                              const cur = (r.currency === 'USD' ? 'USD' : 'UZS') as
                                | 'UZS'
                                | 'USD';
                              const fromPrepaid = Math.min(
                                pickBalances(ledger ?? selectedPreview)[cur]
                                  .prepaidBalance,
                                Number(r.remainingAmount),
                              );
                              setPayAmount(
                                String(
                                  Math.max(
                                    0,
                                    Number(r.remainingAmount) - fromPrepaid,
                                  ),
                                ),
                              );
                            }}
                            className="flex items-center gap-1 text-xs font-black text-amber-400"
                          >
                            <Wallet size={14} /> To‘lov qilish
                            {(pickBalances(ledger ?? selectedPreview)[
                              (r.currency === 'USD' ? 'USD' : 'UZS') as 'UZS' | 'USD'
                            ].prepaidBalance ?? 0) > 0
                              ? ' (avans hisobga)'
                              : ''}
                          </button>
                        ))}
                    </div>
                  ))
                )}
                </div>
              </details>
            </div>
          ) : (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-amber-500" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
