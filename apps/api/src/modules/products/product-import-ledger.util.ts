export type ImportLedgerAccumulator = {
  amounts: Map<string, number>;
  inboundLines: number;
  summaryParts: string[];
};

export function createImportLedgerAccumulator(): ImportLedgerAccumulator {
  return { amounts: new Map(), inboundLines: 0, summaryParts: [] };
}

export function trackImportStockInbound(
  acc: ImportLedgerAccumulator,
  qty: number,
  purchasePrice: number | null | undefined,
  currency: string,
  label: string,
) {
  const q = Math.abs(Number(qty) || 0);
  if (q <= 0) return;
  const price = Math.max(0, Number(purchasePrice ?? 0));
  const amount = q * price;
  const cur = String(currency || 'UZS').toUpperCase() === 'USD' ? 'USD' : 'UZS';
  acc.amounts.set(cur, (acc.amounts.get(cur) || 0) + amount);
  acc.inboundLines += 1;
  if (acc.summaryParts.length < 8) {
    acc.summaryParts.push(`${label} ×${q}`);
  }
}

export function ledgerAmountsFromAccumulator(acc: ImportLedgerAccumulator) {
  return [...acc.amounts.entries()].map(([currency, amount]) => ({
    currency,
    amount,
  }));
}

export function ledgerProductSummary(acc: ImportLedgerAccumulator): string | undefined {
  if (!acc.summaryParts.length) return undefined;
  const base = acc.summaryParts.join(', ');
  const extra = acc.inboundLines > acc.summaryParts.length
    ? ` +${acc.inboundLines - acc.summaryParts.length} boshqa`
    : '';
  return base + extra;
}
