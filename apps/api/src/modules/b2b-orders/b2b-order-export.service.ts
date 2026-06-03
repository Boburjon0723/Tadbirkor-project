import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import * as ExcelJS from 'exceljs';
import { aggregateOrderItems } from './b2b-order-export.util';
import { B2BOrdersService } from './b2b-orders.service';

@Injectable()
export class B2BOrderExportService {
  constructor(private readonly ordersQuery: B2BOrdersService) {}

  async exportOrderToExcel(id: string, companyId: string, res: Response) {
    const order = await this.ordersQuery.findOne(id, companyId);
    const rows = aggregateOrderItems(order.items);
    const orderLabel = `ORD-${order.id.slice(0, 8).toUpperCase()}`;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Tadbirkor';
    workbook.created = new Date();

    const info = workbook.addWorksheet('Buyurtma');
    info.columns = [
      { header: 'Maydon', key: 'label', width: 22 },
      { header: 'Qiymat', key: 'value', width: 42 },
    ];
    info.getRow(1).font = { bold: true };
    info.addRows([
      { label: 'Buyurtma №', value: orderLabel },
      { label: 'ID', value: order.id },
      {
        label: 'Sana',
        value: new Date(order.createdAt).toLocaleString('uz-UZ'),
      },
      { label: 'Status', value: order.status },
      { label: 'Sotuvchi', value: order.seller?.name || '—' },
      { label: 'Xaridor', value: order.buyer?.name || '—' },
      {
        label: 'Jami summa',
        value: rows.reduce((s, r) => s + r.lineTotal, 0),
      },
    ]);

    const sheet = workbook.addWorksheet('Mahsulotlar');
    sheet.columns = [
      { header: '#', key: 'num', width: 6 },
      { header: 'Kod (SKU)', key: 'code', width: 16 },
      { header: 'Mahsulot', key: 'product', width: 28 },
      { header: 'Variant', key: 'variant', width: 18 },
      { header: 'Miqdor', key: 'qty', width: 10 },
      { header: 'Narx', key: 'price', width: 14 },
      { header: 'Valyuta', key: 'currency', width: 10 },
      { header: 'Jami', key: 'total', width: 16 },
    ];
    sheet.getRow(1).font = { bold: true };

    rows.forEach((row, idx) => {
      sheet.addRow({
        num: idx + 1,
        code: row.code,
        product: row.productName,
        variant: row.variantName,
        qty: row.qty,
        price: row.price,
        currency: row.currency,
        total: row.lineTotal,
      });
    });

    sheet.getColumn(5).numFmt = '#,##0.##';
    sheet.getColumn(6).numFmt = '#,##0.00';
    sheet.getColumn(8).numFmt = '#,##0.00';

    const filename = `buyurtma-${orderLabel}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  }
}
