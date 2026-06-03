import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AcceptReceiptDto, PartialAcceptReceiptDto } from './dto/goods-receipt.dto';
import { StockService } from '../warehouses/stock.service';
import { ProductMappingsService } from '../product-mappings/product-mappings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DebtsService } from '../debts/debts.service';
import { GoodsReceiptsService } from './goods-receipts.service';
import {
  DEFAULT_TX_OPTIONS,
  receiptAcceptTxOptions,
  RECEIPT_ACCEPT_CHUNK_SIZE,
} from '../../prisma/transaction-options';
import { collectInboundSkuCandidates } from '../../common/product-code.util';
import { toFiniteMoney } from './goods-receipt.shared';
import { getReceiptMaxAcceptLines } from '../../common/import-limits.util';

@Injectable()
export class GoodsReceiptAcceptService {
  private assertAcceptLineLimit(lineCount: number) {
    const max = getReceiptMaxAcceptLines();
    if (lineCount > max) {
      throw new BadRequestException(
        `Qabul: ${lineCount} qator (limit ${max}). Qisman qabul yoki hujjatni bo‘ling.`,
      );
    }
  }

  constructor(
    private prisma: PrismaService,
    private stockService: StockService,
    private mappingsService: ProductMappingsService,
    private notificationsService: NotificationsService,
    private debtsService: DebtsService,
    private receiptQuery: GoodsReceiptsService,
  ) {}

  private async resolveOrderStatusAfterReceipt(
    orderId: string,
    tx: Prisma.TransactionClient,
  ): Promise<'RECEIVED' | 'PARTIALLY_DISPATCHED'> {
    const orderItems = await tx.b2BOrderItem.findMany({
      where: { orderId },
      select: { productVariantId: true, quantity: true },
    });
    const dispatchRows = await tx.dispatchItem.findMany({
      where: { dispatch: { orderId, status: 'SENT' } },
      select: { productVariantId: true, quantity: true },
    });
    const sentByVariant = new Map<string, number>();
    for (const row of dispatchRows) {
      sentByVariant.set(
        row.productVariantId,
        (sentByVariant.get(row.productVariantId) || 0) + Number(row.quantity),
      );
    }
    const hasRemainingToDispatch = orderItems.some((item) => {
      if (!item.productVariantId) return false;
      const sent = sentByVariant.get(item.productVariantId) ?? 0;
      return sent < Number(item.quantity);
    });
    return hasRemainingToDispatch ? 'PARTIALLY_DISPATCHED' : 'RECEIVED';
  }

  private resolveSellerVariantIdForReceiptLine(
    receipt: Parameters<typeof this.receiptQuery.resolveOrderItemForReceiptLine>[0],
    item: { productVariantId?: string | null; productNameSnapshot: string; quantity: unknown },
    sellerVariantIds: Set<string>,
  ): string | null {
    const dispatchLine = this.receiptQuery.resolveDispatchItemForReceiptLine(receipt, item, sellerVariantIds);
    const orderItem = this.receiptQuery.resolveOrderItemForReceiptLine(receipt, item);
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

  private async resolveSellerVariantIdForReceiptLineTx(
    tx: Prisma.TransactionClient,
    receipt: Parameters<typeof this.receiptQuery.resolveOrderItemForReceiptLine>[0],
    item: { productVariantId?: string | null; productNameSnapshot: string; quantity: unknown },
    sellerCompanyId: string,
  ): Promise<string | null> {
    const dispatchLine = this.receiptQuery.resolveDispatchItemForReceiptLine(receipt, item);
    const orderItem = this.receiptQuery.resolveOrderItemForReceiptLine(receipt, item);
    const candidates = [
      dispatchLine?.productVariantId,
      orderItem?.productVariantId,
      item.productVariantId,
    ].filter((id): id is string => Boolean(id));

    for (const id of candidates) {
      const row = await tx.productVariant.findFirst({
        where: { id, companyId: sellerCompanyId, status: 'ACTIVE' },
        select: { id: true },
      });
      if (row) return row.id;
    }
    return null;
  }

  /** Qabul: sotuvchi variantlari bir martalik (har qatorda DB tekshiruvsiz) */
  private async buildSellerVariantContext(receipt: {
    sellerCompanyId: string;
    items: Array<{ productVariantId?: string | null }>;
    order: { items: Array<{ productVariantId: string | null }> };
    dispatch?: { items: Array<{ productVariantId: string }> } | null;
  }) {
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
              status: 'ACTIVE',
            },
            include: { product: true },
          })
        : [];

    const sellerVariantIds = new Set(sellerVariants.map((v) => v.id));
    const sellerById = new Map(sellerVariants.map((v) => [v.id, v]));
    return { sellerVariantIds, sellerById };
  }

  private attachOrderPricingToReceiptItems(receipt: {
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
      const orderItem = this.receiptQuery.resolveOrderItemForReceiptLine(receipt, item);
      return {
        ...item,
        expectedPrice: toFiniteMoney(orderItem?.expectedPrice),
        expectedCurrency: orderItem?.expectedCurrency || 'UZS',
      };
    });
  }

  /** Qabul/rad — og‘ir enrich (barcha variantlar) siz */
  private async loadReceiptForAccept(id: string, companyId: string) {
    const receipt = await this.prisma.goodsReceipt.findFirst({
      where: {
        id,
        OR: [{ buyerCompanyId: companyId }, { sellerCompanyId: companyId }],
      },
      include: {
        items: true,
        order: { include: { items: true } },
        dispatch: { include: { items: true } },
      },
    });
    if (!receipt) throw new NotFoundException('Qabul hujjati topilmadi');
    return {
      ...receipt,
      items: this.receiptQuery.attachOrderPricingToReceiptItems(receipt),
    };
  }

  /** Variant/mapping — qisqa tranzaksiyalar; keyin chunk faqat ombor */
  private async prefillVariantCacheForAccept(params: {
    receipt: {
      sellerCompanyId: string;
      items: Array<{
        id: string;
        productNameSnapshot: string;
        quantity: unknown;
        productVariantId?: string | null;
        expectedPrice?: unknown;
        expectedCurrency?: string | null;
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
    };
    linesToProcess: Array<{
      id: string;
      productNameSnapshot: string;
      quantity: unknown;
      productVariantId?: string | null;
      expectedPrice?: unknown;
      expectedCurrency?: string | null;
    }>;
    qtyOverride: Map<string, number>;
    companyId: string;
    userId: string;
    prefetchedMappings: Awaited<ReturnType<ProductMappingsService['findActiveForPartnerLite']>>;
    sellerVariantIds: Set<string>;
    sellerById: Map<string, { id: string; name: string; sku: string | null; barcode: string | null; attributesJson?: unknown; product: { name: string; description?: string | null; imageUrl?: string | null; unit?: string | null; type?: string | null } }>;
    variantCache: Map<string, string>;
  }) {
    const {
      receipt,
      linesToProcess,
      qtyOverride,
      companyId,
      userId,
      prefetchedMappings,
      sellerVariantIds,
      sellerById,
      variantCache,
    } = params;

    const uniqueKeys = new Map<
      string,
      { item: (typeof linesToProcess)[number]; sellerVariantId: string | null }
    >();
    for (const item of linesToProcess) {
      const receivedQty = qtyOverride.has(item.id)
        ? qtyOverride.get(item.id)!
        : toFiniteMoney(item.quantity);
      if (receivedQty <= 0) continue;

      const sellerVariantId = this.resolveSellerVariantIdForReceiptLine(
        receipt,
        item,
        sellerVariantIds,
      );
      const key = sellerVariantId ? `sv:${sellerVariantId}` : `item:${item.id}`;
      if (!uniqueKeys.has(key)) {
        uniqueKeys.set(key, { item, sellerVariantId });
      }
    }

    const allSkuCodes = new Set<string>();
    for (const { item, sellerVariantId } of uniqueKeys.values()) {
      const sv = sellerVariantId ? sellerById.get(sellerVariantId) : undefined;
      for (const code of collectInboundSkuCandidates(item.productNameSnapshot, sv)) {
        allSkuCodes.add(code);
      }
    }

    const buyerVariantsForSkuLookup =
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
            select: { id: true, sku: true, barcode: true, name: true, productId: true },
          })
        : [];

    for (const [key, { item, sellerVariantId }] of uniqueKeys) {
      if (variantCache.has(key)) continue;

      const orderItem = this.receiptQuery.resolveOrderItemForReceiptLine(receipt, item);
      const prefetchedSellerVariant = sellerVariantId
        ? sellerById.get(sellerVariantId)
        : null;

      const ownVariantId = await this.prisma.$transaction(
        async (tx) => {
          const ensured = await this.mappingsService.ensureBuyerVariantForInbound(tx, {
            buyerCompanyId: companyId,
            sellerCompanyId: receipt.sellerCompanyId,
            sellerVariantId,
            productNameSnapshot: item.productNameSnapshot,
            expectedPrice: toFiniteMoney(item.expectedPrice ?? orderItem?.expectedPrice),
            expectedCurrency: String(item.expectedCurrency ?? orderItem?.expectedCurrency ?? 'UZS'),
            userId,
            prefetchedActiveMappings: prefetchedMappings,
            prefetchedSellerVariant,
            buyerVariantsForSkuLookup,
          });
          return ensured.ownVariantId;
        },
        DEFAULT_TX_OPTIONS,
      );
      variantCache.set(key, ownVariantId);
    }
  }


  private async applyInboundUnitCostToBuyerVariant(
    tx: Prisma.TransactionClient,
    companyId: string,
    variantId: string,
    unitPrice: unknown,
    currencyRaw: unknown,
  ) {
    const unit = toFiniteMoney(unitPrice);
    if (!Number.isFinite(unit) || unit <= 0) return;
    const receiptCur = String(currencyRaw || 'UZS').toUpperCase() === 'USD' ? 'USD' : 'UZS';

    const v = await tx.productVariant.findFirst({
      where: { id: variantId, companyId },
      select: { salePrice: true, currency: true },
    });
    if (!v) return;

    const variantCur = String(v.currency || 'UZS').toUpperCase() === 'USD' ? 'USD' : 'UZS';
    const sale = Number(v.salePrice || 0);

    const data: { purchasePrice: number; currency?: string } = { purchasePrice: unit };
    if (sale === 0 || variantCur === receiptCur) {
      data.currency = receiptCur;
    }

    await tx.productVariant.updateMany({
      where: { id: variantId, companyId },
      data,
    });
  }

  private refreshInventoryAfterReceipt(companyId: string, warehouseId: string) {
    try {
      this.stockService.emitInventoryChanged(companyId, warehouseId, '', 'GOODS_RECEIPT');
    } catch {
      /* ignore */
    }
  }

  /** Bitta qabul qatori → xaridor varianti + omborga IN harakati */
  private async processReceiptLineInbound(
    tx: Prisma.TransactionClient,
    opts: {
      companyId: string;
      buyerCompanyId: string;
      sellerCompanyId: string;
      userId: string;
      warehouseId: string;
      receiptId: string;
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
        dispatch?: {
          items: Array<{ productVariantId: string; productNameSnapshot: string; quantity: unknown }>;
        } | null;
      };
      item: {
        id: string;
        productNameSnapshot: string;
        quantity: unknown;
        productVariantId?: string | null;
        expectedPrice?: unknown | null;
        expectedCurrency?: string | null;
      };
      receivedQty: number;
      notePrefix: string;
      prefetchedActiveMappings?: Array<{
        id: string;
        partnerProductName: string;
        partnerSku: string | null;
        partnerBarcode: string | null;
        ownProductVariantId: string;
      }>;
      /** true — IN harakatlari tranzaksiya oxirida batch qilinadi */
      deferStock?: boolean;
      deferCostUpdate?: boolean;
      variantCache?: Map<string, string>;
      /** Oldindan yuklangan sotuvchi variant ID lar to‘plami */
      sellerVariantIds?: Set<string>;
    },
  ) {
    const {
      companyId,
      buyerCompanyId,
      sellerCompanyId,
      userId,
      warehouseId,
      receiptId,
      receipt,
      item,
      receivedQty,
      notePrefix,
      prefetchedActiveMappings,
      deferStock,
      deferCostUpdate,
      variantCache,
      sellerVariantIds,
    } = opts;

    const skipped = await this.trySkipProcessedReceiptLine(tx, {
      warehouseId,
      receiptId,
      item,
      receivedQty,
    });
    if (skipped) return skipped;

    const orderItem = this.receiptQuery.resolveOrderItemForReceiptLine(receipt, item);
    const sellerVariantId = sellerVariantIds
      ? this.resolveSellerVariantIdForReceiptLine(receipt, item, sellerVariantIds)
      : await this.resolveSellerVariantIdForReceiptLineTx(tx, receipt, item, sellerCompanyId);

    const cacheKey = sellerVariantId ? `sv:${sellerVariantId}` : '';
    let ownVariantId: string;
    let mappingKind: 'NEW' | 'EXISTING' = 'EXISTING';

    if (cacheKey && variantCache?.has(cacheKey)) {
      ownVariantId = variantCache.get(cacheKey)!;
    } else {
      const ensured = await this.mappingsService.ensureBuyerVariantForInbound(tx, {
        buyerCompanyId,
        sellerCompanyId,
        sellerVariantId,
        productNameSnapshot: item.productNameSnapshot,
        expectedPrice: toFiniteMoney(item.expectedPrice ?? orderItem?.expectedPrice),
        expectedCurrency: String(item.expectedCurrency ?? orderItem?.expectedCurrency ?? 'UZS'),
        userId,
        prefetchedActiveMappings,
      });
      ownVariantId = ensured.ownVariantId;
      mappingKind =
        ensured.createdProduct || ensured.createdMapping ? ('NEW' as const) : ('EXISTING' as const);
      if (cacheKey) variantCache?.set(cacheKey, ownVariantId);
    }

    if (!deferStock) {
      await this.stockService.recordMovement(
        companyId,
        {
          warehouseId,
          productVariantId: ownVariantId,
          quantity: receivedQty,
          sourceId: receiptId,
          note: `${notePrefix}: ${receiptId}`,
        },
        'IN',
        'GOODS_RECEIPT',
        userId,
        tx,
        { emitRealtime: false },
      );
    }

    if (!deferCostUpdate) {
      await this.applyInboundUnitCostToBuyerVariant(
        tx,
        companyId,
        ownVariantId,
        item.expectedPrice ?? orderItem?.expectedPrice,
        item.expectedCurrency ?? orderItem?.expectedCurrency,
      );
    }

    await tx.goodsReceiptItem.update({
      where: { id: item.id },
      data: {
        productVariantId: ownVariantId,
        receivedQuantity: receivedQty,
      },
    });

    if (deferStock) {
      return {
        productNameSnapshot: item.productNameSnapshot,
        variantName: item.productNameSnapshot,
        productName: '',
        quantity: receivedQty,
        mappingKind,
        ownVariantId,
      };
    }

    const buyerVariant = await tx.productVariant.findUnique({
      where: { id: ownVariantId },
      select: { name: true, product: { select: { name: true } } },
    });

    return {
      productNameSnapshot: item.productNameSnapshot,
      variantName: buyerVariant?.name || item.productNameSnapshot,
      productName: buyerVariant?.product?.name || '',
      quantity: receivedQty,
      mappingKind,
      ownVariantId,
    };
  }

  private async trySkipProcessedReceiptLine(
    tx: Prisma.TransactionClient,
    opts: {
      warehouseId: string;
      receiptId: string;
      item: { id: string; productNameSnapshot: string; productVariantId?: string | null; receivedQuantity?: unknown };
      receivedQty: number;
    },
  ) {
    const { warehouseId, receiptId, item, receivedQty } = opts;
    if (!item.productVariantId) return null;
    const prevQty = Number(item.receivedQuantity ?? 0);
    if (prevQty <= 0) return null;

    const mov = await tx.stockMovement.findFirst({
      where: {
        warehouseId,
        type: 'IN',
        sourceType: 'GOODS_RECEIPT',
        sourceId: receiptId,
        productVariantId: item.productVariantId,
      },
    });
    if (!mov) return null;

    return {
      productNameSnapshot: item.productNameSnapshot,
      variantName: item.productNameSnapshot,
      productName: '',
      quantity: receivedQty,
      mappingKind: 'EXISTING' as const,
      ownVariantId: item.productVariantId,
    };
  }

  private async enrichInboundLineLabels(
    tx: Prisma.TransactionClient,
    lines: Array<{
      ownVariantId: string;
      productNameSnapshot: string;
      variantName: string;
      productName: string;
    }>,
  ) {
    const ids = [...new Set(lines.map((l) => l.ownVariantId))];
    if (!ids.length) return;
    const variants = await tx.productVariant.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, product: { select: { name: true } } },
    });
    const byId = new Map(variants.map((v) => [v.id, v]));
    for (const line of lines) {
      const v = byId.get(line.ownVariantId);
      if (v) {
        line.variantName = v.name || line.productNameSnapshot;
        line.productName = v.product?.name || '';
      }
    }
  }

  private async assertInboundRecorded(
    receiptId: string,
    companyId: string,
    warehouseId: string,
    expectedLines: number,
  ) {
    const movements = await this.receiptQuery.loadInboundStockForReceipt(receiptId, companyId);
    const forWarehouse = movements.filter((m) => m.warehouseId === warehouseId);
    if (forWarehouse.length < expectedLines) {
      throw new BadRequestException(
        'Omborga kirim yozilmadi. Qabul tasdiqlanmadi — qayta urinib ko‘ring yoki qo‘llab-quvvatlashga murojaat qiling.',
      );
    }
    return forWarehouse;
  }

  /** Qabul/rad — og‘ir findOne va avtomatik mapping yaratishsiz */
  private async loadReceiptForMutation(id: string, companyId: string) {
    const receipt = await this.prisma.goodsReceipt.findFirst({
      where: {
        id,
        OR: [{ buyerCompanyId: companyId }, { sellerCompanyId: companyId }],
      },
      include: {
        items: {
          include: {
            productVariant: { include: { product: true } },
          },
        },
        order: { include: { items: true } },
        dispatch: { include: { items: true } },
      },
    });
    if (!receipt) throw new NotFoundException('Qabul hujjati topilmadi');
    const items = await this.receiptQuery.enrichReceiptItemsWithMappings(receipt, companyId);
    return { ...receipt, items };
  }

  private async processReceiptAcceptChunk(
    tx: Prisma.TransactionClient,
    params: {
      companyId: string;
      userId: string;
      warehouseId: string;
      receiptId: string;
      receipt: any;
      chunkItems: any[];
      qtyOverride: Map<string, number>;
      prefetchedMappings: any[];
      notePrefix: string;
      variantCache: Map<string, string>;
      sellerVariantIds: Set<string>;
    },
  ) {
    const {
      companyId,
      userId,
      warehouseId,
      receiptId,
      receipt,
      chunkItems,
      qtyOverride,
      prefetchedMappings,
      notePrefix,
      variantCache,
      sellerVariantIds,
    } = params;

    const inboundLines: Array<{
      productNameSnapshot: string;
      variantName: string;
      productName: string;
      quantity: number;
      mappingKind: 'NEW' | 'EXISTING';
      ownVariantId: string;
    }> = [];
    const stockMovements: Array<{
      warehouseId: string;
      productVariantId: string;
      quantity: number;
      sourceId: string;
      note?: string;
    }> = [];
    const costRows: Array<{ variantId: string; price: unknown; currency: unknown }> = [];
    let chunkDebt = 0;

    for (const item of chunkItems) {
      const receivedQty = qtyOverride.has(item.id)
        ? qtyOverride.get(item.id)!
        : toFiniteMoney(item.quantity);
      if (receivedQty <= 0) continue;
      if (receivedQty > toFiniteMoney(item.quantity)) {
        throw new BadRequestException(
          `Qabul miqdori jo'natilgan miqdordan oshib ketdi: ${item.productNameSnapshot}`,
        );
      }

      chunkDebt += toFiniteMoney(item.expectedPrice) * receivedQty;

      const inbound = await this.processReceiptLineInbound(tx, {
        companyId,
        buyerCompanyId: companyId,
        sellerCompanyId: receipt.sellerCompanyId,
        userId,
        warehouseId,
        receiptId,
        receipt,
        item,
        receivedQty,
        notePrefix,
        prefetchedActiveMappings: prefetchedMappings,
        deferStock: true,
        deferCostUpdate: true,
        variantCache,
        sellerVariantIds,
      });
      inboundLines.push(inbound);
      stockMovements.push({
        warehouseId,
        productVariantId: inbound.ownVariantId,
        quantity: receivedQty,
        sourceId: receiptId,
        note: `${notePrefix}: ${receiptId}`,
      });
      costRows.push({
        variantId: inbound.ownVariantId,
        price: item.expectedPrice,
        currency: item.expectedCurrency,
      });
    }

    if (inboundLines.length === 0) {
      throw new BadRequestException('Kamida bitta mahsulot uchun qabul miqdori 0 dan katta bo‘lishi kerak');
    }

    if (stockMovements.length > 0) {
      await this.stockService.recordGoodsReceiptInBatch(
        companyId,
        warehouseId,
        stockMovements,
        userId,
        tx,
      );
    }

    const costByVariant = new Map<string, { price: unknown; currency: unknown }>();
    for (const row of costRows) {
      costByVariant.set(row.variantId, { price: row.price, currency: row.currency });
    }
    for (const [variantId, row] of costByVariant) {
      await this.applyInboundUnitCostToBuyerVariant(
        tx,
        companyId,
        variantId,
        row.price,
        row.currency,
      );
    }

    await this.enrichInboundLineLabels(tx, inboundLines);
    return { chunkDebt, inboundLines };
  }

  async accept(id: string, companyId: string, userId: string, dto: AcceptReceiptDto) {
    const receipt = await this.loadReceiptForAccept(id, companyId);
    if (receipt.buyerCompanyId !== companyId) throw new BadRequestException('Faqat xaridor tovarni qabul qila oladi');
    if (receipt.status === 'ACCEPTED') {
      return { success: true };
    }
    if (receipt.status !== 'PENDING') {
      throw new BadRequestException('Faqat PENDING holatidagi hujjatni qabul qilish mumkin');
    }

    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: dto.warehouseId, companyId, status: 'ACTIVE' },
    });
    if (!warehouse) throw new NotFoundException('Faol ombor topilmadi');

    const debtCurrency = String(receipt.items[0]?.expectedCurrency || 'UZS');
    const prefetchedMappings = await this.mappingsService.findActiveForPartnerLite(
      companyId,
      receipt.sellerCompanyId,
    );
    const qtyOverride = new Map(
      (dto.items || []).map((row) => [row.itemId, Number(row.receivedQuantity)]),
    );
    const linesToProcess = receipt.items.filter((item) => {
      const receivedQty = qtyOverride.has(item.id)
        ? qtyOverride.get(item.id)!
        : toFiniteMoney(item.quantity);
      return receivedQty > 0;
    });

    if (linesToProcess.length === 0) {
      throw new BadRequestException('Kamida bitta mahsulot uchun qabul miqdori 0 dan katta bo‘lishi kerak');
    }
    this.assertAcceptLineLimit(linesToProcess.length);

    const { sellerVariantIds, sellerById } = await this.buildSellerVariantContext(receipt);
    const variantCache = new Map<string, string>();

    await this.prefillVariantCacheForAccept({
      receipt,
      linesToProcess,
      qtyOverride,
      companyId,
      userId,
      prefetchedMappings,
      sellerVariantIds,
      sellerById,
      variantCache,
    });

    let totalDebtAmount = 0;
    const allInboundLines: Array<{
      productNameSnapshot: string;
      variantName: string;
      productName: string;
      quantity: number;
      mappingKind: 'NEW' | 'EXISTING';
      ownVariantId: string;
    }> = [];

    for (let offset = 0; offset < linesToProcess.length; offset += RECEIPT_ACCEPT_CHUNK_SIZE) {
      const chunk = linesToProcess.slice(offset, offset + RECEIPT_ACCEPT_CHUNK_SIZE);
      const part = await this.prisma.$transaction(
        (tx) =>
          this.processReceiptAcceptChunk(tx, {
            companyId,
            userId,
            warehouseId: dto.warehouseId,
            receiptId: id,
            receipt,
            chunkItems: chunk,
            qtyOverride,
            prefetchedMappings,
            notePrefix: 'Yuk qabul qilindi',
            variantCache,
            sellerVariantIds,
          }),
        receiptAcceptTxOptions(chunk.length),
      );
      totalDebtAmount += part.chunkDebt;
      allInboundLines.push(...part.inboundLines);
    }

    const finalize = await this.prisma.$transaction(
      async (tx) => {
        const statusRow = await tx.goodsReceipt.findFirst({
          where: { id, buyerCompanyId: companyId },
          select: { status: true },
        });
        if (statusRow?.status === 'ACCEPTED') {
          return { duplicate: true as const };
        }
        if (statusRow?.status !== 'PENDING') {
          throw new BadRequestException('Faqat PENDING holatidagi hujjatni qabul qilish mumkin');
        }

        const allLinesFull = receipt.items.every((item) => {
          const receivedQty = qtyOverride.has(item.id)
            ? qtyOverride.get(item.id)!
            : toFiniteMoney(item.quantity);
          return receivedQty >= toFiniteMoney(item.quantity);
        });

        await tx.goodsReceipt.update({
          where: { id },
          data: {
            status: allLinesFull ? 'ACCEPTED' : 'PARTIALLY_ACCEPTED',
            receivedAt: new Date(),
          },
        });

        if (totalDebtAmount > 0) {
          await this.debtsService.createEntry(
            {
              debtorId: receipt.buyerCompanyId,
              creditorId: receipt.sellerCompanyId,
              amount: totalDebtAmount,
              receiptId: id,
              currency: debtCurrency,
            },
            tx,
          );
        }

        const orderStatus = await this.resolveOrderStatusAfterReceipt(receipt.orderId, tx);
        await tx.b2BOrder.update({
          where: { id: receipt.orderId },
          data: { status: orderStatus },
        });

        return { duplicate: false as const };
      },
      DEFAULT_TX_OPTIONS,
    );

    if (finalize.duplicate) {
      return { success: true };
    }

    const inboundMovements = await this.assertInboundRecorded(
      id,
      companyId,
      dto.warehouseId,
      allInboundLines.length,
    );

    this.refreshInventoryAfterReceipt(companyId, dto.warehouseId);

    if (totalDebtAmount > 0) {
      this.debtsService.notifyDebtsChanged(receipt.buyerCompanyId, receipt.sellerCompanyId, {
        reason: 'receipt.accepted',
      });
    }

    void this.sendAcceptNotifications(receipt, totalDebtAmount, debtCurrency).catch(
      (error) => console.error('Receipt accept notification failed', error),
    );

    return {
      success: true,
      warehouseId: dto.warehouseId,
      warehouseName: warehouse.name,
      inbound: allInboundLines,
      inboundMovements,
    };
  }

  private async sendAcceptNotifications(
    receipt: { buyerCompanyId: string; sellerCompanyId: string; id: string; orderId: string },
    totalDebtAmount: number,
    debtCurrency: string,
  ) {
    const buyer = await this.prisma.company.findUnique({
      where: { id: receipt.buyerCompanyId },
      select: { name: true },
    });

    await this.notificationsService.notifyCompany(
      receipt.sellerCompanyId,
      'Yuk qabul qilindi',
      `${buyer?.name || 'Xaridor'} jo‘natmani to‘liq qabul qildi.`,
      'SUCCESS',
      {
        moduleKey: 'B2B',
        eventKey: 'receipt.accepted',
        details: {
          receiptId: receipt.id,
          orderId: receipt.orderId,
          amount: totalDebtAmount,
          status: 'ACCEPTED',
        },
        targetRoles: ['OWNER', 'MANAGER', 'SALES', 'WAREHOUSE'],
      },
    );

    await this.notificationsService.notifyCompany(
      receipt.buyerCompanyId,
      'Qabul qilish muvaffaqiyatli',
      `Jo‘natma muvaffaqiyatli qabul qilindi. Qarz summasi: ${totalDebtAmount.toLocaleString('uz-UZ')} ${debtCurrency}.`,
      'SUCCESS',
    );
  }

  async reject(id: string, companyId: string, userId: string) {
    const receipt = await this.prisma.goodsReceipt.findFirst({
      where: { id, buyerCompanyId: companyId },
      select: { id: true, buyerCompanyId: true },
    });
    if (!receipt) throw new NotFoundException('Qabul hujjati topilmadi');
    if (receipt.buyerCompanyId !== companyId) throw new BadRequestException('Faqat xaridor rad eta oladi');

    return this.prisma.goodsReceipt.update({
      where: { id },
      data: { status: 'REJECTED' }
    });
  }

  async partialAccept(id: string, companyId: string, userId: string, dto: PartialAcceptReceiptDto) {
    const receipt = await this.loadReceiptForAccept(id, companyId);
    if (receipt.buyerCompanyId !== companyId) throw new BadRequestException('Faqat xaridor qabul qila oladi');

    if (receipt.status === 'PARTIALLY_ACCEPTED' || receipt.status === 'ACCEPTED') {
      return { success: true };
    }
    if (receipt.status !== 'PENDING') {
      throw new BadRequestException('Faqat PENDING holatidagi yukni qisman qabul qilish mumkin');
    }

    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: dto.warehouseId, companyId, status: 'ACTIVE' },
    });
    if (!warehouse) throw new NotFoundException('Faol ombor topilmadi');

    const debtCurrency = String(receipt.items[0]?.expectedCurrency || 'UZS');
    const prefetchedMappings = await this.mappingsService.findActiveForPartnerLite(
      companyId,
      receipt.sellerCompanyId,
    );
    const qtyOverride = new Map(
      (dto.items || []).map((row) => [row.itemId, Number(row.receivedQuantity)]),
    );

    const linesToProcess = receipt.items.filter((item) => {
      const receivedQty = qtyOverride.get(item.id) ?? 0;
      return receivedQty > 0;
    });

    if (linesToProcess.length === 0) {
      throw new BadRequestException('Kamida bitta mahsulot uchun qabul miqdori 0 dan katta bo‘lishi kerak');
    }
    this.assertAcceptLineLimit(linesToProcess.length);

    for (const item of linesToProcess) {
      const receivedQty = qtyOverride.get(item.id)!;
      if (receivedQty > toFiniteMoney(item.quantity)) {
        throw new BadRequestException(
          `Qabul miqdori jo'natilgan miqdordan oshib ketdi: ${item.productNameSnapshot}`,
        );
      }
    }

    const { sellerVariantIds, sellerById } = await this.buildSellerVariantContext(receipt);
    const variantCache = new Map<string, string>();

    await this.prefillVariantCacheForAccept({
      receipt,
      linesToProcess,
      qtyOverride,
      companyId,
      userId,
      prefetchedMappings,
      sellerVariantIds,
      sellerById,
      variantCache,
    });

    let totalDebtAmount = 0;
    const allInboundLines: Array<{
      productNameSnapshot: string;
      variantName: string;
      productName: string;
      quantity: number;
      mappingKind: 'NEW' | 'EXISTING';
      ownVariantId: string;
    }> = [];

    for (let offset = 0; offset < linesToProcess.length; offset += RECEIPT_ACCEPT_CHUNK_SIZE) {
      const chunk = linesToProcess.slice(offset, offset + RECEIPT_ACCEPT_CHUNK_SIZE);
      const part = await this.prisma.$transaction(
        (tx) =>
          this.processReceiptAcceptChunk(tx, {
            companyId,
            userId,
            warehouseId: dto.warehouseId,
            receiptId: id,
            receipt,
            chunkItems: chunk,
            qtyOverride,
            prefetchedMappings,
            notePrefix: 'Yuk qisman qabul qilindi',
            variantCache,
            sellerVariantIds,
          }),
        receiptAcceptTxOptions(chunk.length),
      );
      totalDebtAmount += part.chunkDebt;
      allInboundLines.push(...part.inboundLines);
    }

    const finalize = await this.prisma.$transaction(
      async (tx) => {
        const snap = await tx.goodsReceipt.findFirst({
          where: { id, buyerCompanyId: companyId },
          select: { status: true },
        });
        if (snap?.status === 'PARTIALLY_ACCEPTED' || snap?.status === 'ACCEPTED') {
          return { duplicate: true as const };
        }
        if (snap?.status !== 'PENDING') {
          throw new BadRequestException('Faqat PENDING holatidagi yukni qisman qabul qilish mumkin');
        }

        await tx.goodsReceipt.update({
          where: { id },
          data: {
            status: 'PARTIALLY_ACCEPTED',
            receivedAt: new Date(),
          },
        });

        if (totalDebtAmount > 0) {
          await this.debtsService.createEntry(
            {
              debtorId: receipt.buyerCompanyId,
              creditorId: receipt.sellerCompanyId,
              amount: totalDebtAmount,
              receiptId: receipt.id,
              currency: debtCurrency,
            },
            tx,
          );
        }

        return { duplicate: false as const };
      },
      DEFAULT_TX_OPTIONS,
    );

    if (finalize.duplicate) {
      return { success: true };
    }

    const inboundMovements = await this.assertInboundRecorded(
      id,
      companyId,
      dto.warehouseId,
      allInboundLines.length,
    );

    this.refreshInventoryAfterReceipt(companyId, dto.warehouseId);

    if (totalDebtAmount > 0) {
      this.debtsService.notifyDebtsChanged(receipt.buyerCompanyId, receipt.sellerCompanyId, {
        reason: 'receipt.partial_accepted',
      });
    }

    void this.sendPartialAcceptNotifications(receipt, totalDebtAmount, debtCurrency).catch(
      (error) => console.error('Partial receipt accept notification failed', error),
    );

    return {
      success: true,
      warehouseId: dto.warehouseId,
      warehouseName: warehouse.name,
      inbound: allInboundLines,
      inboundMovements,
    };
  }

  private async sendPartialAcceptNotifications(
    receipt: { buyerCompanyId: string; sellerCompanyId: string; id: string; orderId: string },
    totalDebtAmount: number,
    debtCurrency: string,
  ) {
    const buyer = await this.prisma.company.findUnique({
      where: { id: receipt.buyerCompanyId },
      select: { name: true },
    });

    await this.notificationsService.notifyCompany(
      receipt.sellerCompanyId,
      'Yuk qisman qabul qilindi',
      `${buyer?.name || 'Xaridor'} jo‘natmani qisman qabul qildi.`,
      'WARNING',
      {
        moduleKey: 'B2B',
        eventKey: 'receipt.partial_accepted',
        details: {
          receiptId: receipt.id,
          orderId: receipt.orderId,
          amount: totalDebtAmount,
          status: 'PARTIALLY_ACCEPTED',
        },
        targetRoles: ['OWNER', 'MANAGER', 'SALES', 'WAREHOUSE'],
      },
    );

    await this.notificationsService.notifyCompany(
      receipt.buyerCompanyId,
      'Qisman qabul muvaffaqiyatli',
      `Jo‘natma qisman qabul qilindi. Qarz summasi: ${totalDebtAmount.toLocaleString('uz-UZ')} ${debtCurrency}.`,
      'WARNING',
    );
  }
}
