import type ExcelJS from 'exceljs';

export type ParsedPartnerOrderRow = {
  rowNumber: number;
  sku?: string;
  barcode?: string;
  productHint?: string;
  variantHint?: string;
  quantity: number;
};

export type PartnerOrderVariantCandidate = {
  id: string;
  sku: string | null;
  barcode: string | null;
  name: string;
  product: { name: string };
};

export type PartnerOrderExcelPreviewLine = {
  rowNumber: number;
  productVariantId: string;
  productName: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  salePrice: number;
  currency: string;
  stockQty: number;
  quantity: number;
  lineTotal: number;
};

const HEADER_ALIASES: Record<string, string[]> = {
  sku: ['sku', 'kod', 'code', 'artikul', 'артикул'],
  barcode: ['shtrix', 'barcode', 'bar kod', 'штrix', 'shtrix-kod'],
  product: ['mahsulot', 'nomi', 'product', 'tovar'],
  variant: ['variant', 'rang', 'color', 'ölcham', 'olcham', 'size'],
  quantity: ['miqdor', 'qty', 'quantity', 'soni'],
};

export function normPartnerOrderText(value: string | undefined | null): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

/** Excel: SKU/mahsulot faqat guruhning birinchi qatorida — pastga tarqatiladi */
export function applyPartnerOrderSkuFillDown(rows: ParsedPartnerOrderRow[]): ParsedPartnerOrderRow[] {
  let lastSku = '';
  let lastProduct = '';
  return rows.map((row) => {
    let sku = String(row.sku || '').trim();
    let productHint = String(row.productHint || '').trim();

    if (sku && !productHint) productHint = sku;
    if (!productHint && lastProduct) productHint = lastProduct;
    if (!sku && lastSku && normPartnerOrderText(productHint) === lastProduct) {
      sku = lastSku;
    }

    if (sku) lastSku = sku;
    if (productHint) lastProduct = normPartnerOrderText(productHint);

    return {
      ...row,
      sku: sku || undefined,
      productHint: productHint || undefined,
    };
  });
}

export function matchPartnerOrderVariant(
  row: Pick<ParsedPartnerOrderRow, 'sku' | 'barcode' | 'productHint' | 'variantHint'>,
  variants: PartnerOrderVariantCandidate[],
): PartnerOrderVariantCandidate | null {
  const skuKey = normPartnerOrderText(row.sku);
  const barcode = String(row.barcode || '').trim();
  const productKey = normPartnerOrderText(row.productHint);
  const variantKey = normPartnerOrderText(row.variantHint);

  if (barcode) {
    const byBarcode = variants.filter((v) => v.barcode?.trim() === barcode);
    if (byBarcode.length === 1) return byBarcode[0];
    if (byBarcode.length > 1 && variantKey) {
      const narrowed = byBarcode.filter((v) => normPartnerOrderText(v.name) === variantKey);
      if (narrowed.length === 1) return narrowed[0];
    }
  }

  if (skuKey && variantKey) {
    const exact = variants.filter(
      (v) =>
        normPartnerOrderText(v.name) === variantKey &&
        (normPartnerOrderText(v.sku) === skuKey || normPartnerOrderText(v.product.name) === skuKey),
    );
    if (exact.length === 1) return exact[0];
    if (exact.length > 1) return null;
  }

  if (skuKey && !variantKey) {
    const bySku = variants.filter((v) => v.sku && normPartnerOrderText(v.sku) === skuKey);
    if (bySku.length === 1) return bySku[0];
  }

  if (productKey && variantKey) {
    const byName = variants.filter(
      (v) =>
        normPartnerOrderText(v.product.name) === productKey &&
        normPartnerOrderText(v.name) === variantKey,
    );
    if (byName.length === 1) return byName[0];
  }

  if (skuKey && !variantKey) {
    const byProductName = variants.filter(
      (v) => normPartnerOrderText(v.product.name) === skuKey,
    );
    if (byProductName.length === 1) return byProductName[0];
  }

  return null;
}

function normHeader(v: unknown): string {
  return String(v ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function cellStr(row: ExcelJS.Row, col: number): string {
  const cell = row.getCell(col);
  const v = cell.value;
  if (v == null) return '';
  if (typeof v === 'object' && v !== null && 'text' in v) return String((v as { text: string }).text).trim();
  if (typeof v === 'object' && v !== null && 'result' in v) return String((v as { result: unknown }).result ?? '').trim();
  return String(v).trim();
}

function cellQty(row: ExcelJS.Row, col: number): number {
  const raw = cellStr(row, col).replace(',', '.');
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : NaN;
}

function findWorksheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet {
  const named =
    workbook.getWorksheet('Buyurtma') ||
    workbook.getWorksheet('buyurtma') ||
    workbook.getWorksheet('Order');
  if (named) return named;
  return workbook.worksheets[0];
}

function detectColumns(headerRow: ExcelJS.Row): {
  sku?: number;
  barcode?: number;
  product?: number;
  variant?: number;
  quantity?: number;
} {
  const cols: Record<string, number> = {};
  headerRow.eachCell({ includeEmpty: false }, (cell, col) => {
    const h = normHeader(cell.value);
    for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.some((a) => h.includes(a))) {
        cols[key] = col;
      }
    }
  });
  return cols;
}

export function parsePartnerOrderExcelRows(sheet: ExcelJS.Worksheet): ParsedPartnerOrderRow[] {
  if (!sheet || sheet.rowCount < 2) return [];

  const headerRow = sheet.getRow(1);
  let cols = detectColumns(headerRow);
  let dataStart = 2;

  if (!cols.quantity) {
    cols = { sku: 1, barcode: 2, product: 3, variant: 4, quantity: 5 };
    const first = normHeader(headerRow.getCell(1).value);
    if (first.includes('sku') || first.includes('miqdor') || first.includes('mahsulot')) {
      dataStart = 2;
    } else {
      dataStart = 1;
    }
  }

  const qtyCol = cols.quantity || (cols.variant ? cols.variant + 1 : 4);
  const rows: ParsedPartnerOrderRow[] = [];

  for (let r = dataStart; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const sku = cols.sku ? cellStr(row, cols.sku) : cellStr(row, 1);
    const barcode = cols.barcode ? cellStr(row, cols.barcode) : cellStr(row, 2);
    const productHint = cols.product ? cellStr(row, cols.product) : cellStr(row, 3);
    const variantHint = cols.variant ? cellStr(row, cols.variant) : '';
    const quantity = cellQty(row, qtyCol);

    if (!sku && !barcode && !productHint && !variantHint) continue;
    if (!Number.isFinite(quantity) || quantity <= 0) {
      if (sku || barcode || productHint || variantHint) {
        rows.push({
          rowNumber: r,
          sku: sku || undefined,
          barcode: barcode || undefined,
          productHint: productHint || undefined,
          variantHint: variantHint || undefined,
          quantity: 0,
        });
      }
      continue;
    }

    rows.push({
      rowNumber: r,
      sku: sku || undefined,
      barcode: barcode || undefined,
      productHint: productHint || undefined,
      variantHint: variantHint || undefined,
      quantity,
    });
  }

  return applyPartnerOrderSkuFillDown(rows);
}

export async function loadPartnerOrderRowsFromBuffer(buffer: Buffer): Promise<ParsedPartnerOrderRow[]> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  const sheet = findWorksheet(workbook);
  return parsePartnerOrderExcelRows(sheet);
}
