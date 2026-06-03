import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateB2BOrderDto, UpdateDraftB2BOrderDto } from './dto/b2b-order.dto';
import { PartnersService } from '../partners/partners.service';
import { ProductMappingsService } from '../product-mappings/product-mappings.service';
import { AppCacheService } from '../../common/cache/app-cache.service';
import { InventoryGateway } from '../warehouses/inventory.gateway';
import { assertOrderLineCount, B2B_ORDER_MAX_LINE_ITEMS } from './b2b-order.limits';
import {
  parseListPagination,
  wantsFullList,
} from '../../common/list-pagination.util';

const orderItemsDetailSelect = {
  id: true,
  quantity: true,
  expectedPrice: true,
  expectedCurrency: true,
  productNameSnapshot: true,
  productVariantId: true,
  mappingStatus: true,
} as const;

@Injectable()
export class B2BOrdersService {
  private readonly hubStatsTtlMs = Number(process.env.ORDERS_HUB_CACHE_TTL_MS || 45 * 1000);

  constructor(
    private prisma: PrismaService,
    private partnersService: PartnersService,
    private mappingsService: ProductMappingsService,
    private cache: AppCacheService,
    private inventoryGateway: InventoryGateway,
  ) {}

  private hubStatsKey(companyId: string) {
    return `orders:hub:${companyId}`;
  }

  private listCachePrefix(companyId: string) {
    return `orders:list:${companyId}:`;
  }

  notifyOrderMutation(
    companyIds: Array<string | undefined | null>,
    meta?: { orderId?: string; reason?: string },
  ) {
    const unique = [...new Set(companyIds.map((id) => String(id || '').trim()).filter(Boolean))];
    for (const companyId of unique) {
      void this.cache.del(this.hubStatsKey(companyId));
      void this.cache.delByPrefix(this.listCachePrefix(companyId));
      try {
        this.inventoryGateway.emitOrdersChanged(companyId, meta);
        this.inventoryGateway.emitDashboardRefresh(companyId);
      } catch {
        // realtime ixtiyoriy
      }
    }
  }

  async getSellerCatalogForBuyer(
    buyerCompanyId: string,
    sellerCompanyId: string,
    search?: string,
  ) {
    if (!sellerCompanyId) {
      throw new BadRequestException('sellerCompanyId majburiy');
    }
    const partner = await this.partnersService.ensureActivePartner(buyerCompanyId, sellerCompanyId);
    const rawVisibility = (partner as any)?.warehouseVisibilityConfig;

    /** Eski: sotuvchi o'zi saqlaganda kalit sifatida sellerCompanyId; xaridor UI orqali saqlasa buyerCompanyId bo'lishi mumkin. */
    const rawVisibleIds = (() => {
      if (!rawVisibility || typeof rawVisibility !== 'object' || Array.isArray(rawVisibility)) return null;
      const o = rawVisibility as Record<string, unknown>;
      for (const key of [buyerCompanyId, sellerCompanyId]) {
        const v = o[key];
        if (!Array.isArray(v)) continue;
        const ids = v.filter((x): x is string => typeof x === 'string' && !!x.trim());
        if (ids.length) return ids;
      }
      return null;
    })();

    // Faqat aktiv omborlar (arxivlangan/o'chirilgan ID config'da qolgan bo'lsa ham)
    const visibleWarehouseIds = rawVisibleIds?.length
      ? (
          await this.prisma.warehouse.findMany({
            where: {
              companyId: sellerCompanyId,
              status: 'ACTIVE',
              id: { in: rawVisibleIds },
            },
            select: { id: true },
          })
        ).map((w) => w.id)
      : null;

    const q = search?.trim();

    const whereVariant: any = {
      companyId: sellerCompanyId,
      status: 'ACTIVE',
      product: { status: 'ACTIVE' },
    };

    const andClauses: any[] = [];

    // Ombor ko'rinishi faqat zaxira miqdorini cheklaydi — mahsulot/variant ro'yxatini yashirmaydi.

    if (q) {
      andClauses.push({
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { sku: { contains: q, mode: 'insensitive' } },
          { product: { name: { contains: q, mode: 'insensitive' } } },
        ],
      });
    }

    if (andClauses.length) {
      whereVariant.AND = andClauses;
    }

    const variants = await this.prisma.productVariant.findMany({
      where: whereVariant,
      take: 1000,
      orderBy: [{ product: { name: 'asc' } }, { name: 'asc' }],
      include: {
        product: { select: { id: true, name: true, imageUrl: true } },
        stockBalances: true,
      },
    });

    const colorFrom = (attributesJson: unknown): string | null => {
      if (!attributesJson || typeof attributesJson !== 'object') return null;
      const c = (attributesJson as Record<string, unknown>).color;
      if (c == null) return null;
      const s = String(c).trim();
      return s || null;
    };

    const imageUrlFromAttributes = (attributesJson: unknown): string | null => {
      if (!attributesJson || typeof attributesJson !== 'object') return null;
      const o = attributesJson as Record<string, unknown>;
      for (const k of ['imageUrl', 'image', 'photo', 'thumbnail']) {
        const v = o[k];
        if (typeof v === 'string' && v.trim().length > 0) return v.trim();
      }
      return null;
    };

    // Har bir mahsulot uchun eng yaxshi rasmni oldindan tanlash:
    // 1) Product.imageUrl bo'lsa shu, aks holda
    // 2) Variantlardan birortasining attributesJson.imageUrl
    const productImageMap = new Map<string, string>();
    for (const v of variants) {
      if (productImageMap.has(v.productId)) continue;
      const candidate =
        (v.product as any).imageUrl || imageUrlFromAttributes(v.attributesJson);
      if (candidate) productImageMap.set(v.productId, candidate);
    }

    const items = variants.map((v) => {
        const color = colorFrom(v.attributesJson);
        const imageUrl = productImageMap.get(v.productId) || null;
        return {
          productId: v.productId,
          productName: v.product.name,
          variantId: v.id,
          variantName: v.name,
          sku: v.sku,
          color,
          imageUrl,
          salePrice: Number(v.salePrice || 0),
          currency: (v.currency || 'UZS').toUpperCase(),
          quantity: v.stockBalances
            .filter((sb) => !visibleWarehouseIds?.length || visibleWarehouseIds.includes(sb.warehouseId))
            .reduce((sum, sb) => sum + Number(sb.quantity || 0), 0),
        };
      });

    return {
      sellerCompanyId,
      total: items.length,
      warehouseFilterActive: Boolean(visibleWarehouseIds?.length),
      items,
    };
  }

  async getSellerPriceSuggestion(
    buyerCompanyId: string,
    sellerCompanyId: string,
    productName: string,
  ) {
    if (!sellerCompanyId || !productName?.trim()) {
      return null;
    }

    await this.partnersService.ensureActivePartner(buyerCompanyId, sellerCompanyId);
    const query = productName.trim();

    const includeProduct = { product: { select: { name: true } } } as const;

    let byName = await this.prisma.productVariant.findFirst({
      where: {
        companyId: sellerCompanyId,
        status: 'ACTIVE',
        OR: [
          { product: { name: { equals: query, mode: 'insensitive' } } },
          { product: { name: { contains: query, mode: 'insensitive' } } },
          { name: { contains: query, mode: 'insensitive' } },
          { sku: { equals: query, mode: 'insensitive' } },
        ],
      },
      include: includeProduct,
      orderBy: { updatedAt: 'desc' },
    });

    // "Mahsulot - Variant" yoki "Mahsulot - Variant (rang)" kabi to'liq qator birinchi qadamda topilmasa — bo'laklarga ajratib qidirish
    if (!byName) {
      const segments = query
        .split(/\s*-\s*/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (segments.length >= 2) {
        const productPart = segments[0];
        const variantPart = segments[1].replace(/\s*\([^)]*\)\s*$/, '').trim();
        byName = await this.prisma.productVariant.findFirst({
          where: {
            companyId: sellerCompanyId,
            status: 'ACTIVE',
            product: { name: { contains: productPart, mode: 'insensitive' } },
            name: { contains: variantPart, mode: 'insensitive' },
          },
          include: includeProduct,
          orderBy: { updatedAt: 'desc' },
        });
      }
      if (!byName && segments.length >= 2) {
        const variantOnly = segments[1].replace(/\s*\([^)]*\)\s*$/, '').trim();
        byName = await this.prisma.productVariant.findFirst({
          where: {
            companyId: sellerCompanyId,
            status: 'ACTIVE',
            name: { contains: variantOnly, mode: 'insensitive' },
          },
          include: includeProduct,
          orderBy: { updatedAt: 'desc' },
        });
      }
    }

    if (!byName) return null;
    const expectedPrice = Number(byName.salePrice || 0);
    return {
      productVariantId: byName.id,
      productName: byName.product.name,
      variantName: byName.name,
      expectedPrice,
      expectedCurrency: (byName.currency || 'UZS') as 'UZS' | 'USD',
      /** @deprecated — eski frontend; expectedPrice ishlating */
      price: expectedPrice,
    };
  }


  async createOrder(companyId: string, userId: string, dto: CreateB2BOrderDto) {
    // 1. Ensure active partner
    await this.partnersService.ensureActivePartner(companyId, dto.sellerCompanyId);
    assertOrderLineCount(dto.items?.length ?? 0);

    const normalizedCurrencies = dto.items.map((item) => (item.expectedCurrency || 'UZS').toUpperCase());
    const uniqueCurrencies = Array.from(new Set(normalizedCurrencies));
    if (uniqueCurrencies.length > 1) {
      throw new BadRequestException('Bitta buyurtmadagi barcha mahsulotlar bir xil valyutada bo‘lishi kerak.');
    }

    const order = await this.prisma.b2BOrder.create({
      data: {
        buyerCompanyId: companyId,
        sellerCompanyId: dto.sellerCompanyId,
        status: 'DRAFT',
        expectedDeliveryDate: dto.expectedDeliveryDate ? new Date(dto.expectedDeliveryDate) : null,
        note: dto.note,
        createdBy: userId,
        items: {
          create: dto.items.map(item => ({
            productVariantId: item.productVariantId,
            productNameSnapshot: item.productName,
            quantity: item.quantity,
            expectedPrice: item.expectedPrice,
            expectedCurrency: (item.expectedCurrency || 'UZS').toUpperCase(),
            mappingStatus: item.productVariantId ? 'MAPPED' : 'PENDING'
          }))
        }
      },
      include: { items: true }
    });
    this.notifyOrderMutation([companyId, dto.sellerCompanyId], {
      orderId: order.id,
      reason: 'order.created',
    });
    return order;
  }

  async updateDraftOrder(id: string, companyId: string, dto: UpdateDraftB2BOrderDto) {
    const order = await this.findOne(id, companyId);
    if (order.buyerCompanyId !== companyId) {
      throw new BadRequestException('Faqat xaridor buyurtmani tahrirlashi mumkin');
    }
    if (order.status !== 'DRAFT') {
      throw new BadRequestException('Faqat DRAFT holatidagi buyurtmani tahrirlash mumkin');
    }
    if (!dto.items?.length) {
      throw new BadRequestException('Kamida bitta mahsulot kerak');
    }
    assertOrderLineCount(dto.items.length);

    const normalizedCurrencies = dto.items.map((item) => (item.expectedCurrency || 'UZS').toUpperCase());
    const uniqueCurrencies = Array.from(new Set(normalizedCurrencies));
    if (uniqueCurrencies.length > 1) {
      throw new BadRequestException('Bitta buyurtmadagi barcha mahsulotlar bir xil valyutada bo‘lishi kerak.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.b2BOrderItem.deleteMany({ where: { orderId: id } });

      return tx.b2BOrder.update({
        where: { id },
        data: {
          expectedDeliveryDate: dto.expectedDeliveryDate ? new Date(dto.expectedDeliveryDate) : null,
          note: dto.note,
          items: {
            create: dto.items.map((item) => ({
              productVariantId: item.productVariantId,
              productNameSnapshot: item.productName,
              quantity: item.quantity,
              expectedPrice: item.expectedPrice,
              expectedCurrency: (item.expectedCurrency || 'UZS').toUpperCase(),
              mappingStatus: item.productVariantId ? 'MAPPED' : 'PENDING',
            })),
          },
        },
        include: { items: true },
      });
    });
    this.notifyOrderMutation([companyId, order.sellerCompanyId], {
      orderId: id,
      reason: 'order.draft_updated',
    });
    return updated;
  }

  /** 80 tadan ko‘p qator bo‘lsa tafsilotda sahifalab yuklanadi (findOrderItemsPage). */
  readonly orderDetailInlineItemsMax = 80;

  async findOne(id: string, companyId: string) {
    const baseWhere = {
      id,
      OR: [{ buyerCompanyId: companyId }, { sellerCompanyId: companyId }],
    };

    const itemCount = await this.prisma.b2BOrderItem.count({ where: { orderId: id } });
    const inlineAllItems = itemCount <= this.orderDetailInlineItemsMax;

    const order = await this.prisma.b2BOrder.findFirst({
      where: baseWhere,
      include: {
        items: inlineAllItems
          ? { select: orderItemsDetailSelect, orderBy: { id: 'asc' } }
          : false,
        buyer: { select: { id: true, name: true, tin: true, phone: true, address: true } },
        seller: { select: { id: true, name: true, tin: true, phone: true, address: true } },
        _count: { select: { items: true } },
      },
    });
    if (!order) throw new NotFoundException('Buyurtma topilmadi');

    const unmappedItemCount = !inlineAllItems
      ? await this.prisma.b2BOrderItem.count({
          where: {
            orderId: id,
            OR: [{ mappingStatus: { not: 'MAPPED' } }, { productVariantId: null }],
          },
        })
      : undefined;

    const orderWithItems = {
      ...order,
      items: inlineAllItems ? order.items ?? [] : [],
      itemCount: itemCount || order._count?.items || 0,
      itemsPaginated: !inlineAllItems,
      maxLineItems: B2B_ORDER_MAX_LINE_ITEMS,
      unmappedItemCount,
      amountSummary: inlineAllItems
        ? undefined
        : await this.computeOrderAmountSummary(id),
    };

    const [enriched] = await this.attachDispatchSummaries([orderWithItems]);
    return enriched;
  }

  private async computeOrderAmountSummary(orderId: string) {
    const rows = await this.prisma.b2BOrderItem.findMany({
      where: { orderId },
      select: { quantity: true, expectedPrice: true, expectedCurrency: true },
    });
    const byCurrency: Record<string, number> = {};
    for (const row of rows) {
      const cur = String(row.expectedCurrency || 'UZS').toUpperCase() === 'USD' ? 'USD' : 'UZS';
      const line = Number(row.quantity) * Number(row.expectedPrice || 0);
      if (!Number.isFinite(line)) continue;
      byCurrency[cur] = (byCurrency[cur] || 0) + line;
    }
    return { lineCount: rows.length, byCurrency };
  }

  /** Katta buyurtmalar uchun qatorlarni sahifalab olish (tafsilot modali). */
  async findOrderItemsPage(
    id: string,
    companyId: string,
    query: { page?: string | number; limit?: string | number; search?: string; unmappedOnly?: string },
  ) {
    await this.findOneLight(id, companyId);

    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 100);
    const skip = (page - 1) * limit;
    const search = String(query.search || '').trim();
    const unmappedOnly = query.unmappedOnly === '1' || query.unmappedOnly === 'true';

    const where: Prisma.B2BOrderItemWhereInput = {
      orderId: id,
      ...(unmappedOnly
        ? { mappingStatus: { not: 'MAPPED' }, productVariantId: null }
        : {}),
      ...(search
        ? { productNameSnapshot: { contains: search, mode: 'insensitive' } }
        : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.b2BOrderItem.count({ where }),
      this.prisma.b2BOrderItem.findMany({
        where,
        select: orderItemsDetailSelect,
        orderBy: { id: 'asc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      items: rows,
      page,
      limit,
      total,
      hasMore: skip + rows.length < total,
      maxLineItems: B2B_ORDER_MAX_LINE_ITEMS,
    };
  }

  /** Jo‘natilgan miqdorlarni buyurtma qatorlariga bog‘lash (qisman jo‘natma) */
  async attachDispatchSummaries<
    T extends {
      id: string;
      status: string;
      items: Array<{
        quantity: unknown;
        expectedPrice?: unknown | null;
        productVariantId?: string | null;
      }>;
    },
  >(orders: T[]) {
    const orderIds = orders
      .filter((o) =>
        ['DISPATCHED', 'PARTIALLY_DISPATCHED', 'RECEIVED', 'PARTIALLY_ACCEPTED'].includes(o.status),
      )
      .map((o) => o.id);
    if (!orderIds.length) return orders;

    const dispatchRows = await this.prisma.dispatchItem.findMany({
      where: {
        dispatch: { orderId: { in: orderIds }, status: 'SENT' },
      },
      select: {
        productVariantId: true,
        quantity: true,
        dispatch: { select: { orderId: true, dispatchNumber: true, sentAt: true } },
      },
    });

    const qtyByOrderVariant = new Map<string, Map<string, number>>();
    const latestDispatchByOrder = new Map<string, { dispatchNumber: string; sentAt: Date | null }>();

    for (const row of dispatchRows) {
      const orderId = row.dispatch.orderId;
      if (!qtyByOrderVariant.has(orderId)) {
        qtyByOrderVariant.set(orderId, new Map());
      }
      const m = qtyByOrderVariant.get(orderId)!;
      const q = Number(row.quantity);
      m.set(row.productVariantId, (m.get(row.productVariantId) || 0) + q);

      const prev = latestDispatchByOrder.get(orderId);
      const sentAt = row.dispatch.sentAt;
      if (!prev || (sentAt && (!prev.sentAt || sentAt > prev.sentAt))) {
        latestDispatchByOrder.set(orderId, {
          dispatchNumber: row.dispatch.dispatchNumber,
          sentAt: sentAt ?? null,
        });
      }
    }

    return orders.map((order) => {
      const variantQty = qtyByOrderVariant.get(order.id);
      if (!variantQty) return order;

      const items = order.items.map((item) => {
        const orderedQuantity = Number(item.quantity);
        const dispatchedQuantity = item.productVariantId
          ? variantQty.get(item.productVariantId) ?? 0
          : 0;
        return {
          ...item,
          orderedQuantity,
          dispatchedQuantity,
          remainingToDispatch: Math.max(0, orderedQuantity - dispatchedQuantity),
        };
      });

      const dispatchedTotalAmount = items.reduce(
        (sum, item) =>
          sum + Number(item.dispatchedQuantity || 0) * Number(item.expectedPrice || 0),
        0,
      );
      const isPartialDispatch = items.some(
        (item) => Number(item.dispatchedQuantity || 0) < Number(item.orderedQuantity || item.quantity),
      );
      const canDispatchMore = items.some((item) => Number(item.remainingToDispatch || 0) > 0);

      return {
        ...order,
        items,
        hasDispatch: true,
        isPartialDispatch,
        canDispatchMore,
        dispatchedTotalAmount,
        latestDispatch: latestDispatchByOrder.get(order.id) || null,
      };
    });
  }

  /** Qabul/yuborish — yengil include */
  async findOneLight(id: string, companyId: string) {
    const order = await this.prisma.b2BOrder.findFirst({
      where: {
        id,
        OR: [{ buyerCompanyId: companyId }, { sellerCompanyId: companyId }],
      },
      include: {
        items: {
          select: {
            id: true,
            quantity: true,
            expectedPrice: true,
            expectedCurrency: true,
            productNameSnapshot: true,
            productVariantId: true,
            mappingStatus: true,
          },
        },
        buyer: { select: { id: true, name: true } },
        seller: { select: { id: true, name: true } },
      },
    });
    if (!order) throw new NotFoundException('Buyurtma topilmadi');
    return order;
  }

  private buildOrderListWhere(
    companyId: string,
    role: 'BUYER' | 'SELLER',
    query?: { search?: string; status?: string },
  ) {
    const search = String(query?.search || '').trim();
    const status = String(query?.status || '').trim();

    const where: any =
      role === 'BUYER'
        ? { buyerCompanyId: companyId }
        : {
            sellerCompanyId: companyId,
            status: { not: 'DRAFT' },
          };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { buyer: { name: { contains: search, mode: 'insensitive' } } },
        { seller: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    return where;
  }

  private orderListInclude() {
    return {
      buyer: { select: { name: true, tin: true } },
      seller: { select: { name: true, tin: true } },
      _count: { select: { items: true } },
      items: {
        select: {
          id: true,
          quantity: true,
          expectedPrice: true,
          expectedCurrency: true,
          productNameSnapshot: true,
          productVariantId: true,
          mappingStatus: true,
        },
      },
    } as const;
  }

  private mapOrdersForList<T extends { items: Array<{ expectedCurrency: string | null }> }>(
    orders: T[],
  ) {
    return orders.map((order) => {
      const cur =
        order.items.find((i) => i.expectedCurrency)?.expectedCurrency || 'UZS';
      return {
        ...order,
        displayCurrency: String(cur).toUpperCase() === 'USD' ? 'USD' : 'UZS',
      };
    });
  }

  async getListStats(companyId: string, role: 'BUYER' | 'SELLER') {
    const baseWhere =
      role === 'BUYER'
        ? { buyerCompanyId: companyId }
        : { sellerCompanyId: companyId, status: { not: 'DRAFT' } };

    const grouped = await this.prisma.b2BOrder.groupBy({
      by: ['status'],
      where: baseWhere,
      _count: { _all: true },
    });
    const byStatus: Record<string, number> = {};
    for (const row of grouped) {
      byStatus[row.status] = row._count._all;
    }

    let mappingNeeded = 0;
    if (role === 'SELLER') {
      mappingNeeded = await this.prisma.b2BOrder.count({
        where: {
          sellerCompanyId: companyId,
          status: { not: 'DRAFT' },
          items: {
            some: {
              mappingStatus: { not: 'MAPPED' },
              productVariantId: null,
            },
          },
        },
      });
    }

    return {
      sent: byStatus.SENT ?? 0,
      accepted: byStatus.ACCEPTED ?? 0,
      inProgress: byStatus.IN_PROGRESS ?? 0,
      completed: byStatus.COMPLETED ?? 0,
      rejected: byStatus.REJECTED ?? 0,
      cancelled: byStatus.CANCELLED ?? 0,
      mappingNeeded,
    };
  }

  async getOrdersHubStats(companyId: string) {
    const key = this.hubStatsKey(companyId);
    const cached = await this.cache.getJson<{ my: unknown; incoming: unknown }>(key);
    if (cached) return cached;

    const [my, incoming] = await Promise.all([
      this.getListStats(companyId, 'BUYER'),
      this.getListStats(companyId, 'SELLER'),
    ]);
    const data = { my, incoming };
    await this.cache.setJson(key, data, this.hubStatsTtlMs);
    return data;
  }

  async findAll(
    companyId: string,
    role: 'BUYER' | 'SELLER',
    query?: {
      search?: string;
      status?: string;
      limit?: string | number;
      page?: string | number;
      all?: string | boolean;
      full?: string | boolean;
    },
  ) {
    const where = this.buildOrderListWhere(companyId, role, query);
    const include = this.orderListInclude();
    const orderBy = { createdAt: 'desc' as const };

    if (wantsFullList(query)) {
      const rows = await this.prisma.b2BOrder.findMany({ where, include, orderBy });
      const mapped = this.mapOrdersForList(rows);
      return this.attachDispatchSummaries(mapped);
    }

    const { page, limit, skip } = parseListPagination(query, {
      limit: 30,
      maxLimit: 100,
    });
    const search = String(query?.search || '').trim();
    const status = String(query?.status || '').trim();
    const cacheKey = `${this.listCachePrefix(companyId)}${role}:${page}:${limit}:${search}:${status}`;
    const cached = await this.cache.getJson<{
      items: unknown[];
      page: number;
      limit: number;
      total: number;
      hasMore: boolean;
    }>(cacheKey);
    if (cached) return cached;

    const [total, rows] = await Promise.all([
      this.prisma.b2BOrder.count({ where }),
      this.prisma.b2BOrder.findMany({
        where,
        include,
        orderBy,
        skip,
        take: limit,
      }),
    ]);

    const mappedItems = await this.attachDispatchSummaries(this.mapOrdersForList(rows));

    const result = {
      items: mappedItems,
      page,
      limit,
      total,
      hasMore: skip + mappedItems.length < total,
    };
    await this.cache.setJson(cacheKey, result, 20_000);
    return result;
  }
}
