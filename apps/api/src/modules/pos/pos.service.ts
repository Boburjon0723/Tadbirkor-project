import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StockService } from '../warehouses/stock.service';
import { WarehouseScopeService } from '../users/services/warehouse-scope.service';
import { RetailCustomersService } from '../retail-customers/retail-customers.service';
import { RetailReceivablesService } from '../retail-receivables/retail-receivables.service';
import { Permission } from '../../common/enums/role.enum';
import { effectivePermissions } from '../../common/role-permissions';
import {
  CheckoutPosSaleDto,
  CreatePosSaleDto,
  ListPosSalesQueryDto,
  PosSaleItemInputDto,
  QuickCheckoutPosSaleDto,
  UpdatePosSaleDto,
  VoidPosSaleDto,
} from './dto/pos-sale.dto';
import { AppCacheService } from '../../common/cache/app-cache.service';
import { posCatalogCachePrefix } from '../../common/pos-catalog-cache.util';
import { getDayRangeInAppTimezone } from '../../common/tashkent-date.util';
import { LONG_TX_OPTIONS, POS_CHECKOUT_TX_OPTIONS } from '../../prisma/transaction-options';
import { InventoryGateway } from '../warehouses/inventory.gateway';

type PrismaTx = Prisma.TransactionClient;
type PosPriceContext = { perms: string[]; maxPct: number };
type PosDbClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class PosService {
  constructor(
    private prisma: PrismaService,
    private stockService: StockService,
    private warehouseScopeService: WarehouseScopeService,
    private retailCustomersService: RetailCustomersService,
    private retailReceivablesService: RetailReceivablesService,
    private cache: AppCacheService,
    private inventoryGateway: InventoryGateway,
  ) {}

  private async invalidatePosCatalogCache(
    companyId: string,
    warehouseId?: string | null,
  ) {
    await this.cache.delByPrefix(posCatalogCachePrefix(companyId, warehouseId));
  }

  private notifyPosInventory(companyId: string, warehouseId: string) {
    try {
      this.inventoryGateway.emitToCompany(companyId, 'inventory:changed', {
        warehouseId,
        reason: 'POS_SALE',
      });
      this.inventoryGateway.emitDashboardRefresh(companyId);
    } catch {
      /* realtime ixtiyoriy */
    }
  }

  /**
   * Foydalanuvchining ombor scope'iga ko'ra warehouseId'ni tekshiradi.
   * SALES/WAREHOUSE — faqat o'z ombori; OWNER/MANAGER — har qanday.
   */
  private async assertWarehouseInScope(
    companyId: string,
    userId: string,
    warehouseId: string,
  ): Promise<void> {
    const scope = await this.warehouseScopeService.getForUser(companyId, userId);
    if (!this.warehouseScopeService.isAllowed(scope, warehouseId)) {
      throw new ForbiddenException(
        "Bu ombor sizga biriktirilmagan. Faqat o'zingizga biriktirilgan ombordan sotuv qilishingiz mumkin.",
      );
    }
  }

  // --- Helpers --------------------------------------------------------------

  private toMoney(value: Prisma.Decimal | number | string | null | undefined): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    return Number(value);
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private async generateSaleNumber(companyId: string, tx: PrismaTx): Promise<string> {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    const d = String(now.getUTCDate()).padStart(2, '0');
    const dateStr = `${y}${m}${d}`;

    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

    const todayCount = await tx.posSale.count({
      where: {
        companyId,
        createdAt: { gte: startOfDay, lte: endOfDay },
      },
    });

    const seq = String(todayCount + 1).padStart(6, '0');
    return `POS-${dateStr}-${seq}`;
  }

  private normalizeCurrency(value: unknown): 'UZS' | 'USD' {
    return String(value || 'UZS').toUpperCase() === 'USD' ? 'USD' : 'UZS';
  }

  private resolveSaleCurrency(
    resolved: Array<{ currency: 'UZS' | 'USD' }>,
  ): 'UZS' | 'USD' {
    if (!resolved.length) return 'UZS';
    const currencies = new Set(resolved.map((item) => item.currency));
    if (currencies.size > 1) {
      throw new BadRequestException(
        'Bitta chekda turli valyutali mahsulotlar bo\'lmaydi',
      );
    }
    return resolved[0].currency;
  }

  private async loadPosPriceContext(
    db: PosDbClient,
    companyId: string,
    userId: string,
  ): Promise<PosPriceContext> {
    const [membership, company] = await Promise.all([
      db.companyUser.findFirst({
        where: { companyId, userId },
        select: { role: true, grantPermissions: true, denyPermissions: true },
      }),
      db.company.findUnique({
        where: { id: companyId },
        select: { posMaxDiscountPercent: true },
      }),
    ]);
    const perms = effectivePermissions(
      membership?.role || '',
      membership?.grantPermissions,
      membership?.denyPermissions,
    );
    const maxPct =
      company?.posMaxDiscountPercent != null
        ? Number(company.posMaxDiscountPercent)
        : 15;
    return { perms, maxPct };
  }

  private validateUnitPriceWithContext(
    ctx: { perms: string[]; maxPct: number },
    listPrice: number,
    unitPrice: number,
    productLabel: string,
  ): void {
    if (unitPrice < 0) {
      throw new BadRequestException('Narx manfiy bo‘lishi mumkin emas');
    }
    if (unitPrice >= listPrice - 0.001) return;

    if (ctx.perms.includes(Permission.POS_OVERRIDE_PRICE)) {
      return;
    }
    if (!ctx.perms.includes(Permission.POS_CHANGE_PRICE)) {
      throw new BadRequestException(
        `«${productLabel}»: narxni o‘zgartirish ruxsati yo‘q`,
      );
    }

    const discountPct =
      listPrice > 0 ? ((listPrice - unitPrice) / listPrice) * 100 : 0;
    if (discountPct > ctx.maxPct + 0.01) {
      throw new BadRequestException(
        `«${productLabel}»: chegirma ${discountPct.toFixed(1)}% — ruxsat ${ctx.maxPct}% gacha`,
      );
    }
  }

  /**
   * Variantlarni topib unitPrice'ni to'ldiradi va summalarni hisoblaydi.
   */
  private async resolveItems(
    companyId: string,
    userId: string,
    items: PosSaleItemInputDto[],
    tx: PrismaTx,
    priceCtx?: PosPriceContext,
  ): Promise<
    Array<{
      productVariantId: string;
      productNameSnapshot: string;
      skuSnapshot: string | null;
      barcodeSnapshot: string | null;
      quantity: number;
      unitPrice: number;
      listPrice: number;
      lineTotal: number;
      currency: 'UZS' | 'USD';
    }>
  > {
    if (!items?.length) return [];

    const variantIds = Array.from(new Set(items.map((i) => i.productVariantId)));
    const variants = await tx.productVariant.findMany({
      where: { id: { in: variantIds }, companyId },
      include: { product: true },
    });
    const variantMap = new Map(variants.map((v) => [v.id, v]));
    const ctx = priceCtx ?? (await this.loadPosPriceContext(tx, companyId, userId));

    const resolved: Array<{
      productVariantId: string;
      productNameSnapshot: string;
      skuSnapshot: string | null;
      barcodeSnapshot: string | null;
      quantity: number;
      listPrice: number;
      unitPrice: number;
      lineTotal: number;
      currency: 'UZS' | 'USD';
    }> = [];

    for (const it of items) {
      const variant = variantMap.get(it.productVariantId);
      if (!variant) {
        throw new NotFoundException(
          `Mahsulot varianti topilmadi: ${it.productVariantId}`,
        );
      }
      if (variant.status !== 'ACTIVE') {
        throw new BadRequestException(
          `Variant "${variant.name}" aktiv emas, sotish mumkin emas`,
        );
      }

      const listPrice = this.toMoney(variant.salePrice);
      const unitPrice =
        it.unitPrice !== undefined ? Number(it.unitPrice) : listPrice;
      const label = variant.product?.name
        ? `${variant.product.name} — ${variant.name}`
        : variant.name;
      this.validateUnitPriceWithContext(
        ctx,
        listPrice,
        unitPrice,
        label,
      );
      const quantity = Number(it.quantity);
      const lineTotal = this.round2(unitPrice * quantity);

      resolved.push({
        productVariantId: variant.id,
        productNameSnapshot: variant.product?.name
          ? `${variant.product.name} — ${variant.name}`
          : variant.name,
        skuSnapshot: variant.sku ?? null,
        barcodeSnapshot: variant.barcode ?? null,
        quantity,
        listPrice,
        unitPrice,
        lineTotal,
        currency: this.normalizeCurrency(variant.currency),
      });
    }

    return resolved;
  }

  private calcTotals(
    resolved: Array<{ lineTotal: number }>,
    discountAmount: number,
  ): { subtotal: number; total: number; discount: number } {
    const subtotal = this.round2(
      resolved.reduce((acc, it) => acc + it.lineTotal, 0),
    );
    let discount = Math.max(0, this.round2(discountAmount || 0));
    if (discount > subtotal) discount = subtotal; // umumiy summadan oshmasin
    const total = this.round2(subtotal - discount);
    return { subtotal, total, discount };
  }

  // --- Read -----------------------------------------------------------------

  async findAll(companyId: string, query: ListPosSalesQueryDto) {
    const where: Prisma.PosSaleWhereInput = { companyId };
    if (query.status) where.status = query.status;
    if (query.warehouseId) where.warehouseId = query.warehouseId;
    if (query.cashierId) where.cashierId = query.cashierId;

    if (query.date) {
      const d = new Date(query.date);
      if (!isNaN(d.getTime())) {
        const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
        const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
        where.createdAt = { gte: start, lte: end };
      }
    } else if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) {
        const f = new Date(query.from);
        if (!isNaN(f.getTime())) (where.createdAt as Prisma.DateTimeFilter).gte = f;
      }
      if (query.to) {
        const t = new Date(query.to);
        if (!isNaN(t.getTime())) (where.createdAt as Prisma.DateTimeFilter).lte = t;
      }
    }

    return this.prisma.posSale.findMany({
      where,
      include: {
        warehouse: { select: { id: true, name: true } },
        cashier: { select: { id: true, fullName: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async findOne(id: string, companyId: string) {
    const sale = await this.prisma.posSale.findFirst({
      where: { id, companyId },
      include: {
        warehouse: true,
        cashier: { select: { id: true, fullName: true } },
        voidedBy: { select: { id: true, fullName: true } },
        items: {
          orderBy: { createdAt: 'asc' },
          include: {
            productVariant: {
              include: { product: true },
            },
          },
        },
        payments: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!sale) throw new NotFoundException('Sotuv topilmadi');
    return sale;
  }

  async quickSearch(
    companyId: string,
    userId: string,
    query: string,
    warehouseId?: string,
  ) {
    const q = (query || '').trim();
    if (!q) return [];

    if (warehouseId) {
      await this.assertWarehouseInScope(companyId, userId, warehouseId);
    }

    // 1) Barcode aniq mosligi
    const activeProductScope = { status: { not: 'ARCHIVED' as const } };
    const byBarcode = await this.prisma.productVariant.findFirst({
      where: {
        companyId,
        status: 'ACTIVE',
        barcode: q,
        product: activeProductScope,
      },
      include: { product: true },
    });

    let variants;
    if (byBarcode) {
      variants = [byBarcode];
    } else {
      variants = await this.prisma.productVariant.findMany({
        where: {
          companyId,
          status: 'ACTIVE',
          product: activeProductScope,
          OR: [
            { sku: { equals: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
            { product: { name: { contains: q, mode: 'insensitive' } } },
          ],
        },
        include: { product: true },
        take: 25,
        orderBy: { updatedAt: 'desc' },
      });
    }

    if (variants.length === 0) return [];

    const balances = warehouseId
      ? await this.prisma.stockBalance.findMany({
          where: {
            warehouseId,
            productVariantId: { in: variants.map((v) => v.id) },
          },
        })
      : [];
    const stockMap = new Map(balances.map((b) => [b.productVariantId, b]));

    return variants.map((v) => ({
      id: v.id,
      productId: v.productId,
      productName: v.product?.name ?? null,
      name: v.name,
      sku: v.sku,
      barcode: v.barcode,
      salePrice: this.toMoney(v.salePrice),
      currency: v.currency,
      stock: warehouseId
        ? Number(stockMap.get(v.id)?.quantity ?? 0)
        : null,
    }));
  }

  async getCatalog(
    companyId: string,
    userId: string,
    query: {
      warehouseId: string;
      search?: string;
      limit?: string | number;
      page?: string | number;
    },
  ) {
    const warehouseId = String(query.warehouseId || '').trim();
    if (!warehouseId) {
      throw new BadRequestException('warehouseId majburiy');
    }
    await this.assertWarehouseInScope(companyId, userId, warehouseId);

    const search = String(query.search || '').trim();
    const limit = Math.min(Math.max(Number(query.limit) || 80, 1), 200);
    const page = Math.max(Number(query.page) || 1, 1);
    const skip = (page - 1) * limit;

    const cacheKey = `pos:catalog:${companyId}:${warehouseId}:${search}:${page}:${limit}`;
    const cached = await this.cache.getJson<{
      items: unknown[];
      page: number;
      limit: number;
      total: number;
      hasMore: boolean;
    }>(cacheKey);
    if (cached) return cached;

    const where: Prisma.ProductVariantWhereInput = {
      companyId,
      status: 'ACTIVE',
      product: { status: { not: 'ARCHIVED' } },
      stockBalances: {
        some: {
          warehouseId,
          quantity: { gt: 0 },
        },
      },
    };

    if (search) {
      where.OR = [
        { barcode: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { product: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [variants, total] = await Promise.all([
      this.prisma.productVariant.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              categoryId: true,
              imageUrl: true,
              category: { select: { id: true, name: true } },
            },
          },
          stockBalances: {
            where: { warehouseId },
            select: { quantity: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.productVariant.count({ where }),
    ]);

    const items = variants.map((v) => ({
      id: v.id,
      productId: v.productId,
      productName: v.product.name,
      name: v.name,
      sku: v.sku,
      barcode: v.barcode,
      salePrice: this.toMoney(v.salePrice),
      currency: v.currency,
      image: v.product.imageUrl,
      categoryId: v.product.categoryId,
      categoryName: v.product.category?.name ?? null,
      quantity: Number(v.stockBalances[0]?.quantity ?? 0),
    }));

    const result = {
      items,
      page,
      limit,
      total,
      hasMore: skip + items.length < total,
    };
    await this.cache.setJson(cacheKey, result, Number(process.env.POS_CATALOG_CACHE_TTL_MS || 30_000));
    return result;
  }

  async summaryToday(companyId: string, cashierId?: string) {
    const { start, end, dateLabel } = getDayRangeInAppTimezone();

    const where: Prisma.PosSaleWhereInput = {
      companyId,
      createdAt: { gte: start, lte: end },
      ...(cashierId ? { cashierId } : {}),
    };

    const [completedGroups, voidedGroups, draftCount] = await Promise.all([
      this.prisma.posSale.groupBy({
        by: ['currency'],
        where: { ...where, status: 'COMPLETED' },
        _sum: { totalAmount: true, discountAmount: true },
        _count: { _all: true },
      }),
      this.prisma.posSale.groupBy({
        by: ['currency'],
        where: { ...where, status: 'VOIDED' },
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),
      this.prisma.posSale.count({ where: { ...where, status: 'DRAFT' } }),
    ]);

    const completedTotalByCurrency: Record<string, number> = {};
    const completedDiscountByCurrency: Record<string, number> = {};
    let completedCount = 0;
    for (const row of completedGroups) {
      const currency = this.normalizeCurrency(row.currency);
      completedTotalByCurrency[currency] = this.toMoney(row._sum.totalAmount);
      completedDiscountByCurrency[currency] = this.toMoney(row._sum.discountAmount);
      completedCount += row._count._all;
    }

    const voidedTotalByCurrency: Record<string, number> = {};
    let voidedCount = 0;
    for (const row of voidedGroups) {
      const currency = this.normalizeCurrency(row.currency);
      voidedTotalByCurrency[currency] = this.toMoney(row._sum.totalAmount);
      voidedCount += row._count._all;
    }

    return {
      date: dateLabel,
      timezone: 'Asia/Tashkent',
      completed: {
        count: completedCount,
        total: Object.values(completedTotalByCurrency).reduce((sum, value) => sum + value, 0),
        discount: Object.values(completedDiscountByCurrency).reduce((sum, value) => sum + value, 0),
        totalByCurrency: completedTotalByCurrency,
        discountByCurrency: completedDiscountByCurrency,
      },
      voided: {
        count: voidedCount,
        total: Object.values(voidedTotalByCurrency).reduce((sum, value) => sum + value, 0),
        totalByCurrency: voidedTotalByCurrency,
      },
      draft: { count: draftCount },
    };
  }

  // --- Write ----------------------------------------------------------------

  async create(companyId: string, userId: string, dto: CreatePosSaleDto) {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: dto.warehouseId, companyId, status: 'ACTIVE' },
    });
    if (!warehouse) throw new NotFoundException('Ombor topilmadi yoki aktiv emas');

    // Scope qoidasi: SALES/WAREHOUSE faqat o'z omboridan sotishi mumkin
    await this.assertWarehouseInScope(companyId, userId, dto.warehouseId);

    const customer = await this.retailCustomersService.resolveForSale(
      companyId,
      dto.retailCustomerId,
      dto.customerName,
      dto.customerPhone,
    );

    return this.prisma.$transaction(async (tx) => {
      const resolved = await this.resolveItems(
        companyId,
        userId,
        dto.items ?? [],
        tx,
      );
      const { subtotal, total, discount } = this.calcTotals(
        resolved,
        dto.discountAmount ?? 0,
      );
      const saleNumber = await this.generateSaleNumber(companyId, tx);
      const currency = this.resolveSaleCurrency(resolved);

      const sale = await tx.posSale.create({
        data: {
          companyId,
          warehouseId: dto.warehouseId,
          saleNumber,
          subtotal,
          discountAmount: discount,
          totalAmount: total,
          currency,
          status: 'DRAFT',
          cashierId: userId,
          note: dto.note,
          retailCustomerId: customer.retailCustomerId,
          customerNameSnapshot: customer.customerNameSnapshot,
          customerPhoneSnapshot: customer.customerPhoneSnapshot,
          items: {
            create: resolved.map((it) => ({
              productVariantId: it.productVariantId,
              productNameSnapshot: it.productNameSnapshot,
              skuSnapshot: it.skuSnapshot,
              barcodeSnapshot: it.barcodeSnapshot,
              quantity: it.quantity,
              listPrice: it.listPrice,
              unitPrice: it.unitPrice,
              lineTotal: it.lineTotal,
            })),
          },
        },
        include: {
          items: true,
          warehouse: { select: { id: true, name: true } },
          cashier: { select: { id: true, fullName: true } },
        },
      });

      for (const it of resolved) {
        if (it.unitPrice >= it.listPrice - 0.001) continue;
        const discountPct =
          it.listPrice > 0
            ? this.round2(((it.listPrice - it.unitPrice) / it.listPrice) * 100)
            : 0;
        await tx.auditLog.create({
          data: {
            companyId,
            userId,
            action: 'pos.price_override',
            entityType: 'POS_SALE',
            entityId: sale.id,
            newData: {
              saleNumber,
              productName: it.productNameSnapshot,
              listPrice: it.listPrice,
              unitPrice: it.unitPrice,
              discountPercent: discountPct,
            } as Prisma.InputJsonValue,
          },
        });
      }

      return sale;
    });
  }

  async update(
    id: string,
    companyId: string,
    userId: string,
    dto: UpdatePosSaleDto,
  ) {
    const existing = await this.prisma.posSale.findFirst({
      where: { id, companyId },
      select: { id: true, status: true, discountAmount: true, currency: true },
    });
    if (!existing) throw new NotFoundException('Sotuv topilmadi');
    if (existing.status !== 'DRAFT') {
      throw new BadRequestException('Faqat DRAFT holatidagi chekni o\'zgartirish mumkin');
    }

    return this.prisma.$transaction(async (tx) => {
      let resolved: Awaited<ReturnType<typeof this.resolveItems>> | null = null;
      if (dto.items !== undefined) {
        resolved = await this.resolveItems(companyId, userId, dto.items, tx);
        await tx.posSaleItem.deleteMany({ where: { saleId: id } });
        if (resolved.length > 0) {
          await tx.posSaleItem.createMany({
            data: resolved.map((it) => ({
              saleId: id,
              productVariantId: it.productVariantId,
              productNameSnapshot: it.productNameSnapshot,
              skuSnapshot: it.skuSnapshot,
              barcodeSnapshot: it.barcodeSnapshot,
              quantity: it.quantity,
              listPrice: it.listPrice,
              unitPrice: it.unitPrice,
              lineTotal: it.lineTotal,
            })),
          });
        }
      } else {
        const existingItems = await tx.posSaleItem.findMany({
          where: { saleId: id },
          select: { lineTotal: true },
        });
        resolved = existingItems.map((it) => ({
          productVariantId: '',
          productNameSnapshot: '',
          skuSnapshot: null,
          barcodeSnapshot: null,
          quantity: 0,
          listPrice: 0,
          unitPrice: 0,
          lineTotal: this.toMoney(it.lineTotal),
          currency: this.normalizeCurrency(existing.currency),
        }));
      }

      const newDiscount =
        dto.discountAmount !== undefined
          ? Number(dto.discountAmount)
          : this.toMoney(existing.discountAmount);

      const { subtotal, total, discount } = this.calcTotals(resolved!, newDiscount);
      const currency =
        dto.items !== undefined
          ? this.resolveSaleCurrency(resolved!)
          : this.normalizeCurrency(existing.currency);

      const customerPatch =
        dto.retailCustomerId !== undefined ||
        dto.customerName !== undefined ||
        dto.customerPhone !== undefined
          ? await this.retailCustomersService.resolveForSale(
              companyId,
              dto.retailCustomerId,
              dto.customerName,
              dto.customerPhone,
            )
          : null;

      return tx.posSale.update({
        where: { id },
        data: {
          subtotal,
          discountAmount: discount,
          totalAmount: total,
          ...(dto.note !== undefined ? { note: dto.note } : {}),
          currency,
          ...(customerPatch
            ? {
                retailCustomerId: customerPatch.retailCustomerId,
                customerNameSnapshot: customerPatch.customerNameSnapshot,
                customerPhoneSnapshot: customerPatch.customerPhoneSnapshot,
              }
            : {}),
        },
        include: {
          items: true,
          retailCustomer: { select: { id: true, name: true, phone: true } },
        },
      });
    });
  }

  private async assertCreditMethodAllowed(
    companyId: string,
    userId: string,
    method: string,
  ) {
    if (method !== 'CREDIT') return;
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
      throw new ForbiddenException(
        'Nasiya sotuv uchun ruxsat yo‘q (Jamoa → rol sozlamalari).',
      );
    }
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { posCreditEnabled: true },
    });
    if (!company?.posCreditEnabled) {
      throw new BadRequestException(
        'Nasiya sotuv kompaniyada yoqilmagan. Sozlamalar → Kompaniya.',
      );
    }
  }

  /**
   * POS: bitta HTTP — chek yaratish + stock chiqim + to‘lov (DRAFT bosqichi yo‘q).
   */
  async quickCheckout(
    companyId: string,
    userId: string,
    dto: QuickCheckoutPosSaleDto,
  ) {
    const items = dto.items ?? [];
    if (!items.length) {
      throw new BadRequestException('Savat bo\'sh');
    }

    const method = dto.method || 'CASH';

    const [warehouse, customer, priceCtx] = await Promise.all([
      this.prisma.warehouse.findFirst({
        where: { id: dto.warehouseId, companyId, status: 'ACTIVE' },
      }),
      this.retailCustomersService.resolveForSale(
        companyId,
        dto.retailCustomerId,
        dto.customerName,
        dto.customerPhone,
      ),
      this.loadPosPriceContext(this.prisma, companyId, userId),
    ]);
    if (!warehouse) throw new NotFoundException('Ombor topilmadi yoki aktiv emas');

    await Promise.all([
      this.assertWarehouseInScope(companyId, userId, dto.warehouseId),
      this.assertCreditMethodAllowed(companyId, userId, method),
    ]);

    if (method === 'CREDIT' && !customer.retailCustomerId) {
      throw new BadRequestException(
        'Nasiya (qarz) uchun mijoz tanlang yoki yangi mijoz qo‘shing.',
      );
    }

    const sale = await this.prisma.$transaction(async (tx) => {
      const resolved = await this.resolveItems(
        companyId,
        userId,
        items,
        tx,
        priceCtx,
      );
      const { subtotal, total, discount } = this.calcTotals(
        resolved,
        dto.discountAmount ?? 0,
      );

      let cashReceived = Number(dto.cashReceived ?? 0);
      let change = 0;
      if (method === 'CASH') {
        if (cashReceived < total) {
          throw new BadRequestException(
            `Berilgan naqd yetarli emas. Talab: ${total}, berilgan: ${cashReceived}`,
          );
        }
        change = this.round2(cashReceived - total);
      } else {
        cashReceived = 0;
        change = 0;
      }

      const saleNumber = await this.generateSaleNumber(companyId, tx);
      const currency = this.resolveSaleCurrency(resolved);

      const created = await tx.posSale.create({
        data: {
          companyId,
          warehouseId: dto.warehouseId,
          saleNumber,
          subtotal,
          discountAmount: discount,
          totalAmount: total,
          currency,
          status: 'COMPLETED',
          completedAt: new Date(),
          cashierId: userId,
          note: dto.note,
          retailCustomerId: customer.retailCustomerId,
          customerNameSnapshot: customer.customerNameSnapshot,
          customerPhoneSnapshot: customer.customerPhoneSnapshot,
          cashReceived: method === 'CASH' ? cashReceived : null,
          cashChange: method === 'CASH' ? change : null,
          items: {
            create: resolved.map((it) => ({
              productVariantId: it.productVariantId,
              productNameSnapshot: it.productNameSnapshot,
              skuSnapshot: it.skuSnapshot,
              barcodeSnapshot: it.barcodeSnapshot,
              quantity: it.quantity,
              listPrice: it.listPrice,
              unitPrice: it.unitPrice,
              lineTotal: it.lineTotal,
            })),
          },
        },
        include: { items: true },
      });

      await this.stockService.recordMovements(
        companyId,
        created.items.map((item) => ({
          warehouseId: dto.warehouseId,
          productVariantId: item.productVariantId,
          quantity: Number(item.quantity),
          sourceId: created.id,
          note: `POS sotuv ${saleNumber}`,
        })),
        'OUT',
        'POS_SALE',
        userId,
        tx,
      );

      const payment = await tx.posPayment.create({
        data: {
          saleId: created.id,
          method,
          amount: total,
          reference: method === 'CREDIT' ? 'NASIYA' : null,
        },
      });

      if (method === 'CREDIT' && customer.retailCustomerId) {
        await this.retailCustomersService.processCreditSale(tx, {
          companyId,
          retailCustomerId: customer.retailCustomerId,
          posSaleId: created.id,
          total,
          currency,
          userId,
          saleNumber,
        });
      }

      const priceAudits = resolved
        .filter((it) => it.unitPrice < it.listPrice - 0.001)
        .map((it) => {
          const discountPct =
            it.listPrice > 0
              ? this.round2(((it.listPrice - it.unitPrice) / it.listPrice) * 100)
              : 0;
          return {
            companyId,
            userId,
            action: 'pos.price_override',
            entityType: 'POS_SALE',
            entityId: created.id,
            newData: {
              saleNumber,
              productName: it.productNameSnapshot,
              listPrice: it.listPrice,
              unitPrice: it.unitPrice,
              discountPercent: discountPct,
            } as Prisma.InputJsonValue,
          };
        });
      if (priceAudits.length) {
        await tx.auditLog.createMany({ data: priceAudits });
      }

      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: 'pos.sale_completed',
          entityType: 'POS_SALE',
          entityId: created.id,
          newData: {
            saleNumber,
            total,
            cashReceived,
            cashChange: change,
            itemsCount: resolved.length,
            quickCheckout: true,
          } as any,
        },
      });

      return {
        ...created,
        payments: [payment],
        warehouse: { id: warehouse.id, name: warehouse.name },
      };
    }, POS_CHECKOUT_TX_OPTIONS);

    void this.invalidatePosCatalogCache(companyId, dto.warehouseId);
    this.notifyPosInventory(companyId, dto.warehouseId);
    if (method === 'CREDIT' && customer.retailCustomerId) {
      void this.retailCustomersService.invalidateCaches(
        companyId,
        customer.retailCustomerId,
      );
    }

    return sale;
  }

  async checkout(
    id: string,
    companyId: string,
    userId: string,
    dto: CheckoutPosSaleDto,
  ) {
    const sale = await this.prisma.posSale.findFirst({
      where: { id, companyId },
      include: { items: true },
    });
    if (!sale) throw new NotFoundException('Sotuv topilmadi');
    if (sale.status === 'COMPLETED') {
      throw new BadRequestException('Chek allaqachon yopilgan');
    }
    if (sale.status !== 'DRAFT') {
      throw new BadRequestException('Faqat DRAFT chekni yopish mumkin');
    }
    if (sale.items.length === 0) {
      throw new BadRequestException('Bo\'sh chekni yopib bo\'lmaydi');
    }

    const total = this.toMoney(sale.totalAmount);
    const method = dto.method || 'CASH';

    await this.assertCreditMethodAllowed(companyId, userId, method);

    const customer = await this.retailCustomersService.resolveForSale(
      companyId,
      dto.retailCustomerId ?? sale.retailCustomerId,
      dto.customerName ?? sale.customerNameSnapshot,
      dto.customerPhone ?? sale.customerPhoneSnapshot,
    );

    if (method === 'CREDIT' && !customer.retailCustomerId) {
      throw new BadRequestException(
        'Nasiya (qarz) uchun mijoz tanlang yoki yangi mijoz qo‘shing.',
      );
    }

    let cashReceived = Number(dto.cashReceived ?? 0);
    let change = 0;
    if (method === 'CASH') {
      if (cashReceived < total) {
        throw new BadRequestException(
          `Berilgan naqd yetarli emas. Talab: ${total}, berilgan: ${cashReceived}`,
        );
      }
      change = this.round2(cashReceived - total);
    } else {
      cashReceived = 0;
      change = 0;
    }

    const result = await this.prisma.$transaction(
      async (tx) => {
        await tx.posSale.update({
          where: { id: sale.id },
          data: {
            retailCustomerId: customer.retailCustomerId,
            customerNameSnapshot: customer.customerNameSnapshot,
            customerPhoneSnapshot: customer.customerPhoneSnapshot,
          },
        });

        await this.stockService.recordMovements(
          companyId,
          sale.items.map((item) => ({
            warehouseId: sale.warehouseId,
            productVariantId: item.productVariantId,
            quantity: Number(item.quantity),
            sourceId: sale.id,
            note: `POS sotuv ${sale.saleNumber}`,
          })),
          'OUT',
          'POS_SALE',
          userId,
          tx,
        );

        // 2. To'lov yozuvi
        await tx.posPayment.create({
          data: {
            saleId: sale.id,
            method,
            amount: total,
            reference: method === 'CREDIT' ? 'NASIYA' : null,
          },
        });

        if (method === 'CREDIT' && customer.retailCustomerId) {
          await this.retailCustomersService.processCreditSale(tx, {
            companyId,
            retailCustomerId: customer.retailCustomerId,
            posSaleId: sale.id,
            total,
            currency: sale.currency,
            userId,
            saleNumber: sale.saleNumber,
          });
        }

        // 3. Chekni yakunlash
        const updated = await tx.posSale.update({
          where: { id: sale.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            cashReceived: method === 'CASH' ? cashReceived : null,
            cashChange: method === 'CASH' ? change : null,
          },
          include: {
            items: true,
            payments: true,
            retailCustomer: { select: { id: true, name: true, phone: true } },
            warehouse: { select: { id: true, name: true } },
            cashier: { select: { id: true, fullName: true } },
          },
        });

        // 4. Audit
        await tx.auditLog.create({
          data: {
            companyId,
            userId,
            action: 'pos.sale_completed',
            entityType: 'POS_SALE',
            entityId: sale.id,
            newData: {
              saleNumber: sale.saleNumber,
              total,
              cashReceived,
              cashChange: change,
              itemsCount: sale.items.length,
            } as any,
          },
        });

        return updated;
      },
      POS_CHECKOUT_TX_OPTIONS,
    );

    void this.invalidatePosCatalogCache(companyId, sale.warehouseId);
    this.notifyPosInventory(companyId, sale.warehouseId);
    if (method === 'CREDIT' && customer.retailCustomerId) {
      void this.retailCustomersService.invalidateCaches(
        companyId,
        customer.retailCustomerId,
      );
    }

    return result;
  }

  async void(id: string, companyId: string, userId: string, dto: VoidPosSaleDto) {
    const sale = await this.prisma.posSale.findFirst({
      where: { id, companyId },
      include: { items: true },
    });
    if (!sale) throw new NotFoundException('Sotuv topilmadi');
    if (sale.status === 'VOIDED') {
      throw new BadRequestException('Chek allaqachon bekor qilingan');
    }

    return this.prisma.$transaction(
      async (tx) => {
        // Agar COMPLETED bo'lsa — stockni qaytaramiz (IN)
        if (sale.status === 'COMPLETED') {
          await this.stockService.recordMovements(
            companyId,
            sale.items.map((item) => ({
              warehouseId: sale.warehouseId,
              productVariantId: item.productVariantId,
              quantity: Number(item.quantity),
              sourceId: sale.id,
              note: `POS bekor qilish ${sale.saleNumber}`,
            })),
            'IN',
            'POS_VOID',
            userId,
            tx,
          );
          if (sale.retailCustomerId) {
            await this.retailCustomersService.reverseCreditSale(tx, {
              companyId,
              retailCustomerId: sale.retailCustomerId,
              posSaleId: sale.id,
              saleNumber: sale.saleNumber,
              userId,
            });
          }
        }

        const updated = await tx.posSale.update({
          where: { id: sale.id },
          data: {
            status: 'VOIDED',
            voidedAt: new Date(),
            voidedById: userId,
            voidReason: dto.reason ?? null,
          },
          include: { items: true, payments: true },
        });

        await tx.auditLog.create({
          data: {
            companyId,
            userId,
            action: 'pos.sale_voided',
            entityType: 'POS_SALE',
            entityId: sale.id,
            oldData: {
              status: sale.status,
              total: this.toMoney(sale.totalAmount),
            } as any,
            newData: {
              reason: dto.reason ?? null,
              stockReverted: sale.status === 'COMPLETED',
            } as any,
          },
        });

        return updated;
      },
      LONG_TX_OPTIONS,
    ).then((updated) => {
      if (sale.status === 'COMPLETED') {
        void this.invalidatePosCatalogCache(companyId, sale.warehouseId);
        this.notifyPosInventory(companyId, sale.warehouseId);
        if (sale.retailCustomerId) {
          void this.retailCustomersService.invalidateCaches(
            companyId,
            sale.retailCustomerId,
          );
        }
      }
      return updated;
    });
  }

  async remove(id: string, companyId: string, userId: string) {
    const sale = await this.prisma.posSale.findFirst({
      where: { id, companyId },
      select: { id: true, status: true, saleNumber: true },
    });
    if (!sale) throw new NotFoundException('Sotuv topilmadi');
    if (sale.status !== 'DRAFT') {
      throw new ForbiddenException(
        'Faqat DRAFT chekni o\'chirib bo\'ladi. COMPLETED chek faqat VOID qilinadi.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.posSaleItem.deleteMany({ where: { saleId: id } });
      await tx.posPayment.deleteMany({ where: { saleId: id } });
      await tx.posSale.delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: 'pos.sale_deleted_draft',
          entityType: 'POS_SALE',
          entityId: id,
          oldData: { saleNumber: sale.saleNumber } as any,
        },
      });
    });

    return { success: true };
  }
}
