import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import * as ExcelJS from 'exceljs';
import { GoodsReceiptsService } from './goods-receipts.service';
import { toFiniteMoney, receiptStatusLabel } from './goods-receipt.shared';

@Injectable()
export class GoodsReceiptExportService {
  constructor(private readonly receiptQuery: GoodsReceiptsService) {}

  private buildReceiptExportRows(receipt: Awaited<ReturnType<GoodsReceiptsService["findOne"]>>) {
    return receipt.items.map((item, idx) => {
      const row = item as typeof item & { inboundStatus?: string; mapping?: unknown };
      const qty = toFiniteMoney(item.quantity);
      const price = toFiniteMoney(item.expectedPrice);
      const currency = String(item.expectedCurrency || 'UZS').toUpperCase() === 'USD' ? 'USD' : 'UZS';
      return {
        num: idx + 1,
        product: item.productNameSnapshot,
        qty,
        price,
        currency,
        total: qty * price,
        inbound:
          row.inboundStatus === 'EXISTING' || row.mapping ? 'Mavjud' : 'Yangi (avtomatik)',
      };
    });
  }

  async exportReceiptToExcel(id: string, companyId: string, res: Response) {
    const receipt = await this.receiptQuery.findOne(id, companyId, { mode: 'full' });
    const label = `RCP-${receipt.id.slice(0, 8).toUpperCase()}`;
    const rows = this.buildReceiptExportRows(receipt);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Tadbirkor';
    workbook.created = new Date();

    const info = workbook.addWorksheet('Qabul');
    info.columns = [
      { header: 'Maydon', key: 'label', width: 22 },
      { header: 'Qiymat', key: 'value', width: 48 },
    ];
    info.getRow(1).font = { bold: true };
    info.addRows([
      { label: 'Qabul №', value: label },
      { label: 'Buyurtma №', value: `ORD-${receipt.orderId.slice(0, 8).toUpperCase()}` },
      { label: 'Sana', value: new Date(receipt.createdAt).toLocaleString('uz-UZ') },
      { label: 'Status', value: receiptStatusLabel(receipt.status) },
      { label: 'Sotuvchi', value: receipt.sellerCompany?.name || '—' },
      { label: 'Sotuvchi STIR', value: receipt.sellerCompany?.tin || '—' },
      { label: 'Xaridor', value: receipt.buyerCompany?.name || '—' },
      { label: 'Jami summa', value: receipt.totalAmount },
    ]);

    const sheet = workbook.addWorksheet('Mahsulotlar');
    sheet.columns = [
      { header: '#', key: 'num', width: 6 },
      { header: 'Mahsulot', key: 'product', width: 36 },
      { header: 'Miqdor', key: 'qty', width: 10 },
      { header: 'Narx', key: 'price', width: 14 },
      { header: 'Valyuta', key: 'currency', width: 10 },
      { header: 'Jami', key: 'total', width: 14 },
      { header: 'Omborga', key: 'inbound', width: 16 },
    ];
    sheet.getRow(1).font = { bold: true };
    rows.forEach((row) => sheet.addRow(row));
    sheet.getColumn(3).numFmt = '#,##0.##';
    sheet.getColumn(4).numFmt = '#,##0.00';
    sheet.getColumn(6).numFmt = '#,##0.00';

    const filename = `qabul-${label}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  }

  async exportAllToExcel(companyId: string, res: Response) {
    const receipts = await this.receiptQuery.findAllForExport(companyId, 'BUYER');

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Tadbirkor';
    workbook.created = new Date();

    const list = workbook.addWorksheet('Qabullar');
    list.columns = [
      { header: 'Qabul №', key: 'receiptNo', width: 16 },
      { header: 'Buyurtma №', key: 'orderNo', width: 16 },
      { header: 'Sotuvchi', key: 'seller', width: 28 },
      { header: 'STIR', key: 'tin', width: 16 },
      { header: 'Summa', key: 'total', width: 14 },
      { header: 'Valyuta', key: 'currency', width: 10 },
      { header: 'Mahsulotlar', key: 'lines', width: 12 },
      { header: 'Status', key: 'status', width: 16 },
      { header: 'Sana', key: 'date', width: 22 },
    ];
    list.getRow(1).font = { bold: true };

    for (const r of receipts) {
      list.addRow({
        receiptNo: `RCP-${r.id.slice(0, 8).toUpperCase()}`,
        orderNo: `ORD-${r.orderId.slice(0, 8).toUpperCase()}`,
        seller: r.sellerCompany?.name || '—',
        tin: r.sellerCompany?.tin || '—',
        total: r.totalAmount,
        currency: r.displayCurrency || 'UZS',
        lines: r.items?.length || 0,
        status: receiptStatusLabel(r.status),
        date: new Date(r.createdAt).toLocaleString('uz-UZ'),
      });
    }
    list.getColumn(5).numFmt = '#,##0.00';

    const lines = workbook.addWorksheet('Qatorlar');
    lines.columns = [
      { header: 'Qabul №', key: 'receiptNo', width: 16 },
      { header: 'Mahsulot', key: 'product', width: 36 },
      { header: 'Miqdor', key: 'qty', width: 10 },
      { header: 'Narx', key: 'price', width: 12 },
      { header: 'Valyuta', key: 'currency', width: 10 },
      { header: 'Jami', key: 'total', width: 14 },
    ];
    lines.getRow(1).font = { bold: true };

    for (const r of receipts) {
      const receiptNo = `RCP-${r.id.slice(0, 8).toUpperCase()}`;
      for (const item of r.items || []) {
        const orderItem = this.receiptQuery.resolveOrderItemForReceiptLine(r, item);
        const qty = toFiniteMoney(item.quantity);
        const price = toFiniteMoney(orderItem?.expectedPrice);
        const currency =
          String(orderItem?.expectedCurrency || r.displayCurrency || 'UZS').toUpperCase() === 'USD'
            ? 'USD'
            : 'UZS';
        lines.addRow({
          receiptNo,
          product: item.productNameSnapshot,
          qty,
          price,
          currency,
          total: qty * price,
        });
      }
    }
    lines.getColumn(3).numFmt = '#,##0.##';
    lines.getColumn(4).numFmt = '#,##0.00';
    lines.getColumn(6).numFmt = '#,##0.00';

    const filename = `qabullar-${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  }
}
