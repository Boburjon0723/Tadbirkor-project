import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { fmtPdfDate, formatPdfMoney, renderPdfBuffer } from './pdfmake-setup';

export type ReceiptPdfItem = {
  productName: string;
  variantName?: string;
  categoryName?: string;
  quantity: number | string;
  receivedQuantity: number | string;
  price: number;
};

export type ReceiptPdfData = {
  receiptNumber: string;
  date: Date | string;
  status: string;
  seller: { name: string; tin?: string | null; phone?: string | null };
  buyer: { name: string; tin?: string | null; phone?: string | null };
  currency?: string;
  items: ReceiptPdfItem[];
};

export async function generateReceiptPdfBuffer(data: ReceiptPdfData): Promise<Buffer> {
  const currency = data.currency === 'USD' ? 'USD' : 'UZS';
  const categories: Record<string, ReceiptPdfItem[]> = {};
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
      { text: "Jo'natilgan", style: 'tableHeader', alignment: 'center' },
      { text: 'Qabul', style: 'tableHeader', alignment: 'center' },
      { text: 'Narx', style: 'tableHeader', alignment: 'right' },
    ],
  ];

  let idx = 0;
  for (const [catName, items] of Object.entries(categories)) {
    tableBody.push([
      { text: catName, colSpan: 5, bold: true, fillColor: '#ecfdf5', margin: [0, 4, 0, 4] },
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
        { text: String(item.receivedQuantity), alignment: 'center', bold: true, color: '#059669' },
        { text: formatPdfMoney(item.price, currency), alignment: 'right' },
      ]);
    }
  }

  const docDefinition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [40, 48, 40, 48],
    defaultStyle: { font: 'Roboto', fontSize: 9 },
    styles: {
      title: { fontSize: 18, bold: true, color: '#059669' },
      subtitle: { fontSize: 10, color: '#64748b' },
      tableHeader: { bold: true, fontSize: 8, color: '#475569' },
      label: { fontSize: 8, bold: true, color: '#059669' },
    },
    content: [
      {
        columns: [
          [
            { text: 'AXIS ERP', style: 'title' },
            { text: 'Yuk qabul qilish fakturasi', style: 'subtitle' },
          ],
          {
            width: 'auto',
            alignment: 'right',
            stack: [
              { text: `QABUL № ${data.receiptNumber}`, bold: true, fontSize: 14 },
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
              { text: 'Sotuvchi', style: 'label' },
              { text: data.seller.name, bold: true, fontSize: 11 },
              { text: `STIR: ${data.seller.tin || '—'}`, style: 'subtitle' },
            ],
          },
          {
            width: '*',
            stack: [
              { text: 'Qabul qiluvchi', style: 'label' },
              { text: data.buyer.name, bold: true, fontSize: 11 },
              { text: `STIR: ${data.buyer.tin || '—'}`, style: 'subtitle' },
            ],
          },
        ],
        columnGap: 24,
      },
      { text: ' ', margin: [0, 12] },
      {
        table: {
          headerRows: 1,
          widths: [24, '*', 52, 52, 72],
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
      {
        text: 'Ushbu hujjat yuk qabul qilinganligini tasdiqlaydi.',
        alignment: 'center',
        style: 'subtitle',
        margin: [0, 20, 0, 0],
      },
    ],
  };

  return renderPdfBuffer(docDefinition);
}
