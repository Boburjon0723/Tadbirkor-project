import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CompaniesService } from '../companies/companies.service';

@Injectable()
export class PosReportsService {
  constructor(
    private prisma: PrismaService,
    private companiesService: CompaniesService,
  ) {}

  async getSummary(
    companyId: string,
    query: { dateFrom?: string; dateTo?: string; warehouseId?: string; cashierId?: string },
  ) {
    await this.companiesService.assertModuleEnabled(companyId, 'POS');

    const where: any = {
      companyId,
      status: 'COMPLETED',
    };
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.cashierId) where.cashierId = query.cashierId;

    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (query.dateFrom) {
      const d = new Date(query.dateFrom);
      if (!isNaN(d.getTime())) dateFilter.gte = d;
    }
    if (query.dateTo) {
      const d = new Date(query.dateTo);
      if (!isNaN(d.getTime())) dateFilter.lte = d;
    }
    if (dateFilter.gte || dateFilter.lte) {
      where.completedAt = dateFilter;
    }

    const sales = await this.prisma.posSale.findMany({
      where,
      include: {
        items: true,
        payments: true,
      },
    });

    const init = () => ({ UZS: 0, USD: 0 });
    const grossSales = init();
    const discounts = init();
    const netSales = init();
    const cashSales = init();
    const cardSales = init();
    const creditSales = init();
    let receiptsCount = 0;
    let itemsSold = 0;

    const normalizeCurrency = (c: string) =>
      String(c || 'UZS').toUpperCase() === 'USD' ? 'USD' : 'UZS';

    for (const sale of sales) {
      receiptsCount += 1;
      const cur = normalizeCurrency(sale.currency);
      const subtotal = Number(sale.subtotal);
      const discount = Number(sale.discountAmount);
      const total = Number(sale.totalAmount);

      grossSales[cur] += subtotal;
      discounts[cur] += discount;
      netSales[cur] += total;

      for (const item of sale.items) {
        itemsSold += Number(item.quantity);
      }

      for (const p of sale.payments) {
        const amt = Number(p.amount);
        if (p.method === 'CREDIT') creditSales[cur] += amt;
        else if (p.method === 'CARD') cardSales[cur] += amt;
        else cashSales[cur] += amt;
      }
    }

    const openReceivables = await this.prisma.retailReceivable.aggregate({
      where: {
        companyId,
        status: { in: ['OPEN', 'PARTIAL'] },
      },
      _sum: { remainingAmount: true },
    });

    return {
      source: 'POS_SALE',
      receiptsCount,
      itemsSold,
      grossSales,
      discounts,
      netSales,
      cashSales,
      cardSales,
      creditSales,
      openReceivablesTotal: Number(openReceivables._sum.remainingAmount || 0),
    };
  }

  async getTopProducts(
    companyId: string,
    query: { dateFrom?: string; dateTo?: string; warehouseId?: string; limit?: number },
  ) {
    await this.companiesService.assertModuleEnabled(companyId, 'POS');

    const saleWhere: any = { companyId, status: 'COMPLETED' };
    if (query.warehouseId) saleWhere.warehouseId = query.warehouseId;
    if (query.dateFrom || query.dateTo) {
      saleWhere.completedAt = {};
      if (query.dateFrom) {
        const d = new Date(query.dateFrom);
        if (!isNaN(d.getTime())) saleWhere.completedAt.gte = d;
      }
      if (query.dateTo) {
        const d = new Date(query.dateTo);
        if (!isNaN(d.getTime())) saleWhere.completedAt.lte = d;
      }
    }

    const items = await this.prisma.posSaleItem.findMany({
      where: { sale: saleWhere },
      select: {
        productVariantId: true,
        productNameSnapshot: true,
        quantity: true,
        lineTotal: true,
        sale: { select: { currency: true } },
      },
    });

    const map = new Map<
      string,
      { productVariantId: string; name: string; qty: number; revenue: number; currency: string }
    >();

    for (const it of items) {
      const key = it.productVariantId;
      const cur = String(it.sale.currency || 'UZS');
      const prev = map.get(key) || {
        productVariantId: key,
        name: it.productNameSnapshot,
        qty: 0,
        revenue: 0,
        currency: cur,
      };
      prev.qty += Number(it.quantity);
      prev.revenue += Number(it.lineTotal);
      map.set(key, prev);
    }

    const limit = Math.min(Math.max(query.limit || 10, 1), 50);
    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);
  }
}
