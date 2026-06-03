import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CompaniesService } from '../companies/companies.service';
import { RecordReceivablePaymentDto } from './dto/retail-receivable.dto';
import {
  LEDGER_OPERATIONS,
  RetailCustomerLedgerService,
} from '../retail-customers/retail-customer-ledger.service';
import { RetailCustomersService } from '../retail-customers/retail-customers.service';

@Injectable()
export class RetailReceivablesService {
  constructor(
    private prisma: PrismaService,
    private companiesService: CompaniesService,
    private ledger: RetailCustomerLedgerService,
    private retailCustomers: RetailCustomersService,
  ) {}

  private async assertPosCredit(companyId: string) {
    await this.companiesService.assertModuleEnabled(companyId, 'POS');
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { posCreditEnabled: true },
    });
    if (!company?.posCreditEnabled) {
      throw new BadRequestException(
        'Nasiya (mijozlar qarzi) kompaniyada o‘chirilgan. Sozlamalar → Kompaniya.',
      );
    }
  }

  async findAll(
    companyId: string,
    filters?: { status?: string; retailCustomerId?: string },
  ) {
    await this.assertPosCredit(companyId);
    const where: Record<string, unknown> = { companyId };
    if (filters?.status) where.status = filters.status;
    if (filters?.retailCustomerId) {
      where.retailCustomerId = filters.retailCustomerId;
    }
    return this.prisma.retailReceivable.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        retailCustomer: { select: { id: true, name: true, phone: true } },
        posSale: {
          select: {
            id: true,
            saleNumber: true,
            completedAt: true,
            totalAmount: true,
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          include: {
            createdBy: { select: { id: true, fullName: true } },
          },
        },
      },
    });
  }

  async findOne(id: string, companyId: string) {
    await this.assertPosCredit(companyId);
    const row = await this.prisma.retailReceivable.findFirst({
      where: { id, companyId },
      include: {
        retailCustomer: true,
        posSale: true,
        payments: {
          orderBy: { createdAt: 'desc' },
          include: { createdBy: { select: { id: true, fullName: true } } },
        },
      },
    });
    if (!row) throw new NotFoundException('Qarz yozuvi topilmadi');
    return row;
  }

  async recordPayment(
    id: string,
    companyId: string,
    userId: string,
    dto: RecordReceivablePaymentDto,
  ) {
    await this.assertPosCredit(companyId);
    const receivable = await this.findOne(id, companyId);
    const payAmount = this.ledger.roundMoney(Number(dto.amount));
    const remaining = this.ledger.roundMoney(Number(receivable.remainingAmount));
    if (payAmount <= 0) {
      throw new BadRequestException('To‘lov summasi 0 dan katta bo‘lishi kerak');
    }
    if (payAmount > remaining + 0.001) {
      throw new BadRequestException(
        `To‘lov qoldiqdan oshib ketdi. Qolgan: ${remaining}`,
      );
    }

    const currency = this.ledger.normalizeCurrency(receivable.currency);
    const customer = await this.prisma.retailCustomer.findFirst({
      where: { id: receivable.retailCustomerId, companyId },
      select: { id: true, prepaidBalance: true, prepaidBalanceUsd: true },
    });
    if (!customer) throw new NotFoundException('Mijoz topilmadi');

    const availablePrepaid = this.ledger.roundMoney(
      currency === 'USD'
        ? Number(customer.prepaidBalanceUsd ?? 0)
        : Number(customer.prepaidBalance ?? 0),
    );
    const fromPrepaid = this.ledger.roundMoney(
      Math.min(availablePrepaid, payAmount),
    );
    const fromCash = this.ledger.roundMoney(payAmount - fromPrepaid);

    const newRemaining = this.ledger.roundMoney(remaining - payAmount);
    const status =
      newRemaining <= 0 ? 'PAID' : receivable.status === 'OPEN' ? 'PARTIAL' : 'PARTIAL';

    const saleNumber =
      receivable.posSale && typeof receivable.posSale === 'object'
        ? String((receivable.posSale as { saleNumber?: string }).saleNumber || '')
        : '';

    return this.prisma.$transaction(async (tx) => {
      if (fromPrepaid > 0) {
        const field = this.ledger.prepaidField(currency);
        await tx.retailCustomer.update({
          where: { id: customer.id },
          data: { [field]: { decrement: fromPrepaid } },
        });
      }

      const noteParts = [
        dto.notes?.trim() || null,
        fromPrepaid > 0
          ? `Avansdan: ${fromPrepaid.toLocaleString()}${fromCash > 0 ? `, naqd/karta: ${fromCash.toLocaleString()}` : ''}`
          : null,
      ].filter(Boolean);

      const payment = await tx.retailReceivablePayment.create({
        data: {
          receivableId: id,
          amount: payAmount,
          notes: noteParts.length ? noteParts.join(' · ') : null,
          createdById: userId,
        },
      });

      await tx.retailReceivable.update({
        where: { id },
        data: {
          remainingAmount: Math.max(0, newRemaining),
          status: newRemaining <= 0 ? 'PAID' : status,
        },
      });

      const snap = await this.ledger.computeSnapshot(tx, companyId, customer.id);

      if (fromPrepaid > 0) {
        const snapPre = await this.ledger.computeSnapshot(
          tx,
          companyId,
          customer.id,
          currency,
        );
        await this.ledger.appendEntry(tx, {
          companyId,
          retailCustomerId: customer.id,
          operation: LEDGER_OPERATIONS.PREPAID_USE,
          debit: fromPrepaid,
          currency,
          note: `Qarz to‘lovi — avansdan`,
          receivableId: id,
          paymentId: payment.id,
          createdById: userId,
          balanceAfter: snapPre.netBalance,
        });
      }

      const snapPay = await this.ledger.computeSnapshot(
        tx,
        companyId,
        customer.id,
        currency,
      );
      await this.ledger.appendEntry(tx, {
        companyId,
        retailCustomerId: customer.id,
        operation: LEDGER_OPERATIONS.DEBT_PAYMENT,
        credit: payAmount,
        currency,
        note: noteParts.join(' · ') || `Qarz to‘lovi${saleNumber ? ` · ${saleNumber}` : ''}`,
        receivableId: id,
        paymentId: payment.id,
        createdById: userId,
        balanceAfter: snapPay.netBalance,
      });

      return tx.retailReceivable.findFirstOrThrow({
        where: { id },
        include: {
          retailCustomer: { select: { id: true, name: true, phone: true } },
          payments: { orderBy: { createdAt: 'desc' } },
        },
      });
    }).then(async (res) => {
      await this.retailCustomers.invalidateCaches(companyId, customer.id);
      return res;
    });
  }

  /** @deprecated processCreditSale ishlating */
  async createFromPosSale(
    tx: { retailReceivable: { create: (args: unknown) => Promise<unknown> } },
    params: {
      companyId: string;
      retailCustomerId: string;
      posSaleId: string;
      amount: number;
      currency: string;
    },
  ) {
    return tx.retailReceivable.create({
      data: {
        companyId: params.companyId,
        retailCustomerId: params.retailCustomerId,
        posSaleId: params.posSaleId,
        amount: params.amount,
        remainingAmount: params.amount,
        currency: params.currency,
        status: 'OPEN',
      },
    });
  }
}
