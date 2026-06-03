import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StockService } from '../warehouses/stock.service';
import { ProductMappingsService } from '../product-mappings/product-mappings.service';
import {
  collectInboundSkuCandidates,
  findVariantBySkuCodes,
  parseSnapshotParts,
} from '../../common/product-code.util';
import {
  toFiniteMoney,
  getOwnVariantIdFromMapping,
  parseReceiptSnapshot,
} from './goods-receipt.shared';
import { parseListPagination } from '../../common/list-pagination.util';

@Injectable()
export class GoodsReceiptsService {
  constructor(
    private prisma: PrismaService,
    private stockService: StockService,
    private mappingsService: ProductMappingsService,
  ) {}

  /** Faqat mavjud katalogdan tavsiya — avval SKU/barcode, keyin aniq variant nomi */
  private suggestOwnVariantFromCatalog(
    ownVariants: Array<{
      id: string;
      name: string;
      sku: string | null;
      barcode: string | null;
      product: { name: string };
    }>,
    snapshot: string,
    sellerVariant?: { sku?: string | null; barcode?: string | null } | null,
  ): string | null {
    const skuCodes = collectInboundSkuCandidates(snapshot, sellerVariant);
    const byCode = findVariantBySkuCodes(ownVariants, skuCodes);
    if (byCode) return byCode.id;

    const { baseName, variantLabel } = parseReceiptSnapshot(snapshot);
    const labelLower = variantLabel.toLowerCase();

    if (variantLabel) {
      const baseLower = baseName.toLowerCase();
      const matches = ownVariants.filter((v) => {
        const productName = v.product.name.trim().toLowerCase();
        if (baseLower && baseLower !== productName) return false;
        const n = v.name.trim().toLowerCase();
        return n === labelLower;
      });
      if (matches.length === 1) return matches[0].id;
    }

    if (!variantLabel) {
      const baseLower = baseName.toLowerCase();
      const byProduct = ownVariants.find(
        (v) => v.product.name.trim().toLowerCase() === baseLower,
      );
      if (byProduct) return byProduct.id;
    }

    return null;
  }

  /** Qabul modali: SKU va mapping variantlari — butun katalogni yuklamasdan */
  private async loadOwnVariantsForReceiptPreview(
    receipt: {
      items: Array<{ productNameSnapshot: string; quantity: unknown; productVariantId?: string | null }>;
      order: Parameters<GoodsReceiptsService['resolveOrderItemForReceiptLine']>[0]['order'];
      dispatch?: { items: Array<{ productVariantId: string; productNameSnapshot: string; quantity: unknown }> } | null;
    },
    companyId: string,
    sellerById: Map<string, { sku: string | null; barcode: string | null }>,
    sellerVariantIds: Set<string>,
    partnerMappings: Array<{ ownProductVariantId: string }>,
  ) {
    const allSkuCodes = new Set<string>();
    for (const item of receipt.items) {
      const sellerVariantId = this.resolveSellerVariantIdForReceiptLine(
        receipt,
        item,
        sellerVariantIds,
      );
      const sellerLine = sellerVariantId ? sellerById.get(sellerVariantId) : undefined;
      for (const code of collectInboundSkuCandidates(item.productNameSnapshot, sellerLine)) {
        allSkuCodes.add(code);
      }
    }

    const variantSelect = {
      id: true,
      name: true,
      sku: true,
      barcode: true,
      product: { select: { name: true } },
    } as const;

    const bySku =
      allSkuCodes.size > 0
        ? await this.prisma.productVariant.findMany({
            where: {
              companyId,
              status: 'ACTIVE',
              OR: [
                { sku: { in: [...allSkuCodes] } },
                { barcode: { in: [...allSkuCodes] } },
              ],
            },
            select: variantSelect,
          })
        : [];

    const mappingVariantIds = [
      ...new Set(partnerMappings.map((m) => m.ownProductVariantId).filter(Boolean)),
    ];
    const missingMappingIds = mappingVariantIds.filter((id) => !bySku.some((v) => v.id === id));
    const byMapping =
      missingMappingIds.length > 0
        ? await this.prisma.productVariant.findMany({
            where: { companyId, id: { in: missingMappingIds } },
            select: variantSelect,
          })
        : [];

    const merged = new Map<string, (typeof bySku)[number]>();
    for (const v of [...bySku, ...byMapping]) merged.set(v.id, v);
    return [...merged.values()];
  }

  /** Qabul qatori → jo‘natma qatori (sotuvchi variant ID) */
  resolveDispatchItemForReceiptLine(
    receipt: {
      dispatch?: {
        items: Array<{
          productVariantId: string;
          productNameSnapshot: string;
          quantity: unknown;
        }>;
      } | null;
    },
    receiptItem: { productNameSnapshot: string; quantity: unknown; productVariantId?: string | null },
    sellerVariantIds?: Set<string>,
  ) {
    const dispatchItems = receipt.dispatch?.items;
    if (!dispatchItems?.length) return null;

    if (
      receiptItem.productVariantId &&
      (!sellerVariantIds || sellerVariantIds.has(receiptItem.productVariantId))
    ) {
      const byId = dispatchItems.find((di) => di.productVariantId === receiptItem.productVariantId);
      if (byId) return byId;
    }

    const normalizedName = receiptItem.productNameSnapshot.trim();
    const qtyNum = toFiniteMoney(receiptItem.quantity);
    const sameName = dispatchItems.filter((di) => di.productNameSnapshot.trim() === normalizedName);
    if (sameName.length === 1) return sameName[0];
    return sameName.find((di) => toFiniteMoney(di.quantity) === qtyNum) ?? sameName[0] ?? null;
  }

  /**
   * Qabul qatoridagi variant ID ba’zan xaridor (A-001) varianti bo‘lib qoladi.
   * Faqat sotuvchi kompaniyasiga tegishli ID ni qaytaramiz — jo‘natma/buyurtmadan.
   */
  resolveSellerVariantIdForReceiptLine(
    receipt: Parameters<typeof this.resolveOrderItemForReceiptLine>[0],
    item: { productVariantId?: string | null; productNameSnapshot: string; quantity: unknown },
    sellerVariantIds: Set<string>,
  ): string | null {
    const dispatchLine = this.resolveDispatchItemForReceiptLine(receipt, item, sellerVariantIds);
    const orderItem = this.resolveOrderItemForReceiptLine(receipt, item);
    const candidates = [
      dispatchLine?.productVariantId,
      orderItem?.productVariantId,
      item.productVariantId,
    ].filter((id): id is string => Boolean(id));

    for (const id of candidates) {
      if (sellerVariantIds.has(id)) return id;
    }
    return null;
  }

  attachOrderPricingToReceiptItems(receipt: {
    items: Array<{
      id: string;
      productNameSnapshot: string;
      quantity: unknown;
      productVariantId?: string | null;
      [key: string]: unknown;
    }>;
    order: {
      items: Array<{
        productVariantId: string | null;
        productNameSnapshot: string;
        quantity: unknown;
        expectedPrice?: unknown | null;
        expectedCurrency?: string | null;
      }>;
    };
    dispatch?: {
      items: Array<{ productVariantId: string; productNameSnapshot: string; quantity: unknown }>;
    } | null;
  }) {
    return receipt.items.map((item) => {
      const orderItem = this.resolveOrderItemForReceiptLine(receipt, item);
      return {
        ...item,
        expectedPrice: toFiniteMoney(orderItem?.expectedPrice),
        expectedCurrency: orderItem?.expectedCurrency || 'UZS',
      };
    });
  }

  async enrichReceiptItemsWithMappings(
    receipt: {
      sellerCompanyId: string;
      items: Array<{
        id: string;
        productNameSnapshot: string;
        quantity: unknown;
        productVariantId?: string | null;
      }>;
      order: {
        items: Array<{
          productVariantId: string | null;
          productNameSnapshot: string;
          quantity: unknown;
          expectedPrice?: unknown | null;
          expectedCurrency?: string | null;
        }>;
      };
      dispatch?: { items: Array<{ productVariantId: string; productNameSnapshot: string; quantity: unknown }> } | null;
    },
    companyId: string,
    options?: { lite?: boolean },
  ) {
    const lite = options?.lite === true;
    const partnerMappings = await this.mappingsService.findActiveForPartnerLite(
      companyId,
      receipt.sellerCompanyId,
    );

    const sellerVariantIdCandidates = new Set<string>();
    for (const oi of receipt.order.items) {
      if (oi.productVariantId) sellerVariantIdCandidates.add(oi.productVariantId);
    }
    for (const di of receipt.dispatch?.items ?? []) {
      sellerVariantIdCandidates.add(di.productVariantId);
    }
    for (const ri of receipt.items) {
      if (ri.productVariantId) sellerVariantIdCandidates.add(ri.productVariantId);
    }

    const sellerVariants =
      sellerVariantIdCandidates.size > 0
        ? await this.prisma.productVariant.findMany({
            where: {
              id: { in: [...sellerVariantIdCandidates] },
              companyId: receipt.sellerCompanyId,
            },
            select: {
              id: true,
              sku: true,
              barcode: true,
              product: { select: { name: true } },
            },
          })
        : [];
    const sellerById = new Map(sellerVariants.map((v) => [v.id, v]));
    const sellerVariantIds = new Set(sellerVariants.map((v) => v.id));

    const ownVariants = lite
      ? []
      : await this.loadOwnVariantsForReceiptPreview(
          receipt,
          companyId,
          sellerById,
          sellerVariantIds,
          partnerMappings,
        );

    const normalizeProductKey = (name: string) =>
      String(name || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');

    return receipt.items.map((item) => {
      const orderItem = this.resolveOrderItemForReceiptLine(receipt, item, sellerVariantIds);
      const sellerVariantId = this.resolveSellerVariantIdForReceiptLine(
        receipt,
        item,
        sellerVariantIds,
      );

      const sellerLine = sellerVariantId ? sellerById.get(sellerVariantId) : undefined;

      let mapping: (typeof partnerMappings)[number] | null = null;
      if (sellerVariantId) {
        mapping = partnerMappings.find((m) => m.partnerSku === sellerVariantId) ?? null;
        if (!mapping && sellerLine) {
          mapping =
            this.mappingsService.resolveMappingFromList(partnerMappings, {
              partnerProductName: item.productNameSnapshot.trim(),
              partnerSkuCode: sellerLine.sku?.trim() || undefined,
              partnerBarcode: sellerLine.barcode?.trim() || undefined,
              partnerSellerVariantId: sellerVariantId,
            }) ?? null;
        }
      } else {
        mapping = this.mappingsService.resolveMappingFromList(partnerMappings, {
          partnerProductName: item.productNameSnapshot.trim(),
          partnerSkuCode: sellerLine?.sku?.trim() || undefined,
          partnerBarcode: sellerLine?.barcode?.trim() || undefined,
        });
      }

      // Nom bo‘yicha mapping faqat sellerVariantId yo‘q bo‘lganda tekshiriladi.
      // partnerSku = sotuvchi variant ID — barqaror kalit, nom farqi mappingni bekor qilmasin.
      if (mapping && !sellerVariantId) {
        const { baseName, variantLabel } = parseReceiptSnapshot(item.productNameSnapshot);
        const snapshotProduct = normalizeProductKey(baseName);
        const snapshotVariant = normalizeProductKey(variantLabel);
        const ownVariant = ownVariants.find((v) => v.id === mapping!.ownProductVariantId);
        const ownProduct = ownVariant
          ? normalizeProductKey(ownVariant.product.name)
          : '';
        const ownVariantName = ownVariant ? normalizeProductKey(ownVariant.name) : '';
        if (snapshotProduct && ownProduct && snapshotProduct !== ownProduct) {
          mapping = null;
        } else if (
          snapshotVariant &&
          ownVariantName &&
          snapshotVariant !== ownVariantName
        ) {
          mapping = null;
        }
      }

      const ownVariantId = mapping?.ownProductVariantId || null;
      const suggestedVariantId =
        ownVariantId ||
        (lite
          ? null
          : this.suggestOwnVariantFromCatalog(
              ownVariants,
              item.productNameSnapshot,
              sellerLine,
            ));

      const resolvedOwnVariantId = suggestedVariantId || ownVariantId;

      return {
        ...item,
        mapping,
        suggestedVariantId: resolvedOwnVariantId,
        sellerVariantId,
        inboundStatus:
          mapping || resolvedOwnVariantId ? ('EXISTING' as const) : ('AUTO_NEW' as const),
        expectedPrice: toFiniteMoney(orderItem?.expectedPrice),
        expectedCurrency: orderItem?.expectedCurrency || 'UZS',
      };
    });
  }

  /**
   * Qabul qatori → buyurtma qatori: avval jo‘natmadagi sotuvchi variant ID bo‘yicha (nom farq qilishi mumkin),
   * keyin aniq nom, so‘ng qisman moslash.
   */
  /** Buyurtma miqdori bilan solishtirganda bu jo‘natma qismanmi */
  private attachShipmentSummary<
    T extends {
      items: Array<{ quantity: unknown; productNameSnapshot: string }>;
      order: {
        items: Array<{
          productVariantId: string | null;
          productNameSnapshot: string;
          quantity: unknown;
        }>;
      };
      dispatch?: {
        items: Array<{ productVariantId: string; productNameSnapshot: string; quantity: unknown }>;
      } | null;
    },
  >(receipt: T) {
    const items = receipt.items.map((item) => {
      const orderItem = this.resolveOrderItemForReceiptLine(receipt, item);
      const orderedQuantity = toFiniteMoney(orderItem?.quantity);
      const shippedQuantity = toFiniteMoney(item.quantity);
      const isPartialLine =
        orderedQuantity > 0 && shippedQuantity > 0 && shippedQuantity < orderedQuantity;
      return {
        ...item,
        orderedQuantity,
        shippedQuantity,
        isPartialLine,
      };
    });
    const isPartialShipment = items.some((i) => i.isPartialLine);
    const isPartialAcceptance =
      (receipt as { status?: string }).status === 'PARTIALLY_ACCEPTED' ||
      items.some((i) => {
        const shipped = toFiniteMoney((i as { quantity?: unknown }).quantity);
        const received = toFiniteMoney(
          (i as { receivedQuantity?: unknown }).receivedQuantity ?? (i as { quantity?: unknown }).quantity,
        );
        return shipped > 0 && received < shipped;
      });
    return { ...receipt, items, isPartialShipment, isPartialAcceptance };
  }

  resolveOrderItemForReceiptLine(
    receipt: {
      order: {
        items: Array<{
          productVariantId: string | null;
          productNameSnapshot: string;
          quantity: unknown;
          expectedPrice?: unknown | null;
          expectedCurrency?: string | null;
        }>;
      };
      dispatch?: { items: Array<{ productVariantId: string; productNameSnapshot: string; quantity: unknown }> } | null;
    },
    receiptItem: {
      productNameSnapshot: string;
      quantity: unknown;
      productVariantId?: string | null;
    },
    sellerVariantIds?: Set<string>,
  ) {
    const normalizedName = receiptItem.productNameSnapshot.trim();
    const qtyNum = toFiniteMoney(receiptItem.quantity);

    const dispatchLine = this.resolveDispatchItemForReceiptLine(
      receipt,
      receiptItem,
      sellerVariantIds,
    );
    if (dispatchLine?.productVariantId) {
      const byDispatchVariant = receipt.order.items.find(
        (oi) => oi.productVariantId === dispatchLine.productVariantId,
      );
      if (byDispatchVariant) return byDispatchVariant;
    }

    if (receiptItem.productVariantId) {
      const byReceiptVariant = receipt.order.items.find(
        (oi) => oi.productVariantId === receiptItem.productVariantId,
      );
      if (byReceiptVariant) return byReceiptVariant;
    }

    const orderItems = receipt.order.items;
    const exactMatches = orderItems.filter(
      (oi) => oi.productNameSnapshot.trim().toLowerCase() === normalizedName.toLowerCase(),
    );
    if (exactMatches.length === 1) return exactMatches[0];
    if (exactMatches.length > 1) {
      return (
        exactMatches.find((oi) => toFiniteMoney(oi.quantity) === qtyNum) ?? exactMatches[0]
      );
    }

    return undefined;
  }

  /**
   * B2B yuk qabulida kelgan birlik narxi (buyurtma qatori) → xaridor katalogidagi kirim narxi.
   * `currency` faqat sotuv narxi hali 0 yoki variant valyutasi yuk bilan mos bo‘lsa yangilanadi — aks holda
   * faqat `purchasePrice` (sotuv valyutasi bilan UI bir xil qatorda ko‘rinadi).
   */

  private receiptListWhere(
    companyId: string,
    role: 'BUYER' | 'SELLER',
    query?: { status?: string; search?: string },
  ): Prisma.GoodsReceiptWhereInput {
    const base: Prisma.GoodsReceiptWhereInput =
      role === 'BUYER' ? { buyerCompanyId: companyId } : { sellerCompanyId: companyId };

    const status = String(query?.status || '').trim().toUpperCase();
    if (status) {
      (base as Prisma.GoodsReceiptWhereInput).status = status as any;
    }

    const search = String(query?.search || '').trim();
    if (search) {
      base.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { sellerCompany: { name: { contains: search, mode: 'insensitive' } } },
        { buyerCompany: { name: { contains: search, mode: 'insensitive' } } },
        { sellerCompany: { tin: { contains: search, mode: 'insensitive' } } },
      ];
    }

    return base;
  }

  private receiptListInclude() {
    const lineSelect = {
      id: true,
      quantity: true,
      receivedQuantity: true,
      productNameSnapshot: true,
      productVariantId: true,
    } as const;
    const orderLineSelect = {
      productVariantId: true,
      productNameSnapshot: true,
      quantity: true,
      expectedPrice: true,
      expectedCurrency: true,
    } as const;
    /** DispatchItem — narx faqat buyurtma qatorida (B2BOrderItem). */
    const dispatchLineSelect = {
      productVariantId: true,
      productNameSnapshot: true,
      quantity: true,
    } as const;

    return {
      buyerCompany: { select: { name: true } },
      sellerCompany: { select: { name: true, tin: true } },
      order: { select: { items: { select: orderLineSelect } } },
      dispatch: { select: { items: { select: dispatchLineSelect } } },
      items: { select: lineSelect },
    };
  }

  private mapReceiptListRow(receipt: any) {
    const withShipment = this.attachShipmentSummary(receipt);
    const totalAmount = withShipment.items.reduce((sum: number, item: any) => {
      const orderItem = this.resolveOrderItemForReceiptLine(receipt, item);
      const price = toFiniteMoney(orderItem?.expectedPrice);
      return sum + toFiniteMoney(item.quantity) * price;
    }, 0);

    const displayCurrency =
      receipt.order?.items?.find((i: any) => i.expectedCurrency)?.expectedCurrency || 'UZS';

    return {
      ...withShipment,
      totalAmount,
      displayCurrency: String(displayCurrency).toUpperCase() === 'USD' ? 'USD' : 'UZS',
    };
  }

  private async receiptListSummary(companyId: string, role: 'BUYER' | 'SELLER') {
    const where = this.receiptListWhere(companyId, role);
    const rows = await this.prisma.goodsReceipt.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    });
    const counts = { pending: 0, accepted: 0, rejected: 0, other: 0 };
    for (const row of rows) {
      const n = row._count._all;
      if (row.status === 'PENDING') counts.pending += n;
      else if (row.status === 'REJECTED') counts.rejected += n;
      else if (['ACCEPTED', 'PARTIALLY_ACCEPTED'].includes(row.status)) counts.accepted += n;
      else counts.other += n;
    }
    return counts;
  }

  async findAll(
    companyId: string,
    role: 'BUYER' | 'SELLER',
    query?: { page?: string | number; limit?: string | number; status?: string; search?: string },
  ) {
    const { page, limit, skip } = parseListPagination(query, { limit: 30, maxLimit: 100 });
    const where = this.receiptListWhere(companyId, role, query);
    const include = this.receiptListInclude();

    const [total, receipts, summary] = await Promise.all([
      this.prisma.goodsReceipt.count({ where }),
      this.prisma.goodsReceipt.findMany({
        where,
        include,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.receiptListSummary(companyId, role),
    ]);

    const items = receipts.map((r) => this.mapReceiptListRow(r));

    return {
      items,
      page,
      limit,
      total,
      hasMore: skip + items.length < total,
      summary,
    };
  }

  /** Excel eksport — barcha qabullar (alohida og‘ir so‘rov). */
  async findAllForExport(companyId: string, role: 'BUYER' | 'SELLER') {
    const where = this.receiptListWhere(companyId, role);
    const receipts = await this.prisma.goodsReceipt.findMany({
      where,
      include: this.receiptListInclude(),
      orderBy: { createdAt: 'desc' },
    });
    return receipts.map((r) => this.mapReceiptListRow(r));
  }

  async findOne(
    id: string,
    companyId: string,
    query?: { mode?: 'view' | 'full'; page?: number; limit?: number },
  ) {
    const mode = query?.mode === 'full' ? 'full' : 'view';
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.min(Math.max(Number(query?.limit) || 50, 10), 200);

    const receipt = await this.prisma.goodsReceipt.findFirst({
      where: {
        id,
        OR: [{ buyerCompanyId: companyId }, { sellerCompanyId: companyId }],
      },
      include:
        mode === 'full'
          ? {
              items: {
                include: {
                  productVariant: {
                    include: {
                      product: { include: { category: true } },
                    },
                  },
                },
              },
              order: {
                include: {
                  items: {
                    include: {
                      productVariant: {
                        include: {
                          product: { include: { category: true } },
                        },
                      },
                    },
                  },
                },
              },
              dispatch: { include: { items: true } },
              buyerCompany: true,
              sellerCompany: true,
            }
          : {
              items: true,
              order: { include: { items: true } },
              dispatch: { include: { items: true } },
              buyerCompany: true,
              sellerCompany: true,
            },
    });

    if (!receipt) throw new NotFoundException('Qabul hujjati topilmadi');

    const itemsEnriched =
      mode === 'full'
        ? await this.enrichReceiptItemsWithMappings(receipt, companyId, { lite: false })
        : this.attachOrderPricingToReceiptItems(receipt);

    const withShipment = this.attachShipmentSummary({
      ...receipt,
      items: itemsEnriched,
    });

    const totalItems = withShipment.items.length;
    const needsPagination = mode === 'view' && totalItems > 80;
    const pageItems = needsPagination
      ? withShipment.items.slice((page - 1) * limit, page * limit)
      : withShipment.items;

    const inboundStock =
      receipt.status === 'ACCEPTED' || receipt.status === 'PARTIALLY_ACCEPTED'
        ? await this.loadInboundStockForReceipt(id, companyId)
        : [];

    const displayCurrency =
      withShipment.items.find((i) => i.expectedCurrency)?.expectedCurrency || 'UZS';

    return {
      ...withShipment,
      items: pageItems,
      displayCurrency: String(displayCurrency).toUpperCase() === 'USD' ? 'USD' : 'UZS',
      inboundStock,
      totalAmount: withShipment.items.reduce(
        (sum, item) =>
          sum + toFiniteMoney(item.expectedPrice) * toFiniteMoney(item.quantity),
        0,
      ),
      ...(needsPagination
        ? {
            itemsPaginated: {
              page,
              limit,
              total: totalItems,
              hasMore: page * limit < totalItems,
            },
          }
        : {}),
    };
  }

  /** Qabul qilingan yuk — omborga kirim harakatlari (tekshirish uchun) */
  async loadInboundStockForReceipt(receiptId: string, companyId: string) {
    const movements = await this.prisma.stockMovement.findMany({
      where: {
        companyId,
        type: 'IN',
        sourceType: 'GOODS_RECEIPT',
        OR: [{ sourceId: receiptId }, { note: { contains: receiptId } }],
      },
      include: {
        warehouse: { select: { id: true, name: true } },
        productVariant: {
          select: {
            id: true,
            name: true,
            sku: true,
            product: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return movements.map((m) => ({
      warehouseId: m.warehouseId,
      warehouseName: m.warehouse?.name || '—',
      productVariantId: m.productVariantId,
      productName: m.productVariant?.product?.name || '',
      variantName: m.productVariant?.name || '',
      sku: m.productVariant?.sku || null,
      quantity: Number(m.quantity),
    }));
  }

}
