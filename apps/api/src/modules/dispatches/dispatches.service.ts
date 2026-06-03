import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { parseListPagination } from '../../common/list-pagination.util';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DEFAULT_TX_OPTIONS, LONG_TX_OPTIONS } from '../../prisma/transaction-options';
import { CreateDispatchDto } from './dto/create-dispatch.dto';
import { StockService } from '../warehouses/stock.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AppCacheService } from '../../common/cache/app-cache.service';
import { InventoryGateway } from '../warehouses/inventory.gateway';
import { AtpService } from '../warehouses/atp.service';
import { PickingService } from './picking.service';

type PrismaTx = Prisma.TransactionClient;

@Injectable()
export class DispatchesService {
  constructor(
    private prisma: PrismaService,
    private stockService: StockService,
    private notificationsService: NotificationsService,
    private cache: AppCacheService,
    private inventoryGateway: InventoryGateway,
    private atpService: AtpService,
    private pickingService: PickingService,
  ) {}

  private invalidateOrderCaches(buyerCompanyId: string, sellerCompanyId: string, orderId: string) {
    for (const companyId of [buyerCompanyId, sellerCompanyId]) {
      void this.cache.del(`orders:hub:${companyId}`);
      void this.cache.delByPrefix(`orders:list:${companyId}:`);
      try {
        this.inventoryGateway.emitOrdersChanged(companyId, {
          orderId,
          reason: 'dispatch.sent',
        });
      } catch {
        /* ignore */
      }
    }
  }

  private async generateDispatchNumber(companyId: string, tx: PrismaTx): Promise<string> {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    const d = String(now.getUTCDate()).padStart(2, '0');
    const dateStr = `${y}${m}${d}`;

    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

    const todayCount = await tx.dispatch.count({
      where: {
        sellerCompanyId: companyId,
        createdAt: { gte: startOfDay, lte: endOfDay },
      },
    });

    const seq = String(todayCount + 1).padStart(6, '0');
    return `DSP-${dateStr}-${seq}`;
  }

  private async getSentQtyByVariant(
    orderId: string,
    client: PrismaService | PrismaTx = this.prisma,
  ): Promise<Map<string, number>> {
    const rows = await client.dispatchItem.findMany({
      where: { dispatch: { orderId, status: 'SENT' } },
      select: { productVariantId: true, quantity: true },
    });
    const m = new Map<string, number>();
    for (const row of rows) {
      const q = Number(row.quantity);
      m.set(row.productVariantId, (m.get(row.productVariantId) || 0) + q);
    }
    return m;
  }

  private remainingQty(
    orderedQty: number,
    variantId: string | null,
    sentByVariant: Map<string, number>,
  ): number {
    if (!variantId) return 0;
    const sent = sentByVariant.get(variantId) ?? 0;
    return Math.max(0, orderedQty - sent);
  }

  private async resolveDispatchLines(
    orderId: string,
    orderItems: Array<{
      id: string;
      productVariantId: string | null;
      productNameSnapshot: string;
      quantity: unknown;
    }>,
    dto: CreateDispatchDto,
  ): Promise<
    Array<{
      productVariantId: string;
      productNameSnapshot: string;
      quantity: number;
    }>
  > {
    const sentByVariant = await this.getSentQtyByVariant(orderId);
    const orderById = new Map(orderItems.map((i) => [i.id, i]));

    if (dto.items?.length) {
      const lines: Array<{
        productVariantId: string;
        productNameSnapshot: string;
        quantity: number;
      }> = [];

      for (const row of dto.items) {
        const qty = Number(row.quantity);
        if (!Number.isFinite(qty) || qty <= 0) continue;

        const oi = orderById.get(row.orderItemId);
        if (!oi) {
          throw new BadRequestException(`Buyurtma qatori topilmadi: ${row.orderItemId}`);
        }
        if (!oi.productVariantId) {
          throw new BadRequestException(`Mahsulot ID-si topilmadi: ${oi.productNameSnapshot}`);
        }
        const maxQty = this.remainingQty(
          Number(oi.quantity),
          oi.productVariantId,
          sentByVariant,
        );
        if (maxQty <= 0) {
          throw new BadRequestException(
            `${oi.productNameSnapshot} uchun qolgan jo‘natiladigan miqdor yo‘q`,
          );
        }
        if (qty > maxQty) {
          throw new BadRequestException(
            `Jo'natma miqdori qolgan miqdordan oshib ketdi (${oi.productNameSnapshot}: max ${maxQty})`,
          );
        }

        lines.push({
          productVariantId: oi.productVariantId,
          productNameSnapshot: oi.productNameSnapshot,
          quantity: qty,
        });
      }

      if (lines.length === 0) {
        throw new BadRequestException('Kamida bitta mahsulot uchun jo‘natma miqdori 0 dan katta bo‘lishi kerak');
      }
      return lines;
    }

    return orderItems
      .filter((i) => i.productVariantId && Number(i.quantity) > 0)
      .map((item) => {
        const remaining = this.remainingQty(
          Number(item.quantity),
          item.productVariantId,
          sentByVariant,
        );
        return {
          productVariantId: item.productVariantId!,
          productNameSnapshot: item.productNameSnapshot,
          quantity: remaining,
        };
      })
      .filter((line) => line.quantity > 0);
  }

  private async assertCanCreateDispatch(order: { id: string; status: string; items: Array<{ productVariantId: string | null; quantity: unknown }> }) {
    const sentByVariant = await this.getSentQtyByVariant(order.id);
    const hasRemaining = order.items.some((i) => {
      if (!i.productVariantId) return false;
      return this.remainingQty(Number(i.quantity), i.productVariantId, sentByVariant) > 0;
    });
    if (!hasRemaining) {
      throw new BadRequestException('Buyurtmadagi barcha mahsulotlar allaqachon jo‘natilgan');
    }
    if (
      !['ACCEPTED', 'PARTIAL_ACCEPTED', 'PARTIALLY_DISPATCHED', 'DISPATCHED', 'RECEIVED'].includes(
        order.status,
      )
    ) {
      throw new BadRequestException('Buyurtma holati jo‘natma yaratish uchun mos emas');
    }
  }

  async create(companyId: string, userId: string, dto: CreateDispatchDto) {
    const order = await this.prisma.b2BOrder.findFirst({
      where: { id: dto.orderId, sellerCompanyId: companyId },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('Buyurtma topilmadi');
    }

    const hasUnmapped = order.items.some(
      (item) => !item.productVariantId && item.mappingStatus !== 'MAPPED',
    );
    if (hasUnmapped) {
      throw new BadRequestException('Buyurtmadagi barcha mahsulotlar mapping qilingan bo‘lishi shart');
    }

    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: dto.warehouseId, companyId },
    });
    if (!warehouse) {
      throw new NotFoundException('Ombor topilmadi');
    }

    await this.assertCanCreateDispatch(order);
    const dispatchLines = await this.resolveDispatchLines(order.id, order.items, dto);
    if (dispatchLines.length === 0) {
      throw new BadRequestException('Jo‘natish uchun qolgan miqdor topilmadi');
    }

    await this.stockService.assertDispatchStockAvailable(
      companyId,
      dto.warehouseId,
      dispatchLines.map((line) => ({
        productVariantId: line.productVariantId,
        quantity: line.quantity,
        label: line.productNameSnapshot,
      })),
    );

    const existingDraft = await this.prisma.dispatch.findFirst({
      where: {
        orderId: dto.orderId,
        sellerCompanyId: companyId,
        status: 'DRAFT',
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existingDraft) {
      if (!dto.items?.length) {
        return this.prisma.dispatch.findFirst({
          where: { id: existingDraft.id },
          include: { items: true },
        });
      }
    }

    const hasOrderReservation = await this.atpService.hasActiveReservations(dto.orderId);

    try {
      const dispatch = await this.prisma.$transaction(async (tx) => {
        if (existingDraft) {
          await this.pickingService.deleteTasksForDispatch(existingDraft.id, tx);
          await tx.dispatch.delete({ where: { id: existingDraft.id } });
        }

        if (hasOrderReservation) {
          const sampleReservation = await tx.stockReservation.findFirst({
            where: { orderId: dto.orderId, status: 'ACTIVE' },
            select: { warehouseId: true },
          });
          if (sampleReservation && sampleReservation.warehouseId !== dto.warehouseId) {
            throw new BadRequestException(
              "Jo'natma ombori buyurtma rezervi qilingan ombor bilan bir xil bo'lishi kerak",
            );
          }
        }
        if (!hasOrderReservation) {
          const reservation = await this.atpService.createReservation(
            dto.orderId,
            companyId,
            dispatchLines.map((line) => ({
              productVariantId: line.productVariantId,
              warehouseId: dto.warehouseId,
              quantity: line.quantity,
            })),
            tx,
          );

          if (!reservation.success) {
            throw new BadRequestException(
              `Rezerv yaratib bo'lmadi: ${reservation.failedItems.map((item) => item.reason).join('; ')}`,
            );
          }
        }

        const dispatchNumber = await this.generateDispatchNumber(companyId, tx);
        const dispatch = await tx.dispatch.create({
          data: {
            dispatchNumber,
            orderId: dto.orderId,
            sellerCompanyId: companyId,
            buyerCompanyId: order.buyerCompanyId,
            warehouseId: dto.warehouseId,
            status: 'DRAFT',
            createdBy: userId,
            items: {
              create: dispatchLines.map((line) => ({
                productVariantId: line.productVariantId,
                productNameSnapshot: line.productNameSnapshot,
                quantity: line.quantity,
              })),
            },
          },
          include: { items: true },
        });

        return dispatch;
      }, {
        ...LONG_TX_OPTIONS,
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      });

      await this.pickingService.createPickTasksForDispatch(dispatch.id);

      return dispatch;
    } catch (dbError) {
      console.error('CRITICAL DATABASE ERROR during dispatch creation:', dbError);
      throw dbError;
    }
  }

  async send(id: string, companyId: string, userId: string) {
    const head = await this.prisma.dispatch.findFirst({
      where: { id, sellerCompanyId: companyId },
      select: { status: true },
    });
    if (!head) throw new NotFoundException('Jo‘natma topilmadi');
    if (head.status === 'SENT') {
      return { success: true };
    }
    if (head.status !== 'DRAFT') {
      throw new BadRequestException('Jo‘natma yuborish mumkin emas');
    }

    const dispatchHead = await this.prisma.dispatch.findFirst({
      where: { id, sellerCompanyId: companyId, status: 'DRAFT' },
      select: {
        id: true,
        dispatchNumber: true,
        orderId: true,
        warehouseId: true,
        buyerCompanyId: true,
        sellerCompanyId: true,
        items: {
          select: {
            productVariantId: true,
            productNameSnapshot: true,
            quantity: true,
          },
        },
      },
    });

    if (!dispatchHead) {
      const sent = await this.prisma.dispatch.findFirst({
        where: { id, sellerCompanyId: companyId, status: 'SENT' },
        select: { id: true },
      });
      if (sent) return { success: true };
      throw new NotFoundException('Jo‘natma topilmadi yoki allaqachon yuborilgan');
    }

    const seller = await this.prisma.company.findUnique({
      where: { id: dispatchHead.sellerCompanyId },
      select: { name: true },
    });

    const orderItems = await this.prisma.b2BOrderItem.findMany({
      where: { orderId: dispatchHead.orderId },
      select: { productVariantId: true, quantity: true },
    });
    const orderedByVariant = new Map(
      orderItems
        .filter((o) => o.productVariantId)
        .map((o) => [o.productVariantId!, Number(o.quantity)]),
    );
    const isPartialShipment = dispatchHead.items.some((di) => {
      const ordered = orderedByVariant.get(di.productVariantId) ?? 0;
      return ordered > 0 && Number(di.quantity) < ordered;
    });

    await this.stockService.assertDispatchStockAvailable(
      companyId,
      dispatchHead.warehouseId,
      dispatchHead.items.map((item) => ({
        productVariantId: item.productVariantId,
        quantity: Number(item.quantity),
        label: item.productNameSnapshot,
      })),
    );

    await this.pickingService.assertDispatchPicked(id);

    await this.prisma.$transaction(
      async (tx) => {
        const movements = dispatchHead.items.map((item) => ({
          warehouseId: dispatchHead.warehouseId,
          productVariantId: item.productVariantId,
          quantity: Number(item.quantity),
          note: `Dispatch ${dispatchHead.dispatchNumber}`,
        }));

        await this.stockService.recordMovements(
          companyId,
          movements,
          'OUT',
          'DISPATCH',
          userId,
          tx,
        );

        // ATP: jo'natilgan miqdor bo'yicha rezervni yechish (PGI)
        await this.atpService.consumeReservationForShipment(
          dispatchHead.orderId,
          dispatchHead.items.map((item) => ({
            productVariantId: item.productVariantId,
            quantity: Number(item.quantity),
          })),
          tx,
        );

        await tx.dispatch.update({
          where: { id },
          data: { status: 'SENT', sentAt: new Date() },
        });

        const sentByVariant = await this.getSentQtyByVariant(dispatchHead.orderId, tx);
        const orderItems = await tx.b2BOrderItem.findMany({
          where: { orderId: dispatchHead.orderId },
          select: { productVariantId: true, quantity: true },
        });
        const fullyDispatched = orderItems.every((item) => {
          if (!item.productVariantId) return true;
          const sent = sentByVariant.get(item.productVariantId) ?? 0;
          return sent >= Number(item.quantity);
        });

        await tx.b2BOrder.update({
          where: { id: dispatchHead.orderId },
          data: { status: fullyDispatched ? 'DISPATCHED' : 'PARTIALLY_DISPATCHED' },
        });

        await tx.goodsReceipt.create({
          data: {
            orderId: dispatchHead.orderId,
            dispatchId: id,
            buyerCompanyId: dispatchHead.buyerCompanyId,
            sellerCompanyId: dispatchHead.sellerCompanyId,
            status: 'PENDING',
            items: {
              create: dispatchHead.items.map((item) => ({
                productVariantId: item.productVariantId,
                productNameSnapshot: item.productNameSnapshot,
                quantity: item.quantity,
              })),
            },
          },
        });

        await tx.auditLog.create({
          data: {
            companyId,
            userId,
            action: 'dispatch.sent',
            entityType: 'DISPATCH',
            entityId: id,
          },
        });
      },
      {
        maxWait: 10000,
        timeout: 45000,
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      },
    );

    void this.notificationsService
      .notifyCompany(
        dispatchHead.buyerCompanyId,
        isPartialShipment ? 'Qisman yuk yuborildi' : 'Yuk yuborildi',
        isPartialShipment
          ? `${seller?.name || 'Sotuvchi'} buyurtmadan kamroq miqdorda yuk jo'natdi (qisman jo'natma). Qabul qilishni kuting.`
          : `${seller?.name || 'Sotuvchi'} tomonidan yuk jo'natildi. Qabul qilishni kuting.`,
        'INFO',
        {
          moduleKey: 'WAREHOUSE',
          eventKey: isPartialShipment ? 'dispatch.sent.partial' : 'dispatch.sent',
          details: {
            dispatchId: id,
            dispatchNumber: dispatchHead.dispatchNumber,
            seller: seller?.name || dispatchHead.sellerCompanyId,
            status: 'SENT',
            isPartialShipment,
          },
          targetRoles: ['OWNER', 'MANAGER', 'WAREHOUSE'],
        },
      )
      .catch((err) => console.error('dispatch.sent notification failed', err));

    this.invalidateOrderCaches(
      dispatchHead.buyerCompanyId,
      dispatchHead.sellerCompanyId,
      dispatchHead.orderId,
    );

    return { success: true };
  }

  /** Yaratish + yuborish — bitta API chaqiruvi (UI tezroq) */
  async createAndSend(companyId: string, userId: string, dto: CreateDispatchDto) {
    const dispatch = await this.create(companyId, userId, dto);
    if (dispatch.status === 'SENT') {
      return { success: true, dispatchId: dispatch.id };
    }
    await this.send(dispatch.id, companyId, userId);
    return { success: true, dispatchId: dispatch.id };
  }

  async cancel(id: string, companyId: string, userId: string) {
    const dispatch = await this.prisma.dispatch.findFirst({
      where: { id, sellerCompanyId: companyId, status: 'DRAFT' }
    });

    if (!dispatch) throw new NotFoundException('Jo‘natma topilmadi yoki bekor qilib bo‘lmaydi');

    return this.prisma.$transaction(
      async (tx) => {
        await this.pickingService.cancelTasksForDispatch(id, tx);

        return tx.dispatch.update({
          where: { id },
          data: { status: 'CANCELLED' },
        });
      },
      {
        ...DEFAULT_TX_OPTIONS,
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      },
    );
  }

  async findAll(
    companyId: string,
    role: 'SENDER' | 'RECEIVER',
    query?: { page?: string | number; limit?: string | number; status?: string; search?: string },
  ) {
    const { page, limit, skip } = parseListPagination(query, { limit: 30, maxLimit: 100 });
    const baseWhere =
      role === 'SENDER' ? { sellerCompanyId: companyId } : { buyerCompanyId: companyId };

    const where: any = { ...baseWhere };
    const status = String(query?.status || '').trim().toUpperCase();
    if (status) where.status = status;

    const search = String(query?.search || '').trim();
    if (search) {
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { dispatchNumber: { contains: search, mode: 'insensitive' } },
        { buyer: { name: { contains: search, mode: 'insensitive' } } },
        { seller: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.dispatch.count({ where }),
      this.prisma.dispatch.findMany({
        where,
        include: {
          buyer: { select: { name: true } },
          seller: { select: { name: true } },
          warehouse: { select: { name: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      items,
      page,
      limit,
      total,
      hasMore: skip + items.length < total,
    };
  }

  async findOne(id: string, companyId: string) {
    const dispatch = await this.prisma.dispatch.findFirst({
      where: { 
        id, 
        OR: [{ sellerCompanyId: companyId }, { buyerCompanyId: companyId }] 
      },
      include: {
        items: {
          include: {
            productVariant: { include: { product: true } }
          }
        },
        order: true,
        warehouse: true
      }
    });
    if (!dispatch) throw new NotFoundException('Jo‘natma topilmadi');
    return dispatch;
  }
}
