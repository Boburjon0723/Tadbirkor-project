import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { fmtPdfDate, formatPdfMoney, renderPdfBuffer } from './pdfmake-setup';

export type InvoicePdfItem = {
  productName: string;
  variantName?: string;
  categoryName?: string;
  quantity: number | string;
  price: number;
  total: number;
};

export type InvoicePdfData = {
  invoiceNumber: string;
  date: Date | string;
  status: string;
  seller: { name: string; tin?: string | null; phone?: string | null; address?: string | null };
  buyer: { name: string; tin?: string | null; phone?: string | null; address?: string | null };
  totalAmount: number;
  currency?: string;
  items: InvoicePdfItem[];
};

export async function generateInvoicePdfBuffer(data: InvoicePdfData): Promise<Buffer> {
  const currency = data.currency === 'USD' ? 'USD' : 'UZS';
  const categories: Record<string, InvoicePdfItem[]> = {};
  for (const item of data.items) {
    const cat = item.categoryName || 'Boshqa';
    if (!categories[cat]) categories[cat] = [];
    categories[cat].push(item);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tableBody: any[][] = [
    [
      { text: '#', style: 'tableHeader', alignment: 'center' },
      { text: 'Mahsulot', style: 'tableHeader' },
      { text: 'Miqdor', style: 'tableHeader', alignment: 'center' },
      { text: 'Narxi', style: 'tableHeader', alignment: 'right' },
      { text: 'Jami', style: 'tableHeader', alignment: 'right' },
    ],
  ];

  let idx = 0;
  for (const [catName, items] of Object.entries(categories)) {
    tableBody.push([
      { text: catName, colSpan: 5, bold: true, fillColor: '#f1f5f9', margin: [0, 4, 0, 4] },
      '',
      '',
      '',
      '',
    ]);
    for (const item of items) {
      idx += 1;
      const label = item.variantName
        ? `${item.productName}\n${item.variantName}`
        : item.productName;
      tableBody.push([
        { text: String(idx), alignment: 'center' },
        label,
        { text: String(item.quantity), alignment: 'center' },
        { text: formatPdfMoney(item.price, currency), alignment: 'right' },
        { text: formatPdfMoney(item.total, currency), alignment: 'right', bold: true },
      ]);
    }
  }

  const docDefinition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [40, 48, 40, 48],
    defaultStyle: { font: 'Roboto', fontSize: 9 },
    styles: {
      title: { fontSize: 18, bold: true, color: '#1e40af' },
      subtitle: { fontSize: 10, color: '#64748b' },
      tableHeader: { bold: true, fontSize: 8, color: '#475569' },
      label: { fontSize: 8, bold: true, color: '#3b82f6' },
    },
    content: [
      {
        columns: [
          [{ text: 'AXIS ERP', style: 'title' }, { text: 'ERP & Logistika Tizimi', style: 'subtitle' }],
          {
            width: 'auto',
            alignment: 'right',
            stack: [
              { text: `BUYURTMA № ${data.invoiceNumber.replace(/^INV-/, '')}`, bold: true, fontSize: 14 },
              { text: `Sana: ${fmtPdfDate(data.date)}`, style: 'subtitle' },
              { text: `Holat: ${data.status}`, margin: [0, 4, 0, 0] },
            ],
          },
        ],
      },
      { text: ' ', margin: [0, 8] },
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: 'Yetkazib beruvchi', style: 'label' },
              { text: data.seller.name, bold: true, fontSize: 11 },
              { text: `STIR: ${data.seller.tin || '—'}`, style: 'subtitle' },
              { text: `Tel: ${data.seller.phone || '—'}`, style: 'subtitle' },
            ],
          },
          {
            width: '*',
            stack: [
              { text: 'Buyurtmachi', style: 'label' },
              { text: data.buyer.name, bold: true, fontSize: 11 },
              { text: `STIR: ${data.buyer.tin || '—'}`, style: 'subtitle' },
              { text: `Tel: ${data.buyer.phone || '—'}`, style: 'subtitle' },
            ],
          },
        ],
        columnGap: 24,
      },
      { text: ' ', margin: [0, 12] },
      {
        table: {
          headerRows: 1,
          widths: [24, '*', 48, 72, 80],
          body: tableBody,
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0,
          hLineColor: () => '#e2e8f0',
          paddingLeft: () => 6,
          paddingRight: () => 6,
          paddingTop: () => 5,
          paddingBottom: () => 5,
        },
      },
      { text: ' ', margin: [0, 8] },
      {
        alignment: 'right',
        stack: [
          {
            text: `UMUMIY: ${formatPdfMoney(data.totalAmount, currency)}`,
            bold: true,
            fontSize: 14,
            color: '#1e40af',
          },
        ],
      },
      {
        text: `© ${new Date().getFullYear()} AXIS ERP`,
        alignment: 'center',
        style: 'subtitle',
        margin: [0, 24, 0, 0],
      },
    ],
  };

  return renderPdfBuffer(docDefinition);
}
