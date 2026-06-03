import type { TDocumentDefinitions } from 'pdfmake/interfaces';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfmake = require('pdfmake') as {
  virtualfs: { writeFileSync: (name: string, content: Buffer) => void };
  setFonts: (fonts: Record<string, Record<string, string>>) => void;
  createPdf: (doc: TDocumentDefinitions) => { getBuffer: () => Promise<Buffer> };
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const vfs = require('pdfmake/build/vfs_fonts') as Record<string, string>;

let fontsReady = false;

export function ensurePdfMakeFonts() {
  if (fontsReady) return;
  for (const [filename, data] of Object.entries(vfs)) {
    pdfmake.virtualfs.writeFileSync(filename, Buffer.from(data, 'base64'));
  }
  pdfmake.setFonts({
    Roboto: {
      normal: 'Roboto-Regular.ttf',
      bold: 'Roboto-Medium.ttf',
      italics: 'Roboto-Italic.ttf',
      bolditalics: 'Roboto-MediumItalic.ttf',
    },
  });
  fontsReady = true;
}

export async function renderPdfBuffer(docDefinition: TDocumentDefinitions): Promise<Buffer> {
  ensurePdfMakeFonts();
  const doc = pdfmake.createPdf(docDefinition);
  return doc.getBuffer();
}

export const formatPdfMoney = (val: number, currency = 'UZS') => {
  const c = currency === 'USD' ? 'USD' : 'UZS';
  const amount = Number(val || 0);
  if (c === 'USD') {
    return `${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} USD`;
  }
  return `${Math.round(amount).toLocaleString('uz-UZ')} UZS`;
};

export const fmtPdfDate = (d: Date | string) => new Date(d).toLocaleDateString('uz-UZ');
