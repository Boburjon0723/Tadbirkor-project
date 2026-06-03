import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { fmtPdfDate, formatPdfMoney, renderPdfBuffer } from './pdfmake-setup';

export type StockReportRow = {
  warehouse: string;
  product: string;
  variant: string;
  sku: string | null;
  quantity: number | string;
  purchasePrice: number;
  salePrice: number;
  inventoryValue: number;
};

export type StockReportPdfPayload = {
  companyName: string;
  warehouseLabel: string;
  generatedAt: Date;
  summary: {
    totalItems: number;
    totalQuantity: number;
    totalValue: number;
  };
  rows: StockReportRow[];
};

export async function generateStockReportPdfBuffer(
  payload: StockReportPdfPayload,
): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tableBody: any[][] = [
    [
      { text: 'Mahsulot', style: 'tableHeader' },
      { text: 'Variant', style: 'tableHeader' },
      { text: 'SKU', style: 'tableHeader' },
      { text: 'Miqdor', style: 'tableHeader', alignment: 'right' },
      { text: 'Qiymat', style: 'tableHeader', alignment: 'right' },
    ],
  ];

  for (const row of payload.rows) {
    tableBody.push([
      row.product,
      row.variant || '—',
      row.sku || '—',
      { text: String(row.quantity), alignment: 'right' },
      { text: formatPdfMoney(row.inventoryValue, 'UZS'), alignment: 'right' },
    ]);
  }

  const doc: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [28, 36, 28, 36],
    content: [
      { text: 'Zaxira hisoboti', style: 'title' },
      { text: payload.companyName, style: 'subtitle' },
      {
        text: `Ombor: ${payload.warehouseLabel}  ·  ${fmtPdfDate(payload.generatedAt)}`,
        style: 'meta',
        margin: [0, 0, 0, 12],
      },
      {
        columns: [
          { text: `Pozitsiyalar: ${payload.summary.totalItems}`, style: 'meta' },
          { text: `Jami miqdor: ${payload.summary.totalQuantity}`, style: 'meta', alignment: 'center' },
          {
            text: `Qiymat: ${formatPdfMoney(payload.summary.totalValue, 'UZS')}`,
            style: 'meta',
            alignment: 'right',
          },
        ],
        margin: [0, 0, 0, 16],
      },
      {
        table: {
          headerRows: 1,
          widths: ['*', 'auto', 'auto', 'auto', 'auto'],
          body: tableBody,
        },
        layout: 'lightHorizontalLines',
      },
    ],
    styles: {
      title: { fontSize: 16, bold: true },
      subtitle: { fontSize: 11, color: '#444444', margin: [0, 4, 0, 0] },
      meta: { fontSize: 9, color: '#666666' },
      tableHeader: { bold: true, fontSize: 9, fillColor: '#eeeeee' },
    },
    defaultStyle: { fontSize: 9 },
  };

  return renderPdfBuffer(doc);
}
