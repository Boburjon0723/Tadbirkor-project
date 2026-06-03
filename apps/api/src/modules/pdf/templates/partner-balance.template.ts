type Tx = {
  date: Date | string;
  description: string;
  debit: number;
  credit: number;
  currency: string;
};

const formatMoney = (val: number, currency: string) => {
  const c = currency === 'USD' ? 'USD' : 'UZS';
  const amount = Number(val || 0);
  if (c === 'USD') {
    return `${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} USD`;
  }
  return `${Math.round(amount).toLocaleString('uz-UZ')} UZS`;
};

export const getPartnerBalanceTemplate = (data: any, query: any) => {
  const transactions: Tx[] = data.transactions || [];

  const balances: Record<string, number> = { UZS: 0, USD: 0 };
  const rows = transactions
    .map((t) => {
      const cur = t.currency === 'USD' ? 'USD' : 'UZS';
      balances[cur] += t.debit - t.credit;
      const run = balances[cur];
      return `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee; font-size: 11px;">${new Date(t.date).toLocaleDateString('uz-UZ')}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; font-size: 11px;">${t.description}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; font-size: 11px;">${cur}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; font-size: 11px; text-align: right; color: ${t.debit > 0 ? '#10b981' : '#333'}">${t.debit > 0 ? formatMoney(t.debit, cur) : '—'}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; font-size: 11px; text-align: right; color: ${t.credit > 0 ? '#ef4444' : '#333'}">${t.credit > 0 ? formatMoney(t.credit, cur) : '—'}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; font-size: 11px; text-align: right; font-weight: bold;">${formatMoney(run, cur)}</td>
      </tr>
    `;
    })
    .join('');

  const totalDebitUzs = transactions
    .filter((t) => t.currency !== 'USD')
    .reduce((s, t) => s + t.debit, 0);
  const totalCreditUzs = transactions
    .filter((t) => t.currency !== 'USD')
    .reduce((s, t) => s + t.credit, 0);
  const totalDebitUsd = transactions
    .filter((t) => t.currency === 'USD')
    .reduce((s, t) => s + t.debit, 0);
  const totalCreditUsd = transactions
    .filter((t) => t.currency === 'USD')
    .reduce((s, t) => s + t.credit, 0);

  const partnerName = data.partner?.name || 'Hamkor';
  const myName = data.myCompany?.name || 'Kompaniya';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Helvetica', 'Arial', sans-serif; color: #333; line-height: 1.4; padding: 20px; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 10px; }
        .header h1 { margin: 0; font-size: 22px; text-transform: uppercase; }
        .header p { margin: 5px 0 0; color: #666; font-size: 12px; }
        .info-grid { display: flex; justify-content: space-between; margin-bottom: 30px; gap: 40px; }
        .info-box { flex: 1; font-size: 12px; }
        .info-title { font-weight: bold; border-bottom: 1px solid #ddd; margin-bottom: 10px; padding-bottom: 5px; text-transform: uppercase; color: #666; }
        .summary-box { background: #f8fafc; padding: 16px; border-radius: 10px; margin-bottom: 24px; border: 1px solid #e2e8f0; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
        th { background: #333; color: #fff; font-size: 10px; text-transform: uppercase; padding: 12px 10px; text-align: left; }
        .footer-sig { margin-top: 60px; display: flex; justify-content: space-between; gap: 100px; }
        .sig-box { flex: 1; border-top: 1px solid #333; text-align: center; padding-top: 10px; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>O'zaro hisob-kitoblar dalolatnomasi (Akt sverka)</h1>
        <p>Sana oralig'i: ${query.dateFrom || 'Boshidan'} — ${query.dateTo || 'Bugungacha'}</p>
      </div>

      <div class="info-grid">
        <div class="info-box">
          <div class="info-title">Tashkilot</div>
          <p><strong>${myName}</strong></p>
          <p>STIR: ${data.myCompany?.tin || '—'}</p>
          <p>${data.myCompany?.address || ''}</p>
          <p>Tel: ${data.myCompany?.phone || ''}</p>
        </div>
        <div class="info-box" style="text-align: right;">
          <div class="info-title">Hamkor</div>
          <p><strong>${partnerName}</strong></p>
          <p>STIR: ${data.partner?.tin || '—'}</p>
          <p>${data.partner?.address || ''}</p>
          <p>Tel: ${data.partner?.phone || ''}</p>
        </div>
      </div>

      <div class="summary-box">
        <p><strong>UZS:</strong> Debet ${formatMoney(totalDebitUzs, 'UZS')} · Kredit ${formatMoney(totalCreditUzs, 'UZS')} · Qoldiq ${formatMoney(balances.UZS, 'UZS')}</p>
        <p><strong>USD:</strong> Debet ${formatMoney(totalDebitUsd, 'USD')} · Kredit ${formatMoney(totalCreditUsd, 'USD')} · Qoldiq ${formatMoney(balances.USD, 'USD')}</p>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 80px;">Sana</th>
            <th>Operatsiya</th>
            <th style="width: 50px;">Val</th>
            <th style="width: 110px; text-align: right;">Debet (+)</th>
            <th style="width: 110px; text-align: right;">Kredit (-)</th>
            <th style="width: 110px; text-align: right;">Qoldiq</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="6" style="padding:12px;text-align:center;">Operatsiyalar yo\'q</td></tr>'}
        </tbody>
      </table>

      <div class="footer-sig">
        <div class="sig-box">
          ${myName}<br/>M.O'. ___________________
        </div>
        <div class="sig-box">
          ${partnerName}<br/>M.O'. ___________________
        </div>
      </div>
    </body>
    </html>
  `;
};
