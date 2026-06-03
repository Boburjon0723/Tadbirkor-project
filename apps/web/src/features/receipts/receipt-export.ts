import { formatSaleAmount, normalizeSaleCurrency } from '@/lib/currency';
import { displayOrderProductSnapshot } from '@/lib/order-product-label';

export function receiptDisplayId(id: string) {
  return `RCP-${id.slice(0, 8).toUpperCase()}`;
}

export function orderDisplayId(id: string) {
  return `ORD-${id.slice(0, 8).toUpperCase()}`;
}

export function receiptStatusLabelUz(status: string) {
  switch (status) {
    case 'PENDING':
      return 'Kutilmoqda';
    case 'ACCEPTED':
      return 'Qabul qilingan';
    case 'PARTIALLY_ACCEPTED':
      return 'Qisman qabul';
    case 'REJECTED':
      return 'Rad etilgan';
    default:
      return status;
  }
}

export function receiptIsPartialAcceptance(receipt: {
  status?: string;
  items?: Array<{ quantity?: unknown; receivedQuantity?: unknown }>;
}) {
  if (receipt.status === 'PARTIALLY_ACCEPTED') return true;
  return (receipt.items ?? []).some((item) => {
    const shipped = Number(item.quantity) || 0;
    const received =
      item.receivedQuantity !== undefined && item.receivedQuantity !== null
        ? Number(item.receivedQuantity) || 0
        : shipped;
    return shipped > 0 && received < shipped;
  });
}

/** Ro‘yxat va badge: kelgan (jo‘natma) + qabul holati */
export function receiptDisplayStatusLabel(receipt: {
  status?: string;
  isPartialShipment?: boolean;
  items?: Array<{ quantity?: unknown; receivedQuantity?: unknown }>;
}) {
  const status = receipt.status || '';
  const partialShip = Boolean(receipt.isPartialShipment);
  const partialAccept = receiptIsPartialAcceptance(receipt);

  if (status === 'PENDING') {
    return partialShip ? 'Qisman kelgan — kutilmoqda' : 'To\'liq kelgan — kutilmoqda';
  }
  if (status === 'PARTIALLY_ACCEPTED') {
    return partialShip ? 'Qisman qabul (qisman kelgan)' : 'Qisman qabul qilingan';
  }
  if (status === 'ACCEPTED') {
    if (partialShip && partialAccept) return 'Qisman kelgan · qisman qabul';
    if (partialShip) return 'Qabul qilingan (qisman kelgan)';
    if (partialAccept) return 'Qisman qabul qilingan';
    return 'To\'liq qabul qilingan';
  }
  if (status === 'REJECTED') return 'Rad etilgan';
  return receiptStatusLabelUz(status);
}

export function receiptPartialShipmentStyle() {
  return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
}

export function receiptStatusBadgeStyle(receipt: {
  status?: string;
  isPartialShipment?: boolean;
  items?: Array<{ quantity?: unknown; receivedQuantity?: unknown }>;
}) {
  const status = receipt.status || '';
  if (status === 'PENDING') {
    return receipt.isPartialShipment ? receiptPartialShipmentStyle() : 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  }
  if (status === 'PARTIALLY_ACCEPTED') {
    return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
  }
  if (status === 'ACCEPTED' && receipt.isPartialShipment) {
    return 'bg-orange-500/10 text-orange-300 border-orange-500/25';
  }
  if (status === 'ACCEPTED') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  if (status === 'REJECTED') return 'bg-red-500/10 text-red-400 border-red-500/20';
  return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
}

export function formatReceiptTotal(receipt: any) {
  return formatSaleAmount(
    receipt.totalAmount,
    normalizeSaleCurrency(
      receipt.displayCurrency ??
        receipt.order?.items?.find((i: any) => i.expectedCurrency)?.expectedCurrency,
    ),
  );
}

export function printReceiptDocument(receipt: any) {
  const esc = (s: string) =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const amount = (value: number, currency: string) =>
    formatSaleAmount(value, normalizeSaleCurrency(currency));

  const rows = (receipt.items || []).map((item: any, idx: number) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.expectedPrice) || 0;
    const cur = normalizeSaleCurrency(item.expectedCurrency || receipt.displayCurrency);
    const lineTotal = qty * price;
    return `<tr>
      <td>${idx + 1}</td>
      <td>${esc(displayOrderProductSnapshot(item.productNameSnapshot))}</td>
      <td class="num">${qty}</td>
      <td class="num">${amount(price, cur)}</td>
      <td class="num">${amount(lineTotal, cur)}</td>
    </tr>`;
  });

  const html = `<!DOCTYPE html>
<html lang="uz"><head><meta charset="utf-8" />
<title>${esc(receiptDisplayId(receipt.id))}</title>
<style>
  body { font-family: system-ui, sans-serif; padding: 24px; color: #111; }
  h1 { font-size: 20px; margin: 0 0 8px; }
  .meta { font-size: 13px; color: #444; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
  th { background: #f3f4f6; }
  td.num { text-align: right; }
  .total { margin-top: 16px; font-size: 16px; font-weight: 700; text-align: right; }
  @media print { body { padding: 0; } }
</style></head><body>
  <h1>Yuk qabul hujjati — ${esc(receiptDisplayId(receipt.id))}</h1>
  <div class="meta">
    <div>Buyurtma: ${esc(orderDisplayId(receipt.orderId))}</div>
    <div>Sotuvchi: ${esc(receipt.sellerCompany?.name || '—')} · STIR: ${esc(receipt.sellerCompany?.tin || '—')}</div>
    <div>Status: ${esc(receiptStatusLabelUz(receipt.status))}</div>
    <div>Sana: ${esc(new Date(receipt.createdAt).toLocaleString('uz-UZ'))}</div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Mahsulot</th><th>Miqdor</th><th>Narx</th><th>Jami</th></tr></thead>
    <tbody>${rows.join('')}</tbody>
  </table>
  <p class="total">Umumiy: ${esc(formatReceiptTotal(receipt))}</p>
  <script>window.onload = () => { window.print(); }</script>
</body></html>`;

  const w = window.open('', '_blank', 'noopener,noreferrer');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

export function printReceiptsList(receipts: any[]) {
  const esc = (s: string) =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const rows = receipts.map(
    (r) => `<tr>
      <td>${esc(receiptDisplayId(r.id))}</td>
      <td>${esc(r.sellerCompany?.name || '—')}</td>
      <td class="num">${esc(formatReceiptTotal(r))}</td>
      <td>${esc(receiptStatusLabelUz(r.status))}</td>
      <td>${esc(new Date(r.createdAt).toLocaleString('uz-UZ'))}</td>
    </tr>`,
  );

  const html = `<!DOCTYPE html>
<html lang="uz"><head><meta charset="utf-8" />
<title>Qabullar ro'yxati</title>
<style>
  body { font-family: system-ui, sans-serif; padding: 24px; }
  h1 { font-size: 18px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 16px; }
  th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
  th { background: #f3f4f6; }
  td.num { text-align: right; }
</style></head><body>
  <h1>Kelgan yuklar — ${receipts.length} ta</h1>
  <table>
    <thead><tr><th>Qabul №</th><th>Sotuvchi</th><th>Summa</th><th>Status</th><th>Sana</th></tr></thead>
    <tbody>${rows.join('')}</tbody>
  </table>
  <script>window.onload = () => window.print();</script>
</body></html>`;

  const w = window.open('', '_blank', 'noopener,noreferrer');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
