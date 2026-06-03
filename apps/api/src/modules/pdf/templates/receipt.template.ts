export const getReceiptTemplate = (data: any) => {
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
      <td colspan="5" style="background: #f1f5f9; padding: 10px 20px; font-weight: 900; color: #1e293b; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; border-left: 4px solid #10b981;">
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
          <td style="padding: 12px 20px; border-bottom: 1px solid #f1f5f9; text-align: center; color: #64748b; font-size: 13px;">${item.quantity}</td>
          <td style="padding: 12px 20px; border-bottom: 1px solid #f1f5f9; text-align: center; font-weight: 800; color: #10b981; font-size: 14px;">${item.receivedQuantity}</td>
          <td style="padding: 12px 20px; border-bottom: 1px solid #f1f5f9; text-align: right; color: #64748b; font-size: 13px;">${formatMoney(item.price)}</td>
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
        .brand h1 { margin: 0; font-size: 38px; font-weight: 900; letter-spacing: -1.5px; color: #10b981; }
        .brand p { margin: 5px 0 0; color: #64748b; font-size: 14px; font-weight: 600; }
        .invoice-meta { text-align: right; }
        .invoice-meta h2 { margin: 0; font-size: 24px; font-weight: 800; color: #1e293b; }
        .invoice-meta p { margin: 4px 0; color: #64748b; font-size: 13px; }
        
        .info-card { background: #f8fafc; padding: 24px; border-radius: 24px; border: 1px solid #e2e8f0; }
        .card-label { font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; color: #10b981; margin-bottom: 12px; }
        .company-name { font-size: 18px; font-weight: 800; color: #0f172a; margin-bottom: 8px; }
        .details { font-size: 13px; color: #475569; margin: 3px 0; }
        .details b { color: #1e293b; }

        table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 40px; }
        th { background: #f8fafc; color: #475569; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; padding: 15px 20px; text-align: left; border-bottom: 2px solid #e2e8f0; }
        
        .badge { display: inline-block; padding: 6px 14px; border-radius: 12px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 10px; }
        .badge-accepted { background: #dcfce7; color: #166534; }
        .badge-pending { background: #fef9c3; color: #854d0e; }
        
        .footer { margin-top: 80px; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 30px; font-size: 12px; color: #94a3b8; }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <div class="header" style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div class="brand">
            <h1>AXIS ERP</h1>
            <p>Yuk Qabul Qilish Fakturasi</p>
          </div>
          <div class="invoice-meta">
            <h2>QABUL № ${data.receiptNumber}</h2>
            <p>Sana: <b>${new Date(data.date).toLocaleDateString('uz-UZ')}</b></p>
            <div class="badge badge-${String(data.status).toLowerCase()}">${data.status}</div>
          </div>
        </div>

        <div style="display: flex; gap: 30px; margin-bottom: 50px;">
          <div class="info-card" style="flex: 1; background: #f8fafc; padding: 24px; border-radius: 24px; border: 1px solid #e2e8f0;">
            <div class="card-label">Sotuvchi (Seller)</div>
            <div class="company-name">${data.seller.name}</div>
            <p class="details"><b>STIR:</b> ${data.seller.tin || '---'}</p>
            <p class="details"><b>Tel:</b> ${data.seller.phone || '---'}</p>
          </div>
          <div class="info-card" style="flex: 1; background: #f8fafc; padding: 24px; border-radius: 24px; border: 1px solid #e2e8f0;">
            <div class="card-label">Qabul qiluvchi (Buyer)</div>
            <div class="company-name">${data.buyer.name}</div>
            <p class="details"><b>STIR:</b> ${data.buyer.tin || '---'}</p>
            <p class="details"><b>Tel:</b> ${data.buyer.phone || '---'}</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 50px; text-align: center;">#</th>
              <th>Mahsulot va Tavsif</th>
              <th style="width: 100px; text-align: center;">Jo'natilgan</th>
              <th style="width: 100px; text-align: center;">Qabul qilingan</th>
              <th style="width: 140px; text-align: right;">Birlik narxi</th>
            </tr>
          </thead>
          <tbody>
            ${sections}
          </tbody>
        </table>

        <div class="footer">
          <p>Ushbu hujjat yuk qabul qilinganligini tasdiqlaydi.</p>
          <p>© ${new Date().getFullYear()} AXIS ERP. Barcha huquqlar himoyalangan.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};
