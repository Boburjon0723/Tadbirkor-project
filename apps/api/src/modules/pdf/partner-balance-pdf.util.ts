import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { fmtPdfDate, formatPdfMoney, renderPdfBuffer } from './pdfmake-setup';

type Tx = {
  date: Date | string;
  description: string;
  debit: number;
  credit: number;
  currency: string;
};

export type PartnerBalancePdfData = {
  transactions: Tx[];
  partner: { name: string; tin?: string | null; address?: string | null; phone?: string | null };
  myCompany: { name: string; tin?: string | null; address?: string | null; phone?: string | null };
};

const formatMoney = formatPdfMoney;

const fmtDate = fmtPdfDate;

export async function generatePartnerBalancePdfBuffer(
  data: PartnerBalancePdfData,
  query: { dateFrom?: string; dateTo?: string },
): Promise<Buffer> {

  const transactions = data.transactions || [];
  const balances: Record<string, number> = { UZS: 0, USD: 0 };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tableBody: any[][] = [
    [
      { text: 'Sana', style: 'tableHeader' },
      { text: 'Operatsiya', style: 'tableHeader' },
      { text: 'Val', style: 'tableHeader' },
      { text: 'Debet (+)', style: 'tableHeader', alignment: 'right' },
      { text: 'Kredit (-)', style: 'tableHeader', alignment: 'right' },
      { text: 'Qoldiq', style: 'tableHeader', alignment: 'right' },
    ],
  ];

  if (transactions.length === 0) {
    tableBody.push([
      { text: "Operatsiyalar yo'q", colSpan: 6, alignment: 'center', italics: true },
      '',
      '',
      '',
      '',
      '',
    ]);
  } else {
    for (const t of transactions) {
      const cur = t.currency === 'USD' ? 'USD' : 'UZS';
      balances[cur] += t.debit - t.credit;
      const run = balances[cur];
      tableBody.push([
        fmtDate(t.date),
        t.description,
        cur,
        { text: t.debit > 0 ? formatMoney(t.debit, cur) : '—', alignment: 'right' },
        { text: t.credit > 0 ? formatMoney(t.credit, cur) : '—', alignment: 'right' },
        { text: formatMoney(run, cur), alignment: 'right', bold: true },
      ]);
    }
  }

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
  const rangeFrom = query.dateFrom || 'Boshidan';
  const rangeTo = query.dateTo || 'Bugungacha';

  const docDefinition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 50],
    defaultStyle: { font: 'Roboto', fontSize: 9 },
    styles: {
      title: { fontSize: 16, bold: true, alignment: 'center', margin: [0, 0, 0, 4] },
      subtitle: { fontSize: 10, color: '#666666', alignment: 'center', margin: [0, 0, 0, 16] },
      sectionTitle: {
        fontSize: 9,
        bold: true,
        color: '#666666',
        margin: [0, 0, 0, 6],
      },
      tableHeader: { bold: true, fontSize: 8, color: 'white', fillColor: '#333333' },
    },
    content: [
      { text: "O'zaro hisob-kitoblar dalolatnomasi (Akt sverka)", style: 'title' },
      { text: `Sana oralig'i: ${rangeFrom} — ${rangeTo}`, style: 'subtitle' },
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: 'TASHKILOT', style: 'sectionTitle' },
              { text: myName, bold: true },
              { text: `STIR: ${data.myCompany?.tin || '—'}` },
              { text: data.myCompany?.address || '' },
              { text: `Tel: ${data.myCompany?.phone || ''}` },
            ],
          },
          {
            width: '*',
            alignment: 'right',
            stack: [
              { text: 'HAMKOR', style: 'sectionTitle', alignment: 'right' },
              { text: partnerName, bold: true },
              { text: `STIR: ${data.partner?.tin || '—'}` },
              { text: data.partner?.address || '' },
              { text: `Tel: ${data.partner?.phone || ''}` },
            ],
          },
        ],
        margin: [0, 0, 0, 16],
      },
      {
        table: {
          widths: ['*'],
          body: [
            [
              {
                text: [
                  { text: 'UZS: ', bold: true },
                  `Debet ${formatMoney(totalDebitUzs, 'UZS')} · Kredit ${formatMoney(totalCreditUzs, 'UZS')} · Qoldiq ${formatMoney(balances.UZS, 'UZS')}`,
                ],
              },
            ],
            [
              {
                text: [
                  { text: 'USD: ', bold: true },
                  `Debet ${formatMoney(totalDebitUsd, 'USD')} · Kredit ${formatMoney(totalCreditUsd, 'USD')} · Qoldiq ${formatMoney(balances.USD, 'USD')}`,
                ],
              },
            ],
          ],
        },
        layout: {
          fillColor: () => '#f8fafc',
          hLineColor: () => '#e2e8f0',
          vLineColor: () => '#e2e8f0',
        },
        margin: [0, 0, 0, 16],
      },
      {
        table: {
          headerRows: 1,
          widths: [55, '*', 28, 72, 72, 72],
          body: tableBody,
        },
        layout: {
          fillColor: (rowIndex: number) => (rowIndex === 0 ? '#333333' : null),
          hLineWidth: () => 0.5,
          vLineWidth: () => 0,
          hLineColor: () => '#eeeeee',
          paddingLeft: () => 6,
          paddingRight: () => 6,
          paddingTop: () => 5,
          paddingBottom: () => 5,
        },
      },
      {
        columns: [
          {
            width: '*',
            stack: [
              { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 220, y2: 0, lineWidth: 0.5 }] },
              { text: myName, margin: [0, 8, 0, 4] },
              { text: "M.O'. ___________________", alignment: 'center' },
            ],
          },
          {
            width: '*',
            stack: [
              { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 220, y2: 0, lineWidth: 0.5 }] },
              { text: partnerName, margin: [0, 8, 0, 4] },
              { text: "M.O'. ___________________", alignment: 'center' },
            ],
          },
        ],
        margin: [0, 24, 0, 0],
      },
    ],
  };

  return renderPdfBuffer(docDefinition);
}
