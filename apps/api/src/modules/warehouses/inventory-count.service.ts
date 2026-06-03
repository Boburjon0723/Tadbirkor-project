import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { INVENTORY_BLOCK_CHUNK_SIZE } from '../../prisma/transaction-options';
import { StockService } from './stock.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AppCacheService } from '../../common/cache/app-cache.service';

const INVENTORY_COUNTS_LIST_TTL_MS = Number(
  process.env.INVENTORY_COUNTS_CACHE_TTL_MS || 30_000,
);

type PrismaTx = Prisma.TransactionClient;

@Injectable()
export class InventoryCountService {
  constructor(
    private prisma: PrismaService,
    private stockService: StockService,
    private notificationsService: NotificationsService,
    private cache: AppCacheService,
  ) {}

  private invalidateListCache(companyId: string) {
    void this.cache.delByPrefix(`inv-counts:${companyId}:`);
  }

  private async generateReference(companyId: string, tx: PrismaTx): Promise<string> {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    const d = String(now.getUTCDate()).padStart(2, '0');
    const prefix = `INV-${y}${m}${d}`;
    const count = await tx.inventoryCount.count({
      where: { companyId, reference: { startsWith: prefix } },
    });
    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }

  async list(companyId: string, query?: { status?: string; warehouseId?: string }) {
    const key = AppCacheService.inventoryCountsListKey(companyId, query);
    return this.cache.getOrSet(
      key,
      () => this.loadList(companyId, query),
      INVENTORY_COUNTS_LIST_TTL_MS,
    );
  }

  private async loadList(
    companyId: string,
    query?: { status?: string; warehouseId?: string },
  ) {
    const status = String(query?.status || '').trim().toUpperCase();
    return this.prisma.inventoryCount.findMany({
      where: {
        companyId,
        ...(query?.warehouseId ? { warehouseId: query.warehouseId } : {}),
        ...(status ? { status: status as any } : {}),
      },
      include: {
        warehouse: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { startedAt: 'desc' },
      take: 100,
    });
  }

  async findOne(id: string, companyId: string) {
    const count = await this.prisma.inventoryCount.findFirst({
      where: { id, companyId },
      include: {
        warehouse: { select: { id: true, name: true } },
        items: {
          include: {
            productVariant: {
              select: { id: true, name: true, sku: true, barcode: true, product: { select: { name: true } } },
            },
          },
          orderBy: { id: 'asc' },
        },
      },
    });
    if (!count) throw new NotFoundException('Inventarizatsiya topilmadi');
    return count;
  }

  async startCount(
    companyId: string,
    userId: string,
    dto: { warehouseId: string; productVariantIds?: string[] },
  ) {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: dto.warehouseId, companyId, status: 'ACTIVE' },
    });
    if (!warehouse) throw new NotFoundException('Ombor topilmadi');

    const activeCount = await this.prisma.inventoryCount.findFirst({
      where: {
        companyId,
        warehouseId: dto.warehouseId,
        status: { in: ['IN_PROGRESS', 'PENDING_APPROVAL'] },
      },
    });
    if (activeCount) {
      throw new BadRequestException(
        `Ushbu omborda aktiv inventarizatsiya mavjud: ${activeCount.reference}`,
      );
    }

    const balances = await this.prisma.stockBalance.findMany({
      where: {
        companyId,
        warehouseId: dto.warehouseId,
        ...(dto.productVariantIds?.length
          ? { productVariantId: { in: dto.productVariantIds } }
          : {}),
      },
      select: {
        productVariantId: true,
        quantity: true,
      },
    });

    if (!balances.length) {
      throw new BadRequestException('Inventarizatsiya uchun qoldiq topilmadi');
    }

    const positiveBalances = balances.filter((b) => Number(b.quantity) > 0);

    const doc = await this.prisma.runTransaction<{ id: string }>(async (tx) => {
      const reference = await this.generateReference(companyId, tx);

      const created = await tx.inventoryCount.create({
        data: {
          companyId,
          warehouseId: dto.warehouseId,
          reference,
          status: 'IN_PROGRESS',
          initiatedBy: userId,
        },
      });

      await tx.inventoryCountItem.createMany({
        data: balances.map((b) => ({
          inventoryCountId: created.id,
          productVariantId: b.productVariantId,
          systemQuantity: b.quantity,
          status: 'PENDING' as const,
        })),
      });

      return created;
    });

    try {
      await this.applyInventoryBlocksInChunks(
        doc.id,
        companyId,
        dto.warehouseId,
        userId,
        positiveBalances,
      );
    } catch (err) {
      await this.abortStartedCount(doc.id, companyId).catch(() => undefined);
      throw err;
    }

    const count = await this.findOne(doc.id, companyId);
    this.invalidateListCache(companyId);

    void this.notificationsService
      .notifyCompany(
        companyId,
        'Inventarizatsiya boshlandi',
        `${count.reference} — ${warehouse.name}, ${count.items.length} ta mahsulot`,
        'INFO',
        {
          moduleKey: 'WAREHOUSE',
          eventKey: 'inventory.started',
          details: { inventoryCountId: count.id, reference: count.reference },
          targetRoles: ['WAREHOUSE', 'MANAGER'],
        },
      )
      .catch((err) => console.error('inventory.started notification failed', err));

    return count;
  }

  async recordCountByBarcode(
    countId: string,
    companyId: string,
    userId: string,
    barcode: string,
    countedQuantity: number,
  ) {
    const code = String(barcode || '').trim();
    if (!code) throw new BadRequestException('Barcode yoki SKU kiriting');

    const item = await this.prisma.inventoryCountItem.findFirst({
      where: {
        inventoryCountId: countId,
        inventoryCount: { companyId },
        productVariant: {
          OR: [{ barcode: code }, { sku: code }],
        },
      },
      select: { id: true },
    });
    if (!item) {
      throw new NotFoundException('Ushbu inventarizatsiyada mos mahsulot topilmadi');
    }

    return this.recordCount(item.id, companyId, userId, countedQuantity);
  }

  async recordCount(
    itemId: string,
    companyId: string,
    userId: string,
    countedQuantity: number,
  ) {
    if (!Number.isFinite(countedQuantity) || countedQuantity < 0) {
      throw new BadRequestException('Sanalgan miqdor noto\'g\'ri');
    }

    const item = await this.prisma.inventoryCountItem.findFirst({
      where: { id: itemId, inventoryCount: { companyId } },
      include: { inventoryCount: true, productVariant: { select: { name: true } } },
    });
    if (!item) throw new NotFoundException('Qator topilmadi');
    if (!['IN_PROGRESS', 'PENDING_APPROVAL'].includes(item.inventoryCount.status)) {
      throw new BadRequestException('Inventarizatsiya aktiv emas');
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { inventoryVarianceTolerancePct: true },
    });
    const tolerance = Number(company?.inventoryVarianceTolerancePct ?? 1);

    const systemQty = Number(item.systemQuantity);
    const variance = countedQuantity - systemQty;
    const variancePct =
      systemQty > 0 ? (Math.abs(variance) / systemQty) * 100 : countedQuantity > 0 ? 100 : 0;
    const needsApproval = variancePct > tolerance;

    const updated = await this.prisma.inventoryCountItem.update({
      where: { id: itemId },
      data: {
        countedQuantity,
        variance,
        variancePct,
        status: needsApproval ? 'COUNTED' : 'APPROVED',
        scannedAt: new Date(),
        scannedBy: userId,
      },
    });

    if (needsApproval) {
      await this.prisma.inventoryCount.update({
        where: { id: item.inventoryCountId },
        data: { status: 'PENDING_APPROVAL' },
      });

      void this.notificationsService
        .notifyCompany(
          companyId,
          'Inventarizatsiya farqi',
          `${item.productVariant.name}: tizim ${systemQty}, sanalgan ${countedQuantity} (${variancePct.toFixed(1)}%)`,
          'WARNING',
          {
            moduleKey: 'WAREHOUSE',
            eventKey: 'inventory.variance_detected',
            details: {
              inventoryCountId: item.inventoryCountId,
              itemId,
              variancePct,
            },
            targetRoles: ['MANAGER', 'OWNER'],
          },
        )
        .catch((err) => console.error('inventory.variance notification failed', err));
    }

    return { ...updated, needsApproval, variancePct };
  }

  async approveItem(itemId: string, companyId: string, userId: string) {
    const item = await this.prisma.inventoryCountItem.findFirst({
      where: { id: itemId, inventoryCount: { companyId } },
    });
    if (!item) throw new NotFoundException('Qator topilmadi');
    if (item.status !== 'COUNTED') {
      throw new BadRequestException('Faqat COUNTED holatidagi qatorni tasdiqlash mumkin');
    }

    return this.prisma.inventoryCountItem.update({
      where: { id: itemId },
      data: { status: 'APPROVED' },
    });
  }

  async completeCount(id: string, companyId: string, userId: string) {
    const count = await this.findOne(id, companyId);
    if (!['IN_PROGRESS', 'PENDING_APPROVAL'].includes(count.status)) {
      throw new BadRequestException('Inventarizatsiyani yakunlab bo\'lmaydi');
    }

    const pending = count.items.filter(
      (i) => !['APPROVED', 'REJECTED'].includes(i.status) || i.countedQuantity == null,
    );
    const unapproved = count.items.filter((i) => i.status === 'COUNTED');
    if (pending.some((i) => i.status === 'PENDING')) {
      throw new BadRequestException('Hali sanalmagan qatorlar bor');
    }
    if (unapproved.length) {
      throw new BadRequestException('Manager tasdiqlashini kutayotgan farqlar bor');
    }

    await this.prisma.runTransaction(async (tx) => {
      for (const item of count.items) {
        if (item.status !== 'APPROVED' || item.countedQuantity == null) continue;

        const variance = Number(item.variance ?? 0);
        if (variance !== 0) {
          await this.stockService.recordMovements(
            companyId,
            [
              {
                warehouseId: count.warehouseId,
                productVariantId: item.productVariantId,
                quantity: Math.abs(variance),
                note: `Inventarizatsiya ${count.reference}`,
              },
            ],
            variance > 0 ? 'IN' : 'OUT',
            'ADJUSTMENT',
            userId,
            tx,
          );
        }
      }

      await tx.inventoryCount.update({
        where: { id },
        data: { status: 'COMPLETED', completedAt: new Date(), approvedBy: userId },
      });
    });

    await this.releaseBlocksForCount(count.id, companyId);
    this.invalidateListCache(companyId);

    return this.findOne(id, companyId);
  }

  async cancelCount(id: string, companyId: string) {
    const count = await this.findOne(id, companyId);
    if (!['IN_PROGRESS', 'PENDING_APPROVAL', 'DRAFT'].includes(count.status)) {
      throw new BadRequestException('Inventarizatsiyani bekor qilib bo\'lmaydi');
    }

    await this.releaseBlocksForCount(id, companyId);
    await this.prisma.inventoryCount.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
    this.invalidateListCache(companyId);

    return { success: true };
  }

  private async applyInventoryBlocksInChunks(
    countId: string,
    companyId: string,
    warehouseId: string,
    userId: string,
    balances: { productVariantId: string; quantity: Prisma.Decimal }[],
  ) {
    for (let offset = 0; offset < balances.length; offset += INVENTORY_BLOCK_CHUNK_SIZE) {
      const chunk = balances.slice(offset, offset + INVENTORY_BLOCK_CHUNK_SIZE);
      await this.prisma.runTransaction(async (tx) => {
        await tx.stockBlock.createMany({
          data: chunk.map((b) => ({
            companyId,
            warehouseId,
            productVariantId: b.productVariantId,
            reason: 'INVENTORY_COUNT' as const,
            sourceId: countId,
            blockedQty: b.quantity,
            createdBy: userId,
          })),
        });

        for (const b of chunk) {
          const qty = Number(b.quantity);
          await tx.stockBalance.update({
            where: {
              warehouseId_productVariantId: {
                warehouseId,
                productVariantId: b.productVariantId,
              },
            },
            data: { blockedQuantity: { increment: qty } },
          });
        }
      });
    }
  }

  private async abortStartedCount(countId: string, companyId: string) {
    await this.releaseBlocksForCount(countId, companyId);
    await this.prisma.inventoryCount.update({
      where: { id: countId },
      data: { status: 'CANCELLED' },
    });
  }

  private async releaseBlocksForCount(countId: string, companyId: string) {
    const blocks = await this.prisma.stockBlock.findMany({
      where: {
        companyId,
        reason: 'INVENTORY_COUNT',
        sourceId: countId,
        removedAt: null,
      },
    });

    for (let offset = 0; offset < blocks.length; offset += INVENTORY_BLOCK_CHUNK_SIZE) {
      const chunk = blocks.slice(offset, offset + INVENTORY_BLOCK_CHUNK_SIZE);
      await this.prisma.runTransaction(async (tx) => {
        for (const block of chunk) {
          await tx.stockBlock.update({
            where: { id: block.id },
            data: { removedAt: new Date() },
          });

          await tx.stockBalance.update({
            where: {
              warehouseId_productVariantId: {
                warehouseId: block.warehouseId,
                productVariantId: block.productVariantId,
              },
            },
            data: { blockedQuantity: { decrement: Number(block.blockedQty) } },
          });
        }
      });
    }
  }
}
