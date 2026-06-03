'use client';

export type DebtType = 'receivable' | 'payable';

export type PartnerDebtGroup = {
  partnerCompanyId: string;
  partner: { name: string; tin: string };
  isIncoming: boolean;
  entries: any[];
  totalAmount: { uzs: number; usd: number };
  totalRemaining: { uzs: number; usd: number };
  aggregateStatus: 'OPEN' | 'PARTIAL' | 'PAID';
  entryCount: number;
  hasPendingPayment: boolean;
};

export type PartnerReportArchiveItem = {
  partnerCompanyId: string;
  partner: { name: string; tin: string };
  entryCount: number;
  lastActivityAt: string;
};

export function groupDebtsByPartner(
  debts: any[],
  activeTab: DebtType,
  search: string
): PartnerDebtGroup[] {
  const map = new Map<string, PartnerDebtGroup>();

  for (const d of debts || []) {
    const isReceivable = d.isIncoming;
    const tabMatch = activeTab === 'receivable' ? isReceivable : !isReceivable;
    if (!tabMatch) continue;
    if (!d.partner?.name?.toLowerCase().includes(search.toLowerCase())) continue;

    const partnerId = d.partnerCompanyId || d.partner?.id;
    if (!partnerId) continue;

    const key = partnerId;
    if (!map.has(key)) {
      map.set(key, {
        partnerCompanyId: partnerId,
        partner: d.partner,
        isIncoming: d.isIncoming,
        entries: [],
        totalAmount: { uzs: 0, usd: 0 },
        totalRemaining: { uzs: 0, usd: 0 },
        aggregateStatus: 'PAID',
        entryCount: 0,
        hasPendingPayment: false,
      });
    }

    const g = map.get(key)!;
    g.entries.push(d);
    g.entryCount += 1;
    const cur = String(d.currency || 'UZS').toUpperCase() === 'USD' ? 'usd' : 'uzs';
    g.totalAmount[cur] += Number(d.amount || 0);
    g.totalRemaining[cur] += Number(d.remainingAmount || 0);

    if (d.status === 'OPEN') g.aggregateStatus = 'OPEN';
    else if (d.status === 'PARTIAL' && g.aggregateStatus !== 'OPEN') g.aggregateStatus = 'PARTIAL';
  }

  return Array.from(map.values()).sort((a, b) =>
    a.partner.name.localeCompare(b.partner.name, 'uz'),
  );
}

export const formatMoney = (val: number, currency: 'UZS' | 'USD' = 'UZS') => {
  const amount = Number(val || 0);
  if (currency === 'USD') {
    return `${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} USD`;
  }
  return `${Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')} UZS`;
};

export const formatKpiTotals = (uzs: number, usd: number) => {
  const parts: string[] = [];
  if (usd !== 0) parts.push(formatMoney(usd, 'USD'));
  if (uzs !== 0) parts.push(formatMoney(uzs, 'UZS'));
  if (parts.length === 0) return formatMoney(0, 'UZS');
  return parts.join(' · ');
};

const REMAINING_EPS = 0.009;

export function partnerHasActiveDebt(
  group: Pick<PartnerDebtGroup, 'totalRemaining' | 'hasPendingPayment'>,
): boolean {
  if (group.hasPendingPayment) return true;
  const uzs = Number(group.totalRemaining?.uzs || 0);
  const usd = Number(group.totalRemaining?.usd || 0);
  return uzs > REMAINING_EPS || usd > REMAINING_EPS;
}

export const formatDualCurrency = (totals: { uzs: number; usd: number }) => {
  const parts: string[] = [];
  if (totals.usd > 0) parts.push(formatMoney(totals.usd, 'USD'));
  if (totals.uzs > 0) parts.push(formatMoney(totals.uzs, 'UZS'));
  if (parts.length === 0) return formatMoney(0, 'UZS');
  return parts.join(' · ');
};
