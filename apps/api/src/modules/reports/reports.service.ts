// Reports Service - query / analytics
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ReportQueryDto } from './dto/report-query.dto';
import {
  getReportMaxMovementRows,
  parseReportDateRange,
} from '../../common/report-date-range.util';

const DEBT_ENTRY_STATUSES = ['OPEN', 'PARTIAL', 'CLOSED', 'PAID'] as const;

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  private buildMovementWhere(
    companyId: string,
    range: ReturnType<typeof parseReportDateRange>,
    warehouseId?: string,
    extra?: Prisma.StockMovementWhereInput,
  ): Prisma.StockMovementWhereInput {
    return {
      companyId,
      createdAt: { gte: range.gte, lte: range.lte },
      warehouse: { status: { not: 'ARCHIVED' } },
      ...(warehouseId ? { warehouseId } : {}),
      ...extra,
    };
  }

  private async assertMovementCountWithinLimit(
    where: Prisma.StockMovementWhereInput,
    label: string,
  ) {
    const max = getReportMaxMovementRows();
    const count = await this.prisma.stockMovement.count({ where });
    if (count > max) {
      throw new BadRequestException(
        `${label}: ${count} ta ombor harakati (limit ${max}). Sana oralig‘ini qisqartiring yoki ombor filtri qo‘ying.`,
      );
    }
  }

  private resolveDebtStatusFilter(status?: string) {
    const normalized = status?.trim();
    if (!normalized) {
      return { in: ['OPEN', 'PARTIAL'] as string[] };
    }
    if (!DEBT_ENTRY_STATUSES.includes(normalized as (typeof DEBT_ENTRY_STATUSES)[number])) {
      throw new BadRequestException(
        `Noto'g'ri qarz holati. Ruxsat etilgan: ${DEBT_ENTRY_STATUSES.join(', ')}`,
      );
    }
    return normalized;
  }

  /**
   * Kirim/Sotuv/Foyda/Ombor qiymati yig'ma hisoboti.
   *
   * Sotuv manbasi — barcha StockMovement OUT yozuvlari (POS, B2B dispatch, manual OUT).
   * Kirim manbasi — faqat StockMovement IN with sourceType=GOODS_RECEIPT (hamkorlardan rasmiy qabul).
   * Foyda = Sotuv − Kirim (har bir valyuta uchun alohida).
   * Ombor qiymati hozir — joriy StockBalance × ProductVariant.purchasePrice (valyuta bo'yicha).
   *
   * Narxlar variantning **joriy** purchasePrice/salePrice bilan hisoblanadi (snapshot emas).
   * Bu MVP uchun yetarli — agar narxlar tez-tez o'zgarmasa, oraliq xato kichik bo'ladi.
   */
  async getCostSummary(
    companyId: string,
    query: { dateFrom?: string; dateTo?: string; warehouseId?: string },
  ) {
    const range = parseReportDateRange(query);
    const inWhere = this.buildMovementWhere(companyId, range, query.warehouseId, {
      type: 'IN',
      sourceType: 'GOODS_RECEIPT',
    });
    const outWhere = this.buildMovementWhere(companyId, range, query.warehouseId, {
      type: 'OUT',
    });

    await Promise.all([
      this.assertMovementCountWithinLimit(inWhere, 'Kirim'),
      this.assertMovementCountWithinLimit(outWhere, 'Sotuv'),
    ]);

    const variantSelect = {
      id: true,
      name: true,
      currency: true,
      purchasePrice: true,
      salePrice: true,
      product: { select: { name: true } },
    } as const;

    const inMovements = await this.prisma.stockMovement.findMany({
      where: inWhere,
      include: { productVariant: { select: variantSelect } },
    });

    const outMovements = await this.prisma.stockMovement.findMany({
      where: outWhere,
      include: { productVariant: { select: variantSelect } },
    });

    // 3) Hozirgi ombor qiymati — joriy qoldiqlar
    const balanceWhere: any = {
      companyId,
      warehouse: { status: { not: 'ARCHIVED' } },
    };
    if (query.warehouseId) balanceWhere.warehouseId = query.warehouseId;
    const balances = await this.prisma.stockBalance.findMany({
      where: balanceWhere,
      include: { productVariant: { select: variantSelect } },
    });

    const initBucket = () => ({ UZS: 0, USD: 0 });
    const purchase = initBucket();
    const sales = initBucket();
    const inventoryValue = initBucket();

    const normalizeCurrency = (c: any): 'UZS' | 'USD' =>
      String(c || 'UZS').toUpperCase() === 'USD' ? 'USD' : 'UZS';

    for (const m of inMovements) {
      const v = m.productVariant;
      const currency = normalizeCurrency(v?.currency);
      const price = Number(v?.purchasePrice || 0);
      purchase[currency] += Math.abs(Number(m.quantity)) * price;
    }

    for (const m of outMovements) {
      const v = m.productVariant;
      const currency = normalizeCurrency(v?.currency);
      const price = Number(v?.salePrice || 0);
      sales[currency] += Math.abs(Number(m.quantity)) * price;
    }

    for (const b of balances) {
      const v = b.productVariant;
      const currency = normalizeCurrency(v?.currency);
      const price = Number(v?.purchasePrice || 0);
      inventoryValue[currency] += Number(b.quantity) * price;
    }

    const round2 = (n: number) => Math.round(n * 100) / 100;
    const round = (bucket: { UZS: number; USD: number }) => ({
      UZS: round2(bucket.UZS),
      USD: round2(bucket.USD),
    });

    const purchaseR = round(purchase);
    const salesR = round(sales);
    const inventoryR = round(inventoryValue);
    const profit = {
      UZS: round2(salesR.UZS - purchaseR.UZS),
      USD: round2(salesR.USD - purchaseR.USD),
    };

    // Marja % (faqat sotuv > 0 bo'lganda)
    const margin = {
      UZS: salesR.UZS > 0 ? round2(((salesR.UZS - purchaseR.UZS) / salesR.UZS) * 100) : 0,
      USD: salesR.USD > 0 ? round2(((salesR.USD - purchaseR.USD) / salesR.USD) * 100) : 0,
    };

    return {
      period: {
        from: range.dateFrom,
        to: range.dateTo,
        days: range.days,
        defaulted: range.defaulted,
        capped: range.capped,
      },
      warehouseId: query.warehouseId || null,
      purchase: purchaseR,
      sales: salesR,
      profit,
      margin,
      inventoryValue: inventoryR,
      counts: {
        purchaseMovements: inMovements.length,
        salesMovements: outMovements.length,
        stockLines: balances.length,
      },
    };
  }

  /**
   * Kunlik kirim/sotuv taqsimoti — chiziqli grafik uchun.
   * Sana oralig'ida har bir kunga summalarni guruhlaydi (UTC kun chegarasi).
   * Ko'rsatkichlar valyuta bo'yicha alohida: { UZS, USD }.
   */
  async getDailyBreakdown(
    companyId: string,
    query: { dateFrom?: string; dateTo?: string; warehouseId?: string },
  ) {
    const range = parseReportDateRange(query);
    const inWhere = this.buildMovementWhere(companyId, range, query.warehouseId, {
      type: 'IN',
      sourceType: 'GOODS_RECEIPT',
    });
    const outWhere = this.buildMovementWhere(companyId, range, query.warehouseId, {
      type: 'OUT',
    });

    await Promise.all([
      this.assertMovementCountWithinLimit(inWhere, 'Kunlik kirim'),
      this.assertMovementCountWithinLimit(outWhere, 'Kunlik sotuv'),
    ]);

    const variantSelect = {
      currency: true,
      purchasePrice: true,
      salePrice: true,
    } as const;

    const [inMovements, outMovements] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where: inWhere,
        select: {
          createdAt: true,
          quantity: true,
          productVariant: { select: variantSelect },
        },
      }),
      this.prisma.stockMovement.findMany({
        where: outWhere,
        select: {
          createdAt: true,
          quantity: true,
          productVariant: { select: variantSelect },
        },
      }),
    ]);

    const normalizeCurrency = (c: any): 'UZS' | 'USD' =>
      String(c || 'UZS').toUpperCase() === 'USD' ? 'USD' : 'UZS';
    const dayKey = (d: Date) => d.toISOString().slice(0, 10);

    // Kun → { purchase: {UZS, USD}, sales: {UZS, USD} }
    const map = new Map<string, {
      date: string;
      purchase: { UZS: number; USD: number };
      sales: { UZS: number; USD: number };
    }>();

    const ensure = (key: string) => {
      if (!map.has(key)) {
        map.set(key, {
          date: key,
          purchase: { UZS: 0, USD: 0 },
          sales: { UZS: 0, USD: 0 },
        });
      }
      return map.get(key)!;
    };

    // Davrning har bir kuni uchun bo'sh yozuv (grafik uzluksiz bo'lishi uchun)
    const cursor = new Date(range.gte);
    cursor.setUTCHours(0, 0, 0, 0);
    const endDay = new Date(range.lte);
    endDay.setUTCHours(0, 0, 0, 0);
    while (cursor.getTime() <= endDay.getTime()) {
      ensure(dayKey(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    for (const m of inMovements) {
      const key = dayKey(m.createdAt);
      const cur = normalizeCurrency(m.productVariant?.currency);
      const price = Number(m.productVariant?.purchasePrice || 0);
      ensure(key).purchase[cur] += Math.abs(Number(m.quantity)) * price;
    }
    for (const m of outMovements) {
      const key = dayKey(m.createdAt);
      const cur = normalizeCurrency(m.productVariant?.currency);
      const price = Number(m.productVariant?.salePrice || 0);
      ensure(key).sales[cur] += Math.abs(Number(m.quantity)) * price;
    }

    const round2 = (n: number) => Math.round(n * 100) / 100;
    return Array.from(map.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({
        date: d.date,
        purchase: { UZS: round2(d.purchase.UZS), USD: round2(d.purchase.USD) },
        sales: { UZS: round2(d.sales.UZS), USD: round2(d.sales.USD) },
        profit: {
          UZS: round2(d.sales.UZS - d.purchase.UZS),
          USD: round2(d.sales.USD - d.purchase.USD),
        },
      }));
  }

  /**
   * Top sotilgan mahsulotlar — chiqim qilingan miqdor bo'yicha tartiblanadi.
   * Bitta variant bitta yozuv (mahsulot + variant nomi birga).
   */
  async getTopProducts(
    companyId: string,
    query: { dateFrom?: string; dateTo?: string; warehouseId?: string; limit?: number },
  ) {
    const range = parseReportDateRange(query);
    const where = this.buildMovementWhere(companyId, range, query.warehouseId, {
      type: 'OUT',
    });
    await this.assertMovementCountWithinLimit(where, 'Top mahsulotlar');

    const movements = await this.prisma.stockMovement.findMany({
      where,
      select: {
        quantity: true,
        productVariantId: true,
        productVariant: {
          select: {
            name: true,
            sku: true,
            currency: true,
            salePrice: true,
            product: { select: { name: true } },
          },
        },
      },
    });

    type Agg = {
      productVariantId: string;
      productName: string;
      variantName: string;
      sku: string | null;
      currency: 'UZS' | 'USD';
      quantity: number;
      revenue: number;
    };
    const aggMap = new Map<string, Agg>();
    const normalizeCurrency = (c: any): 'UZS' | 'USD' =>
      String(c || 'UZS').toUpperCase() === 'USD' ? 'USD' : 'UZS';

    for (const m of movements) {
      const v = m.productVariant;
      if (!v) continue;
      const qty = Math.abs(Number(m.quantity));
      const currency = normalizeCurrency(v.currency);
      const price = Number(v.salePrice || 0);
      const existing = aggMap.get(m.productVariantId);
      if (existing) {
        existing.quantity += qty;
        existing.revenue += qty * price;
      } else {
        aggMap.set(m.productVariantId, {
          productVariantId: m.productVariantId,
          productName: v.product?.name || '—',
          variantName: v.name,
          sku: v.sku ?? null,
          currency,
          quantity: qty,
          revenue: qty * price,
        });
      }
    }

    const round2 = (n: number) => Math.round(n * 100) / 100;
    const limit = Math.max(1, Math.min(50, Number(query.limit) || 10));
    return Array.from(aggMap.values())
      .map((a) => ({ ...a, revenue: round2(a.revenue) }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, limit);
  }

  /**
   * Yig'ma hisobotni Excel'ga eksport qilish — 3 ta varaq:
   * Summary, Daily breakdown, Top products.
   */

  async getStockReport(companyId: string, query: ReportQueryDto) {
    const balances = await this.prisma.stockBalance.findMany({
      where: {
        companyId,
        warehouseId: query.warehouseId,
        productVariantId: query.productVariantId,
      },
      include: {
        warehouse: { select: { name: true } },
        productVariant: {
          select: {
            name: true,
            sku: true,
            purchasePrice: true,
            salePrice: true,
            product: { select: { name: true } }
          }
        }
      }
    });

    const report = balances.map(b => ({
      warehouse: b.warehouse.name,
      product: b.productVariant.product.name,
      variant: b.productVariant.name,
      sku: b.productVariant.sku,
      quantity: b.quantity,
      purchasePrice: Number(b.productVariant.purchasePrice || 0),
      salePrice: Number(b.productVariant.salePrice || 0),
      inventoryValue: Number(b.quantity) * Number(b.productVariant.purchasePrice || 0)
    }));

    const summary = {
      totalItems: report.length,
      totalQuantity: report.reduce((sum, item) => sum + Number(item.quantity), 0),
      totalValue: report.reduce((sum, item) => sum + item.inventoryValue, 0)
    };

    return { summary, data: report };
  }

  async getStockMovementReport(companyId: string, query: ReportQueryDto) {
    const range = parseReportDateRange({
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });
    const where: Prisma.StockMovementWhereInput = {
      companyId,
      createdAt: { gte: range.gte, lte: range.lte },
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.productVariantId ? { productVariantId: query.productVariantId } : {}),
    };

    await this.assertMovementCountWithinLimit(where, 'Ombor harakatlari');

    const maxRows = getReportMaxMovementRows();
    const movements = await this.prisma.stockMovement.findMany({
      where,
      include: {
        warehouse: { select: { name: true } },
        productVariant: {
          select: {
            name: true,
            product: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: maxRows,
    });

    return movements.map(m => ({
      date: m.createdAt,
      type: m.type,
      warehouse: m.warehouse.name,
      product: m.productVariant.product.name,
      variant: m.productVariant.name,
      quantity: m.quantity,
      sourceType: m.sourceType,
      note: m.note
    }));
  }

  async getDebtorsReport(companyId: string, query: ReportQueryDto) {
    const debts = await this.prisma.debtEntry.findMany({
      where: {
        creditorId: companyId,
        debtorId: query.partnerCompanyId,
        status: this.resolveDebtStatusFilter(query.status),
      },
      include: {
        debtor: { select: { name: true } },
        receipt: { select: { id: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return debts.map((d) => ({
      id: d.id,
      partner: d.debtor?.name || 'Unknown',
      receiptNumber: d.receipt?.id?.slice(0, 8).toUpperCase() || 'N/A',
      amount: Number(d.amount),
      remainingAmount: Number(d.remainingAmount),
      status: d.status,
      createdAt: d.createdAt
    }));
  }

  async getCreditorsReport(companyId: string, query: ReportQueryDto) {
    const debts = await this.prisma.debtEntry.findMany({
      where: {
        debtorId: companyId,
        creditorId: query.partnerCompanyId,
        status: this.resolveDebtStatusFilter(query.status),
      },
      include: {
        creditor: { select: { name: true } },
        receipt: { select: { id: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return debts.map((d) => ({
      id: d.id,
      partner: d.creditor?.name || 'Unknown',
      receiptNumber: d.receipt?.id?.slice(0, 8).toUpperCase() || 'N/A',
      amount: Number(d.amount),
      remainingAmount: Number(d.remainingAmount),
      status: d.status,
      createdAt: d.createdAt
    }));
  }

  async getPartnersBalanceReport(companyId: string) {
    const claims = await this.prisma.debtEntry.groupBy({
      by: ['debtorId'],
      where: { creditorId: companyId },
      _sum: { remainingAmount: true }
    });

    const liabilities = await this.prisma.debtEntry.groupBy({
      by: ['creditorId'],
      where: { debtorId: companyId },
      _sum: { remainingAmount: true }
    });

    const partners = await this.prisma.partner.findMany({
      where: { ownerCompanyId: companyId },
      include: { partnerCompany: { select: { id: true, name: true } } }
    });

    return partners.map(p => {
      const claim = (claims as any[]).find(c => c.debtorId === p.partnerCompanyId);
      const liability = (liabilities as any[]).find(l => l.creditorId === p.partnerCompanyId);
      
      const claimAmount = Number(claim?._sum.remainingAmount || 0);
      const liabilityAmount = Number(liability?._sum.remainingAmount || 0);

      return {
        partnerId: p.partnerCompanyId,
        partnerName: p.partnerCompany.name,
        claimAmount,
        liabilityAmount,
        netBalance: claimAmount - liabilityAmount 
      };
    });
  }

  async getPartnerDetailedBalance(companyId: string, partnerCompanyId: string, query: { dateFrom?: string; dateTo?: string }) {
    const where: any = {
      OR: [
        { creditorId: companyId, debtorId: partnerCompanyId },
        { creditorId: partnerCompanyId, debtorId: companyId }
      ]
    };

    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.createdAt.lte = new Date(query.dateTo);
    }

    const debts = await this.prisma.debtEntry.findMany({
      where,
      include: {
        receipt: { include: { order: true } },
        debtor: { select: { name: true, tin: true, address: true } },
        creditor: { select: { name: true, tin: true, address: true } }
      },
      orderBy: { createdAt: 'asc' }
    });

    const payments = await this.prisma.debtPaymentRecord.findMany({
      where: {
        debtEntry: {
          OR: [
            { creditorId: companyId, debtorId: partnerCompanyId },
            { creditorId: partnerCompanyId, debtorId: companyId }
          ]
        },
        status: 'CONFIRMED'
      },
      include: { debtEntry: true },
      orderBy: { createdAt: 'asc' }
    });

    const transactions = [
      ...debts.map((d) => ({
        date: d.createdAt,
        description: d.receipt?.orderId
          ? `Buyurtma ORD-${d.receipt.orderId.slice(0, 8).toUpperCase()}`
          : d.receiptId
            ? `Qabul RCP-${d.receiptId.slice(0, 8).toUpperCase()}`
            : `Qarz ${d.id.slice(0, 8).toUpperCase()}`,
        debit: d.creditorId === companyId ? Number(d.amount) : 0,
        credit: d.debtorId === companyId ? Number(d.amount) : 0,
        currency: String(d.currency || 'UZS').toUpperCase() === 'USD' ? 'USD' : 'UZS',
      })),
      ...payments.map((p) => ({
        date: p.createdAt,
        description: `To'lov (${p.notes || 'Tasdiqlangan'})`,
        debit: p.debtEntry.creditorId === partnerCompanyId ? Number(p.amount) : 0,
        credit: p.debtEntry.debtorId === partnerCompanyId ? Number(p.amount) : 0,
        currency:
          String(p.debtEntry.currency || 'UZS').toUpperCase() === 'USD' ? 'USD' : 'UZS',
      })),
    ].sort((a, b) => a.date.getTime() - b.date.getTime());

    const partner = await this.prisma.company.findUnique({
      where: { id: partnerCompanyId },
      select: { name: true, tin: true, address: true, phone: true },
    });

    const myCompany = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, tin: true, address: true, phone: true },
    });

    if (!partner || !myCompany) {
      throw new NotFoundException('Kompaniya yoki hamkor topilmadi');
    }

    return { transactions, partner, myCompany };
  }

  async getB2BOrdersReport(companyId: string, query: ReportQueryDto) {
    const where: any = {
      OR: [
        { buyerCompanyId: companyId },
        { sellerCompanyId: companyId }
      ]
    };

    if (query.status) where.status = query.status;
    if (query.partnerCompanyId) {
      where.OR = [
        { buyerCompanyId: companyId, sellerCompanyId: query.partnerCompanyId },
        { sellerCompanyId: companyId, buyerCompanyId: query.partnerCompanyId }
      ];
    }
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
      if (query.dateTo) where.createdAt.lte = new Date(query.dateTo);
    }

    const orders = await this.prisma.b2BOrder.findMany({
      where,
      include: {
        buyer: { select: { name: true } },
        seller: { select: { name: true } },
        items: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return orders.map(o => {
      const totalAmount = o.items.reduce((sum, item) => 
        sum + (Number(item.quantity) * Number(item.expectedPrice || 0)), 0
      );

      return {
        id: o.id,
        date: o.createdAt,
        type: o.sellerCompanyId === companyId ? 'OUTGOING' : 'INCOMING',
        partner: o.sellerCompanyId === companyId ? o.buyer.name : o.seller.name,
        status: o.status,
        itemCount: o.items.length,
        totalAmount
      };
    });
  }

  // --- ANALYTICS FOR DASHBOARD ---

  async getB2BOrdersAnalytics(companyId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const orders = await this.prisma.b2BOrder.findMany({
      where: {
        OR: [{ buyerCompanyId: companyId }, { sellerCompanyId: companyId }],
        createdAt: { gte: startDate }
      },
      include: { items: true }
    });

    // Detect currency automatically: if any B2B order item utilizes USD, treat the dataset as USD, otherwise default to UZS.
    let currency = 'UZS';
    for (const o of orders) {
      if (o.items.some(item => String(item.expectedCurrency || 'UZS').toUpperCase() === 'USD')) {
        currency = 'USD';
        break;
      }
    }

    const grouped: Record<string, { count: number, volume: number }> = {};
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      grouped[key] = { count: 0, volume: 0 };
    }

    orders.forEach(o => {
      const key = o.createdAt.toISOString().split('T')[0];
      if (grouped[key]) {
        grouped[key].count += 1;
        const volume = o.items.reduce((s, item) => {
          const itemCur = String(item.expectedCurrency || 'UZS').toUpperCase();
          if (itemCur !== currency) return s;
          return s + Number(item.quantity) * Number(item.expectedPrice || 0);
        }, 0);
        grouped[key].volume += volume;
      }
    });

    const round2 = (n: number) => Math.round(n * 100) / 100;

    const data = Object.entries(grouped)
      .map(([date, stats]) => ({
        date,
        count: stats.count,
        volume: round2(stats.volume)
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      currency,
      data
    };
  }

  async getStockMovementAnalytics(companyId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const daily: Record<string, { in: number; out: number }> = {};
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      daily[d.toISOString().split('T')[0]] = { in: 0, out: 0 };
    }

    const dailyRows = await this.prisma.$queryRaw<
      Array<{ day: Date; type: string; qty: bigint }>
    >`
      SELECT DATE("createdAt") AS day, type, SUM(quantity)::bigint AS qty
      FROM "StockMovement"
      WHERE "companyId" = ${companyId} AND "createdAt" >= ${startDate}
      GROUP BY DATE("createdAt"), type
    `;

    for (const row of dailyRows) {
      const key = new Date(row.day).toISOString().split('T')[0];
      if (!daily[key]) continue;
      const qty = Number(row.qty || 0);
      if (row.type === 'IN') daily[key].in += qty;
      else if (row.type === 'OUT') daily[key].out += qty;
    }

    const topRows = await this.prisma.$queryRaw<
      Array<{ name: string; qty: bigint }>
    >`
      SELECT p.name AS name, SUM(sm.quantity)::bigint AS qty
      FROM "StockMovement" sm
      INNER JOIN "ProductVariant" pv ON pv.id = sm."productVariantId"
      INNER JOIN "Product" p ON p.id = pv."productId"
      WHERE sm."companyId" = ${companyId}
        AND sm."createdAt" >= ${startDate}
        AND sm.type = 'OUT'
      GROUP BY p.name
      ORDER BY qty DESC
      LIMIT 5
    `;

    return {
      daily: Object.entries(daily)
        .map(([date, stats]) => ({ date, ...stats }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      topProducts: topRows.map((r) => ({
        name: r.name,
        value: Number(r.qty || 0),
      })),
    };
  }

}
