import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MapIncomingOrderItemDto } from './dto/b2b-order.dto';
import { ProductMappingsService } from '../product-mappings/product-mappings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WorkflowsService } from '../workflows/workflows.service';
import { B2BOrdersService } from './b2b-orders.service';
import { AtpService } from '../warehouses/atp.service';

@Injectable()
export class B2BOrderWorkflowService {
  constructor(
    private prisma: PrismaService,
    private mappingsService: ProductMappingsService,
    private notificationsService: NotificationsService,
    private workflowsService: WorkflowsService,
    private ordersQuery: B2BOrdersService,
    private atpService: AtpService,
  ) {}

  private async createOrderAcceptedTasks(
    params: {
      orderId: string;
      sellerCompanyId: string;
      creatorId: string;
      buyerName: string;
    },
  ) {
    const workflowResult = await this.workflowsService.executeEvent(
      params.sellerCompanyId,
      'b2b_order.accepted',
      {
        sourceType: 'B2B_ORDER',
        sourceId: params.orderId,
      },
      params.creatorId,
    );
    if (workflowResult.created > 0) {
      return;
    }

    const roleTargets = ['WAREHOUSE', 'MANAGER'];
    const members = await this.prisma.companyUser.findMany({
      where: {
        companyId: params.sellerCompanyId,
        role: { in: roleTargets },
      },
      select: { role: true, userId: true },
      orderBy: { createdAt: 'asc' },
    });

    const assigneeByRole = new Map<string, string>();
    for (const member of members) {
      if (!assigneeByRole.has(member.role)) {
        assigneeByRole.set(member.role, member.userId);
      }
    }

    const tasks = [
      {
        companyId: params.sellerCompanyId,
        sourceType: 'B2B_ORDER',
        sourceId: params.orderId,
        title: 'Buyurtma uchun ombor tayyorgarligi',
        description: `${params.buyerName} buyurtmasi qabul qilindi. Ombordan jo'natishga tayyorlang.`,
        assignedRole: 'WAREHOUSE',
        assigneeId: assigneeByRole.get('WAREHOUSE'),
        status: 'TODO',
        priority: 'HIGH',
        creatorId: params.creatorId,
      },
      {
        companyId: params.sellerCompanyId,
        sourceType: 'B2B_ORDER',
        sourceId: params.orderId,
        title: 'Qabul qilingan buyurtmani nazorat qilish',
        description: `${params.buyerName} buyurtmasi ACCEPTED holatiga o'tdi. Jarayonni monitoring qiling.`,
        assignedRole: 'MANAGER',
        assigneeId: assigneeByRole.get('MANAGER'),
        status: 'TODO',
        priority: 'MEDIUM',
        creatorId: params.creatorId,
      },
    ];

    await this.prisma.task.createMany({ data: tasks });
  }


  private async resolveOrderMappingsBatch(
    companyId: string,
    partnerCompanyId: string,
    items: Array<{
      id: string;
      productNameSnapshot: string;
      productVariantId: string | null;
    }>,
  ) {
    const mappings = await this.mappingsService.findActiveForPartnerLite(companyId, partnerCompanyId);
    return items.map((item) => ({
      itemId: item.id,
      item,
      mapping: this.mappingsService.resolveMappingFromList(mappings, {
        partnerProductName: item.productNameSnapshot,
        partnerSellerVariantId: item.productVariantId || undefined,
      }),
    }));
  }

  private async applySellerLineUpdatesInTx(
    tx: Prisma.TransactionClient,
    sellerCompanyId: string,
    rows: Array<{
      itemId: string;
      item: { productVariantId: string | null };
      mapping: { ownProductVariantId: string } | null;
    }>,
  ) {
    const variantIds = [
      ...new Set(rows.map((r) => r.item.productVariantId).filter((id): id is string => Boolean(id))),
    ];
    const activeVariantIds = new Set<string>();
    if (variantIds.length) {
      const found = await tx.productVariant.findMany({
        where: { id: { in: variantIds }, companyId: sellerCompanyId, status: 'ACTIVE' },
        select: { id: true },
      });
      for (const v of found) activeVariantIds.add(v.id);
    }

    await Promise.all(
      rows.map((row) => {
        let data: { productVariantId?: string; mappingStatus: string };
        if (row.mapping) {
          data = {
            productVariantId: row.mapping.ownProductVariantId,
            mappingStatus: 'MAPPED',
          };
        } else if (row.item.productVariantId && activeVariantIds.has(row.item.productVariantId)) {
          data = { mappingStatus: 'MAPPED' };
        } else {
          data = { mappingStatus: 'REQUIRED' };
        }
        return tx.b2BOrderItem.update({ where: { id: row.itemId }, data });
      }),
    );
  }

  private postAcceptOrderSideEffects(
    order: {
      id: string;
      buyerCompanyId: string;
      sellerCompanyId: string;
      buyer: { name: string };
      seller: { name: string };
    },
    companyId: string,
    userId: string,
    status: string = 'ACCEPTED',
  ) {
    const isPartial = status === 'PARTIAL_ACCEPTED';
    void this.notificationsService
      .notifyCompany(
        order.buyerCompanyId,
        isPartial ? 'Buyurtma qisman qabul qilindi' : 'Buyurtma qabul qilindi',
        isPartial
          ? `${order.seller.name} buyurtmani qisman qabul qildi (zaxira yetarli emas).`
          : `${order.seller.name} buyurtmangizni qabul qildi.`,
        isPartial ? 'WARNING' : 'SUCCESS',
        {
          moduleKey: 'B2B',
          eventKey: isPartial ? 'b2b.order_partial_accepted' : 'b2b.order_accepted',
          details: {
            orderId: order.id,
            seller: order.seller.name,
            status,
          },
          targetRoles: ['OWNER', 'MANAGER', 'SALES'],
        },
      )
      .catch((err) => console.error('order.accepted notification failed', err));

    if (isPartial) {
      void this.notificationsService
        .notifyCompany(
          companyId,
          'Qisman qabul — zaxira yetarli emas',
          `${order.buyer.name} buyurtmasi PARTIAL_ACCEPTED holatida. Qolgan miqdorni tekshiring.`,
          'WARNING',
          {
            moduleKey: 'B2B',
            eventKey: 'b2b.order_partial_accepted',
            details: { orderId: order.id, status },
            targetRoles: ['WAREHOUSE', 'MANAGER', 'OWNER'],
          },
        )
        .catch((err) => console.error('order.partial_accepted seller notify failed', err));
    }

    void this.createOrderAcceptedTasks({
      orderId: order.id,
      sellerCompanyId: companyId,
      creatorId: userId,
      buyerName: order.buyer.name,
    }).catch((err) => console.error('order.accepted tasks failed', err));

    this.ordersQuery.notifyOrderMutation([order.buyerCompanyId, order.sellerCompanyId], {
      orderId: order.id,
      reason: 'order.accepted',
    });
  }

  private postSendOrderSideEffects(
    order: {
      id: string;
      buyerCompanyId: string;
      sellerCompanyId: string;
      buyer: { name: string };
    },
  ) {
    void this.notificationsService
      .notifyCompany(
        order.sellerCompanyId,
        'Yangi buyurtma',
        `${order.buyer.name} kompaniyasidan yangi buyurtma keldi.`,
        'INFO',
        {
          moduleKey: 'B2B',
          eventKey: 'b2b.order_sent',
          details: {
            orderId: order.id,
            buyer: order.buyer.name,
            status: 'SENT',
          },
          targetRoles: ['OWNER', 'MANAGER', 'SALES'],
          actions: [
            { key: 'ORDER_ACCEPT', label: 'Qabul qilish', targetType: 'B2B_ORDER', targetId: order.id },
            { key: 'ORDER_REJECT', label: 'Bekor qilish', targetType: 'B2B_ORDER', targetId: order.id },
          ],
        },
      )
      .catch((err) => console.error('order.sent notification failed', err));

    this.ordersQuery.notifyOrderMutation([order.buyerCompanyId, order.sellerCompanyId], {
      orderId: order.id,
      reason: 'order.sent',
    });
  }

  async sendOrder(id: string, companyId: string, userId: string) {
    const order = await this.ordersQuery.findOneLight(id, companyId);
    if (order.buyerCompanyId !== companyId) throw new BadRequestException('Faqat xaridor buyurtmani yubora oladi');
    if (order.status !== 'DRAFT') throw new BadRequestException('Faqat DRAFT holatidagi buyurtmani yuborish mumkin');

    const allCatalogLines = order.items.every((i) => i.productVariantId);

    const updated = await this.prisma.$transaction(
      async (tx) => {
        if (!allCatalogLines) {
          const resolvedMappings = await this.resolveOrderMappingsBatch(
            order.sellerCompanyId,
            order.buyerCompanyId,
            order.items,
          );
          await this.applySellerLineUpdatesInTx(tx, order.sellerCompanyId, resolvedMappings);
        }

        const sentOrder = await tx.b2BOrder.update({
          where: { id },
          data: { status: 'SENT' },
        });

        await tx.auditLog.create({
          data: {
            companyId,
            userId,
            action: 'order.sent',
            entityType: 'B2B_ORDER',
            entityId: id,
          },
        });

        return sentOrder;
      },
      { timeout: 15000, maxWait: 8000 },
    );

    this.postSendOrderSideEffects(order);
    return updated;
  }

  async acceptOrder(
    id: string,
    companyId: string,
    userId: string,
    options?: { allowPartial?: boolean },
  ) {
    const order = await this.ordersQuery.findOneLight(id, companyId);

    if (order.sellerCompanyId !== companyId) {
      throw new BadRequestException('Faqat sotuvchi buyurtmani qabul qila oladi');
    }
    const forbiddenStatus = [
      'REJECTED',
      'CANCELLED',
      'COMPLETED',
      'DISPATCHED',
      'ACCEPTED',
      'PARTIAL_ACCEPTED',
    ];
    if (forbiddenStatus.includes(order.status)) {
      throw new BadRequestException(`Ushbu holatdagi buyurtmani qabul qilib bo'lmaydi: ${order.status}`);
    }

    const allCatalogLines = order.items.every((i) => i.productVariantId);

    const updated = await this.prisma.$transaction(
      async (tx) => {
        if (!allCatalogLines) {
          const resolvedMappings = await this.resolveOrderMappingsBatch(
            companyId,
            order.buyerCompanyId,
            order.items,
          );
          await this.applySellerLineUpdatesInTx(tx, companyId, resolvedMappings);
        }

        const freshItems = await tx.b2BOrderItem.findMany({
          where: { orderId: id },
          select: {
            productVariantId: true,
            quantity: true,
            productNameSnapshot: true,
            mappingStatus: true,
          },
        });

        const reservationLines = freshItems
          .filter((line) => line.productVariantId && line.mappingStatus === 'MAPPED')
          .map((line) => ({
            productVariantId: line.productVariantId!,
            quantity: Number(line.quantity),
            productNameSnapshot: line.productNameSnapshot,
          }));

        let nextStatus: 'ACCEPTED' | 'PARTIAL_ACCEPTED' = 'ACCEPTED';

        if (reservationLines.length) {
          const warehouseId = await this.atpService.resolveWarehouseForOrder(
            companyId,
            reservationLines.map((line) => ({
              productVariantId: line.productVariantId,
              quantity: line.quantity,
            })),
          );

          if (!warehouseId) {
            throw new BadRequestException(
              'ATP: faol ombor topilmadi yoki mahsulot qoldiqlari mavjud emas',
            );
          }

          const reservationItems = reservationLines.map((line) => ({
            productVariantId: line.productVariantId,
            warehouseId,
            quantity: line.quantity,
          }));

          if (options?.allowPartial) {
            const partial = await this.atpService.createPartialReservation(
              id,
              companyId,
              reservationItems,
              tx,
            );
            if (!partial.success) {
              throw new BadRequestException(
                `ATP: hech qanday rezerv qo'yib bo'lmadi — ${partial.failedItems.map((f) => f.reason).join('; ')}`,
              );
            }
            nextStatus = partial.isFull ? 'ACCEPTED' : 'PARTIAL_ACCEPTED';
          } else {
            await this.atpService.assertCanFulfillOrder(
              id,
              companyId,
              warehouseId,
              reservationLines,
              tx,
            );

            const reservation = await this.atpService.createReservation(
              id,
              companyId,
              reservationItems,
              tx,
            );

            if (!reservation.success) {
              throw new BadRequestException(
                `ATP rezerv yaratib bo'lmadi: ${reservation.failedItems.map((f) => f.reason).join('; ')}`,
              );
            }
          }
        }

        const acceptedOrder = await tx.b2BOrder.update({
          where: { id },
          data: { status: nextStatus },
        });

        await tx.auditLog.create({
          data: {
            companyId,
            userId,
            action: 'order.accepted',
            entityType: 'B2B_ORDER',
            entityId: id,
          },
        });

        return acceptedOrder;
      },
      { timeout: 15000, maxWait: 8000 },
    );

    this.postAcceptOrderSideEffects(order, companyId, userId, updated.status);
    return updated;
  }

  async rejectOrder(id: string, companyId: string, userId: string) {
    const order = await this.ordersQuery.findOne(id, companyId);
    if (order.sellerCompanyId !== companyId) throw new BadRequestException('Faqat sotuvchi buyurtmani rad eta oladi');
    
    const forbiddenStatus = ['DRAFT', 'COMPLETED', 'DISPATCHED', 'CANCELLED', 'REJECTED'];
    if (forbiddenStatus.includes(order.status)) {
      throw new BadRequestException(`Ushbu holatdagi buyurtmani rad etib bo'lmaydi: ${order.status}`);
    }
    
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.b2BOrder.update({
        where: { id },
        data: { status: 'REJECTED' }
      });

      await this.atpService.releaseReservation(id, 'RELEASED', tx);

      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: 'order.rejected',
          entityType: 'B2B_ORDER',
          entityId: id
        }
      });

      return row;
    });

    await this.notificationsService.notifyCompany(
      order.buyerCompanyId,
      'Buyurtma rad etildi',
      `${order.seller.name} buyurtmangizni rad etdi.`,
      'ERROR',
      {
        moduleKey: 'B2B',
        eventKey: 'b2b.order_rejected',
        details: {
          orderId: id,
          seller: order.seller.name,
          status: 'REJECTED',
        },
        targetRoles: ['OWNER', 'MANAGER', 'SALES'],
      },
    );

    this.ordersQuery.notifyOrderMutation([order.buyerCompanyId, order.sellerCompanyId], {
      orderId: id,
      reason: 'order.rejected',
    });
    return updated;
  }

  async mapIncomingOrderItem(
    orderId: string,
    itemId: string,
    companyId: string,
    userId: string,
    dto: MapIncomingOrderItemDto,
  ) {
    const order = await this.prisma.b2BOrder.findFirst({
      where: { id: orderId, sellerCompanyId: companyId },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Buyurtma topilmadi');

    const item = order.items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException('Buyurtma mahsuloti topilmadi');

    const ownVariant = await this.prisma.productVariant.findFirst({
      where: { id: dto.ownProductVariantId, companyId, status: 'ACTIVE' },
    });
    if (!ownVariant) throw new BadRequestException('Tanlangan mahsulot varianti topilmadi');

    const resolvedPrice = dto.sellerPrice ? Number(dto.sellerPrice) : Number(ownVariant.salePrice || 0);
    const resolvedCurrency = (dto.sellerCurrency || ownVariant.currency || 'UZS').toUpperCase();
    if (resolvedPrice <= 0) {
      throw new BadRequestException('Narx 0 dan katta bo‘lishi kerak');
    }
    if (!['UZS', 'USD'].includes(resolvedCurrency)) {
      throw new BadRequestException('Valyuta faqat UZS yoki USD bo‘lishi mumkin');
    }

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.productMapping.findFirst({
        where: {
          companyId,
          partnerCompanyId: order.buyerCompanyId,
          partnerProductName: item.productNameSnapshot,
          partnerSku: null,
        },
      });

      if (existing) {
        await tx.productMapping.update({
          where: { id: existing.id },
          data: {
            ownProductVariantId: dto.ownProductVariantId,
            status: 'ACTIVE',
          },
        });
      } else {
        await tx.productMapping.create({
          data: {
            companyId,
            partnerCompanyId: order.buyerCompanyId,
            partnerProductName: item.productNameSnapshot,
            ownProductVariantId: dto.ownProductVariantId,
            status: 'ACTIVE',
            createdBy: userId,
          },
        });
      }

      await tx.b2BOrderItem.update({
        where: { id: item.id },
        data: {
          productVariantId: dto.ownProductVariantId,
          expectedPrice: resolvedPrice,
          expectedCurrency: resolvedCurrency,
          mappingStatus: 'MAPPED',
        },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: 'order.item_mapped',
          entityType: 'B2B_ORDER_ITEM',
          entityId: item.id,
          oldData: { mappingStatus: item.mappingStatus, productVariantId: item.productVariantId } as any,
          newData: {
            mappingStatus: 'MAPPED',
            productVariantId: dto.ownProductVariantId,
            expectedPrice: resolvedPrice,
            expectedCurrency: resolvedCurrency,
          } as any,
        },
      });
    });

    this.ordersQuery.notifyOrderMutation([companyId, order.buyerCompanyId], {
      orderId,
      reason: 'order.item_mapped',
    });
    return { success: true };
  }

  /** Qisman jo‘natilgan buyurtmada qolgan miqdorni jo‘natmasdan yopish (xaridor yoki sotuvchi). */
  async closeUndispatchedRemainder(id: string, companyId: string, userId: string) {
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
            productVariantId: true,
          },
        },
        buyer: { select: { name: true } },
        seller: { select: { name: true } },
      },
    });
    if (!order) {
      throw new NotFoundException('Buyurtma topilmadi');
    }

    const [enriched] = await this.ordersQuery.attachDispatchSummaries([
      { id: order.id, status: order.status, items: order.items },
    ]);
    const items = (enriched as { items?: Array<{ remainingToDispatch?: number }> }).items ?? [];
    const hasRemaining = items.some((i) => Number(i.remainingToDispatch ?? 0) > 0);
    if (!hasRemaining) {
      throw new BadRequestException('Qolgan jo‘natiladigan miqdor yo‘q');
    }

    const closable = ['PARTIALLY_DISPATCHED', 'DISPATCHED', 'RECEIVED'];
    if (!closable.includes(order.status)) {
      throw new BadRequestException('Ushbu buyurtma uchun qolgan qismni yopib bo‘lmaydi');
    }

    const isBuyer = order.buyerCompanyId === companyId;
    const isSeller = order.sellerCompanyId === companyId;
    if (!isBuyer && !isSeller) {
      throw new BadRequestException('Ruxsat yo‘q');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.b2BOrder.update({
        where: { id },
        data: { status: 'DISPATCHED' },
      });
      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: isBuyer ? 'order.remainder_declined_buyer' : 'order.remainder_closed_seller',
          entityType: 'B2B_ORDER',
          entityId: id,
        },
      });
    });

    const notifyCompanyId = isBuyer ? order.sellerCompanyId : order.buyerCompanyId;
    const actorName = isBuyer ? order.buyer.name : order.seller.name;
    await this.notificationsService
      .notifyCompany(
        notifyCompanyId,
        'Buyurtma qoldig‘i yopildi',
        `${actorName} qolgan qismni jo‘natish/kutishni to‘xtatdi.`,
        'INFO',
        {
          moduleKey: 'B2B',
          eventKey: 'b2b.order_remainder_closed',
          details: { orderId: id, closedBy: isBuyer ? 'buyer' : 'seller' },
          targetRoles: ['OWNER', 'MANAGER', 'SALES', 'WAREHOUSE'],
        },
      )
      .catch((err) => console.error('order.remainder_closed notification failed', err));

    this.ordersQuery.notifyOrderMutation([order.buyerCompanyId, order.sellerCompanyId], {
      orderId: id,
      reason: 'order.remainder_closed',
    });

    return { success: true };
  }

  async cancelOrder(id: string, companyId: string, userId: string) {
    const order = await this.ordersQuery.findOne(id, companyId);
    if (order.buyerCompanyId !== companyId) throw new BadRequestException('Faqat xaridor buyurtmani bekor qila oladi');

    // Can only cancel if not yet dispatched
    const forbidden = ['DISPATCHED', 'RECEIVED', 'COMPLETED'];
    if (forbidden.includes(order.status)) {
      throw new BadRequestException('Ushbu holatdagi buyurtmani bekor qilib bo‘lmaydi');
    }

    const statusBeforeCancel = order.status;

    const updated = await this.prisma.$transaction(async (tx) => {
      const next = await tx.b2BOrder.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: 'order.cancelled',
          entityType: 'B2B_ORDER',
          entityId: id,
        },
      });

      // ATP: faol rezervlarni bo'shatish
      await this.atpService.releaseReservation(id, 'RELEASED', tx);

      return next;
    });

    // Qoralama sotuvchi ro‘yxatida bo‘lmaydi — ortiqcha bildirishnoma yubormaymiz
    if (statusBeforeCancel !== 'DRAFT') {
      await this.notificationsService.notifyCompany(
        order.sellerCompanyId,
        'Buyurtma bekor qilindi',
        `${order.buyer.name} buyurtmani bekor qildi.`,
        'WARNING',
        {
          moduleKey: 'B2B',
          eventKey: 'b2b.order_cancelled',
          details: {
            orderId: id,
            buyer: order.buyer.name,
            status: 'CANCELLED',
            previousStatus: statusBeforeCancel,
          },
          targetRoles: ['OWNER', 'MANAGER', 'SALES'],
        },
      );
    }

    this.ordersQuery.notifyOrderMutation([order.buyerCompanyId, order.sellerCompanyId], {
      orderId: id,
      reason: 'order.cancelled',
    });
    return updated;
  }

  async deleteOrder(id: string, companyId: string, userId: string) {
    const order = await this.ordersQuery.findOne(id, companyId);
    if (order.buyerCompanyId !== companyId) {
      throw new BadRequestException('Faqat xaridor buyurtmani o‘chira oladi');
    }

    const allowedToDelete = ['DRAFT', 'CANCELLED', 'REJECTED'];
    if (!allowedToDelete.includes(order.status)) {
      throw new BadRequestException('Faqat DRAFT, CANCELLED yoki REJECTED buyurtmani o‘chirish mumkin');
    }

    const [dispatchCount, receiptCount, invoiceCount] = await Promise.all([
      this.prisma.dispatch.count({ where: { orderId: id } }),
      this.prisma.goodsReceipt.count({ where: { orderId: id } }),
      this.prisma.invoice.count({ where: { orderId: id } }),
    ]);
    if (dispatchCount > 0 || receiptCount > 0 || invoiceCount > 0) {
      throw new BadRequestException('Buyurtmaga bog‘liq hujjatlar bor, o‘chirib bo‘lmaydi');
    }

    const deleted = await this.prisma.$transaction(async (tx) => {
      await tx.b2BOrderItem.deleteMany({ where: { orderId: id } });
      const row = await tx.b2BOrder.delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: 'order.deleted',
          entityType: 'B2B_ORDER',
          entityId: id,
          oldData: {
            status: order.status,
            itemsCount: order.items?.length || 0,
          } as any,
        },
      });
      return row;
    });
    this.ordersQuery.notifyOrderMutation([companyId, order.sellerCompanyId], {
      orderId: id,
      reason: 'order.deleted',
    });
    return deleted;
  }
}
