import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getDayRangeInAppTimezone } from '../../common/tashkent-date.util';

@Injectable()
export class TelegramPosReportService {
  constructor(private readonly prisma: PrismaService) {}

  private formatMoney(value: number, currency = 'UZS'): string {
    const n = Math.round(Number(value) || 0);
    const formatted = n.toLocaleString('uz-UZ');
    return currency === 'USD' ? `$${formatted}` : `${formatted} so'm`;
  }

  private formatQty(value: number): string {
    const n = Number(value) || 0;
    if (Number.isInteger(n)) return String(n);
    return n.toFixed(2).replace(/\.?0+$/, '');
  }

  async buildTodayReport(companyId: string): Promise<string> {
    const { start, end, dateLabel } = getDayRangeInAppTimezone();

    const saleWhere = {
      companyId,
      status: 'COMPLETED' as const,
      OR: [
        { completedAt: { gte: start, lte: end } },
        { completedAt: null, createdAt: { gte: start, lte: end } },
      ],
    };

    const [saleAgg, voidedCount, payments, topProducts, totalQtyRow] = await Promise.all([
      this.prisma.posSale.aggregate({
        where: saleWhere,
        _sum: { totalAmount: true, discountAmount: true, subtotal: true },
        _count: { _all: true },
      }),
      this.prisma.posSale.count({
        where: {
          companyId,
          status: 'VOIDED',
          createdAt: { gte: start, lte: end },
        },
      }),
      this.prisma.posPayment.findMany({
        where: { sale: saleWhere },
        select: { method: true, amount: true },
      }),
      this.prisma.posSaleItem.groupBy({
        by: ['productNameSnapshot'],
        where: { sale: saleWhere },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 8,
      }),
      this.prisma.posSaleItem.aggregate({
        where: { sale: saleWhere },
        _sum: { quantity: true },
      }),
    ]);

    const checkCount = saleAgg._count._all;
    const total = Number(saleAgg._sum.totalAmount || 0);
    const discount = Number(saleAgg._sum.discountAmount || 0);
    const totalQty = Number(totalQtyRow._sum.quantity || 0);

    const byMethod: Record<string, number> = { CASH: 0, CARD: 0, CREDIT: 0, OTHER: 0 };
    for (const p of payments) {
      const method = String(p.method || 'OTHER').toUpperCase();
      const key = ['CASH', 'CARD', 'CREDIT'].includes(method) ? method : 'OTHER';
      byMethod[key] += Number(p.amount || 0);
    }

    const lines: string[] = [
      `📊 POS — bugun (${dateLabel}, Toshkent)`,
      '',
      `🧾 Cheklar: ${checkCount} ta`,
      `💰 Jami savdo: ${this.formatMoney(total)}`,
    ];

    if (discount > 0) {
      lines.push(`🏷 Chegirma: ${this.formatMoney(discount)}`);
    }

    lines.push('', '💳 To\'lov turlari:');
    if (byMethod.CASH > 0) lines.push(`• Naqd: ${this.formatMoney(byMethod.CASH)}`);
    if (byMethod.CARD > 0) lines.push(`• Karta: ${this.formatMoney(byMethod.CARD)}`);
    if (byMethod.CREDIT > 0) lines.push(`• Nasiya: ${this.formatMoney(byMethod.CREDIT)}`);
    if (byMethod.OTHER > 0) lines.push(`• Boshqa: ${this.formatMoney(byMethod.OTHER)}`);
    if (checkCount === 0) {
      lines.push('• Bugun yakunlangan savdo yo\'q');
    }

    lines.push('', `📦 Jami sotilgan (pozitsiya): ${this.formatQty(totalQty)} dona`);

    if (topProducts.length > 0) {
      lines.push('', '🔝 Ko\'p sotilgan mahsulotlar:');
      for (const row of topProducts) {
        const qty = Number(row._sum.quantity || 0);
        lines.push(`• ${row.productNameSnapshot} — ${this.formatQty(qty)}`);
      }
    }

    if (voidedCount > 0) {
      lines.push('', `⚠️ Bekor qilingan cheklar: ${voidedCount} ta`);
    }

    lines.push('', 'Batafsil — veb-ilovada POS bo\'limi.');
    return lines.join('\n');
  }
}
