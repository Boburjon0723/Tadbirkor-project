import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProductMappingDto, UpdateProductMappingDto } from './dto/product-mapping.dto';
import { PartnersService } from '../partners/partners.service';
import {
  collectInboundSkuCandidates,
  findVariantBySkuCodes,
  isUuidLike,
  looksLikeProductCode,
  parseSnapshotParts,
} from '../../common/product-code.util';

/** Buyurtma/qabul snapshotlari bilan mapping nomini solishtirish */
function normalizePartnerProductName(name?: string | null): string {
  const t = String(name || '')
    .trim()
    .replace(/\s*[-–—]\s*/g, ' — ')
    .replace(/\s+/g, ' ');
  const m = t.match(/^(.+?)\s*\(([^)]+)\)\s*$/u);
  const cleaned =
    m && m[1].trim().toLowerCase() === m[2].trim().toLowerCase() ? m[1].trim() : t;
  return cleaned.toLowerCase();
}

@Injectable()
export class ProductMappingsService {
  constructor(
    private prisma: PrismaService,
    private partnersService: PartnersService
  ) {}

  async create(companyId: string, userId: string, dto: CreateProductMappingDto) {
    const partnerProductName = String(dto.partnerProductName || '').trim();
    if (!partnerProductName) {
      throw new BadRequestException('Hamkor mahsulot nomi bo‘sh bo‘lmasligi kerak');
    }

    // 1. Ensure active partner
    await this.partnersService.ensureActivePartner(companyId, dto.partnerCompanyId);

    // 2. Ensure own product variant belongs to company and is ACTIVE
    const variant = await this.prisma.productVariant.findFirst({
      where: {
        id: dto.ownProductVariantId,
        companyId,
        status: 'ACTIVE'
      }
    });

    if (!variant) {
      throw new NotFoundException('Maxsulot varianti topilmadi yoki nofaol');
    }

    const partnerSku = dto.partnerSku?.trim() || null;

    // 3. Mavjud (shu hamkor + nom) — yangilash yoki faollashtirish
    const candidates = await this.prisma.productMapping.findMany({
      where: {
        companyId,
        partnerCompanyId: dto.partnerCompanyId,
        partnerSku,
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
    const normalizedNew = normalizePartnerProductName(partnerProductName);
    const existing = candidates.find(
      (c) => normalizePartnerProductName(c.partnerProductName) === normalizedNew,
    );

    if (existing) {
      return this.prisma.$transaction(async (tx) => {
        const mapping = await tx.productMapping.update({
          where: { id: existing.id },
          data: {
            partnerProductName,
            partnerBarcode: dto.partnerBarcode?.trim() || null,
            ownProductVariantId: dto.ownProductVariantId,
            conversionRatio: dto.conversionRatio || 1,
            unitMapping: dto.unitMapping,
            status: 'ACTIVE',
          },
        });
        await tx.auditLog.create({
          data: {
            companyId,
            userId,
            action: 'product_mapping.updated',
            entityType: 'PRODUCT_MAPPING',
            entityId: mapping.id,
            oldData: existing as any,
            newData: mapping as any,
          },
        });
        return mapping;
      });
    }

    // 4. Create mapping
    return this.prisma.$transaction(async (tx) => {
      const mapping = await tx.productMapping.create({
        data: {
          companyId,
          partnerCompanyId: dto.partnerCompanyId,
          partnerProductName,
          partnerSku,
          partnerBarcode: dto.partnerBarcode?.trim() || null,
          ownProductVariantId: dto.ownProductVariantId,
          conversionRatio: dto.conversionRatio || 1,
          unitMapping: dto.unitMapping,
          status: dto.status || 'ACTIVE',
          createdBy: userId
        }
      });

      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: 'product_mapping.created',
          entityType: 'PRODUCT_MAPPING',
          entityId: mapping.id,
          newData: mapping as any
        }
      });

      return mapping;
    });
  }

  async findActiveForPartner(companyId: string, partnerCompanyId: string) {
    return this.prisma.productMapping.findMany({
      where: { companyId, partnerCompanyId, status: 'ACTIVE' },
      include: {
        ownProductVariant: { include: { product: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /** Mapping qidiruv uchun — og‘ir include siz, tez */
  private async createBuyerVariantSafe(
    tx: Prisma.TransactionClient,
    params: {
      companyId: string;
      productId: string;
      name: string;
      sellerSku?: string | null;
      sellerBarcode?: string | null;
      salePrice: number;
      purchasePrice: number;
      currency: string;
      attributesJson?: Prisma.InputJsonValue;
      userId: string;
    },
  ) {
    const baseData = {
      companyId: params.companyId,
      productId: params.productId,
      name: params.name,
      salePrice: params.salePrice,
      purchasePrice: params.purchasePrice,
      currency: params.currency,
      attributesJson: params.attributesJson,
      status: 'ACTIVE' as const,
      createdBy: params.userId,
    };

    const sku = await this.pickUniqueBuyerSku(tx, params.companyId, params.sellerSku);
    const barcode = await this.pickUniqueBuyerBarcode(tx, params.companyId, params.sellerBarcode);

    try {
      return await tx.productVariant.create({
        data: { ...baseData, sku, barcode },
      });
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== 'P2002') {
        throw e;
      }
      const existing = await tx.productVariant.findFirst({
        where: {
          companyId: params.companyId,
          productId: params.productId,
          status: 'ACTIVE',
          name: { equals: params.name, mode: 'insensitive' },
        },
      });
      if (existing) return existing;

      return tx.productVariant.create({
        data: { ...baseData, sku: undefined, barcode: undefined },
      });
    }
  }

  private async upsertInboundMapping(
    tx: Prisma.TransactionClient,
    params: {
      buyerCompanyId: string;
      sellerCompanyId: string;
      partnerProductName: string;
      partnerSku: string | null;
      partnerBarcode: string | null;
      ownProductVariantId: string;
      userId: string;
      /** Teskari yozuvni yaratishda rekursiyani oldini olish */
      skipReverseMirror?: boolean;
    },
  ) {
    const {
      buyerCompanyId,
      sellerCompanyId,
      partnerProductName,
      partnerSku,
      partnerBarcode,
      ownProductVariantId,
      userId,
      skipReverseMirror,
    } = params;

    if (partnerSku) {
      const bySku = await tx.productMapping.findFirst({
        where: {
          companyId: buyerCompanyId,
          partnerCompanyId: sellerCompanyId,
          partnerSku,
        },
        orderBy: { updatedAt: 'desc' },
      });
      if (bySku) {
        await tx.productMapping.update({
          where: { id: bySku.id },
          data: {
            status: 'ACTIVE',
            partnerProductName,
            ownProductVariantId,
            partnerBarcode,
          },
        });
        return;
      }
    }

    try {
      await tx.productMapping.create({
        data: {
          companyId: buyerCompanyId,
          partnerCompanyId: sellerCompanyId,
          partnerProductName,
          partnerSku,
          partnerBarcode,
          ownProductVariantId,
          status: 'ACTIVE',
          createdBy: userId,
        },
      });
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError) || e.code !== 'P2002') {
        throw e;
      }
      const dup = await tx.productMapping.findFirst({
        where: {
          companyId: buyerCompanyId,
          partnerCompanyId: sellerCompanyId,
          partnerProductName,
          partnerSku,
        },
      });
      if (dup) {
        await tx.productMapping.update({
          where: { id: dup.id },
          data: { status: 'ACTIVE', ownProductVariantId, partnerBarcode },
        });
        return;
      }
      throw e;
    }

    // Avtomatik teskari mapping vaqtincha o‘chirilgan — noto‘g‘ri bog‘lanishlar oldini olish.
    // Round-trip uchun lineage qidiruvi (resolveReuseVariantViaSellerLineage) ishlatiladi.
  }

  /**
   * A→B qabulida: B katalogidagi variant A dagi asl variantga bog‘langan bo‘lsa,
   * kelajakdagi B→A qabulida A tomonda to‘g‘ridan-to‘g‘ri mapping bo‘lishi uchun
   * teskari yozuvni yaratadi/yangilaydi (partnerSku = sotuvchi/reseller variant ID).
   */
  private async mirrorReverseInboundMapping(
    tx: Prisma.TransactionClient,
    params: {
      originalSellerCompanyId: string;
      resellerCompanyId: string;
      originalSellerVariantId: string;
      resellerVariantId: string;
      partnerProductName: string;
      userId: string;
    },
  ) {
    const {
      originalSellerCompanyId,
      resellerCompanyId,
      originalSellerVariantId,
      resellerVariantId,
      partnerProductName,
      userId,
    } = params;

    const resellerVariant = await tx.productVariant.findFirst({
      where: { id: resellerVariantId, companyId: resellerCompanyId, status: 'ACTIVE' },
      select: { barcode: true, sku: true },
    });

    await this.upsertInboundMapping(tx, {
      buyerCompanyId: originalSellerCompanyId,
      sellerCompanyId: resellerCompanyId,
      partnerProductName,
      partnerSku: resellerVariantId,
      partnerBarcode:
        resellerVariant?.barcode?.trim() || resellerVariant?.sku?.trim() || null,
      ownProductVariantId: originalSellerVariantId,
      userId,
      skipReverseMirror: true,
    });
  }

  /**
   * Qayta savdo (B→A): sotuvchi (B) ushbu variantni avval xaridor (A) dan olgan bo‘lsa,
   * A dagi asl variant ID sini seller mapping orqali topadi.
   */
  private async resolveReuseVariantViaSellerLineage(
    tx: Prisma.TransactionClient,
    params: {
      buyerCompanyId: string;
      sellerCompanyId: string;
      sellerVariantId: string;
    },
  ): Promise<string | null> {
    const { buyerCompanyId, sellerCompanyId, sellerVariantId } = params;

    const sellerInboundFromBuyer = await tx.productMapping.findFirst({
      where: {
        companyId: sellerCompanyId,
        partnerCompanyId: buyerCompanyId,
        ownProductVariantId: sellerVariantId,
        status: 'ACTIVE',
      },
      orderBy: { updatedAt: 'desc' },
      select: { partnerSku: true, partnerBarcode: true },
    });

    const originVariantRef = sellerInboundFromBuyer?.partnerSku?.trim();
    if (!originVariantRef) return null;

    if (isUuidLike(originVariantRef)) {
      const origin = await tx.productVariant.findFirst({
        where: {
          id: originVariantRef,
          companyId: buyerCompanyId,
          status: 'ACTIVE',
        },
        select: { id: true },
      });
      if (origin?.id) return origin.id;
    } else {
      const originByCode = await tx.productVariant.findFirst({
        where: {
          companyId: buyerCompanyId,
          status: 'ACTIVE',
          OR: [{ sku: originVariantRef }, { barcode: originVariantRef }],
        },
        select: { id: true },
      });
      if (originByCode?.id) return originByCode.id;
    }

    const originBarcodeRef = sellerInboundFromBuyer?.partnerBarcode?.trim();
    if (originBarcodeRef) {
      const originByBarcode = await tx.productVariant.findFirst({
        where: {
          companyId: buyerCompanyId,
          status: 'ACTIVE',
          OR: [{ sku: originBarcodeRef }, { barcode: originBarcodeRef }],
        },
        select: { id: true },
      });
      if (originByBarcode?.id) return originByBarcode.id;
    }

    return null;
  }

  private async linkInboundToExistingVariant(
    tx: Prisma.TransactionClient,
    params: {
      buyerCompanyId: string;
      sellerCompanyId: string;
      sellerVariantId: string | null;
      productNameSnapshot: string;
      ownVariantId: string;
      sellerVariant?: { barcode?: string | null; sku?: string | null } | null;
      userId: string;
    },
  ): Promise<{ createdMapping: boolean }> {
    const {
      buyerCompanyId,
      sellerCompanyId,
      sellerVariantId,
      productNameSnapshot,
      ownVariantId,
      sellerVariant,
      userId,
    } = params;

    const snapshot = String(productNameSnapshot || '').trim();
    const existing = sellerVariantId
      ? await tx.productMapping.findFirst({
          where: {
            companyId: buyerCompanyId,
            partnerCompanyId: sellerCompanyId,
            partnerSku: sellerVariantId,
          },
          select: { id: true },
        })
      : null;

    await this.upsertInboundMapping(tx, {
      buyerCompanyId,
      sellerCompanyId,
      partnerProductName: snapshot,
      partnerSku: sellerVariantId,
      partnerBarcode:
        sellerVariant?.barcode?.trim() || sellerVariant?.sku?.trim() || null,
      ownProductVariantId: ownVariantId,
      userId,
    });

    return { createdMapping: !existing };
  }

  /** Xaridor katalogida SKU/barcode takrorlanmasin (A-001 bir nechta rangda) */
  private async pickUniqueBuyerSku(
    tx: Prisma.TransactionClient,
    buyerCompanyId: string,
    candidate?: string | null,
  ): Promise<string | undefined> {
    const sku = candidate?.trim();
    if (!sku) return undefined;
    const taken = await tx.productVariant.findFirst({
      where: { companyId: buyerCompanyId, sku, status: 'ACTIVE' },
      select: { id: true },
    });
    return taken ? undefined : sku;
  }

  private async pickUniqueBuyerBarcode(
    tx: Prisma.TransactionClient,
    buyerCompanyId: string,
    candidate?: string | null,
  ): Promise<string | undefined> {
    const barcode = candidate?.trim();
    if (!barcode) return undefined;
    const taken = await tx.productVariant.findFirst({
      where: { companyId: buyerCompanyId, barcode, status: 'ACTIVE' },
      select: { id: true },
    });
    return taken ? undefined : barcode;
  }

  async findActiveForPartnerLite(companyId: string, partnerCompanyId: string) {
    return this.prisma.productMapping.findMany({
      where: { companyId, partnerCompanyId, status: 'ACTIVE' },
      select: {
        id: true,
        partnerProductName: true,
        partnerSku: true,
        partnerBarcode: true,
        ownProductVariantId: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  resolveMappingFromList<
    T extends {
      id?: string;
      partnerProductName: string;
      partnerSku?: string | null;
      partnerBarcode?: string | null;
    },
  >(
    mappings: T[],
    params: {
      partnerProductName: string;
      /** Sotuvchi katalogidagi SKU (A-001, BX-109) */
      partnerSkuCode?: string;
      partnerBarcode?: string;
      /** @deprecated partnerSku — eski nom; partnerSkuCode bilan bir xil */
      partnerSku?: string;
      partnerSellerVariantId?: string;
    },
  ): T | null {
    const {
      partnerProductName,
      partnerSkuCode,
      partnerSku,
      partnerBarcode,
      partnerSellerVariantId,
    } = params;
    const normalizedPartnerName = normalizePartnerProductName(partnerProductName);
    const skuCode = (partnerSkuCode || partnerSku)?.trim();
    const barcode = partnerBarcode?.trim();
    const sellerVid = partnerSellerVariantId?.trim();

    if (sellerVid) {
      const bySeller = mappings.find((m) => m.partnerSku === sellerVid);
      if (bySeller) return bySeller;
    }

    const codeMatches = (m: T, code: string) => {
      const low = code.toLowerCase();
      if (m.partnerBarcode?.trim().toLowerCase() === low) return true;
      const ps = m.partnerSku?.trim();
      if (ps && ps.toLowerCase() === low && !isUuidLike(ps)) return true;
      return false;
    };

    for (const code of [skuCode, barcode].filter(Boolean) as string[]) {
      const hit = mappings.find((m) => codeMatches(m, code));
      if (hit) return hit;
    }

    return (
      mappings.find(
        (candidate) =>
          normalizePartnerProductName(candidate.partnerProductName) ===
          normalizedPartnerName,
      ) || null
    );
  }

  private normalizeProductKey(name: string): string {
    return String(name || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  /**
   * Buyurtma/qabul snapshotidagi mahsulot kodi (A-047) — asosiy manba.
   * Sotuvchi katalog nomi boshqa bo‘lishi mumkin (masalan ichki A-001).
   */
  private expectedInboundProductName(
    productNameSnapshot: string,
    sellerVariant?: { product?: { name?: string | null } | null } | null,
  ): string {
    const fromSnapshot = parseSnapshotParts(productNameSnapshot).productName.trim();
    if (fromSnapshot) return fromSnapshot;
    return sellerVariant?.product?.name?.trim() || '';
  }

  /** Snapshotdagi rang/variant (och kofe) — sotuvchi ichki nomidan ustun */
  private expectedInboundVariantName(productNameSnapshot: string): string {
    const { variantName } = parseSnapshotParts(productNameSnapshot);
    if (!variantName || variantName === 'Standart') return '';
    return variantName.trim();
  }

  /** Snapshot (mahsulot + variant) ↔ mappingdagi xaridor varianti mosligi */
  private async isInboundMappingAligned(
    tx: Prisma.TransactionClient,
    params: {
      ownProductVariantId: string;
      sellerCompanyId: string;
      sellerVariantId: string | null;
      productNameSnapshot: string;
    },
  ): Promise<boolean> {
    const { ownProductVariantId, sellerCompanyId, sellerVariantId, productNameSnapshot } =
      params;

    const sellerVariant = sellerVariantId
      ? await tx.productVariant.findFirst({
          where: { id: sellerVariantId, companyId: sellerCompanyId, status: 'ACTIVE' },
          select: { product: { select: { name: true } } },
        })
      : null;

    const expectedProductName = this.expectedInboundProductName(
      productNameSnapshot,
      sellerVariant,
    );
    const expectedVariantName = this.expectedInboundVariantName(productNameSnapshot);

    const ownVariant = await tx.productVariant.findFirst({
      where: { id: ownProductVariantId },
      select: { name: true, product: { select: { name: true } } },
    });
    if (!ownVariant) return false;

    const ownProductName = ownVariant.product?.name?.trim() || '';
    const ownVariantName = ownVariant.name?.trim() || '';

    if (expectedProductName) {
      if (!ownProductName) return false;
      if (
        this.normalizeProductKey(expectedProductName) !==
        this.normalizeProductKey(ownProductName)
      ) {
        return false;
      }
    }

    if (expectedVariantName) {
      if (!ownVariantName) return false;
      if (
        this.normalizeProductKey(expectedVariantName) !==
        this.normalizeProductKey(ownVariantName)
      ) {
        return false;
      }
    }

    return true;
  }

  /**
   * Yuk qabulida: mapping bo‘lsa → mavjud variant; yo‘q → yangi mahsulot + variant + mapping.
   * `partnerSku` = sotuvchi variant ID (barqaror kalit).
   */
  async ensureBuyerVariantForInbound(
    tx: Prisma.TransactionClient,
    params: {
      buyerCompanyId: string;
      sellerCompanyId: string;
      sellerVariantId: string | null;
      productNameSnapshot: string;
      expectedPrice: number;
      expectedCurrency: string;
      userId: string;
      /** Yuk qabulda oldindan yuklangan mappinglar (har qatorda findMany qilmaslik uchun) */
      prefetchedActiveMappings?: Array<{
        id: string;
        partnerProductName: string;
        partnerSku: string | null;
        partnerBarcode: string | null;
        ownProductVariantId: string;
      }>;
      /** Sotuvchi varianti oldindan yuklangan (har qatorda findFirst qilmaslik uchun) */
      prefetchedSellerVariant?: {
        id: string;
        name: string;
        sku: string | null;
        barcode: string | null;
        attributesJson?: unknown;
        product: {
          name: string;
          description?: string | null;
          imageUrl?: string | null;
          unit?: string | null;
          type?: string | null;
        };
      } | null;
      /** SKU bo‘yicha xaridor variantlari (kompaniya bo‘yicha bir martalik yuklash) */
      buyerVariantsForSkuLookup?: Array<{
        id: string;
        sku: string | null;
        barcode: string | null;
        name: string;
        productId: string;
      }>;
    },
  ): Promise<{ ownVariantId: string; createdProduct: boolean; createdMapping: boolean }> {
    const {
      buyerCompanyId,
      sellerCompanyId,
      sellerVariantId,
      productNameSnapshot,
      expectedPrice,
      expectedCurrency,
      userId,
      prefetchedActiveMappings,
      prefetchedSellerVariant,
      buyerVariantsForSkuLookup,
    } = params;
    const snapshot = String(productNameSnapshot || '').trim();
    const loadActiveMappings = async () => {
      if (prefetchedActiveMappings) return prefetchedActiveMappings;
      return tx.productMapping.findMany({
        where: { companyId: buyerCompanyId, partnerCompanyId: sellerCompanyId, status: 'ACTIVE' },
        select: {
          id: true,
          partnerProductName: true,
          partnerSku: true,
          partnerBarcode: true,
          ownProductVariantId: true,
        },
        orderBy: { updatedAt: 'desc' },
      });
    };
    const currency = String(expectedCurrency || 'UZS').toUpperCase() === 'USD' ? 'USD' : 'UZS';

    const sellerVariant =
      prefetchedSellerVariant ??
      (sellerVariantId
        ? await tx.productVariant.findFirst({
            where: {
              id: sellerVariantId,
              companyId: sellerCompanyId,
              status: 'ACTIVE',
            },
            include: { product: true },
          })
        : null);

    const skuCandidates = collectInboundSkuCandidates(snapshot, sellerVariant);

    if (sellerVariantId) {
      const bySellerFromActive = prefetchedActiveMappings?.find(
        (m) => m.partnerSku === sellerVariantId,
      );
      if (bySellerFromActive) {
        return {
          ownVariantId: bySellerFromActive.ownProductVariantId,
          createdProduct: false,
          createdMapping: false,
        };
      }

      const bySeller = await tx.productMapping.findFirst({
        where: {
          companyId: buyerCompanyId,
          partnerCompanyId: sellerCompanyId,
          partnerSku: sellerVariantId,
        },
        orderBy: { updatedAt: 'desc' },
      });
      if (bySeller) {
        if (bySeller.status !== 'ACTIVE') {
          await tx.productMapping.update({
            where: { id: bySeller.id },
            data: { status: 'ACTIVE', partnerProductName: snapshot || bySeller.partnerProductName },
          });
        } else if (snapshot && snapshot !== bySeller.partnerProductName) {
          await tx.productMapping.update({
            where: { id: bySeller.id },
            data: { partnerProductName: snapshot },
          });
        }
        return {
          ownVariantId: bySeller.ownProductVariantId,
          createdProduct: false,
          createdMapping: false,
        };
      }

      const activeForSku = await loadActiveMappings();
      const bySkuMapping = this.resolveMappingFromList(activeForSku, {
        partnerProductName: snapshot,
        partnerSkuCode: sellerVariant?.sku ?? undefined,
        partnerBarcode: sellerVariant?.barcode ?? undefined,
      });
      if (bySkuMapping?.id) {
        await tx.productMapping.update({
          where: { id: bySkuMapping.id },
          data: {
            status: 'ACTIVE',
            partnerSku: sellerVariantId,
            partnerProductName: snapshot || bySkuMapping.partnerProductName,
            partnerBarcode:
              sellerVariant?.barcode?.trim() ||
              sellerVariant?.sku?.trim() ||
              bySkuMapping.partnerBarcode,
          },
        });
        return {
          ownVariantId: bySkuMapping.ownProductVariantId,
          createdProduct: false,
          createdMapping: false,
        };
      }
    } else {
      const activeMappings = await loadActiveMappings();
      const byName = this.resolveMappingFromList(activeMappings, {
        partnerProductName: snapshot,
      });
      if (byName) {
        const aligned = await this.isInboundMappingAligned(tx, {
          ownProductVariantId: byName.ownProductVariantId,
          sellerCompanyId,
          sellerVariantId: null,
          productNameSnapshot: snapshot,
        });
        if (aligned) {
          return {
            ownVariantId: byName.ownProductVariantId,
            createdProduct: false,
            createdMapping: false,
          };
        }
      }
    }

    if (sellerVariantId) {
      const reusedViaLineage = await this.resolveReuseVariantViaSellerLineage(tx, {
        buyerCompanyId,
        sellerCompanyId,
        sellerVariantId,
      });
      if (reusedViaLineage) {
        const { createdMapping } = await this.linkInboundToExistingVariant(tx, {
          buyerCompanyId,
          sellerCompanyId,
          sellerVariantId,
          productNameSnapshot: snapshot,
          ownVariantId: reusedViaLineage,
          sellerVariant: sellerVariant ?? undefined,
          userId,
        });
        return {
          ownVariantId: reusedViaLineage,
          createdProduct: false,
          createdMapping,
        };
      }
    }

    const { productName, variantName } = parseSnapshotParts(snapshot);
    const buyerProductName =
      this.expectedInboundProductName(snapshot, sellerVariant) || productName;
    const snapshotVariant =
      variantName && variantName !== 'Standart' ? variantName : '';
    const buyerVariantName =
      snapshotVariant || sellerVariant?.name?.trim() || variantName || 'Standart';
    const attrs = (sellerVariant?.attributesJson || {}) as Record<string, unknown>;
    const color = String(attrs.color ?? attrs.Color ?? '').trim();

    let buyerProduct = await tx.product.findFirst({
      where: {
        companyId: buyerCompanyId,
        status: 'ACTIVE',
        name: { equals: buyerProductName, mode: 'insensitive' },
      },
    });
    let createdProduct = false;
    if (!buyerProduct) {
      createdProduct = true;
      buyerProduct = await tx.product.create({
        data: {
          companyId: buyerCompanyId,
          name: buyerProductName,
          description: sellerVariant?.product?.description,
          imageUrl: sellerVariant?.product?.imageUrl,
          unit: sellerVariant?.product?.unit || 'dona',
          type: sellerVariant?.product?.type || 'GOODS',
          status: 'ACTIVE',
          createdBy: userId,
        },
      });
    }

    let buyerVariant: { id: string } | null = null;

    const variantNamesToTry = [
      snapshotVariant,
      sellerVariant?.name?.trim(),
      buyerVariantName,
    ].filter((n, i, arr) => n && arr.indexOf(n) === i) as string[];

    /** Avval SKU/barcode (butun kompaniya katalogi) — avvalgi mantiq */
    for (const code of skuCandidates) {
      const hit = buyerVariantsForSkuLookup?.length
        ? findVariantBySkuCodes(buyerVariantsForSkuLookup, [code])
        : await tx.productVariant.findFirst({
            where: {
              companyId: buyerCompanyId,
              status: 'ACTIVE',
              OR: [{ sku: code }, { barcode: code }],
            },
            select: { id: true, name: true, productId: true, sku: true, barcode: true },
          });
      if (!hit) continue;
      if (looksLikeProductCode(code)) {
        buyerVariant = hit;
        break;
      }
      if (hit.sku === code || hit.barcode === code) {
        buyerVariant = hit;
        break;
      }
      if (snapshotVariant) {
        const snapLow = snapshotVariant.toLowerCase();
        const hitLow = hit.name.trim().toLowerCase();
        const nameMatches = variantNamesToTry.some(
          (n) => n && hitLow === String(n).trim().toLowerCase(),
        );
        if (hitLow !== snapLow && !nameMatches) {
          continue;
        }
      }
      buyerVariant = hit;
      break;
    }

    if (!buyerVariant) {
      for (const variantName of variantNamesToTry) {
        buyerVariant = await tx.productVariant.findFirst({
          where: {
            companyId: buyerCompanyId,
            productId: buyerProduct.id,
            status: 'ACTIVE',
            name: { equals: variantName, mode: 'insensitive' },
          },
          select: { id: true },
        });
        if (buyerVariant) break;
      }
    }

    if (!buyerVariant) {
      buyerVariant = await this.createBuyerVariantSafe(tx, {
        companyId: buyerCompanyId,
        productId: buyerProduct.id,
        name: buyerVariantName,
        sellerSku: sellerVariant?.sku,
        sellerBarcode: sellerVariant?.barcode,
        salePrice: expectedPrice,
        purchasePrice: expectedPrice,
        currency,
        attributesJson: color
          ? ({ color } as Prisma.InputJsonValue)
          : (sellerVariant?.attributesJson as Prisma.InputJsonValue) ?? undefined,
        userId,
      });
    }

    const mappingSku = sellerVariantId || null;
    const partnerProductName = snapshot || buyerProductName;
    await this.upsertInboundMapping(tx, {
      buyerCompanyId,
      sellerCompanyId,
      partnerProductName,
      partnerSku: mappingSku,
      partnerBarcode:
        sellerVariant?.barcode?.trim() || sellerVariant?.sku?.trim() || null,
      ownProductVariantId: buyerVariant.id,
      userId,
    });

    return {
      ownVariantId: buyerVariant.id,
      createdProduct,
      createdMapping: true,
    };
  }

  async resolveMapping(params: {
    companyId: string;
    partnerCompanyId: string;
    partnerProductName: string;
    partnerSku?: string;
    partnerBarcode?: string;
    partnerSellerVariantId?: string;
  }) {
    const { companyId, partnerCompanyId } = params;
    const list = await this.findActiveForPartnerLite(companyId, partnerCompanyId);
    return this.resolveMappingFromList(list, params);
  }

  async findAll(companyId: string, partnerCompanyId?: string) {
    const rows = await this.prisma.productMapping.findMany({
      where: {
        companyId,
        status: 'ACTIVE',
        ...(partnerCompanyId ? { partnerCompanyId } : {}),
      },
      include: {
        ownProductVariant: {
          include: { product: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const partnerIds = [...new Set(rows.map((r) => r.partnerCompanyId))];
    const companies = partnerIds.length
      ? await this.prisma.company.findMany({
          where: { id: { in: partnerIds } },
          select: { id: true, name: true, tin: true },
        })
      : [];
    const byId = new Map(companies.map((c) => [c.id, c]));

    return rows.map((row) => ({
      ...row,
      partnerCompany: byId.get(row.partnerCompanyId) || null,
    }));
  }

  async findOne(companyId: string, id: string) {
    const mapping = await this.prisma.productMapping.findFirst({
      where: { id, companyId },
      include: {
        ownProductVariant: {
          include: { product: true }
        }
      }
    });
    if (!mapping) throw new NotFoundException('Mapping topilmadi');
    return mapping;
  }

  async update(companyId: string, id: string, userId: string, dto: UpdateProductMappingDto) {
    const mapping = await this.findOne(companyId, id);

    const data: Prisma.ProductMappingUpdateInput = {};

    if (dto.partnerProductName !== undefined) {
      const partnerProductName = String(dto.partnerProductName).trim();
      if (!partnerProductName) {
        throw new BadRequestException('Hamkor mahsulot nomi bo‘sh bo‘lmasligi kerak');
      }
      data.partnerProductName = partnerProductName;
    }

    if (dto.partnerSku !== undefined) {
      data.partnerSku = dto.partnerSku?.trim() || null;
    }

    if (dto.partnerBarcode !== undefined) {
      data.partnerBarcode = dto.partnerBarcode?.trim() || null;
    }

    if (dto.ownProductVariantId !== undefined) {
      const variant = await this.prisma.productVariant.findFirst({
        where: {
          id: dto.ownProductVariantId,
          companyId,
          status: 'ACTIVE',
        },
      });
      if (!variant) {
        throw new NotFoundException('Maxsulot varianti topilmadi yoki nofaol');
      }
      data.ownProductVariant = { connect: { id: dto.ownProductVariantId } };
    }

    if (dto.conversionRatio !== undefined) {
      data.conversionRatio = dto.conversionRatio;
    }

    if (dto.unitMapping !== undefined) {
      data.unitMapping = dto.unitMapping;
    }

    if (dto.status !== undefined) {
      data.status = dto.status;
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.productMapping.update({
        where: { id },
        data,
      });

      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: 'product_mapping.updated',
          entityType: 'PRODUCT_MAPPING',
          entityId: id,
          oldData: mapping as any,
          newData: updated as any
        }
      });

      return updated;
    });
  }

  async remove(companyId: string, id: string, userId: string) {
    await this.findOne(companyId, id);
    
    // Instead of delete, set INACTIVE to preserve history
    return this.prisma.productMapping.update({
      where: { id },
      data: { status: 'INACTIVE' }
    });
  }

  async getMissingMappings(companyId: string) {
    // Find all pending receipts to see what products are coming in
    const receipts = await this.prisma.goodsReceipt.findMany({
      where: { 
        buyerCompanyId: companyId,
        status: 'PENDING'
      },
      include: {
        items: true,
        sellerCompany: { select: { name: true } }
      }
    });

    const missing: any[] = [];

    for (const receipt of receipts) {
      for (const item of receipt.items) {
        // Check if mapping exists
        const mapping = await this.resolveMapping({
          companyId,
          partnerCompanyId: receipt.sellerCompanyId,
          partnerProductName: item.productNameSnapshot
        });

        if (!mapping) {
          missing.push({
            partnerCompanyId: receipt.sellerCompanyId,
            partnerCompanyName: receipt.sellerCompany.name,
            partnerProductName: item.productNameSnapshot,
            receiptId: receipt.id
          });
        }
      }
    }

    // Unique by partner and product name
    const uniqueMissing = missing.filter((v, i, a) => 
      a.findIndex(t => (t.partnerCompanyId === v.partnerCompanyId && t.partnerProductName === v.partnerProductName)) === i
    );

    return uniqueMissing;
  }
}
