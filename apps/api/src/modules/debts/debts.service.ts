import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePaymentRecordDto } from './dto/payment-record.dto';
import { ApplyPartnerBulkPaymentDto } from './dto/apply-partner-bulk-payment.dto';
import { ConfirmPartnerBulkPaymentDto } from './dto/confirm-partner-bulk-payment.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { DEFAULT_TX_OPTIONS } from '../../prisma/transaction-options';
import { InventoryGateway } from '../warehouses/inventory.gateway';
import { parseListPagination } from '../../common/list-pagination.util';

const OPEN_DEBT_STATUSES = ['OPEN', 'PARTIAL'] as const;
const MAX_PARTNER_GROUP_ENTRIES = 5000;
const DEBT_REMAINING_EPS = 0.009;
/** Akt sverka arxivi — so‘nggi necha yillik tarix */
const PARTNER_ARCHIVE_YEARS = 3;

/** Faol qarz: qoldiq bor yoki kutilayotgan to‘lov */
function activeDebtEntryWhere() {
  return {
    OR: [
      { remainingAmount: { gt: DEBT_REMAINING_EPS } },
      { payments: { some: { status: 'PENDING' } } },
    ],
  };
}

@Injectable()
export class DebtsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private inventoryGateway: InventoryGateway,
  ) {}

  /** Qarzdor va haqdor kompaniyalarga real-time yangilanish */
  notifyDebtsChanged(
    debtorId: string,
    creditorId: string,
    payload?: { partnerCompanyId?: string; debtEntryId?: string; reason?: string },
  ) {
    const meta = payload || {};
    this.inventoryGateway.emitDebtsChanged(debtorId, meta);
    this.inventoryGateway.emitDebtsChanged(creditorId, meta);
    this.inventoryGateway.emitDashboardRefresh(debtorId);
    this.inventoryGateway.emitDashboardRefresh(creditorId);
  }

  private async markPendingPaymentNotificationsResolved(companyId: string) {
    const users = await this.prisma.companyUser.findMany({
      where: { companyId },
      select: { userId: true },
    });
    const userIds = users.map((u) => u.userId);
    if (!userIds.length) return;

    await this.prisma.notification.updateMany({
      where: {
        userId: { in: userIds },
        isRead: false,
        title: "To'lov tasdig'i kutilmoqda",
      },
      data: { isRead: true },
    });
  }

  async createEntry(data: {
    debtorId: string;
    creditorId: string;
    amount: number;
    receiptId?: string;
    currency?: string;
  }, tx?: any) {
    const prisma = tx || this.prisma;
    return prisma.debtEntry.create({
      data: {
        debtorId: data.debtorId,
        creditorId: data.creditorId,
        amount: data.amount,
        remainingAmount: data.amount,
        currency: data.currency || 'UZS',
        receiptId: data.receiptId,
        status: 'OPEN'
      }
    });
  }

  private mapDebtEntry(
    companyId: string,
    entry: {
      id: string;
      amount: unknown;
      remainingAmount: unknown;
      status: string;
      currency: string | null;
      createdAt: Date;
      debtorId: string;
      creditorId: string;
      debtor: { id: string; name: string; tin: string | null } | null;
      creditor: { id: string; name: string; tin: string | null } | null;
    },
  ) {
    const isIncoming = entry.creditorId === companyId;
    const partner = isIncoming ? entry.debtor : entry.creditor;
    const partnerCompanyId = partner?.id || (isIncoming ? entry.debtorId : entry.creditorId);

    return {
      id: entry.id,
      amount: Number(entry.amount),
      remainingAmount: Number(entry.remainingAmount),
      status: entry.status,
      currency: entry.currency || 'UZS',
      createdAt: entry.createdAt,
      partnerCompanyId,
      partner: {
        id: partnerCompanyId,
        name: partner?.name || 'Unknown',
        tin: partner?.tin || '-',
      },
      isIncoming,
    };
  }

  private summaryFromMappedEntries(entries: ReturnType<DebtsService['mapDebtEntry']>[]) {
    let receivableUzs = 0;
    let receivableUsd = 0;
    let payableUzs = 0;
    let payableUsd = 0;

    for (const d of entries) {
      const cur = String(d.currency || 'UZS').toUpperCase() === 'USD' ? 'usd' : 'uzs';
      const rem = Number(d.remainingAmount || 0);
      if (d.isIncoming) {
        if (cur === 'usd') receivableUsd += rem;
        else receivableUzs += rem;
      } else {
        if (cur === 'usd') payableUsd += rem;
        else payableUzs += rem;
      }
    }

    return {
      receivable: { uzs: receivableUzs, usd: receivableUsd },
      payable: { uzs: payableUzs, usd: payableUsd },
      net: {
        uzs: receivableUzs - payableUzs,
        usd: receivableUsd - payableUsd,
      },
    };
  }

  private groupEntriesByPartner(
    entries: ReturnType<DebtsService['mapDebtEntry']>[],
    tab: 'receivable' | 'payable',
    search: string,
  ) {
    const map = new Map<
      string,
      {
        partnerCompanyId: string;
        partner: { id: string; name: string; tin: string };
        isIncoming: boolean;
        entries: ReturnType<DebtsService['mapDebtEntry']>[];
        totalAmount: { uzs: number; usd: number };
        totalRemaining: { uzs: number; usd: number };
        aggregateStatus: 'OPEN' | 'PARTIAL' | 'PAID';
        entryCount: number;
      }
    >();

    const q = search.trim().toLowerCase();

    for (const d of entries) {
      const tabMatch = tab === 'receivable' ? d.isIncoming : !d.isIncoming;
      if (!tabMatch) continue;
      if (q && !String(d.partner?.name || '').toLowerCase().includes(q)) continue;

      const key = d.partnerCompanyId;
      if (!map.has(key)) {
        map.set(key, {
          partnerCompanyId: key,
          partner: d.partner,
          isIncoming: d.isIncoming,
          entries: [],
          totalAmount: { uzs: 0, usd: 0 },
          totalRemaining: { uzs: 0, usd: 0 },
          aggregateStatus: 'PAID',
          entryCount: 0,
        });
      }

      const g = map.get(key)!;
      g.entries.push(d);
      g.entryCount += 1;
      const cur = String(d.currency || 'UZS').toUpperCase() === 'USD' ? 'usd' : 'uzs';
      g.totalAmount[cur] += Number(d.amount || 0);
      g.totalRemaining[cur] += Number(d.remainingAmount || 0);
      if (d.status === 'OPEN') g.aggregateStatus = 'OPEN';
      else if (d.status === 'PARTIAL' && g.aggregateStatus !== 'OPEN') {
        g.aggregateStatus = 'PARTIAL';
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      a.partner.name.localeCompare(b.partner.name, 'uz'),
    );
  }

  /** KPI kartochkalar — faqat ochiq/qisman ochiq qarzlar. */
  async getEntriesSummary(companyId: string) {
    const rows = await this.prisma.debtEntry.findMany({
      where: {
        AND: [
          { OR: [{ debtorId: companyId }, { creditorId: companyId }] },
          { status: { in: [...OPEN_DEBT_STATUSES] } },
          activeDebtEntryWhere(),
        ],
      },
      select: {
        creditorId: true,
        debtorId: true,
        remainingAmount: true,
        currency: true,
      },
    });

    let receivableUzs = 0;
    let receivableUsd = 0;
    let payableUzs = 0;
    let payableUsd = 0;

    for (const r of rows) {
      const isIncoming = r.creditorId === companyId;
      const cur = String(r.currency || 'UZS').toUpperCase() === 'USD' ? 'usd' : 'uzs';
      const rem = Number(r.remainingAmount || 0);
      if (isIncoming) {
        if (cur === 'usd') receivableUsd += rem;
        else receivableUzs += rem;
      } else {
        if (cur === 'usd') payableUsd += rem;
        else payableUzs += rem;
      }
    }

    return {
      receivable: { uzs: receivableUzs, usd: receivableUsd },
      payable: { uzs: payableUzs, usd: payableUsd },
      net: {
        uzs: receivableUzs - payableUzs,
        usd: receivableUsd - payableUsd,
      },
    };
  }

  /**
   * Qarzlar sahifasi — hamkorlar guruhi (ochiq yozuvlar, xotira cheklovi bilan).
   */
  async findPartnerGroups(
    companyId: string,
    query?: {
      tab?: 'receivable' | 'payable';
      search?: string;
      page?: string | number;
      limit?: string | number;
    },
  ) {
    const tab = query?.tab === 'payable' ? 'payable' : 'receivable';
    const search = String(query?.search || '');
    const { page, limit, skip } = parseListPagination(query, { limit: 40, maxLimit: 80 });

    const raw = await this.prisma.debtEntry.findMany({
      where: {
        AND: [
          { OR: [{ debtorId: companyId }, { creditorId: companyId }] },
          { status: { in: [...OPEN_DEBT_STATUSES] } },
          activeDebtEntryWhere(),
        ],
      },
      include: {
        debtor: { select: { id: true, name: true, tin: true } },
        creditor: { select: { id: true, name: true, tin: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_PARTNER_GROUP_ENTRIES,
    });

    const mapped = raw.map((e) => this.mapDebtEntry(companyId, e));
    const summary = this.summaryFromMappedEntries(mapped);
    const allGroups = this.groupEntriesByPartner(mapped, tab, search);
    const total = allGroups.length;
    const items = allGroups.slice(skip, skip + limit);

    return {
      items,
      page,
      limit,
      total,
      hasMore: skip + items.length < total,
      summary,
      capped: raw.length >= MAX_PARTNER_GROUP_ENTRIES,
    };
  }

  /**
   * Yopilgan hamkorlar — akt sverka arxivi (barcha yozuvlar DB da saqlanadi).
   * Asosiy ro‘yxatda ko‘rinmasa ham, hisobot shu yerda yuklanadi.
   */
  async findPartnerReportArchive(
    companyId: string,
    query?: {
      tab?: 'receivable' | 'payable';
      search?: string;
      page?: string | number;
      limit?: string | number;
      /** default true — faqat ochiq qarzi yo‘q hamkorlar */
      settledOnly?: string | boolean;
    },
  ) {
    const tab = query?.tab === 'payable' ? 'payable' : 'receivable';
    const search = String(query?.search || '').trim().toLowerCase();
    const settledOnly = query?.settledOnly !== false && query?.settledOnly !== 'false';
    const { page, limit, skip } = parseListPagination(query, { limit: 30, maxLimit: 100 });

    const since = new Date();
    since.setFullYear(since.getFullYear() - PARTNER_ARCHIVE_YEARS);

    const raw = await this.prisma.debtEntry.findMany({
      where: {
        AND: [
          { OR: [{ debtorId: companyId }, { creditorId: companyId }] },
          { updatedAt: { gte: since } },
        ],
      },
      include: {
        debtor: { select: { id: true, name: true, tin: true } },
        creditor: { select: { id: true, name: true, tin: true } },
        payments: { where: { status: 'PENDING' }, select: { id: true }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
      take: MAX_PARTNER_GROUP_ENTRIES,
    });

    type ArchiveRow = {
      partnerCompanyId: string;
      partner: { name: string; tin: string };
      hasActiveDebt: boolean;
      lastActivityAt: Date;
      entryCount: number;
      lastStatus: 'OPEN' | 'PARTIAL' | 'PAID';
    };

    const map = new Map<string, ArchiveRow>();

    for (const e of raw) {
      const mapped = this.mapDebtEntry(companyId, e);
      const tabMatch = tab === 'receivable' ? mapped.isIncoming : !mapped.isIncoming;
      if (!tabMatch) continue;

      const key = mapped.partnerCompanyId;
      const rem = Number(mapped.remainingAmount || 0);
      const isActive =
        (['OPEN', 'PARTIAL'].includes(mapped.status) && rem > DEBT_REMAINING_EPS) ||
        (e.payments?.length ?? 0) > 0;

      const activityAt = e.updatedAt || e.createdAt;
      const status = mapped.status as 'OPEN' | 'PARTIAL' | 'PAID';

      if (!map.has(key)) {
        map.set(key, {
          partnerCompanyId: key,
          partner: { name: mapped.partner.name, tin: mapped.partner.tin },
          hasActiveDebt: isActive,
          lastActivityAt: activityAt,
          entryCount: 1,
          lastStatus: status,
        });
        continue;
      }

      const row = map.get(key)!;
      row.entryCount += 1;
      if (isActive) row.hasActiveDebt = true;
      if (activityAt > row.lastActivityAt) {
        row.lastActivityAt = activityAt;
        row.lastStatus = status;
      }
    }

    let items = Array.from(map.values());
    if (settledOnly) {
      items = items.filter((i) => !i.hasActiveDebt);
    }
    if (search) {
      items = items.filter(
        (i) =>
          i.partner.name.toLowerCase().includes(search) ||
          String(i.partner.tin || '').toLowerCase().includes(search),
      );
    }

    items.sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime());

    const total = items.length;
    const pageItems = items.slice(skip, skip + limit).map((i) => ({
      ...i,
      lastActivityAt: i.lastActivityAt.toISOString(),
    }));

    return {
      items: pageItems,
      page,
      limit,
      total,
      hasMore: skip + pageItems.length < total,
      archiveYears: PARTNER_ARCHIVE_YEARS,
      capped: raw.length >= MAX_PARTNER_GROUP_ENTRIES,
    };
  }

  /** Bitta hamkor uchun yengil snapshot (drawer yangilash — 80 ta guruh o‘rniga). */
  async findPartnerGroupOne(
    companyId: string,
    partnerCompanyId: string,
    tab: 'receivable' | 'payable' = 'receivable',
  ) {
    const side = tab === 'payable' ? 'payable' : 'receivable';
    const entries = await this.prisma.debtEntry.findMany({
      where: {
        AND: [
          { status: { in: [...OPEN_DEBT_STATUSES] } },
          activeDebtEntryWhere(),
          side === 'receivable'
            ? { creditorId: companyId, debtorId: partnerCompanyId }
            : { debtorId: companyId, creditorId: partnerCompanyId },
        ],
      },
      include: {
        debtor: { select: { id: true, name: true, tin: true } },
        creditor: { select: { id: true, name: true, tin: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!entries.length) {
      const partner = await this.prisma.company.findUnique({
        where: { id: partnerCompanyId },
        select: { id: true, name: true, tin: true },
      });
      if (!partner) throw new NotFoundException('Hamkor topilmadi');
      return {
        partnerCompanyId,
        partner: { name: partner.name, tin: partner.tin || '-' },
        isIncoming: side === 'receivable',
        entries: [],
        totalAmount: { uzs: 0, usd: 0 },
        totalRemaining: { uzs: 0, usd: 0 },
        aggregateStatus: 'PAID' as const,
        entryCount: 0,
        hasPendingPayment: false,
      };
    }

    const mapped = entries.map((e) => this.mapDebtEntry(companyId, e));
    const groups = this.groupEntriesByPartner(mapped, side, '');
    const group = groups.find((g) => g.partnerCompanyId === partnerCompanyId);
    if (!group) {
      throw new NotFoundException('Hamkor qarz guruhi topilmadi');
    }

    const pending = await this.prisma.debtPaymentRecord.findMany({
      where: {
        status: 'PENDING',
        debtEntryId: { in: entries.map((e) => e.id) },
      },
      select: { debtEntryId: true },
    });
    return {
      ...group,
      hasPendingPayment: pending.length > 0,
    };
  }

  async findAllEntries(
    companyId: string,
    query?: { page?: string | number; limit?: string | number; status?: string },
  ) {
    const { page, limit, skip } = parseListPagination(query, { limit: 50, maxLimit: 100 });
    const where: any = {
      OR: [{ debtorId: companyId }, { creditorId: companyId }],
    };
    const status = String(query?.status || '').trim().toUpperCase();
    if (status) where.status = status;

    const [total, entries] = await Promise.all([
      this.prisma.debtEntry.count({ where }),
      this.prisma.debtEntry.findMany({
        where,
        include: {
          debtor: { select: { id: true, name: true, tin: true } },
          creditor: { select: { id: true, name: true, tin: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const items = entries.map((e) => this.mapDebtEntry(companyId, e));

    return {
      items,
      page,
      limit,
      total,
      hasMore: skip + items.length < total,
    };
  }

  /** Hamkor bo‘yicha barcha qarz yozuvlari (daftar — bitta qator + batafsil panel). */
  async findPartnerLedger(companyId: string, partnerCompanyId: string) {
    const entries = await this.prisma.debtEntry.findMany({
      where: {
        OR: [
          { debtorId: companyId, creditorId: partnerCompanyId },
          { debtorId: partnerCompanyId, creditorId: companyId },
        ],
      },
      include: {
        payments: { orderBy: { createdAt: 'desc' } },
        debtor: { select: { id: true, name: true, tin: true } },
        creditor: { select: { id: true, name: true, tin: true } },
        receipt: { select: { id: true, orderId: true, createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!entries.length) {
      const partner = await this.prisma.company.findFirst({
        where: { id: partnerCompanyId },
        select: { id: true, name: true, tin: true },
      });
      if (!partner) throw new NotFoundException('Hamkor topilmadi');
      return {
        partnerCompanyId,
        partner: { name: partner.name, tin: partner.tin || '-' },
        isIncoming: null,
        entries: [],
        totals: { amount: { uzs: 0, usd: 0 }, remaining: { uzs: 0, usd: 0 } },
      };
    }

    const first = entries[0];
    const isIncoming = first.creditorId === companyId;
    const partner = isIncoming ? first.debtor : first.creditor;

    const totals = { amount: { uzs: 0, usd: 0 }, remaining: { uzs: 0, usd: 0 } };
    const mappedEntries = entries.map((entry) => {
      const incoming = entry.creditorId === companyId;
      const cur =
        String(entry.currency || 'UZS').toUpperCase() === 'USD' ? 'usd' : 'uzs';
      const amount = Number(entry.amount);
      const remaining = Number(entry.remainingAmount);
      if (incoming) {
        totals.amount[cur] += amount;
        totals.remaining[cur] += remaining;
      } else {
        totals.amount[cur] -= amount;
        totals.remaining[cur] -= remaining;
      }
      return {
        id: entry.id,
        amount,
        remainingAmount: remaining,
        status: entry.status,
        currency: entry.currency || 'UZS',
        createdAt: entry.createdAt,
        isIncoming: incoming,
        receiptId: entry.receiptId,
        receipt: entry.receipt,
        payments: entry.payments.map((p) => ({
          id: p.id,
          amount: Number(p.amount),
          status: p.status,
          notes: p.notes,
          createdAt: p.createdAt,
        })),
      };
    });

    return {
      partnerCompanyId,
      partner: { name: partner?.name || 'Unknown', tin: partner?.tin || '-' },
      isIncoming,
      entries: mappedEntries,
      totals,
    };
  }

  async findPartnerBalance(companyId: string, partnerCompanyId: string) {
    const entries = await this.prisma.debtEntry.findMany({
      where: {
        OR: [
          { debtorId: companyId, creditorId: partnerCompanyId },
          { debtorId: partnerCompanyId, creditorId: companyId }
        ]
      }
    });

    let balance = 0; // Positive means partner owes me, negative means I owe partner
    for (const entry of entries) {
      if (entry.creditorId === companyId) {
        balance += Number(entry.remainingAmount);
      } else {
        balance -= Number(entry.remainingAmount);
      }
    }

    return { balance, partnerCompanyId };
  }

  async findEntry(id: string, companyId: string) {
    const entry = await this.prisma.debtEntry.findFirst({
      where: {
        id,
        OR: [{ debtorId: companyId }, { creditorId: companyId }],
      },
      include: {
        payments: { orderBy: { createdAt: 'desc' } },
        debtor: { select: { id: true, name: true, tin: true } },
        creditor: { select: { id: true, name: true, tin: true } },
      },
    });
    if (!entry) throw new NotFoundException('Qarz yozuvi topilmadi');

    const isIncoming = entry.creditorId === companyId;
    const partner = isIncoming ? entry.debtor : entry.creditor;

    return {
      ...entry,
      partnerCompanyId: partner?.id,
      partner: { name: partner?.name || '—', tin: partner?.tin || '—' },
      isIncoming,
    };
  }

  async findPendingPaymentRecords(companyId: string) {
    const records = await this.prisma.debtPaymentRecord.findMany({
      where: {
        status: 'PENDING',
        debtEntry: {
          creditorId: companyId,
        },
      },
      include: {
        debtEntry: {
          include: {
            debtor: { select: { id: true, name: true, tin: true } },
            creditor: { select: { id: true, name: true, tin: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((record) => ({
      id: record.id,
      amount: Number(record.amount),
      currency: record.debtEntry.currency || 'UZS',
      notes: record.notes,
      status: record.status,
      createdAt: record.createdAt,
      debtEntryId: record.debtEntryId,
      debtor: record.debtEntry.debtor,
      creditor: record.debtEntry.creditor,
      remainingAmount: Number(record.debtEntry.remainingAmount),
    }));
  }

  /** Haqdor (kreditor) to‘lovni bevosita qabul qiladi — qarzdor tasdig‘isiz. */
  async applyPaymentByCreditor(
    debtEntryId: string,
    companyId: string,
    userId: string,
    dto: CreatePaymentRecordDto,
  ) {
    const entry = await this.findEntry(debtEntryId, companyId);
    if (entry.creditorId !== companyId) {
      throw new ForbiddenException('Faqat haqdor to‘lovni qabul qilishi mumkin');
    }
    if (Number(dto.amount) > Number(entry.remainingAmount)) {
      throw new BadRequestException('To‘lov summasi qolgan qarz miqdoridan oshib ketdi');
    }
    if (Number(dto.amount) <= 0) {
      throw new BadRequestException('To‘lov summasi 0 dan katta bo‘lishi kerak');
    }

    const noteParts = [
      dto.paymentMethod ? `Usul: ${dto.paymentMethod}` : null,
      dto.notes?.trim() || null,
    ].filter(Boolean);

    const txResult = await this.prisma.$transaction(async (tx) => {
      const fresh = await tx.debtEntry.findFirst({ where: { id: debtEntryId } });
      if (!fresh) throw new NotFoundException('Qarz yozuvi topilmadi');

      const created = await tx.debtPaymentRecord.create({
        data: {
          debtEntryId,
          amount: dto.amount,
          status: 'CONFIRMED',
          notes: noteParts.length ? noteParts.join(' · ') : null,
          createdBy: userId,
          confirmedBy: userId,
        },
      });

      const newRemaining = Number(fresh.remainingAmount) - Number(dto.amount);
      const newStatus = newRemaining <= 0 ? 'PAID' : 'PARTIAL';

      await tx.debtEntry.update({
        where: { id: debtEntryId },
        data: {
          remainingAmount: Math.max(0, newRemaining),
          status: newStatus,
        },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: 'debt.payment_applied_by_creditor',
          entityType: 'DEBT_PAYMENT',
          entityId: created.id,
          newData: { debtEntryId, amount: dto.amount, status: 'CONFIRMED' } as any,
        },
      });

      return { newRemaining, newStatus, paymentId: created.id };
    });

    const debtor = await this.prisma.company.findUnique({ where: { id: entry.debtorId } });
    await this.notificationsService.notifyCompany(
      entry.debtorId,
      txResult.newRemaining > 0 ? 'Qisman to‘lov qabul qilindi' : 'To‘lov qabul qilindi',
      `${(await this.prisma.company.findUnique({ where: { id: companyId } }))?.name || 'Hamkor'} ${Number(dto.amount).toLocaleString('uz-UZ')} ${entry.currency || 'UZS'} to‘lovni qabul qildi.`,
      txResult.newRemaining > 0 ? 'WARNING' : 'SUCCESS',
      {
        moduleKey: 'DEBT',
        eventKey: 'debt.payment_applied_by_creditor',
        details: {
          paymentRecordId: txResult.paymentId,
          amount: dto.amount,
          remainingAmount: txResult.newRemaining,
        },
        targetRoles: ['OWNER', 'MANAGER', 'ACCOUNTANT'],
      },
    );

    this.notifyDebtsChanged(entry.debtorId, entry.creditorId, {
      debtEntryId,
      partnerCompanyId: entry.debtorId,
      reason: 'payment.applied_by_creditor',
    });

    return { success: true, ...txResult };
  }

  /**
   * Qarzdor umumiy to‘lov qayd etadi — eng eski yozuvlardan FIFO, PENDING holatda.
   */
  async recordPartnerBulkPaymentByDebtor(
    companyId: string,
    partnerCompanyId: string,
    userId: string,
    dto: ApplyPartnerBulkPaymentDto,
  ) {
    const currency =
      String(dto.currency || 'UZS').toUpperCase() === 'USD' ? 'USD' : 'UZS';
    const payTotal = Number(dto.amount);
    if (!Number.isFinite(payTotal) || payTotal <= 0) {
      throw new BadRequestException('To‘lov summasi 0 dan katta bo‘lishi kerak');
    }

    const entries = await this.prisma.debtEntry.findMany({
      where: {
        debtorId: companyId,
        creditorId: partnerCompanyId,
        currency,
        status: { in: ['OPEN', 'PARTIAL'] },
        remainingAmount: { gt: 0 },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: {
        payments: { where: { status: 'PENDING' }, select: { id: true } },
      },
    });

    const eligible = entries.filter((e) => e.payments.length === 0);
    if (!eligible.length) {
      throw new BadRequestException(
        'Ushbu hamkor va valyutada ochiq (kutilayotgan to‘lovsiz) qarz yozuvi yo‘q',
      );
    }

    const totalRemaining = eligible.reduce(
      (sum, e) => sum + Number(e.remainingAmount),
      0,
    );
    if (payTotal > totalRemaining + 0.009) {
      throw new BadRequestException(
        `To‘lov ${payTotal} ${currency} — qolgan qarz ${Math.round(totalRemaining * 100) / 100} ${currency} dan oshmasligi kerak`,
      );
    }

    const allocations: Array<{ debtEntryId: string; amount: number; fullyPaid: boolean }> =
      [];
    let left = payTotal;
    for (const entry of eligible) {
      if (left <= 0.0001) break;
      const rem = Number(entry.remainingAmount);
      const applied = Math.min(left, rem);
      if (applied <= 0) continue;
      allocations.push({
        debtEntryId: entry.id,
        amount: applied,
        fullyPaid: applied >= rem - 0.009,
      });
      left -= applied;
    }

    if (!allocations.length) {
      throw new BadRequestException('To‘lov taqsimlanmadi');
    }

    const noteParts = [
      dto.paymentMethod ? `Usul: ${dto.paymentMethod}` : null,
      dto.notes?.trim() || null,
      'Umumiy to‘lov (qarzdor qayd etdi · FIFO)',
    ].filter(Boolean);
    const baseNote = noteParts.join(' · ');
    const appliedTotal = allocations.reduce((s, a) => s + a.amount, 0);

    const paymentIds = await this.prisma.$transaction(async (tx) => {
      const ids: string[] = [];
      for (const alloc of allocations) {
        const created = await tx.debtPaymentRecord.create({
          data: {
            debtEntryId: alloc.debtEntryId,
            amount: alloc.amount,
            status: 'PENDING',
            notes: baseNote,
            createdBy: userId,
          },
        });
        ids.push(created.id);
      }

      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: 'debt.partner_bulk_payment_recorded',
          entityType: 'DEBT_PARTNER',
          entityId: partnerCompanyId,
          newData: {
            partnerCompanyId,
            currency,
            requestedAmount: payTotal,
            appliedTotal,
            allocations,
            paymentIds: ids,
          } as any,
        },
      });
      return ids;
    }, DEFAULT_TX_OPTIONS);

    const debtor = await this.prisma.company.findUnique({ where: { id: companyId } });
    await this.notificationsService.notifyCompany(
      partnerCompanyId,
      'Umumiy to‘lov tasdiqlanishi kutilmoqda',
      `${debtor?.name || 'Hamkor'} ${appliedTotal.toLocaleString('uz-UZ')} ${currency} umumiy to‘lov qayd etdi (${allocations.length} ta yozuv).\n\nMoliya markazida «Umumiy to‘lovni tasdiqlash» ni bosing.`,
      'WARNING',
      {
        moduleKey: 'DEBT',
        eventKey: 'debt.partner_bulk_payment_recorded',
        details: {
          hamkor: debtor?.name || 'Hamkor',
          appliedTotal,
          currency,
          entriesCount: allocations.length,
        },
        targetRoles: ['OWNER', 'MANAGER', 'ACCOUNTANT'],
      },
    );

    this.notifyDebtsChanged(companyId, partnerCompanyId, {
      partnerCompanyId,
      reason: 'bulk_payment.recorded',
    });

    return {
      success: true,
      status: 'PENDING' as const,
      currency,
      requestedAmount: payTotal,
      appliedTotal,
      entriesTouched: allocations.length,
      paymentIds,
      allocations: allocations.map(({ debtEntryId, amount, fullyPaid }) => ({
        debtEntryId,
        amount,
        fullyPaid,
      })),
    };
  }

  /** Haqdor — hamkordan kelgan kutilayotgan umumiy to‘lovlarni tasdiqlaydi. */
  async confirmPartnerBulkPaymentsByCreditor(
    companyId: string,
    partnerCompanyId: string,
    userId: string,
    dto?: ConfirmPartnerBulkPaymentDto,
  ) {
    const currency = dto?.currency
      ? String(dto.currency).toUpperCase() === 'USD'
        ? 'USD'
        : 'UZS'
      : undefined;

    const pending = await this.prisma.debtPaymentRecord.findMany({
      where: {
        status: 'PENDING',
        debtEntry: {
          creditorId: companyId,
          debtorId: partnerCompanyId,
          ...(currency ? { currency } : {}),
        },
      },
      orderBy: [{ createdAt: 'asc' }],
      include: { debtEntry: true },
    });

    if (!pending.length) {
      throw new BadRequestException('Tasdiqlash uchun kutilayotgan to‘lov yo‘q');
    }

    let confirmedTotal = 0;
    const confirmedIds: string[] = [];
    const entryRemainingById = new Map<string, number>();

    for (const record of pending) {
      const entry = record.debtEntry;
      if (!entry) continue;

      const payAmount = Number(record.amount);
      const entryRemaining =
        entryRemainingById.get(record.debtEntryId) ?? Number(entry.remainingAmount);
      if (payAmount > entryRemaining + 0.009) {
        throw new BadRequestException(
          `To‘lov ${payAmount} ${entry.currency || ''} qolgan qarz ${entryRemaining} dan oshib ketdi`,
        );
      }

      const newRemaining = Math.max(0, entryRemaining - payAmount);
      entryRemainingById.set(record.debtEntryId, newRemaining);
      confirmedTotal += payAmount;
      confirmedIds.push(record.id);
    }

    if (!confirmedIds.length) {
      throw new BadRequestException('Tasdiqlash uchun yaroqli to‘lov topilmadi');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.debtPaymentRecord.updateMany({
        where: { id: { in: confirmedIds } },
        data: { status: 'CONFIRMED', confirmedBy: userId },
      });

      for (const [entryId, remaining] of entryRemainingById) {
        await tx.debtEntry.update({
          where: { id: entryId },
          data: {
            remainingAmount: remaining,
            status: remaining <= 0.009 ? 'PAID' : 'PARTIAL',
          },
        });
      }

      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: 'debt.partner_bulk_payment_confirmed',
          entityType: 'DEBT_PARTNER',
          entityId: partnerCompanyId,
          newData: {
            partnerCompanyId,
            currency: currency || null,
            confirmedCount: confirmedIds.length,
            confirmedTotal,
            paymentIds: confirmedIds,
          } as any,
        },
      });
    }, DEFAULT_TX_OPTIONS);

    const creditor = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true },
    });

    void this.notificationsService
      .notifyCompany(
        partnerCompanyId,
        'Umumiy to‘lov tasdiqlandi',
        `${creditor?.name || 'Hamkor'} ${confirmedTotal.toLocaleString('uz-UZ')} ${currency || ''} to‘lovingizni tasdiqladi (${confirmedIds.length} ta yozuv).`,
        'SUCCESS',
        {
          moduleKey: 'DEBT',
          eventKey: 'debt.partner_bulk_payment_confirmed',
          details: {
            haqdor: creditor?.name || 'Hamkor',
            confirmedTotal,
            currency: currency || 'UZS',
            confirmedCount: confirmedIds.length,
          },
          targetRoles: ['OWNER', 'MANAGER', 'ACCOUNTANT'],
        },
      )
      .catch((err) => console.error('bulk confirm notify failed', err));

    void this.markPendingPaymentNotificationsResolved(companyId).catch((err) =>
      console.error('mark notifications resolved failed', err),
    );

    this.notifyDebtsChanged(partnerCompanyId, companyId, {
      partnerCompanyId,
      reason: 'bulk_payment.confirmed',
    });

    return {
      success: true,
      confirmedCount: confirmedIds.length,
      confirmedTotal,
      currency: currency || null,
      paymentIds: confirmedIds,
    };
  }

  async createPaymentRecord(debtEntryId: string, companyId: string, userId: string, dto: CreatePaymentRecordDto) {
    const entry = await this.findEntry(debtEntryId, companyId);
    if (entry.debtorId !== companyId) throw new ForbiddenException('Faqat qarzdor to‘lov haqida xabar bera oladi');
    if (Number(dto.amount) > Number(entry.remainingAmount)) {
      throw new BadRequestException('To‘lov summasi qolgan qarz miqdoridan oshib ketdi');
    }

    const noteParts = [
      dto.paymentMethod ? `Usul: ${dto.paymentMethod}` : null,
      dto.notes?.trim() || null,
    ].filter(Boolean);

    const payment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.debtPaymentRecord.create({
        data: {
          debtEntryId,
          amount: dto.amount,
          status: 'PENDING',
          notes: noteParts.length ? noteParts.join(' · ') : null,
          createdBy: userId
        }
      });

      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: 'debt.payment_created',
          entityType: 'DEBT_PAYMENT',
          entityId: created.id,
          newData: {
            debtEntryId,
            amount: dto.amount,
            status: 'PENDING',
          } as any,
        }
      });

      return created;
    });

    // Notify Creditor
    const debtor = await this.prisma.company.findUnique({ where: { id: entry.debtorId } });
    await this.notificationsService.notifyCompany(
      entry.creditorId,
      'To\'lov tasdig\'i kutilmoqda',
      `${debtor?.name} ${Number(dto.amount).toLocaleString('uz-UZ')} ${entry.currency || 'UZS'} to‘lov qayd etdi. Tasdiqlang yoki rad eting.`,
      'WARNING',
      {
        moduleKey: 'DEBT',
        eventKey: 'debt.payment_created',
        details: {
          hamkor: debtor?.name || 'Hamkor',
          amount: dto.amount,
          currency: entry.currency || 'UZS',
          status: 'PENDING',
        },
        targetRoles: ['OWNER', 'MANAGER', 'ACCOUNTANT'],
        actions: [
          { key: 'DEBT_CONFIRM', label: 'Qabul qilish', targetType: 'DEBT_PAYMENT', targetId: payment.id },
          { key: 'DEBT_REJECT', label: 'Bekor qilish', targetType: 'DEBT_PAYMENT', targetId: payment.id },
        ],
      },
    );

    this.notifyDebtsChanged(entry.debtorId, entry.creditorId, {
      debtEntryId,
      partnerCompanyId: entry.creditorId,
      reason: 'payment.created',
    });

    return payment;
  }

  async confirmPayment(recordId: string, companyId: string, userId: string) {
    const record = await this.prisma.debtPaymentRecord.findUnique({
      where: { id: recordId },
      include: { debtEntry: true }
    });

    if (!record) throw new NotFoundException('To‘lov yozuvi topilmadi');
    if (record.debtEntry.creditorId !== companyId) throw new ForbiddenException('Faqat haqdor to‘lovni tasdiqlashi mumkin');
    if (record.status !== 'PENDING') throw new BadRequestException('Ushbu to‘lov allaqachon ko‘rib chiqilgan');

    const txResult = await this.prisma.$transaction(async (tx) => {
      // 1. Confirm record
      const previousStatus = record.status;
      await tx.debtPaymentRecord.update({
        where: { id: recordId },
        data: { 
          status: 'CONFIRMED',
          confirmedBy: userId
        }
      });

      // 2. Update Debt Entry
      const newRemaining = Number(record.debtEntry.remainingAmount) - Number(record.amount);
      const newStatus = newRemaining <= 0 ? 'PAID' : 'PARTIAL';

      await tx.debtEntry.update({
        where: { id: record.debtEntryId },
        data: {
          remainingAmount: Math.max(0, newRemaining),
          status: newStatus
        }
      });

      // 3. Audit Log
      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: 'debt.payment_confirmed',
          entityType: 'DEBT_PAYMENT',
          entityId: recordId,
          oldData: { status: previousStatus } as any,
          newData: { status: 'CONFIRMED', amount: record.amount } as any,
        }
      });

      return { newRemaining, newStatus };
    }, { timeout: 20000, maxWait: 10000 });

    // Notification transactiondan tashqarida ishlaydi.
    const creditor = await this.prisma.company.findUnique({ where: { id: record.debtEntry.creditorId } });
    const remainingText = txResult.newRemaining > 0
      ? ` Qolgan qarz: ${txResult.newRemaining.toLocaleString('uz-UZ')} ${record.debtEntry.currency || 'UZS'}.`
      : " Qarz to'liq yopildi.";

    await this.notificationsService.notifyCompany(
      record.debtEntry.debtorId,
      txResult.newRemaining > 0 ? 'Qisman to\'lov tasdiqlandi' : 'To\'lov to\'liq tasdiqlandi',
      `${creditor?.name} sizning ${Number(record.amount || 0).toLocaleString('uz-UZ')} ${record.debtEntry.currency || 'UZS'}lik to'lovingizni tasdiqladi.${remainingText}`,
      txResult.newRemaining > 0 ? 'WARNING' : 'SUCCESS',
      {
        moduleKey: 'DEBT',
        eventKey: 'debt.payment_confirmed',
        details: {
          haqdor: creditor?.name || 'Hamkor',
          amount: record.amount,
          currency: record.debtEntry.currency || 'UZS',
          remainingAmount: txResult.newRemaining,
          status: txResult.newStatus,
        },
        targetRoles: ['OWNER', 'MANAGER', 'ACCOUNTANT'],
      },
    );

    // Kreditor tasdiqlagandan so'ng "kutilmoqda" bildirgilarini yopamiz.
    await this.markPendingPaymentNotificationsResolved(companyId);

    this.notifyDebtsChanged(record.debtEntry.debtorId, record.debtEntry.creditorId, {
      debtEntryId: record.debtEntryId,
      partnerCompanyId: record.debtEntry.debtorId,
      reason: 'payment.confirmed',
    });

    return { success: true };
  }

  async rejectPayment(recordId: string, companyId: string, userId: string) {
    const record = await this.prisma.debtPaymentRecord.findUnique({
      where: { id: recordId },
      include: { debtEntry: true }
    });

    if (!record) throw new NotFoundException('To‘lov yozuvi topilmadi');
    if (record.debtEntry.creditorId !== companyId) throw new ForbiddenException('Faqat haqdor to‘lovni rad etishi mumkin');
    if (record.status !== 'PENDING') throw new BadRequestException('Ushbu to‘lov allaqachon ko‘rib chiqilgan');

    const updated = await this.prisma.$transaction(async (tx) => {
      const rejected = await tx.debtPaymentRecord.update({
        where: { id: recordId },
        data: { status: 'REJECTED' }
      });

      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: 'debt.payment_rejected',
          entityType: 'DEBT_PAYMENT',
          entityId: recordId,
          oldData: { status: record.status } as any,
          newData: { status: 'REJECTED', amount: record.amount } as any,
        }
      });

      return rejected;
    });

    // Notify Debtor
    const creditor = await this.prisma.company.findUnique({ where: { id: record.debtEntry.creditorId } });
    await this.notificationsService.notifyCompany(
      record.debtEntry.debtorId,
      'To\'lov rad etildi',
      `${creditor?.name} sizning ${Number(record.amount).toLocaleString('uz-UZ')} ${record.debtEntry.currency || 'UZS'} to‘lovingizni rad etdi.`,
      'ERROR',
      {
        moduleKey: 'DEBT',
        eventKey: 'debt.payment_rejected',
        details: {
          haqdor: creditor?.name || 'Hamkor',
          amount: record.amount,
          currency: record.debtEntry.currency || 'UZS',
          status: 'REJECTED',
        },
        targetRoles: ['OWNER', 'MANAGER', 'ACCOUNTANT'],
      },
    );

    // Kreditor rad etgandan so'ng ham eski "kutilmoqda" bildirgilarini yopamiz.
    await this.markPendingPaymentNotificationsResolved(companyId);

    this.notifyDebtsChanged(record.debtEntry.debtorId, record.debtEntry.creditorId, {
      debtEntryId: record.debtEntryId,
      partnerCompanyId: record.debtEntry.debtorId,
      reason: 'payment.rejected',
    });

    return updated;
  }

}
