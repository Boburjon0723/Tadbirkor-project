import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditLogsService {
  constructor(private prisma: PrismaService) {}

  private toNum(v: unknown): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  private addAmount(bucket: Record<string, number>, currency: string, value: number) {
    const c = String(currency || 'UZS').toUpperCase();
    bucket[c] = this.toNum(bucket[c]) + this.toNum(value);
  }

  private async attachUserMeta<T extends { userId: string }>(rows: T[]) {
    const userIds = [...new Set(rows.map((r) => r.userId).filter(Boolean))];
    if (!userIds.length) return rows.map((r) => ({ ...r, user: null }));

    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, fullName: true, login: true, phone: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));

    return rows.map((r) => ({
      ...r,
      user: byId.get(r.userId) || null,
    }));
  }

  private async attachOrderMeta<T extends { entityType: string; entityId: string; companyId: string }>(rows: T[]) {
    const orderIds = [...new Set(rows.filter((r) => r.entityType === 'B2B_ORDER').map((r) => r.entityId))];
    if (!orderIds.length) return rows;

    const orders: any[] = await this.prisma.b2BOrder.findMany({
      where: { id: { in: orderIds } },
      include: {
        buyer: { select: { id: true, name: true } },
        seller: { select: { id: true, name: true } },
        items: {
          select: {
            id: true,
            productNameSnapshot: true,
            quantity: true,
            expectedPrice: true,
            expectedCurrency: true,
          },
        },
        dispatches: {
          include: {
            items: { select: { quantity: true } },
          },
        },
        goodsReceipts: {
          include: {
            items: { select: { quantity: true, receivedQuantity: true, productNameSnapshot: true } },
          },
        },
      },
    });

    const byOrderId = new Map<string, any>();
    for (const o of orders) {
      const orderedAmountByCurrency: Record<string, number> = {};
      const receivedAmountByCurrency: Record<string, number> = {};

      let qtyOrdered = 0;
      for (const i of o.items) {
        const q = this.toNum(i.quantity);
        const p = this.toNum(i.expectedPrice);
        qtyOrdered += q;
        this.addAmount(orderedAmountByCurrency, i.expectedCurrency || 'UZS', q * p);
      }

      let qtyDispatched = 0;
      for (const d of o.dispatches || []) {
        for (const di of d.items || []) {
          qtyDispatched += this.toNum(di.quantity);
        }
      }

      let qtyReceived = 0;
      for (const r of o.goodsReceipts || []) {
        if (!['ACCEPTED', 'PARTIALLY_ACCEPTED'].includes(String((r as any).status || ''))) continue;
        for (const ri of r.items || []) {
          const q = this.toNum(ri.receivedQuantity ?? ri.quantity);
          qtyReceived += q;
          const orderItem = (o.items || []).find(
            (oi: any) =>
              String(oi.productNameSnapshot || '').trim().toLowerCase() ===
              String(ri.productNameSnapshot || '').trim().toLowerCase(),
          );
          const p = this.toNum(orderItem?.expectedPrice);
          const c = String(orderItem?.expectedCurrency || 'UZS');
          this.addAmount(receivedAmountByCurrency, c, q * p);
        }
      }

      const remainingAmountByCurrency: Record<string, number> = {};
      const currencies = new Set([...Object.keys(orderedAmountByCurrency), ...Object.keys(receivedAmountByCurrency)]);
      for (const c of currencies) {
        remainingAmountByCurrency[c] = this.toNum(orderedAmountByCurrency[c]) - this.toNum(receivedAmountByCurrency[c]);
      }

      byOrderId.set(o.id, {
        orderId: o.id,
        buyerCompanyId: o.buyerCompanyId,
        sellerCompanyId: o.sellerCompanyId,
        buyerName: o.buyer?.name || null,
        sellerName: o.seller?.name || null,
        qtyOrdered,
        qtyDispatched,
        qtyReceived,
        qtyRemaining: qtyOrdered - qtyReceived,
        orderedAmountByCurrency,
        receivedAmountByCurrency,
        remainingAmountByCurrency,
      });
    }

    return rows.map((r) => {
      const summary = r.entityType === 'B2B_ORDER' ? byOrderId.get(r.entityId) || null : null;
      const counterpartyName = summary
        ? r.companyId === summary.buyerCompanyId
          ? summary.sellerName
          : summary.buyerName
        : null;

      return {
        ...r,
        orderSummary: summary
          ? {
              ...summary,
              counterpartyName,
            }
          : null,
      };
    });
  }

  async findAll(companyId: string, query: any) {
    const { 
      action, 
      entityType, 
      userId, 
      dateFrom, 
      dateTo,
      limit = 50,
      offset = 0
    } = query;

    const rows = await this.prisma.auditLog.findMany({
      where: {
        companyId,
        action: action || undefined,
        entityType: entityType || undefined,
        userId: userId || undefined,
        createdAt: {
          gte: dateFrom ? new Date(dateFrom) : undefined,
          lte: dateTo ? new Date(dateTo) : undefined,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Number(limit),
      skip: Number(offset),
    });

    const withUser = await this.attachUserMeta(rows as any);
    return this.attachOrderMeta(withUser as any);
  }

  async findOne(id: string, companyId: string) {
    const row = await this.prisma.auditLog.findFirst({
      where: { id, companyId },
    });
    if (!row) return null;
    const [withUser] = await this.attachUserMeta([row as any]);
    const [withOrder] = await this.attachOrderMeta([withUser as any]);
    return withOrder;
  }

  async getStats(companyId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalToday, priceUpdates, stockActions] = await Promise.all([
      this.prisma.auditLog.count({
        where: { companyId, createdAt: { gte: today } }
      }),
      this.prisma.auditLog.count({
        where: { companyId, action: 'product.price_updated' }
      }),
      this.prisma.auditLog.count({
        where: { 
          companyId, 
          action: { in: ['stock.in', 'stock.out'] } 
        }
      })
    ]);

    return { totalToday, priceUpdates, stockActions };
  }
}
