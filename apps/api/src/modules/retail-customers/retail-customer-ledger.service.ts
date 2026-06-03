import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export const LEDGER_OPERATIONS = {
  PREPAID_IN: 'PREPAID_IN',
  PREPAID_OUT: 'PREPAID_OUT',
  PREPAID_USE: 'PREPAID_USE',
  CREDIT_SALE: 'CREDIT_SALE',
  DEBT_PAYMENT: 'DEBT_PAYMENT',
  POS_VOID: 'POS_VOID',
} as const;

export type LedgerOperation =
  (typeof LEDGER_OPERATIONS)[keyof typeof LEDGER_OPERATIONS];

export const LEDGER_OPERATION_LABELS: Record<LedgerOperation, string> = {
  PREPAID_IN: 'Avans (kirim)',
  PREPAID_OUT: 'Pul qaytarish',
  PREPAID_USE: 'Avansdan sotuv',
  CREDIT_SALE: 'Nasiya sotuv',
  DEBT_PAYMENT: 'Qarz to‘lovi',
  POS_VOID: 'Bekor qilingan POS',
};

export type LedgerCurrency = 'UZS' | 'USD';

type PrismaTx = Prisma.TransactionClient | PrismaService;

@Injectable()
export class RetailCustomerLedgerService {
  constructor(private prisma: PrismaService) {}

  roundMoney(n: number) {
    return Math.round(n * 100) / 100;
  }

  normalizeCurrency(value: unknown): LedgerCurrency {
    return String(value || 'UZS').toUpperCase() === 'USD' ? 'USD' : 'UZS';
  }

  async computeDebt(
    tx: PrismaTx,
    companyId: string,
    retailCustomerId: string,
    currency?: LedgerCurrency,
  ): Promise<number> {
    const open = await tx.retailReceivable.findMany({
      where: {
        companyId,
        retailCustomerId,
        status: { in: ['OPEN', 'PARTIAL'] },
        ...(currency ? { currency } : {}),
      },
      select: { remainingAmount: true },
    });
    return this.roundMoney(
      open.reduce((s, r) => s + Number(r.remainingAmount), 0),
    );
  }

  async computeSnapshot(
    tx: PrismaTx,
    companyId: string,
    retailCustomerId: string,
    currency: LedgerCurrency = 'UZS',
  ) {
    const customer = await tx.retailCustomer.findFirst({
      where: { id: retailCustomerId, companyId },
      select: { prepaidBalance: true, prepaidBalanceUsd: true },
    });
    if (!customer) throw new BadRequestException('Mijoz topilmadi');
    const prepaid = this.roundMoney(
      currency === 'USD'
        ? Number(customer.prepaidBalanceUsd ?? 0)
        : Number(customer.prepaidBalance ?? 0),
    );
    const debt = await this.computeDebt(tx, companyId, retailCustomerId, currency);
    return {
      currency,
      prepaidBalance: prepaid,
      totalDebt: debt,
      netBalance: this.roundMoney(prepaid - debt),
    };
  }

  async computeAllBalances(
    tx: PrismaTx,
    companyId: string,
    retailCustomerId: string,
  ) {
    const [uzs, usd] = await Promise.all([
      this.computeSnapshot(tx, companyId, retailCustomerId, 'UZS'),
      this.computeSnapshot(tx, companyId, retailCustomerId, 'USD'),
    ]);
    return { UZS: uzs, USD: usd };
  }

  prepaidField(currency: LedgerCurrency) {
    return currency === 'USD' ? 'prepaidBalanceUsd' : 'prepaidBalance';
  }

  async appendEntry(
    tx: PrismaTx,
    params: {
      companyId: string;
      retailCustomerId: string;
      operation: LedgerOperation;
      debit?: number;
      credit?: number;
      currency?: string;
      note?: string | null;
      posSaleId?: string;
      receivableId?: string;
      paymentId?: string;
      createdById?: string;
      balanceAfter?: number;
      createdAt?: Date;
    },
  ) {
    const currency = this.normalizeCurrency(params.currency);
    const debit = this.roundMoney(Number(params.debit ?? 0));
    const credit = this.roundMoney(Number(params.credit ?? 0));
    if (debit < 0 || credit < 0) {
      throw new BadRequestException('Debet yoki kredit manfiy bo‘lmasligi kerak');
    }
    if (debit > 0 && credit > 0) {
      throw new BadRequestException('Bitta yozuvda faqat debet yoki kredit');
    }
    if (debit <= 0 && credit <= 0) {
      throw new BadRequestException('Summa 0 dan katta bo‘lishi kerak');
    }

    const balanceAfter =
      params.balanceAfter !== undefined
        ? this.roundMoney(params.balanceAfter)
        : (
            await this.computeSnapshot(
              tx,
              params.companyId,
              params.retailCustomerId,
              currency,
            )
          ).netBalance;

    return tx.retailCustomerLedgerEntry.create({
      data: {
        companyId: params.companyId,
        retailCustomerId: params.retailCustomerId,
        operation: params.operation,
        debit,
        credit,
        balanceAfter,
        currency,
        note: params.note?.trim() || null,
        posSaleId: params.posSaleId ?? null,
        receivableId: params.receivableId ?? null,
        paymentId: params.paymentId ?? null,
        createdById: params.createdById ?? null,
        ...(params.createdAt ? { createdAt: params.createdAt } : {}),
      },
      include: {
        createdBy: { select: { id: true, fullName: true } },
        posSale: {
          select: {
            id: true,
            saleNumber: true,
            currency: true,
            completedAt: true,
            totalAmount: true,
            items: {
              select: {
                id: true,
                productNameSnapshot: true,
                quantity: true,
                unitPrice: true,
                lineTotal: true,
              },
            },
          },
        },
      },
    });
  }

  /** Eski nasiya cheklari uchun daftar yozuvlarini bir marta tiklash */
  async syncLedgerFromHistory(companyId: string, retailCustomerId: string) {
    const existing = await this.prisma.retailCustomerLedgerEntry.count({
      where: { companyId, retailCustomerId },
    });
    if (existing > 0) return;

    const receivables = await this.prisma.retailReceivable.findMany({
      where: { companyId, retailCustomerId },
      include: {
        payments: { orderBy: { createdAt: 'asc' } },
        posSale: { select: { saleNumber: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!receivables.length) return;

    type Ev = {
      at: Date;
      run: (tx: PrismaTx, running: Record<LedgerCurrency, number>) => Promise<void>;
    };
    const events: Ev[] = [];

    for (const r of receivables) {
      const currency = this.normalizeCurrency(r.currency);
      const amount = this.roundMoney(Number(r.amount));
      events.push({
        at: r.createdAt,
        run: async (tx, running) => {
          running[currency] = this.roundMoney(running[currency] - amount);
          await tx.retailCustomerLedgerEntry.create({
            data: {
              companyId,
              retailCustomerId,
              operation: LEDGER_OPERATIONS.CREDIT_SALE,
              debit: amount,
              credit: 0,
              balanceAfter: running[currency],
              currency,
              note: `POS ${r.posSale?.saleNumber || ''} — nasiya (arxiv)`,
              posSaleId: r.posSaleId,
              receivableId: r.id,
              createdAt: r.createdAt,
            },
          });
        },
      });
      for (const p of r.payments) {
        const pay = this.roundMoney(Number(p.amount));
        events.push({
          at: p.createdAt,
          run: async (tx, running) => {
            running[currency] = this.roundMoney(running[currency] + pay);
            await tx.retailCustomerLedgerEntry.create({
              data: {
                companyId,
                retailCustomerId,
                operation: LEDGER_OPERATIONS.DEBT_PAYMENT,
                debit: 0,
                credit: pay,
                balanceAfter: running[currency],
                currency,
                note: p.notes || 'Qarz to‘lovi (arxiv)',
                receivableId: r.id,
                paymentId: p.id,
                createdAt: p.createdAt,
              },
            });
          },
        });
      }
    }

    events.sort((a, b) => a.at.getTime() - b.at.getTime());

    await this.prisma.$transaction(async (tx) => {
      const running: Record<LedgerCurrency, number> = { UZS: 0, USD: 0 };
      for (const ev of events) {
        await ev.run(tx, running);
      }
    });
  }
}
