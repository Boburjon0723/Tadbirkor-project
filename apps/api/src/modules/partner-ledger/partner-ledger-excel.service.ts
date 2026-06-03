import { Injectable, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';
import { OPERATION_TYPE_LABELS } from './partner-ledger.types';
import { PartnerLedgerSaleService } from './partner-ledger-sale.service';

function styleHeaderRow(sheet: ExcelJS.Worksheet) {
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2563EB' },
  };
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
}

@Injectable()
export class PartnerLedgerExcelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly partnerLedgerSaleService: PartnerLedgerSaleService,
  ) {}

  async generateSaleOrderTemplate(
    companyId: string,
    warehouseId: string,
    res: Response,
    contactName?: string,
  ) {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: warehouseId, companyId, status: { not: 'ARCHIVED' } },
      select: { name: true },
    });
    if (!warehouse) throw new NotFoundException('Ombor topilmadi');

    const variants = await this.prisma.productVariant.findMany({
      where: {
        companyId,
        status: 'ACTIVE',
        product: { status: { not: 'ARCHIVED' } },
        stockBalances: { some: { warehouseId } },
      },
      include: {
        product: { select: { name: true, unit: true } },
        stockBalances: { where: { warehouseId }, select: { quantity: true } },
      },
      orderBy: { product: { name: 'asc' } },
      take: 500,
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Tadbirkor';
    workbook.created = new Date();

    const guide = workbook.addWorksheet('Yoriqnoma');
    guide.columns = [
      { header: 'Qadam', key: 'step', width: 8 },
      { header: 'Ko‘rsatma', key: 'text', width: 72 },
    ];
    guide.addRows([
      { step: 1, text: '«Buyurtma» varag‘ida mahsulot kodi (SKU), variant va miqdorni kiriting.' },
      { step: 2, text: 'Variant majburiy emas — faqat SKU yoki shtrix-kod yetarli bo‘lsa.' },
      { step: 3, text: 'Bir mahsulotning bir nechta rangi bo‘lsa: SKU + Variant (masalan A-001 va Tilla).' },
      { step: 4, text: '«Katalog» varag‘idan to‘g‘ri ma’lumotlarni ko‘chirib oling.' },
      { step: 5, text: 'Tayyor faylni Hamkor daftari → Sotish → Excel dan yuklang.' },
      { step: '—', text: `Ombor: ${warehouse.name}${contactName ? ` · Hamkor: ${contactName}` : ''}` },
    ]);
    guide.getRow(1).font = { bold: true };

    const catalog = workbook.addWorksheet('Katalog');
    catalog.columns = [
      { header: 'SKU', key: 'sku', width: 16 },
      { header: 'Shtrix-kod', key: 'barcode', width: 18 },
      { header: 'Mahsulot', key: 'product', width: 28 },
      { header: 'Variant', key: 'variant', width: 18 },
      { header: 'Sotuv narxi', key: 'salePrice', width: 14 },
      { header: 'Valyuta', key: 'currency', width: 10 },
      { header: 'Qoldiq', key: 'stock', width: 10 },
      { header: 'Birlik', key: 'unit', width: 10 },
    ];
    styleHeaderRow(catalog);
    for (const v of variants) {
      catalog.addRow({
        sku: v.sku || '',
        barcode: v.barcode || '',
        product: v.product.name,
        variant: v.name,
        salePrice: Number(v.salePrice),
        currency: v.currency || 'UZS',
        stock: Number(v.stockBalances[0]?.quantity ?? 0),
        unit: v.product.unit || 'dona',
      });
    }

    const order = workbook.addWorksheet('Buyurtma');
    order.columns = [
      { header: 'SKU', key: 'sku', width: 16 },
      { header: 'Shtrix-kod', key: 'barcode', width: 18 },
      { header: 'Mahsulot (ixtiyoriy)', key: 'product', width: 28 },
      { header: 'Variant', key: 'variant', width: 18 },
      { header: 'Miqdor', key: 'quantity', width: 12 },
    ];
    styleHeaderRow(order);
    order.views = [{ state: 'frozen', ySplit: 1 }];
    order.addRow({
      sku: 'A-001',
      barcode: '',
      product: 'A-001',
      variant: 'Tilla',
      quantity: 8,
    });
    order.addRow({ sku: '', barcode: '', product: 'A-001', variant: 'shampan', quantity: 10 });
    for (let i = 0; i < 12; i++) {
      order.addRow({ sku: '', barcode: '', product: '', variant: '', quantity: '' });
    }

    const safeWh = warehouse.name.replace(/[^\w\u0400-\u04FF-]+/g, '_').slice(0, 24);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=hamkor-buyurtma-shablon-${safeWh}.xlsx`,
    );
    await workbook.xlsx.write(res);
    res.end();
  }

  async exportOperation(companyId: string, operationId: string, res: Response) {
    const op = await this.prisma.partnerLedgerOperation.findFirst({
      where: { id: operationId, companyId },
      include: {
        contact: { select: { name: true, phone: true } },
      },
    });
    if (!op) throw new NotFoundException('Operatsiya topilmadi');

    if (op.sourceType === 'PARTNER_SALE_ORDER' && op.sourceId && op.contactId) {
      return this.exportSaleOrder(companyId, op.contactId, op.sourceId, res);
    }

    const detail = await this.partnerLedgerSaleService.getOperationLines(companyId, operationId);
    const contact = op.contact;
    const typeLabel =
      OPERATION_TYPE_LABELS[op.type as keyof typeof OPERATION_TYPE_LABELS] || op.type;

    const workbook = new ExcelJS.Workbook();
    const info = workbook.addWorksheet('Operatsiya');
    info.columns = [
      { header: 'Maydon', key: 'label', width: 22 },
      { header: 'Qiymat', key: 'value', width: 42 },
    ];
    info.getRow(1).font = { bold: true };
    info.addRows([
      { label: 'Hamkor', value: contact.name },
      { label: 'Tur', value: typeLabel },
      { label: 'Sana', value: op.operationDate.toISOString().slice(0, 10) },
      { label: 'Summa', value: Number(op.amount) },
      { label: 'Valyuta', value: op.currency },
      { label: 'Eslatma', value: op.notes || op.productSummary || '—' },
    ]);

    const sheet = workbook.addWorksheet('Mahsulotlar');
    sheet.columns = [
      { header: '#', key: 'num', width: 6 },
      { header: 'SKU', key: 'sku', width: 16 },
      { header: 'Mahsulot', key: 'product', width: 28 },
      { header: 'Variant', key: 'variant', width: 18 },
      { header: 'Miqdor', key: 'qty', width: 10 },
      { header: 'Narx', key: 'price', width: 14 },
      { header: 'Valyuta', key: 'currency', width: 10 },
      { header: 'Jami', key: 'total', width: 14 },
      { header: 'Ombor', key: 'warehouse', width: 18 },
    ];
    styleHeaderRow(sheet);

    detail.lines.forEach((line, idx) => {
      sheet.addRow({
        num: idx + 1,
        sku: line.sku || '',
        product: line.productName,
        variant: line.variantName,
        qty: line.quantity,
        price: line.salePrice,
        currency: line.currency,
        total: line.lineTotal,
        warehouse: line.warehouseName,
      });
    });

    const safeName = contact.name.replace(/[^\w\u0400-\u04FF-]+/g, '_').slice(0, 32);
    const date = op.operationDate.toISOString().slice(0, 10);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=operatsiya-${safeName}-${date}.xlsx`,
    );
    await workbook.xlsx.write(res);
    res.end();
  }

  async exportSaleOrder(
    companyId: string,
    contactId: string,
    batchId: string,
    res: Response,
  ) {
    const contact = await this.prisma.partnerLedgerContact.findFirst({
      where: { id: contactId, companyId },
      select: { name: true, phone: true },
    });
    if (!contact) throw new NotFoundException('Hamkor topilmadi');

    const operation = await this.prisma.partnerLedgerOperation.findFirst({
      where: {
        companyId,
        contactId,
        sourceId: batchId,
        sourceType: 'PARTNER_SALE_ORDER',
        reversedById: null,
      },
    });
    if (!operation) throw new NotFoundException('Sotuv operatsiyasi topilmadi');

    const movements = await this.prisma.stockMovement.findMany({
      where: { companyId, sourceId: batchId, type: 'OUT' },
      include: {
        warehouse: { select: { name: true } },
        productVariant: {
          include: { product: { select: { name: true, unit: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Tadbirkor';

    const info = workbook.addWorksheet('Buyurtma');
    info.columns = [
      { header: 'Maydon', key: 'label', width: 22 },
      { header: 'Qiymat', key: 'value', width: 42 },
    ];
    info.getRow(1).font = { bold: true };
    info.addRows([
      { label: 'Hamkor', value: contact.name },
      { label: 'Telefon', value: contact.phone || '—' },
      { label: 'Sana', value: operation.operationDate.toISOString().slice(0, 10) },
      { label: 'Summa', value: Number(operation.amount) },
      { label: 'Valyuta', value: operation.currency },
      { label: 'To‘lov / eslatma', value: operation.notes || '—' },
      { label: 'Buyurtma ID', value: batchId },
    ]);

    const sheet = workbook.addWorksheet('Mahsulotlar');
    sheet.columns = [
      { header: '#', key: 'num', width: 6 },
      { header: 'SKU', key: 'sku', width: 16 },
      { header: 'Shtrix-kod', key: 'barcode', width: 18 },
      { header: 'Mahsulot', key: 'product', width: 28 },
      { header: 'Variant', key: 'variant', width: 18 },
      { header: 'Miqdor', key: 'qty', width: 10 },
      { header: 'Birlik', key: 'unit', width: 10 },
      { header: 'Sotuv narxi', key: 'price', width: 14 },
      { header: 'Valyuta', key: 'currency', width: 10 },
      { header: 'Qator jami', key: 'total', width: 14 },
      { header: 'Ombor', key: 'warehouse', width: 18 },
    ];
    styleHeaderRow(sheet);

    let grand = 0;
    movements.forEach((m, idx) => {
      const qty = Number(m.quantity);
      const price = Number(m.productVariant.salePrice);
      const lineTotal = qty * price;
      grand += lineTotal;
      sheet.addRow({
        num: idx + 1,
        sku: m.productVariant.sku || '',
        barcode: m.productVariant.barcode || '',
        product: m.productVariant.product?.name || '',
        variant: m.productVariant.name,
        qty,
        unit: m.productVariant.product?.unit || 'dona',
        price,
        currency: m.productVariant.currency || 'UZS',
        total: lineTotal,
        warehouse: m.warehouse.name,
      });
    });

    sheet.addRow({});
    sheet.addRow({ product: 'JAMI', total: grand });

    const safeName = contact.name.replace(/[^\w\u0400-\u04FF-]+/g, '_').slice(0, 32);
    const date = operation.operationDate.toISOString().slice(0, 10);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=sotuv-${safeName}-${date}.xlsx`,
    );
    await workbook.xlsx.write(res);
    res.end();
  }

  async exportContactOperations(companyId: string, contactId: string, res: Response) {
    const contact = await this.prisma.partnerLedgerContact.findFirst({
      where: { id: contactId, companyId },
      select: { name: true },
    });
    if (!contact) throw new NotFoundException('Hamkor topilmadi');

    const operations = await this.prisma.partnerLedgerOperation.findMany({
      where: { companyId, contactId },
      orderBy: [{ operationDate: 'desc' }, { createdAt: 'desc' }],
      include: { createdBy: { select: { fullName: true } } },
    });

    const saleBatchIds = operations
      .filter((o) => o.sourceType === 'PARTNER_SALE_ORDER' && o.sourceId)
      .map((o) => o.sourceId as string);

    const movements =
      saleBatchIds.length > 0
        ? await this.prisma.stockMovement.findMany({
            where: { companyId, sourceId: { in: saleBatchIds }, type: 'OUT' },
            include: {
              warehouse: { select: { name: true } },
              productVariant: {
                include: { product: { select: { name: true, unit: true } } },
              },
            },
            orderBy: [{ sourceId: 'asc' }, { createdAt: 'asc' }],
          })
        : [];

    const workbook = new ExcelJS.Workbook();
    const opsSheet = workbook.addWorksheet('Operatsiyalar');
    opsSheet.columns = [
      { header: 'Sana', key: 'date', width: 14 },
      { header: 'Tur', key: 'type', width: 22 },
      { header: 'Summa', key: 'amount', width: 16 },
      { header: 'Valyuta', key: 'currency', width: 10 },
      { header: 'Mahsulotlar', key: 'products', width: 48 },
      { header: 'Eslatma', key: 'notes', width: 36 },
      { header: 'Manba', key: 'source', width: 18 },
      { header: 'Kim', key: 'author', width: 18 },
    ];

    for (const op of operations) {
      opsSheet.addRow({
        date: op.operationDate.toISOString().slice(0, 10),
        type: OPERATION_TYPE_LABELS[op.type as keyof typeof OPERATION_TYPE_LABELS] || op.type,
        amount: Number(op.amount),
        currency: op.currency,
        products: op.productSummary || '',
        notes: op.notes || '',
        source: op.sourceType || 'Qo‘lda',
        author: op.createdBy.fullName,
      });
    }

    opsSheet.getRow(1).font = { bold: true };
    opsSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' },
    };

    const linesSheet = workbook.addWorksheet('Sotuv qatorlari');
    linesSheet.columns = [
      { header: 'Buyurtma ID', key: 'batchId', width: 38 },
      { header: 'Sana', key: 'date', width: 14 },
      { header: 'Ombor', key: 'warehouse', width: 18 },
      { header: 'Mahsulot', key: 'product', width: 28 },
      { header: 'Variant', key: 'variant', width: 18 },
      { header: 'SKU', key: 'sku', width: 14 },
      { header: 'Miqdor', key: 'quantity', width: 10 },
      { header: 'Birlik', key: 'unit', width: 10 },
      { header: 'Sotuv narxi', key: 'salePrice', width: 14 },
      { header: 'Valyuta', key: 'currency', width: 10 },
      { header: 'Qator jami', key: 'lineTotal', width: 14 },
    ];

    const opDateByBatch = new Map(
      operations
        .filter((o) => o.sourceType === 'PARTNER_SALE_ORDER' && o.sourceId)
        .map((o) => [o.sourceId as string, o.operationDate.toISOString().slice(0, 10)]),
    );

    for (const m of movements) {
      const qty = Number(m.quantity);
      const salePrice = Number(m.productVariant.salePrice);
      linesSheet.addRow({
        batchId: m.sourceId,
        date: opDateByBatch.get(m.sourceId || '') || '',
        warehouse: m.warehouse.name,
        product: m.productVariant.product?.name || '',
        variant: m.productVariant.name,
        sku: m.productVariant.sku || '',
        quantity: qty,
        unit: m.productVariant.product?.unit || 'dona',
        salePrice,
        currency: m.productVariant.currency || 'UZS',
        lineTotal: qty * salePrice,
      });
    }

    linesSheet.getRow(1).font = { bold: true };
    linesSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD3D3D3' },
    };

    const safeName = contact.name.replace(/[^\w\u0400-\u04FF-]+/g, '_').slice(0, 40);
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=hamkor-daftari-${safeName}-${date}.xlsx`,
    );
    await workbook.xlsx.write(res);
    res.end();
  }
}
