import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppCacheService } from '../../common/cache/app-cache.service';
import { InventoryGateway } from '../warehouses/inventory.gateway';

@Injectable()
export class DashboardService {
  private readonly cacheTtlMs = Number(process.env.DASHBOARD_CACHE_TTL_MS || 90 * 1000);

  constructor(
    private prisma: PrismaService,
    private cache: AppCacheService,
    private inventoryGateway: InventoryGateway,
  ) {}

  private cacheKey(companyId: string) {
    return `dashboard:stats:${companyId}`;
  }

  invalidate(companyId: string) {
    void this.cache.del(this.cacheKey(companyId));
    this.inventoryGateway.emitDashboardRefresh(companyId);
  }

  async getStats(companyId: string) {
    const key = this.cacheKey(companyId);
    const cached = await this.cache.getJson<Awaited<ReturnType<DashboardService['computeStats']>>>(
      key,
    );
    if (cached) return cached;

    const data = await this.computeStats(companyId);
    await this.cache.setJson(key, data, this.cacheTtlMs);
    return data;
  }

  private async computeStats(companyId: string) {
    const [
      totalProducts,
      totalInventoryValue,
      totalDebts,
      totalCredits,
      recentOrders,
      topProductsData,
      dailyDispatches,
      pendingReceipts,
    ] = await Promise.all([
      this.prisma.productVariant.count({
        where: { product: { companyId } },
      }),

      this.prisma.stockBalance
        .findMany({
          where: { warehouse: { companyId } },
          select: {
            quantity: true,
            productVariant: { select: { salePrice: true, currency: true } },
          },
        })
        .then((balances) => {
          return balances.reduce(
            (acc, b) => {
              const c = (b.productVariant.currency || 'UZS').toUpperCase();
              const val = Number(b.productVariant.salePrice || 0) * Number(b.quantity);
              acc[c] = (acc[c] || 0) + val;
              return acc;
            },
            { UZS: 0, USD: 0 } as Record<string, number>,
          );
        }),

      this.prisma.debtEntry
        .groupBy({
          by: ['currency'],
          where: { creditorId: companyId, status: { in: ['OPEN', 'PARTIAL'] } },
          _sum: { remainingAmount: true },
        })
        .then((rows) => {
          const acc = { UZS: 0, USD: 0 };
          for (const row of rows) {
            const c = (row.currency || 'UZS').toUpperCase();
            acc[c] = (acc[c] || 0) + Number(row._sum.remainingAmount || 0);
          }
          return acc;
        }),

      this.prisma.debtEntry
        .groupBy({
          by: ['currency'],
          where: { debtorId: companyId, status: { in: ['OPEN', 'PARTIAL'] } },
          _sum: { remainingAmount: true },
        })
        .then((rows) => {
          const acc = { UZS: 0, USD: 0 };
          for (const row of rows) {
            const c = (row.currency || 'UZS').toUpperCase();
            acc[c] = (acc[c] || 0) + Number(row._sum.remainingAmount || 0);
          }
          return acc;
        }),

      this.prisma.b2BOrder.findMany({
        where: {
          OR: [{ buyerCompanyId: companyId }, { sellerCompanyId: companyId }],
          status: { not: 'DRAFT' },
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          buyer: { select: { name: true } },
          seller: { select: { name: true } },
        },
      }),

      (this.prisma.b2BOrderItem as any).groupBy({
        by: ['productNameSnapshot'],
        where: { order: { sellerCompanyId: companyId, status: 'COMPLETED' } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 3,
      }) as Promise<any[]>,

      this.prisma.dispatch.count({
        where: {
          sellerCompanyId: companyId,
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),

      this.prisma.goodsReceipt.count({
        where: {
          buyerCompanyId: companyId,
          status: 'PENDING',
        },
      }),
    ]);

    return {
      stats: {
        totalProducts,
        inventoryValue: totalInventoryValue,
        totalReceivables: totalDebts,
        totalPayables: totalCredits,
        dailyDispatches,
        pendingReceipts,
        productChange: 0,
        inventoryChange: 0,
        debtChange: 0,
        creditChange: 0,
      },
      topProducts: (topProductsData as any[]).map((tp) => ({
        name: tp.productNameSnapshot,
        soldCount: Number(tp._sum.quantity || 0),
        totalRevenue: 0,
      })),
      recentOrders: (recentOrders as any[]).map((o) => ({
        id: o.id,
        orderNumber: o.id.slice(0, 8).toUpperCase(),
        partnerName: o.buyerCompanyId === companyId ? o.seller.name : o.buyer.name,
        amount: 0,
        status: o.status,
        createdAt: o.createdAt,
      })),
    };
  }
}
