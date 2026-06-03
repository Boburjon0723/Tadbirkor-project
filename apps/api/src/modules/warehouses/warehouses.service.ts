import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateWarehouseDto, UpdateWarehouseDto } from './dto/warehouse.dto';
import { WarehouseScopeService } from '../users/services/warehouse-scope.service';
import {
  productsTiedToWarehouseFilter,
  variantsInWarehouseCategoryFilter,
} from './warehouse-catalog.util';
import { DEFAULT_TX_OPTIONS, LONG_TX_OPTIONS } from '../../prisma/transaction-options';
import { AppCacheService } from '../../common/cache/app-cache.service';

@Injectable()
export class WarehousesService {
  constructor(
    private prisma: PrismaService,
    private readonly warehouseScopeService: WarehouseScopeService,
    private readonly cache: AppCacheService,
  ) {}

  private async bumpActiveWarehouseCountCache(companyId: string) {
    await this.cache.del(`company:${companyId}:active-warehouse-count`);
  }

  private withDefaultFieldConfig(config?: any) {
    return {
      showVariantName: config?.showVariantName ?? true,
      showImage: config?.showImage ?? true,
      showDescription: config?.showDescription ?? true,
      showSku: config?.showSku ?? true,
      showBarcode: config?.showBarcode ?? true,
      showColor: config?.showColor ?? true,
      showTotalStock: config?.showTotalStock ?? true,
      showPurchasePrice: config?.showPurchasePrice ?? true,
      showSalePrice: config?.showSalePrice ?? true,
    };
  }

  async create(companyId: string, dto: CreateWarehouseDto) {
    const created = await this.prisma.warehouse.create({
      data: {
        companyId,
        name: dto.name,
        address: dto.address,
        fieldConfig: this.withDefaultFieldConfig(dto.fieldConfig),
        status: dto.status || 'ACTIVE',
      },
    });
    await this.bumpActiveWarehouseCountCache(companyId);
    return created;
  }

  async findAll(companyId: string, userId?: string) {
    // Foydalanuvchi scope'iga ko'ra filtr:
    // - all=true (OWNER/MANAGER/ACCOUNTANT) — barcha aktiv omborlar
    // - all=false (SALES/WAREHOUSE) — faqat o'ziga biriktirilgan ombor(lar)
    let whereId: any = undefined;
    if (userId) {
      const scope = await this.warehouseScopeService.getForUser(companyId, userId);
      if (!scope.all) {
        // Agar foydalanuvchiga ombor biriktirilmagan bo'lsa, bo'sh ro'yxat qaytaramiz.
        if (scope.warehouseIds.length === 0) return [];
        whereId = { in: scope.warehouseIds };
      }
    }

    return this.prisma.warehouse.findMany({
      where: {
        companyId,
        status: { not: 'ARCHIVED' },
        ...(whereId ? { id: whereId } : {}),
      },
      select: {
        id: true,
        companyId: true,
        name: true,
        address: true,
        fieldConfig: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, companyId: string) {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id, companyId },
      include: {
        _count: {
          select: { stockBalances: true, movements: true }
        }
      }
    });
    if (!warehouse) throw new NotFoundException('Ombor topilmadi');
    return warehouse;
  }

  async update(id: string, companyId: string, dto: UpdateWarehouseDto) {
    const existing = await this.findOne(id, companyId);
    const mergedConfig =
      dto.fieldConfig !== undefined
        ? this.withDefaultFieldConfig({
            ...(existing as any).fieldConfig,
            ...dto.fieldConfig,
          })
        : undefined;
    const updated = await this.prisma.warehouse.update({
      where: { id },
      data: {
        name: dto.name,
        address: dto.address,
        status: dto.status,
        ...(mergedConfig ? { fieldConfig: mergedConfig } : {}),
      },
    });
    if (dto.status !== undefined) {
      await this.bumpActiveWarehouseCountCache(companyId);
    }
    return updated;
  }

  /**
   * Hamkorlar (Partner) jadvalidagi warehouseVisibilityConfig JSON'dan
   * o'chirilgan/arxivlangan ombor ID'sini tozalaydi.
   * Bu qadamni transaction tashqarisida bajaramiz — visibility config
   * o'chirilmasa ham asosiy operatsiya muvaffaqiyatli bo'lishi kerak.
   */
  private async cleanupPartnerVisibilityConfig(warehouseId: string, companyId: string) {
    try {
      // Ushbu kompaniya ishtirok etgan barcha faol hamkorliklarni olamiz
      const partners = await this.prisma.partner.findMany({
        where: {
          status: 'ACTIVE',
          OR: [{ ownerCompanyId: companyId }, { partnerCompanyId: companyId }],
        },
        select: { id: true, warehouseVisibilityConfig: true },
      });

      for (const partner of partners) {
        const config = partner.warehouseVisibilityConfig;
        if (!config || typeof config !== 'object' || Array.isArray(config)) continue;

        const raw = config as Record<string, unknown>;
        let changed = false;
        const updated: Record<string, unknown> = {};

        for (const [key, val] of Object.entries(raw)) {
          if (!Array.isArray(val)) {
            updated[key] = val;
            continue;
          }
          const filtered = val.filter((v) => v !== warehouseId);
          if (filtered.length !== val.length) changed = true;
          // Agar ro'yxat bo'sh qolsa — kalitni o'chiramiz (allVisible rejimiga o'tadi)
          if (filtered.length > 0) {
            updated[key] = filtered;
          } else {
            changed = true; // kalit o'chirildi
          }
        }

        if (changed) {
          await this.prisma.partner.update({
            where: { id: partner.id },
            data: {
              warehouseVisibilityConfig: Object.keys(updated).length
                ? (updated as any)
                : null,
            },
          });
        }
      }
    } catch {
      // Visibility tozalash muvaffaqiyatsiz bo'lsa asosiy operatsiyani to'xtatmaymiz
    }
  }

  /**
   * Faqat boshqa ombor / tarix (POS, B2B) bog'lanishlari bloklaydi.
   * Shu ombordagi stockMovement va userStock o'chirishga to'sqinlik qilmaydi.
   */
  private async variantHasBlockingDepsOutsideWarehouse(
    tx: Prisma.TransactionClient,
    variantId: string,
    warehouseId: string,
  ): Promise<boolean> {
    const [
      movementsElsewhere,
      orderItems,
      dispatchItems,
      posItems,
      mappings,
      userStockElsewhere,
      goodsReceiptItems,
    ] = await Promise.all([
      tx.stockMovement.count({
        where: { productVariantId: variantId, warehouseId: { not: warehouseId } },
      }),
      tx.b2BOrderItem.count({ where: { productVariantId: variantId } }),
      tx.dispatchItem.count({ where: { productVariantId: variantId } }),
      tx.posSaleItem.count({ where: { productVariantId: variantId } }),
      tx.productMapping.count({ where: { ownProductVariantId: variantId } }),
      tx.userStock.count({
        where: {
          productVariantId: variantId,
          sourceWarehouseId: { not: warehouseId },
        },
      }),
      tx.goodsReceiptItem.count({ where: { productVariantId: variantId } }),
    ]);
    return (
      movementsElsewhere +
        orderItems +
        dispatchItems +
        posItems +
        mappings +
        userStockElsewhere +
        goodsReceiptItems >
      0
    );
  }

  private async collectVariantIdsForWarehousePurge(
    tx: Prisma.TransactionClient,
    companyId: string,
    warehouseId: string,
  ): Promise<Map<string, string>> {
    const variantToProduct = new Map<string, string>();

    const balances = await tx.stockBalance.findMany({
      where: { companyId, warehouseId },
      select: { productVariantId: true, productVariant: { select: { productId: true } } },
    });
    for (const b of balances) {
      variantToProduct.set(b.productVariantId, b.productVariant.productId);
    }

    const categoryScoped = await tx.productVariant.findMany({
      where: variantsInWarehouseCategoryFilter(companyId, warehouseId),
      select: { id: true, productId: true },
    });
    for (const v of categoryScoped) {
      variantToProduct.set(v.id, v.productId);
    }

    return variantToProduct;
  }

  private async archiveCatalogForWarehouse(
    tx: Prisma.TransactionClient,
    companyId: string,
    warehouseId: string,
  ) {
    await tx.product.updateMany({
      where: productsTiedToWarehouseFilter(companyId, warehouseId),
      data: { status: 'ARCHIVED' },
    });
    await tx.productVariant.updateMany({
      where: {
        companyId,
        status: { not: 'ARCHIVED' },
        OR: [
          { stockBalances: { some: { warehouseId } } },
          { product: { category: { warehouseId } } },
        ],
      },
      data: { status: 'ARCHIVED' },
    });
  }

  /**
   * Ombor to'liq o'chirilganda: shu ombor kategoriyasi va qoldig'idagi variantlar
   * katalogdan olib tashlanadi. Boshqa omborda qoldiq bo'lsa — saqlanadi.
   */
  private async purgeCatalogForDeletedWarehouse(
    tx: Prisma.TransactionClient,
    companyId: string,
    warehouseId: string,
  ) {
    const variantToProduct = await this.collectVariantIdsForWarehousePurge(
      tx,
      companyId,
      warehouseId,
    );
    const productIdsToReconcile = new Set<string>(variantToProduct.values());

    const productsByCategory = await tx.product.findMany({
      where: { companyId, category: { warehouseId } },
      select: { id: true },
    });
    productsByCategory.forEach((p) => productIdsToReconcile.add(p.id));

    for (const [variantId, productId] of variantToProduct) {
      const otherBalances = await tx.stockBalance.count({
        where: {
          productVariantId: variantId,
          warehouseId: { not: warehouseId },
        },
      });
      if (otherBalances > 0) continue;

      const blocked = await this.variantHasBlockingDepsOutsideWarehouse(
        tx,
        variantId,
        warehouseId,
      );
      if (blocked) {
        await tx.productVariant.update({
          where: { id: variantId },
          data: { status: 'ARCHIVED' },
        });
      } else {
        await tx.productMapping.deleteMany({
          where: { ownProductVariantId: variantId },
        });
        await tx.stockMovement.deleteMany({
          where: { productVariantId: variantId, warehouseId },
        });
        await tx.stockBalance.deleteMany({
          where: { productVariantId: variantId, warehouseId },
        });
        await tx.userStock.deleteMany({
          where: { productVariantId: variantId, sourceWarehouseId: warehouseId },
        });
        await tx.productVariant.delete({ where: { id: variantId } });
      }
      productIdsToReconcile.add(productId);
    }

    for (const productId of productIdsToReconcile) {
      const activeVariants = await tx.productVariant.count({
        where: { productId, companyId, status: { not: 'ARCHIVED' } },
      });
      if (activeVariants > 0) continue;

      const product = await tx.product.findFirst({
        where: { id: productId, companyId },
        select: { category: { select: { warehouseId: true } } },
      });
      const onlyThisWarehouseCategory =
        product?.category?.warehouseId === warehouseId;

      const [orderItems, dispatchItems, posItems] = await Promise.all([
        tx.b2BOrderItem.count({
          where: { productVariant: { productId } },
        }),
        tx.dispatchItem.count({
          where: { productVariant: { productId } },
        }),
        tx.posSaleItem.count({
          where: { productVariant: { productId } },
        }),
      ]);
      const productBlocked = orderItems + dispatchItems + posItems > 0;

      if (productBlocked) {
        await tx.product.update({
          where: { id: productId },
          data: { status: 'ARCHIVED' },
        });
      } else if (onlyThisWarehouseCategory) {
        await tx.productVariant.deleteMany({ where: { productId } });
        await tx.product.delete({ where: { id: productId } });
      } else {
        await tx.product.update({
          where: { id: productId },
          data: { status: 'ARCHIVED' },
        });
      }
    }

    await tx.productCategory.updateMany({
      where: { warehouseId, companyId },
      data: { status: 'ARCHIVED', warehouseId: null },
    });
  }

  async remove(id: string, companyId: string, _userId?: string) {
    await this.findOne(id, companyId);

    const [dispatchCount, posCount, fieldTaskCount] = await Promise.all([
      this.prisma.dispatch.count({ where: { warehouseId: id } }),
      this.prisma.posSale.count({ where: { warehouseId: id, companyId } }),
      this.prisma.fieldTask.count({ where: { sourceWarehouseId: id, companyId } }),
    ]);

    if (dispatchCount > 0 || posCount > 0 || fieldTaskCount > 0) {
      const archived = await this.prisma.$transaction(async (tx) => {
        await this.archiveCatalogForWarehouse(tx, companyId, id);
        await tx.productCategory.updateMany({
          where: { warehouseId: id, companyId },
          data: { status: 'ARCHIVED', warehouseId: null },
        });
        await tx.companyUser.updateMany({
          where: { warehouseId: id, companyId },
          data: { warehouseId: null },
        });
        return tx.warehouse.update({
          where: { id },
          data: { status: 'ARCHIVED' },
        });
      }, LONG_TX_OPTIONS);
      await this.cleanupPartnerVisibilityConfig(id, companyId);
      await this.bumpActiveWarehouseCountCache(companyId);
      return {
        action: 'archived' as const,
        message:
          "Omborda jo'natma, POS yoki maydon vazifalari bor — ombor arxivlandi. Shu ombordagi mahsulotlar ham arxivlandi (cheklar tarixda qoladi).",
        warehouse: archived,
      };
    }

    try {
      const deleted = await this.prisma.$transaction(async (tx) => {
        await this.purgeCatalogForDeletedWarehouse(tx, companyId, id);
        await tx.userStock.deleteMany({ where: { sourceWarehouseId: id, companyId } });
        await tx.stockMovement.deleteMany({ where: { warehouseId: id, companyId } });
        await tx.stockBalance.deleteMany({ where: { warehouseId: id, companyId } });
        await tx.companyUser.updateMany({
          where: { warehouseId: id, companyId },
          data: { warehouseId: null },
        });
        return tx.warehouse.delete({ where: { id } });
      }, LONG_TX_OPTIONS);
      await this.cleanupPartnerVisibilityConfig(id, companyId);
      await this.bumpActiveWarehouseCountCache(companyId);
      return {
        action: 'deleted' as const,
        message:
          "Ombor o'chirildi. Shu omborga bog'langan mahsulotlar katalogdan olib tashlandi (boshqa omborda qoldiq bo'lgan mahsulotlar saqlanadi).",
        warehouse: deleted,
      };
    } catch (error) {
      const archived = await this.prisma.$transaction(async (tx) => {
        await this.archiveCatalogForWarehouse(tx, companyId, id);
        await tx.productCategory.updateMany({
          where: { warehouseId: id, companyId },
          data: { status: 'ARCHIVED', warehouseId: null },
        });
        await tx.companyUser.updateMany({
          where: { warehouseId: id, companyId },
          data: { warehouseId: null },
        });
        return tx.warehouse.update({
          where: { id },
          data: { status: 'ARCHIVED' },
        });
      }, LONG_TX_OPTIONS);
      await this.cleanupPartnerVisibilityConfig(id, companyId);
      await this.bumpActiveWarehouseCountCache(companyId);
      return {
        action: 'archived' as const,
        message:
          "Omborni to'liq o'chirib bo'lmadi (bog'liq ma'lumotlar bor) — arxivlandi. Shu ombordagi mahsulotlar ham arxivlandi.",
        warehouse: archived,
      };
    }
  }
}
