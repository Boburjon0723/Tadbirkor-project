import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { DEFAULT_TX_OPTIONS } from '../../prisma/transaction-options';
import { NotificationDeliveryService } from '../notifications/notification-delivery.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StockService } from '../warehouses/stock.service';
import { PartnerLedgerLinkService } from './partner-ledger-link.service';
import { CreatePartnerLedgerSaleOrderDto } from './dto/partner-ledger-sale.dto';
import { loadPartnerOrderRowsFromBuffer, matchPartnerOrderVariant } from './partner-ledger-order-excel.util';

const SETTLEMENT_LABELS: Record<string, string> = {
  on_credit: 'Qarzga (keyin to‘lov)',
  cash: 'Naqd pul',
  card: 'Karta / o‘tkazma',
  barter: 'Bartar (boshqa tovar yoki almashtirish)',
  partial: 'Qisman to‘lov',
  promised: 'Kelishilgan muddat / va’da',
};

@Injectable()
export class PartnerLedgerSaleService {
  private readonly logger = new Logger(PartnerLedgerSaleService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockService: StockService,
    private readonly partnerLedgerLink: PartnerLedgerLinkService,
    private readonly deliveryService: NotificationDeliveryService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private formatTotalsText(totals: Array<{ currency: string; amount: number }>) {
    if (!totals.length) return '—';
    return totals
      .map((t) => `${Number(t.amount).toLocaleString('uz-UZ')} ${String(t.currency || 'UZS').toUpperCase()}`)
      .join(' + ');
  }

  private async appendSaleOrderBotStatus(
    companyId: string,
    contactId: string,
    batchId: string,
    status: 'SENT' | 'ACCEPTED' | 'PARTIAL' | 'REJECTED',
    comment?: string,
    updatedById?: string,
  ) {
    try {
      await this.prisma.$executeRaw`
        INSERT INTO "PartnerLedgerSaleOrderStatus"
          ("companyId","contactId","batchId","status","comment","source","updatedById","createdAt","updatedAt")
        VALUES
          (${companyId}, ${contactId}, ${batchId}, ${status}, ${comment ?? null}, ${'BOT'}, ${updatedById ?? null}, NOW(), NOW())
        ON CONFLICT ("companyId","batchId")
        DO UPDATE SET
          "contactId" = EXCLUDED."contactId",
          "status" = EXCLUDED."status",
          "comment" = EXCLUDED."comment",
          "source" = EXCLUDED."source",
          "updatedById" = EXCLUDED."updatedById",
          "updatedAt" = NOW()
      `;
    } catch (err) {
      this.logger.warn(`Sale order status sync skipped: ${(err as Error).message}`);
    }

    const ops = await this.prisma.partnerLedgerOperation.findMany({
      where: {
        companyId,
        sourceType: 'PARTNER_SALE_ORDER',
        sourceId: batchId,
      },
      select: { id: true, notes: true },
    });
    if (!ops.length) return;

    const stamp = new Date().toISOString();
    const noteLine = comment?.trim()
      ? `[BOT_ORDER] status=${status}; at=${stamp}; comment=${comment.trim()}`
      : `[BOT_ORDER] status=${status}; at=${stamp}`;

    await Promise.all(
      ops.map((op) =>
        this.prisma.partnerLedgerOperation.update({
          where: { id: op.id },
          data: {
            notes: op.notes?.trim() ? `${op.notes.trim()}\n${noteLine}` : noteLine,
          },
        }),
      ),
    );
  }

  async getSaleCatalog(
    companyId: string,
    query: { warehouseId: string; search?: string; page?: string; limit?: string },
  ) {
    const warehouseId = String(query.warehouseId || '').trim();
    if (!warehouseId) throw new BadRequestException('warehouseId majburiy');

    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: warehouseId, companyId, status: { not: 'ARCHIVED' } },
      select: { id: true, name: true },
    });
    if (!warehouse) throw new NotFoundException('Ombor topilmadi');

    const search = String(query.search || '').trim();
    const limit = Math.min(Math.max(Number(query.limit) || 60, 1), 200);
    const page = Math.max(Number(query.page) || 1, 1);
    const skip = (page - 1) * limit;

    const warehouseFilter: Prisma.ProductVariantWhereInput = {
      companyId,
      status: 'ACTIVE',
      product: { status: { not: 'ARCHIVED' } },
      stockBalances: {
        some: { warehouseId },
      },
    };

    const where: Prisma.ProductVariantWhereInput = search
      ? {
          AND: [
            warehouseFilter,
            {
              OR: [
                { barcode: { contains: search, mode: 'insensitive' } },
                { sku: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } },
                { product: { name: { contains: search, mode: 'insensitive' } } },
              ],
            },
          ],
        }
      : warehouseFilter;

    const [variants, total] = await Promise.all([
      this.prisma.productVariant.findMany({
        where,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
              category: { select: { id: true, name: true } },
            },
          },
          stockBalances: {
            where: { warehouseId },
            select: { quantity: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.productVariant.count({ where }),
    ]);

    const items = variants.map((v) => {
      const stockQty = Number(v.stockBalances[0]?.quantity ?? 0);
      return {
        id: v.id,
        productId: v.productId,
        productName: v.product.name,
        name: v.name,
        sku: v.sku,
        barcode: v.barcode,
        salePrice: Number(v.salePrice),
        currency: v.currency || 'UZS',
        image: v.product.imageUrl,
        categoryId: v.product.category?.id ?? null,
        categoryName: v.product.category?.name ?? null,
        stockQty,
      };
    });

    return {
      warehouse,
      items,
      page,
      limit,
      total,
      hasMore: skip + items.length < total,
    };
  }

  async previewOrderFromExcel(companyId: string, warehouseId: string, fileBuffer: Buffer) {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: warehouseId, companyId, status: { not: 'ARCHIVED' } },
      select: { id: true, name: true },
    });
    if (!warehouse) throw new NotFoundException('Ombor topilmadi');

    const parsed = await loadPartnerOrderRowsFromBuffer(fileBuffer);
    if (!parsed.length) {
      throw new BadRequestException('Buyurtma qatorlari topilmadi. «Buyurtma» varag‘ini tekshiring.');
    }

    const variants = await this.prisma.productVariant.findMany({
      where: {
        companyId,
        status: 'ACTIVE',
        product: { status: { not: 'ARCHIVED' } },
        stockBalances: { some: { warehouseId } },
      },
      include: {
        product: { select: { name: true } },
        stockBalances: { where: { warehouseId }, select: { quantity: true } },
      },
    });

    const bySku = new Map<string, (typeof variants)[0][]>();
    for (const v of variants) {
      if (v.sku) {
        const key = v.sku.trim().toLowerCase();
        const list = bySku.get(key) || [];
        list.push(v);
        bySku.set(key, list);
      }
    }

    const matchCandidates = variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      barcode: v.barcode,
      name: v.name,
      product: v.product,
    }));

    const lines: Array<{
      rowNumber: number;
      productVariantId: string;
      productName: string;
      name: string;
      sku?: string | null;
      barcode?: string | null;
      salePrice: number;
      currency: string;
      stockQty: number;
      quantity: number;
      lineTotal: number;
    }> = [];
    const errors: Array<{ rowNumber: number; message: string; sku?: string; barcode?: string }> = [];

    for (const row of parsed) {
      if (row.quantity <= 0) {
        errors.push({
          rowNumber: row.rowNumber,
          message: 'Miqdor noto‘g‘ri yoki kiritilmagan',
          sku: row.sku,
          barcode: row.barcode,
        });
        continue;
      }

      const matched = matchPartnerOrderVariant(row, matchCandidates);
      const variant = matched ? variants.find((v) => v.id === matched.id) ?? null : null;

      if (!variant) {
        const skuKey = row.sku?.trim().toLowerCase();
        const ambiguousSku = skuKey && (bySku.get(skuKey)?.length ?? 0) > 1 && !row.variantHint;
        errors.push({
          rowNumber: row.rowNumber,
          message: ambiguousSku
            ? 'Bir nechta variant topildi — «Variant» ustunini kiriting (masalan: Tilla)'
            : 'Mahsulot topilmadi (SKU, shtrix-kod yoki mahsulot + variant)',
          sku: row.sku,
          barcode: row.barcode,
        });
        continue;
      }

      const stockQty = Number(variant.stockBalances[0]?.quantity ?? 0);
      const salePrice = Number(variant.salePrice);
      lines.push({
        rowNumber: row.rowNumber,
        productVariantId: variant.id,
        productName: variant.product.name,
        name: variant.name,
        sku: variant.sku,
        barcode: variant.barcode,
        salePrice,
        currency: variant.currency || 'UZS',
        stockQty,
        quantity: row.quantity,
        lineTotal: row.quantity * salePrice,
      });

      if (row.quantity > stockQty) {
        errors.push({
          rowNumber: row.rowNumber,
          message: `Omborda yetarli emas (mavjud: ${stockQty})`,
          sku: variant.sku || undefined,
        });
      }
    }

    return { warehouse, lines, errors, validCount: lines.length - errors.filter((e) => e.message.includes('yetarli')).length };
  }

  private buildLedgerNotes(dto: CreatePartnerLedgerSaleOrderDto, contactName: string) {
    const parts: string[] = [`Buyurtma: ${contactName}`];
    if (dto.settlementType) {
      parts.push(`To‘lov: ${SETTLEMENT_LABELS[dto.settlementType] || dto.settlementType}`);
    }
    if (dto.settlementNote?.trim()) {
      parts.push(`Hamkor beradi: ${dto.settlementNote.trim()}`);
    }
    if (dto.notes?.trim()) parts.push(dto.notes.trim());
    return parts.join(' · ');
  }

  async createSaleOrder(
    companyId: string,
    userId: string,
    contactId: string,
    dto: CreatePartnerLedgerSaleOrderDto,
  ) {
    const contact = await this.prisma.partnerLedgerContact.findFirst({
      where: { id: contactId, companyId, isActive: true },
      select: { id: true, name: true, telegramChatId: true },
    });
    if (!contact) throw new NotFoundException('Hamkor topilmadi');

    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: dto.warehouseId, companyId, status: { not: 'ARCHIVED' } },
    });
    if (!warehouse) throw new NotFoundException('Ombor topilmadi');

    const lines = dto.lines.filter((l) => l.quantity > 0);
    if (!lines.length) throw new BadRequestException('Kamida bitta qator kerak');

    const variantIds = [...new Set(lines.map((l) => l.productVariantId))];
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: variantIds }, companyId },
      include: { product: { select: { name: true, unit: true } } },
    });
    const variantMap = new Map(variants.map((v) => [v.id, v]));
    if (variantMap.size !== variantIds.length) {
      throw new BadRequestException('Ba’zi mahsulot variantlari topilmadi');
    }

    await this.stockService.assertDispatchStockAvailable(
      companyId,
      dto.warehouseId,
      lines.map((l) => {
        const v = variantMap.get(l.productVariantId)!;
        return {
          productVariantId: l.productVariantId,
          quantity: l.quantity,
          label: `${v.product?.name} / ${v.name}`,
        };
      }),
    );

    const batchId = randomUUID();
    const operationDate = dto.operationDate ? new Date(dto.operationDate) : new Date();
    if (dto.operationDate && Number.isNaN(operationDate.getTime())) {
      throw new BadRequestException('Sana noto‘g‘ri');
    }

    const amountTotals = new Map<string, number>();
    const summaryParts: string[] = [];
    let totalQty = 0;

    for (const line of lines) {
      const variant = variantMap.get(line.productVariantId)!;
      totalQty += line.quantity;
      const amounts = this.partnerLedgerLink.buildAmountsFromVariant(
        variant,
        line.quantity,
        'OUT',
      );
      for (const a of amounts) {
        const cur = String(a.currency || 'UZS').toUpperCase();
        amountTotals.set(cur, (amountTotals.get(cur) || 0) + Number(a.amount));
      }
      const sku = variant.sku ? ` [${variant.sku}]` : '';
      summaryParts.push(
        `${variant.product?.name || 'Mahsulot'} / ${variant.name}${sku} ×${line.quantity}`,
      );
    }

    const ledgerAmounts = [...amountTotals.entries()]
      .filter(([, amt]) => amt > 0)
      .map(([currency, amount]) => ({ amount, currency }));

    if (!ledgerAmounts.length) {
      throw new BadRequestException(
        'Buyurtma summasi 0 — mahsulotlarning sotuv narxini tekshiring',
      );
    }

    const productSummary =
      summaryParts.length > 6
        ? `${summaryParts.slice(0, 5).join('; ')}; +${summaryParts.length - 5} ta`
        : summaryParts.join('; ');

    const ledgerNotes = this.buildLedgerNotes(dto, contact.name);

    const { movementIds, operationIds } = await this.prisma.$transaction(async (tx) => {
      const ids: string[] = [];
      for (const line of lines) {
        const movement = await this.stockService.recordMovement(
          companyId,
          {
            warehouseId: dto.warehouseId,
            productVariantId: line.productVariantId,
            quantity: line.quantity,
            sourceId: batchId,
            note: `Hamkor sotuvi: ${contact.name}`,
          },
          'OUT',
          'MANUAL',
          userId,
          tx,
          { emitRealtime: false },
        );
        ids.push(movement.id);
      }

      const { operationIds: opIds } = await this.partnerLedgerLink.recordFromStockOutboundInTx(tx, {
        companyId,
        userId,
        contactId,
        sourceType: 'PARTNER_SALE_ORDER',
        sourceId: batchId,
        amounts: ledgerAmounts,
        quantity: totalQty,
        productSummary,
        notes: ledgerNotes,
        operationDate,
      });

      return { movementIds: ids, operationIds: opIds };
    }, DEFAULT_TX_OPTIONS);

    await this.appendSaleOrderBotStatus(companyId, contactId, batchId, 'ACCEPTED', 'Seller tomonidan tasdiqlandi', userId);

    this.stockService.emitInventoryChanged(companyId, dto.warehouseId, '', 'PARTNER_SALE_ORDER');

    const totalsText = this.formatTotalsText(ledgerAmounts);
    const qtyText = Number(totalQty).toLocaleString('uz-UZ');

    if (contact.telegramChatId) {
      try {
        await this.deliveryService.enqueueChatTelegram(
          companyId,
          contact.telegramChatId,
          'Buyurtmangiz tasdiqlandi',
          [
            `Hamkor: ${contact.name}`,
            `Buyurtma raqami: ${batchId}`,
            `Jami summa: ${totalsText}`,
            `Miqdor: ${qtyText}`,
          ].join('\n'),
          'SUCCESS',
          {
            moduleKey: 'PARTNER_LEDGER',
            eventKey: 'partner_ledger.sale_order.confirmed',
            details: {
              batchId,
              totalQty,
              totals: totalsText,
            },
          },
          {
            dedupKey: `${companyId}:PARTNER_LEDGER:partner_ledger.sale_order.confirmed:chat:${batchId}`,
          },
        );
      } catch (error) {
        this.logger.warn({
          channel: 'telegram',
          eventKey: 'partner_ledger.sale_order.confirmed',
          companyId,
          contactId,
          batchId,
          errorMessage: (error as Error).message,
        });
      }
    }

    await this.notificationsService.notifyCompanyEvent(companyId, {
      moduleKey: 'PARTNER_LEDGER',
      eventKey: 'partner_ledger.sale_order.confirmed',
      severity: 'SUCCESS',
      entityType: 'PARTNER_SALE_ORDER',
      entityId: batchId,
      title: 'Hamkor sotuvi tasdiqlandi',
      message: `${contact.name}: ${totalsText} · ${qtyText} dona`,
      details: {
        batchId,
        contactId,
        contactName: contact.name,
        totalQty,
        lineCount: lines.length,
        totals: totalsText,
      },
    });

    return {
      batchId,
      movementIds,
      operationIds,
      totals: ledgerAmounts,
      productSummary,
      contactName: contact.name,
    };
  }

  async sendSaleOrderToPartner(
    companyId: string,
    userId: string,
    contactId: string,
    batchId: string,
  ) {
    const contact = await this.prisma.partnerLedgerContact.findFirst({
      where: { id: contactId, companyId, isActive: true },
      select: { id: true, name: true, telegramChatId: true },
    });
    if (!contact) throw new NotFoundException('Hamkor topilmadi');
    if (!contact.telegramChatId) {
      throw new BadRequestException('Hamkor Telegramga ulanmagan (telefon orqali botga ulanmagan).');
    }

    const detail = await this.getSaleOrderLines(companyId, contactId, batchId);
    const totalsText = this.formatTotalsText(detail.totals || []);
    const linesCount = Number(detail.lines?.length || 0);

    try {
      await this.deliveryService.enqueueChatTelegram(
        companyId,
        contact.telegramChatId,
        'Buyurtma yo‘lga chiqdi',
        [
          `Hamkor: ${contact.name}`,
          `Buyurtma raqami: ${batchId}`,
          `Qatorlar: ${linesCount}`,
          `Jami summa: ${totalsText}`,
          '',
          'Quyidan holatni tanlang:',
        ].join('\n'),
        'INFO',
        {
          moduleKey: 'PARTNER_LEDGER',
          eventKey: 'partner_ledger.sale_order.dispatched',
          details: {
            batchId,
            linesCount,
            totals: totalsText,
          },
          actions: [
            {
              key: 'PL_ORDER_ACCEPT',
              label: '✅ Qabul qildim',
              targetType: 'PARTNER_LEDGER_ORDER',
              targetId: batchId,
              payload: { contactId, userId },
            },
            {
              key: 'PL_ORDER_PARTIAL',
              label: '🟨 Qisman',
              targetType: 'PARTNER_LEDGER_ORDER',
              targetId: batchId,
              payload: { contactId, userId },
            },
            {
              key: 'PL_ORDER_REJECT',
              label: '❌ Qabul qilmadim',
              targetType: 'PARTNER_LEDGER_ORDER',
              targetId: batchId,
              payload: { contactId, userId },
            },
          ],
        },
        {
          dedupKey: `${companyId}:PARTNER_LEDGER:partner_ledger.sale_order.dispatched:chat:${batchId}`,
          throwOnFailure: true,
        },
      );
    } catch (error) {
      this.logger.warn({
        channel: 'telegram',
        eventKey: 'partner_ledger.sale_order.dispatched',
        companyId,
        contactId,
        batchId,
        errorMessage: (error as Error).message,
      });
      throw error;
    }

    await this.notificationsService.notifyCompanyEvent(companyId, {
      moduleKey: 'PARTNER_LEDGER',
      eventKey: 'partner_ledger.sale_order.dispatched',
      severity: 'INFO',
      entityType: 'PARTNER_SALE_ORDER',
      entityId: batchId,
      title: 'Buyurtma hamkorga yuborildi',
      message: `${contact.name}: ${linesCount} qator · ${totalsText}`,
      details: {
        batchId,
        contactId,
        contactName: contact.name,
        linesCount,
        totals: totalsText,
      },
    });

    await this.appendSaleOrderBotStatus(companyId, contactId, batchId, 'SENT', undefined, userId);
    return { ok: true };
  }

  private mapMovementLines(
    movements: Array<{
      quantity: unknown;
      warehouse: { name: string };
      productVariant: {
        name: string;
        sku: string | null;
        barcode: string | null;
        salePrice: unknown;
        purchasePrice: unknown;
        currency: string;
        product: { name: string; unit: string } | null;
      };
    }>,
    priceField: 'sale' | 'purchase',
  ) {
    return movements.map((m) => {
      const qty = Number(m.quantity);
      const unitPrice =
        priceField === 'sale'
          ? Number(m.productVariant.salePrice)
          : Number(m.productVariant.purchasePrice ?? 0);
      return {
        productName: m.productVariant.product?.name || 'Mahsulot',
        variantName: m.productVariant.name,
        sku: m.productVariant.sku,
        barcode: m.productVariant.barcode,
        quantity: qty,
        unit: m.productVariant.product?.unit || 'dona',
        salePrice: unitPrice,
        currency: m.productVariant.currency || 'UZS',
        lineTotal: qty * unitPrice,
        warehouseName: m.warehouse.name,
      };
    });
  }

  private async loadMovementsForOperation(
    companyId: string,
    op: {
      type: string;
      sourceType: string | null;
      sourceId: string | null;
    },
  ) {
    const movementInclude = {
      warehouse: { select: { name: true } },
      productVariant: {
        include: { product: { select: { name: true, unit: true } } },
      },
    } as const;

    if (!op.sourceId || !op.sourceType) return [];

    if (op.sourceType === 'PARTNER_SALE_ORDER') {
      return this.prisma.stockMovement.findMany({
        where: { companyId, sourceId: op.sourceId, type: 'OUT' },
        include: movementInclude,
        orderBy: { createdAt: 'asc' },
      });
    }

    if (op.sourceType === 'STOCK_OUT_MANUAL') {
      return this.prisma.stockMovement.findMany({
        where: { companyId, id: op.sourceId, type: 'OUT' },
        include: movementInclude,
        orderBy: { createdAt: 'asc' },
      });
    }

    if (op.sourceType === 'STOCK_IN_MANUAL') {
      return this.prisma.stockMovement.findMany({
        where: { companyId, id: op.sourceId, type: 'IN' },
        include: movementInclude,
        orderBy: { createdAt: 'asc' },
      });
    }

    if (op.sourceType === 'STOCK_IN_EXCEL') {
      return [];
    }

    return [];
  }

  private mapImportPayloadToLine(p: Record<string, unknown>) {
    const qty = Math.abs(
      Number(p.inboundQty ?? p.initialStockRaw ?? p.initialStock ?? 0),
    );
    if (!Number.isFinite(qty) || qty <= 0) return null;

    const purchasePrice = Number(p.purchasePrice ?? 0);
    const variantParts = [p.variant, p.color].filter(Boolean).map(String);
    const variantName = variantParts.length ? variantParts.join(' / ') : String(p.name || 'Variant');

    return {
      productName: String(p.name || 'Mahsulot'),
      variantName,
      sku: (p.sku as string) || null,
      barcode: (p.barcode as string) || null,
      quantity: qty,
      unit: String(p.unit || 'dona'),
      salePrice: purchasePrice,
      currency: String(p.currency || 'UZS').toUpperCase(),
      lineTotal: qty * purchasePrice,
      warehouseName: String(p.warehouseName || '—'),
    };
  }

  private parseProductSummaryLines(
    summary: string,
    operation: { amount: unknown; currency: string },
  ) {
    const cleaned = summary.replace(/\s+\+\d+\s+boshqa$/i, '').trim();
    if (!cleaned) return [];

    const parsed: Array<{ productName: string; quantity: number }> = [];
    for (const part of cleaned.split(/,\s*/)) {
      const match = part.trim().match(/^(.+?)\s*[×x]\s*([\d.,]+)$/i);
      if (!match) continue;
      const quantity = Number(String(match[2]).replace(',', '.'));
      if (!Number.isFinite(quantity) || quantity <= 0) continue;
      parsed.push({ productName: match[1].trim(), quantity });
    }
    if (!parsed.length) return [];

    const currency = String(operation.currency || 'UZS').toUpperCase();
    const totalAmount = Math.abs(Number(operation.amount));

    if (parsed.length === 1) {
      const { productName, quantity } = parsed[0];
      const unitPrice = totalAmount > 0 ? totalAmount / quantity : 0;
      return [
        {
          productName,
          variantName: productName,
          sku: null,
          barcode: null,
          quantity,
          unit: 'dona',
          salePrice: unitPrice,
          currency,
          lineTotal: totalAmount,
          warehouseName: '—',
        },
      ];
    }

    return parsed.map(({ productName, quantity }) => ({
      productName,
      variantName: productName,
      sku: null,
      barcode: null,
      quantity,
      unit: 'dona',
      salePrice: 0,
      currency,
      lineTotal: 0,
      warehouseName: '—',
    }));
  }

  private async loadImportExcelLines(companyId: string, jobId: string) {
    const job = await this.prisma.productImportJob.findFirst({
      where: { id: jobId, companyId },
      select: { id: true },
    });
    if (!job) return [];

    const rows = await this.prisma.productImportStagingRow.findMany({
      where: { jobId, status: 'PROCESSED' },
      orderBy: { rowIndex: 'asc' },
    });

    return rows
      .map((s) => this.mapImportPayloadToLine((s.payload || {}) as Record<string, unknown>))
      .filter((line): line is NonNullable<typeof line> => line !== null);
  }

  async getOperationLines(companyId: string, operationId: string) {
    const operation = await this.prisma.partnerLedgerOperation.findFirst({
      where: { id: operationId, companyId },
      select: {
        id: true,
        contactId: true,
        type: true,
        sourceType: true,
        sourceId: true,
        amount: true,
        currency: true,
        operationDate: true,
        notes: true,
        productSummary: true,
        reversedById: true,
      },
    });
    if (!operation) throw new NotFoundException('Operatsiya topilmadi');

    const movements = await this.loadMovementsForOperation(companyId, operation);
    const priceField = operation.type === 'SALE_OUT' ? 'sale' : 'purchase';
    let lines = this.mapMovementLines(movements, priceField);

    if (
      !lines.length &&
      operation.sourceType === 'STOCK_IN_EXCEL' &&
      operation.sourceId
    ) {
      lines = await this.loadImportExcelLines(companyId, operation.sourceId);
    }

    if (!lines.length && operation.productSummary) {
      lines = this.parseProductSummaryLines(operation.productSummary, operation);
    }

    const totalsByCurrency = new Map<string, number>();
    for (const line of lines) {
      const cur = line.currency.toUpperCase();
      totalsByCurrency.set(cur, (totalsByCurrency.get(cur) || 0) + line.lineTotal);
    }

    return {
      operation: {
        ...operation,
        amount: Number(operation.amount),
      },
      lines,
      summaryOnly: lines.length === 0 ? operation.productSummary : null,
      totals: [...totalsByCurrency.entries()].map(([currency, amount]) => ({ currency, amount })),
    };
  }

  async getSaleOrderLines(companyId: string, contactId: string, batchId: string) {
    const operation = await this.prisma.partnerLedgerOperation.findFirst({
      where: {
        companyId,
        contactId,
        sourceId: batchId,
        sourceType: 'PARTNER_SALE_ORDER',
        reversedById: null,
      },
      select: { id: true },
    });
    if (!operation) throw new NotFoundException('Sotuv buyurtmasi topilmadi');
    const detail = await this.getOperationLines(companyId, operation.id);
    return { batchId, ...detail };
  }
}
