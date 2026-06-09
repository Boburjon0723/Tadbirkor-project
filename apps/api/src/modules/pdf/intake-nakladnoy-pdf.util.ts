import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { fmtPdfDate, renderPdfBuffer } from './pdfmake-setup';

export type IntakeNakladnoyLine = {
  productName: string;
  variantName?: string | null;
  barcode?: string | null;
  sku?: string | null;
  unit?: string | null;
  quantity: number;
};

export type IntakeNakladnoyData = {
  reference: string;
  date: Date | string;
  companyName: string;
  companyTin?: string | null;
  warehouseName: string;
  warehouseWorkerName: string;
  note?: string | null;
  lines: IntakeNakladnoyLine[];
  totalPositions: number;
  totalUnits: number;
};

function lineLabel(line: IntakeNakladnoyLine): string {
  const base = line.variantName && line.variantName !== line.productName
    ? `${line.productName} / ${line.variantName}`
    : line.productName;
  const code = line.barcode || line.sku;
  return code ? `${base}\n${code}` : base;
}

export async function generateIntakeNakladnoyPdfBuffer(
  data: IntakeNakladnoyData,
): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tableBody: any[][] = [
    [
      { text: '№', style: 'tableHeader', alignment: 'center' },
      { text: 'Mahsulot nomi', style: 'tableHeader' },
      { text: "O'lchov", style: 'tableHeader', alignment: 'center' },
      { text: 'Miqdor', style: 'tableHeader', alignment: 'center' },
    ],
  ];

  data.lines.forEach((line, idx) => {
    tableBody.push([
      { text: String(idx + 1), alignment: 'center' },
      lineLabel(line),
      { text: line.unit || 'dona', alignment: 'center' },
      { text: String(line.quantity), alignment: 'center', bold: true },
    ]);
  });

  tableBody.push([
    { text: 'JAMI', colSpan: 3, bold: true, alignment: 'right', fillColor: '#ecfdf5' },
    '',
    '',
    {
      text: `${data.totalPositions} poz / ${data.totalUnits} dona`,
      alignment: 'center',
      bold: true,
      fillColor: '#ecfdf5',
    },
  ]);

  const docDefinition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 48],
    defaultStyle: { font: 'Roboto', fontSize: 9 },
    styles: {
      title: { fontSize: 16, bold: true, color: '#047857' },
      subtitle: { fontSize: 9, color: '#64748b' },
      tableHeader: { bold: true, fontSize: 8, color: '#475569' },
      label: { fontSize: 8, bold: true, color: '#047857' },
      signLabel: { fontSize: 9, bold: true },
      signLine: { fontSize: 10, margin: [0, 2, 0, 0] },
    },
    content: [
      {
        columns: [
          [
            { text: 'AXIS ERP', style: 'title' },
            { text: 'Omborga kirim nakladnoyi', style: 'subtitle' },
          ],
          {
            width: 'auto',
            alignment: 'right',
            stack: [
              { text: data.reference, bold: true, fontSize: 13 },
              { text: `Sana: ${fmtPdfDate(data.date)}`, style: 'subtitle' },
            ],
          },
        ],
      },
      { text: ' ', margin: [0, 10] },
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: 'Tashkilot', style: 'label' },
              { text: data.companyName, bold: true, fontSize: 11 },
              { text: `STIR: ${data.companyTin || '—'}`, style: 'subtitle' },
            ],
          },
          {
            width: '*',
            stack: [
              { text: 'Ombor', style: 'label' },
              { text: data.warehouseName, bold: true, fontSize: 11 },
            ],
          },
        ],
        columnGap: 24,
      },
      { text: ' ', margin: [0, 6] as [number, number] },
      ...(data.note ? [{ text: `Izoh: ${data.note}`, style: 'subtitle' }] : []),
      { text: ' ', margin: [0, 12] as [number, number] },
      {
        table: {
          headerRows: 1,
          widths: [28, '*', 52, 56],
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
      { text: ' ', margin: [0, 28] as [number, number] },
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: 'Omborchi (F.I.Sh.)', style: 'signLabel' },
              { text: data.warehouseWorkerName, bold: true, fontSize: 11, margin: [0, 6, 0, 0] as [number, number, number, number] },
              {
                canvas: [
                  { type: 'line', x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 0.5 },
                ],
                margin: [0, 4, 0, 0] as [number, number, number, number],
              },
              { text: "Qo'l qo'yildi", style: 'signLabel', margin: [0, 18, 0, 0] as [number, number, number, number] },
              {
                canvas: [
                  { type: 'line', x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 0.5 },
                ],
                margin: [0, 28, 0, 0] as [number, number, number, number],
              },
            ],
          },
          {
            width: '*',
            stack: [
              { text: 'Qabul qildi (boshqaruv)', style: 'signLabel' },
              { text: ' ', margin: [0, 6, 0, 0] as [number, number, number, number] },
              {
                canvas: [
                  { type: 'line', x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 0.5 },
                ],
                margin: [0, 4, 0, 0] as [number, number, number, number],
              },
              { text: "Qo'l qo'yildi", style: 'signLabel', margin: [0, 18, 0, 0] as [number, number, number, number] },
              {
                canvas: [
                  { type: 'line', x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 0.5 },
                ],
                margin: [0, 28, 0, 0] as [number, number, number, number],
              },
            ],
          },
        ],
        columnGap: 32,
      },
      {
        text: 'Ushbu hujjat omborga kirim qilingan mahsulotlarni tasdiqlaydi.',
        alignment: 'center',
        style: 'subtitle',
        margin: [0, 24, 0, 0] as [number, number, number, number],
      },
    ],
  };

  return renderPdfBuffer(docDefinition);
}
