import { api, getApiOrigin } from '../lib/api';
import { toast, formatApiError } from '../lib/toast';
import { downloadBlobFile, mobileDownloadHint } from '@/lib/download-blob';
import { reportsService } from './reports.service';
import {
  cleanRedundantParens,
  displayOrderProductSnapshot,
  splitSnapshotToLine,
} from '@/lib/order-product-label';
import { ordersService } from './orders.service';

const SNAPSHOT_DASH = /\s+[-–—]\s+/;

type InvoiceRow = {
  code: string;
  productName: string;
  variantName: string;
  imageUrl: string | null;
  qty: number;
  price: number;
  currency: string;
};

function parseSnapshotDash(snapshot: string): { left: string; right: string } | null {
  const parts = String(snapshot).trim().split(SNAPSHOT_DASH);
  if (parts.length < 2) return null;
  return { left: parts[0].trim(), right: parts.slice(1).join(' — ').trim() };
}

function looksLikeProductCode(s: string): boolean {
  const t = s.trim();
  if (!t || t.length > 64 || /\s/.test(t)) return false;
  if (/^[A-Za-z]{1,8}-\d+[A-Za-z0-9_-]*$/.test(t)) return true;
  if (/^\d+[A-Za-z0-9_-]*-[A-Za-z0-9_-]+$/.test(t)) return true;
  if (/^[A-Z0-9][A-Z0-9._-]{1,}$/i.test(t) && /[0-9]/.test(t)) return true;
  return false;
}

function displayCode(item: any): string {
  const v = item?.productVariant;
  const sku = String(v?.sku ?? '').trim();
  const barcode = String(v?.barcode ?? '').trim();
  if (sku) return sku;
  if (barcode) return barcode;
  const snap = String(item?.productNameSnapshot ?? '').trim();
  const parsed = parseSnapshotDash(snap);
  if (parsed && looksLikeProductCode(parsed.left)) return parsed.left;
  return '';
}

function productAndVariant(item: any) {
  const v = item?.productVariant;
  const fromProduct = String(v?.product?.name ?? '').trim();
  const fromVariant = String(v?.name ?? '').trim();
  const snapshot = String(item?.productNameSnapshot ?? '').trim();
  const parsed = parseSnapshotDash(snapshot);

  if (parsed) {
    return {
      productName: fromProduct || parsed.left || snapshot,
      variantName: cleanRedundantParens(fromVariant || parsed.right || ''),
    };
  }

  return {
    productName: fromProduct || displayOrderProductSnapshot(snapshot),
    variantName: cleanRedundantParens(fromVariant),
  };
}

function resolveImageUrl(item: any): string | null {
  const raw = String(item?.productVariant?.product?.imageUrl ?? '').trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  return `${getApiOrigin()}${path}`;
}

function aggregateInvoiceRows(items: any[]): InvoiceRow[] {
  const aggregated = new Map<string, InvoiceRow>();

  for (const item of items || []) {
    const { productName, variantName } = productAndVariant(item);
    const code = displayCode(item);
    const price = Number(item.expectedPrice || 0);
    const currency = String(item.expectedCurrency || 'UZS');
    const key = [
      `code:${code.toUpperCase()}`,
      `product:${productName.toUpperCase()}`,
      `variant:${variantName.toUpperCase()}`,
      `price:${price}`,
      `currency:${currency.toUpperCase()}`,
    ].join('|');

    const img = resolveImageUrl(item);
    const qty = Number(item.quantity || 0);
    const prev = aggregated.get(key);
    if (prev) {
      prev.qty += qty;
      if (!prev.imageUrl && img) prev.imageUrl = img;
    } else {
      aggregated.set(key, {
        code,
        productName,
        variantName,
        imageUrl: img,
        qty,
        price,
        currency,
      });
    }
  }

  return Array.from(aggregated.values());
}

async function parseBlobError(blob: Blob, fallback: string): Promise<string> {
  if (!blob.type?.includes('json')) return fallback;
  try {
    const parsed = JSON.parse(await blob.text());
    const msg = parsed.message || fallback;
    return Array.isArray(msg) ? msg.join(', ') : String(msg);
  } catch {
    return fallback;
  }
}

export const invoicesService = {
  async exportOrderExcel(orderId: string) {
    try {
      const short = orderId.slice(0, 8).toUpperCase();
      const response = await api.get(`/b2b-orders/${orderId}/export/excel`, {
        responseType: 'blob',
      });
      const blob = response.data as Blob;
      if (blob.type?.includes('json')) {
        throw new Error(await parseBlobError(blob, 'Excel yuklab bo‘lmadi'));
      }
      const result = await downloadBlobFile(
        blob,
        `buyurtma-ORD-${short}.xlsx`,
        {
          mimeType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      );
      toast.success(mobileDownloadHint(result));
    } catch (err) {
      toast.error(formatApiError(err, 'Excel eksportda xato'));
    }
  },

  /** Buyurtma PDF — mobil PWA uchun (blob + ulashish) */
  async exportOrderPdf(orderId: string) {
    try {
      const short = orderId.slice(0, 8).toUpperCase();
      const response = await api.get(`/invoices/${orderId}/pdf`, {
        responseType: 'blob',
      });
      const blob = response.data as Blob;
      if (blob.type?.includes('json')) {
        throw new Error(await parseBlobError(blob, 'PDF yuklab bo‘lmadi'));
      }
      const result = await downloadBlobFile(blob, `buyurtma-ORD-${short}.pdf`, {
        mimeType: 'application/pdf',
      });
      toast.success(mobileDownloadHint(result));
    } catch (err) {
      toast.error(formatApiError(err, 'PDF eksportda xato'));
    }
  },

  async printInvoice(order: any) {
    let data = order;
    if (order?.id) {
      try {
        const needsDetail = !order.items?.some(
          (it: any) => it?.productVariant?.product?.name || it?.productVariant?.sku,
        );
        if (needsDetail) {
          data = await ordersService.getOrderDetail(order.id);
        }
      } catch {
        /* ro‘yxat ma’lumotlari bilan davom */
      }
    }

    const amount = (value: number, currency: string = 'UZS') =>
      `${new Intl.NumberFormat('uz-UZ').format(Number(value || 0))} ${currency}`;

    const esc = (s: string) =>
      String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const escAttrUrl = (u: string) => String(u).replace(/"/g, '&quot;');

    const rows = aggregateInvoiceRows(data?.items || []);
    const showImage = rows.some((r) => r.imageUrl);
    const showCode = rows.some((r) => r.code);
    const showVariant = rows.some((r) => r.variantName);

    const totalsByCurrency = new Map<string, number>();
    for (const row of rows) {
      const cur = row.currency || 'UZS';
      totalsByCurrency.set(cur, (totalsByCurrency.get(cur) || 0) + row.qty * row.price);
    }

    const invNo = `INV-${data?.id?.slice(0, 8)?.toUpperCase?.() || '-'}`;
    const orderNo = `ORD-${data?.id?.slice(0, 8)?.toUpperCase?.() || '-'}`;
    const dateStr = new Date(data?.createdAt || Date.now()).toLocaleString('uz-UZ');

    const headerCells = [
      '<th class="col-num">#</th>',
      showImage ? '<th class="col-img">Rasm</th>' : '',
      showCode ? '<th class="col-code">Kod</th>' : '',
      '<th class="col-product">Mahsulot</th>',
      showVariant ? '<th class="col-variant">Variant</th>' : '',
      '<th class="col-qty">Miqdor</th>',
      '<th class="col-price">Narx</th>',
      '<th class="col-total">Jami</th>',
    ]
      .filter(Boolean)
      .join('');

    const colCount =
      4 + (showImage ? 1 : 0) + (showCode ? 1 : 0) + (showVariant ? 1 : 0);

    const bodyRows = rows
      .map((row, idx) => {
        const total = row.qty * row.price;
        const qtyLabel = Number.isInteger(row.qty) ? String(row.qty) : String(row.qty);
        const cells = [
          `<td class="col-num">${idx + 1}</td>`,
          showImage
            ? `<td class="col-img">${
                row.imageUrl
                  ? `<img src="${escAttrUrl(row.imageUrl)}" alt="" />`
                  : ''
              }</td>`
            : '',
          showCode ? `<td class="col-code">${esc(row.code)}</td>` : '',
          `<td class="col-product">${esc(row.productName)}</td>`,
          showVariant ? `<td class="col-variant">${esc(row.variantName)}</td>` : '',
          `<td class="col-qty">${qtyLabel}</td>`,
          `<td class="col-price">${amount(row.price, row.currency)}</td>`,
          `<td class="col-total">${amount(total, row.currency)}</td>`,
        ]
          .filter(Boolean)
          .join('');
        return `<tr>${cells}</tr>`;
      })
      .join('');

    const totalLines = Array.from(totalsByCurrency.entries())
      .map(
        ([cur, sum]) =>
          `<p class="grand-total"><span>Umumiy jami (${cur}):</span> <strong>${amount(sum, cur)}</strong></p>`,
      )
      .join('');

    const html = `<!DOCTYPE html>
<html lang="uz">
<head>
  <meta charset="utf-8" />
  <title>Invoice ${esc(invNo)}</title>
  <style>
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    @page { size: A4 portrait; margin: 14mm 12mm; }
    body {
      font-family: "Segoe UI", Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.35;
      color: #111;
      background: #fff;
      margin: 0;
      padding: 16px;
      max-width: 210mm;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 20px;
      padding-bottom: 12px;
      border-bottom: 2px solid #1e3a5f;
    }
    h1 {
      margin: 0;
      font-size: 22pt;
      font-weight: 800;
      color: #1e3a5f;
      letter-spacing: 0.02em;
    }
    .inv-no { margin: 4px 0 0; font-size: 10pt; color: #475569; font-weight: 700; }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px 24px;
      font-size: 10pt;
      min-width: 240px;
    }
    .meta-grid dt { font-weight: 700; color: #64748b; margin: 0; }
    .meta-grid dd { margin: 0 0 6px; font-weight: 600; }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 9.5pt;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      vertical-align: middle;
      word-wrap: break-word;
    }
    th {
      background: #e8edf5;
      color: #0f172a;
      font-weight: 700;
      font-size: 8.5pt;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    tbody tr:nth-child(even) { background: #f8fafc; }
    .col-num { width: 28px; text-align: center; }
    .col-img { width: 52px; text-align: center; }
    .col-img img { max-width: 44px; max-height: 44px; object-fit: contain; display: block; margin: 0 auto; }
    .col-code { width: 72px; }
    .col-product { width: auto; }
    .col-variant { width: 88px; }
    .col-qty { width: 48px; text-align: center; }
    .col-price, .col-total { width: 80px; text-align: right; white-space: nowrap; }
    .footer {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 2px solid #1e3a5f;
      text-align: right;
    }
    .grand-total { margin: 4px 0; font-size: 12pt; }
    .grand-total strong { font-size: 14pt; color: #1e3a5f; }
    .note { margin-top: 20px; font-size: 8pt; color: #94a3b8; text-align: center; }
    @media print {
      body { padding: 0; max-width: none; }
      .header { break-after: avoid; }
      thead { display: table-header-group; }
      tr { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>INVOICE</h1>
      <p class="inv-no">${esc(invNo)} · ${esc(orderNo)}</p>
    </div>
    <dl class="meta-grid">
      <dt>Sana</dt><dd>${esc(dateStr)}</dd>
      <dt>Sotuvchi</dt><dd>${esc(data?.seller?.name || '—')}</dd>
      <dt>Xaridor</dt><dd>${esc(data?.buyer?.name || '—')}</dd>
      <dt>Status</dt><dd>${esc(String(data?.status || '—'))}</dd>
    </dl>
  </div>
  <table>
    <thead><tr>${headerCells}</tr></thead>
    <tbody>
      ${bodyRows || `<tr><td colspan="${colCount}">Mahsulot topilmadi</td></tr>`}
    </tbody>
  </table>
  <div class="footer">${totalLines}</div>
  <p class="note">Tadbirkor · ${esc(dateStr)}</p>
</body>
</html>`;

    // Use hidden iframe printing which works perfectly in PWA / Mobile Safari / Mobile Chrome
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    iframe.style.visibility = 'hidden';
    iframe.style.pointerEvents = 'none';
    
    document.body.appendChild(iframe);
    
    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) {
      toast.error('Print yuklashda xatolik yuz berdi');
      return;
    }
    
    doc.open();
    doc.write(html);
    doc.close();
    
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error('Print error:', err);
        toast.error('Chop etishda xatolik yuz berdi');
      } finally {
        // Remove the iframe after a short delay so the print dialogue has finished reading it
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1500);
      }
    }, 500);
  },
};
