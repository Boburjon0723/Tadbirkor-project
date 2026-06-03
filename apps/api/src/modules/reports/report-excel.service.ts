import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportQueryDto } from './dto/report-query.dto';
import * as ExcelJS from 'exceljs';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import {
  applyProductImportExcelFormats,
  applyProductImportExportExtraFormats,
  applyProductImportSheetValidations,
  exportVariantExcelFields,
  productImportExcelColumns,
} from '../products/product-import-excel.util';
import { generateStockReportPdfBuffer } from '../pdf/stock-report-pdf.util';

@Injectable()
export class ReportExcelService {
  constructor(
    private prisma: PrismaService,
    private reportsQuery: ReportsService,
  ) {}

  async exportSummaryToExcel(
    companyId: string,
    query: { dateFrom?: string; dateTo?: string; warehouseId?: string },
    res: Response,
  ) {
    const [summary, daily, top] = await Promise.all([
      this.reportsQuery.getCostSummary(companyId, query),
      this.reportsQuery.getDailyBreakdown(companyId, query),
      this.reportsQuery.getTopProducts(companyId, { ...query, limit: 50 }),
    ]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Axis ERP';
    workbook.created = new Date();

    // 1) Yig'ma varaq
    const s1 = workbook.addWorksheet('Yig‘ma');
    s1.columns = [
      { header: 'Ko‘rsatkich', key: 'label', width: 30 },
      { header: 'UZS', key: 'uzs', width: 22 },
      { header: 'USD', key: 'usd', width: 22 },
    ];
    s1.getRow(1).font = { bold: true };
    s1.addRows([
      { label: 'Kirim summasi', uzs: summary.purchase.UZS, usd: summary.purchase.USD },
      { label: 'Sotuv summasi', uzs: summary.sales.UZS, usd: summary.sales.USD },
      { label: 'Foyda (sotuv − kirim)', uzs: summary.profit.UZS, usd: summary.profit.USD },
      { label: 'Marja %', uzs: summary.margin.UZS, usd: summary.margin.USD },
      { label: 'Ombor qiymati (hozir)', uzs: summary.inventoryValue.UZS, usd: summary.inventoryValue.USD },
    ]);
    s1.getColumn(2).numFmt = '#,##0.00';
    s1.getColumn(3).numFmt = '#,##0.00';
    s1.addRow({});
    s1.addRow({ label: 'Davr:', uzs: summary.period.from || '—', usd: summary.period.to || '—' });
    s1.addRow({ label: 'Ombor filtri:', uzs: summary.warehouseId || 'Hammasi' });

    // 2) Kunlik varaq
    const s2 = workbook.addWorksheet('Kunlik');
    s2.columns = [
      { header: 'Sana', key: 'date', width: 14 },
      { header: 'Kirim UZS', key: 'pUZS', width: 18 },
      { header: 'Kirim USD', key: 'pUSD', width: 18 },
      { header: 'Sotuv UZS', key: 'sUZS', width: 18 },
      { header: 'Sotuv USD', key: 'sUSD', width: 18 },
      { header: 'Foyda UZS', key: 'prUZS', width: 18 },
      { header: 'Foyda USD', key: 'prUSD', width: 18 },
    ];
    s2.getRow(1).font = { bold: true };
    daily.forEach((d) =>
      s2.addRow({
        date: d.date,
        pUZS: d.purchase.UZS,
        pUSD: d.purchase.USD,
        sUZS: d.sales.UZS,
        sUSD: d.sales.USD,
        prUZS: d.profit.UZS,
        prUSD: d.profit.USD,
      }),
    );
    [2, 3, 4, 5, 6, 7].forEach((c) => (s2.getColumn(c).numFmt = '#,##0.00'));

    // 3) Top mahsulotlar
    const s3 = workbook.addWorksheet('Top mahsulotlar');
    s3.columns = [
      { header: '#', key: 'rank', width: 5 },
      { header: 'Mahsulot', key: 'product', width: 28 },
      { header: 'Variant', key: 'variant', width: 18 },
      { header: 'SKU', key: 'sku', width: 14 },
      { header: 'Miqdor', key: 'qty', width: 12 },
      { header: 'Tushum', key: 'rev', width: 18 },
      { header: 'Valyuta', key: 'cur', width: 10 },
    ];
    s3.getRow(1).font = { bold: true };
    top.forEach((t, i) =>
      s3.addRow({
        rank: i + 1,
        product: t.productName,
        variant: t.variantName,
        sku: t.sku || '',
        qty: t.quantity,
        rev: t.revenue,
        cur: t.currency,
      }),
    );
    s3.getColumn(6).numFmt = '#,##0.00';

    const filename = `hisobot-${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    await workbook.xlsx.write(res);
    res.end();
  }


  async exportPartnerBalanceExcel(
    companyId: string,
    partnerCompanyId: string,
    query: { dateFrom?: string; dateTo?: string },
    res: Response,
  ) {
    const data = await this.reportsQuery.getPartnerDetailedBalance(companyId, partnerCompanyId, query);

    const formatMoney = (val: number, currency: string) => {
      const c = currency === 'USD' ? 'USD' : 'UZS';
      if (c === 'USD') {
        return `${Number(val || 0).toFixed(2)} USD`;
      }
      return `${Math.round(Number(val || 0)).toLocaleString('uz-UZ')} UZS`;
    };

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Tadbirkor';
    const sheet = workbook.addWorksheet('Akt sverka');

    sheet.mergeCells('A1:F1');
    sheet.getCell('A1').value = "O'zaro hisob-kitoblar dalolatnomasi (Akt sverka)";
    sheet.getCell('A1').font = { bold: true, size: 14 };

    sheet.getCell('A3').value = 'Tashkilot';
    sheet.getCell('A4').value = data.myCompany.name;
    sheet.getCell('A5').value = `STIR: ${data.myCompany.tin || '—'}`;

    sheet.getCell('D3').value = 'Hamkor';
    sheet.getCell('D4').value = data.partner.name;
    sheet.getCell('D5').value = `STIR: ${data.partner.tin || '—'}`;

    const headerRow = 8;
    sheet.getRow(headerRow).values = [
      'Sana',
      'Operatsiya',
      'Valyuta',
      'Debet (+)',
      'Kredit (-)',
      'Qoldiq',
    ];
    sheet.getRow(headerRow).font = { bold: true };

    const balances: Record<string, number> = { UZS: 0, USD: 0 };
    let rowIdx = headerRow + 1;
    for (const t of data.transactions) {
      const cur = t.currency === 'USD' ? 'USD' : 'UZS';
      balances[cur] += t.debit - t.credit;
      sheet.getRow(rowIdx).values = [
        new Date(t.date).toLocaleDateString('uz-UZ'),
        t.description,
        cur,
        t.debit > 0 ? t.debit : '',
        t.credit > 0 ? t.credit : '',
        balances[cur],
      ];
      rowIdx++;
    }

    sheet.getRow(rowIdx + 1).values = [
      'JAMI UZS qoldiq',
      '',
      'UZS',
      '',
      '',
      balances.UZS,
    ];
    sheet.getRow(rowIdx + 2).values = [
      'JAMI USD qoldiq',
      '',
      'USD',
      '',
      '',
      balances.USD,
    ];

    sheet.columns = [
      { width: 14 },
      { width: 36 },
      { width: 10 },
      { width: 16 },
      { width: 16 },
      { width: 16 },
    ];

    const safeName =
      data.partner.name
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .slice(0, 40) || 'hamkor';
    const filename = `akt-sverka-${safeName}-${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  }


  // --- EXCEL EXPORTS ---

  private buildCategoryPathMap(
    categories: Array<{ id: string; name: string; parentId: string | null }>,
  ) {
    const byId = new Map(categories.map((c) => [c.id, c]));
    const cache = new Map<string, string>();

    const resolve = (categoryId: string): string => {
      if (cache.has(categoryId)) return cache.get(categoryId)!;
      const parts: string[] = [];
      let current: { id: string; name: string; parentId: string | null } | undefined =
        byId.get(categoryId);
      const guard = new Set<string>();
      while (current) {
        if (guard.has(current.id)) break;
        guard.add(current.id);
        parts.unshift(current.name);
        current = current.parentId ? byId.get(current.parentId) : undefined;
      }
      const path = parts.join(' > ');
      cache.set(categoryId, path);
      return path;
    };

    return { resolve };
  }

  /**
   * Import shabloni bilan bir xil ustunlarda joriy ombor qoldiqlarini eksport qiladi (round-trip).
   */
  async exportProductsForImportToExcel(
    companyId: string,
    warehouseId: string | undefined,
    mode: 'with_stock' | 'without_stock',
    res: Response,
  ) {
    const whId = String(warehouseId || '').trim();
    if (!whId) {
      throw new BadRequestException(
        'Excel eksport uchun ombor tanlash majburiy.',
      );
    }
    const withStock = mode !== 'without_stock';

    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: whId, companyId, status: 'ACTIVE' },
      select: { id: true, name: true },
    });
    if (!warehouse) {
      throw new NotFoundException('Ombor topilmadi');
    }

    const [categories, balances] = await Promise.all([
      this.prisma.productCategory.findMany({
        where: { companyId, status: { not: 'ARCHIVED' } },
        select: { id: true, name: true, parentId: true },
      }),
      this.prisma.stockBalance.findMany({
        where: { companyId, warehouseId: whId },
        include: {
          productVariant: {
            select: {
              id: true,
              name: true,
              sku: true,
              barcode: true,
              purchasePrice: true,
              salePrice: true,
              currency: true,
              attributesJson: true,
              status: true,
              product: {
                select: {
                  name: true,
                  status: true,
                  categoryId: true,
                  unit: true,
                },
              },
            },
          },
        },
        orderBy: [
          { productVariant: { product: { name: 'asc' } } },
          { productVariant: { name: 'asc' } },
        ],
      }),
    ]);

    const { resolve: categoryPath } = this.buildCategoryPathMap(categories);

    const rows = balances
      .filter(
        (b) =>
          b.productVariant?.status === 'ACTIVE' &&
          b.productVariant?.product?.status === 'ACTIVE',
      )
      .map((b) => {
        const v = b.productVariant!;
        const p = v.product!;
        const { color, variant: variantName } = exportVariantExcelFields(v);

        return {
          name: p.name,
          sku: v.sku ? String(v.sku) : '',
          barcode: v.barcode ? String(v.barcode) : '',
          color,
          variant: variantName,
          purchasePrice: Number(v.purchasePrice || 0),
          salePrice: Number(v.salePrice || 0),
          currency: (v.currency || 'UZS').toUpperCase(),
          initialStock: withStock ? Number(b.quantity || 0) : ('' as unknown as number),
          unit: p.unit || 'dona',
          categoryName: p.categoryId ? categoryPath(p.categoryId) : '',
          warehouseName: warehouse.name,
          variantId: v.id,
        };
      });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Import');
    worksheet.columns = [
      ...productImportExcelColumns(),
      { header: 'Variant ID (import)', key: 'variantId', width: 38 },
    ];
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];
    worksheet.getRow(1).height = 24;
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' },
    };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    if (rows.length > 0) {
      worksheet.addRows(rows);
    }

    applyProductImportExcelFormats(worksheet);
    applyProductImportExportExtraFormats(worksheet);

    const safeName = warehouse.name
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 40) || 'ombor';
    const date = new Date().toISOString().slice(0, 10);
    const modeSuffix = withStock ? 'qoldiq' : 'katalog';

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=ombor-${modeSuffix}-${safeName}-${date}.xlsx`,
    );

    await workbook.xlsx.write(res);
    res.end();
  }

  async exportStockToExcel(companyId: string, query: ReportQueryDto, res: Response) {
    const { data } = await this.reportsQuery.getStockReport(companyId, query);
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Stock Report');

    worksheet.columns = [
      { header: 'Ombor', key: 'warehouse', width: 20 },
      { header: 'Mahsulot', key: 'product', width: 30 },
      { header: 'Variant', key: 'variant', width: 20 },
      { header: 'SKU', key: 'sku', width: 15 },
      { header: 'Miqdor', key: 'quantity', width: 10 },
      { header: 'Kirim Narxi', key: 'purchasePrice', width: 15 },
      { header: 'Sotuv Narxi', key: 'salePrice', width: 15 },
      { header: 'Umumiy Qiymat', key: 'inventoryValue', width: 20 }
    ];

    worksheet.addRows(data);

    // Styling
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=stock_report.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  }

  async exportStockToPdf(companyId: string, query: ReportQueryDto, res: Response) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true },
    });
    const { summary, data } = await this.reportsQuery.getStockReport(companyId, query);

    let warehouseLabel = 'Barcha omborlar';
    if (query.warehouseId) {
      const wh = await this.prisma.warehouse.findFirst({
        where: { id: query.warehouseId, companyId },
        select: { name: true },
      });
      warehouseLabel = wh?.name || warehouseLabel;
    }

    const pdfBuffer = await generateStockReportPdfBuffer({
      companyName: company?.name || 'Kompaniya',
      warehouseLabel,
      generatedAt: new Date(),
      summary,
      rows: data.map((row) => ({
        ...row,
        quantity: Number(row.quantity),
      })),
    });

    const safeWh = warehouseLabel.replace(/[^\w\-]+/g, '-').slice(0, 40);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=zaxira-${safeWh}-${new Date().toISOString().slice(0, 10)}.pdf`,
    );
    res.send(pdfBuffer);
  }

  async generateProductImportTemplate(companyId: string, res: Response) {
    const warehouses = await this.prisma.warehouse.findMany({
      where: { companyId, status: 'ACTIVE' },
      orderBy: { name: 'asc' },
      select: { name: true },
    });
    const categories = await this.prisma.productCategory.findMany({
      where: { companyId, status: { not: 'ARCHIVED' } },
      orderBy: { name: 'asc' },
      select: { name: true },
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Import');
    const guideSheet = workbook.addWorksheet('Yoriqnoma');
    const lookupSheet = workbook.addWorksheet('Lookup');

    worksheet.columns = productImportExcelColumns();

    worksheet.views = [{ state: 'frozen', ySplit: 1 }];
    worksheet.getRow(1).height = 24;
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    // Add example rows
    worksheet.addRow({
      name: 'Shim Jinsi',
      sku: 'SH-001',
      barcode: '123456789',
      color: "Ko'k",
      variant: 'L',
      purchasePrice: 100000,
      salePrice: 150000,
      currency: 'UZS',
      initialStock: 50,
      unit: 'dona',
      categoryName: 'Kiyim > Erkaklar',
      warehouseName: 'Asosiy Ombor'
    });
    worksheet.addRow({
      name: 'Futbolka',
      sku: 'FT-001',
      barcode: '4780012345678',
      color: 'Qora',
      variant: 'M',
      purchasePrice: 55000,
      salePrice: 89000,
      currency: 'UZS',
      initialStock: 25,
      unit: 'dona',
      categoryName: 'Kiyim > Ayollar',
      warehouseName: warehouses[0]?.name || 'Asosiy Ombor'
    });
    worksheet.addRow({
      name: 'Sut 3.2%',
      sku: 'SUT-1L',
      barcode: '8600123456789',
      color: '',
      variant: '',
      purchasePrice: 12000,
      salePrice: 15000,
      currency: 'UZS',
      initialStock: 120,
      unit: 'l',
      categoryName: 'Oziq-ovqat',
      warehouseName: warehouses[0]?.name || 'Asosiy Ombor'
    });
    worksheet.addRow({
      name: 'Kabel',
      sku: 'KBL-2x1.5',
      barcode: '',
      color: '',
      variant: '',
      purchasePrice: 8500,
      salePrice: 12000,
      currency: 'UZS',
      initialStock: 250,
      unit: 'm',
      categoryName: 'Elektr jihozlari',
      warehouseName: warehouses[0]?.name || 'Asosiy Ombor'
    });

    // Style sample rows
    [2, 3, 4, 5].forEach((rowNumber) => {
      const row = worksheet.getRow(rowNumber);
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
    });

    applyProductImportExcelFormats(worksheet);

    // Lookup values for category/warehouse dropdown
    lookupSheet.columns = [
      { header: 'Kategoriya', key: 'categoryName', width: 34 },
      { header: 'Ombor Nomi', key: 'warehouseName', width: 30 },
      { header: 'Valyuta', key: 'currency', width: 12 },
      { header: 'Birlik', key: 'unit', width: 12 },
    ];
    const unitOptions = ['dona', 'kg', 'l', 'm'];
    const maxLookupRows = Math.max(categories.length, warehouses.length, unitOptions.length, 2);
    for (let i = 0; i < maxLookupRows; i += 1) {
      lookupSheet.addRow({
        categoryName: categories[i]?.name || '',
        warehouseName: warehouses[i]?.name || (i === 0 ? 'Asosiy Ombor' : ''),
        currency: i < 2 ? ['UZS', 'USD'][i] : '',
        unit: unitOptions[i] || '',
      });
    }
    lookupSheet.state = 'veryHidden';

    const categoryRangeStart = 2;
    const warehouseRangeStart = 2;
    const currencyRangeStart = 2;
    const categoryRangeEnd = categoryRangeStart + Math.max(categories.length, 1) - 1;
    const warehouseRangeEnd = warehouseRangeStart + Math.max(warehouses.length, 1) - 1;
    const currencyRangeEnd = currencyRangeStart + 2 - 1;
    const unitRangeStart = 2;
    const unitRangeEnd = unitRangeStart + unitOptions.length - 1;
    applyProductImportSheetValidations(worksheet, {
      categoryStart: categoryRangeStart,
      categoryEnd: categoryRangeEnd,
      warehouseStart: warehouseRangeStart,
      warehouseEnd: warehouseRangeEnd,
      currencyStart: currencyRangeStart,
      currencyEnd: currencyRangeEnd,
      unitStart: unitRangeStart,
      unitEnd: unitRangeEnd,
    });

    guideSheet.columns = [
      { header: 'Bo\'lim', key: 'section', width: 24 },
      { header: 'Tavsif', key: 'description', width: 90 },
    ];
    guideSheet.getRow(1).font = { bold: true };
    guideSheet.addRows([
      {
        section: 'Qadam 1',
        description: '"Import" varag\'idagi faqat 2-qatordan boshlab ma\'lumot kiriting. 1-qator sarlavha bo\'lib qolishi kerak.',
      },
      {
        section: 'Majburiy ustun',
        description: 'Mahsulot Nomi majburiy. Qolgan ustunlar ixtiyoriy, lekin narxlar va qoldiq manfiy bo\'lmasligi kerak.',
      },
      {
        section: 'Valyuta',
        description: 'Valyuta ustuniga UZS yoki USD yozing. Bo\'sh qoldirilsa UZS deb olinadi.',
      },
      {
        section: 'Kategoriya',
        description: 'Kategoriya ustuniga nom kiritsangiz, topilsa biriktiriladi; topilmasa avtomatik yaratiladi. Ichma-ich uchun "Ota > Bola" formatidan foydalaning.',
      },
      {
        section: 'Birlik',
        description:
          'Birlik ustuniga dona, kg, l (litr) yoki m (metr) yozing. Bo\'sh qoldirilsa — dona. Masalan: sut uchun l, kabel uchun m.',
      },
      {
        section: 'Qoldiq (o\'nlik)',
        description:
          'Qoldiq ustunida 12,5 yoki 12.5 yozish mumkin. O\'nlik faqat kg/l/m birligida; J ustunida birlikni tanlang. dona uchun faqat butun son (5, 10).',
      },
      {
        section: 'Rang va variant',
        description:
          'Rang va Variant nomi alohida ustunlarda. UI dagi «Rang» va «Variant nomi» maydonlari bilan mos keladi.',
      },
      {
        section: 'SKU qoida',
        description: 'Bir xil SKU bir nechta qatorda kelsa, ular bitta mahsulotning turli variantlari sifatida import qilinadi.',
      },
      {
        section: 'Barkod qoida',
        description: 'Barkod kiritsangiz, takrorlanmas bo\'lishi kerak.',
      },
      {
        section: 'Ombor',
        description: 'Ombor Nomi majburiy. Har bir qator uchun omborni dropdown ro\'yxatdan tanlang.',
      },
      {
        section: 'Eslatma',
        description: 'Bo\'sh qatorlar importda e\'tiborsiz qoldiriladi.',
      },
    ]);
    guideSheet.getColumn(2).alignment = { wrapText: true, vertical: 'top' };
    guideSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      row.height = 28;
    });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=product_import_template.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  }
}
