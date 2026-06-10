import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DEFAULT_TX_OPTIONS,
  INTAKE_SCAN_TX_OPTIONS,
  intakeCompleteTxOptions,
} from '../../prisma/transaction-options';
import { StockService } from '../warehouses/stock.service';
import { VariantsService } from '../products/variants.service';
import { CompaniesService } from '../companies/companies.service';
import { WarehouseScopeService } from '../users/services/warehouse-scope.service';
import {
  AddIntakeLineDto,
  CreateWarehouseIntakeDto,
  QuickIntakeProductDto,
  ScanIntakeLineDto,
  UpdateIntakeLineDto,
} from './dto/warehouse-intake.dto';
import {
  assertIntakeLineTotalAllowed,
  assertIntakeQuantityAllowed,
  IntakeQuantityContext,
  normalizeIntakeSettings,
  parseIntakeStatus,
  resolveWarehouseIntakeSettings,
  WarehouseIntakeSettings,
} from '../../common/warehouse-intake-settings.util';
import { generateIntakeNakladnoyPdfBuffer } from '../pdf/intake-nakladnoy-pdf.util';

type PrismaTx = Prisma.TransactionClient;

const INTAKE_INCLUDE = {
  warehouse: { select: { id: true, name: true } },
  lines: {
    include: {
      productVariant: {
        select: {
          id: true,
          name: true,
          sku: true,
          barcode: true,
          product: { select: { id: true, name: true, unit: true, imageUrl: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.WarehouseIntakeInclude;

type IntakeDetail = Prisma.WarehouseIntakeGetPayload<{ include: typeof INTAKE_INCLUDE }>;

@Injectable()
export class WarehouseIntakeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockService: StockService,
    private readonly variantsService: VariantsService,
    private readonly companiesService: CompaniesService,
    private readonly warehouseScopeService: WarehouseScopeService,
  ) {}

  private async assertWarehouseIntakeFeature(companyId: string) {
    await this.companiesService.assertFeatureEnabled(companyId, 'WAREHOUSE_INTAKE');
  }

  private async assertWarehouseScope(
    companyId: string,
    userId: string,
    warehouseId: string,
  ) {
    const scope = await this.warehouseScopeService.getForUser(companyId, userId);
    if (!this.warehouseScopeService.isAllowed(scope, warehouseId)) {
      throw new ForbiddenException('Ushbu ombor ma’lumotlariga ruxsat yo‘q');
    }
  }

  private async scopeWarehouseWhere(
    companyId: string,
    userId: string,
  ): Promise<{ warehouseId?: { in: string[] } }> {
    const scope = await this.warehouseScopeService.getForUser(companyId, userId);
    if (scope.all) return {};
    if (!scope.warehouseIds.length) {
      return { warehouseId: { in: ['__no_warehouse_scope__'] } };
    }
    return { warehouseId: { in: scope.warehouseIds } };
  }

  private async validatePartnerLedgerContact(
    companyId: string,
    contactId?: string,
  ) {
    const id = contactId?.trim();
    if (!id) return;
    const contact = await this.prisma.partnerLedgerContact.findFirst({
      where: { id, companyId, isActive: true },
    });
    if (!contact) {
      throw new NotFoundException('Hamkor daftari kontakti topilmadi');
    }
  }

  private isDuplicateReferenceError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private async loadIntakeSettings(
    companyId: string,
    warehouseId: string,
  ): Promise<WarehouseIntakeSettings> {
    const { settings } = await this.companiesService.getIntakeSettings(
      companyId,
      warehouseId,
    );
    return settings;
  }

  /** Skaner/CRUD — feature tekshiruvi allaqachon o‘tgan; ortiqcha scope/assertsiz */
  private async loadIntakeSettingsFast(
    companyId: string,
    warehouseId: string,
  ): Promise<WarehouseIntakeSettings> {
    const [company, warehouse] = await Promise.all([
      this.prisma.company.findUnique({
        where: { id: companyId },
        select: { warehouseIntakeSettings: true },
      }),
      this.prisma.warehouse.findFirst({
        where: { id: warehouseId, companyId },
        select: { fieldConfig: true },
      }),
    ]);
    return resolveWarehouseIntakeSettings(
      company?.warehouseIntakeSettings,
      warehouse?.fieldConfig,
    );
  }

  private async getDraftIntakeMeta(id: string, companyId: string, tx?: PrismaTx) {
    const client = tx ?? this.prisma;
    const intake = await client.warehouseIntake.findFirst({
      where: { id, companyId, status: 'DRAFT' },
      select: { id: true, warehouseId: true },
    });
    if (!intake) {
      const exists = await client.warehouseIntake.findFirst({
        where: { id, companyId },
        select: { status: true },
      });
      if (!exists) throw new NotFoundException('Kirim hujjati topilmadi');
      throw new BadRequestException('Faqat DRAFT holatdagi hujjat tahrirlanadi');
    }
    return intake;
  }

  private async assertDraftInTx(tx: PrismaTx, id: string, companyId: string) {
    const intake = await tx.warehouseIntake.findFirst({
      where: { id, companyId, status: 'DRAFT' },
      select: { id: true },
    });
    if (!intake) {
      throw new BadRequestException('Faqat DRAFT holatdagi hujjat tahrirlanadi');
    }
  }

  private async fetchIntakeDetail(
    id: string,
    companyId: string,
    intakeSettings: WarehouseIntakeSettings,
    tx?: PrismaTx,
  ) {
    const client = tx ?? this.prisma;
    const intake = await client.warehouseIntake.findFirst({
      where: { id, companyId },
      include: INTAKE_INCLUDE,
    });
    if (!intake) throw new NotFoundException('Kirim hujjati topilmadi');
    return { ...intake, intakeSettings };
  }

  /** Skaner uchun tez qidiruv — faqat aniq barcode/SKU */
  private async resolveVariantExact(companyId: string, code: string) {
    const matches = await this.prisma.productVariant.findMany({
      where: {
        companyId,
        status: 'ACTIVE',
        OR: [{ barcode: code }, { sku: code }],
      },
      include: {
        product: { select: { id: true, name: true, unit: true, imageUrl: true } },
      },
      take: 2,
    });
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      throw new BadRequestException('Bir nechta variant topildi — qo‘lda tanlang');
    }
    return null;
  }

  private applyQtyRules(
    settings: WarehouseIntakeSettings,
    context: IntakeQuantityContext,
    quantity: number,
    options?: { scanIncrement?: number },
  ): number {
    try {
      return assertIntakeQuantityAllowed(settings, context, quantity, options);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }

  private applyLineTotalRules(
    settings: WarehouseIntakeSettings,
    existingQty: number,
    addQty: number,
  ) {
    try {
      assertIntakeLineTotalAllowed(settings, existingQty, addQty);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }

  private async generateReference(companyId: string, tx: PrismaTx): Promise<string> {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    const d = String(now.getUTCDate()).padStart(2, '0');
    const prefix = `KIR-${y}${m}${d}`;
    const count = await tx.warehouseIntake.count({
      where: { companyId, reference: { startsWith: prefix } },
    });
    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }

  private async getDraftIntake(id: string, companyId: string, tx?: PrismaTx) {
    const client = tx ?? this.prisma;
    const intake = await client.warehouseIntake.findFirst({
      where: { id, companyId },
      include: INTAKE_INCLUDE,
    });
    if (!intake) throw new NotFoundException('Kirim hujjati topilmadi');
    if (intake.status !== 'DRAFT') {
      throw new BadRequestException('Faqat DRAFT holatdagi hujjat tahrirlanadi');
    }
    return intake;
  }

  private async getDraftIntakeForUser(
    id: string,
    companyId: string,
    userId: string,
    tx?: PrismaTx,
  ) {
    const intake = await this.getDraftIntake(id, companyId, tx);
    await this.assertWarehouseScope(companyId, userId, intake.warehouseId);
    return intake;
  }

  async tryResolveVariantByBarcode(companyId: string, rawCode: string) {
    const code = String(rawCode || '').trim();
    if (!code) throw new BadRequestException('Barcode yoki SKU kiriting');

    const exact = await this.prisma.productVariant.findMany({
      where: {
        companyId,
        status: 'ACTIVE',
        OR: [{ barcode: code }, { sku: code }],
      },
      include: {
        product: { select: { id: true, name: true, unit: true, imageUrl: true } },
      },
      take: 5,
    });
    if (exact.length === 1) return exact[0];
    if (exact.length > 1) {
      throw new BadRequestException('Bir nechta variant topildi — qo‘lda tanlang');
    }

    const fuzzy = await this.variantsService.search(companyId, { barcode: code });
    if (fuzzy.length === 1) return fuzzy[0];
    if (fuzzy.length > 1) {
      throw new BadRequestException('Bir nechta variant topildi — qo‘lda tanlang');
    }

    const bySku = await this.variantsService.search(companyId, { sku: code });
    if (bySku.length === 1) return bySku[0];

    return null;
  }

  async lookupBarcode(
    companyId: string,
    userId: string,
    barcode: string,
    warehouseId?: string,
  ) {
    await this.assertWarehouseIntakeFeature(companyId);
    const code = String(barcode || '').trim();
    if (!code) throw new BadRequestException('Barcode kiriting');

    const scope = await this.warehouseScopeService.getForUser(companyId, userId);
    let resolvedWarehouseId = warehouseId?.trim();
    if (!resolvedWarehouseId && !scope.all && scope.warehouseIds.length === 1) {
      resolvedWarehouseId = scope.warehouseIds[0];
    }
    if (resolvedWarehouseId) {
      await this.assertWarehouseScope(companyId, userId, resolvedWarehouseId);
    } else if (!scope.all) {
      throw new BadRequestException('warehouseId majburiy');
    }

    let settings: WarehouseIntakeSettings | undefined;
    if (resolvedWarehouseId) {
      settings = await this.loadIntakeSettings(companyId, resolvedWarehouseId);
    } else {
      const company = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: { warehouseIntakeSettings: true },
      });
      settings = normalizeIntakeSettings(
        company?.warehouseIntakeSettings as Partial<WarehouseIntakeSettings> | null,
      );
    }

    const variant = await this.tryResolveVariantByBarcode(companyId, code);
    if (!variant) {
      return {
        found: false as const,
        barcode: code,
        allowQuickProduct: settings.allowQuickProduct,
        intakeSettings: settings,
      };
    }

    return {
      found: true as const,
      productVariantId: variant.id,
      name: variant.name,
      sku: variant.sku,
      barcode: variant.barcode,
      product: variant.product,
      intakeSettings: settings,
    };
  }

  async create(companyId: string, userId: string, dto: CreateWarehouseIntakeDto) {
    await this.assertWarehouseIntakeFeature(companyId);
    await this.assertWarehouseScope(companyId, userId, dto.warehouseId);
    await this.validatePartnerLedgerContact(companyId, dto.partnerLedgerContactId);

    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: dto.warehouseId, companyId, status: 'ACTIVE' },
    });
    if (!warehouse) throw new NotFoundException('Ombor topilmadi');

    const partnerLedgerContactId = dto.partnerLedgerContactId?.trim() || null;

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await this.prisma.runTransaction(async (tx) => {
          const reference = await this.generateReference(companyId, tx);
          return tx.warehouseIntake.create({
            data: {
              companyId,
              warehouseId: dto.warehouseId,
              reference,
              status: 'DRAFT',
              note: dto.note?.trim() || null,
              partnerLedgerContactId,
              createdBy: userId,
            },
            include: INTAKE_INCLUDE,
          });
        }, DEFAULT_TX_OPTIONS);
      } catch (error) {
        if (this.isDuplicateReferenceError(error) && attempt < 4) continue;
        throw error;
      }
    }

    throw new BadRequestException('Kirim raqami yaratib bo‘lmadi, qayta urinib ko‘ring');
  }

  async list(
    companyId: string,
    userId: string,
    query?: { status?: string; warehouseId?: string },
  ) {
    await this.assertWarehouseIntakeFeature(companyId);

    const status = parseIntakeStatus(query?.status);
    if (query?.status?.trim() && !status) {
      throw new BadRequestException('status: DRAFT, COMPLETED yoki CANCELLED');
    }

    if (query?.warehouseId?.trim()) {
      await this.assertWarehouseScope(companyId, userId, query.warehouseId.trim());
    }

    const scopeFilter = await this.scopeWarehouseWhere(companyId, userId);

    return this.prisma.warehouseIntake.findMany({
      where: {
        companyId,
        ...scopeFilter,
        ...(query?.warehouseId?.trim()
          ? { warehouseId: query.warehouseId.trim() }
          : {}),
        ...(status ? { status } : {}),
      },
      include: {
        warehouse: { select: { id: true, name: true } },
        _count: { select: { lines: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async findOne(id: string, companyId: string, userId: string) {
    await this.assertWarehouseIntakeFeature(companyId);

    const intake = await this.prisma.warehouseIntake.findFirst({
      where: { id, companyId },
      include: INTAKE_INCLUDE,
    });
    if (!intake) throw new NotFoundException('Kirim hujjati topilmadi');

    await this.assertWarehouseScope(companyId, userId, intake.warehouseId);

    const intakeSettings = await this.loadIntakeSettings(
      companyId,
      intake.warehouseId,
    );
    return { ...intake, intakeSettings };
  }

  private async upsertLine(
    tx: PrismaTx,
    intakeId: string,
    productVariantId: string,
    addQty: number,
    entryMode: 'MANUAL' | 'SCAN',
    settings: WarehouseIntakeSettings,
    scannedBarcode?: string,
    scanIncrement = 0,
  ) {
    const existing = await tx.warehouseIntakeLine.findUnique({
      where: {
        intakeId_productVariantId: { intakeId, productVariantId },
      },
    });

    this.applyLineTotalRules(
      settings,
      existing ? Number(existing.quantity) : 0,
      addQty,
    );

    if (existing) {
      return tx.warehouseIntakeLine.update({
        where: { id: existing.id },
        data: {
          quantity: { increment: addQty },
          ...(scanIncrement > 0 ? { scanCount: { increment: scanIncrement } } : {}),
          entryMode:
            existing.entryMode === 'SCAN' || entryMode === 'SCAN' ? 'SCAN' : 'MANUAL',
          scannedBarcode: scannedBarcode || existing.scannedBarcode,
        },
      });
    }

    return tx.warehouseIntakeLine.create({
      data: {
        intakeId,
        productVariantId,
        quantity: addQty,
        scanCount: scanIncrement > 0 ? scanIncrement : 0,
        entryMode,
        scannedBarcode: scannedBarcode || null,
      },
    });
  }

  private async resolveQuickProductCategory(
    tx: PrismaTx,
    companyId: string,
    categoryId?: string,
  ) {
    if (categoryId?.trim()) {
      const category = await tx.productCategory.findFirst({
        where: { id: categoryId.trim(), companyId, status: 'ACTIVE' },
      });
      if (!category) throw new NotFoundException('Kategoriya topilmadi');
      return category.id;
    }

    const existing = await tx.productCategory.findFirst({
      where: { companyId, status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) return existing.id;

    const created = await tx.productCategory.create({
      data: { companyId, name: 'Umumiy', status: 'ACTIVE' },
    });
    return created.id;
  }

  async addLine(
    intakeId: string,
    companyId: string,
    userId: string,
    dto: AddIntakeLineDto,
  ) {
    await this.assertWarehouseIntakeFeature(companyId);

    const meta = await this.getDraftIntakeMeta(intakeId, companyId);
    await this.assertWarehouseScope(companyId, userId, meta.warehouseId);
    const settings = await this.loadIntakeSettingsFast(companyId, meta.warehouseId);
    const quantity = this.applyQtyRules(settings, 'MANUAL', dto.quantity);

    const variant = await this.prisma.productVariant.findFirst({
      where: { id: dto.productVariantId, companyId, status: 'ACTIVE' },
    });
    if (!variant) throw new NotFoundException('Mahsulot varianti topilmadi');

    return this.prisma.runTransaction(async (tx) => {
      await this.assertDraftInTx(tx, intakeId, companyId);
      await this.upsertLine(
        tx,
        intakeId,
        dto.productVariantId,
        quantity,
        'MANUAL',
        settings,
      );
      return this.fetchIntakeDetail(intakeId, companyId, settings, tx);
    }, INTAKE_SCAN_TX_OPTIONS);
  }

  async scanLine(
    intakeId: string,
    companyId: string,
    userId: string,
    dto: ScanIntakeLineDto,
  ) {
    await this.assertWarehouseIntakeFeature(companyId);

    const meta = await this.getDraftIntakeMeta(intakeId, companyId);
    await this.assertWarehouseScope(companyId, userId, meta.warehouseId);

    const barcode = String(dto.barcode).trim();
    const [settings, variant] = await Promise.all([
      this.loadIntakeSettingsFast(companyId, meta.warehouseId),
      this.resolveVariantExact(companyId, barcode),
    ]);

    const rawQty = Number(dto.quantity ?? 1);
    const quantity = this.applyQtyRules(settings, 'SCAN', rawQty, { scanIncrement: 1 });

    if (!variant) {
      if (settings.allowQuickProduct) {
        throw new NotFoundException(
          `Mahsulot topilmadi: ${barcode}. Tez qo'shish uchun quick-product endpointidan foydalaning.`,
        );
      }
      throw new NotFoundException(`Mahsulot topilmadi: ${barcode}`);
    }

    return this.prisma.runTransaction(async (tx) => {
      await this.assertDraftInTx(tx, intakeId, companyId);
      await this.upsertLine(
        tx,
        intakeId,
        variant.id,
        quantity,
        'SCAN',
        settings,
        barcode,
        1,
      );
      return this.fetchIntakeDetail(intakeId, companyId, settings, tx);
    }, INTAKE_SCAN_TX_OPTIONS);
  }

  async quickProduct(
    intakeId: string,
    companyId: string,
    userId: string,
    dto: QuickIntakeProductDto,
  ) {
    await this.assertWarehouseIntakeFeature(companyId);

    const intake = await this.getDraftIntakeForUser(intakeId, companyId, userId);
    const settings = await this.loadIntakeSettings(companyId, intake.warehouseId);
    if (!settings.allowQuickProduct) {
      throw new BadRequestException(
        "Tez mahsulot qo'shish ushbu kompaniyada o'chirilgan",
      );
    }

    const barcode = String(dto.barcode).trim();
    const name = String(dto.name).trim();
    if (!barcode || !name) {
      throw new BadRequestException('Barcode va nom majburiy');
    }
    if (name.length < 2) {
      throw new BadRequestException('Mahsulot nomi kamida 2 belgi bo‘lishi kerak');
    }

    const existing = await this.tryResolveVariantByBarcode(companyId, barcode);
    if (existing) {
      throw new BadRequestException('Bunday barcode allaqachon katalogda mavjud');
    }

    const rawQty = Number(dto.quantity ?? 1);
    const quantity = this.applyQtyRules(settings, 'SCAN', rawQty, { scanIncrement: 1 });
    const unit = String(dto.unit || 'dona').trim() || 'dona';
    const salePrice = Number(dto.salePrice ?? 0);
    const purchasePrice =
      dto.purchasePrice != null ? Number(dto.purchasePrice) : null;

    await this.prisma.runTransaction(async (tx) => {
      await this.getDraftIntakeForUser(intakeId, companyId, userId, tx);

      const duplicateBarcode = await tx.productVariant.findFirst({
        where: { companyId, barcode },
      });
      if (duplicateBarcode) {
        throw new BadRequestException('Bunday barcode allaqachon mavjud');
      }

      const categoryId = await this.resolveQuickProductCategory(
        tx,
        companyId,
        dto.categoryId,
      );

      const product = await tx.product.create({
        data: {
          companyId,
          name,
          categoryId,
          unit,
          type: 'GOODS',
          status: 'ACTIVE',
          createdBy: userId,
        },
      });

      const variant = await tx.productVariant.create({
        data: {
          companyId,
          productId: product.id,
          name,
          barcode,
          salePrice,
          purchasePrice,
          currency: 'UZS',
          status: 'ACTIVE',
          createdBy: userId,
        },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: 'warehouse_intake.quick_product',
          entityType: 'PRODUCT_VARIANT',
          entityId: variant.id,
          newData: {
            intakeId,
            barcode,
            name,
            productId: product.id,
          } as object,
        },
      });

      await this.upsertLine(
        tx,
        intakeId,
        variant.id,
        quantity,
        'SCAN',
        settings,
        barcode,
        1,
      );
    }, INTAKE_SCAN_TX_OPTIONS);

    return this.findOne(intakeId, companyId, userId);
  }

  async updateLine(
    intakeId: string,
    lineId: string,
    companyId: string,
    userId: string,
    dto: UpdateIntakeLineDto,
  ) {
    await this.assertWarehouseIntakeFeature(companyId);

    const meta = await this.getDraftIntakeMeta(intakeId, companyId);
    await this.assertWarehouseScope(companyId, userId, meta.warehouseId);
    const settings = await this.loadIntakeSettingsFast(companyId, meta.warehouseId);
    const quantity = this.applyQtyRules(settings, 'UPDATE', dto.quantity);

    const line = await this.prisma.warehouseIntakeLine.findFirst({
      where: { id: lineId, intakeId, intake: { companyId } },
    });
    if (!line) throw new NotFoundException('Qator topilmadi');

    await this.prisma.warehouseIntakeLine.update({
      where: { id: lineId },
      data: { quantity },
    });

    return this.fetchIntakeDetail(intakeId, companyId, settings);
  }

  async removeLine(
    intakeId: string,
    lineId: string,
    companyId: string,
    userId: string,
  ) {
    await this.assertWarehouseIntakeFeature(companyId);

    const meta = await this.getDraftIntakeMeta(intakeId, companyId);
    await this.assertWarehouseScope(companyId, userId, meta.warehouseId);
    const settings = await this.loadIntakeSettingsFast(companyId, meta.warehouseId);

    const line = await this.prisma.warehouseIntakeLine.findFirst({
      where: { id: lineId, intakeId, intake: { companyId } },
    });
    if (!line) throw new NotFoundException('Qator topilmadi');

    await this.prisma.warehouseIntakeLine.delete({ where: { id: lineId } });
    return this.fetchIntakeDetail(intakeId, companyId, settings);
  }

  async complete(intakeId: string, companyId: string, userId: string) {
    await this.assertWarehouseIntakeFeature(companyId);

    const draftPreview = await this.getDraftIntakeForUser(intakeId, companyId, userId);
    const lineCount = draftPreview.lines.length;

    const completed = await this.prisma.runTransaction<IntakeDetail>(async (tx) => {
      const intake = await this.getDraftIntake(intakeId, companyId, tx);
      if (!intake.lines.length) {
        throw new BadRequestException('Kamida bitta mahsulot qatori kerak');
      }

      const movementNote = intake.note?.trim()
        ? `${intake.reference} — ${intake.note.trim()}`
        : intake.reference;

      const movements = intake.lines.map((line) => ({
        warehouseId: intake.warehouseId,
        productVariantId: line.productVariantId,
        quantity: Number(line.quantity),
        note: movementNote,
        sourceId: intake.id,
        partnerLedgerContactId: intake.partnerLedgerContactId || undefined,
      }));

      await this.stockService.recordMovements(
        companyId,
        movements,
        'IN',
        'WAREHOUSE_INTAKE',
        userId,
        tx,
      );

      const updated = await tx.warehouseIntake.update({
        where: { id: intakeId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          completedBy: userId,
        },
        include: INTAKE_INCLUDE,
      });

      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: 'warehouse_intake.completed',
          entityType: 'WAREHOUSE_INTAKE',
          entityId: intakeId,
          newData: {
            reference: intake.reference,
            warehouseId: intake.warehouseId,
            lineCount: intake.lines.length,
          } as any,
        },
      });

      return updated;
    }, intakeCompleteTxOptions(lineCount));

    for (const line of completed.lines) {
      this.stockService.emitInventoryChanged(
        companyId,
        completed.warehouseId,
        line.productVariantId,
        'WAREHOUSE_INTAKE',
      );
    }

    const intakeSettings = await this.loadIntakeSettings(
      companyId,
      completed.warehouseId,
    );
    return { ...completed, intakeSettings };
  }

  async cancel(intakeId: string, companyId: string, userId: string) {
    await this.assertWarehouseIntakeFeature(companyId);

    await this.getDraftIntakeForUser(intakeId, companyId, userId);

    const updated = await this.prisma.runTransaction<IntakeDetail>(async (tx) => {
      const intake = await this.getDraftIntake(intakeId, companyId, tx);

      const cancelled = await tx.warehouseIntake.update({
        where: { id: intakeId },
        data: { status: 'CANCELLED' },
        include: INTAKE_INCLUDE,
      });

      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: 'warehouse_intake.cancelled',
          entityType: 'WAREHOUSE_INTAKE',
          entityId: intakeId,
          newData: {
            reference: intake.reference,
            warehouseId: intake.warehouseId,
            lineCount: intake.lines.length,
          } as object,
        },
      });

      return cancelled;
    }, DEFAULT_TX_OPTIONS);

    const intakeSettings = await this.loadIntakeSettings(
      companyId,
      updated.warehouseId,
    );
    return { ...updated, intakeSettings };
  }

  private async resolveIntakeCompleterName(
    companyId: string,
    intakeId: string,
    completedBy?: string | null,
    createdBy?: string | null,
  ): Promise<string> {
    let userId = completedBy?.trim() || null;
    if (!userId) {
      const audit = await this.prisma.auditLog.findFirst({
        where: {
          companyId,
          entityType: 'WAREHOUSE_INTAKE',
          entityId: intakeId,
          action: 'warehouse_intake.completed',
        },
        orderBy: { createdAt: 'desc' },
        select: { userId: true },
      });
      userId = audit?.userId || createdBy?.trim() || null;
    }
    if (!userId) return "Noma'lum";

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true },
    });
    return user?.fullName?.trim() || "Noma'lum";
  }

  async getNakladnoyPdfBuffer(id: string, companyId: string, userId: string) {
    await this.assertWarehouseIntakeFeature(companyId);

    const intake = await this.prisma.warehouseIntake.findFirst({
      where: { id, companyId },
      include: INTAKE_INCLUDE,
    });
    if (!intake) throw new NotFoundException('Kirim hujjati topilmadi');

    await this.assertWarehouseScope(companyId, userId, intake.warehouseId);

    if (intake.status !== 'COMPLETED') {
      throw new BadRequestException(
        'Nakladnoy faqat yakunlangan (COMPLETED) hujjat uchun chop etiladi',
      );
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, legalName: true, tin: true },
    });

    const workerName = await this.resolveIntakeCompleterName(
      companyId,
      intake.id,
      intake.completedBy,
      intake.createdBy,
    );

    const lines = intake.lines.map((line) => ({
      productName: line.productVariant.product?.name || line.productVariant.name,
      variantName: line.productVariant.name,
      barcode: line.productVariant.barcode,
      sku: line.productVariant.sku,
      unit: line.productVariant.product?.unit || 'dona',
      quantity: Number(line.quantity),
    }));

    const totalUnits = lines.reduce((sum, l) => sum + l.quantity, 0);

    return generateIntakeNakladnoyPdfBuffer({
      reference: intake.reference,
      date: intake.completedAt || intake.updatedAt,
      companyName: company?.legalName || company?.name || 'Kompaniya',
      companyTin: company?.tin,
      warehouseName: intake.warehouse?.name || 'Ombor',
      warehouseWorkerName: workerName,
      note: intake.note,
      lines,
      totalPositions: lines.length,
      totalUnits,
    });
  }
}
