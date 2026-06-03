import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DEFAULT_TX_OPTIONS } from '../../prisma/transaction-options';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryGateway } from './inventory.gateway';
import {
  CreateStockMovementDto,
  CreateStockAdjustmentDto,
  CreateStockTransferDto,
} from './dto/stock.dto';
import { validateStockQuantity } from '../../common/units/product-unit.util';
import { AppCacheService } from '../../common/cache/app-cache.service';
import { posCatalogCachePrefix } from '../../common/pos-catalog-cache.util';
import { PartnerLedgerLinkService } from '../partner-ledger/partner-ledger-link.service';

@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name);

  constructor(
    private prisma: PrismaService,
    private inventoryGateway: InventoryGateway,
    private cache: AppCacheService,
    private partnerLedgerLink: PartnerLedgerLinkService,
  ) {}

  private async linkMovementToPartnerLedger(
    companyId: string,
    userId: string,
    contactId: string | undefined,
    movement: { id: string; quantity: unknown; type: string },
    productVariantId: string,
    direction: 'IN' | 'OUT',
    note?: string,
  ) {
    if (!contactId?.trim() || !userId) return;

    const variant = await this.prisma.productVariant.findFirst({
      where: { id: productVariantId, companyId },
      include: { product: { select: { name: true } } },
    });
    if (!variant) return;

    const qty = Number(movement.quantity);
    const amounts = this.partnerLedgerLink.buildAmountsFromVariant(variant, qty, direction);
    const productSummary = `${variant.product?.name || 'Mahsulot'} / ${variant.name} ×${qty}`;
    const sourceId = movement.id;
    const payload = {
      companyId,
      userId,
      contactId: contactId.trim(),
      sourceId,
      amounts,
      quantity: qty,
      productSummary,
      notes: note,
    };

    if (direction === 'IN') {
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

  private async loadVariantUnits(
    client: Prisma.TransactionClient,
    companyId: string,
    variantIds: string[],
  ): Promise<Map<string, string>> {
    if (!variantIds.length) return new Map();
    const variants = await client.productVariant.findMany({
      where: { id: { in: variantIds }, companyId },
      select: { id: true, product: { select: { unit: true } } },
    });
    return new Map(
      variants.map((v) => [v.id, v.product?.unit || 'dona']),
    );
  }

  private normalizeMovementDto(
    dto: CreateStockMovementDto,
    unitByVariant: Map<string, string>,
  ): CreateStockMovementDto {
    const unit = unitByVariant.get(dto.productVariantId) || 'dona';
    const quantity = validateStockQuantity(dto.quantity, unit);
    return { ...dto, quantity };
  }

  /**
   * Ombor `fieldConfig.showTotalStock === false` bo‘lsa — UI da "Umumiy zaxira" yashirilgan,
   * korxona zaxirasiz ishlab chiqarish rejimida deb hisoblanadi: DISPATCH chiqimida
   * yetarli qoldiq talab qilinmaydi (manfiy qoldiq yozuvi mumkin).
   */
  warehouseSkipsDispatchStockGuard(warehouse: { fieldConfig?: unknown }): boolean {
    const fc = warehouse.fieldConfig;
    if (!fc || typeof fc !== 'object' || Array.isArray(fc)) return false;
    return (fc as Record<string, unknown>).showTotalStock === false;
  }

  /**
   * Jo‘natma yuborishdan oldin ombor qoldig‘ini tekshirish (qisman/qolgan jo‘natma ham).
   */
  async assertDispatchStockAvailable(
    companyId: string,
    warehouseId: string,
    lines: Array<{ productVariantId: string; quantity: number; label?: string }>,
    externalTx?: Prisma.TransactionClient,
  ) {
    if (!lines.length) return;

    const client = externalTx ?? this.prisma;
    const warehouse = await client.warehouse.findFirst({
      where: { id: warehouseId, companyId },
      select: { id: true, name: true, fieldConfig: true },
    });
    if (!warehouse) throw new NotFoundException('Ombor topilmadi');
    if (this.warehouseSkipsDispatchStockGuard(warehouse)) return;

    const aggregated = new Map<string, { quantity: number; label: string }>();
    for (const line of lines) {
      const qty = Number(line.quantity);
      if (!Number.isFinite(qty) || qty <= 0) continue;
      const prev = aggregated.get(line.productVariantId);
      aggregated.set(line.productVariantId, {
        quantity: (prev?.quantity ?? 0) + qty,
        label: line.label || prev?.label || line.productVariantId,
      });
    }
    if (!aggregated.size) return;

    const variantIds = [...aggregated.keys()];
    const balances = await client.stockBalance.findMany({
      where: { companyId, warehouseId, productVariantId: { in: variantIds } },
      select: { productVariantId: true, quantity: true },
    });
    const availableByVariant = new Map(
      balances.map((b) => [b.productVariantId, Number(b.quantity)]),
    );

    const shortages: string[] = [];
    for (const [variantId, row] of aggregated) {
      const available = availableByVariant.get(variantId) ?? 0;
      if (available < row.quantity) {
        shortages.push(`${row.label}: kerak ${row.quantity}, omborda ${available}`);
      }
    }

    if (shortages.length) {
      const wh = warehouse.name || 'Ombor';
      throw new BadRequestException(
        `«${wh}» omborida yetarli qoldiq yo'q — ${shortages.join('; ')}`,
      );
    }
  }

  async getBalances(companyId: string, warehouseId?: string) {
    return this.prisma.stockBalance.findMany({
      where: {
        companyId,
        warehouse: { status: { not: 'ARCHIVED' } },
        ...(warehouseId ? { warehouseId } : {}),
      },
      select: {
        id: true,
        warehouseId: true,
        productVariantId: true,
        quantity: true,
        reservedQuantity: true,
        blockedQuantity: true,
        updatedAt: true,
        warehouse: { select: { id: true, name: true, status: true } },
        productVariant: {
          select: {
            id: true,
            name: true,
            sku: true,
            barcode: true,
            salePrice: true,
            currency: true,
            product: { select: { id: true, name: true, unit: true, imageUrl: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getMovements(companyId: string, warehouseId?: string) {
    return this.prisma.stockMovement.findMany({
      where: {
        companyId,
        warehouse: { status: { not: 'ARCHIVED' } },
        ...(warehouseId ? { warehouseId } : {}),
      },
      include: {
        warehouse: true,
        productVariant: {
          include: { product: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  }

  /**
   * @param externalTx — tashqi `$transaction` callbackidan kelgan `tx` bo‘lsa, ichma-ich
   * yangi `$transaction` ochilmaydi (Prisma "Transaction not found" xatosining sababi bo‘lishi mumkin).
   */
  async recordMovement(
    companyId: string,
    dto: CreateStockMovementDto,
    type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'RESERVE' | 'UNRESERVE',
    sourceType: string,
    userId?: string,
    externalTx?: Prisma.TransactionClient,
    options?: { emitRealtime?: boolean; skipEntityVerify?: boolean },
  ) {
    const skipVerify = options?.skipEntityVerify === true;
    const action = async (client: Prisma.TransactionClient) => {
      let variantUnit: string | undefined;
      let skipDispatchStockGuard = false;

      if (skipVerify) {
        variantUnit = undefined;
      } else {
        const warehouse = await client.warehouse.findFirst({ where: { id: dto.warehouseId, companyId } });
        if (!warehouse) throw new NotFoundException('Ombor topilmadi');

        const variant = await client.productVariant.findFirst({
          where: { id: dto.productVariantId, companyId },
          include: { product: { select: { unit: true } } },
        });
        if (!variant) throw new NotFoundException('Mahsulot varianti topilmadi');
        variantUnit = variant.product?.unit;

        skipDispatchStockGuard =
          type === 'OUT' &&
          sourceType === 'DISPATCH' &&
          this.warehouseSkipsDispatchStockGuard(warehouse);
      }

      const quantity = validateStockQuantity(
        dto.quantity,
        variantUnit,
      );

      // 2. Calculate quantity change
      const quantityChange =
        type === 'OUT' || type === 'RESERVE' ? -quantity : quantity;

      // 3. Update or Create Balance
      const balance = await client.stockBalance.findUnique({
        where: { warehouseId_productVariantId: { warehouseId: dto.warehouseId, productVariantId: dto.productVariantId } }
      });

      if (balance) {
        // Check for negative stock if needed
        if (
          type === 'OUT' &&
          !skipDispatchStockGuard &&
          Number(balance.quantity) - quantity < 0
        ) {
          throw new BadRequestException(
            `Omborda yetarli qoldiq yo'q. Mavjud: ${balance.quantity}`,
          );
        }

        await client.stockBalance.update({
          where: { id: balance.id },
          data: {
            quantity: type === 'RESERVE' || type === 'UNRESERVE' ? undefined : { increment: quantityChange },
            reservedQuantity: type === 'RESERVE' ? { increment: quantity } : 
                             type === 'UNRESERVE' ? { decrement: quantity } : undefined
          }
        });
      } else {
        if (type !== 'IN' && type !== 'ADJUSTMENT') {
          if (skipDispatchStockGuard && type === 'OUT') {
            await client.stockBalance.create({
              data: {
                companyId,
                warehouseId: dto.warehouseId,
                productVariantId: dto.productVariantId,
                quantity: quantityChange,
                reservedQuantity: 0,
              },
            });
          } else {
            throw new BadRequestException(`Omborda mahsulot mavjud emas. Faqat kirim qilish mumkin.`);
          }
        } else {
          await client.stockBalance.create({
            data: {
              companyId,
              warehouseId: dto.warehouseId,
              productVariantId: dto.productVariantId,
              quantity,
              reservedQuantity: 0
            }
          });
        }
      }

      // 4. Record Movement
      const movement = await client.stockMovement.create({
        data: {
          companyId,
          warehouseId: dto.warehouseId,
          productVariantId: dto.productVariantId,
          type,
          quantity,
          sourceType,
          sourceId: dto.sourceId,
          note: dto.note,
          createdBy: userId
        }
      });

      if (sourceType === 'MANUAL' && userId) {
        await client.auditLog.create({
          data: {
            companyId,
            userId,
            action: type === 'IN' ? 'stock.manual_in' : 'stock.manual_out',
            entityType: 'STOCK_MOVEMENT',
            entityId: movement.id,
            newData: {
              warehouseId: dto.warehouseId,
              productVariantId: dto.productVariantId,
              quantity,
              sourceType,
              type,
            } as any,
          },
        });
      }

      return movement;
    };

    const run = async () => {
      if (externalTx) {
        return action(externalTx);
      }
      return this.prisma.$transaction(action, DEFAULT_TX_OPTIONS);
    };

    const movement = await run();

    if (
      sourceType === 'MANUAL' &&
      userId &&
      dto.partnerLedgerContactId &&
      (type === 'IN' || type === 'OUT')
    ) {
      try {
        await this.linkMovementToPartnerLedger(
          companyId,
          userId,
          dto.partnerLedgerContactId,
          movement,
          dto.productVariantId,
          type === 'IN' ? 'IN' : 'OUT',
          dto.note,
        );
      } catch (err) {
        this.logger.warn(
          `Partner ledger link failed for movement ${movement.id}: ${(err as Error).message}`,
        );
        throw err;
      }
    }

    if (options?.emitRealtime !== false) {
      this.emitInventoryChanged(companyId, dto.warehouseId, dto.productVariantId, sourceType);
    }
    return movement;
  }

  /** POS checkout kabi ko‘p qatorli operatsiyadan keyin bir marta chaqiriladi */
  emitInventoryChanged(
    companyId: string,
    warehouseId: string,
    productVariantId: string,
    reason: string,
  ) {
    void this.cache.delByPrefix(posCatalogCachePrefix(companyId, warehouseId || undefined));
    try {
      this.inventoryGateway.emitToCompany(companyId, 'inventory:changed', {
        warehouseId: warehouseId || undefined,
        productVariantId: productVariantId || undefined,
        reason,
      });
      this.inventoryGateway.emitDashboardRefresh(companyId);
    } catch (err) {
      this.logger.warn(`Inventory realtime emit failed: ${(err as Error).message}`);
    }
  }

  /**
   * Bir tranzaksiyada bir nechta chiqim/kirim — har bir qator uchun alohida warehouse/variant tekshiruvi va
   * socket emit qilinmaydi (emitRealtime: false).
   */
  async recordMovements(
    companyId: string,
    movements: CreateStockMovementDto[],
    type: 'IN' | 'OUT',
    sourceType: string,
    userId: string | undefined,
    externalTx: Prisma.TransactionClient,
  ) {
    if (!movements.length) return;
    if (
      type === 'OUT' &&
      sourceType === 'DISPATCH' &&
      movements.length > 1 &&
      movements.every((m) => m.warehouseId === movements[0].warehouseId)
    ) {
      await this.recordDispatchOutBatch(companyId, movements[0].warehouseId, movements, userId, externalTx);
      return;
    }
    if (
      type === 'OUT' &&
      sourceType === 'POS_SALE' &&
      movements.length > 0 &&
      movements.every((m) => m.warehouseId === movements[0].warehouseId)
    ) {
      await this.recordPosSaleOutBatch(
        companyId,
        movements[0].warehouseId,
        movements,
        userId,
        externalTx,
      );
      return;
    }
    for (const dto of movements) {
      await this.recordMovement(
        companyId,
        dto,
        type,
        sourceType,
        userId,
        externalTx,
        { emitRealtime: false },
      );
    }
  }

  /**
   * Bir ombordan ko‘p variant chiqimi (jo‘natma) — warehouse/variant/balance bir martadan.
   */
  async recordDispatchOutBatch(
    companyId: string,
    warehouseId: string,
    movements: CreateStockMovementDto[],
    userId: string | undefined,
    tx: Prisma.TransactionClient,
  ) {
    if (!movements.length) return;

    const warehouse = await tx.warehouse.findFirst({ where: { id: warehouseId, companyId } });
    if (!warehouse) throw new NotFoundException('Ombor topilmadi');

    const skipDispatchStockGuard = this.warehouseSkipsDispatchStockGuard(warehouse);
    const variantIds = [...new Set(movements.map((m) => m.productVariantId))];

    const unitByVariant = await this.loadVariantUnits(tx, companyId, variantIds);
    const variants = await tx.productVariant.findMany({
      where: { id: { in: variantIds }, companyId },
      select: { id: true },
    });
    if (variants.length !== variantIds.length) {
      throw new NotFoundException('Mahsulot varianti topilmadi');
    }

    const balances = await tx.stockBalance.findMany({
      where: { warehouseId, productVariantId: { in: variantIds } },
    });
    const balanceByVariant = new Map(balances.map((b) => [b.productVariantId, b]));

    for (const raw of movements) {
      const dto = this.normalizeMovementDto(raw, unitByVariant);
      const quantityChange = -dto.quantity;
      const balance = balanceByVariant.get(dto.productVariantId);

      if (balance) {
        if (!skipDispatchStockGuard && Number(balance.quantity) - dto.quantity < 0) {
          throw new BadRequestException(`Omborda yetarli qoldiq yo'q. Mavjud: ${balance.quantity}`);
        }
        await tx.stockBalance.update({
          where: { id: balance.id },
          data: { quantity: { increment: quantityChange } },
        });
        balance.quantity = new Prisma.Decimal(
          Number(balance.quantity) + quantityChange,
        );
      } else if (skipDispatchStockGuard) {
        const created = await tx.stockBalance.create({
          data: {
            companyId,
            warehouseId,
            productVariantId: dto.productVariantId,
            quantity: quantityChange,
            reservedQuantity: 0,
          },
        });
        balanceByVariant.set(dto.productVariantId, created);
      } else {
        throw new BadRequestException(`Omborda mahsulot mavjud emas. Faqat kirim qilish mumkin.`);
      }

      await tx.stockMovement.create({
        data: {
          companyId,
          warehouseId,
          productVariantId: dto.productVariantId,
          type: 'OUT',
          quantity: dto.quantity,
          sourceType: 'DISPATCH',
          sourceId: dto.sourceId,
          note: dto.note,
          createdBy: userId,
        },
      });
    }

    this.emitInventoryChanged(companyId, warehouseId, variantIds[0], 'DISPATCH');
  }

  /**
   * POS sotuv — bitta ombordan ko‘p qator chiqim (warehouse/variant/balance bir martadan).
   */
  async recordPosSaleOutBatch(
    companyId: string,
    warehouseId: string,
    movements: CreateStockMovementDto[],
    userId: string | undefined,
    tx: Prisma.TransactionClient,
  ) {
    if (!movements.length) return;

    const warehouse = await tx.warehouse.findFirst({ where: { id: warehouseId, companyId } });
    if (!warehouse) throw new NotFoundException('Ombor topilmadi');

    const variantIds = [...new Set(movements.map((m) => m.productVariantId))];
    const unitByVariant = await this.loadVariantUnits(tx, companyId, variantIds);
    const normalizedMovements = movements.map((m) =>
      this.normalizeMovementDto(m, unitByVariant),
    );
    const variants = await tx.productVariant.findMany({
      where: { id: { in: variantIds }, companyId },
      select: { id: true },
    });
    if (variants.length !== variantIds.length) {
      throw new NotFoundException('Mahsulot varianti topilmadi');
    }

    const balances = await tx.stockBalance.findMany({
      where: { warehouseId, productVariantId: { in: variantIds } },
    });
    const balanceByVariant = new Map(balances.map((b) => [b.productVariantId, b]));

    const requiredByVariant = new Map<string, number>();
    for (const dto of normalizedMovements) {
      requiredByVariant.set(
        dto.productVariantId,
        (requiredByVariant.get(dto.productVariantId) ?? 0) + dto.quantity,
      );
    }
    for (const [variantId, required] of requiredByVariant) {
      const balance = balanceByVariant.get(variantId);
      const available = balance ? Number(balance.quantity) : 0;
      if (available < required) {
        throw new BadRequestException(
          `Omborda yetarli qoldiq yo'q. Mavjud: ${available}, kerak: ${required}`,
        );
      }
    }

    for (const dto of normalizedMovements) {
      const quantityChange = -dto.quantity;
      const balance = balanceByVariant.get(dto.productVariantId)!;
      await tx.stockBalance.update({
        where: { id: balance.id },
        data: { quantity: { increment: quantityChange } },
      });
      balance.quantity = new Prisma.Decimal(
        Number(balance.quantity) + quantityChange,
      );

      await tx.stockMovement.create({
        data: {
          companyId,
          warehouseId,
          productVariantId: dto.productVariantId,
          type: 'OUT',
          quantity: dto.quantity,
          sourceType: 'POS_SALE',
          sourceId: dto.sourceId,
          note: dto.note,
          createdBy: userId,
        },
      });
    }
  }

  /**
   * Ko‘p qatorli yuk qabul — ombor/variant/balance bir martadan, har qator uchun alohida IN harakati.
   */
  async recordGoodsReceiptInBatch(
    companyId: string,
    warehouseId: string,
    movements: CreateStockMovementDto[],
    userId: string | undefined,
    tx: Prisma.TransactionClient,
  ) {
    if (!movements.length) return;

    const warehouse = await tx.warehouse.findFirst({ where: { id: warehouseId, companyId } });
    if (!warehouse) throw new NotFoundException('Ombor topilmadi');

    const variantIds = [...new Set(movements.map((m) => m.productVariantId))];
    const unitByVariant = await this.loadVariantUnits(tx, companyId, variantIds);
    const normalizedMovements = movements.map((m) =>
      this.normalizeMovementDto(m, unitByVariant),
    );
    const variants = await tx.productVariant.findMany({
      where: { id: { in: variantIds }, companyId },
      select: { id: true },
    });
    if (variants.length !== variantIds.length) {
      throw new NotFoundException('Mahsulot varianti topilmadi');
    }

    const balances = await tx.stockBalance.findMany({
      where: { warehouseId, productVariantId: { in: variantIds } },
    });
    const balanceByVariant = new Map(balances.map((b) => [b.productVariantId, b]));

    const incrementByVariant = new Map<string, number>();
    for (const dto of normalizedMovements) {
      incrementByVariant.set(
        dto.productVariantId,
        (incrementByVariant.get(dto.productVariantId) || 0) + dto.quantity,
      );
    }

    for (const [variantId, inc] of incrementByVariant) {
      const balance = balanceByVariant.get(variantId);
      if (balance) {
        await tx.stockBalance.update({
          where: { id: balance.id },
          data: { quantity: { increment: inc } },
        });
      } else {
        await tx.stockBalance.create({
          data: {
            companyId,
            warehouseId,
            productVariantId: variantId,
            quantity: inc,
            reservedQuantity: 0,
          },
        });
      }
    }

    await tx.stockMovement.createMany({
      data: normalizedMovements.map((dto) => ({
        companyId,
        warehouseId,
        productVariantId: dto.productVariantId,
        type: 'IN' as const,
        quantity: dto.quantity,
        sourceType: 'GOODS_RECEIPT',
        sourceId: dto.sourceId,
        note: dto.note,
        createdBy: userId,
      })),
    });
  }

  async adjustStock(companyId: string, dto: CreateStockAdjustmentDto, userId: string) {
    const signedQty = Number(dto.quantity);
    if (!Number.isFinite(signedQty) || signedQty === 0) {
      throw new BadRequestException('Tuzatish miqdori 0 bo\'lishi mumkin emas');
    }

    // Musbat = kirim (IN), manfiy = chiqim (OUT). Math.abs faqat harakat yozuvidagi miqdor uchun.
    const movementType = signedQty > 0 ? 'IN' : 'OUT';
    const movementQty = Math.abs(signedQty);

    return this.prisma.$transaction(async (tx) => {
      const movement = await this.recordMovement(
        companyId, 
        {
          warehouseId: dto.warehouseId,
          productVariantId: dto.productVariantId,
          quantity: movementQty,
          note: dto.note
        },
        movementType,
        'ADJUSTMENT',
        userId,
        tx
      );

      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: 'stock.adjusted',
          entityType: 'STOCK_BALANCE',
          entityId: dto.warehouseId + '_' + dto.productVariantId,
          newData: dto as any
        }
      });

      return movement;
    }, DEFAULT_TX_OPTIONS).then(async (movement) => {
      if (dto.partnerLedgerContactId) {
        await this.linkMovementToPartnerLedger(
          companyId,
          userId,
          dto.partnerLedgerContactId,
          movement,
          dto.productVariantId,
          movementType,
          dto.note,
        );
      }
      return movement;
    });
  }

  async transferStock(companyId: string, dto: CreateStockTransferDto, userId: string) {
    if (dto.fromWarehouseId === dto.toWarehouseId) {
      throw new BadRequestException('Manba va manzil ombori bir xil bo\'lishi mumkin emas');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Record OUT from source
      await this.recordMovement(
        companyId,
        {
          warehouseId: dto.fromWarehouseId,
          productVariantId: dto.productVariantId,
          quantity: dto.quantity,
          note: `Transfer to ${dto.toWarehouseId}. ${dto.note || ''}`
        },
        'OUT',
        'TRANSFER',
        userId,
        tx
      );

      // 2. Record IN to destination
      const destinationMovement = await this.recordMovement(
        companyId,
        {
          warehouseId: dto.toWarehouseId,
          productVariantId: dto.productVariantId,
          quantity: dto.quantity,
          note: `Transfer from ${dto.fromWarehouseId}. ${dto.note || ''}`
        },
        'IN',
        'TRANSFER',
        userId,
        tx
      );

      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: 'stock.transferred',
          entityType: 'STOCK_TRANSFER',
          entityId: destinationMovement.id,
          newData: {
            fromWarehouseId: dto.fromWarehouseId,
            toWarehouseId: dto.toWarehouseId,
            productVariantId: dto.productVariantId,
            quantity: dto.quantity,
          } as any,
        }
      });

      return destinationMovement;
    }, DEFAULT_TX_OPTIONS);
  }
}
