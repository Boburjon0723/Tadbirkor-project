import {
  Injectable,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface FreeStockResult {
  onHand: number;
  reserved: number;
  blocked: number;
  free: number;
  canFulfill: (qty: number) => boolean;
}

export interface ReservationItem {
  productVariantId: string;
  warehouseId: string;
  quantity: number;
}

export interface CreateReservationResult {
  success: boolean;
  failedItems: Array<{ productVariantId: string; reason: string }>;
}

export interface PartialReservationResult extends CreateReservationResult {
  reservedLines: Array<{ productVariantId: string; quantity: number; warehouseId: string }>;
  isFull: boolean;
}

@Injectable()
export class AtpService {
  private readonly logger = new Logger(AtpService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Berilgan mahsulot uchun erkin qoldiqni hisoblash
   * freeToPromise = onHand - reserved - blocked
   */
  async getFreeStock(
    productVariantId: string,
    warehouseId: string,
    companyId: string,
    externalTx?: Prisma.TransactionClient,
  ): Promise<FreeStockResult> {
    const client = externalTx ?? this.prisma;

    const balance = await client.stockBalance.findUnique({
      where: {
        warehouseId_productVariantId: { warehouseId, productVariantId },
      },
      select: {
        quantity: true,
        reservedQuantity: true,
        blockedQuantity: true,
      },
    });

    const onHand = Number(balance?.quantity ?? 0);
    const reserved = Number(balance?.reservedQuantity ?? 0);
    const blocked = Number(balance?.blockedQuantity ?? 0);
    const free = Math.max(0, onHand - reserved - blocked);

    return {
      onHand,
      reserved,
      blocked,
      free,
      canFulfill: (qty: number) => free >= qty,
    };
  }

  /**
   * Ko'p variant uchun bir vaqtda erkin qoldiqni hisoblash (batch)
   */
  async getBatchFreeStock(
    companyId: string,
    warehouseId: string,
    productVariantIds: string[],
  ): Promise<Map<string, FreeStockResult>> {
    if (!productVariantIds.length) return new Map();

    const balances = await this.prisma.stockBalance.findMany({
      where: {
        companyId,
        warehouseId,
        productVariantId: { in: productVariantIds },
      },
      select: {
        productVariantId: true,
        quantity: true,
        reservedQuantity: true,
        blockedQuantity: true,
      },
    });

    const balanceMap = new Map(balances.map((b) => [b.productVariantId, b]));

    const result = new Map<string, FreeStockResult>();
    for (const variantId of productVariantIds) {
      const b = balanceMap.get(variantId);
      const onHand = Number(b?.quantity ?? 0);
      const reserved = Number(b?.reservedQuantity ?? 0);
      const blocked = Number(b?.blockedQuantity ?? 0);
      const free = Math.max(0, onHand - reserved - blocked);

      result.set(variantId, {
        onHand,
        reserved,
        blocked,
        free,
        canFulfill: (qty: number) => free >= qty,
      });
    }

    return result;
  }

  /**
   * Buyurtma tasdiqlanganda rezerv qo'yish.
   * Barcha items uchun yetarli stock bo'lsa muvaffaqiyatli.
   * Ba'zi items yetarli bo'lmasa failedItems qaytariladi.
   */
  async createReservation(
    orderId: string,
    companyId: string,
    items: ReservationItem[],
    externalTx?: Prisma.TransactionClient,
  ): Promise<CreateReservationResult> {
    const failedItems: Array<{ productVariantId: string; reason: string }> = [];

    const execute = async (tx: Prisma.TransactionClient) => {
      for (const item of items) {
        if (!item.productVariantId || item.quantity <= 0) continue;

        const stock = await this.getFreeStock(
          item.productVariantId,
          item.warehouseId,
          companyId,
          tx,
        );

        // Inventarizatsiya bloki tekshiruvi
        if (stock.blocked > 0) {
          failedItems.push({
            productVariantId: item.productVariantId,
            reason: `Inventarizatsiya bloki mavjud (${stock.blocked} dona bloklangan)`,
          });
          continue;
        }

        // Yetarli erkin qoldiq tekshiruvi
        if (!stock.canFulfill(item.quantity)) {
          failedItems.push({
            productVariantId: item.productVariantId,
            reason: `Yetarli qoldiq yo'q: kerak ${item.quantity}, erkin ${stock.free}`,
          });
          continue;
        }

        // Rezerv yozuvi yaratish
        await tx.stockReservation.create({
          data: {
            companyId,
            warehouseId: item.warehouseId,
            productVariantId: item.productVariantId,
            orderId,
            quantity: item.quantity,
            status: 'ACTIVE',
          },
        });

        // StockBalance.reservedQuantity oshirish
        await tx.stockBalance.update({
          where: {
            warehouseId_productVariantId: {
              warehouseId: item.warehouseId,
              productVariantId: item.productVariantId,
            },
          },
          data: {
            reservedQuantity: { increment: item.quantity },
          },
        });
      }
    };

    if (externalTx) {
      await execute(externalTx);
    } else {
      await this.prisma.$transaction(execute, { timeout: 15000 });
    }

    return {
      success: failedItems.length === 0,
      failedItems,
    };
  }

  /**
   * Qisman rezerv: har qator uchun mavjud erkin qoldiqcha rezerv qiladi.
   */
  async createPartialReservation(
    orderId: string,
    companyId: string,
    items: ReservationItem[],
    externalTx?: Prisma.TransactionClient,
  ): Promise<PartialReservationResult> {
    const failedItems: Array<{ productVariantId: string; reason: string }> = [];
    const reservedLines: Array<{ productVariantId: string; quantity: number; warehouseId: string }> = [];

    const execute = async (tx: Prisma.TransactionClient) => {
      for (const item of items) {
        if (!item.productVariantId || item.quantity <= 0) continue;

        const stock = await this.getFreeStock(
          item.productVariantId,
          item.warehouseId,
          companyId,
          tx,
        );

        if (stock.blocked > 0) {
          failedItems.push({
            productVariantId: item.productVariantId,
            reason: `Inventarizatsiya bloki (${stock.blocked} dona)`,
          });
          continue;
        }

        const reserveQty = Math.min(item.quantity, stock.free);
        if (reserveQty <= 0) {
          failedItems.push({
            productVariantId: item.productVariantId,
            reason: `Erkin qoldiq yo'q: kerak ${item.quantity}`,
          });
          continue;
        }

        await tx.stockReservation.create({
          data: {
            companyId,
            warehouseId: item.warehouseId,
            productVariantId: item.productVariantId,
            orderId,
            quantity: reserveQty,
            status: 'ACTIVE',
          },
        });

        await tx.stockBalance.update({
          where: {
            warehouseId_productVariantId: {
              warehouseId: item.warehouseId,
              productVariantId: item.productVariantId,
            },
          },
          data: { reservedQuantity: { increment: reserveQty } },
        });

        reservedLines.push({
          productVariantId: item.productVariantId,
          quantity: reserveQty,
          warehouseId: item.warehouseId,
        });

        if (reserveQty < item.quantity) {
          failedItems.push({
            productVariantId: item.productVariantId,
            reason: `Qisman: ${reserveQty} / ${item.quantity} rezerv qilindi`,
          });
        }
      }
    };

    if (externalTx) {
      await execute(externalTx);
    } else {
      await this.prisma.$transaction(execute, { timeout: 15000 });
    }

    const isFull =
      failedItems.length === 0 &&
      reservedLines.length === items.filter((i) => i.productVariantId && i.quantity > 0).length;

    return {
      success: reservedLines.length > 0,
      failedItems,
      reservedLines,
      isFull,
    };
  }

  /**
   * PGI yoki buyurtma bekor qilinganda rezervni bo'shatish.
   * type: 'RELEASED' — bekor qilindi, 'CONSUMED' — PGI bajarildi
   */
  async releaseReservation(
    orderId: string,
    type: 'RELEASED' | 'CONSUMED',
    externalTx?: Prisma.TransactionClient,
  ): Promise<void> {
    const execute = async (tx: Prisma.TransactionClient) => {
      const reservations = await tx.stockReservation.findMany({
        where: { orderId, status: 'ACTIVE' },
        select: {
          id: true,
          warehouseId: true,
          productVariantId: true,
          quantity: true,
        },
      });

      if (!reservations.length) return;

      for (const res of reservations) {
        // Rezerv statusini yangilash
        await tx.stockReservation.update({
          where: { id: res.id },
          data: { status: type },
        });

        // StockBalance.reservedQuantity kamaytirish
        await tx.stockBalance.update({
          where: {
            warehouseId_productVariantId: {
              warehouseId: res.warehouseId,
              productVariantId: res.productVariantId,
            },
          },
          data: {
            reservedQuantity: { decrement: Number(res.quantity) },
          },
        });
      }

      this.logger.log(
        `Rezerv ${type}: orderId=${orderId}, ${reservations.length} ta yozuv`,
      );
    };

    if (externalTx) {
      await execute(externalTx);
    } else {
      await this.prisma.$transaction(execute, { timeout: 15000 });
    }
  }

  /**
   * Buyurtma qatorlari uchun eng mos omborni tanlash (to'liq bajarish ustuvor).
   */
  async resolveWarehouseForOrder(
    companyId: string,
    items: Array<{ productVariantId: string; quantity: number }>,
  ): Promise<string | null> {
    if (!items.length) return null;

    const warehouses = await this.prisma.warehouse.findMany({
      where: { companyId, status: 'ACTIVE' },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!warehouses.length) return null;

    let bestId: string | null = null;
    let bestScore = -1;

    for (const warehouse of warehouses) {
      const stockMap = await this.getBatchFreeStock(
        companyId,
        warehouse.id,
        items.map((i) => i.productVariantId),
      );

      let fulfilled = 0;
      let canFulfillAll = true;
      for (const item of items) {
        const stock = stockMap.get(item.productVariantId);
        if (stock?.canFulfill(item.quantity)) fulfilled += 1;
        else canFulfillAll = false;
      }

      const score = canFulfillAll ? 10_000 + fulfilled : fulfilled;
      if (score > bestScore) {
        bestScore = score;
        bestId = warehouse.id;
      }
    }

    return bestId;
  }

  /**
   * Jo'natma (PGI) bo'yicha rezervdan qisman yoki to'liq yechish.
   */
  async consumeReservationForShipment(
    orderId: string,
    items: Array<{ productVariantId: string; quantity: number }>,
    externalTx?: Prisma.TransactionClient,
  ): Promise<void> {
    const execute = async (tx: Prisma.TransactionClient) => {
      for (const item of items) {
        if (!item.productVariantId || item.quantity <= 0) continue;

        let remaining = item.quantity;
        const reservations = await tx.stockReservation.findMany({
          where: {
            orderId,
            productVariantId: item.productVariantId,
            status: 'ACTIVE',
          },
          orderBy: { createdAt: 'asc' },
        });

        for (const res of reservations) {
          if (remaining <= 0) break;

          const resQty = Number(res.quantity);
          const take = Math.min(resQty, remaining);
          remaining -= take;

          if (take >= resQty) {
            await tx.stockReservation.update({
              where: { id: res.id },
              data: { status: 'CONSUMED' },
            });
          } else {
            await tx.stockReservation.update({
              where: { id: res.id },
              data: { quantity: { decrement: take } },
            });
          }

          await tx.stockBalance.update({
            where: {
              warehouseId_productVariantId: {
                warehouseId: res.warehouseId,
                productVariantId: res.productVariantId,
              },
            },
            data: { reservedQuantity: { decrement: take } },
          });
        }

        if (remaining > 0) {
          throw new BadRequestException(
            `Rezerv yetarli emas: variant ${item.productVariantId}, kerak yana ${remaining}`,
          );
        }
      }
    };

    if (externalTx) {
      await execute(externalTx);
    } else {
      await this.prisma.$transaction(execute, { timeout: 15000 });
    }
  }

  /**
   * Buyurtma uchun mavjud rezervlar borligini tekshirish
   */
  async hasActiveReservations(orderId: string): Promise<boolean> {
    const count = await this.prisma.stockReservation.count({
      where: { orderId, status: 'ACTIVE' },
    });
    return count > 0;
  }

  /**
   * Buyurtma items uchun ATP holati tekshiruvi (accept oldidan)
   * Barcha items uchun yetarli stock bo'lishi kerak
   */
  async assertCanFulfillOrder(
    orderId: string,
    companyId: string,
    warehouseId: string,
    items: Array<{ productVariantId: string | null; quantity: number; productNameSnapshot: string }>,
    externalTx?: Prisma.TransactionClient,
  ): Promise<void> {
    const mappedItems = items.filter((i) => i.productVariantId);

    if (!mappedItems.length) return; // Mapping yo'q — ATP tekshiruvi o'tkazib yuboriladi

    const client = externalTx ?? this.prisma;
    const variantIds = mappedItems.map((i) => i.productVariantId!);

    const balances = await client.stockBalance.findMany({
      where: { companyId, warehouseId, productVariantId: { in: variantIds } },
      select: {
        productVariantId: true,
        quantity: true,
        reservedQuantity: true,
        blockedQuantity: true,
      },
    });

    const balanceMap = new Map(balances.map((b) => [b.productVariantId, b]));
    const shortages: string[] = [];
    const blocked: string[] = [];

    for (const item of mappedItems) {
      const b = balanceMap.get(item.productVariantId!);
      const onHand = Number(b?.quantity ?? 0);
      const reserved = Number(b?.reservedQuantity ?? 0);
      const blockedQty = Number(b?.blockedQuantity ?? 0);
      const free = Math.max(0, onHand - reserved - blockedQty);

      if (blockedQty > 0) {
        blocked.push(`${item.productNameSnapshot}: inventarizatsiya bloki mavjud`);
        continue;
      }

      if (free < item.quantity) {
        shortages.push(
          `${item.productNameSnapshot}: kerak ${item.quantity}, erkin ${free}`,
        );
      }
    }

    if (blocked.length) {
      throw new ConflictException(
        `Quyidagi mahsulotlar inventarizatsiya blokida: ${blocked.join('; ')}`,
      );
    }

    if (shortages.length) {
      throw new BadRequestException(
        `Yetarli qoldiq yo'q: ${shortages.join('; ')}`,
      );
    }
  }
}
