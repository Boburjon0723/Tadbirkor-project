import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeUzPhone } from '../../common/phone.util';
import {
  CreatePartnerLedgerContactDto,
  CreatePartnerLedgerOperationDto,
  UpdatePartnerLedgerContactDto,
  UpdatePartnerLedgerOperationDto,
} from './dto/partner-ledger.dto';
import {
  balanceDeltaForType,
  OPERATION_TYPE_LABELS,
  PARTNER_LEDGER_OPERATION_TYPES,
} from './partner-ledger.types';

type CurrencyTotals = Record<string, number>;

const opInclude = {
  createdBy: { select: { id: true, fullName: true, login: true } },
} as const;

function mapOperationItem(
  o: Prisma.PartnerLedgerOperationGetPayload<{ include: typeof opInclude }>,
  saleOrderStatus?: { status: string; comment: string | null } | null,
) {
  const fromStock = Boolean(
    o.sourceType?.startsWith('STOCK_') || o.sourceType === 'PARTNER_SALE_ORDER',
  );
  return {
    ...o,
    amount: Number(o.amount),
    quantity: o.quantity != null ? Number(o.quantity) : null,
    productSummary: o.productSummary,
    sourceType: o.sourceType,
    sourceId: o.sourceId,
    typeLabel: OPERATION_TYPE_LABELS[o.type as keyof typeof OPERATION_TYPE_LABELS] || o.type,
    balanceDelta: balanceDeltaForType(o.type, Number(o.amount)),
    fromStock,
    isSaleOrder: o.sourceType === 'PARTNER_SALE_ORDER',
    saleOrderStatus: saleOrderStatus?.status || null,
    saleOrderComment: saleOrderStatus?.comment || null,
    hasLineDetail:
      Boolean(o.sourceType && o.sourceId) &&
      (o.type === 'SALE_OUT' || o.type === 'MATERIAL_IN') &&
      (o.sourceType === 'PARTNER_SALE_ORDER' ||
        o.sourceType === 'STOCK_OUT_MANUAL' ||
        o.sourceType === 'STOCK_IN_MANUAL' ||
        o.sourceType === 'STOCK_IN_EXCEL'),
  };
}

@Injectable()
export class PartnerLedgerService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeCurrency(currency?: string): string {
    return String(currency || 'UZS').toUpperCase() === 'USD' ? 'USD' : 'UZS';
  }

  private assertOperationType(type: string) {
    if (!PARTNER_LEDGER_OPERATION_TYPES.includes(type as any)) {
      throw new BadRequestException('Operatsiya turi noto‘g‘ri');
    }
  }

  private computeBalances(
    operations: Array<{ type: string; amount: Prisma.Decimal; currency: string }>,
  ): CurrencyTotals {
    const totals: CurrencyTotals = {};
    for (const op of operations) {
      const cur = this.normalizeCurrency(op.currency);
      const delta = balanceDeltaForType(op.type, Number(op.amount));
      totals[cur] = (totals[cur] || 0) + delta;
    }
    return totals;
  }

  private balanceSide(totals: CurrencyTotals): 'we_owe' | 'they_owe' | 'settled' {
    const uzs = totals.UZS || 0;
    const usd = totals.USD || 0;
    if (Math.abs(uzs) < 0.01 && Math.abs(usd) < 0.01) return 'settled';
    if (uzs < 0 || usd < 0) return 'we_owe';
    if (uzs > 0 || usd > 0) return 'they_owe';
    return 'settled';
  }

  async getGlobalSummary(companyId: string) {
    const operations = await this.prisma.partnerLedgerOperation.findMany({
      where: { companyId, contact: { isActive: true } },
      select: { type: true, amount: true, currency: true },
    });

    const totals = this.computeBalances(operations);
    const weOwe: CurrencyTotals = {};
    const theyOwe: CurrencyTotals = {};

    for (const [cur, val] of Object.entries(totals)) {
      if (val < 0) weOwe[cur] = val;
      if (val > 0) theyOwe[cur] = val;
    }

    return {
      weOwe,
      theyOwe,
      totals,
      contactCount: await this.prisma.partnerLedgerContact.count({
        where: { companyId, isActive: true },
      }),
    };
  }

  async listContactsForSelect(companyId: string, search?: string) {
    const where: Prisma.PartnerLedgerContactWhereInput = {
      companyId,
      isActive: true,
    };
    if (search?.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
      ];
    }

    const contacts = await this.prisma.partnerLedgerContact.findMany({
      where,
      orderBy: { name: 'asc' },
      take: 100,
      select: { id: true, name: true, phone: true, tag: true },
    });

    const ops = await this.prisma.partnerLedgerOperation.findMany({
      where: { companyId, contactId: { in: contacts.map((c) => c.id) } },
      select: { contactId: true, type: true, amount: true, currency: true },
    });

    return contacts.map((c) => {
      const contactOps = ops.filter((o) => o.contactId === c.id);
      const totals = this.computeBalances(contactOps);
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        tag: c.tag,
        side: this.balanceSide(totals),
      };
    });
  }

  async listContacts(companyId: string, search?: string) {
    const where: Prisma.PartnerLedgerContactWhereInput = {
      companyId,
      isActive: true,
    };
    if (search?.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { tag: { contains: q, mode: 'insensitive' } },
      ];
    }

    const contacts = await this.prisma.partnerLedgerContact.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        operations: {
          select: { type: true, amount: true, currency: true, operationDate: true },
          orderBy: { operationDate: 'desc' },
          take: 1,
        },
        _count: { select: { operations: true } },
      },
    });

    const allOps = await this.prisma.partnerLedgerOperation.findMany({
      where: { companyId, contactId: { in: contacts.map((c) => c.id) } },
      select: { contactId: true, type: true, amount: true, currency: true },
    });

    const opsByContact = new Map<string, typeof allOps>();
    for (const op of allOps) {
      const list = opsByContact.get(op.contactId) || [];
      list.push(op);
      opsByContact.set(op.contactId, list);
    }

    return contacts.map((c) => {
      const balances = this.computeBalances(opsByContact.get(c.id) || []);
      const lastOp = c.operations[0];
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        tag: c.tag,
        notes: c.notes,
        telegramLinkStatus: c.telegramLinkStatus,
        telegramLinkedAt: c.telegramLinkedAt,
        balances,
        side: this.balanceSide(balances),
        operationCount: c._count.operations,
        lastOperation: lastOp
          ? {
              type: lastOp.type,
              typeLabel: OPERATION_TYPE_LABELS[lastOp.type as keyof typeof OPERATION_TYPE_LABELS] || lastOp.type,
              operationDate: lastOp.operationDate,
            }
          : null,
      };
    });
  }

  async getContact(companyId: string, contactId: string) {
    const contact = await this.prisma.partnerLedgerContact.findFirst({
      where: { id: contactId, companyId },
    });
    if (!contact) throw new NotFoundException('Hamkor topilmadi');

    const operations = await this.prisma.partnerLedgerOperation.findMany({
      where: { contactId },
      select: { type: true, amount: true, currency: true },
    });

    const balances = this.computeBalances(operations);
    return {
      ...contact,
      balances,
      side: this.balanceSide(balances),
    };
  }

  async createContact(companyId: string, dto: CreatePartnerLedgerContactDto) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Ism bo‘sh bo‘lmasligi kerak');

    return this.prisma.partnerLedgerContact.create({
      data: {
        companyId,
        name,
        phone: normalizeUzPhone(dto.phone) || null,
        tag: dto.tag?.trim() || null,
        notes: dto.notes?.trim() || null,
      },
    });
  }

  async updateContact(companyId: string, contactId: string, dto: UpdatePartnerLedgerContactDto) {
    await this.getContact(companyId, contactId);
    return this.prisma.partnerLedgerContact.update({
      where: { id: contactId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.phone !== undefined
          ? {
              phone: normalizeUzPhone(dto.phone) || null,
              telegramChatId: null,
              telegramLinkedAt: null,
              telegramLinkStatus: 'UNLINKED',
            }
          : {}),
        ...(dto.tag !== undefined ? { tag: dto.tag?.trim() || null } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async deleteContact(companyId: string, userId: string, contactId: string) {
    const contact = await this.prisma.partnerLedgerContact.findFirst({
      where: { id: contactId, companyId },
      include: { _count: { select: { operations: true } } },
    });
    if (!contact) throw new NotFoundException('Hamkor topilmadi');

    if (contact._count.operations > 0) {
      await this.prisma.partnerLedgerContact.update({
        where: { id: contactId },
        data: { isActive: false },
      });
    } else {
      await this.prisma.partnerLedgerContact.delete({ where: { id: contactId } });
    }

    await this.prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: 'partner_ledger.contact_delete',
        entityType: 'PARTNER_LEDGER_CONTACT',
        entityId: contactId,
      },
    });

    return { success: true };
  }

  async listOperations(
    companyId: string,
    contactId: string,
    params: { page?: string; limit?: string },
  ) {
    await this.getContact(companyId, contactId);
    const page = Math.max(1, parseInt(params.page || '1', 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(params.limit || '100', 10) || 100));
    const skip = (page - 1) * limit;

    const where = { companyId, contactId };
    const [items, total] = await Promise.all([
      this.prisma.partnerLedgerOperation.findMany({
        where,
        include: opInclude,
        orderBy: [{ operationDate: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.partnerLedgerOperation.count({ where }),
    ]);

    const saleOrderSourceIds = items
      .filter((o) => o.sourceType === 'PARTNER_SALE_ORDER' && o.sourceId)
      .map((o) => String(o.sourceId));
    const saleStatusRows =
      saleOrderSourceIds.length > 0
        ? ((await this.prisma.$queryRaw`
            SELECT "batchId", "status", "comment"
            FROM "PartnerLedgerSaleOrderStatus"
            WHERE "companyId" = ${companyId}
              AND "batchId" IN (${Prisma.join(saleOrderSourceIds)})
          `) as Array<{ batchId: string; status: string; comment: string | null }>)
        : [];
    const saleStatusMap = new Map(
      saleStatusRows.map((r) => [String(r.batchId), { status: r.status, comment: r.comment }]),
    );

    return {
      items: items.map((o) => mapOperationItem(o, o.sourceId ? saleStatusMap.get(String(o.sourceId)) : null)),
      total,
      page,
      limit,
    };
  }

  async getBalanceHistory(companyId: string, contactId: string, days = 7) {
    await this.getContact(companyId, contactId);
    const d = Math.min(90, Math.max(1, days));
    const from = new Date();
    from.setDate(from.getDate() - d);
    from.setHours(0, 0, 0, 0);

    const operations = await this.prisma.partnerLedgerOperation.findMany({
      where: { companyId, contactId, operationDate: { gte: from } },
      orderBy: { operationDate: 'asc' },
      select: { type: true, amount: true, currency: true, operationDate: true },
    });

    const before = await this.prisma.partnerLedgerOperation.findMany({
      where: { companyId, contactId, operationDate: { lt: from } },
      select: { type: true, amount: true, currency: true },
    });

    const running: Record<string, number> = { ...this.computeBalances(before) };
    const points: Array<{ date: string; UZS: number; USD: number }> = [];

    const byDay = new Map<string, typeof operations>();
    for (const op of operations) {
      const key = op.operationDate.toISOString().slice(0, 10);
      const list = byDay.get(key) || [];
      list.push(op);
      byDay.set(key, list);
    }

    for (let i = 0; i <= d; i++) {
      const day = new Date(from);
      day.setDate(from.getDate() + i);
      const key = day.toISOString().slice(0, 10);
      const dayOps = byDay.get(key) || [];
      for (const op of dayOps) {
        const cur = this.normalizeCurrency(op.currency);
        running[cur] = (running[cur] || 0) + balanceDeltaForType(op.type, Number(op.amount));
      }
      points.push({
        date: key,
        UZS: running.UZS || 0,
        USD: running.USD || 0,
      });
    }

    return { points, days: d };
  }

  async createOperation(
    companyId: string,
    userId: string,
    contactId: string,
    dto: CreatePartnerLedgerOperationDto,
  ) {
    await this.getContact(companyId, contactId);
    this.assertOperationType(dto.type);
    const operationDate = new Date(dto.operationDate);
    if (Number.isNaN(operationDate.getTime())) {
      throw new BadRequestException('Sana noto‘g‘ri');
    }

    const op = await this.prisma.partnerLedgerOperation.create({
      data: {
        companyId,
        contactId,
        type: dto.type,
        amount: dto.amount,
        currency: this.normalizeCurrency(dto.currency),
        operationDate,
        notes: dto.notes?.trim() || null,
        createdById: userId,
      },
      include: opInclude,
    });

    await this.prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: 'partner_ledger.operation_create',
        entityType: 'PARTNER_LEDGER_OPERATION',
        entityId: op.id,
        newData: { type: dto.type, amount: dto.amount, contactId } as Prisma.InputJsonValue,
      },
    });

    return {
      ...op,
      amount: Number(op.amount),
      typeLabel: OPERATION_TYPE_LABELS[dto.type as keyof typeof OPERATION_TYPE_LABELS],
      balanceDelta: balanceDeltaForType(dto.type, dto.amount),
    };
  }

  async updateOperation(
    companyId: string,
    userId: string,
    operationId: string,
    dto: UpdatePartnerLedgerOperationDto,
  ) {
    const op = await this.prisma.partnerLedgerOperation.findFirst({
      where: { id: operationId, companyId },
    });
    if (!op) throw new NotFoundException('Operatsiya topilmadi');
    if (
      op.sourceType &&
      op.sourceId &&
      (op.sourceType.startsWith('STOCK_') || op.sourceType === 'PARTNER_SALE_ORDER')
    ) {
      throw new BadRequestException(
        'Ombordan kelgan daftar yozuvi qo‘lda tahrirlanmaydi. Ombor harakatini o‘zgartiring.',
      );
    }
    if (dto.type) this.assertOperationType(dto.type);

    const updated = await this.prisma.partnerLedgerOperation.update({
      where: { id: operationId },
      data: {
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
        ...(dto.currency !== undefined ? { currency: this.normalizeCurrency(dto.currency) } : {}),
        ...(dto.operationDate !== undefined ? { operationDate: new Date(dto.operationDate) } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
      },
      include: opInclude,
    });

    await this.prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: 'partner_ledger.operation_update',
        entityType: 'PARTNER_LEDGER_OPERATION',
        entityId: operationId,
      },
    });

    return {
      ...updated,
      amount: Number(updated.amount),
      typeLabel:
        OPERATION_TYPE_LABELS[updated.type as keyof typeof OPERATION_TYPE_LABELS] || updated.type,
      balanceDelta: balanceDeltaForType(updated.type, Number(updated.amount)),
    };
  }

  async deleteOperation(companyId: string, userId: string, operationId: string) {
    const op = await this.prisma.partnerLedgerOperation.findFirst({
      where: { id: operationId, companyId },
    });
    if (!op) throw new NotFoundException('Operatsiya topilmadi');
    if (
      op.sourceType &&
      op.sourceId &&
      (op.sourceType.startsWith('STOCK_') || op.sourceType === 'PARTNER_SALE_ORDER')
    ) {
      throw new BadRequestException(
        'Ombordan kelgan daftar yozuvi qo‘lda o‘chirib bo‘lmaydi. Ombor harakatini bekor qiling.',
      );
    }

    await this.prisma.partnerLedgerOperation.delete({ where: { id: operationId } });
    await this.prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: 'partner_ledger.operation_delete',
        entityType: 'PARTNER_LEDGER_OPERATION',
        entityId: operationId,
      },
    });

    return { success: true };
  }
}
