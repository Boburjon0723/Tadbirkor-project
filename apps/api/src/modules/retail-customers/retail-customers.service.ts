import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CompaniesService } from '../companies/companies.service';
import {
  CreateRetailCustomerDto,
  RecordPrepaidDto,
  UpdateRetailCustomerDto,
} from './dto/retail-customer.dto';
import { Permission } from '../../common/enums/role.enum';
import { effectivePermissions } from '../../common/role-permissions';
import {
  LEDGER_OPERATIONS,
  LEDGER_OPERATION_LABELS,
  RetailCustomerLedgerService,
} from './retail-customer-ledger.service';
import { AppCacheService } from '../../common/cache/app-cache.service';

const SUMMARY_CACHE_MS = 25_000;
const LEDGER_CACHE_MS = 20_000;

type PrismaTx = Prisma.TransactionClient;

@Injectable()
export class RetailCustomersService {
  private partnerNamesCache = new Map<
    string,
    { names: string[]; expiresAt: number }
  >();
  private migratedPosRegistry = new Set<string>();

  constructor(
    private prisma: PrismaService,
    private companiesService: CompaniesService,
    private ledger: RetailCustomerLedgerService,
    private cache: AppCacheService,
  ) {}

  private summaryCacheKey(companyId: string) {
    return `retail-summary:${companyId}`;
  }

  private ledgerCacheKey(companyId: string, customerId: string) {
    return `retail-ledger:${companyId}:${customerId}`;
  }

  /** POS mijozlar ro‘yxati / daftar keshini yangilash */
  async invalidateCaches(companyId: string, retailCustomerId?: string) {
    await this.cache.del(this.summaryCacheKey(companyId));
    if (retailCustomerId) {
      await this.cache.del(this.ledgerCacheKey(companyId, retailCustomerId));
    }
  }

  private async assertPosModule(companyId: string) {
    await this.companiesService.assertModuleEnabled(companyId, 'POS');
  }

  /** Faol B2B hamkor kompaniya nomlari — 2 daqiqa kesh (har qidiruvda DB ga bormaydi) */
  private async getActivePartnerCompanyNames(companyId: string): Promise<string[]> {
    const cached = this.partnerNamesCache.get(companyId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.names;
    }
    const rows = await this.prisma.partner.findMany({
      where: { ownerCompanyId: companyId, status: 'ACTIVE' },
      select: { partnerCompany: { select: { name: true } } },
    });
    const names = rows
      .map((p) => p.partnerCompany?.name?.trim())
      .filter((n): n is string => !!n);
    this.partnerNamesCache.set(companyId, {
      names,
      expiresAt: Date.now() + 120_000,
    });
    return names;
  }

  private async assertNotB2bPartnerName(companyId: string, name: string) {
    const trimmed = name.trim();
    const partnerNames = await this.getActivePartnerCompanyNames(companyId);
    const hit = partnerNames.find(
      (p) => p.toLowerCase() === trimmed.toLowerCase(),
    );
    if (hit) {
      throw new BadRequestException(
        `«${hit}» — bu B2B hamkor kompaniyasi. POS mijozlari ro‘yxatiga qo‘shib bo‘lmaydi.`,
      );
    }
  }

  /** POS markazi / kassa — faqat chakana mijozlar (hamkor kompaniya emas) */
  private posRetailCustomerWhere(
    companyId: string,
    partnerNames: string[],
  ): Prisma.RetailCustomerWhereInput {
    const nameFilters: Prisma.RetailCustomerWhereInput[] =
      partnerNames.length > 0
        ? partnerNames.map((n) => ({
            NOT: {
              name: { equals: n, mode: 'insensitive' },
            },
          }))
        : [];

    return {
      companyId,
      isGuest: false,
      isPosRegistry: true,
      ...(nameFilters.length ? { AND: nameFilters } : {}),
    };
  }

  private async assertPosCreditOps(companyId: string, userId: string) {
    await this.assertPosModule(companyId);
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { posCreditEnabled: true },
    });
    if (!company?.posCreditEnabled) {
      throw new BadRequestException(
        'Operatsiya uchun POS nasiyani yoqing (Sozlamalar → Kompaniya).',
      );
    }
    const membership = await this.prisma.companyUser.findFirst({
      where: { companyId, userId },
      select: { role: true, grantPermissions: true, denyPermissions: true },
    });
    const perms = effectivePermissions(
      membership?.role || '',
      membership?.grantPermissions,
      membership?.denyPermissions,
    );
    if (!perms.includes(Permission.POS_CREDIT)) {
      throw new BadRequestException('Nasiya operatsiyasi uchun ruxsat yo‘q');
    }
  }

  private mapLedgerEntry(e: {
    id: string;
    operation: string;
    debit: Prisma.Decimal | number;
    credit: Prisma.Decimal | number;
    balanceAfter: Prisma.Decimal | number;
    currency: string;
    note: string | null;
    posSaleId: string | null;
    receivableId: string | null;
    paymentId: string | null;
    createdAt: Date;
    createdBy: { id: string; fullName: string } | null;
    posSale?: {
      id: string;
      saleNumber: string;
      currency: string;
      completedAt: Date | null;
      totalAmount: Prisma.Decimal | number;
      items?: Array<{
        id: string;
        productNameSnapshot: string;
        quantity: Prisma.Decimal | number;
        unitPrice: Prisma.Decimal | number;
        lineTotal: Prisma.Decimal | number;
      }>;
      _count?: { items: number };
    } | null;
  }) {
    const itemCount =
      e.posSale?._count?.items ?? e.posSale?.items?.length ?? 0;
    return {
      id: e.id,
      operation: e.operation,
      operationLabel:
        LEDGER_OPERATION_LABELS[
          e.operation as keyof typeof LEDGER_OPERATION_LABELS
        ] || e.operation,
      debit: Number(e.debit),
      credit: Number(e.credit),
      balanceAfter: Number(e.balanceAfter),
      currency: this.ledger.normalizeCurrency(e.currency),
      note: e.note,
      posSaleId: e.posSaleId,
      receivableId: e.receivableId,
      paymentId: e.paymentId,
      createdAt: e.createdAt,
      createdBy: e.createdBy,
      posSaleItemCount: itemCount,
      posSale: e.posSale
        ? {
            id: e.posSale.id,
            saleNumber: e.posSale.saleNumber,
            currency: this.ledger.normalizeCurrency(e.posSale.currency),
            completedAt: e.posSale.completedAt,
            totalAmount: Number(e.posSale.totalAmount),
            items: e.posSale.items?.map((it) => ({
              id: it.id,
              productName: it.productNameSnapshot,
              quantity: Number(it.quantity),
              unitPrice: Number(it.unitPrice),
              lineTotal: Number(it.lineTotal),
            })),
          }
        : null,
    };
  }

  /** Kassa: tez ro‘yxat — oxirgi POS mijozlari */
  async listForPosPicker(companyId: string, limit = 12) {
    await this.assertPosModule(companyId);
    const partnerNames = await this.getActivePartnerCompanyNames(companyId);
    return this.prisma.retailCustomer.findMany({
      where: this.posRetailCustomerWhere(companyId, partnerNames),
      select: { id: true, name: true, phone: true },
      orderBy: { updatedAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 30),
    });
  }

  async search(companyId: string, q?: string, limit = 20) {
    await this.assertPosModule(companyId);
    const term = (q || '').trim();
    if (!term) {
      return this.listForPosPicker(companyId, limit);
    }

    const partnerNames = await this.getActivePartnerCompanyNames(companyId);
    const take = Math.min(Math.max(Number(limit) || 20, 1), 30);
    const base = this.posRetailCustomerWhere(companyId, partnerNames);
    const digitsOnly = term.replace(/\D/g, '');
    const searchOr: Prisma.RetailCustomerWhereInput[] =
      digitsOnly.length >= 3
        ? [
            { phone: { contains: digitsOnly } },
            { name: { contains: term, mode: 'insensitive' } },
          ]
        : [
            { name: { contains: term, mode: 'insensitive' } },
            { phone: { contains: term, mode: 'insensitive' } },
          ];

    return this.prisma.retailCustomer.findMany({
      where: {
        ...base,
        AND: [
          ...(Array.isArray(base.AND) ? base.AND : base.AND ? [base.AND] : []),
          { OR: searchOr },
        ],
      },
      select: { id: true, name: true, phone: true },
      orderBy: { updatedAt: 'desc' },
      take,
    });
  }

  async findAll(companyId: string) {
    await this.assertPosModule(companyId);
    const partnerNames = await this.getActivePartnerCompanyNames(companyId);
    return this.prisma.retailCustomer.findMany({
      where: this.posRetailCustomerWhere(companyId, partnerNames),
      orderBy: { name: 'asc' },
    });
  }

  async findAllWithBalances(companyId: string) {
    const cacheKey = this.summaryCacheKey(companyId);
    const cached = await this.cache.getJson<Awaited<
      ReturnType<RetailCustomersService['findAllWithBalancesUncached']>
    >>(cacheKey);
    if (cached) return cached;

    const result = await this.findAllWithBalancesUncached(companyId);
    await this.cache.setJson(cacheKey, result, SUMMARY_CACHE_MS);
    return result;
  }

  private async findAllWithBalancesUncached(companyId: string) {
    await this.assertPosModule(companyId);
    const partnerNames = await this.getActivePartnerCompanyNames(companyId);
    const where = this.posRetailCustomerWhere(companyId, partnerNames);

    const customers = await this.prisma.retailCustomer.findMany({
      where,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        phone: true,
        notes: true,
        createdAt: true,
        prepaidBalance: true,
        prepaidBalanceUsd: true,
      },
    });

    const ids = customers.map((c) => c.id);
    if (!ids.length) return [];

    const [debtGroups, openCountGroups, lastSaleGroups] = await Promise.all([
      this.prisma.retailReceivable.groupBy({
        by: ['retailCustomerId', 'currency'],
        where: {
          companyId,
          retailCustomerId: { in: ids },
          status: { in: ['OPEN', 'PARTIAL'] },
        },
        _sum: { remainingAmount: true },
      }),
      this.prisma.retailReceivable.groupBy({
        by: ['retailCustomerId'],
        where: {
          companyId,
          retailCustomerId: { in: ids },
          status: { in: ['OPEN', 'PARTIAL'] },
        },
        _count: { _all: true },
      }),
      this.prisma.posSale.groupBy({
        by: ['retailCustomerId'],
        where: {
          companyId,
          retailCustomerId: { in: ids },
          status: 'COMPLETED',
        },
        _max: { completedAt: true },
      }),
    ]);

    const debtMap = new Map<string, { UZS: number; USD: number }>();
    for (const g of debtGroups) {
      if (!g.retailCustomerId) continue;
      const cur = this.ledger.normalizeCurrency(g.currency);
      const row = debtMap.get(g.retailCustomerId) ?? { UZS: 0, USD: 0 };
      row[cur] += Number(g._sum.remainingAmount ?? 0);
      debtMap.set(g.retailCustomerId, row);
    }

    const openCountMap = new Map(
      openCountGroups.map((g) => [g.retailCustomerId, g._count._all]),
    );
    const lastSaleMap = new Map(
      lastSaleGroups
        .filter((g) => g.retailCustomerId)
        .map((g) => [g.retailCustomerId!, g._max.completedAt]),
    );

    return customers.map((c) => {
      const debtByCurrency = debtMap.get(c.id) ?? { UZS: 0, USD: 0 };
      const prepaidUzs = this.ledger.roundMoney(Number(c.prepaidBalance ?? 0));
      const prepaidUsd = this.ledger.roundMoney(Number(c.prepaidBalanceUsd ?? 0));
      const debtUzs = this.ledger.roundMoney(debtByCurrency.UZS);
      const debtUsd = this.ledger.roundMoney(debtByCurrency.USD);

      const balances = {
        UZS: {
          totalDebt: debtUzs,
          prepaidBalance: prepaidUzs,
          netBalance: this.ledger.roundMoney(prepaidUzs - debtUzs),
        },
        USD: {
          totalDebt: debtUsd,
          prepaidBalance: prepaidUsd,
          netBalance: this.ledger.roundMoney(prepaidUsd - debtUsd),
        },
      };

      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        notes: c.notes,
        createdAt: c.createdAt,
        balances,
        totalDebt: debtUzs,
        prepaidBalance: prepaidUzs,
        netBalance: balances.UZS.netBalance,
        totalPaid: 0,
        totalCredited: 0,
        openReceivablesCount: openCountMap.get(c.id) ?? 0,
        lastSaleAt: lastSaleMap.get(c.id) ?? null,
      };
    });
  }

  async findLedger(id: string, companyId: string) {
    const cacheKey = this.ledgerCacheKey(companyId, id);
    const cached = await this.cache.getJson<
      Awaited<ReturnType<RetailCustomersService['findLedgerUncached']>>
    >(cacheKey);
    if (cached) return cached;

    const result = await this.findLedgerUncached(id, companyId);
    await this.cache.setJson(cacheKey, result, LEDGER_CACHE_MS);
    return result;
  }

  private async findLedgerUncached(id: string, companyId: string) {
    await this.assertPosModule(companyId);
    const partnerNames = await this.getActivePartnerCompanyNames(companyId);
    const customerWhere = { id, ...this.posRetailCustomerWhere(companyId, partnerNames) };

    const entryCount = await this.prisma.retailCustomerLedgerEntry.count({
      where: { companyId, retailCustomerId: id },
    });
    if (entryCount === 0) {
      await this.ledger.syncLedgerFromHistory(companyId, id);
      await this.cache.del(this.ledgerCacheKey(companyId, id));
    }

    const [customer, balanceRows, receivables, ledgerEntries] = await Promise.all([
      this.prisma.retailCustomer.findFirst({
        where: customerWhere,
        select: { id: true, name: true, phone: true, notes: true },
      }),
      this.ledger.computeAllBalances(this.prisma, companyId, id),
      this.prisma.retailReceivable.findMany({
        where: {
          companyId,
          retailCustomerId: id,
          status: { in: ['OPEN', 'PARTIAL'] },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          amount: true,
          remainingAmount: true,
          currency: true,
          status: true,
          createdAt: true,
          posSale: {
            select: {
              id: true,
              saleNumber: true,
              completedAt: true,
              totalAmount: true,
              currency: true,
            },
          },
          payments: {
            orderBy: { createdAt: 'desc' },
            take: 20,
            select: {
              id: true,
              amount: true,
              notes: true,
              createdAt: true,
              createdBy: { select: { id: true, fullName: true } },
            },
          },
        },
      }),
      this.prisma.retailCustomerLedgerEntry.findMany({
        where: { companyId, retailCustomerId: id },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          id: true,
          operation: true,
          debit: true,
          credit: true,
          balanceAfter: true,
          currency: true,
          note: true,
          posSaleId: true,
          receivableId: true,
          paymentId: true,
          createdAt: true,
          createdBy: { select: { id: true, fullName: true } },
          posSale: {
            select: {
              id: true,
              saleNumber: true,
              currency: true,
              completedAt: true,
              totalAmount: true,
              _count: { select: { items: true } },
            },
          },
        },
      }),
    ]);

    if (!customer) throw new NotFoundException('Mijoz topilmadi');

    return {
      customer,
      balances: balanceRows,
      totalDebt: balanceRows.UZS.totalDebt,
      prepaidBalance: balanceRows.UZS.prepaidBalance,
      netBalance: balanceRows.UZS.netBalance,
      totalPaid: 0,
      receivables: receivables.map((r) => ({
        id: r.id,
        amount: Number(r.amount),
        remainingAmount: Number(r.remainingAmount),
        currency: r.currency,
        status: r.status,
        createdAt: r.createdAt,
        posSale: r.posSale
          ? { ...r.posSale, totalAmount: Number(r.posSale.totalAmount) }
          : null,
        payments: r.payments.map((p) => ({
          id: p.id,
          amount: Number(p.amount),
          notes: p.notes,
          createdAt: p.createdAt,
          createdBy: p.createdBy,
        })),
      })),
      entries: ledgerEntries.map((e) => this.mapLedgerEntry(e)),
    };
  }

  async getLedgerEntrySaleItems(
    customerId: string,
    entryId: string,
    companyId: string,
  ) {
    await this.assertPosModule(companyId);
    const entry = await this.prisma.retailCustomerLedgerEntry.findFirst({
      where: {
        id: entryId,
        companyId,
        retailCustomerId: customerId,
      },
      select: { posSaleId: true },
    });
    if (!entry?.posSaleId) {
      return { items: [] as Array<{
        id: string;
        productName: string;
        quantity: number;
        unitPrice: number;
        lineTotal: number;
      }> };
    }

    const items = await this.prisma.posSaleItem.findMany({
      where: { saleId: entry.posSaleId },
      select: {
        id: true,
        productNameSnapshot: true,
        quantity: true,
        unitPrice: true,
        lineTotal: true,
      },
      orderBy: { id: 'asc' },
    });

    return {
      items: items.map((it) => ({
        id: it.id,
        productName: it.productNameSnapshot,
        quantity: Number(it.quantity),
        unitPrice: Number(it.unitPrice),
        lineTotal: Number(it.lineTotal),
      })),
    };
  }

  async findOne(id: string, companyId: string) {
    await this.assertPosModule(companyId);
    const partnerNames = await this.getActivePartnerCompanyNames(companyId);
    const row = await this.prisma.retailCustomer.findFirst({
      where: { id, ...this.posRetailCustomerWhere(companyId, partnerNames) },
    });
    if (!row) throw new NotFoundException('Mijoz topilmadi');
    return row;
  }

  async create(companyId: string, dto: CreateRetailCustomerDto) {
    await this.assertPosModule(companyId);
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Ism majburiy');
    await this.assertNotB2bPartnerName(companyId, name);
    const row = await this.prisma.retailCustomer.create({
      data: {
        companyId,
        name,
        phone: dto.phone?.trim() || null,
        notes: dto.notes?.trim() || null,
        isPosRegistry: true,
      },
    });
    await this.invalidateCaches(companyId);
    return row;
  }

  /** Mavjud yozuvlarni POS mijoziga aylantirish (kompaniya uchun bir marta) */
  async migratePosRegistryFlags(companyId: string) {
    if (this.migratedPosRegistry.has(companyId)) {
      return { updated: 0, skipped: true };
    }
    this.migratedPosRegistry.add(companyId);
    const withActivity = await this.prisma.retailCustomer.findMany({
      where: {
        companyId,
        isPosRegistry: false,
        OR: [
          { sales: { some: {} } },
          { receivables: { some: {} } },
          { ledgerEntries: { some: {} } },
        ],
      },
      select: { id: true },
    });
    if (!withActivity.length) return { updated: 0 };
    const res = await this.prisma.retailCustomer.updateMany({
      where: { id: { in: withActivity.map((c) => c.id) } },
      data: { isPosRegistry: true },
    });
    return { updated: res.count };
  }

  async recordPrepaid(
    id: string,
    companyId: string,
    userId: string,
    dto: RecordPrepaidDto,
  ) {
    await this.assertPosCreditOps(companyId, userId);
    const amount = this.ledger.roundMoney(Number(dto.amount));
    if (amount <= 0) {
      throw new BadRequestException('Summa 0 dan katta bo‘lishi kerak');
    }
    await this.findOne(id, companyId);
    const currency = this.ledger.normalizeCurrency(dto.currency);

    return this.prisma.$transaction(async (tx) => {
      const field = this.ledger.prepaidField(currency);
      await tx.retailCustomer.update({
        where: { id },
        data: { [field]: { increment: amount } },
      });
      const snap = await this.ledger.computeSnapshot(tx, companyId, id, currency);
      await this.ledger.appendEntry(tx, {
        companyId,
        retailCustomerId: id,
        operation: LEDGER_OPERATIONS.PREPAID_IN,
        credit: amount,
        currency,
        note: dto.notes?.trim() || 'Qo‘lda avans kirim',
        createdById: userId,
        balanceAfter: snap.netBalance,
      });
      const balances = await this.ledger.computeAllBalances(tx, companyId, id);
      return { ...snap, balances };
    }).then(async (res) => {
      await this.invalidateCaches(companyId, id);
      return res;
    });
  }

  async recordWithdraw(
    id: string,
    companyId: string,
    userId: string,
    dto: RecordPrepaidDto,
  ) {
    await this.assertPosCreditOps(companyId, userId);
    const amount = this.ledger.roundMoney(Number(dto.amount));
    if (amount <= 0) {
      throw new BadRequestException('Summa 0 dan katta bo‘lishi kerak');
    }

    const customer = await this.findOne(id, companyId);
    const currency = this.ledger.normalizeCurrency(dto.currency);
    const field = this.ledger.prepaidField(currency);
    const available = this.ledger.roundMoney(
      Number((customer as Record<string, unknown>)[field] ?? 0),
    );
    if (amount > available + 0.001) {
      throw new BadRequestException(
        `Avans yetarli emas (${currency}). Mavjud: ${available}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.retailCustomer.update({
        where: { id },
        data: { [field]: { decrement: amount } },
      });
      const snap = await this.ledger.computeSnapshot(tx, companyId, id, currency);
      await this.ledger.appendEntry(tx, {
        companyId,
        retailCustomerId: id,
        operation: LEDGER_OPERATIONS.PREPAID_OUT,
        debit: amount,
        currency,
        note: dto.notes?.trim() || 'Pul qaytarish (chiqim)',
        createdById: userId,
        balanceAfter: snap.netBalance,
      });
      const balances = await this.ledger.computeAllBalances(tx, companyId, id);
      return { ...snap, balances };
    }).then(async (res) => {
      await this.invalidateCaches(companyId, id);
      return res;
    });
  }

  /**
   * POS nasiya cheki — avansdan ushlab, qolganini qarzga.
   */
  async processCreditSale(
    tx: PrismaTx,
    params: {
      companyId: string;
      retailCustomerId: string;
      posSaleId: string;
      total: number;
      currency: string;
      userId: string;
      saleNumber: string;
    },
  ) {
    const total = this.ledger.roundMoney(params.total);
    const currency = this.ledger.normalizeCurrency(params.currency);
    const customer = await tx.retailCustomer.findFirst({
      where: { id: params.retailCustomerId, companyId: params.companyId },
      select: { prepaidBalance: true, prepaidBalanceUsd: true },
    });
    if (!customer) throw new NotFoundException('Mijoz topilmadi');

    const prepaidAvail = this.ledger.roundMoney(
      currency === 'USD'
        ? Number(customer.prepaidBalanceUsd ?? 0)
        : Number(customer.prepaidBalance ?? 0),
    );
    const usePrepaid = this.ledger.roundMoney(Math.min(prepaidAvail, total));
    let remaining = this.ledger.roundMoney(total - usePrepaid);

    if (usePrepaid > 0) {
      const field = this.ledger.prepaidField(currency);
      await tx.retailCustomer.update({
        where: { id: params.retailCustomerId },
        data: { [field]: { decrement: usePrepaid } },
      });
      const snap = await this.ledger.computeSnapshot(
        tx,
        params.companyId,
        params.retailCustomerId,
        currency,
      );
      await this.ledger.appendEntry(tx, {
        companyId: params.companyId,
        retailCustomerId: params.retailCustomerId,
        operation: LEDGER_OPERATIONS.PREPAID_USE,
        debit: usePrepaid,
        currency,
        note: `POS ${params.saleNumber} — avansdan`,
        posSaleId: params.posSaleId,
        createdById: params.userId,
        balanceAfter: snap.netBalance,
      });
    }

    if (remaining > 0.001) {
      const receivable = await tx.retailReceivable.create({
        data: {
          companyId: params.companyId,
          retailCustomerId: params.retailCustomerId,
          posSaleId: params.posSaleId,
          amount: remaining,
          remainingAmount: remaining,
          currency: params.currency,
          status: 'OPEN',
        },
      });
      const snap = await this.ledger.computeSnapshot(
        tx,
        params.companyId,
        params.retailCustomerId,
        currency,
      );
      await this.ledger.appendEntry(tx, {
        companyId: params.companyId,
        retailCustomerId: params.retailCustomerId,
        operation: LEDGER_OPERATIONS.CREDIT_SALE,
        debit: remaining,
        currency,
        note: `POS ${params.saleNumber} — nasiya`,
        posSaleId: params.posSaleId,
        receivableId: receivable.id,
        createdById: params.userId,
        balanceAfter: snap.netBalance,
      });
      return receivable;
    }

    return null;
  }

  async reverseCreditSale(
    tx: PrismaTx,
    params: {
      companyId: string;
      retailCustomerId: string;
      posSaleId: string;
      saleNumber: string;
      userId: string;
    },
  ) {
    const ledgerEntries = await tx.retailCustomerLedgerEntry.findMany({
      where: {
        companyId: params.companyId,
        retailCustomerId: params.retailCustomerId,
        posSaleId: params.posSaleId,
        operation: {
          in: [LEDGER_OPERATIONS.PREPAID_USE, LEDGER_OPERATIONS.CREDIT_SALE],
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!ledgerEntries.length) return;

    const receivable = await tx.retailReceivable.findUnique({
      where: { posSaleId: params.posSaleId },
      include: { payments: { select: { id: true }, take: 1 } },
    });
    if (receivable?.payments.length) {
      throw new BadRequestException(
        'Bu nasiya chek bo‘yicha to‘lov bor. Avval mijoz qarz to‘lovini qaytarish kerak.',
      );
    }

    if (receivable) {
      await tx.retailReceivable.update({
        where: { id: receivable.id },
        data: { remainingAmount: 0, status: 'PAID' },
      });
    }

    for (const entry of ledgerEntries) {
      const amount = this.ledger.roundMoney(Number(entry.debit));
      if (amount <= 0) continue;

      const currency = this.ledger.normalizeCurrency(entry.currency);
      if (entry.operation === LEDGER_OPERATIONS.PREPAID_USE) {
        const field = this.ledger.prepaidField(currency);
        await tx.retailCustomer.update({
          where: { id: params.retailCustomerId },
          data: { [field]: { increment: amount } },
        });
      }

      const snap = await this.ledger.computeSnapshot(
        tx,
        params.companyId,
        params.retailCustomerId,
        currency,
      );
      await this.ledger.appendEntry(tx, {
        companyId: params.companyId,
        retailCustomerId: params.retailCustomerId,
        operation: LEDGER_OPERATIONS.POS_VOID,
        credit: amount,
        currency,
        note: `POS ${params.saleNumber} bekor qilindi`,
        posSaleId: params.posSaleId,
        receivableId:
          entry.operation === LEDGER_OPERATIONS.CREDIT_SALE ? receivable?.id : undefined,
        createdById: params.userId,
        balanceAfter: snap.netBalance,
      });
    }
  }

  async update(id: string, companyId: string, dto: UpdateRetailCustomerDto) {
    await this.findOne(id, companyId);
    return this.prisma.retailCustomer.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
      },
    });
  }

  async resolveForSale(
    companyId: string,
    retailCustomerId?: string | null,
    quickName?: string | null,
    quickPhone?: string | null,
  ) {
    if (retailCustomerId) {
      const existing = await this.prisma.retailCustomer.findFirst({
        where: { id: retailCustomerId, companyId },
      });
      if (!existing) throw new NotFoundException('Mijoz topilmadi');
      return {
        retailCustomerId: existing.id,
        customerNameSnapshot: existing.name,
        customerPhoneSnapshot: existing.phone,
      };
    }
    const name = quickName?.trim();
    if (!name) {
      return {
        retailCustomerId: null as string | null,
        customerNameSnapshot: null as string | null,
        customerPhoneSnapshot: null as string | null,
      };
    }
    await this.assertNotB2bPartnerName(companyId, name);
    const created = await this.create(companyId, {
      name,
      phone: quickPhone?.trim(),
    });
    return {
      retailCustomerId: created.id,
      customerNameSnapshot: created.name,
      customerPhoneSnapshot: created.phone,
    };
  }
}
