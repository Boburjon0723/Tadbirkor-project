import type ExcelJS from 'exceljs';

/** Yangi format: Rang va Variant nomi alohida ustunlar */
export type ProductImportExcelFormat = 'split' | 'legacy';

export const PRODUCT_UNIT_CODES = ['dona', 'kg', 'l', 'm'] as const;
export type ProductUnitCode = (typeof PRODUCT_UNIT_CODES)[number];

export const PRODUCT_UNIT_LABELS: Record<ProductUnitCode, string> = {
  dona: 'dona',
  kg: 'kg',
  l: 'litr',
  m: 'metr',
};

const PRODUCT_UNIT_ALIASES: Record<string, ProductUnitCode> = {
  dona: 'dona',
  don: 'dona',
  ta: 'dona',
  pcs: 'dona',
  pc: 'dona',
  sht: 'dona',
  шт: 'dona',
  kg: 'kg',
  kilogramm: 'kg',
  kilogram: 'kg',
  kilo: 'kg',
  кг: 'kg',
  l: 'l',
  litr: 'l',
  liter: 'l',
  litre: 'l',
  ltr: 'l',
  л: 'l',
  m: 'm',
  metr: 'm',
  meter: 'm',
  metre: 'm',
  метр: 'm',
  mt: 'm',
};

/** Excel/import: dona, kg, l, m (litr, metr va boshqalar sinonim) */
export function normalizeProductUnit(
  raw?: string | null,
  fallback: ProductUnitCode = 'dona',
): ProductUnitCode {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, '');
  if (!s) return fallback;
  const mapped = PRODUCT_UNIT_ALIASES[s];
  if (mapped) return mapped;
  if ((PRODUCT_UNIT_CODES as readonly string[]).includes(s)) {
    return s as ProductUnitCode;
  }
  return fallback;
}

export function parseProductUnitInput(raw?: string | null): {
  unit: ProductUnitCode | '';
  invalid: boolean;
} {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return { unit: '', invalid: false };
  const key = trimmed
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, '');
  const mapped = PRODUCT_UNIT_ALIASES[key];
  if (mapped) return { unit: mapped, invalid: false };
  if ((PRODUCT_UNIT_CODES as readonly string[]).includes(key)) {
    return { unit: key as ProductUnitCode, invalid: false };
  }
  return { unit: '', invalid: true };
}

export type ParsedProductImportRow = {
  name: string;
  sku: string;
  barcode: string;
  color: string;
  variant: string;
  variantId?: string;
  purchasePrice: number;
  salePrice: number;
  currency: string;
  initialStock: number;
  initialStockRaw: number | null;
  unitRaw: string;
  unit: ProductUnitCode | '';
  categoryName: string;
  warehouseName: string;
};

export function productImportExcelColumns(): Partial<ExcelJS.Column>[] {
  return [
    { header: 'Mahsulot Nomi', key: 'name', width: 30 },
    { header: 'SKU (Majburiy emas)', key: 'sku', width: 20 },
    { header: 'Shtrix-kod', key: 'barcode', width: 20 },
    { header: 'Rang', key: 'color', width: 16 },
    { header: 'Variant nomi', key: 'variant', width: 22 },
    { header: 'Kirim Narxi', key: 'purchasePrice', width: 15 },
    { header: 'Sotuv Narxi', key: 'salePrice', width: 15 },
    { header: 'Valyuta (UZS/USD)', key: 'currency', width: 16 },
    { header: 'Kirim / Qoldiq', key: 'initialStock', width: 15 },
    { header: 'Birlik (dona/kg/l/m)', key: 'unit', width: 18 },
    { header: 'Kategoriya (masalan: Ota > Bola)', key: 'categoryName', width: 34 },
    { header: 'Ombor Nomi', key: 'warehouseName', width: 20 },
  ];
}

function importHeaderText(worksheet: ExcelJS.Worksheet, col: number): string {
  const cell = worksheet.getRow(1).getCell(col);
  const text = String(cell?.text ?? '').trim();
  if (text) return text.toLowerCase();
  const raw = cell?.value;
  if (typeof raw === 'string') return raw.trim().toLowerCase();
  return '';
}

/** Import varag\'i: avvalo "Import" nomi, keyin mahsulot sarlavhasi bo\'yicha */
export function findProductImportWorksheet(
  workbook: ExcelJS.Workbook,
): ExcelJS.Worksheet | undefined {
  const byName = workbook.worksheets.find(
    (ws) => ws.name.trim().toLowerCase() === 'import',
  );
  if (byName) return byName;
  return workbook.worksheets.find((ws) => {
    const h1 = importHeaderText(ws, 1);
    return h1.includes('mahsulot') || h1.includes('product');
  });
}

export function detectProductImportExcelFormat(
  worksheet: ExcelJS.Worksheet,
): ProductImportExcelFormat {
  const h4 = importHeaderText(worksheet, 4);
  const h5 = importHeaderText(worksheet, 5);
  const h6 = importHeaderText(worksheet, 6);
  const h7 = importHeaderText(worksheet, 7);
  const h8 = importHeaderText(worksheet, 8);

  if (h4.includes('rangi/varianti')) return 'legacy';

  const splitPriceCol =
    h7.includes('sotuv') || h7.includes('sale') || h7.includes('narxi');
  const splitCurrencyCol =
    h8.includes('valyuta') || h8.includes('currency') || h8.includes('uzs');
  if (
    (h4 === 'rang' || h4.startsWith('rang')) &&
    (h5.includes('variant') || h5.startsWith('variant')) &&
    splitPriceCol &&
    splitCurrencyCol
  ) {
    return 'split';
  }

  if (h4 === 'rang' || h4.startsWith('rang')) return 'split';
  if (h5.includes('variant nomi') || h5.startsWith('variant')) return 'split';

  const legacyCurrencyCol =
    h7.includes('valyuta') || h7.includes('currency') || h7.includes('uzs');
  const legacySaleCol =
    h6.includes('sotuv') || h6.includes('sale') || h6.includes('narxi');
  if (legacyCurrencyCol && legacySaleCol && !h5.includes('variant')) {
    return 'legacy';
  }

  if (h6.includes('kirim') && !h5.includes('variant')) {
    return 'legacy';
  }
  return 'split';
}

/** H ustuni: faqat matn (USD/UZS). Raqam — noto\'g\'ri ustun, bo\'sh qaytadi. */
export function parseImportCurrencyCell(cell: ExcelJS.Cell): string {
  const raw = cell?.value;
  if (raw == null || raw === '') return '';
  if (typeof raw === 'string') return raw.trim();
  if (typeof raw === 'number') return '';
  const text = String(cell?.text ?? '').trim();
  if (text) return text;
  return String(raw).trim();
}

/** "5 USD", "5,8 USD", "5 000" kabi Excel qiymatlarini ajratish */
export function parseMoneyCell(cell: ExcelJS.Cell): {
  amount: number;
  currency?: 'UZS' | 'USD';
  raw: string;
} {
  const text = String(cell?.text ?? '').trim();
  const rawVal = cell?.value;

  if (typeof rawVal === 'number' && Number.isFinite(rawVal) && !text) {
    return { amount: rawVal, raw: String(rawVal) };
  }

  const raw =
    text ||
    (typeof rawVal === 'string' ? rawVal.trim() : '') ||
    (rawVal != null ? String(rawVal).trim() : '');

  if (!raw) {
    return { amount: 0, raw: '' };
  }

  const normalized = raw.replace(/\s+/g, ' ').trim();
  const match =
    normalized.match(/^([\d][\d\s]*(?:[.,]\d+)?)\s*(uzs|usd)?$/i) ||
    normalized.match(/^(uzs|usd)\s*([\d][\d\s]*(?:[.,]\d+)?)$/i);

  if (match) {
    const amountPart = (match[1] || match[2] || '')
      .replace(/\s/g, '')
      .replace(',', '.');
    const amount = parseFloat(amountPart);
    const curToken = String(
      /^(uzs|usd)$/i.test(String(match[2] || ''))
        ? match[2]
        : match[3] || '',
    ).toUpperCase();
    const currency =
      curToken === 'USD' ? 'USD' : curToken === 'UZS' ? 'UZS' : undefined;
    if (Number.isFinite(amount)) {
      return { amount, currency, raw: normalized };
    }
  }

  const digits = normalized.replace(/[^\d.,-]/g, '').replace(',', '.');
  const amount = parseFloat(digits);
  return {
    amount: Number.isFinite(amount) ? amount : 0,
    raw: normalized,
  };
}

/**
 * Excel qoldiq: 1.23, 1,23, "12,5", "1 234,56" (Excel raqam yoki matn).
 * Bo'sh / "-" → null.
 */
export function parseExcelDecimalCell(cell: ExcelJS.Cell): number | null {
  const text = String(cell?.text ?? '').trim();
  if (!text || text === '-' || text === '—') return null;

  const raw = cell?.value;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }

  const rawStr =
    text ||
    (typeof raw === 'string' ? raw.trim() : '') ||
    (raw != null ? String(raw).trim() : '');
  if (!rawStr) return null;

  let normalized = rawStr.replace(/\s/g, '');

  const lastComma = normalized.lastIndexOf(',');
  const lastDot = normalized.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) {
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else {
      normalized = normalized.replace(/,/g, '');
    }
  } else if (lastComma > -1) {
    normalized = normalized.replace(',', '.');
  }

  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

export function resolveImportCurrency(
  currencyCellText: string,
  priceHint?: 'UZS' | 'USD',
): string {
  const raw = String(currencyCellText || '').trim().toUpperCase();
  if (/^\d+([.,]\d+)?$/.test(raw)) {
    if (priceHint === 'USD' || priceHint === 'UZS') return priceHint;
    return 'UZS';
  }
  if (raw === 'USD' || raw === 'UZS') return raw;
  if (priceHint === 'USD' || priceHint === 'UZS') return priceHint;
  if (/\bUSD\b/.test(raw) || raw.includes('$')) return 'USD';
  if (/\bUZS\b/.test(raw)) return 'UZS';
  if (/[\d]/.test(raw) && /USD/.test(raw)) return 'USD';
  if (/[\d]/.test(raw) && /UZS/.test(raw)) return 'UZS';
  return raw || 'UZS';
}

/** Eski bitta ustun: "Qora / M" → rang + variant nomi */
export function parseLegacyCombinedVariant(value: string): {
  color: string;
  variant: string;
} {
  const raw = String(value || '').trim();
  if (!raw) return { color: '', variant: '' };
  const slash = raw.match(/^(.+?)\s*\/\s*(.+)$/);
  if (slash) {
    return { color: slash[1].trim(), variant: slash[2].trim() };
  }
  return parseImportColorVariantFields(raw, '');
}

/**
 * A = nom, B = SKU. B bo'sh bo'lsa A dan ajratish: "BYT-014/A" → sku BYT-014.
 */
export function parseImportNameSkuFields(
  nameRaw: string,
  skuRaw: string,
): { name: string; sku: string } {
  const name = String(nameRaw || '').trim();
  const skuFromColumn = String(skuRaw || '').trim();
  if (skuFromColumn) {
    return { name, sku: skuFromColumn };
  }
  if (!name) return { name: '', sku: '' };

  const slashCode = name.match(/^([A-Za-z0-9][A-Za-z0-9._-]*)\s*\/\s*(.+)$/);
  if (slashCode) {
    return { name: name.trim(), sku: slashCode[1].trim() };
  }

  if (/^[A-Za-z]{1,6}[-_]?\d{2,}[A-Za-z0-9/-]*$/i.test(name)) {
    return { name, sku: name };
  }

  return { name, sku: '' };
}

/**
 * D = rang, E = variant. E bo'sh: "tilla (40686)" → rang tilla; raqamli kod variant emas.
 */
export function parseImportColorVariantFields(
  colorRaw: string,
  variantRaw: string,
): { color: string; variant: string } {
  let color = String(colorRaw || '').trim();
  let variant = String(variantRaw || '').trim();

  if (!color && variant) {
    const fromVariant = parseImportColorVariantFields(variant, '');
    return fromVariant;
  }

  if (color && !variant) {
    const slash = color.match(/^(.+?)\s*\/\s*(.+)$/);
    if (slash) {
      return { color: slash[1].trim(), variant: slash[2].trim() };
    }
    const paren = color.match(/^(.+?)\s*\(\s*([^)]+)\s*\)\s*$/);
    if (paren) {
      const label = paren[1].trim();
      const inside = paren[2].trim();
      if (/^\d+$/.test(inside)) {
        return { color: label, variant: '' };
      }
      if (/^(xs|s|m|l|xl|xxl|xxxl|2xl|3xl|\d+)$/i.test(inside)) {
        return { color: label, variant: inside };
      }
      return { color: label, variant: inside };
    }
  }

  if (
    color &&
    variant &&
    color.trim().toLowerCase() === variant.trim().toLowerCase()
  ) {
    variant = '';
  }

  return { color, variant };
}

export function exportVariantExcelFields(variant: {
  name: string;
  attributesJson?: unknown;
}): { color: string; variant: string } {
  const attrs = (variant.attributesJson || {}) as Record<string, unknown>;
  const colorRaw = attrs.color ?? attrs.rang;
  const color = colorRaw != null ? String(colorRaw).trim() : '';
  const variantName = String(variant.name || '').trim();
  const variantOut =
    variantName &&
    variantName.toLowerCase() !== color.toLowerCase() &&
    !isGenericImportVariantName(variantName)
      ? variantName
      : '';
  return {
    color,
    variant: variantOut,
  };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isImportVariantIdValue(value: string): boolean {
  return UUID_RE.test(String(value || '').trim());
}

/** Excelda zaxira/kirim ustuni bor-yo'qligi (sarlavha qatoridan) */
export function worksheetHasStockColumn(worksheet: ExcelJS.Worksheet): boolean {
  for (let col = 1; col <= 24; col += 1) {
    const h = importHeaderText(worksheet, col);
    if (!h) continue;
    if (
      h.includes('qoldiq') ||
      h.includes('stock') ||
      h.includes('boshlang') ||
      h.includes('kirim') ||
      h.includes('miqdor') ||
      h.includes('soni') ||
      h.includes('quantity') ||
      h.includes('qty') ||
      h.includes('kol')
    ) {
      return true;
    }
  }
  return false;
}

/** Import: qoldiqdan keyingi ustunlar sarlavha bo'yicha (yangi/esk shablon) */
export function resolveImportTrailingColumnIndexes(worksheet: ExcelJS.Worksheet): {
  stockCol: number;
  unitCol: number;
  categoryCol: number;
  warehouseCol: number;
  variantIdCol: number;
} {
  let stockCol = 9;
  let unitCol = 0;
  let categoryCol = 10;
  let warehouseCol = 11;
  let variantIdCol = 12;
  for (let col = 1; col <= 24; col += 1) {
    const h = importHeaderText(worksheet, col);
    if (!h) continue;
    if (h.includes('variant id') || h.includes('variantid')) variantIdCol = col;
    else if (h.includes('ombor') || h.includes('warehouse')) warehouseCol = col;
    else if (h.includes('kategor')) categoryCol = col;
    else if (
      h.includes('birlik') ||
      h.includes("o'lchov") ||
      h.includes('olchov') ||
      h === 'unit' ||
      h.includes('birligi')
    ) {
      unitCol = col;
    } else if (
      h.includes('qoldiq') ||
      h.includes('stock') ||
      h.includes('boshlang') ||
      h.includes('kirim') ||
      h.includes('miqdor') ||
      h.includes('soni') ||
      h.includes('quantity') ||
      h.includes('qty') ||
      h.includes('kol')
    ) {
      stockCol = col;
    }
  }
  if (unitCol > 0) {
    if (categoryCol <= unitCol) categoryCol = unitCol + 1;
    if (warehouseCol <= unitCol) warehouseCol = Math.max(categoryCol + 1, unitCol + 2);
    if (variantIdCol <= warehouseCol) variantIdCol = warehouseCol + 1;
  }
  return { stockCol, unitCol, categoryCol, warehouseCol, variantIdCol };
}

/** @deprecated resolveImportTrailingColumnIndexes ishlating */
export function resolveImportSplitColumnIndexes(worksheet: ExcelJS.Worksheet): {
  categoryCol: number;
  warehouseCol: number;
  variantIdCol: number;
} {
  const t = resolveImportTrailingColumnIndexes(worksheet);
  return {
    categoryCol: t.categoryCol,
    warehouseCol: t.warehouseCol,
    variantIdCol: t.variantIdCol,
  };
}

export function readImportVariantIdCell(
  row: ExcelJS.Row,
  ...cols: number[]
): string | undefined {
  for (const col of cols) {
    const raw = String(row.getCell(col)?.text ?? row.getCell(col)?.value ?? '').trim();
    if (isImportVariantIdValue(raw)) return raw;
  }
  return undefined;
}

export function variantMatchKey(productName: string, variantName: string): string {
  return `${String(productName || '').trim().toLowerCase()}|${String(variantName || '').trim().toLowerCase()}`;
}

const GENERIC_VARIANT_NAMES = new Set([
  '',
  'standart',
  'standard',
  'default',
]);

export function isGenericImportVariantName(variantName: string): boolean {
  const raw = String(variantName || '').trim().toLowerCase();
  if (!raw || GENERIC_VARIANT_NAMES.has(raw)) return true;
  return raw.startsWith('default /');
}

/** Import: rang = variant identifikatori (SKU mahsulot darajasida) */
export function importVariantIdentityKey(
  productName: string,
  variant: string,
  color: string,
): string {
  const product = String(productName || '').trim().toLowerCase();
  const variantTrim = String(variant || '').trim();
  const colorTrim = String(color || '').trim().toLowerCase();
  if (colorTrim) return `${product}|color:${colorTrim}`;
  if (variantTrim && !isGenericImportVariantName(variantTrim)) {
    return `${product}|variant:${variantTrim.toLowerCase()}`;
  }
  return `${product}|default`;
}

export function resolveImportVariantDisplayName(
  productName: string,
  variant: string,
  color: string,
): string {
  const variantTrim = String(variant || '').trim();
  const colorTrim = String(color || '').trim();
  if (
    variantTrim &&
    !isGenericImportVariantName(variantTrim) &&
    !/^\d+$/.test(variantTrim)
  ) {
    return variantTrim;
  }
  if (colorTrim) return colorTrim;
  return `Default / ${String(productName || '').trim() || 'Mahsulot'}`;
}

type ParseCellHelpers = {
  parseString: (cell: ExcelJS.Cell) => string;
  parseStock: (cell: ExcelJS.Cell) => number | null;
};

function parseImportPriceFields(
  purchaseCell: ExcelJS.Cell,
  saleCell: ExcelJS.Cell,
  currencyCell: ExcelJS.Cell,
): Pick<ParsedProductImportRow, 'purchasePrice' | 'salePrice' | 'currency'> {
  const purchaseParsed = parseMoneyCell(purchaseCell);
  const saleParsed = parseMoneyCell(saleCell);
  const currency = resolveImportCurrency(
    parseImportCurrencyCell(currencyCell),
    saleParsed.currency || purchaseParsed.currency,
  );
  return {
    purchasePrice: purchaseParsed.amount,
    salePrice: saleParsed.amount,
    currency,
  };
}

function readImportUnitFields(
  row: ExcelJS.Row,
  unitCol: number,
  helpers: ParseCellHelpers,
): Pick<ParsedProductImportRow, 'unitRaw' | 'unit'> {
  if (unitCol <= 0) return { unitRaw: '', unit: '' };
  const unitRaw = helpers.parseString(row.getCell(unitCol));
  if (!unitRaw) return { unitRaw: '', unit: '' };
  const parsed = parseProductUnitInput(unitRaw);
  return { unitRaw, unit: parsed.invalid ? '' : parsed.unit };
}

export function parseProductImportExcelRow(
  row: ExcelJS.Row,
  format: ProductImportExcelFormat,
  helpers: ParseCellHelpers,
  trailingCols?: {
    stockCol: number;
    unitCol: number;
    categoryCol: number;
    warehouseCol: number;
    variantIdCol: number;
  },
): ParsedProductImportRow {
  if (format === 'legacy') {
    const combined = helpers.parseString(row.getCell(4));
    const legacyVariant = parseLegacyCombinedVariant(combined);
    const { color, variant } = parseImportColorVariantFields(
      legacyVariant.color || combined,
      legacyVariant.variant,
    );
    const { name, sku } = parseImportNameSkuFields(
      helpers.parseString(row.getCell(1)),
      helpers.parseString(row.getCell(2)),
    );
    const cols = trailingCols ?? {
      stockCol: 8,
      unitCol: 0,
      categoryCol: 9,
      warehouseCol: 10,
      variantIdCol: 11,
    };
    const parsedStock = helpers.parseStock(row.getCell(cols.stockCol));
    const prices = parseImportPriceFields(
      row.getCell(5),
      row.getCell(6),
      row.getCell(7),
    );
    return {
      name,
      sku,
      barcode: helpers.parseString(row.getCell(3)),
      color,
      variant,
      variantId: readImportVariantIdCell(row, cols.variantIdCol),
      ...prices,
      initialStock: parsedStock === null ? 0 : parsedStock,
      initialStockRaw: parsedStock,
      ...readImportUnitFields(row, cols.unitCol, helpers),
      categoryName: String(row.getCell(cols.categoryCol).text || ''),
      warehouseName: String(row.getCell(cols.warehouseCol).text || ''),
    };
  }

  const { name, sku } = parseImportNameSkuFields(
    helpers.parseString(row.getCell(1)),
    helpers.parseString(row.getCell(2)),
  );
  const { color, variant } = parseImportColorVariantFields(
    helpers.parseString(row.getCell(4)),
    helpers.parseString(row.getCell(5)),
  );
  const cols = trailingCols ?? {
    stockCol: 9,
    unitCol: 0,
    categoryCol: 10,
    warehouseCol: 11,
    variantIdCol: 12,
  };
  const parsedStock = helpers.parseStock(row.getCell(cols.stockCol));
  const prices = parseImportPriceFields(
    row.getCell(6),
    row.getCell(7),
    row.getCell(8),
  );
  return {
    name,
    sku,
    barcode: helpers.parseString(row.getCell(3)),
    color,
    variant,
    variantId: readImportVariantIdCell(
      row,
      cols.variantIdCol,
      cols.variantIdCol - 1,
    ),
    ...prices,
    initialStock: parsedStock === null ? 0 : parsedStock,
    initialStockRaw: parsedStock,
    ...readImportUnitFields(row, cols.unitCol, helpers),
    categoryName: String(row.getCell(cols.categoryCol).text || ''),
    warehouseName: String(row.getCell(cols.warehouseCol).text || ''),
  };
}

export function isProductImportRowEmpty(
  data: ParsedProductImportRow,
  format: ProductImportExcelFormat,
  row: ExcelJS.Row,
): boolean {
  const priceEmpty =
    format === 'legacy'
      ? !String(row.getCell(5).text || '').trim() &&
        !String(row.getCell(6).text || '').trim() &&
        !String(row.getCell(7).text || '').trim()
      : !String(row.getCell(6).text || '').trim() &&
        !String(row.getCell(7).text || '').trim() &&
        !String(row.getCell(8).text || '').trim();

  return (
    !String(data.name || '').trim() &&
    !String(data.sku || '').trim() &&
    !String(data.barcode || '').trim() &&
    !String(data.color || '').trim() &&
    !String(data.variant || '').trim() &&
    priceEmpty &&
    data.initialStockRaw === null &&
    !String(data.unitRaw || '').trim() &&
    !String(data.categoryName || '').trim() &&
    !String(data.warehouseName || '').trim()
  );
}

export function applyProductImportExcelFormats(worksheet: ExcelJS.Worksheet) {
  worksheet.getColumn(2).numFmt = '@';
  worksheet.getColumn(3).numFmt = '@';
  worksheet.getColumn(6).numFmt = '#,##0.00';
  worksheet.getColumn(7).numFmt = '#,##0.00';
  worksheet.getColumn(9).numFmt = '#,##0.####';
}

export function applyProductImportExportExtraFormats(worksheet: ExcelJS.Worksheet) {
  worksheet.getColumn(10).numFmt = '@';
  worksheet.getColumn(13).numFmt = '@';
}

/** Import varag\'ida dropdown validatsiya (yangi 11 ustun) */
export type ImportColumnGuideItem = {
  letter: string;
  header: string;
  required: boolean;
  hint: string;
};

export function getProductImportColumnGuide(
  format: ProductImportExcelFormat,
): { format: ProductImportExcelFormat; columns: ImportColumnGuideItem[]; tips: string[] } {
  if (format === 'legacy') {
    return {
      format: 'legacy',
      columns: [
        { letter: 'A', header: 'Mahsulot Nomi', required: true, hint: 'Majburiy' },
        { letter: 'B', header: 'SKU', required: false, hint: 'Ixtiyoriy, variantlarni guruhlash uchun' },
        { letter: 'C', header: 'Shtrix-kod', required: false, hint: 'Har variant uchun noyob' },
        { letter: 'D', header: 'Rangi/Varianti', required: false, hint: 'Masalan: Qora / L' },
        { letter: 'E', header: '—', required: false, hint: 'Bo\'sh qoldiring' },
        { letter: 'F', header: 'Kirim Narxi', required: false, hint: 'Raqam' },
        { letter: 'G', header: 'Sotuv Narxi', required: false, hint: 'Raqam (5.8 yoki 5,8)' },
        { letter: 'H', header: 'Valyuta', required: false, hint: 'Faqat USD yoki UZS' },
        { letter: 'I', header: "Boshlang'ich Qoldiq", required: false, hint: 'Butun son' },
        { letter: 'J', header: 'Birlik', required: false, hint: 'dona, kg, l, m' },
        { letter: 'K', header: 'Kategoriya', required: false, hint: 'Ota > Bola' },
        { letter: 'L', header: 'Ombor Nomi', required: false, hint: 'UI ombori ishlatiladi' },
      ],
      tips: [
        'Eski shablon (Rangi/Varianti bitta ustunda). Yangi shablonni yuklab oling.',
        'Varaq nomi "Import" bo\'lishi kerak.',
      ],
    };
  }

  return {
    format: 'split',
    columns: [
      { letter: 'A', header: 'Mahsulot Nomi', required: true, hint: 'Majburiy' },
      { letter: 'B', header: 'SKU', required: false, hint: 'Bir xil SKU = bir mahsulot, turli variantlar' },
      { letter: 'C', header: 'Shtrix-kod', required: false, hint: 'Har variant uchun noyob' },
      { letter: 'D', header: 'Rang', required: false, hint: 'Masalan: Qora, Ko\'k' },
      { letter: 'E', header: 'Variant nomi', required: false, hint: 'Masalan: L, XL' },
      { letter: 'F', header: 'Kirim Narxi', required: false, hint: 'Raqam' },
      { letter: 'G', header: 'Sotuv Narxi', required: false, hint: 'Raqam (5.8 yoki 5,8)' },
      { letter: 'H', header: 'Valyuta (UZS/USD)', required: false, hint: 'Faqat USD yoki UZS — raqam emas!' },
      { letter: 'I', header: "Boshlang'ich Qoldiq", required: false, hint: '1,23 yoki 1.23; kg/l/m + J birlik' },
      { letter: 'J', header: 'Birlik', required: false, hint: 'dona, kg, l (litr), m (metr)' },
      { letter: 'K', header: 'Kategoriya', required: false, hint: 'Masalan: Kiyim > Erkaklar' },
      { letter: 'L', header: 'Ombor Nomi', required: false, hint: 'Inventarda tanlangan ombor ishlatiladi' },
    ],
    tips: [
      '1-qator sarlavha — o\'zgartirmang. Ma\'lumot 2-qatordan.',
      'Faqat "Import" varag\'idagi faylni yuklang (Yoriqnoma/Lookup emas).',
      'Narx G ustunida, valyuta H ustunida alohida. H ga raqam (5, 5.8) yozmang.',
      'Birlik (J): dona, kg, l (litr), m (metr). Bo\'sh qoldirilsa — dona.',
      'Excelda vergul (5,8) yoki nuqta (5.8) — ikkalasi ham qabul qilinadi.',
      'Bir mahsulot — bir nechta qator (har rang/variant uchun alohida qator).',
    ],
  };
}

export function formatImportCurrencyError(
  format: ProductImportExcelFormat,
  badValue: string,
): string {
  const cols = format === 'legacy' ? { sale: 'G', currency: 'H' } : { sale: 'G', currency: 'H' };
  return (
    `Valyuta noto'g'ri: "${badValue}". ${cols.currency} ustuniga faqat USD yoki UZS yozing ` +
    `(sotuv narxi ${cols.sale} ustunida, masalan 5.8).`
  );
}

export function formatImportPriceError(
  field: 'purchase' | 'sale',
  format: ProductImportExcelFormat,
): string {
  const col = field === 'purchase' ? 'F' : 'G';
  return `${field === 'purchase' ? 'Kirim' : 'Sotuv'} narxi noto'g'ri (${col} ustuni). Raqam kiriting: 150000 yoki 5.8`;
}

export function formatProductUnitImportError(
  badValue: string,
  _format: ProductImportExcelFormat,
): string {
  return (
    `Birlik noto'g'ri: "${badValue}". J ustuniga dona, kg, l (litr) yoki m (metr) yozing.`
  );
}

export function applyProductImportSheetValidations(
  worksheet: ExcelJS.Worksheet,
  ranges: {
    categoryStart: number;
    categoryEnd: number;
    warehouseStart: number;
    warehouseEnd: number;
    currencyStart: number;
    currencyEnd: number;
    unitStart: number;
    unitEnd: number;
  },
) {
  for (let row = 2; row <= 5000; row += 1) {
    worksheet.getCell(`H${row}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [
        `Lookup!$C$${ranges.currencyStart}:$C$${ranges.currencyEnd}`,
      ],
      showErrorMessage: true,
      errorTitle: "Noto'g'ri valyuta",
      error: "Valyuta faqat UZS yoki USD bo'lishi kerak.",
    };
    worksheet.getCell(`J${row}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`Lookup!$D$${ranges.unitStart}:$D$${ranges.unitEnd}`],
      showErrorMessage: true,
      errorTitle: "Noto'g'ri birlik",
      error: "Birlik: dona, kg, l yoki m.",
    };
    worksheet.getCell(`K${row}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [
        `Lookup!$A$${ranges.categoryStart}:$A$${ranges.categoryEnd}`,
      ],
      showErrorMessage: false,
    };
    worksheet.getCell(`L${row}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [
        `Lookup!$B$${ranges.warehouseStart}:$B$${ranges.warehouseEnd}`,
      ],
      showErrorMessage: true,
      errorTitle: "Noto'g'ri ombor",
      error: "Ombor nomini ro'yxatdan tanlang.",
    };
  }
}
