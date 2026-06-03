'use client';

import React, { useMemo, useState } from 'react';
import {
  Users,
  Plus,
  Search,
  Loader2,
  Pencil,
  Trash2,
  UserCircle,
  FileSpreadsheet,
  Package,
  List,
  Send,
} from 'lucide-react';
import { ModuleGate } from '@/components/ModuleGate';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import { confirmAction } from '@/components/ConfirmDialog';
import { toast, formatApiError } from '@/lib/toast';
import { usePermissions } from '@/hooks/use-permissions';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import {
  usePartnerLedgerContact,
  usePartnerLedgerContacts,
  usePartnerLedgerHistory,
  usePartnerLedgerMutations,
  usePartnerLedgerOperations,
  usePartnerLedgerSummary,
} from '@/hooks/partner-ledger/use-partner-ledger';
import { AddPartnerLedgerContactModal } from '@/features/partner-ledger/AddPartnerLedgerContactModal';
import { PartnerLedgerOperationModal } from '@/features/partner-ledger/PartnerLedgerOperationModal';
import { PartnerLedgerSaleModal } from '@/features/partner-ledger/PartnerLedgerSaleModal';
import { PartnerLedgerOperationDetailModal, operationHasDetail } from '@/features/partner-ledger/PartnerLedgerOperationDetailModal';
import {
  formatBalancesLine,
  formatLedgerAmount,
  OPERATION_QUICK_ACTIONS,
  sideLabel,
} from '@/features/partner-ledger/partner-ledger-utils';
import { PartnerLedgerWorkflowInfo } from '@/features/partner-ledger/PartnerLedgerWorkflowInfo';
import { partnerLedgerService } from '@/services/partner-ledger.service';
import type { LedgerOperation, LedgerOperationType } from '@/services/partner-ledger.service';

function SummaryCard({
  title,
  totals,
  variant,
  footer,
}: {
  title: string;
  totals: Record<string, number>;
  variant: 'owe' | 'receivable';
  footer: string;
}) {
  const entries = Object.entries(totals).filter(([, v]) => Math.abs(v) >= 0.01);
  return (
    <div
      className={`rounded-2xl border p-5 ${
        variant === 'owe' ? 'border-red-500/25 bg-red-500/5' : 'border-emerald-500/25 bg-emerald-500/5'
      }`}
    >
      <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">{title}</p>
      <div className="mt-2 space-y-1">
        {entries.length === 0 ? (
          <p className="text-xl font-black text-gray-500">—</p>
        ) : (
          entries.map(([cur, val]) => (
            <p
              key={cur}
              className={`text-2xl font-black ${variant === 'owe' ? 'text-red-400' : 'text-emerald-400'}`}
            >
              {formatLedgerAmount(val, cur)}
            </p>
          ))
        )}
      </div>
      <p className="text-xs text-gray-500 mt-3 font-bold">{footer}</p>
    </div>
  );
}

export default function PartnerLedgerPage() {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [opModalOpen, setOpModalOpen] = useState(false);
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [detailOperation, setDetailOperation] = useState<LedgerOperation | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [opPreset, setOpPreset] = useState<LedgerOperationType | undefined>();
  const [editingOp, setEditingOp] = useState<LedgerOperation | null>(null);
  const [historyCurrency, setHistoryCurrency] = useState<'UZS' | 'USD'>('UZS');
  const [sendingBatchId, setSendingBatchId] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search, 250);

  const { can, loading: permLoading } = usePermissions();
  const canManage = can('partner_ledger.manage');

  const { data: summary } = usePartnerLedgerSummary();
  const { data: contacts = [], isPending: contactsLoading } = usePartnerLedgerContacts(debouncedSearch);
  const { data: contact } = usePartnerLedgerContact(selectedId);
  const { data: operationsData, isPending: opsLoading } = usePartnerLedgerOperations(selectedId);
  const { data: history } = usePartnerLedgerHistory(selectedId);
  const mutations = usePartnerLedgerMutations();

  const operations = operationsData?.items ?? [];

  const selectedFromList = useMemo(
    () => contacts.find((c) => c.id === selectedId),
    [contacts, selectedId],
  );

  const openOp = (type?: LedgerOperationType) => {
    setEditingOp(null);
    setOpPreset(type);
    setOpModalOpen(true);
  };

  const handleAddContact = async (payload: { name: string; phone?: string; tag?: string }) => {
    try {
      const created = await mutations.createContact.mutateAsync(payload);
      toast.success('Hamkor qo‘shildi');
      setAddContactOpen(false);
      setSelectedId(created.id);
    } catch (e) {
      toast.error(formatApiError(e));
      throw e;
    }
  };

  const handleOpSubmit = async (payload: {
    type: LedgerOperationType;
    amount: number;
    currency: string;
    operationDate: string;
    notes?: string;
  }) => {
    if (!selectedId) return;
    try {
      if (editingOp) {
        await mutations.updateOperation.mutateAsync({ operationId: editingOp.id, ...payload });
        toast.success('Yangilandi');
      } else {
        await mutations.createOperation.mutateAsync({ contactId: selectedId, ...payload });
        toast.success('Operatsiya saqlandi');
      }
      setOpModalOpen(false);
      setEditingOp(null);
    } catch (e) {
      toast.error(formatApiError(e));
      throw e;
    }
  };

  const handleExportExcel = async () => {
    if (!selectedId) return;
    setExportBusy(true);
    try {
      await partnerLedgerService.exportOperationsExcel(
        selectedId,
        contact?.name || selectedFromList?.name || 'hamkor',
      );
      toast.success('Excel yuklandi');
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setExportBusy(false);
    }
  };

  const handleDeleteOp = async (op: LedgerOperation) => {
    const ok = await confirmAction('Operatsiyani o‘chirasizmi?', { variant: 'danger' });
    if (!ok) return;
    try {
      await mutations.deleteOperation.mutateAsync(op.id);
      toast.success('O‘chirildi');
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const handleSendSaleOrderToPartner = async (op: LedgerOperation) => {
    if (!selectedId || !op.sourceId) return;
    setSendingBatchId(op.sourceId);
    try {
      await mutations.sendSaleOrderToPartner.mutateAsync({
        contactId: selectedId,
        batchId: op.sourceId,
      });
      toast.success('Buyurtma Telegram orqali hamkorga yuborildi');
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSendingBatchId(null);
    }
  };

  const handleDeleteContact = async () => {
    if (!selectedId) return;
    const ok = await confirmAction('Hamkorni o‘chirasizmi? (operatsiyalar bo‘lsa yashirinadi)', {
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await mutations.deleteContact.mutateAsync(selectedId);
      toast.success('Hamkor o‘chirildi');
      setSelectedId(null);
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const historyPoints = history?.points ?? [];
  const maxHist = Math.max(
    1,
    ...historyPoints.map((p) => Math.abs(p[historyCurrency] || 0)),
  );

  const loading = permLoading || contactsLoading;

  return (
    <ModuleGate moduleKey="PARTNER_LEDGER" moduleLabel="Hamkor daftari">
      <div className="space-y-6 pb-20">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight">Hamkor daftari</h1>
            <p className="text-gray-400 mt-2 text-sm max-w-xl">
              Chiqim (sotish) va pul harakatlari shu yerda. Tovar kirimi ombordan qilinadi — daftar
              avtomatik yangilanadi.
            </p>
            <p className="text-gray-500 text-xs mt-1">Chapdan hamkor tanlang — har biri uchun alohida hisob.</p>
          </div>
          {canManage && (
            <button
              type="button"
              onClick={() => setAddContactOpen(true)}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white text-gray-900 font-black text-sm shrink-0"
            >
              <Plus size={18} /> Hamkor qo‘shish
            </button>
          )}
        </div>

        {!selectedId && <PartnerLedgerWorkflowInfo defaultExpanded />}

        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SummaryCard
              title="Jami biz qarzdorlik"
              totals={summary.weOwe || {}}
              variant="owe"
              footer="Bizning qarz"
            />
            <SummaryCard
              title="Jami ular qarzi"
              totals={summary.theyOwe || {}}
              variant="receivable"
              footer="Ular bizga qarz"
            />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(260px,320px)_1fr] gap-6 min-h-[480px]">
          <div className="glass-card rounded-3xl border border-white/10 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-white/10 flex items-center gap-2">
              <Users size={18} className="text-gray-400" />
              <span className="font-black text-sm">Hamkorlar</span>
            </div>
            <div className="p-3 border-b border-white/5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Qidirish…"
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-bold"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto max-h-[520px]">
              {loading ? (
                <div className="p-8 flex justify-center">
                  <Loader2 className="animate-spin text-gray-500" />
                </div>
              ) : contacts.length === 0 ? (
                <p className="p-6 text-center text-gray-500 text-sm font-bold">Hamkorlar yo‘q</p>
              ) : (
                contacts.map((c) => {
                  const active = c.id === selectedId;
                  const balText = formatBalancesLine(c.balances);
                  const isNeg =
                    (c.balances.UZS ?? 0) < 0 || (c.balances.USD ?? 0) < 0;
                  const isPos =
                    (c.balances.UZS ?? 0) > 0 || (c.balances.USD ?? 0) > 0;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      className={`w-full text-left px-4 py-3 border-b border-white/5 transition-colors ${
                        active ? 'bg-white/10' : 'hover:bg-white/5'
                      }`}
                    >
                      <p className="font-bold text-sm text-white truncate">{c.name}</p>
                      <p
                        className={`text-xs font-black mt-1 ${
                          isNeg ? 'text-red-400' : isPos ? 'text-emerald-400' : 'text-gray-500'
                        }`}
                      >
                        {balText}
                      </p>
                      <span
                        className={`inline-block mt-1.5 px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                          c.side === 'we_owe'
                            ? 'bg-red-500/15 text-red-300'
                            : c.side === 'they_owe'
                              ? 'bg-emerald-500/15 text-emerald-300'
                              : 'bg-white/10 text-gray-400'
                        }`}
                      >
                        {sideLabel(c.side)}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="glass-card rounded-3xl border border-white/10 p-6 min-h-[400px]">
            {!selectedId ? (
              <div className="flex flex-col items-center justify-center h-full py-20 text-center">
                <UserCircle className="text-gray-600 mb-4" size={48} />
                <p className="text-gray-500 font-bold">Hamkor tanlang yoki yangisini qo‘shing.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-black">{contact?.name || selectedFromList?.name}</h2>
                    {contact?.phone && (
                      <p className="text-sm text-gray-400 mt-1">{contact.phone}</p>
                    )}
                    {contact?.tag && (
                      <span className="inline-block mt-2 px-2 py-1 rounded-lg bg-white/10 text-xs font-bold text-gray-300">
                        {contact.tag}
                      </span>
                    )}
                  </div>
                  {canManage && (
                    <div className="flex flex-wrap gap-2">
                      {OPERATION_QUICK_ACTIONS.map((a) => (
                        <button
                          key={a.type}
                          type="button"
                          onClick={() =>
                            a.type === 'SALE_OUT' ? setSaleModalOpen(true) : openOp(a.type)
                          }
                          className={`px-3 py-2 rounded-xl border text-xs font-bold hover:bg-white/10 ${
                            a.type === 'SALE_OUT'
                              ? 'bg-blue-600/20 border-blue-500/40 text-blue-200'
                              : 'bg-white/5 border-white/10'
                          }`}
                        >
                          {a.short}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={handleDeleteContact}
                        className="px-3 py-2 rounded-xl border border-red-500/30 text-red-400 text-xs font-bold"
                      >
                        O‘chirish
                      </button>
                    </div>
                  )}
                </div>

                <PartnerLedgerWorkflowInfo
                  contactName={contact?.name || selectedFromList?.name}
                  defaultExpanded={false}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-white/10 p-4 bg-white/[0.02]">
                    <p className="text-[10px] font-black uppercase text-gray-500">Joriy balans</p>
                    <p className="text-xl font-black mt-2">
                      {formatBalancesLine(contact?.balances || selectedFromList?.balances || {})}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {sideLabel(contact?.side || selectedFromList?.side || 'settled')}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 p-4 bg-white/[0.02]">
                    <p className="text-[10px] font-black uppercase text-gray-500">So‘nggi operatsiya</p>
                    {selectedFromList?.lastOperation ? (
                      <>
                        <p className="text-sm font-bold mt-2">
                          {selectedFromList.lastOperation.typeLabel}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(selectedFromList.lastOperation.operationDate).toLocaleDateString(
                            'uz-UZ',
                          )}
                        </p>
                      </>
                    ) : (
                      <p className="text-gray-500 text-sm mt-2">—</p>
                    )}
                  </div>
                </div>

                {historyPoints.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] font-black uppercase text-gray-500">
                        Balans tarixi (7 kun)
                      </p>
                      <div className="flex gap-1">
                        {(['UZS', 'USD'] as const).map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setHistoryCurrency(c)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                              historyCurrency === c ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400'
                            }`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-end gap-1 h-24 rounded-xl bg-white/[0.02] border border-white/10 p-3">
                      {historyPoints.map((p) => {
                        const v = p[historyCurrency] || 0;
                        const h = Math.max(4, (Math.abs(v) / maxHist) * 100);
                        return (
                          <div
                            key={p.date}
                            className="flex-1 flex flex-col items-center justify-end gap-1"
                            title={`${p.date}: ${formatLedgerAmount(v, historyCurrency)}`}
                          >
                            <div
                              className={`w-full rounded-t ${v >= 0 ? 'bg-emerald-500/60' : 'bg-red-500/60'}`}
                              style={{ height: `${h}%` }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <p className="text-[10px] font-black uppercase text-gray-500">Operatsiyalar</p>
                    {selectedId && operations.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => void handleExportExcel()}
                        disabled={exportBusy}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold hover:bg-white/10 disabled:opacity-50"
                      >
                        {exportBusy ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <FileSpreadsheet size={12} />
                        )}
                        Excel
                      </button>
                    ) : null}
                  </div>
                  {opsLoading ? (
                    <PageSkeleton rows={3} />
                  ) : operations.length === 0 ? (
                    <p className="text-gray-500 text-sm font-bold py-8 text-center">Operatsiyalar yo‘q</p>
                  ) : (
                    <div className="overflow-x-auto rounded-2xl border border-white/10">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-white/10 text-left text-[10px] uppercase text-gray-500">
                            <th className="p-3 w-8" />
                            <th className="p-3">Sana</th>
                            <th className="p-3">Tur</th>
                            <th className="p-3">Summa</th>
                            <th className="p-3">Mahsulotlar</th>
                            <th className="p-3">Eslatma</th>
                            {canManage && <th className="p-3 w-20" />}
                          </tr>
                        </thead>
                        <tbody>
                          {operations.map((op) => {
                            const canViewDetail = operationHasDetail(op);
                            return (
                              <tr
                                key={op.id}
                                className={`border-b border-white/5 transition-colors ${
                                  canViewDetail
                                    ? 'cursor-pointer hover:bg-white/[0.04]'
                                    : 'hover:bg-white/[0.02]'
                                }`}
                                onClick={() => {
                                  if (canViewDetail) setDetailOperation(op);
                                }}
                              >
                                <td className="p-3 text-gray-500">
                                  {canViewDetail ? <List size={14} /> : null}
                                </td>
                                  <td className="p-3 font-bold whitespace-nowrap">
                                    {new Date(op.operationDate).toLocaleDateString('uz-UZ')}
                                  </td>
                                  <td className="p-3">
                                    <span className="text-blue-400 font-bold">{op.typeLabel}</span>
                                    {op.fromStock ? (
                                      <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-500/15 text-emerald-300">
                                        <Package size={9} /> ombor
                                      </span>
                                    ) : null}
                                    {op.isSaleOrder && op.saleOrderStatus ? (
                                      <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-blue-500/15 text-blue-300">
                                        {op.saleOrderStatus}
                                      </span>
                                    ) : null}
                                  </td>
                                  <td className="p-3 font-black">
                                    {formatLedgerAmount(op.balanceDelta, op.currency)}
                                  </td>
                                  <td className="p-3 text-gray-400 text-xs max-w-[180px]">
                                    {op.productSummary || '—'}
                                  </td>
                                  <td className="p-3 text-gray-500 max-w-[120px] truncate">
                                    {op.saleOrderComment || op.notes || '—'}
                                  </td>
                                  {canManage && (
                                    <td className="p-3" onClick={(e) => e.stopPropagation()}>
                                      <div className="flex gap-1">
                                        {op.isSaleOrder && op.sourceId ? (
                                          <button
                                            type="button"
                                            onClick={() => void handleSendSaleOrderToPartner(op)}
                                            disabled={
                                              mutations.sendSaleOrderToPartner.isPending &&
                                              sendingBatchId === op.sourceId
                                            }
                                            className="p-1.5 rounded-lg hover:bg-blue-500/10 text-blue-300 disabled:opacity-50"
                                            title="Buyurtmani jo'natish"
                                          >
                                            {mutations.sendSaleOrderToPartner.isPending &&
                                            sendingBatchId === op.sourceId ? (
                                              <Loader2 size={14} className="animate-spin" />
                                            ) : (
                                              <Send size={14} />
                                            )}
                                          </button>
                                        ) : null}
                                        {!op.fromStock ? (
                                          <>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setEditingOp(op);
                                                setOpModalOpen(true);
                                              }}
                                              className="p-1.5 rounded-lg hover:bg-white/10"
                                            >
                                              <Pencil size={14} />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleDeleteOp(op)}
                                              className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400"
                                            >
                                              <Trash2 size={14} />
                                            </button>
                                          </>
                                        ) : null}
                                      </div>
                                    </td>
                                  )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <AddPartnerLedgerContactModal
          open={addContactOpen}
          onClose={() => setAddContactOpen(false)}
          onSubmit={handleAddContact}
          busy={mutations.createContact.isPending}
        />

        <PartnerLedgerOperationModal
          open={opModalOpen}
          onClose={() => {
            setOpModalOpen(false);
            setEditingOp(null);
          }}
          presetType={opPreset}
          initial={editingOp}
          onSubmit={handleOpSubmit}
          busy={mutations.createOperation.isPending || mutations.updateOperation.isPending}
        />

        <PartnerLedgerOperationDetailModal
          open={detailOperation !== null}
          operation={detailOperation}
          contactName={contact?.name || selectedFromList?.name || ''}
          onClose={() => setDetailOperation(null)}
        />

        {selectedId && (
          <PartnerLedgerSaleModal
            open={saleModalOpen}
            contactId={selectedId}
            contactName={contact?.name || selectedFromList?.name || ''}
            onClose={() => setSaleModalOpen(false)}
            onSuccess={() => setSaleModalOpen(false)}
          />
        )}
      </div>
    </ModuleGate>
  );
}
