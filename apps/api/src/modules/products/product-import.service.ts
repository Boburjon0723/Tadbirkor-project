import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { importVariantCatalogFilter } from '../warehouses/warehouse-catalog.util';
import { StockService } from '../warehouses/stock.service';
import * as ExcelJS from 'exceljs';
import { Prisma } from '@prisma/client';
import { JobsOptions, Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import {
  createRedisClient,
  resolveRedisUrl,
} from '../../common/cache/redis-connection';
import {
  getImportConfirmMaxRows,
  getImportPreviewMaxRows,
} from '../../common/import-limits.util';
import { posCatalogCachePrefix } from '../../common/pos-catalog-cache.util';
import {
  detectProductImportExcelFormat,
  findProductImportWorksheet,
  worksheetHasStockColumn,
  formatImportCurrencyError,
  formatImportPriceError,
  formatProductUnitImportError,
  getProductImportColumnGuide,
  exportVariantExcelFields,
  importVariantIdentityKey,
  isProductImportRowEmpty,
  normalizeProductUnit,
  parseExcelDecimalCell,
  parseProductImportExcelRow,
  parseProductUnitInput,
  resolveImportVariantDisplayName,
  resolveImportTrailingColumnIndexes,
} from './product-import-excel.util';
import {
  normalizeStockQuantity,
  stockQuantityImportError,
} from '../../common/units/product-unit.util';
import { DEFAULT_TX_OPTIONS } from '../../prisma/transaction-options';
import { InventoryGateway } from '../warehouses/inventory.gateway';
import { AppCacheService } from '../../common/cache/app-cache.service';
import {
  ProductImportFileStockMode,
  ProductImportMode,
  ProductImportOptions,
  ProductImportStockPolicy,
  CategoryPathResolver,
  ImportExecuteLookup,
  ImportProductSnapshot,
  ImportRowProcessContext,
  ImportVariantSnapshot,
} from './product-import.types';
import { PartnerLedgerLinkService } from '../partner-ledger/partner-ledger-link.service';
import {
  createImportLedgerAccumulator,
  ImportLedgerAccumulator,
  ledgerAmountsFromAccumulator,
  ledgerProductSummary,
  trackImportStockInbound,
} from './product-import-ledger.util';

@Injectable()
export class ProductImportService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProductImportService.name);
  private readonly importQueueName = 'product-import-queue';
  private redis?: IORedis;
  private importQueue?: Queue;
  private importWorker?: Worker;

  constructor(
    private prisma: PrismaService,
    private stockService: StockService,
    private inventoryGateway: InventoryGateway,
    private cache: AppCacheService,
    private partnerLedgerLink: PartnerLedgerLinkService,
  ) {}

  private async linkPartnerLedgerFromImport(
    companyId: string,
    userId: string,
    contactId: string | undefined,
    sourceId: string | undefined,
    acc: ImportLedgerAccumulator | null,
  ) {
    if (!contactId?.trim() || !sourceId || !acc || acc.inboundLines === 0) return;

    const amounts = ledgerAmountsFromAccumulator(acc);
    if (!amounts.length) return;

    try {
      await this.partnerLedgerLink.recordFromStockInbound({
        companyId,
        userId,
        contactId: contactId.trim(),
        sourceType: 'STOCK_IN_EXCEL',
        sourceId,
        amounts,
        productSummary: ledgerProductSummary(acc),
        notes: `Excel import: ${acc.inboundLines} ta kirim qatori`,
      });
    } catch (err) {
      this.logger.warn(
        `Hamkor daftariga Excel import yozilmadi (${sourceId}): ${(err as Error).message}`,
      );
    }
  }

  private notifyInventoryChanged(
    companyId: string,
    payload?: { warehouseId?: string; productId?: string; reason?: string },
  ) {
    try {
      this.inventoryGateway.emitToCompany(companyId, 'inventory:changed', payload || {});
      this.inventoryGateway.emitDashboardRefresh(companyId);
      void this.cache.delByPrefix(posCatalogCachePrefix(companyId));
    } catch (err) {
      this.logger.warn(`Inventory realtime emit failed: ${(err as Error).message}`);
    }
  }

  async onModuleInit() {
    const redisUrl = resolveRedisUrl();
    if (!redisUrl) {
      this.logger.warn(
        'REDIS_URL topilmadi — import queue local fallback. Railway: API → Variables → Redis reference.',
      );
      return;
    }
    this.redis = createRedisClient('queue') ?? undefined;
    if (!this.redis) return;
    await this.redis.connect();
    this.logger.log('Redis import queue ulandi (BullMQ).');

    this.importQueue = new Queue(this.importQueueName, { connection: this.redis });
    this.importWorker = new Worker(
      this.importQueueName,
      async (job) => {
        await this.runImportJobSafe(String(job.data.jobId || ''));
      },
      {
        connection: this.redis,
        concurrency: Number(process.env.IMPORT_WORKER_CONCURRENCY || 2),
      },
    );
  }

  async onModuleDestroy() {
    await this.importWorker?.close();
    await this.importQueue?.close();
    if (this.redis) await this.redis.quit();
  }

  private mergeImportAttributesJson(
    color: string | undefined,
    existing?: unknown,
  ): Record<string, unknown> | undefined {
    const trimmed = String(color || '').trim();
    const base =
      existing && typeof existing === 'object' && !Array.isArray(existing)
        ? { ...(existing as Record<string, unknown>) }
        : {};
    if (trimmed) {
      base.color = trimmed;
      return base;
    }
    return Object.keys(base).length > 0 ? base : undefined;
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

  private getImportBatchSize(): number {
    const n = Number(process.env.IMPORT_BATCH_SIZE || 40);
    return Number.isFinite(n) && n >= 5 && n <= 100 ? Math.floor(n) : 40;
  }

  private getImportRowTxBatchSize(): number {
    const n = Number(process.env.IMPORT_ROW_TX_BATCH_SIZE || 25);
    return Number.isFinite(n) && n >= 1 && n <= 50 ? Math.floor(n) : 25;
  }

  private getImportSyncMaxRows(): number {
    const n = Number(process.env.IMPORT_SYNC_MAX_ROWS || 250);
    return Number.isFinite(n) && n >= 20 && n <= 500 ? Math.floor(n) : 250;
  }

  private emptyImportExecuteLookup(): ImportExecuteLookup {
    return {
      variantById: new Map(),
      variantBySku: new Map(),
      variantByBarcode: new Map(),
      archivedBySku: new Map(),
      archivedByBarcode: new Map(),
      productById: new Map(),
      productByName: new Map(),
    };
  }

  private toImportVariantSnapshot(v: {
    id: string;
    productId: string;
    status: string;
    name: string;
    sku: string | null;
    barcode: string | null;
    purchasePrice: Prisma.Decimal | null;
    salePrice: Prisma.Decimal | null;
    currency: string;
    attributesJson: Prisma.JsonValue | null;
    product: ImportProductSnapshot | null;
    stockBalances?: Array<{ warehouseId: string; quantity: Prisma.Decimal }>;
  }): ImportVariantSnapshot {
    const stockByWarehouse = new Map<string, number>();
    for (const b of v.stockBalances || []) {
      stockByWarehouse.set(b.warehouseId, Number(b.quantity));
    }
    return {
      id: v.id,
      productId: v.productId,
      status: v.status,
      name: v.name,
      sku: v.sku,
      barcode: v.barcode,
      purchasePrice: v.purchasePrice,
      salePrice: v.salePrice,
      currency: v.currency,
      attributesJson: v.attributesJson,
      product: v.product,
      stockByWarehouse,
      isArchived:
        v.status === 'ARCHIVED' || v.product?.status === 'ARCHIVED',
    };
  }

  private mergeImportVariantSnapshot(
    current: ImportVariantSnapshot | undefined,
    next: ImportVariantSnapshot,
  ): ImportVariantSnapshot {
    if (!current) return next;
    if (current.isArchived && !next.isArchived) return next;
    if (!current.isArchived && next.isArchived) return current;
    return next;
  }

  private async buildImportExecuteLookup(
    companyId: string,
    workRows: any[],
  ): Promise<ImportExecuteLookup> {
    const lookup = this.emptyImportExecuteLookup();
    if (!workRows.length) return lookup;

    const skus = [
      ...new Set(
        workRows.map((r) => String(r.sku || '').trim()).filter(Boolean),
      ),
    ];
    const barcodes = [
      ...new Set(
        workRows.map((r) => String(r.barcode || '').trim()).filter(Boolean),
      ),
    ];
    const variantIds = [
      ...new Set(
        workRows
          .flatMap((r) => [
            String(r.existingVariantId || '').trim(),
            String(r.variantId || '').trim(),
          ])
          .filter(Boolean),
      ),
    ];
    const warehouseIds = [
      ...new Set(
        workRows.map((r) => String(r.warehouseId || '').trim()).filter(Boolean),
      ),
    ];
    const productNames = [
      ...new Set(
        workRows
          .filter((r) => !String(r.existingProductId || '').trim())
          .map((r) => String(r.name || '').trim())
          .filter(Boolean),
      ),
    ];

    const matchOr: Prisma.ProductVariantWhereInput[] = [
      ...(variantIds.length ? [{ id: { in: variantIds } }] : []),
      ...(skus.length
        ? [{ sku: { in: skus, mode: 'insensitive' as const } }]
        : []),
      ...(barcodes.length
        ? [{ barcode: { in: barcodes, mode: 'insensitive' as const } }]
        : []),
    ];

    const variantInclude = {
      product: {
        select: {
          id: true,
          name: true,
          status: true,
          unit: true,
          categoryId: true,
        },
      },
      stockBalances: warehouseIds.length
        ? {
            where: { warehouseId: { in: warehouseIds } },
            select: { warehouseId: true, quantity: true },
          }
        : { select: { warehouseId: true, quantity: true } },
    } as const;

    const variants =
      matchOr.length === 0
        ? []
        : await this.prisma.productVariant.findMany({
            where: { companyId, OR: matchOr },
            include: variantInclude,
          });

    for (const raw of variants) {
      const product: ImportProductSnapshot | null = raw.product
        ? {
            id: raw.product.id,
            name: raw.product.name,
            unit: raw.product.unit,
            categoryId: raw.product.categoryId,
            status: raw.product.status,
          }
        : null;
      const snap = this.toImportVariantSnapshot({ ...raw, product });

      lookup.variantById.set(
        snap.id,
        this.mergeImportVariantSnapshot(lookup.variantById.get(snap.id), snap),
      );

      if (product) {
        lookup.productById.set(product.id, product);
        lookup.productByName.set(product.name, product);
      }

      if (snap.sku) {
        const key = snap.sku.toLowerCase();
        const map = snap.isArchived ? lookup.archivedBySku : lookup.variantBySku;
        map.set(key, this.mergeImportVariantSnapshot(map.get(key), snap));
      }
      if (snap.barcode) {
        const key = snap.barcode.toLowerCase();
        const map = snap.isArchived
          ? lookup.archivedByBarcode
          : lookup.variantByBarcode;
        map.set(key, this.mergeImportVariantSnapshot(map.get(key), snap));
      }
    }

    if (productNames.length) {
      const products = await this.prisma.product.findMany({
        where: { companyId, status: 'ACTIVE', name: { in: productNames } },
        select: {
          id: true,
          name: true,
          unit: true,
          categoryId: true,
          status: true,
        },
      });
      for (const p of products) {
        lookup.productById.set(p.id, p);
        if (!lookup.productByName.has(p.name)) {
          lookup.productByName.set(p.name, p);
        }
      }
    }

    return lookup;
  }

  private findArchivedVariantInLookup(
    lookup: ImportExecuteLookup,
    sku: string,
    barcode: string,
  ): ImportVariantSnapshot | null {
    if (barcode) {
      const hit = lookup.archivedByBarcode.get(barcode.toLowerCase());
      if (hit) return hit;
    }
    if (sku) {
      const hit = lookup.archivedBySku.get(sku.toLowerCase());
      if (hit) return hit;
    }
    return null;
  }

  private buildCategoryPathResolver(
    categories: Array<{
      id: string;
      name: string;
      parentId: string | null;
      warehouseId: string | null;
    }>,
  ): CategoryPathResolver {
    const byKey = new Map<string, string>();
    for (const c of categories) {
      const key = `${c.warehouseId || ''}|${c.parentId || ''}|${c.name.trim().toLowerCase()}`;
      byKey.set(key, c.id);
    }

    return {
      resolveOrCreate: async (
        tx: Prisma.TransactionClient,
        companyId: string,
        warehouseId: string,
        categoryRaw: string,
        cache: Map<string, string>,
      ): Promise<string | undefined> => {
        const pathKey = categoryRaw.trim().toLowerCase();
        if (!pathKey) return undefined;
        const cached = cache.get(pathKey);
        if (cached) return cached;

        const parts = categoryRaw
          .split('>')
          .map((v: string) => v.trim())
          .filter(Boolean);
        let parentId: string | null = null;
        for (const part of parts) {
          const key = `${warehouseId}|${parentId || ''}|${part.toLowerCase()}`;
          let id = byKey.get(key);
          if (!id) {
            const created = await tx.productCategory.create({
              data: {
                companyId,
                name: part,
                parentId,
                warehouseId,
                status: 'ACTIVE',
              },
              select: { id: true },
            });
            id = created.id;
            byKey.set(key, id);
          }
          parentId = id;
        }
        if (parentId) cache.set(pathKey, parentId);
        return parentId || undefined;
      },
    };
  }

  private async ensureActiveWarehouseExists(companyId: string) {
    const exists = await this.prisma.warehouse.findFirst({
      where: { companyId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!exists) {
      throw new BadRequestException("Avval kamida bitta ombor yarating, keyin mahsulot qo'shing.");
    }
  }

  /** Excel raqamni matn sifatida buzmasin (barkod/SKU uchun). */
  private parseImportCellString(cell: ExcelJS.Cell): string {
    const text = String(cell?.text ?? '').trim();
    if (text) return text;
    const raw = cell?.value;
    if (raw == null || raw === '') return '';
    if (typeof raw === 'number') {
      if (Number.isFinite(raw)) return String(Math.trunc(raw));
    }
    if (raw instanceof Date) return '';
    return String(raw).trim();
  }

  private parseExcelStockCell(cell: ExcelJS.Cell): number | null {
    return parseExcelDecimalCell(cell);
  }

  private detectFileStockMode(
    rows: Array<{ initialStock: number | null }>,
    hasStockColumnHeader = false,
  ): ProductImportFileStockMode {
    const hasStockData = rows.some((r) => r.initialStock !== null);
    return hasStockData || hasStockColumnHeader ? 'with_stock' : 'without_stock';
  }

  /** Tasdiqlashda yuboriladigan qator (skip + Excelda zaxira > 0 ham kiradi) */
  private isConfirmableImportRow(row: {
    errors: string[];
    rowAction?: string;
    fileStockMode?: string;
    initialStockRaw?: number | null;
    initialStock?: number | null;
  }): boolean {
    if (row.errors?.length > 0) return false;
    if (row.rowAction !== 'skip') return true;
    if (row.fileStockMode === 'without_stock') return false;
    const excelRaw = row.initialStockRaw ?? row.initialStock;
    return excelRaw !== null && excelRaw !== undefined && Number(excelRaw) > 0;
  }

  private countStockApplyRows(rows: any[]): number {
    return rows.filter(
      (r) =>
        r.errors?.length === 0 &&
        r.stockAction === 'apply' &&
        r.fileStockMode === 'with_stock' &&
        r.initialStockRaw !== null &&
        r.initialStockRaw !== undefined,
    ).length;
  }

  private shouldApplyStock(
    row: {
      initialStock: number | null;
      previousStock: number | null;
      fileStockMode: ProductImportFileStockMode;
    },
    stockPolicy: ProductImportStockPolicy,
  ): boolean {
    if (row.fileStockMode === 'without_stock') return false;
    const excel = row.initialStock;
    const prev = row.previousStock ?? 0;
    if (stockPolicy === 'apply_all') return excel !== null;
    if (excel === null || excel === 0) return false;
    if (excel === prev) return false;
    return true;
  }

  private computeTargetStock(
    current: number,
    excel: number,
    importMode: ProductImportMode,
  ): number {
    if (importMode === 'add') return current + excel;
    if (importMode === 'subtract') return Math.max(0, current - excel);
    return excel;
  }

  /** ACTIVE arxivlangan variantdan ustun (SKU/barcode bo‘yicha) */
  private preferImportCatalogVariant<
    T extends { status: string },
  >(current: T | undefined, next: T): T {
    if (!current) return next;
    if (current.status === 'ACTIVE') return current;
    if (next.status === 'ACTIVE') return next;
    return current;
  }

  private isImportVariantArchived(variant: {
    status: string;
    product?: { status: string } | null;
  }): boolean {
    return (
      variant.status === 'ARCHIVED' ||
      variant.product?.status === 'ARCHIVED'
    );
  }

  private async reactivateArchivedProductForImport(
    tx: Prisma.TransactionClient,
    variant: { id: string; productId: string; product?: { status: string } | null },
  ) {
    if (variant.product?.status === 'ARCHIVED') {
      await tx.product.update({
        where: { id: variant.productId },
        data: { status: 'ACTIVE' },
      });
    }
    await tx.productVariant.update({
      where: { id: variant.id },
      data: { status: 'ACTIVE' },
    });
  }

  async processImportFile(
    companyId: string,
    buffer: Buffer,
    options?: {
      defaultWarehouseId?: string;
      importMode?: ProductImportMode;
      stockPolicy?: ProductImportStockPolicy;
    },
  ) {
    await this.ensureActiveWarehouseExists(companyId);

    let forcedWarehouse: { id: string; name: string } | null = null;
    const defaultWarehouseId = (options?.defaultWarehouseId || '').trim();
    if (defaultWarehouseId) {
      const wh = await this.prisma.warehouse.findFirst({
        where: { id: defaultWarehouseId, companyId, status: 'ACTIVE' },
        select: { id: true, name: true },
      });
      if (!wh) {
        throw new BadRequestException('Tanlangan ombor topilmadi yoki faol emas.');
      }
      forcedWarehouse = wh;
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any, {
      ignoreNodes: ['drawing', 'chart', 'picture'],
    });
    const worksheet =
      findProductImportWorksheet(workbook) ?? workbook.worksheets[0];
    if (!worksheet) {
      throw new BadRequestException('Excel faylida varaq topilmadi.');
    }
    const excelFormat = detectProductImportExcelFormat(worksheet);
    const columnGuide = getProductImportColumnGuide(excelFormat);
    const trailingCols = resolveImportTrailingColumnIndexes(worksheet);

    const rows: any[] = [];
    const warehouses = forcedWarehouse
      ? [{ id: forcedWarehouse.id, name: forcedWarehouse.name }]
      : await this.prisma.warehouse.findMany({
          where: { companyId, status: 'ACTIVE' },
          select: { id: true, name: true },
        });

    const parseHelpers = {
      parseString: (cell: ExcelJS.Cell) => this.parseImportCellString(cell),
      parseStock: (cell: ExcelJS.Cell) => this.parseExcelStockCell(cell),
    };

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const parsed = parseProductImportExcelRow(
        row,
        excelFormat,
        parseHelpers,
        trailingCols,
      );

      const data = {
        ...parsed,
        errors: [] as string[],
      };

      if (isProductImportRowEmpty(parsed, excelFormat, row)) return;

      if (!data.name) data.errors.push("Mahsulot nomi bo'sh bo'lishi mumkin emas");
      if (!Number.isFinite(data.purchasePrice) || data.purchasePrice < 0) {
        data.errors.push(formatImportPriceError('purchase', excelFormat));
      }
      if (!Number.isFinite(data.salePrice) || data.salePrice < 0) {
        data.errors.push(formatImportPriceError('sale', excelFormat));
      }
      if (parsed.initialStockRaw !== null) {
        const stockUnit = String((data as any).unit || 'dona');
        const stockErr = stockQuantityImportError(
          parsed.initialStockRaw,
          stockUnit,
        );
        if (stockErr) {
          data.errors.push(stockErr);
        } else {
          const normalized = normalizeStockQuantity(
            parsed.initialStockRaw,
            stockUnit,
          );
          (data as any).initialStockRaw = normalized;
          (data as any).initialStock = normalized;
        }
      }
      if (!['UZS', 'USD'].includes(data.currency)) {
        data.errors.push(formatImportCurrencyError(excelFormat, data.currency));
      }
      if (parsed.unitRaw) {
        const unitParsed = parseProductUnitInput(parsed.unitRaw);
        if (unitParsed.invalid) {
          data.errors.push(formatProductUnitImportError(parsed.unitRaw, excelFormat));
        } else {
          (data as any).unit = unitParsed.unit;
        }
      } else {
        (data as any).unit = '';
      }

      if (forcedWarehouse) {
        const excelWarehouseName = String(data.warehouseName || '').trim();
        (data as any).warehouseId = forcedWarehouse.id;
        (data as any).warehouseName = forcedWarehouse.name;
        if (
          excelWarehouseName &&
          excelWarehouseName.toLowerCase() !== forcedWarehouse.name.toLowerCase()
        ) {
          (data as any).warehouseHint =
            `Excel ombori "${excelWarehouseName}" e'tiborsiz — UI dan "${forcedWarehouse.name}" ishlatiladi`;
        }
      } else {
        const normalizedWarehouseName = String(data.warehouseName || '').trim();
        const warehouseKey = normalizedWarehouseName.toLowerCase();
        const warehouse = warehouses.find((w) => {
          const wn = w.name.trim().toLowerCase();
          return (
            wn === warehouseKey ||
            wn.includes(warehouseKey) ||
            warehouseKey.includes(wn)
          );
        });
        if (!normalizedWarehouseName) {
          data.errors.push('Ombor nomi majburiy');
        } else if (!warehouse) {
          data.errors.push(`Ombor topilmadi: ${data.warehouseName}`);
        } else {
          (data as any).warehouseId = warehouse.id;
        }
      }

      rows.push(data);
    });

    const previewMax = getImportPreviewMaxRows();
    if (rows.length > previewMax) {
      throw new BadRequestException(
        `Excel juda katta: ${rows.length} qator (limit ${previewMax}). Faylni bo‘lib yuklang yoki qatorlarni kamaytiring.`,
      );
    }

    // Excel: SKU faqat birinchi qatorda — ketma-ket bir xil mahsulot nomiga tarqatiladi
    let lastSku = '';
    let lastProductName = '';
    for (const row of rows) {
      const name = String(row.name || '').trim();
      const sku = String(row.sku || '').trim();
      if (sku) {
        lastSku = sku;
        lastProductName = name;
        row.sku = sku;
      } else if (name === lastProductName && lastSku) {
        row.sku = lastSku;
      } else if (name !== lastProductName) {
        lastSku = '';
        lastProductName = name;
      }
    }

    const fileStockMode = this.detectFileStockMode(
      rows.map((r) => ({ initialStock: r.initialStockRaw })),
      worksheetHasStockColumn(worksheet),
    );
    rows.forEach((r) => {
      (r as any).fileStockMode = fileStockMode;
    });

    const skus = rows.map((r) => String(r.sku || '').trim()).filter(Boolean);
    const barcodes = rows.map((r) => String(r.barcode || '').trim()).filter(Boolean);
    const barcodeCounts = new Map<string, number>();
    for (const barcode of barcodes) {
      const key = barcode.toLowerCase();
      barcodeCounts.set(key, (barcodeCounts.get(key) || 0) + 1);
    }

    const variantKeyCounts = new Map<string, number>();
    for (const row of rows) {
      const key = importVariantIdentityKey(row.name, row.variant, row.color);
      if (key === '|default') continue;
      variantKeyCounts.set(key, (variantKeyCounts.get(key) || 0) + 1);
    }

    const variantIdsFromFile = rows
      .map((r) => String((r as any).variantId || '').trim())
      .filter(Boolean);

    const catalogScope = forcedWarehouse
      ? importVariantCatalogFilter(companyId, forcedWarehouse.id)
      : { companyId, status: 'ACTIVE' as const };

    const matchOr: Prisma.ProductVariantWhereInput[] = [
      ...(variantIdsFromFile.length ? [{ id: { in: variantIdsFromFile } }] : []),
      ...(skus.length ? [{ sku: { in: skus, mode: 'insensitive' as const } }] : []),
      ...(barcodes.length ? [{ barcode: { in: barcodes, mode: 'insensitive' as const } }] : []),
    ];

    const variantInclude = {
      product: {
        select: {
          id: true,
          name: true,
          categoryId: true,
          unit: true,
          status: true,
        },
      },
      stockBalances: forcedWarehouse
        ? {
            where: { warehouseId: forcedWarehouse.id },
            select: { warehouseId: true, quantity: true },
          }
        : { select: { warehouseId: true, quantity: true } },
    } as const;

    const existingVariants =
      matchOr.length === 0
        ? []
        : await this.prisma.productVariant.findMany({
            where: {
              AND: [catalogScope, { OR: matchOr }],
            },
            include: variantInclude,
          });

    const archivedVariants =
      matchOr.length === 0
        ? []
        : await this.prisma.productVariant.findMany({
            where: {
              companyId,
              status: 'ARCHIVED',
              OR: matchOr,
            },
            include: variantInclude,
          });

    type CatalogVariant = (typeof existingVariants)[0];
    const byId = new Map<string, CatalogVariant>();
    const byBarcode = new Map<string, CatalogVariant>();
    const bySku = new Map<string, CatalogVariant>();
    const byNameVariant = new Map<string, CatalogVariant>();
    const mergeCatalogVariant = (v: CatalogVariant) => {
      byId.set(v.id, this.preferImportCatalogVariant(byId.get(v.id), v));
      if (v.barcode) {
        const key = String(v.barcode).toLowerCase();
        byBarcode.set(
          key,
          this.preferImportCatalogVariant(byBarcode.get(key), v),
        );
      }
      if (v.sku) {
        const key = String(v.sku).toLowerCase();
        bySku.set(key, this.preferImportCatalogVariant(bySku.get(key), v));
      }
      const catalogFields = exportVariantExcelFields({
        name: v.name,
        attributesJson: v.attributesJson,
      });
      const nvKey = importVariantIdentityKey(
        v.product?.name || '',
        catalogFields.variant,
        catalogFields.color,
      );
      if (nvKey !== '|') {
        byNameVariant.set(
          nvKey,
          this.preferImportCatalogVariant(byNameVariant.get(nvKey), v),
        );
      }
    };
    for (const v of existingVariants) mergeCatalogVariant(v);
    for (const v of archivedVariants) mergeCatalogVariant(v);

    const defaultPolicy: ProductImportStockPolicy =
      options?.stockPolicy ?? 'apply_all';

    rows.forEach((row) => {
      const sku = String(row.sku || '').trim();
      const barcode = String(row.barcode || '').trim();
      if (barcode && (barcodeCounts.get(barcode.toLowerCase()) || 0) > 1) {
        row.errors.push(`Fayl ichida barkod takrorlangan: ${barcode}`);
      }

      const fileVariantKey = importVariantIdentityKey(row.name, row.variant, row.color);
      if (
        fileVariantKey !== '|default' &&
        (variantKeyCounts.get(fileVariantKey) || 0) > 1
      ) {
        row.errors.push(
          `Fayl ichida takrorlangan qator: ${row.name} — ${row.color || row.variant || 'variant'}`,
        );
      }

      let existing: (typeof existingVariants)[0] | undefined;
      const fileVariantId = String((row as any).variantId || '').trim();
      if (fileVariantId) existing = byId.get(fileVariantId);
      if (barcode) existing = existing ?? byBarcode.get(barcode.toLowerCase());
      const nvKey = importVariantIdentityKey(row.name, row.variant, row.color);
      if (!existing) existing = byNameVariant.get(nvKey);
      if (!existing && sku) {
        const skuMatch = bySku.get(sku.toLowerCase());
        if (skuMatch) {
          const skuFields = exportVariantExcelFields({
            name: skuMatch.name,
            attributesJson: skuMatch.attributesJson,
          });
          const skuNvKey = importVariantIdentityKey(
            skuMatch.product?.name || '',
            skuFields.variant,
            skuFields.color,
          );
          if (skuNvKey === nvKey) {
            existing = skuMatch;
          } else {
            (row as any).existingProductId = skuMatch.productId;
          }
        }
      }

      const warehouseId = String((row as any).warehouseId || '');
      const balance = existing?.stockBalances?.find((b) => b.warehouseId === warehouseId);
      const previousStock = balance ? Number(balance.quantity) : 0;

      (row as any).existingVariantId = existing?.id ?? null;
      (row as any).existingProductId = existing?.productId ?? null;
      (row as any).previousStock = previousStock;
      (row as any).hasStockInWarehouse = !!balance;
      (row as any).catalogMatch = !!existing;
      (row as any).previousSalePrice = existing ? Number(existing.salePrice || 0) : null;
      (row as any).previousPurchasePrice = existing ? Number(existing.purchasePrice || 0) : null;
      (row as any).previousUnit = existing?.product?.unit
        ? normalizeProductUnit(existing.product.unit)
        : 'dona';

      const stockWillApply = this.shouldApplyStock(
        {
          initialStock: row.initialStockRaw,
          previousStock,
          fileStockMode,
        },
        defaultPolicy,
      );

      const priceChanged =
        !!existing &&
        (Number(row.salePrice) !== Number(existing.salePrice || 0) ||
          Number(row.purchasePrice) !== Number(existing.purchasePrice || 0) ||
          row.currency !== (existing.currency || 'UZS'));
      const unitChanged =
        !!existing &&
        !!(row as any).unit &&
        normalizeProductUnit((row as any).unit) !==
          normalizeProductUnit(existing?.product?.unit);
      const dataChanged = priceChanged || unitChanged;

      if (existing) {
        const isArchived = this.isImportVariantArchived(existing);
        if (isArchived) {
          (row as any).reactivateArchived = true;
          (row as any).rowAction = 'update';
          (row as any).stockAction = stockWillApply ? 'apply' : 'skip';
        } else {
          (row as any).rowAction = 'update';
          if (!stockWillApply && !dataChanged) {
            (row as any).rowAction = 'skip';
          }
        }
      } else {
        (row as any).rowAction = 'create';
        if (fileStockMode === 'with_stock' && (row.initialStockRaw === null || row.initialStockRaw === 0)) {
          (row as any).stockAction = 'skip';
        } else if (fileStockMode === 'without_stock') {
          (row as any).stockAction = 'skip';
        } else {
          (row as any).stockAction = 'apply';
        }
      }

      if (existing) {
        (row as any).stockAction = stockWillApply ? 'apply' : 'skip';
      }

      if (existing && stockWillApply && row.initialStockRaw !== null) {
        const excelQty = Number(row.initialStockRaw);
        const targetQty = this.computeTargetStock(
          previousStock,
          excelQty,
          options?.importMode || 'set',
        );
        const delta = targetQty - previousStock;
        if (delta < 0 && Number(previousStock) + delta < -0.0001) {
          row.errors.push(
            `Omborda yetarli qoldiq yo'q. Mavjud: ${previousStock}, chiqim: ${Math.abs(delta)} (Excel: ${excelQty}, rejim: ${options?.importMode || 'set'})`,
          );
          (row as any).rowAction = 'skip';
        }
      }
    });

    const importable = rows.filter((r) => r.errors.length === 0 && (r as any).rowAction !== 'skip');
    const confirmable = rows.filter((r) => this.isConfirmableImportRow(r as any));
    const stockApplyCount = this.countStockApplyRows(rows as any[]);
    const previewImportMode = options?.importMode || 'set';

    return {
      total: rows.length,
      valid: importable.length,
      confirmable: confirmable.length,
      stockApplyCount,
      invalid: rows.filter((r) => r.errors.length > 0).length,
      skipped: rows.filter((r) => r.errors.length === 0 && (r as any).rowAction === 'skip').length,
      create: rows.filter((r) => r.errors.length === 0 && (r as any).rowAction === 'create').length,
      update: rows.filter((r) => r.errors.length === 0 && (r as any).rowAction === 'update').length,
      fileStockMode,
      defaultImportMode:
        fileStockMode === 'with_stock' ? ('add' as ProductImportMode) : ('set' as ProductImportMode),
      importMode: previewImportMode,
      excelFormat,
      worksheetName: worksheet.name,
      columnGuide,
      rows,
    };
  }

  private normalizeImportConfirmRows(
    rows: any[],
    defaultWarehouseId?: string,
  ): any[] {
    const fallbackWh = String(defaultWarehouseId || '').trim();
    return (rows || []).map((row) => ({
      ...row,
      warehouseId: String(row?.warehouseId || fallbackWh || '').trim() || undefined,
    }));
  }

  /** Previewda "skip" bo‘lgan, lekin Excelda zaxira bor qatorlarni importda qayta faollashtirish */
  private reactivateRowsForImportPolicy(
    rows: any[],
    options: ProductImportOptions,
  ) {
    const policy = options.stockPolicy ?? 'apply_all';
    if (policy !== 'apply_all') return;

    for (const row of rows) {
      if (row.rowAction !== 'skip') continue;
      if (row.fileStockMode === 'without_stock') continue;
      const excelRaw = row.initialStockRaw ?? row.initialStock;
      if (excelRaw === null || excelRaw === undefined) continue;
      if (!Number.isFinite(Number(excelRaw)) || Number(excelRaw) <= 0) continue;

      row.rowAction = row.existingVariantId || row.catalogMatch ? 'update' : 'create';
      row.stockAction = 'apply';
    }
  }

  private async ensureImportCategoryId(
    tx: Prisma.TransactionClient,
    companyId: string,
    warehouseId: string,
    cache: Map<string, string>,
  ): Promise<string> {
    const cacheKey = `__default__:${warehouseId}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    let category = await tx.productCategory.findFirst({
      where: { companyId, warehouseId, status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!category) {
      category = await tx.productCategory.create({
        data: {
          companyId,
          warehouseId,
          name: 'Umumiy',
          status: 'ACTIVE',
        },
        select: { id: true },
      });
    }
    cache.set(cacheKey, category.id);
    return category.id;
  }

  async enqueueImport(
    companyId: string,
    userId: string,
    rows: any[],
    importOptions: ProductImportOptions = { importMode: 'set', stockPolicy: 'apply_all' },
    defaultWarehouseId?: string,
  ) {
    await this.ensureActiveWarehouseExists(companyId);

    const normalizedRows = this.normalizeImportConfirmRows(rows, defaultWarehouseId);
    this.reactivateRowsForImportPolicy(normalizedRows, importOptions);
    const confirmMax = getImportConfirmMaxRows();
    if (normalizedRows.length > confirmMax) {
      throw new BadRequestException(
        `Import: ${normalizedRows.length} qator (limit ${confirmMax}). Navbatga bo‘lib yuboring.`,
      );
    }

    const workRows = normalizedRows.filter((r) => r?.rowAction !== 'skip');

    if (workRows.length === 0) {
      throw new BadRequestException(
        'Import qilinadigan qator yo\'q (barchasi xato yoki o\'tkazilgan).',
      );
    }

    const missingWarehouse = workRows.filter((r) => !String(r.warehouseId || '').trim());
    if (missingWarehouse.length > 0) {
      throw new BadRequestException(
        `${missingWarehouse.length} ta qatorda ombor topilmadi. Inventarda omborni tanlang va importni qayta boshlang.`,
      );
    }
    const syncMax = this.getImportSyncMaxRows();
    if (workRows.length > 0 && workRows.length <= syncMax) {
      return this.runSyncImportDirect(companyId, userId, workRows, importOptions);
    }

    const job = await this.prisma.productImportJob.create({
      data: {
        companyId,
        userId,
        status: 'QUEUED',
        totalRows: workRows.length,
        partnerLedgerContactId: importOptions.partnerLedgerContactId?.trim() || null,
      },
      select: { id: true, status: true, totalRows: true },
    });

    const importOptionsWithJob = {
      ...importOptions,
      ledgerSourceId: job.id,
    };

    const chunkSize = 500;
    for (let start = 0; start < normalizedRows.length; start += chunkSize) {
      const chunk = normalizedRows.slice(start, start + chunkSize);
      await this.prisma.productImportStagingRow.createMany({
        data: chunk.map((row, idx) => ({
          jobId: job.id,
          rowIndex: start + idx,
          payload: { ...row, _importOptions: importOptionsWithJob },
          status: 'PENDING',
        })),
      });
    }

    const queueOptions: JobsOptions = {
      removeOnComplete: true,
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    };
    if (this.importQueue) {
      await this.importQueue.add('process-product-import', { jobId: job.id }, queueOptions);
    } else {
      // Redis bo'lmaganda ham tizim ishlashi uchun local fallback.
      setImmediate(() => {
        this.runImportJobSafe(job.id);
      });
    }

    return { jobId: job.id, status: job.status, totalRows: job.totalRows };
  }

  /** Kichik import: staging jadvalisiz, lekin job ID (daftar/hisobot) saqlanadi */
  private async runSyncImportDirect(
    companyId: string,
    userId: string,
    workRows: any[],
    importOptions: ProductImportOptions,
  ) {
    const job = await this.prisma.productImportJob.create({
      data: {
        companyId,
        userId,
        status: 'RUNNING',
        totalRows: workRows.length,
        partnerLedgerContactId: importOptions.partnerLedgerContactId?.trim() || null,
        startedAt: new Date(),
      },
      select: { id: true },
    });

    const optionsWithLedger: ProductImportOptions = {
      ...importOptions,
      ledgerSourceId: job.id,
    };
    const rowsForConfirm = workRows.map((row) => ({
      ...row,
      _importOptions: optionsWithLedger,
    }));

    const result = await this.confirmImport(companyId, userId, rowsForConfirm);
    const successRows = result.count;
    const failedRows = result.errors?.length ?? 0;
    const finalStatus = this.resolveImportJobFinalStatus(successRows, failedRows);
    const finalErrorMessage =
      failedRows > 0
        ? result.errors?.[0]?.message ||
          `${failedRows} ta qator import qilinmadi. ${successRows} ta muvaffaqiyatli.`
        : null;

    await this.prisma.productImportJob.update({
      where: { id: job.id },
      data: {
        status: finalStatus,
        processedRows: workRows.length,
        successRows,
        failedRows,
        errorMessage: finalErrorMessage,
        finishedAt: new Date(),
      },
    });

    return {
      sync: true,
      jobId: job.id,
      status: finalStatus,
      totalRows: workRows.length,
      processedRows: workRows.length,
      successRows,
      failedRows,
      errorMessage: finalErrorMessage,
      errors: result.errors ?? [],
    };
  }

  async getImportJobStatus(companyId: string, jobId: string) {
    const job = await this.prisma.productImportJob.findFirst({
      where: { id: jobId, companyId },
      select: {
        id: true,
        status: true,
        totalRows: true,
        processedRows: true,
        successRows: true,
        failedRows: true,
        errorMessage: true,
        startedAt: true,
        finishedAt: true,
      },
    });
    if (!job) throw new NotFoundException('Import job topilmadi');
    return job;
  }

  async cancelImportJob(companyId: string, jobId: string) {
    const job = await this.prisma.productImportJob.findFirst({
      where: { id: jobId, companyId },
      select: { id: true, status: true },
    });
    if (!job) throw new NotFoundException('Import job topilmadi');
    if (job.status === 'COMPLETED' || job.status === 'CANCELLED') {
      return { jobId: job.id, status: job.status };
    }
    await this.prisma.productImportJob.update({
      where: { id: job.id },
      data: {
        status: 'CANCELLED',
        errorMessage: 'Foydalanuvchi tomonidan bekor qilindi',
        finishedAt: new Date(),
      },
    });
    return { jobId: job.id, status: 'CANCELLED' };
  }

  private async isImportJobCancelled(jobId: string): Promise<boolean> {
    const row = await this.prisma.productImportJob.findUnique({
      where: { id: jobId },
      select: { status: true },
    });
    return row?.status === 'CANCELLED';
  }

  private async runImportJobSafe(jobId: string) {
    try {
      await this.processImportJob(jobId);
    } catch (err) {
      const message =
        (err as any)?.message || 'Import jarayoni kutilmagan xato bilan to\'xtadi';
      this.logger.error(`Import job ${jobId} failed: ${message}`, (err as any)?.stack);
      await this.prisma.productImportJob
        .update({
          where: { id: jobId },
          data: {
            status: 'FAILED',
            errorMessage: message,
            finishedAt: new Date(),
          },
        })
        .catch(() => undefined);
    }
  }

  async getImportJobFailures(companyId: string, jobId: string, limit = 30) {
    const job = await this.prisma.productImportJob.findFirst({
      where: { id: jobId, companyId },
      select: { id: true },
    });
    if (!job) throw new NotFoundException('Import job topilmadi');

    const capped = Math.min(Math.max(limit, 1), 100);
    const rows = await this.prisma.productImportStagingRow.findMany({
      where: { jobId: job.id, status: 'FAILED' },
      orderBy: { rowIndex: 'asc' },
      take: capped,
      select: { rowIndex: true, errorMessage: true, payload: true },
    });

    return {
      jobId: job.id,
      failures: rows.map((r) => {
        const payload = (r.payload || {}) as Record<string, unknown>;
        return {
          rowIndex: r.rowIndex,
          name: String(payload.name || ''),
          sku: String(payload.sku || ''),
          barcode: String(payload.barcode || ''),
          error: r.errorMessage || 'Noma\'lum xato',
        };
      }),
    };
  }

  private async applyImportStagingResults(
    jobId: string,
    workStaging: Array<{ id: string; rowIndex: number; payload: unknown }>,
    result: {
      importedCount: number;
      errors: Array<{ index: number; message: string }>;
    },
  ) {
    const errorByIndex = new Map(result.errors.map((e) => [e.index, e.message]));
    let lastError: string | null = null;

    for (let i = 0; i < workStaging.length; i += 1) {
      const row = workStaging[i];
      const errMsg = errorByIndex.get(i);
      if (errMsg) {
        lastError = errMsg;
        await this.prisma.productImportStagingRow.update({
          where: { id: row.id },
          data: { status: 'FAILED', errorMessage: errMsg },
        });
      } else {
        await this.prisma.productImportStagingRow.update({
          where: { id: row.id },
          data: { status: 'PROCESSED', errorMessage: null },
        });
      }
    }

    await this.prisma.productImportStagingRow.updateMany({
      where: { jobId, status: 'PENDING' },
      data: { status: 'PROCESSED', errorMessage: null },
    });

    return {
      lastError,
      successRows: result.importedCount,
      failedRows: result.errors.length,
    };
  }

  private resolveImportJobFinalStatus(
    successRows: number,
    failedRows: number,
  ): 'COMPLETED' | 'COMPLETED_WITH_ERRORS' | 'FAILED' {
    if (failedRows === 0) return 'COMPLETED';
    if (successRows > 0) return 'COMPLETED_WITH_ERRORS';
    return 'FAILED';
  }

  private async processImportJob(jobId: string) {
    const job = await this.prisma.productImportJob.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        companyId: true,
        userId: true,
        status: true,
        partnerLedgerContactId: true,
      },
    });
    if (!job) return;
    if (job.status === 'CANCELLED' || job.status === 'COMPLETED') return;
    if (job.status === 'COMPLETED_WITH_ERRORS') return;
    if (job.status === 'RUNNING') return;

    await this.prisma.productImportJob.update({
      where: { id: job.id },
      data: { status: 'RUNNING', startedAt: new Date(), errorMessage: null },
    });

    const staging = await this.prisma.productImportStagingRow.findMany({
      where: { jobId: job.id },
      orderBy: { rowIndex: 'asc' },
      select: { id: true, rowIndex: true, payload: true },
    });

    const workStaging = staging.filter((s) => {
      const payload = s.payload as Record<string, unknown>;
      return payload?.rowAction !== 'skip';
    });

    let processedRows = 0;
    let successRows = 0;
    let failedRows = 0;
    let lastError: string | null = null;

    const progressEvery = this.getImportBatchSize();
    const totalRows = workStaging.length;
    const pushImportProgress = (status: string, errMsg?: string | null) => {
      this.inventoryGateway.emitImportProgress(job.companyId, {
        jobId: job.id,
        status,
        processedRows,
        totalRows,
        successRows,
        failedRows,
        errorMessage: errMsg ?? null,
      });
    };

    pushImportProgress('RUNNING');

    const result = await this.executeImportRows(
      job.companyId,
      job.userId,
      workStaging.map((s) => s.payload as any),
      async (stats) => {
        processedRows = stats.processed;
        successRows = stats.success;
        failedRows = stats.failed;
        if (stats.processed % progressEvery === 0 || stats.processed >= workStaging.length) {
          if (await this.isImportJobCancelled(job.id)) return;
          await this.prisma.productImportJob.update({
            where: { id: job.id },
            data: { processedRows, successRows, failedRows },
          });
          pushImportProgress('RUNNING');
        }
      },
      () => this.isImportJobCancelled(job.id),
    );

    const stagingResult = await this.applyImportStagingResults(
      job.id,
      workStaging,
      result,
    );
    lastError = stagingResult.lastError;
    successRows = stagingResult.successRows;
    failedRows = stagingResult.failedRows;

    processedRows = workStaging.length;

    if (await this.isImportJobCancelled(job.id)) {
      return;
    }

    const finalStatus = this.resolveImportJobFinalStatus(successRows, failedRows);
    const finalErrorMessage =
      failedRows > 0
        ? lastError ||
          `${failedRows} ta qator import qilinmadi. ${successRows} ta muvaffaqiyatli.`
        : null;
    await this.prisma.productImportJob.update({
      where: { id: job.id },
      data: {
        status: finalStatus,
        processedRows,
        successRows,
        failedRows,
        errorMessage: finalErrorMessage,
        finishedAt: new Date(),
      },
    });
    pushImportProgress(finalStatus, finalErrorMessage);

    await this.linkPartnerLedgerFromImport(
      job.companyId,
      job.userId,
      job.partnerLedgerContactId || undefined,
      job.id,
      result.ledgerAccumulator,
    );
  }

  private async importUpdateExistingVariant(
    tx: Prisma.TransactionClient,
    companyId: string,
    userId: string,
    variantId: string,
    row: any,
    options: ProductImportOptions,
    ledgerAcc: ImportLedgerAccumulator | null,
    preloaded?: ImportVariantSnapshot | null,
  ) {
    const warehouseId = String(row.warehouseId || '').trim();
    let variant: {
      id: string;
      productId: string;
      status: string;
      name: string;
      purchasePrice: Prisma.Decimal | null;
      salePrice: Prisma.Decimal | null;
      currency: string;
      attributesJson: Prisma.JsonValue | null;
      product: ImportProductSnapshot | null;
    } | null = null;
    let previousStock = 0;

    if (preloaded) {
      variant = preloaded;
      previousStock = preloaded.stockByWarehouse.get(warehouseId) ?? 0;
    } else {
      const loaded = await tx.productVariant.findFirst({
        where: { id: variantId, companyId },
        include: {
          product: { select: { id: true, name: true, status: true, unit: true, categoryId: true } },
          stockBalances: { where: { warehouseId } },
        },
      });
      if (!loaded) {
        throw new NotFoundException('Mavjud variant topilmadi');
      }
      variant = {
        id: loaded.id,
        productId: loaded.productId,
        status: loaded.status,
        name: loaded.name,
        purchasePrice: loaded.purchasePrice,
        salePrice: loaded.salePrice,
        currency: loaded.currency,
        attributesJson: loaded.attributesJson,
        product: loaded.product
          ? {
              id: loaded.product.id,
              name: loaded.product.name,
              status: loaded.product.status,
              unit: loaded.product.unit,
              categoryId: loaded.product.categoryId,
            }
          : null,
      };
      previousStock = loaded.stockBalances[0]
        ? Number(loaded.stockBalances[0].quantity)
        : 0;
    }

    if (!variant) {
      throw new NotFoundException('Mavjud variant topilmadi');
    }

    if (this.isImportVariantArchived(variant)) {
      await this.reactivateArchivedProductForImport(tx, variant);
      variant.status = 'ACTIVE';
      if (variant.product) variant.product.status = 'ACTIVE';
    }

    const variantName = resolveImportVariantDisplayName(
      row.name || variant.product?.name || '',
      row.variant,
      row.color,
    );
    const attributesJson = this.mergeImportAttributesJson(
      row.color,
      variant.attributesJson,
    );

    await tx.productVariant.update({
      where: { id: variant.id },
      data: {
        name: variantName,
        ...(attributesJson ? { attributesJson: attributesJson as Prisma.InputJsonValue } : {}),
        purchasePrice: row.purchasePrice,
        salePrice: row.salePrice,
        currency: row.currency,
      },
    });

    if (variant.product) {
      const productPatch: { name?: string; unit?: string } = {};
      if (row.name) productPatch.name = row.name;
      if (row.unit) productPatch.unit = normalizeProductUnit(row.unit);
      if (Object.keys(productPatch).length > 0) {
        await tx.product.update({
          where: { id: variant.productId },
          data: productPatch,
        });
      }
    }

    const fileStockMode = (row.fileStockMode || 'with_stock') as ProductImportFileStockMode;
    const excelRaw = row.initialStockRaw ?? row.initialStock;
    const excelStock = excelRaw === null || excelRaw === undefined ? null : Number(excelRaw);

    const applyStock = this.shouldApplyStock(
      {
        initialStock: excelStock,
        previousStock,
        fileStockMode,
      },
      options.stockPolicy,
    );

    if (!applyStock || excelStock === null) return;

    const targetQty = this.computeTargetStock(previousStock, excelStock, options.importMode);
    const delta = targetQty - previousStock;
    if (delta === 0) return;

    if (delta < 0 && Number(previousStock) + delta < -0.0001) {
      throw new BadRequestException(
        `Omborda yetarli qoldiq yo'q. Mavjud: ${previousStock}, chiqim: ${Math.abs(delta)} (Excel: ${excelStock}, rejim: ${options.importMode})`,
      );
    }

    const movementType = delta > 0 ? 'IN' : 'OUT';
    await this.stockService.recordMovement(
      companyId,
      {
        warehouseId,
        productVariantId: variant.id,
        quantity: Math.abs(delta),
        note: `Excel import (${options.importMode})`,
      },
      movementType,
      'ADJUSTMENT',
      userId,
      tx,
      { emitRealtime: false, skipEntityVerify: true },
    );

    if (ledgerAcc && delta > 0) {
      trackImportStockInbound(
        ledgerAcc,
        Math.abs(delta),
        row.purchasePrice ?? variant.purchasePrice,
        row.currency ?? variant.currency,
        variant.product?.name || row.name || variant.name,
      );
    }
  }

  /** Importdan keyin: mahsulotda SKU yo'q, Excelda bor — birinchi variantga yozish */
  private async ensureProductCanonicalSkuAfterImport(
    tx: Prisma.TransactionClient,
    companyId: string,
    productId: string,
    skuRaw: string,
    seenSkuInImport: Set<string>,
  ): Promise<void> {
    const sku = String(skuRaw || '').trim();
    if (!sku) return;

    const hasOnProduct = await tx.productVariant.findFirst({
      where: { productId, companyId, status: 'ACTIVE', sku: { not: null } },
      select: { id: true },
    });
    if (hasOnProduct) return;

    const skuKey = sku.toLowerCase();
    if (seenSkuInImport.has(skuKey)) {
      const takenGlobally = await tx.productVariant.findFirst({
        where: {
          companyId,
          sku: { equals: sku, mode: 'insensitive' },
          status: 'ACTIVE',
        },
        select: { id: true },
      });
      if (takenGlobally) return;
    }

    const firstVariant = await tx.productVariant.findFirst({
      where: { productId, companyId, status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    if (!firstVariant) return;

    try {
      await tx.productVariant.update({
        where: { id: firstVariant.id },
        data: { sku },
      });
      seenSkuInImport.add(skuKey);
    } catch {
      // P2002 — boshqa mahsulotda band
    }
  }

  private async processOneImportRowInTx(
    tx: Prisma.TransactionClient,
    companyId: string,
    userId: string,
    row: any,
    ctx: ImportRowProcessContext,
  ): Promise<void> {
    const {
      options,
      seenBarcode,
      seenSkuInImport,
      skuProductCache,
      categoryCache,
      activeWarehouseSet,
      categoryResolver,
      ledgerAcc,
      lookup,
    } = ctx;

    const warehouseId = String(row.warehouseId || '').trim();
    if (!warehouseId) {
      throw new BadRequestException(
        `Ombor majburiy: "${row.name || "Noma'lum mahsulot"}" qatorida ombor tanlanmagan.`,
      );
    }
    if (!activeWarehouseSet.has(warehouseId)) {
      throw new BadRequestException(
        `Ombor topilmadi yoki faol emas: ${row.warehouseName || warehouseId}`,
      );
    }

    const updateVariantId = row.existingVariantId || row.variantId;
    if (updateVariantId && row.rowAction === 'update') {
      const preloaded = lookup.variantById.get(String(updateVariantId)) ?? null;
      await this.importUpdateExistingVariant(
        tx,
        companyId,
        userId,
        updateVariantId,
        row,
        options,
        ledgerAcc,
        preloaded,
      );
      return;
    }

    const sku = String(row.sku || '').trim();
    const barcodeEarly = String(row.barcode || '').trim();
    const archivedVariant = this.findArchivedVariantInLookup(lookup, sku, barcodeEarly);
    if (archivedVariant) {
      await this.reactivateArchivedProductForImport(tx, archivedVariant);
      await this.importUpdateExistingVariant(
        tx,
        companyId,
        userId,
        archivedVariant.id,
        row,
        options,
        ledgerAcc,
        archivedVariant,
      );
      if (sku) {
        skuProductCache.set(sku.toLowerCase(), archivedVariant.productId);
      }
      return;
    }

    const barcode = String(row.barcode || '').trim();
    const categoryRaw = String(row.categoryName || '').trim();
    const currency = ['UZS', 'USD'].includes(String(row.currency || '').toUpperCase())
      ? String(row.currency || '').toUpperCase()
      : 'UZS';
    if (barcode) {
      const key = barcode.toLowerCase();
      if (seenBarcode.has(key)) {
        throw new BadRequestException(`Import ichida barkod takrorlangan: ${barcode}`);
      }
      seenBarcode.add(key);
    }

    let product: ImportProductSnapshot | null = null;
    const existingProductId = String(row.existingProductId || '').trim();

    if (existingProductId) {
      product = lookup.productById.get(existingProductId) ?? null;
      if (!product) {
        product = await tx.product.findFirst({
          where: { id: existingProductId, companyId, status: 'ACTIVE' },
          select: { id: true, name: true, unit: true, categoryId: true, status: true },
        });
        if (product) lookup.productById.set(product.id, product);
      }
      if (product && product.status !== 'ACTIVE') product = null;
    }

    if (!product && sku) {
      const skuKey = sku.toLowerCase();
      let productId = skuProductCache.get(skuKey);
      if (!productId) {
        productId = lookup.variantBySku.get(skuKey)?.productId;
      }
      if (productId) {
        product = lookup.productById.get(productId) ?? null;
        if (product) skuProductCache.set(skuKey, product.id);
      }
    }

    if (!product) {
      product = lookup.productByName.get(row.name) ?? null;
    }

    let resolvedCategoryId: string | undefined;
    if (categoryRaw) {
      resolvedCategoryId = await categoryResolver.resolveOrCreate(
        tx,
        companyId,
        warehouseId,
        categoryRaw,
        categoryCache,
      );
    }
    if (!resolvedCategoryId) {
      resolvedCategoryId = await this.ensureImportCategoryId(
        tx,
        companyId,
        warehouseId,
        categoryCache,
      );
    }

    if (!product) {
      const created = await tx.product.create({
        data: {
          companyId,
          name: row.name,
          categoryId: resolvedCategoryId,
          unit: normalizeProductUnit(row.unit || 'dona'),
          status: 'ACTIVE',
          createdBy: userId,
        },
        select: { id: true, name: true, unit: true, categoryId: true, status: true },
      });
      product = created;
      lookup.productById.set(created.id, created);
      lookup.productByName.set(created.name, created);
      if (sku) {
        skuProductCache.set(sku.toLowerCase(), product.id);
      }
    } else if (sku) {
      skuProductCache.set(sku.toLowerCase(), product.id);
    }
    if (product && row.unit) {
      const nextUnit = normalizeProductUnit(row.unit);
      if (normalizeProductUnit(product.unit) !== nextUnit) {
        await tx.product.update({
          where: { id: product.id },
          data: { unit: nextUnit },
        });
        product.unit = nextUnit;
      }
    }
    if (resolvedCategoryId && product.categoryId !== resolvedCategoryId) {
      await tx.product.update({
        where: { id: product.id },
        data: { categoryId: resolvedCategoryId },
      });
    }

    let finalSkuForCreate: string | undefined = undefined;
    const skuKey = sku ? sku.toLowerCase() : '';
    if (skuKey && !seenSkuInImport.has(skuKey)) {
      finalSkuForCreate = sku;
    }

    const importAttrs = this.mergeImportAttributesJson(row.color);
    const variantData = (skuValue: string | undefined) => ({
      companyId,
      productId: product.id,
      name: resolveImportVariantDisplayName(row.name, row.variant, row.color),
      sku: skuValue,
      barcode: row.barcode || undefined,
      ...(importAttrs
        ? { attributesJson: importAttrs as Prisma.InputJsonValue }
        : {}),
      purchasePrice: row.purchasePrice,
      salePrice: row.salePrice,
      currency,
      status: 'ACTIVE' as const,
      createdBy: userId,
    });

    const variant = await tx.productVariant.create({
      data: variantData(finalSkuForCreate),
    });
    if (finalSkuForCreate && skuKey) {
      seenSkuInImport.add(skuKey);
    }

    const fileStockMode = (row.fileStockMode || 'with_stock') as ProductImportFileStockMode;
    const excelRaw = row.initialStockRaw ?? row.initialStock;
    const excelStock =
      excelRaw === null || excelRaw === undefined ? null : Number(excelRaw);

    const applyStock = this.shouldApplyStock(
      {
        initialStock: excelStock,
        previousStock: 0,
        fileStockMode,
      },
      options.stockPolicy,
    );

    await tx.stockBalance.upsert({
      where: {
        warehouseId_productVariantId: {
          warehouseId,
          productVariantId: variant.id,
        },
      },
      update: {},
      create: {
        companyId,
        warehouseId,
        productVariantId: variant.id,
        quantity: 0,
      },
    });

    if (applyStock && excelStock !== null && excelStock > 0) {
      await this.stockService.recordMovement(
        companyId,
        {
          warehouseId,
          productVariantId: variant.id,
          quantity: excelStock,
          note: 'Excel import (yangi mahsulot)',
        },
        'IN',
        'ADJUSTMENT',
        userId,
        tx,
        { emitRealtime: false, skipEntityVerify: true },
      );
      if (ledgerAcc) {
        trackImportStockInbound(
          ledgerAcc,
          excelStock,
          row.purchasePrice,
          currency,
          row.name || variant.name,
        );
      }
    }

    if (!finalSkuForCreate && sku) {
      await this.ensureProductCanonicalSkuAfterImport(
        tx,
        companyId,
        product.id,
        sku,
        seenSkuInImport,
      );
    }
  }

  private formatImportRowError(error: unknown, row: any): string {
    if (error instanceof BadRequestException) {
      return String(error.message);
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const target = JSON.stringify((error.meta as any)?.target ?? '').toLowerCase();
      if (target.includes('barcode')) {
        return `Barkod allaqachon mavjud: ${String(row.barcode || '').trim()}`;
      }
      if (target.includes('sku')) {
        return `SKU allaqachon mavjud: ${String(row.sku || '').trim()}`;
      }
    }
    return (error as any)?.message || 'Import qatori bajarilmadi';
  }

  private async importConfirmRowWithRetries(
    companyId: string,
    userId: string,
    row: any,
    ctx: ImportRowProcessContext,
  ): Promise<void> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await this.prisma.$transaction(
          async (tx) => {
            await this.processOneImportRowInTx(tx, companyId, userId, row, ctx);
          },
          DEFAULT_TX_OPTIONS,
        );
        return;
      } catch (error) {
        const isSkuConflict =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002' &&
          JSON.stringify((error.meta as any)?.target ?? '')
            .toLowerCase()
            .includes('sku');
        if (isSkuConflict) {
          const retrySkuKey = String(row.sku || '').trim().toLowerCase();
          if (retrySkuKey) ctx.seenSkuInImport.add(retrySkuKey);
          if (attempt < 3) {
            await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
            continue;
          }
        }
        const isTxGone =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2028';
        if (isTxGone && attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
          continue;
        }
        throw error;
      }
    }
  }

  private async executeImportRows(
    companyId: string,
    userId: string,
    rows: any[],
    onProgress?: (stats: {
      processed: number;
      success: number;
      failed: number;
    }) => void | Promise<void>,
    isCancelled?: () => Promise<boolean>,
  ): Promise<{
    importedCount: number;
    errors: Array<{
      index: number;
      rowNumber?: number;
      message: string;
      name?: string;
      sku?: string;
      barcode?: string;
    }>;
    ledgerAccumulator: ImportLedgerAccumulator | null;
  }> {
    const options: ProductImportOptions = rows[0]?._importOptions || {
      importMode: 'set',
      stockPolicy: 'apply_all',
    };
    const partnerLedgerContactId = options.partnerLedgerContactId?.trim() || undefined;
    const ledgerAcc = partnerLedgerContactId ? createImportLedgerAccumulator() : null;
    const workRows = rows.filter((r) => r.rowAction !== 'skip');

    const seenBarcode = new Set<string>();
    const seenSkuInImport = new Set<string>();
    const skuProductCache = new Map<string, string>();
    const categoryCache = new Map<string, string>();
    let importedCount = 0;
    const errors: Array<{
      index: number;
      rowNumber?: number;
      message: string;
      name?: string;
      sku?: string;
      barcode?: string;
    }> = [];

    const importSkuKeys = [
      ...new Set(
        workRows
          .map((r) => String(r.sku || '').trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
    if (importSkuKeys.length > 0) {
      const existingSkuVariants = await this.prisma.productVariant.findMany({
        where: {
          companyId,
          status: 'ACTIVE',
          sku: { in: importSkuKeys, mode: 'insensitive' },
        },
        select: { sku: true },
      });
      for (const v of existingSkuVariants) {
        const key = String(v.sku || '').trim().toLowerCase();
        if (key) seenSkuInImport.add(key);
      }
    }

    const warehouseIdsInJob = [
      ...new Set(
        workRows.map((r) => String(r.warehouseId || '').trim()).filter(Boolean),
      ),
    ];
    const activeWarehouses = await this.prisma.warehouse.findMany({
      where: {
        companyId,
        status: 'ACTIVE',
        id: { in: warehouseIdsInJob },
      },
      select: { id: true },
    });
    const activeWarehouseSet = new Set(activeWarehouses.map((w) => w.id));

    const categoryCatalog = await this.prisma.productCategory.findMany({
      where: {
        companyId,
        status: { not: 'ARCHIVED' },
        OR: [
          { warehouseId: { in: warehouseIdsInJob } },
          { warehouseId: null },
        ],
      },
      select: { id: true, name: true, parentId: true, warehouseId: true },
    });
    const categoryResolver = this.buildCategoryPathResolver(categoryCatalog);

    const lookup = await this.buildImportExecuteLookup(companyId, workRows);
    for (const [skuKey, snap] of lookup.variantBySku) {
      if (!skuProductCache.has(skuKey)) {
        skuProductCache.set(skuKey, snap.productId);
      }
    }

    const ctx: ImportRowProcessContext = {
      options,
      seenBarcode,
      seenSkuInImport,
      skuProductCache,
      categoryCache,
      activeWarehouseSet,
      categoryResolver,
      ledgerAcc,
      lookup,
    };

    const txBatchSize = this.getImportRowTxBatchSize();
    let processed = 0;

    for (let offset = 0; offset < workRows.length; offset += txBatchSize) {
      if (isCancelled && (await isCancelled())) {
        break;
      }

      const slice = workRows.slice(offset, offset + txBatchSize);
      let sliceImported = 0;

      try {
        await this.prisma.$transaction(
          async (tx) => {
            for (const row of slice) {
              await this.processOneImportRowInTx(tx, companyId, userId, row, ctx);
            }
          },
          DEFAULT_TX_OPTIONS,
        );
        sliceImported = slice.length;
      } catch {
        for (const row of slice) {
          try {
            await this.importConfirmRowWithRetries(companyId, userId, row, ctx);
            sliceImported += 1;
          } catch (rowError) {
            const rowIndex = offset + slice.indexOf(row);
            errors.push({
              index: rowIndex,
              rowNumber: rowIndex + 1,
              message: this.formatImportRowError(rowError, row),
              name: String(row.name || '').trim(),
              sku: String(row.sku || '').trim(),
              barcode: String(row.barcode || '').trim(),
            });
          }
        }
      }

      importedCount += sliceImported;
      processed += slice.length;
      if (onProgress) {
        await onProgress({
          processed,
          success: importedCount,
          failed: errors.length,
        });
      }
    }

    return { importedCount, errors, ledgerAccumulator: ledgerAcc };
  }

  async confirmImport(companyId: string, userId: string, rows: any[]) {
    const importOptions: ProductImportOptions = rows[0]?._importOptions || {
      importMode: 'set',
      stockPolicy: 'apply_all',
    };
    const result = await this.executeImportRows(companyId, userId, rows);
    if (result.errors.length > 0 && result.importedCount === 0) {
      throw new BadRequestException(result.errors[0].message);
    }

    await this.logAudit(this.prisma, {
      companyId,
      userId,
      action: 'product.import_confirmed',
      entityType: 'PRODUCT_IMPORT',
      entityId: `${Date.now()}`,
      newData: {
        importedCount: result.importedCount,
        failedCount: result.errors.length,
      },
    });

    if (result.importedCount > 0) {
      const warehouseId = String(rows.find((r) => r?.warehouseId)?.warehouseId || '').trim();
      this.notifyInventoryChanged(companyId, {
        reason: 'product.import',
        ...(warehouseId ? { warehouseId } : {}),
      });
    }

    await this.linkPartnerLedgerFromImport(
      companyId,
      userId,
      importOptions.partnerLedgerContactId,
      importOptions.ledgerSourceId,
      result.ledgerAccumulator,
    );

    return {
      count: result.importedCount,
      errors: result.errors,
    };
  }
}
