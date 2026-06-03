import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DEFAULT_TX_OPTIONS, LONG_TX_OPTIONS } from '../../prisma/transaction-options';
import { InventoryGateway } from '../warehouses/inventory.gateway';
import { AppCacheService } from '../../common/cache/app-cache.service';
import { normalizeStockQuantity } from '../../common/units/product-unit.util';
import {
  parseListPagination,
  wantsFullList,
} from '../../common/list-pagination.util';
import { posCatalogCachePrefix } from '../../common/pos-catalog-cache.util';
import { StockService } from '../warehouses/stock.service';
import { PartnerLedgerLinkService } from '../partner-ledger/partner-ledger-link.service';
import { ProductSaveStockAdjustmentDto } from './dto/product.dto';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private prisma: PrismaService,
    private inventoryGateway: InventoryGateway,
    private cache: AppCacheService,
    private stockService: StockService,
    private partnerLedgerLink: PartnerLedgerLinkService,
  ) {}

  private notifyInventoryChanged(
    companyId: string,
    payload?: { warehouseId?: string; productId?: string; reason?: string },
  ) {
    try {
      this.inventoryGateway.emitToCompany(companyId, 'inventory:changed', payload || {});
      this.inventoryGateway.emitDashboardRefresh(companyId);
      void this.cache.delByPrefix(
        posCatalogCachePrefix(companyId, payload?.warehouseId),
      );
    } catch (err) {
      this.logger.warn(`Inventory realtime emit failed: ${(err as Error).message}`);
    }
  }

  private normalizeColor(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    return normalized || null;
  }

  private normalizeBarcode(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized || null;
  }

  private normalizeImageUrl(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized || null;
  }

  /** Tahrirdan olib tashlangan variantlarni arxivlash yoki (tarix yo‘q bo‘lsa) o‘chirish */
  private async removeVariantOnProductUpdate(
    tx: Prisma.TransactionClient,
    companyId: string,
    userId: string,
    variantId: string,
  ) {
    const [
      movementsCount,
      stockBalancesCount,
      mappingsCount,
      orderItemsCount,
      dispatchItemsCount,
      goodsReceiptItemsCount,
    ] = await Promise.all([
      tx.stockMovement.count({ where: { productVariantId: variantId } }),
      tx.stockBalance.count({ where: { productVariantId: variantId } }),
      tx.productMapping.count({ where: { ownProductVariantId: variantId } }),
      tx.b2BOrderItem.count({ where: { productVariantId: variantId } }),
      tx.dispatchItem.count({ where: { productVariantId: variantId } }),
      tx.goodsReceiptItem.count({ where: { productVariantId: variantId } }),
    ]);

    const hasDependents =
      movementsCount > 0 ||
      stockBalancesCount > 0 ||
      mappingsCount > 0 ||
      orderItemsCount > 0 ||
      dispatchItemsCount > 0 ||
      goodsReceiptItemsCount > 0;

    if (hasDependents) {
      await tx.productVariant.update({
        where: { id: variantId },
        data: { status: 'ARCHIVED' },
      });
      await tx.productMapping.updateMany({
        where: { ownProductVariantId: variantId },
        data: { status: 'INACTIVE' },
      });
      await this.logAudit(tx, {
        companyId,
        userId,
        action: 'variant.archived',
        entityType: 'PRODUCT_VARIANT',
        entityId: variantId,
        newData: { reason: 'removed_from_product_update' },
      });
      return;
    }

    await tx.stockBalance.deleteMany({ where: { productVariantId: variantId } });
    await tx.productVariant.delete({ where: { id: variantId } });
    await this.logAudit(tx, {
      companyId,
      userId,
      action: 'variant.deleted',
      entityType: 'PRODUCT_VARIANT',
      entityId: variantId,
      newData: { reason: 'removed_from_product_update' },
    });
  }

  private async assertBarcodeAvailable(
    tx: Prisma.TransactionClient,
    companyId: string,
    barcode: string,
    excludeVariantId?: string,
  ) {
    const existing = await tx.productVariant.findFirst({
      where: {
        companyId,
        barcode,
        ...(excludeVariantId ? { id: { not: excludeVariantId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException(
        `Bunday shtrix-kod allaqachon mavjud: ${barcode}`,
      );
    }
  }

  private async logAudit(
    tx: any,
    params: {
      companyId: string;
      userId: string;
      action: string;
      entityType: string;
      entityId: string;
      oldData?: any;
      newData?: any;
    },
  ) {
    await tx.auditLog.create({
      data: {
        companyId: params.companyId,
        userId: params.userId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        oldData: params.oldData,
        newData: params.newData,
      },
    });
  }

  private resolveCanonicalSku(variants: any[] = []): string | null {
    const set = new Set<string>();
    for (const v of variants) {
      const sku = String(v?.sku || '').trim();
      if (sku) set.add(sku.toLowerCase());
    }
    if (set.size > 1) {
      throw new BadRequestException("Bitta mahsulot uchun SKU bitta bo'lishi kerak.");
    }
    return set.size === 1 ? String(variants.find((v) => String(v?.sku || '').trim())?.sku || '').trim() : null;
  }

  private async ensureActiveWarehouseExists(companyId: string) {
    const exists = await this.prisma.warehouse.findFirst({
      where: { companyId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!exists) {
      throw new BadRequestException("Avval kamida bitta ombor yarating, keyin mahsulot qo'shing.");
    }
  }

  async create(companyId: string, dto: CreateProductDto, userId: string) {
    await this.ensureActiveWarehouseExists(companyId);
    const created = await this.prisma.$transaction(async (tx) => {
      const canonicalSku = this.resolveCanonicalSku(dto.variants as any[]);
      const seenColors = new Set<string>();
      for (const variant of dto.variants || []) {
        const color = this.normalizeColor((variant as any)?.attributes?.color);
        if (!color) continue;
        if (seenColors.has(color)) {
          throw new BadRequestException(`Bir mahsulot ichida rang takrorlanmasligi kerak: ${String((variant as any)?.attributes?.color)}`);
        }
        seenColors.add(color);
      }

      // 1. Create the main product
      const product = await tx.product.create({
        data: {
          companyId,
          name: dto.name,
          categoryId: dto.categoryId,
          description: dto.description,
          imageUrl: dto.imageUrl,
          unit: dto.unit,
          type: dto.type,
          status: 'ACTIVE',
          createdBy: userId,
        },
      });

      // 2. Handle variants
      if (dto.variants && dto.variants.length > 0) {
        for (const [index, v] of dto.variants.entries()) {
          const barcode = this.normalizeBarcode(v.barcode);
          if (barcode) {
            await this.assertBarcodeAvailable(tx, companyId, barcode);
          }
          const createdVariant = await tx.productVariant.create({
            data: {
              companyId,
              productId: product.id,
              name: v.name,
              sku: index === 0 ? (canonicalSku || undefined) : undefined,
              barcode,
              salePrice: v.salePrice,
              purchasePrice: v.purchasePrice,
              currency: v.currency || 'UZS',
              attributesJson: v.attributes as any,
              status: 'ACTIVE',
              createdBy: userId,
            },
          });

          const initialStock = normalizeStockQuantity(
            Number((v as any).initialStock || 0),
            dto.unit,
          );
          const warehouseId = (v as any).warehouseId;
          if (warehouseId) {
            const warehouse = await tx.warehouse.findFirst({
              where: { id: warehouseId, companyId, status: 'ACTIVE' },
            });
            if (!warehouse) {
              throw new BadRequestException('Tanlangan ombor topilmadi yoki nofaol');
            }

            await tx.stockBalance.create({
              data: {
                companyId,
                warehouseId,
                productVariantId: createdVariant.id,
                quantity: Math.max(0, initialStock),
              },
            });

            if (initialStock > 0) {
              await tx.stockMovement.create({
                data: {
                  companyId,
                  warehouseId,
                  productVariantId: createdVariant.id,
                  type: 'IN',
                  quantity: initialStock,
                  sourceType: 'PRODUCT_INITIAL',
                  note: 'INITIAL_STOCK',
                  createdBy: userId,
                },
              });
            }
          }
        }
      } else {
        // Create default variant if no variants provided
        await tx.productVariant.create({
          data: {
            companyId,
            productId: product.id,
            name: `Default / ${dto.name}`,
            salePrice: 0,
            status: 'ACTIVE',
            createdBy: userId,
          },
        });
      }

      await this.logAudit(tx, {
        companyId,
        userId,
        action: 'product.created',
        entityType: 'PRODUCT',
        entityId: product.id,
        newData: {
          name: product.name,
          categoryId: product.categoryId,
          imageUrl: product.imageUrl,
          type: product.type,
          unit: product.unit,
          variantsCount: dto.variants?.length || 1,
        },
      });

      return tx.product.findUnique({
        where: { id: product.id },
        include: { variants: true, category: true },
      });
    }, DEFAULT_TX_OPTIONS);
    this.notifyInventoryChanged(companyId, {
      productId: created?.id,
      reason: 'product.created',
    });
    return created;
  }

  private buildProductListWhere(companyId: string, query?: any): Prisma.ProductWhereInput {
    const search = String(query?.search || '').trim();
    const categoryId = String(query?.categoryId || '').trim();
    const warehouseId = String(query?.warehouseId || '').trim();

    const where: Prisma.ProductWhereInput = {
      companyId,
      status: { not: 'ARCHIVED' },
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { variants: { some: { sku: { contains: search, mode: 'insensitive' } } } },
        { variants: { some: { barcode: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (warehouseId) {
      // Kategoriya boshqa omborga bog‘langan bo‘lsa ham, shu omborda qoldiq/stockBalance
      // bo‘lsa mahsulot inventar ro‘yxatida ko‘rinsin (Excel importdan keyin yo‘qolmasligi uchun).
      const warehouseScope: Prisma.ProductWhereInput = {
        OR: [
          { categoryId: null },
          { category: { status: { not: 'ARCHIVED' }, warehouseId } },
          { category: { status: { not: 'ARCHIVED' }, warehouseId: null } },
          {
            variants: {
              some: {
                status: { not: 'ARCHIVED' },
                stockBalances: { some: { warehouseId } },
              },
            },
          },
        ],
      };
      where.AND = where.AND
        ? [...(Array.isArray(where.AND) ? where.AND : [where.AND]), warehouseScope]
        : [warehouseScope];
    }

    return where;
  }

  /** Bitta faol ombor bo‘lsa — kategoriya filtri o‘chiriladi (barcha mahsulotlar ko‘rinadi). */
  private async countActiveWarehouses(companyId: string): Promise<number> {
    const cacheKey = `company:${companyId}:active-warehouse-count`;
    const cached = await this.cache.get(cacheKey);
    if (cached !== null && cached !== '') {
      const n = Number(cached);
      if (Number.isFinite(n)) return n;
    }
    const count = await this.prisma.warehouse.count({
      where: { companyId, status: 'ACTIVE' },
    });
    await this.cache.set(cacheKey, String(count), 120_000);
    return count;
  }

  private async resolveProductListWhere(
    companyId: string,
    query?: any,
  ): Promise<Prisma.ProductWhereInput> {
    const warehouseId = String(query?.warehouseId || '').trim();
    if (!warehouseId) {
      return this.buildProductListWhere(companyId, query);
    }
    const activeWarehouses = await this.countActiveWarehouses(companyId);
    if (activeWarehouses === 1) {
      return this.buildProductListWhere(companyId, { ...query, warehouseId: '' });
    }
    return this.buildProductListWhere(companyId, query);
  }

  private buildProductListOrderBy(query?: any): Prisma.ProductOrderByWithRelationInput {
    const sortBy = query?.sortBy || 'createdAt';
    const sortOrder = query?.sortOrder === 'asc' ? 'asc' : 'desc';
    if (sortBy === 'name') {
      return { name: sortOrder };
    }
    if (sortBy === 'salePrice') {
      return { createdAt: sortOrder };
    }
    return { [sortBy]: sortOrder } as Prisma.ProductOrderByWithRelationInput;
  }

  private productListInclude(warehouseId: string) {
    const stockBalancesInclude = warehouseId
      ? { where: { warehouseId } }
      : true;

    return {
      variants: {
        where: { status: { not: 'ARCHIVED' } },
        include: {
          stockBalances: stockBalancesInclude,
        },
      },
      category: true,
      _count: {
        select: { variants: true },
      },
    } as const;
  }

  /** Ombor jadvali — faqat kerakli maydonlar (tezroq yuklash) */
  private productCatalogListSelect(warehouseId: string): Prisma.ProductSelect {
    return {
      id: true,
      name: true,
      description: true,
      imageUrl: true,
      categoryId: true,
      unit: true,
      createdAt: true,
      category: { select: { id: true, name: true } },
      variants: {
        where: { status: { not: 'ARCHIVED' } },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          name: true,
          sku: true,
          barcode: true,
          salePrice: true,
          purchasePrice: true,
          currency: true,
          attributesJson: true,
          stockBalances: {
            ...(warehouseId ? { where: { warehouseId } } : {}),
            select: { warehouseId: true, quantity: true },
          },
        },
      },
    };
  }

  private isCatalogListView(query?: any) {
    return String(query?.view || '').toLowerCase() === 'catalog';
  }

  async getCatalogSummary(companyId: string, query?: any) {
    const where = await this.resolveProductListWhere(companyId, query);
    const [productCount, variantCount] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.productVariant.count({
        where: {
          companyId,
          status: { not: 'ARCHIVED' },
          product: where,
        },
      }),
    ]);
    return { productCount, variantCount };
  }

  async findAll(companyId: string, query?: any) {
    const warehouseId = String(query?.warehouseId || '').trim();
    const catalogView = this.isCatalogListView(query);
    const where = await this.resolveProductListWhere(companyId, query);
    const orderBy = this.buildProductListOrderBy(query);

    if (wantsFullList(query)) {
      if (catalogView) {
        return this.prisma.product.findMany({
          where,
          select: this.productCatalogListSelect(warehouseId),
          orderBy,
        });
      }
      return this.prisma.product.findMany({
        where,
        include: this.productListInclude(warehouseId),
        orderBy,
      });
    }

    const { page, limit, skip } = parseListPagination(query, {
      limit: 50,
      maxLimit: 200,
    });

    const findPage = () =>
      catalogView
        ? this.prisma.product.findMany({
            where,
            select: this.productCatalogListSelect(warehouseId),
            orderBy,
            skip,
            take: limit,
          })
        : this.prisma.product.findMany({
            where,
            include: this.productListInclude(warehouseId),
            orderBy,
            skip,
            take: limit,
          });

    const [items, total] = await Promise.all([
      findPage(),
      this.prisma.product.count({ where }),
    ]);

    const result: {
      items: typeof items;
      page: number;
      limit: number;
      total: number;
      hasMore: boolean;
      summary?: { productCount: number; variantCount: number };
    } = {
      items,
      page,
      limit,
      total,
      hasMore: skip + items.length < total,
    };

    if (catalogView && page === 1) {
      const variantCount = await this.prisma.productVariant.count({
        where: {
          companyId,
          status: { not: 'ARCHIVED' },
          product: where,
        },
      });
      result.summary = { productCount: total, variantCount };
    }

    return result;
  }

  async findOne(id: string, companyId: string, query?: { warehouseId?: string }) {
    const warehouseId = String(query?.warehouseId || '').trim();
    const product = await this.prisma.product.findFirst({
      where: { id, companyId },
      include: {
        variants: {
          where: { status: { not: 'ARCHIVED' } },
          orderBy: { createdAt: 'asc' },
          include: {
            stockBalances: {
              ...(warehouseId ? { where: { warehouseId } } : {}),
              include: {
                warehouse: { select: { id: true, name: true, status: true } },
              },
            },
          },
        },
        category: { select: { id: true, name: true } },
      },
    });
    if (!product) throw new NotFoundException('Mahsulot topilmadi');
    return product;
  }

  private async applySaveStockAdjustmentsInTx(
    tx: Prisma.TransactionClient,
    companyId: string,
    userId: string,
    productId: string,
    adjustments: ProductSaveStockAdjustmentDto[] | undefined,
  ): Promise<
    Array<{
      movement: { id: string; quantity: unknown; type: string };
      adj: ProductSaveStockAdjustmentDto;
      movementType: 'IN' | 'OUT';
    }>
  > {
    if (!adjustments?.length) return [];

    const variantIds = new Set(
      (
        await tx.productVariant.findMany({
          where: { companyId, productId, status: { not: 'ARCHIVED' } },
          select: { id: true },
        })
      ).map((v) => v.id),
    );

    const queued: Array<{
      movement: { id: string; quantity: unknown; type: string };
      adj: ProductSaveStockAdjustmentDto;
      movementType: 'IN' | 'OUT';
    }> = [];

    for (const adj of adjustments) {
      const signedQty = Number(adj.quantity);
      if (!Number.isFinite(signedQty) || signedQty === 0) continue;

      if (!variantIds.has(adj.productVariantId)) {
        throw new BadRequestException(
          'Zaxira tuzatish faqat shu mahsulot variantlari uchun mumkin',
        );
      }

      const movementType: 'IN' | 'OUT' = signedQty > 0 ? 'IN' : 'OUT';
      const movement = await this.stockService.recordMovement(
        companyId,
        {
          warehouseId: adj.warehouseId,
          productVariantId: adj.productVariantId,
          quantity: Math.abs(signedQty),
          note: adj.note?.trim() || 'Mahsulot kartochkasidan zaxira tuzatish',
        },
        movementType,
        'ADJUSTMENT',
        userId,
        tx,
        { emitRealtime: false },
      );

      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: 'stock.adjusted',
          entityType: 'STOCK_BALANCE',
          entityId: `${adj.warehouseId}_${adj.productVariantId}`,
          newData: adj as unknown as Prisma.InputJsonValue,
        },
      });

      queued.push({ movement, adj, movementType });
    }

    return queued;
  }

  private async linkSaveStockAdjustmentsToLedger(
    companyId: string,
    userId: string,
    queued: Array<{
      movement: { id: string; quantity: unknown; type: string };
      adj: ProductSaveStockAdjustmentDto;
      movementType: 'IN' | 'OUT';
    }>,
  ) {
    for (const { movement, adj, movementType } of queued) {
      const contactId = adj.partnerLedgerContactId?.trim();
      if (!contactId) continue;

      const variant = await this.prisma.productVariant.findFirst({
        where: { id: adj.productVariantId, companyId },
        include: { product: { select: { name: true } } },
      });
      if (!variant) continue;

      const qty = Number(movement.quantity);
      const amounts = this.partnerLedgerLink.buildAmountsFromVariant(
        variant,
        qty,
        movementType,
      );
      const productSummary = `${variant.product?.name || 'Mahsulot'} / ${variant.name} ×${qty}`;
      const payload = {
        companyId,
        userId,
        contactId,
        sourceId: movement.id,
        amounts,
        quantity: qty,
        productSummary,
        notes: adj.note,
      };

      if (movementType === 'IN') {
        await this.partnerLedgerLink.recordFromStockInbound({
          ...payload,
          sourceType: 'STOCK_IN_MANUAL',
        });
      } else {
        await this.partnerLedgerLink.recordFromStockOutbound({
          ...payload,
          sourceType: 'STOCK_OUT_MANUAL',
        });
      }
    }
  }

  async update(id: string, companyId: string, dto: UpdateProductDto, userId: string) {
    const existing = await this.findOne(id, companyId);
    let ledgerQueue: Awaited<ReturnType<ProductsService['applySaveStockAdjustmentsInTx']>> = [];
    const primaryWarehouseId =
      dto.stockAdjustments?.[0]?.warehouseId?.trim() || undefined;

    const updated = await this.prisma.$transaction(async (tx) => {
      const canonicalSku = this.resolveCanonicalSku((dto.variants as any[]) || []);
      const seenColors = new Set<string>();
      for (const variant of (dto.variants as any[]) || []) {
        const color = this.normalizeColor((variant as any)?.attributes?.color);
        if (!color) continue;
        if (seenColors.has(color)) {
          throw new BadRequestException(`Bir mahsulot ichida rang takrorlanmasligi kerak: ${String((variant as any)?.attributes?.color)}`);
        }
        seenColors.add(color);
      }

      const updated = await tx.product.update({
        where: { id },
        data: {
          name: dto.name,
          categoryId: dto.categoryId,
          description: dto.description,
          ...(dto.imageUrl !== undefined
            ? { imageUrl: this.normalizeImageUrl(dto.imageUrl) }
            : {}),
          unit: dto.unit,
          type: dto.type,
          status: dto.status,
        },
      });

      const canonicalSkuTrimmed = canonicalSku ? String(canonicalSku).trim() : '';
      if (dto.variants?.length) {
        if (canonicalSkuTrimmed) {
          const foreignSku = await tx.productVariant.findFirst({
            where: {
              companyId,
              productId: { not: id },
              sku: { equals: canonicalSkuTrimmed, mode: 'insensitive' },
            },
            select: { id: true, productId: true },
          });
          if (foreignSku) {
            throw new BadRequestException(
              `Bu mahsulot kodi (SKU) boshqa mahsulotda band: ${canonicalSkuTrimmed}`,
            );
          }
        }
        if (canonicalSkuTrimmed || existing.variants.some((ev) => ev.sku)) {
          // Eski importlarda bir nechta variantda bir xil SKU qolgan bo'lishi mumkin — tozalaymiz.
          await tx.productVariant.updateMany({
            where: { productId: id, companyId },
            data: { sku: null },
          });
        }
      }

      if (dto.variants?.length) {
        for (const [index, v] of (dto.variants as any[]).entries()) {
          if (v.id) {
            const existsInProduct = existing.variants.some((ev) => ev.id === v.id);
            if (!existsInProduct) continue;
            const barcode = this.normalizeBarcode(v.barcode);
            if (barcode) {
              await this.assertBarcodeAvailable(tx, companyId, barcode, v.id);
            }
            // SKU faqat ro'yxatdagi birinchi variantda (mahsulot darajasidagi bitta kod).
            let skuUpdate: string | null | undefined = undefined;
            if (index === 0) {
              skuUpdate = canonicalSkuTrimmed || null;
            }
            await tx.productVariant.update({
              where: { id: v.id },
              data: {
                name: v.name,
                sku: skuUpdate,
                barcode,
                salePrice: v.salePrice,
                purchasePrice: v.purchasePrice,
                currency: v.currency || 'UZS',
                attributesJson: v.attributes as any,
                status: v.status || 'ACTIVE',
              },
            });
            continue;
          }

          const barcode = this.normalizeBarcode(v.barcode);
          if (barcode) {
            await this.assertBarcodeAvailable(tx, companyId, barcode);
          }

          const createdVariant = await tx.productVariant.create({
            data: {
              companyId,
              productId: updated.id,
              name: v.name || `Variant / ${updated.name}`,
              sku: index === 0 ? (canonicalSkuTrimmed || undefined) : undefined,
              barcode,
              salePrice: Number(v.salePrice || 0),
              purchasePrice: v.purchasePrice != null ? Number(v.purchasePrice) : undefined,
              currency: v.currency || 'UZS',
              attributesJson: v.attributes as any,
              status: v.status || 'ACTIVE',
              createdBy: userId,
            },
          });

          const initialStock = normalizeStockQuantity(
            Number(v.initialStock || 0),
            updated.unit,
          );
          const warehouseId = v.warehouseId;
          if (warehouseId) {
            const warehouse = await tx.warehouse.findFirst({
              where: { id: warehouseId, companyId, status: 'ACTIVE' },
            });
            if (!warehouse) {
              throw new BadRequestException('Tanlangan ombor topilmadi yoki nofaol');
            }

            await tx.stockBalance.create({
              data: {
                companyId,
                warehouseId,
                productVariantId: createdVariant.id,
                quantity: Math.max(0, initialStock),
              },
            });

            if (initialStock > 0) {
              await tx.stockMovement.create({
                data: {
                  companyId,
                  warehouseId,
                  productVariantId: createdVariant.id,
                  type: 'IN',
                  quantity: initialStock,
                  sourceType: 'PRODUCT_INITIAL',
                  note: 'INITIAL_STOCK',
                  createdBy: userId,
                },
              });
            }
          }
        }
      }

      if (dto.variants !== undefined) {
        if (!dto.variants.length) {
          throw new BadRequestException('Kamida bitta variant qolishi kerak');
        }
        const keptVariantIds = new Set(
          dto.variants
            .map((v: { id?: string }) => v.id)
            .filter((variantId): variantId is string => !!variantId),
        );
        const explicitRemoved = new Set(
          (dto.removedVariantIds || [])
            .map((id) => String(id || '').trim())
            .filter(Boolean),
        );
        const toRemove = existing.variants.filter((ev) => {
          if (explicitRemoved.has(ev.id)) return true;
          if (explicitRemoved.size > 0) return false;
          if (keptVariantIds.size === 0) return false;
          return !keptVariantIds.has(ev.id);
        });
        for (const removed of toRemove) {
          await this.removeVariantOnProductUpdate(tx, companyId, userId, removed.id);
        }
      }

      await this.logAudit(tx, {
        companyId,
        userId,
        action: 'product.updated',
        entityType: 'PRODUCT',
        entityId: id,
        oldData: {
          name: existing.name,
          categoryId: existing.categoryId,
          description: existing.description,
          imageUrl: existing.imageUrl,
          unit: existing.unit,
          type: existing.type,
          status: existing.status,
        },
        newData: {
          name: updated.name,
          categoryId: updated.categoryId,
          description: updated.description,
          imageUrl: updated.imageUrl,
          unit: updated.unit,
          type: updated.type,
          status: updated.status,
        },
      });

      ledgerQueue = await this.applySaveStockAdjustmentsInTx(
        tx,
        companyId,
        userId,
        id,
        dto.stockAdjustments,
      );

      return updated;
    }, DEFAULT_TX_OPTIONS);

    await this.linkSaveStockAdjustmentsToLedger(companyId, userId, ledgerQueue);

    this.notifyInventoryChanged(companyId, {
      productId: id,
      warehouseId: primaryWarehouseId,
      reason: 'product.updated',
    });
    return updated;
  }

  async remove(id: string, companyId: string, userId: string) {
    const product = await this.findOne(id, companyId);
    
    // Check if any variant has dependent records
    const variantIds = product.variants.map((v) => v.id);
    const [
      movementsCount,
      stockBalancesCount,
      mappingsCount,
      orderItemsCount,
      dispatchItemsCount,
      goodsReceiptItemsCount,
    ] = await Promise.all([
      this.prisma.stockMovement.count({
        where: { productVariantId: { in: variantIds } },
      }),
      this.prisma.stockBalance.count({
        where: { productVariantId: { in: variantIds } },
      }),
      this.prisma.productMapping.count({
        where: { ownProductVariantId: { in: variantIds } },
      }),
      this.prisma.b2BOrderItem.count({
        where: { productVariantId: { in: variantIds } },
      }),
      this.prisma.dispatchItem.count({
        where: { productVariantId: { in: variantIds } },
      }),
      this.prisma.goodsReceiptItem.count({
        where: { productVariantId: { in: variantIds } },
      }),
    ]);

    const hasDependents =
      movementsCount > 0 ||
      stockBalancesCount > 0 ||
      mappingsCount > 0 ||
      orderItemsCount > 0 ||
      dispatchItemsCount > 0 ||
      goodsReceiptItemsCount > 0;

    const archiveProduct = async (
      tx: Prisma.TransactionClient,
      reason: string,
    ) => {
      await tx.productVariant.updateMany({
        where: { productId: id },
        data: { status: 'ARCHIVED' },
      });
      const archived = await tx.product.update({
        where: { id },
        data: { status: 'ARCHIVED' },
      });
      await this.logAudit(tx, {
        companyId,
        userId,
        action: 'product.archived',
        entityType: 'PRODUCT',
        entityId: id,
        oldData: { status: product.status },
        newData: { status: archived.status, reason },
      });
      return archived;
    };

    if (hasDependents) {
      const archived = await this.prisma.$transaction(
        (tx) => archiveProduct(tx, 'has_dependent_records'),
        DEFAULT_TX_OPTIONS,
      );
      this.notifyInventoryChanged(companyId, { productId: id, reason: 'product.archived' });
      return {
        action: 'archived' as const,
        message:
          "Mahsulotda ombor/qoldiq, harakat yoki buyurtma tarixi bor — to'liq o'chirilmadi, arxivlandi (ro'yxatdan yo'qoladi).",
        product: archived,
      };
    }

    try {
      const deleted = await this.prisma.$transaction(async (tx) => {
        await tx.productVariant.deleteMany({ where: { productId: id } });
        const removed = await tx.product.delete({ where: { id } });
        await this.logAudit(tx, {
          companyId,
          userId,
          action: 'product.deleted',
          entityType: 'PRODUCT',
          entityId: id,
          oldData: {
            name: product.name,
            categoryId: product.categoryId,
            variantsCount: product.variants.length,
          },
        });
        return removed;
      }, DEFAULT_TX_OPTIONS);
      this.notifyInventoryChanged(companyId, { productId: id, reason: 'product.deleted' });
      return {
        action: 'deleted' as const,
        message: "Mahsulot butunlay o'chirildi.",
        product: deleted,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        const archived = await this.prisma.$transaction(
          (tx) => archiveProduct(tx, 'fk_blocked_on_delete'),
          DEFAULT_TX_OPTIONS,
        );
        this.notifyInventoryChanged(companyId, { productId: id, reason: 'product.archived' });
        return {
          action: 'archived' as const,
          message:
            "Mahsulot boshqa yozuvlarga bog'langan — arxivlandi (to'liq o'chirilmadi).",
          product: archived,
        };
      }
      throw error;
    }
  }
}
