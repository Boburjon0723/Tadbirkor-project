/**
 * npx ts-node src/modules/products/product-import-excel.util.spec.ts
 */
import * as ExcelJS from 'exceljs';
import {
  detectProductImportExcelFormat,
  importVariantIdentityKey,
  parseImportColorVariantFields,
  parseImportCurrencyCell,
  parseImportNameSkuFields,
  parseMoneyCell,
  parseExcelDecimalCell,
  parseProductImportExcelRow,
  parseProductUnitInput,
  productImportExcelColumns,
  resolveImportCurrency,
  resolveImportTrailingColumnIndexes,
} from './product-import-excel.util';

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function cell(value: ExcelJS.CellValue, text?: string): ExcelJS.Cell {
  return { value, text: text ?? (value != null ? String(value) : '') } as ExcelJS.Cell;
}

async function splitTemplateWorksheet(): Promise<ExcelJS.Worksheet> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Import');
  ws.columns = productImportExcelColumns();
  ws.addRow({
    name: 'BX-109',
    sku: 'BX-109',
    color: 'tilla (40886)',
    variant: '',
    purchasePrice: '',
    salePrice: 5.8,
    currency: 'USD',
    initialStock: 100,
    unit: 'kg',
    categoryName: 'Bubon',
    warehouseName: 'Nuurhome',
  });
  return ws;
}

async function main() {
  const ws = await splitTemplateWorksheet();
  assert(detectProductImportExcelFormat(ws) === 'split', 'yangi shablon = split');

  const row = ws.getRow(2);
  const trailing = resolveImportTrailingColumnIndexes(ws);
  const parsed = parseProductImportExcelRow(row, 'split', {
    parseString: (c) => String(c?.text ?? c?.value ?? '').trim(),
    parseStock: (c) => {
      const n = Number(c?.value);
      return Number.isFinite(n) ? n : null;
    },
  }, trailing);
  assert(parsed.salePrice === 5.8, `sotuv narxi 5.8, got ${parsed.salePrice}`);
  assert(parsed.currency === 'USD', `valyuta USD, got ${parsed.currency}`);
  assert(parsed.unit === 'kg', `birlik kg, got ${parsed.unit}`);

  assert(parseProductUnitInput('litr').unit === 'l', 'litr -> l');
  assert(parseProductUnitInput('metr').unit === 'm', 'metr -> m');
  assert(parseProductUnitInput('xyz').invalid, 'noto\'g\'ri birlik');

  assert(parseExcelDecimalCell(cell(1.23)) === 1.23, 'raqam 1.23');
  assert(parseExcelDecimalCell(cell('12,5', '12,5')) === 12.5, 'matn 12,5');
  assert(parseExcelDecimalCell(cell('2.75', '2.75')) === 2.75, 'matn 2.75');

  assert(parseImportCurrencyCell(cell(5.8, '5,8')) === '', 'raqam valyuta emas');
  assert(resolveImportCurrency('5', 'USD') === 'USD', 'raqam + hint');

  const money = parseMoneyCell(cell(5.8, '5,8'));
  assert(money.amount === 5.8, 'parseMoneyCell 5,8');

  const moneyText = parseMoneyCell(cell('5,8', '5,8'));
  assert(moneyText.amount === 5.8, 'parseMoneyCell matn 5,8');

  assert(
    importVariantIdentityKey('OBT-072', '', 'tilla (40686)') ===
      'obt-072|color:tilla (40686)',
    'rang bo‘yicha key',
  );
  assert(
    importVariantIdentityKey('OBT-072', 'qaymoq', '') === 'obt-072|variant:qaymoq',
    'variant bo‘yicha key',
  );
  assert(
    importVariantIdentityKey('OBT-072', 'qaymoq', 'tilla') === 'obt-072|color:tilla',
    'rang ustunlik',
  );

  const nameSku = parseImportNameSkuFields('BYT-014/A', '');
  assert(nameSku.sku === 'BYT-014' && nameSku.name === 'BYT-014/A', 'nom/kod ajratish');

  const colorVar = parseImportColorVariantFields('tilla (40686)', '');
  assert(colorVar.color === 'tilla' && colorVar.variant === '', 'tilla (40686)');

  console.log('product-import-excel.util.spec.ts: OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
