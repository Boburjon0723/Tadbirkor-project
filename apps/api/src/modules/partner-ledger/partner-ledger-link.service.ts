import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
type StockSourceType =
  | 'STOCK_IN_MANUAL'
  | 'STOCK_IN_EXCEL'
  | 'STOCK_OUT_MANUAL'
  | 'PARTNER_SALE_ORDER';

type AmountLine = { amount: number; currency: string };

@Injectable()
export class PartnerLedgerLinkService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeCurrency(currency?: string): string {
    return String(currency || 'UZS').toUpperCase() === 'USD' ? 'USD' : 'UZS';
  }

  private async assertContact(companyId: string, contactId: string) {
    const contact = await this.prisma.partnerLedgerContact.findFirst({
      where: { id: contactId, companyId, isActive: true },
      select: { id: true, name: true },
    });
    if (!contact) throw new NotFoundException('Hamkor topilmadi');
    return contact;
  }

  private async createLinkedOperation(
    client: Prisma.TransactionClient | PrismaService,
    input: {
      companyId: string;
      userId: string;
      contactId: string;
      type: 'MATERIAL_IN' | 'SALE_OUT';
      sourceType: StockSourceType;
      sourceId: string;
      line: AmountLine;
      quantity?: number;
      productSummary?: string;
      notes?: string;
      operationDate?: Date;
    },
  ): Promise<string | null> {
    const currency = this.normalizeCurrency(input.line.currency);
    const amount = Math.abs(Number(input.line.amount) || 0);

    const existing = await client.partnerLedgerOperation.findFirst({
      where: {
        companyId: input.companyId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        currency,
        reversedById: null,
      },
      select: { id: true },
    });
    if (existing) return existing.id;

    const op = await client.partnerLedgerOperation.create({
      data: {
        companyId: input.companyId,
        contactId: input.contactId,
        type: input.type,
        amount,
        currency,
        operationDate: input.operationDate ?? new Date(),
        notes: input.notes?.trim() || null,
        createdById: input.userId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        quantity: input.quantity != null ? input.quantity : null,
        productSummary: input.productSummary?.trim() || null,
      },
    });

    await client.auditLog.create({
      data: {
        companyId: input.companyId,
        userId: input.userId,
        action: 'partner_ledger.linked_from_stock',
        entityType: 'PARTNER_LEDGER_OPERATION',
        entityId: op.id,
        newData: {
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          type: input.type,
          amount,
          currency,
        } as Prisma.InputJsonValue,
      },
    });

    return op.id;
  }

  async recordFromStockInbound(input: {
    companyId: string;
    userId: string;
    contactId: string;
    sourceType: 'STOCK_IN_MANUAL' | 'STOCK_IN_EXCEL';
    sourceId: string;
    amounts: AmountLine[];
    quantity?: number;
    productSummary?: string;
    notes?: string;
    operationDate?: Date;
  }): Promise<{ operationIds: string[] }> {
    await this.assertContact(input.companyId, input.contactId);
    const lines = input.amounts.filter((a) => Number.isFinite(a.amount) && a.amount > 0);
    if (!lines.length) {
      throw new BadRequestException('Daftar summasi hisoblanmadi');
    }

    const operationIds: string[] = [];
    for (const line of lines) {
      const id = await this.createLinkedOperation(this.prisma, {
        ...input,
        type: 'MATERIAL_IN',
        line,
      });
      if (id) operationIds.push(id);
    }
    return { operationIds };
  }

  async recordFromStockOutbound(input: {
    companyId: string;
    userId: string;
    contactId: string;
    sourceType: 'STOCK_OUT_MANUAL' | 'PARTNER_SALE_ORDER';
    sourceId: string;
    amounts: AmountLine[];
    quantity?: number;
    productSummary?: string;
    notes?: string;
    operationDate?: Date;
  }): Promise<{ operationIds: string[] }> {
    await this.assertContact(input.companyId, input.contactId);
    const lines = input.amounts.filter((a) => Number.isFinite(a.amount) && a.amount > 0);
    if (!lines.length) {
      throw new BadRequestException('Daftar summasi hisoblanmadi');
    }

    const operationIds: string[] = [];
    for (const line of lines) {
      const id = await this.createLinkedOperation(this.prisma, {
        ...input,
        type: 'SALE_OUT',
        line,
      });
      if (id) operationIds.push(id);
    }
    return { operationIds };
  }

  async recordFromStockOutboundInTx(
    tx: Prisma.TransactionClient,
    input: {
      companyId: string;
      userId: string;
      contactId: string;
      sourceType: 'STOCK_OUT_MANUAL' | 'PARTNER_SALE_ORDER';
      sourceId: string;
      amounts: AmountLine[];
      quantity?: number;
      productSummary?: string;
      notes?: string;
      operationDate?: Date;
    },
  ): Promise<{ operationIds: string[] }> {
    const lines = input.amounts.filter((a) => Number.isFinite(a.amount) && a.amount > 0);
    if (!lines.length) {
      throw new BadRequestException('Daftar summasi hisoblanmadi');
    }

    const operationIds: string[] = [];
    for (const line of lines) {
      const id = await this.createLinkedOperation(tx, {
        ...input,
        type: 'SALE_OUT',
        line,
      });
      if (id) operationIds.push(id);
    }
    return { operationIds };
  }

  async reverseBySource(input: {
    companyId: string;
    userId: string;
    sourceType: string;
    sourceId: string;
    reason?: string;
  }): Promise<{ reversedIds: string[] }> {
    const originals = await this.prisma.partnerLedgerOperation.findMany({
      where: {
        companyId: input.companyId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        reversedById: null,
      },
    });

    const reversedIds: string[] = [];
    for (const orig of originals) {
      const reverseType = orig.type === 'MATERIAL_IN' ? 'SALE_OUT' : 'MATERIAL_IN';
      const amount = Number(orig.amount);
      const reverse = await this.prisma.partnerLedgerOperation.create({
        data: {
          companyId: input.companyId,
          contactId: orig.contactId,
          type: reverseType,
          amount,
          currency: orig.currency,
          operationDate: new Date(),
          notes: input.reason?.trim() || `Ombor bekor: ${input.sourceType}`,
          createdById: input.userId,
          sourceType: 'MANUAL',
          productSummary: orig.productSummary,
        },
      });
      await this.prisma.partnerLedgerOperation.update({
        where: { id: orig.id },
        data: { reversedById: reverse.id },
      });
      reversedIds.push(reverse.id);
    }
    return { reversedIds };
  }

  /** Variant narxi va miqdoridan daftar summalarini hisoblash */
  buildAmountsFromVariant(
    variant: { purchasePrice: Prisma.Decimal | null; salePrice: Prisma.Decimal; currency: string },
    quantity: number,
    direction: 'IN' | 'OUT',
  ): AmountLine[] {
    const qty = Math.abs(quantity);
    const price =
      direction === 'IN'
        ? Number(variant.purchasePrice ?? 0)
        : Number(variant.salePrice ?? 0);
    const amount = qty * price;
    if (amount <= 0) return [{ amount: 0, currency: variant.currency || 'UZS' }];
    return [{ amount, currency: variant.currency || 'UZS' }];
  }

  assertNotStockLinked(op: { sourceType?: string | null; sourceId?: string | null }) {
    const stockLinked =
      op.sourceType &&
      op.sourceId &&
      op.sourceType !== 'MANUAL' &&
      (op.sourceType.startsWith('STOCK_') || op.sourceType === 'PARTNER_SALE_ORDER');
    if (stockLinked) {
      throw new BadRequestException(
        'Ombordan kelgan daftar yozuvi qo‘lda tahrirlanmaydi. Ombor harakatini o‘zgartiring.',
      );
    }
  }
}
