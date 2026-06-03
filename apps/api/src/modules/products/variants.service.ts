import { Injectable, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateVariantDto, UpdateVariantDto, UpdatePriceDto } from './dto/variant.dto';
import { PublishVariantDto } from './dto/publish-variant.dto';
import { normalizeStockQuantity } from '../../common/units/product-unit.util';

@Injectable()
export class VariantsService {
  constructor(private prisma: PrismaService) {}

  private normalizeColor(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    return normalized || null;
  }

  private async ensureUniqueColorPerProduct(params: {
    tx: any;
    companyId: string;
    productId: string;
    colorValue: unknown;
    excludeVariantId?: string;
  }) {
    const normalizedColor = this.normalizeColor(params.colorValue);
    if (!normalizedColor) return;

    const variants = await params.tx.productVariant.findMany({
      where: {
        companyId: params.companyId,
        productId: params.productId,
        ...(params.excludeVariantId ? { id: { not: params.excludeVariantId } } : {}),
      },
      select: { id: true, attributesJson: true },
    });

    const duplicate = variants.find((variant: any) => {
      const existing = this.normalizeColor((variant.attributesJson as any)?.color);
      return existing === normalizedColor;
    });

    if (duplicate) {
      throw new BadRequestException('Bir mahsulot ichida rang takrorlanmasligi kerak');
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

  async create(companyId: string, productId: string, dto: CreateVariantDto, userId?: string) {
    // Check product existence
    const product = await this.prisma.product.findFirst({ where: { id: productId, companyId } });
    if (!product) throw new NotFoundException('Mahsulot topilmadi');

    return this.prisma.$transaction(async (tx) => {
      await this.ensureUniqueColorPerProduct({
        tx,
        companyId,
        productId,
        colorValue: dto.attributes?.color,
      });

      // Check SKU/Barcode uniqueness within company
      if (dto.sku) {
        const existing = await tx.productVariant.findFirst({ where: { companyId, sku: dto.sku } });
        if (existing) throw new BadRequestException('Bunday SKU mavjud');
      }
      const barcode = String(dto.barcode || '').trim() || null;
      if (barcode) {
        const existing = await tx.productVariant.findFirst({
          where: { companyId, barcode },
        });
        if (existing) throw new BadRequestException('Bunday Barcode mavjud');
      }

      const variant = await tx.productVariant.create({
        data: {
          companyId,
          productId,
          name: dto.name,
          sku: dto.sku,
          barcode,
          salePrice: dto.salePrice,
          purchasePrice: dto.purchasePrice,
          currency: dto.currency || 'UZS',
          attributesJson: dto.attributes as any,
          status: dto.status || 'ACTIVE',
          createdBy: userId,
        },
      });

      const productRow = await tx.product.findFirst({
        where: { id: productId, companyId },
        select: { unit: true },
      });
      const initialStock = normalizeStockQuantity(
        Number(dto.initialStock || 0),
        productRow?.unit,
      );
      if (dto.warehouseId || initialStock > 0) {
        let warehouseId = dto.warehouseId;
        if (!warehouseId) {
          const defaultWarehouse = await tx.warehouse.findFirst({
            where: { companyId, status: 'ACTIVE' },
          });
          if (defaultWarehouse) warehouseId = defaultWarehouse.id;
        }

        if (warehouseId) {
          await tx.stockBalance.create({
            data: {
              companyId,
              warehouseId,
              productVariantId: variant.id,
              quantity: Math.max(0, initialStock),
            },
          });

          if (initialStock > 0) {
            await tx.stockMovement.create({
              data: {
                companyId,
                warehouseId,
                productVariantId: variant.id,
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

      if (userId) {
        await this.logAudit(tx, {
          companyId,
          userId,
          action: 'variant.created',
          entityType: 'PRODUCT_VARIANT',
          entityId: variant.id,
          newData: {
            productId,
            name: variant.name,
            sku: variant.sku,
            barcode: variant.barcode,
            salePrice: variant.salePrice,
            purchasePrice: variant.purchasePrice,
          },
        });
      }

      return variant;
    });
  }

  async findAll(companyId: string) {
    return this.prisma.productVariant.findMany({
      where: { companyId },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, companyId: string) {
    const variant = await this.prisma.productVariant.findFirst({
      where: { id, companyId },
      include: { product: true, stockBalances: { include: { warehouse: true } } },
    });
    if (!variant) throw new NotFoundException('Variant topilmadi');
    return variant;
  }

  async search(companyId: string, params: { query?: string; barcode?: string; sku?: string }) {
    const { query, barcode, sku } = params;

    return this.prisma.productVariant.findMany({
      where: {
        companyId,
        AND: [
          sku ? { sku } : {},
          barcode ? { barcode } : {},
          query ? {
            OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { product: { name: { contains: query, mode: 'insensitive' } } },
              { sku: { contains: query, mode: 'insensitive' } },
              { barcode: { contains: query, mode: 'insensitive' } },
            ]
          } : {},
        ]
      },
      include: { product: true },
    });
  }

  async update(id: string, companyId: string, dto: UpdateVariantDto, userId: string) {
    const variant = await this.findOne(id, companyId);

    // Check SKU/Barcode uniqueness if changed
    if (dto.sku && dto.sku !== variant.sku) {
      const existing = await this.prisma.productVariant.findFirst({ where: { companyId, sku: dto.sku } });
      if (existing) throw new BadRequestException('Bunday SKU mavjud');
    }
    const currentBarcode = String(variant.barcode ?? '').trim() || null;
    const nextBarcode =
      dto.barcode !== undefined
        ? String(dto.barcode).trim() || null
        : currentBarcode;
    if (nextBarcode && nextBarcode !== currentBarcode) {
      const existing = await this.prisma.productVariant.findFirst({
        where: { companyId, barcode: nextBarcode, id: { not: id } },
      });
      if (existing) throw new BadRequestException('Bunday Barcode mavjud');
    }

    return this.prisma.$transaction(async (tx) => {
      await this.ensureUniqueColorPerProduct({
        tx,
        companyId,
        productId: variant.productId,
        colorValue: dto.attributes?.color,
        excludeVariantId: id,
      });

      const updated = await tx.productVariant.update({
        where: { id },
        data: {
          name: dto.name,
          sku: dto.sku,
          barcode: nextBarcode,
          salePrice: dto.salePrice,
          purchasePrice: dto.purchasePrice,
          currency: dto.currency,
          attributesJson: dto.attributes as any,
          status: dto.status,
        },
      });

      await this.logAudit(tx, {
        companyId,
        userId,
        action: 'variant.updated',
        entityType: 'PRODUCT_VARIANT',
        entityId: id,
        oldData: {
          name: variant.name,
          sku: variant.sku,
          barcode: variant.barcode,
          salePrice: variant.salePrice,
          purchasePrice: variant.purchasePrice,
          status: variant.status,
        },
        newData: {
          name: updated.name,
          sku: updated.sku,
          barcode: updated.barcode,
          salePrice: updated.salePrice,
          purchasePrice: updated.purchasePrice,
          status: updated.status,
        },
      });

      return updated;
    });
  }

  async updatePrice(id: string, companyId: string, dto: UpdatePriceDto, userId: string) {
    const variant = await this.findOne(id, companyId);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.productVariant.update({
        where: { id },
        data: {
          salePrice: dto.salePrice,
          purchasePrice: dto.purchasePrice,
        },
      });

      // Audit log for price change
      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: 'product.price_updated',
          entityType: 'PRODUCT_VARIANT',
          entityId: id,
          oldData: { salePrice: variant.salePrice, purchasePrice: variant.purchasePrice } as any,
          newData: { salePrice: dto.salePrice, purchasePrice: dto.purchasePrice } as any,
        },
      });

      return updated;
    });
  }

  async remove(id: string, companyId: string, userId: string) {
    const variant = await this.findOne(id, companyId);
    
    // Check if used in movements or orders
    const movementsCount = await this.prisma.stockMovement.count({ where: { productVariantId: id } });
    // Add checks for orders/invoices later when those models are fully ready
    
    if (movementsCount > 0) {
      return this.prisma.$transaction(async (tx) => {
        const archived = await tx.productVariant.update({
          where: { id },
          data: { status: 'ARCHIVED' },
        });

        await this.logAudit(tx, {
          companyId,
          userId,
          action: 'variant.archived',
          entityType: 'PRODUCT_VARIANT',
          entityId: id,
          oldData: { status: variant.status },
          newData: { status: archived.status, reason: 'has_stock_movements' },
        });

        return archived;
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const deleted = await tx.productVariant.delete({
        where: { id },
      });

      await this.logAudit(tx, {
        companyId,
        userId,
        action: 'variant.deleted',
        entityType: 'PRODUCT_VARIANT',
        entityId: id,
        oldData: {
          productId: variant.productId,
          name: variant.name,
          sku: variant.sku,
          barcode: variant.barcode,
        },
      });

      return deleted;
    });
  }

  async publishToWebsite(id: string, companyId: string, dto: PublishVariantDto, userId: string) {
    const variant = (await this.findOne(id, companyId)) as any;
    if (variant.status !== 'ACTIVE') {
      throw new BadRequestException('Faqat ACTIVE variant webga chiqarilishi mumkin');
    }
    if (variant.product?.status !== 'ACTIVE') {
      throw new BadRequestException('Mahsulot nofaol, avval mahsulotni faollashtiring');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.productVariant.update({
        where: { id },
        data: {
          isPublishedToWebsite: dto.isPublishedToWebsite,
          publishedAt: dto.isPublishedToWebsite ? new Date() : null,
        },
      }) as any;

      await this.logAudit(tx, {
        companyId,
        userId,
        action: dto.isPublishedToWebsite ? 'variant.website_published' : 'variant.website_unpublished',
        entityType: 'PRODUCT_VARIANT',
        entityId: id,
        oldData: {
          isPublishedToWebsite: variant.isPublishedToWebsite,
          publishedAt: variant.publishedAt,
        },
        newData: {
          isPublishedToWebsite: updated.isPublishedToWebsite,
          publishedAt: updated.publishedAt,
        },
      });

      return updated;
    });
  }

  async getWebsiteCatalog(companyId: string, storefrontToken?: string, query?: { search?: string }) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        storefrontToken: true,
      },
    });
    if (!company) {
      throw new NotFoundException('Kompaniya topilmadi');
    }
    if (company.storefrontToken && company.storefrontToken !== storefrontToken) {
      throw new UnauthorizedException('Storefront token noto‘g‘ri');
    }

    const search = query?.search?.trim();
    const variants = await this.prisma.productVariant.findMany({
      where: {
        companyId,
        status: 'ACTIVE',
        isPublishedToWebsite: true,
        product: {
          status: 'ACTIVE',
          ...(search
            ? { name: { contains: search, mode: 'insensitive' } }
            : {}),
        },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            description: true,
            unit: true,
          },
        },
        stockBalances: {
          select: { quantity: true, reservedQuantity: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return variants.map((variant: any) => {
      const totalStock = variant.stockBalances.reduce((sum, row) => sum + row.quantity, 0);
      const totalReserved = variant.stockBalances.reduce((sum, row) => sum + row.reservedQuantity, 0);
      return {
        id: variant.id,
        productId: variant.productId,
        productName: variant.product.name,
        productDescription: variant.product.description,
        variantName: variant.name,
        sku: variant.sku,
        barcode: variant.barcode,
        salePrice: variant.salePrice,
        currency: variant.currency,
        unit: variant.product.unit,
        stockAvailable: Math.max(0, totalStock - totalReserved),
      };
    });
  }
}
