import { SaleCurrency, saleCurrencySuffix } from '@/lib/currency';
import { formatStockQuantity } from '@/lib/product-units';
import type { ReceiptData } from './PosReceiptPrintModal';

export type PosReceiptFormat = 'thermal' | 'a4';

export function buildPosReceiptHtml(
  data: ReceiptData,
  format: PosReceiptFormat,
  formatMoney: (v: number, currency?: SaleCurrency) => string,
): string {
  const suffix = saleCurrencySuffix(data.currency);
  const dateStr = data.date.toLocaleString('uz-UZ', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  if (format === 'thermal') {
    const itemsHtml = data.items
      .map((i) => {
        const qtyText = formatStockQuantity(i.quantity, i.unit);
        return `
        <div class="flex">
          <div style="flex: 1; padding-right: 10px;">${i.name}</div>
          <div style="text-align: right; white-space: nowrap;">
            ${qtyText} x ${i.price.toLocaleString('en-US')}
            <br/><b>${i.amount.toLocaleString('en-US')} ${suffix}</b>
          </div>
        </div>
      `;
      })
      .join('');

    return `
      <html>
      <head>
        <style>
          body { font-family: monospace; font-size: 13px; color: #000; margin: 0; padding: 10px 10px 20px 10px; width: 80mm; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .flex { display: flex; justify-content: space-between; margin-bottom: 5px; }
          .divider { border-bottom: 1px dashed #000; margin: 10px 0; }
          h2 { margin: 5px 0; font-size: 18px; text-transform: uppercase; }
          p { margin: 3px 0; }
        </style>
      </head>
      <body>
        <div class="center">
          ${data.companyName ? `<h2 style="font-size: 16px; text-transform: none;">${data.companyName}</h2>` : ''}
          <p style="font-weight: bold;">CHEK / RECEIPT</p>
          ${data.warehouseName ? `<p style="font-size: 12px;">${data.warehouseName}</p>` : ''}
        </div>
        <div class="divider"></div>
        <p><b>Sana:</b> ${dateStr}</p>
        <p><b>Chek №:</b> ${data.receiptNumber || 'N/A'}</p>
        <p><b>Kassir:</b> ${data.cashierName}</p>
        ${data.customerName ? `<p><b>Mijoz:</b> ${data.customerName}</p>` : ''}
        <p><b>To'lov turi:</b> ${data.paymentMethod === 'CASH' ? 'Naqd' : data.paymentMethod === 'CARD' ? 'Karta' : 'Nasiya'}</p>
        <div class="divider"></div>
        <div style="margin-bottom: 5px;" class="bold">Mahsulotlar:</div>
        ${itemsHtml}
        <div class="divider"></div>
        <div class="flex bold" style="font-size: 16px;">
          <span>JAMI:</span>
          <span>${formatMoney(data.total, data.currency)}</span>
        </div>
        ${
          data.paymentMethod === 'CASH'
            ? `
          <div class="flex" style="margin-top: 5px;">
            <span>To'landi:</span>
            <span>${formatMoney(data.cashReceived || 0, data.currency)}</span>
          </div>
          <div class="flex">
            <span>Qaytim:</span>
            <span>${formatMoney(data.change || 0, data.currency)}</span>
          </div>
        `
            : ''
        }
        <div class="divider"></div>
        <div class="center">
          <p>Xaridingiz uchun rahmat!</p>
          <p style="font-size: 10px; margin-top: 10px;">AXIS ERP bilan avtomatlashtirilgan</p>
        </div>
      </body>
      </html>
    `;
  }

  const itemsHtml = data.items
    .map(
      (i, idx) => `
      <tr>
        <td class="center">${idx + 1}</td>
        <td>${i.name}</td>
        <td class="center">${formatStockQuantity(i.quantity, i.unit)}</td>
        <td class="right">${i.price.toLocaleString('en-US')}</td>
        <td class="right bold">${i.amount.toLocaleString('en-US')}</td>
      </tr>
    `,
    )
    .join('');

  return `
    <html>
    <head>
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 14px; color: #333; margin: 0 auto; padding: 40px; width: 210mm; background: #fff; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
        h1 { margin: 0 0 10px 0; font-size: 28px; color: #111; text-transform: uppercase; letter-spacing: 2px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
        .info-box { background: #f9f9f9; padding: 15px; border-radius: 8px; border: 1px solid #eee; }
        .info-box p { margin: 5px 0; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        th, td { border: 1px solid #ddd; padding: 12px; }
        th { background: #f5f5f5; text-align: left; font-weight: bold; text-transform: uppercase; font-size: 12px; letter-spacing: 1px; color: #555; }
        .center { text-align: center; }
        .right { text-align: right; }
        .bold { font-weight: bold; }
        .totals { width: 300px; margin-left: auto; background: #f9f9f9; padding: 15px; border-radius: 8px; border: 1px solid #eee; }
        .flex { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .total-row { font-size: 18px; font-weight: bold; color: #111; margin-top: 10px; padding-top: 10px; border-top: 2px solid #ccc; }
        .footer { margin-top: 50px; text-align: center; color: #888; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          ${data.companyName ? `<p style="margin:0 0 6px 0; font-size: 22px; font-weight: bold; color: #111;">${data.companyName}</p>` : ''}
          <h1>INVOYS / CHEK</h1>
          ${data.warehouseName ? `<p style="margin:0; font-size: 16px; color: #666;">${data.warehouseName}</p>` : ''}
        </div>
        <div style="text-align: right;">
          <h2 style="margin: 0 0 5px 0;">№ ${data.receiptNumber || 'N/A'}</h2>
          <p style="margin:0; color: #666;">Sana: ${dateStr}</p>
        </div>
      </div>
      <div class="info-grid">
        <div class="info-box">
          <p class="bold" style="margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px;">Mijoz ma'lumotlari</p>
          <p>Mijoz: ${data.customerName || "Noma'lum"}</p>
        </div>
        <div class="info-box">
          <p class="bold" style="margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px;">To'lov ma'lumotlari</p>
          <p>Kassir: ${data.cashierName}</p>
          <p>To'lov turi: ${data.paymentMethod === 'CASH' ? 'Naqd' : data.paymentMethod === 'CARD' ? 'Plastik karta' : 'Nasiya'}</p>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th class="center" style="width: 50px;">T/r</th>
            <th>Mahsulot nomi</th>
            <th class="center" style="width: 80px;">Soni</th>
            <th class="right" style="width: 120px;">Narxi (${suffix})</th>
            <th class="right" style="width: 150px;">Summa (${suffix})</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      <div class="totals">
        <div class="flex total-row">
          <span>JAMI TO'LOV:</span>
          <span>${formatMoney(data.total, data.currency)}</span>
        </div>
        ${
          data.paymentMethod === 'CASH'
            ? `
          <div class="flex" style="margin-top: 10px; font-size: 13px; color: #555;">
            <span>Qabul qilindi:</span>
            <span>${formatMoney(data.cashReceived || 0, data.currency)}</span>
          </div>
          <div class="flex" style="font-size: 13px; color: #555;">
            <span>Qaytim:</span>
            <span>${formatMoney(data.change || 0, data.currency)}</span>
          </div>
        `
            : ''
        }
      </div>
      <div class="footer">
        <p>Xaridingiz uchun rahmat!</p>
        <p>AXIS ERP tizimi orqali avtomatlashtirilgan</p>
      </div>
    </body>
    </html>
  `;
}

/** Brauzer print dialogi — OS dagi standart/termal printerni ishlatadi */
export function printPosReceipt(
  data: ReceiptData,
  format: PosReceiptFormat,
  formatMoney: (v: number, currency?: SaleCurrency) => string,
): Promise<void> {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const html = buildPosReceiptHtml(data, format, formatMoney);
    const doc = iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      resolve();
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
        resolve();
      }, 800);
    }, 400);
  });
}
