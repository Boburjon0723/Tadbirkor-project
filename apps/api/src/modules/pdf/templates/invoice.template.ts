export const getInvoiceTemplate = (data: any) => {
  const formatMoney = (val: number) => new Intl.NumberFormat('uz-UZ').format(val) + ' UZS';

  // Group items by category
  const categories: Record<string, any[]> = {};
  data.items.forEach((item: any) => {
    const cat = item.categoryName || 'Boshqa';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(item);
  });

  let globalIdx = 0;
  const sections = Object.entries(categories).map(([catName, items]) => `
    <tr class="category-header">
      <td colspan="5" style="background: #f1f5f9; padding: 10px 20px; font-weight: 900; color: #1e293b; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; border-left: 4px solid #3b82f6;">
        ${catName}
      </td>
    </tr>
    ${items.map((item: any) => {
      globalIdx++;
      return `
        <tr>
          <td style="padding: 12px 20px; border-bottom: 1px solid #f1f5f9; text-align: center; color: #64748b; font-size: 12px;">${globalIdx}</td>
          <td style="padding: 12px 20px; border-bottom: 1px solid #f1f5f9;">
            <div style="font-weight: 700; color: #0f172a; font-size: 14px;">${item.productName}</div>
            <div style="color: #64748b; font-size: 11px; margin-top: 2px;">${item.variantName || ''}</div>
          </td>
          <td style="padding: 12px 20px; border-bottom: 1px solid #f1f5f9; text-align: center; font-weight: 600; color: #334155;">${item.quantity}</td>
          <td style="padding: 12px 20px; border-bottom: 1px solid #f1f5f9; text-align: right; color: #64748b; font-size: 13px;">${formatMoney(item.price)}</td>
          <td style="padding: 12px 20px; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: 800; color: #0f172a; font-size: 14px;">${formatMoney(item.total)}</td>
        </tr>
      `;
    }).join('')}
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
        body { font-family: 'Inter', sans-serif; color: #0f172a; line-height: 1.5; margin: 0; padding: 0; background: #fff; }
        .invoice-container { max-width: 850px; margin: auto; padding: 40px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 50px; }
        .brand h1 { margin: 0; font-size: 38px; font-weight: 900; letter-spacing: -1.5px; color: #3b82f6; }
        .brand p { margin: 5px 0 0; color: #64748b; font-size: 14px; font-weight: 600; }
        .invoice-meta { text-align: right; }
        .invoice-meta h2 { margin: 0; font-size: 24px; font-weight: 800; color: #1e293b; }
        .invoice-meta p { margin: 4px 0; color: #64748b; font-size: 13px; }
        
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 50px; }
        .info-card { background: #f8fafc; padding: 24px; rounded: 20px; border: 1px solid #e2e8f0; border-radius: 24px; }
        .card-label { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; color: #3b82f6; margin-bottom: 12px; }
        .company-name { font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 8px; }
        .details { font-size: 13px; color: #475569; margin: 3px 0; }
        .details b { color: #1e293b; }

        table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 40px; }
        th { background: #f8fafc; color: #475569; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; padding: 15px 20px; text-align: left; border-bottom: 2px solid #e2e8f0; }
        
        .footer-summary { display: flex; justify-content: flex-end; }
        .summary-box { width: 320px; }
        .summary-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
        .summary-row.grand-total { border-bottom: none; margin-top: 10px; padding: 20px 0; border-top: 2px solid #3b82f6; }
        .grand-total span:first-child { font-size: 16px; font-weight: 700; color: #64748b; }
        .grand-total span:last-child { font-size: 26px; font-weight: 900; color: #3b82f6; }

        .badge { display: inline-block; padding: 6px 14px; border-radius: 12px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 10px; }
        .badge-completed { background: #dcfce7; color: #166534; }
        .badge-pending { background: #fef9c3; color: #854d0e; }
        
        .footer { margin-top: 80px; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 30px; font-size: 12px; color: #94a3b8; }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <div class="header" style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div class="brand">
            <h1>AXIS ERP</h1>
            <p>ERP & Logistika Tizimi</p>
          </div>
          <div class="invoice-meta">
            <h2>BUYURTMA № ${data.invoiceNumber.replace('INV-', '')}</h2>
            <p>Sana: <b>${new Date(data.date).toLocaleDateString('uz-UZ')}</b></p>
            <div class="badge badge-${String(data.status).toLowerCase()}">${data.status}</div>
          </div>
        </div>

        <div style="display: flex; gap: 30px; margin-bottom: 50px;">
          <div class="info-card" style="flex: 1; background: #f8fafc; padding: 24px; border-radius: 24px; border: 1px solid #e2e8f0;">
            <div class="card-label">Yetkazib beruvchi</div>
            <div class="company-name">${data.seller.name}</div>
            <p class="details"><b>STIR:</b> ${data.seller.tin || '---'}</p>
            <p class="details"><b>Tel:</b> ${data.seller.phone || '---'}</p>
            <p class="details"><b>Manzil:</b> ${data.seller.address || '---'}</p>
          </div>
          <div class="info-card" style="flex: 1; background: #f8fafc; padding: 24px; border-radius: 24px; border: 1px solid #e2e8f0;">
            <div class="card-label">Buyurtmachi</div>
            <div class="company-name">${data.buyer.name}</div>
            <p class="details"><b>STIR:</b> ${data.buyer.tin || '---'}</p>
            <p class="details"><b>Tel:</b> ${data.buyer.phone || '---'}</p>
            <p class="details"><b>Manzil:</b> ${data.buyer.address || '---'}</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 50px; text-align: center;">#</th>
              <th>Mahsulot va Tavsif</th>
              <th style="width: 80px; text-align: center;">Miqdor</th>
              <th style="width: 140px; text-align: right;">Narxi</th>
              <th style="width: 150px; text-align: right;">Jami</th>
            </tr>
          </thead>
          <tbody>
            ${sections}
          </tbody>
        </table>

        <div class="footer-summary" style="display: flex; justify-content: flex-end;">
          <div class="summary-box">
            <div class="summary-row">
              <span style="color: #64748b; font-weight: 600;">Oraliq summa:</span>
              <span style="font-weight: 700;">${formatMoney(data.totalAmount)}</span>
            </div>
            <div class="summary-row grand-total" style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 18px; font-weight: 800; color: #1e293b;">UMUMIY:</span>
              <span style="font-size: 28px; font-weight: 900; color: #3b82f6;">${formatMoney(data.totalAmount)}</span>
            </div>
          </div>
        </div>

        <div class="footer">
          <p>Ushbu buyurtma Axis ERP elektron tizimi orqali shakllantirilgan.</p>
          <p>© ${new Date().getFullYear()} AXIS ERP. Barcha huquqlar himoyalangan.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};
