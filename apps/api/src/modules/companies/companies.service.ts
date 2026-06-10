import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateFeatureDto } from './dto/update-feature.dto';
import { UpsertTelegramBindingDto } from './dto/upsert-telegram-binding.dto';
import { RemoveTelegramBindingDto } from './dto/remove-telegram-binding.dto';
import { TelegramLinkService } from '../telegram/telegram-link.service';
import { AppCacheService } from '../../common/cache/app-cache.service';
import { randomBytes } from 'crypto';
import {
  WAREHOUSE_BUNDLE_ALL_ID,
  WAREHOUSE_FEATURE_BUNDLES,
  WAREHOUSE_SECTION_FEATURE_KEYS,
} from '../../common/warehouse-section-features';
import { syncSystemModuleCatalog } from '../../common/module-catalog';
import { UpdateIntakeSettingsDto } from './dto/update-intake-settings.dto';
import { UpdatePosReceiptSettingsDto } from './dto/update-pos-receipt-settings.dto';
import {
  mergePosReceiptSettingsPatch,
  normalizePosReceiptSettings,
} from '../../common/pos-receipt-settings.util';
import {
  mergeIntakeSettingsPatch,
  normalizeIntakeSettings,
  resolveWarehouseIntakeSettings,
} from '../../common/warehouse-intake-settings.util';
import { WarehouseScopeService } from '../users/services/warehouse-scope.service';

const FEATURES_CACHE_TTL_MS = Number(process.env.FEATURES_CACHE_TTL_MS || 300_000);

@Injectable()
export class CompaniesService {
  private moduleCatalogSynced = false;
  private moduleCatalogSyncing: Promise<void> | null = null;

  constructor(
    private prisma: PrismaService,
    private telegramLinkService: TelegramLinkService,
    private cache: AppCacheService,
    private warehouseScopeService: WarehouseScopeService,
  ) {}

  private invalidateFeatureCache(companyId: string) {
    void this.cache.del(AppCacheService.companyFeaturesKey(companyId));
  }

  async update(id: string, dto: UpdateCompanyDto) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) {
      throw new NotFoundException('Kompaniya topilmadi');
    }

    // STIR unikalligini tekshirish
    if (dto.tin && dto.tin !== company.tin) {
      const existing = await this.prisma.company.findUnique({
        where: { tin: dto.tin }
      });
      if (existing) {
        throw new BadRequestException('Ushbu STIR (TIN) allaqachon boshqa kompaniya tomonidan foydalanilgan');
      }
    }

    const preparedDto: UpdateCompanyDto = {
      ...dto,
      storefrontUrl: dto.storefrontUrl ? dto.storefrontUrl.trim().replace(/\/+$/, '') : dto.storefrontUrl,
    };

    const updated = await this.prisma.company.update({
      where: { id },
      data: preparedDto,
    });
    this.invalidateFeatureCache(id);
    return updated;
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) {
      throw new NotFoundException('Kompaniya topilmadi');
    }
    return company;
  }

  async resolveCompanyIdForUser(
    userId: string,
    companyId?: string,
  ): Promise<string> {
    const trimmed = String(companyId || '').trim();
    if (trimmed) return trimmed;

    const membership = await this.prisma.companyUser.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { companyId: true },
    });
    if (!membership?.companyId) {
      throw new NotFoundException('Kompaniya topilmadi');
    }
    return membership.companyId;
  }

  async getFeatureConfig(companyId: string) {
    await this.ensureModuleCatalog();
    const key = AppCacheService.companyFeaturesKey(companyId);
    return this.cache.getOrSet(
      key,
      async () => {
        await this.ensureCompanyWarehouseSectionDefaults(companyId);
        await this.ensureCompanyGoodsReceiptsDefaults(companyId);
        return this.loadFeatureConfig(companyId);
      },
      FEATURES_CACHE_TTL_MS,
    );
  }

  /** Barcha tizim modullari va feature lar DB da bo‘lishi kerak (Sozlamalar → Modullar) */
  async ensureModuleCatalog() {
    if (this.moduleCatalogSynced) return;
    if (!this.moduleCatalogSyncing) {
      this.moduleCatalogSyncing = syncSystemModuleCatalog(this.prisma as any)
        .then(() => {
          this.moduleCatalogSynced = true;
        })
        .finally(() => {
          this.moduleCatalogSyncing = null;
        });
    }
    await this.moduleCatalogSyncing;
  }

  /** Eski kompaniyalar: ombor yoqilgan bo‘lsa, yangi bo‘limlar default yoqilgan */
  private async ensureCompanyWarehouseSectionDefaults(companyId: string) {
    const configCount = await (this.prisma as any).companyFeature.count({
      where: { companyId },
    });
    if (configCount === 0) return;

    const hasWarehouseOn = await (this.prisma as any).companyFeature.findFirst({
      where: {
        companyId,
        enabled: true,
        feature: { module: { key: 'WAREHOUSE' } },
      },
    });
    if (!hasWarehouseOn) return;

    const features = await (this.prisma as any).feature.findMany({
      where: { key: { in: [...WAREHOUSE_SECTION_FEATURE_KEYS] } },
      select: { id: true, key: true },
    });

    for (const feature of features) {
      const existing = await (this.prisma as any).companyFeature.findUnique({
        where: {
          companyId_featureId: { companyId, featureId: feature.id },
        },
      });
      if (!existing) {
        await (this.prisma as any).companyFeature.create({
          data: { companyId, featureId: feature.id, enabled: true },
        });
      }
    }
  }

  /** Eski kompaniyalar: B2B yoki PARTIAL_RECEIPT yoqilgan bo‘lsa, Kelgan yuklar modulini ham yoqish */
  private async ensureCompanyGoodsReceiptsDefaults(companyId: string) {
    const configCount = await (this.prisma as any).companyFeature.count({
      where: { companyId },
    });
    if (configCount === 0) return;

    const goodsFeatures = await (this.prisma as any).feature.findMany({
      where: { key: { in: ['GOODS_RECEIPTS_MAIN', 'PARTIAL_RECEIPT'] } },
      select: { id: true, key: true },
    });
    if (!goodsFeatures.length) return;

    const hasAnyGoodsReceiptConfig = await (this.prisma as any).companyFeature.findFirst({
      where: {
        companyId,
        featureId: { in: goodsFeatures.map((f: { id: string }) => f.id) },
      },
    });
    if (hasAnyGoodsReceiptConfig) return;

    const hasLegacyAccess = await (this.prisma as any).companyFeature.findFirst({
      where: {
        companyId,
        enabled: true,
        OR: [
          { feature: { key: { in: ['B2B_ORDERS', 'PARTIAL_RECEIPT', 'B2B_MAIN'] } } },
          { feature: { module: { key: 'B2B' } } },
          { feature: { key: 'WAREHOUSE_BASIC' } },
        ],
      },
    });
    if (!hasLegacyAccess) return;

    for (const feature of goodsFeatures) {
      await (this.prisma as any).companyFeature.create({
        data: { companyId, featureId: feature.id, enabled: true },
      });
    }
  }

  private async loadFeatureConfig(companyId: string) {
    const [companyFeatures, configCount] = await Promise.all([
      (this.prisma as any).companyFeature.findMany({
        where: { companyId, enabled: true },
        include: {
          feature: {
            select: {
              key: true,
              module: { select: { key: true } },
            },
          },
        },
      }),
      (this.prisma as any).companyFeature.count({ where: { companyId } }),
    ]);

    const enabledFeatures = companyFeatures.map((cf: any) => cf.feature.key);
    const enabledModules = Array.from(
      new Set(companyFeatures.map((cf: any) => cf.feature.module?.key).filter(Boolean)),
    );

    return {
      hasFeatureConfig: configCount > 0,
      enabledFeatures,
      enabledModules,
    };
  }

  async isFeatureEnabled(companyId: string, featureKey: string): Promise<boolean> {
    const config = await this.getFeatureConfig(companyId);
    if (!config.hasFeatureConfig) return true;
    const upper = featureKey.toUpperCase();
    return (config.enabledFeatures || []).some(
      (f: string) => String(f).toUpperCase() === upper,
    );
  }

  async assertFeatureEnabled(companyId: string, featureKey: string) {
    const enabled = await this.isFeatureEnabled(companyId, featureKey);
    if (!enabled) {
      throw new BadRequestException(
        `${featureKey} bo‘limi o‘chirilgan. Sozlamalar → Modullar → Ombor bo‘limlaridan yoqing.`,
      );
    }
  }

  async isModuleEnabled(companyId: string, moduleKey: string): Promise<boolean> {
    const config = await this.getFeatureConfig(companyId);
    if (!config.hasFeatureConfig) return true;
    const upper = moduleKey.toUpperCase();
    return (config.enabledModules || []).some(
      (m: string) => String(m).toUpperCase() === upper,
    );
  }

  async assertModuleEnabled(companyId: string, moduleKey: string) {
    const enabled = await this.isModuleEnabled(companyId, moduleKey);
    if (!enabled) {
      throw new BadRequestException(
        `${moduleKey} moduli kompaniyada o‘chirilgan. Sozlamalar → Modullar bo‘limidan yoqing.`,
      );
    }
  }

  async getPosSettings(companyId: string) {
    await this.assertModuleEnabled(companyId, 'POS');
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        posCreditEnabled: true,
        posMaxDiscountPercent: true,
        posReceiptSettings: true,
      },
    });
    const maxPct =
      company?.posMaxDiscountPercent != null
        ? Number(company.posMaxDiscountPercent)
        : 15;
    return {
      posCreditEnabled: !!company?.posCreditEnabled,
      posMaxDiscountPercent: maxPct,
      receiptSettings: normalizePosReceiptSettings(
        company?.posReceiptSettings as Record<string, unknown> | null,
      ),
    };
  }

  async getPosReceiptSettings(companyId: string) {
    await this.assertModuleEnabled(companyId, 'POS');
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { posReceiptSettings: true },
    });
    if (!company) throw new NotFoundException('Kompaniya topilmadi');
    return {
      settings: normalizePosReceiptSettings(
        company.posReceiptSettings as Record<string, unknown> | null,
      ),
    };
  }

  async updatePosReceiptSettings(
    companyId: string,
    dto: UpdatePosReceiptSettingsDto,
  ) {
    await this.assertModuleEnabled(companyId, 'POS');
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { posReceiptSettings: true },
    });
    if (!company) throw new NotFoundException('Kompaniya topilmadi');

    const current = normalizePosReceiptSettings(
      company.posReceiptSettings as Record<string, unknown> | null,
    );
    const settings = mergePosReceiptSettingsPatch(current, dto);

    await this.prisma.company.update({
      where: { id: companyId },
      data: { posReceiptSettings: settings as object },
    });

    return { settings };
  }

  async getIntakeSettings(
    companyId: string,
    warehouseId?: string,
    userId?: string,
  ) {
    await this.assertFeatureEnabled(companyId, 'WAREHOUSE_INTAKE');
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { warehouseIntakeSettings: true },
    });
    if (!company) throw new NotFoundException('Kompaniya topilmadi');

    let warehouseFieldConfig: unknown = null;
    const wid = warehouseId?.trim();
    if (wid) {
      if (userId) {
        const scope = await this.warehouseScopeService.getForUser(companyId, userId);
        if (!this.warehouseScopeService.isAllowed(scope, wid)) {
          throw new ForbiddenException('Ushbu ombor sozlamalariga ruxsat yo‘q');
        }
      }
      const warehouse = await this.prisma.warehouse.findFirst({
        where: { id: wid, companyId },
        select: { fieldConfig: true },
      });
      if (!warehouse) throw new NotFoundException('Ombor topilmadi');
      warehouseFieldConfig = warehouse.fieldConfig;
    }

    const settings = resolveWarehouseIntakeSettings(
      company.warehouseIntakeSettings,
      warehouseFieldConfig,
    );
    return {
      settings,
      warehouseId: warehouseId?.trim() || null,
    };
  }

  async updateIntakeSettings(companyId: string, dto: UpdateIntakeSettingsDto) {
    await this.assertFeatureEnabled(companyId, 'WAREHOUSE_INTAKE');
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { warehouseIntakeSettings: true },
    });
    if (!company) throw new NotFoundException('Kompaniya topilmadi');

    const current = normalizeIntakeSettings(
      company.warehouseIntakeSettings as Record<string, unknown> | null,
    );
    const settings = mergeIntakeSettingsPatch(current, dto);

    await this.prisma.company.update({
      where: { id: companyId },
      data: { warehouseIntakeSettings: settings as object },
    });

    return { settings };
  }

  private async upsertCompanyFeatures(
    companyId: string,
    updates: { key: string; enabled: boolean }[],
  ) {
    const deduped = new Map<string, boolean>();
    for (const u of updates) {
      deduped.set(u.key.toUpperCase(), u.enabled);
    }

    await this.ensureModuleCatalog();

    for (const [key, enabled] of deduped.entries()) {
      const feature = await (this.prisma as any).feature.findUnique({
        where: { key },
      });
      if (!feature) continue;
      await (this.prisma as any).companyFeature.upsert({
        where: {
          companyId_featureId: { companyId, featureId: feature.id },
        },
        update: { enabled },
        create: { companyId, featureId: feature.id, enabled },
      });
    }

    this.invalidateFeatureCache(companyId);
    return this.getFeatureConfig(companyId);
  }

  async updateWarehouseBundle(
    companyId: string,
    bundleId: string,
    enabled: boolean,
  ) {
    if (bundleId === WAREHOUSE_BUNDLE_ALL_ID) {
      return this.upsertCompanyFeatures(
        companyId,
        WAREHOUSE_SECTION_FEATURE_KEYS.map((key) => ({ key, enabled })),
      );
    }

    const bundle = WAREHOUSE_FEATURE_BUNDLES.find((b) => b.id === bundleId);
    if (!bundle) {
      throw new NotFoundException('Ombor guruhi topilmadi');
    }

    const updates: { key: string; enabled: boolean }[] = [];

    if (enabled) {
      for (const reqId of bundle.requiresBundleIds || []) {
        const req = WAREHOUSE_FEATURE_BUNDLES.find((b) => b.id === reqId);
        if (!req) continue;
        for (const key of req.featureKeys) {
          updates.push({ key, enabled: true });
        }
      }
      for (const key of bundle.featureKeys) {
        updates.push({ key, enabled: true });
      }
    } else {
      for (const key of bundle.featureKeys) {
        updates.push({ key, enabled: false });
      }
      for (const other of WAREHOUSE_FEATURE_BUNDLES) {
        if (other.requiresBundleIds?.includes(bundleId)) {
          for (const key of other.featureKeys) {
            updates.push({ key, enabled: false });
          }
        }
      }
    }

    return this.upsertCompanyFeatures(companyId, updates);
  }

  async updateFeatureConfig(companyId: string, dto: UpdateFeatureDto) {
    const bundleIdRaw = String(dto.bundleId || '').trim();
    const featureKeyRaw = String(dto.featureKey || '').trim();
    const moduleKeyRaw = String(dto.moduleKey || '').trim();

    if (bundleIdRaw) {
      return this.updateWarehouseBundle(companyId, bundleIdRaw, dto.enabled);
    }

    if (featureKeyRaw) {
      await this.ensureModuleCatalog();
      const featureKey = featureKeyRaw.toUpperCase();
      const feature = await (this.prisma as any).feature.findUnique({
        where: { key: featureKey },
      });
      if (!feature) {
        throw new NotFoundException('Bo‘lim (feature) topilmadi');
      }
      return this.upsertCompanyFeatures(companyId, [
        { key: featureKey, enabled: dto.enabled },
      ]);
    }

    if (!moduleKeyRaw) {
      throw new BadRequestException('moduleKey yoki featureKey kerak');
    }

    const moduleKey = moduleKeyRaw.toUpperCase();

    await this.ensureModuleCatalog();

    const moduleRecord = await (this.prisma as any).module.findUnique({
      where: { key: moduleKey },
      include: { features: true },
    });

    if (!moduleRecord) {
      throw new NotFoundException('Modul topilmadi');
    }
    if (!moduleRecord.features?.length) {
      throw new BadRequestException('Ushbu modulga feature biriktirilmagan');
    }

    await this.prisma.$transaction(
      moduleRecord.features.map((feature: any) =>
        (this.prisma as any).companyFeature.upsert({
          where: {
            companyId_featureId: {
              companyId,
              featureId: feature.id,
            },
          },
          update: { enabled: dto.enabled },
          create: {
            companyId,
            featureId: feature.id,
            enabled: dto.enabled,
          },
        }),
      ),
    );

    this.invalidateFeatureCache(companyId);
    return this.getFeatureConfig(companyId);
  }

  async regenerateStorefrontToken(companyId: string) {
    const token = randomBytes(24).toString('hex');
    return this.prisma.company.update({
      where: { id: companyId },
      data: { storefrontToken: token },
      select: {
        id: true,
        storefrontToken: true,
      },
    });
  }

  async initTelegramLink(companyId: string, userId: string) {
    const botUrl = this.telegramLinkService.getBotStartUrl();
    if (!botUrl) {
      throw new BadRequestException('TELEGRAM_BOT_USERNAME setilmagan');
    }

    const [user, company] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          phone: true,
          fullName: true,
          telegramChatId: true,
          telegramLinkedAt: true,
        },
      }),
      this.prisma.company.findUnique({
        where: { id: companyId },
        select: {
          phone: true,
          telegramChatId: true,
          telegramEnabled: true,
          telegramLinkedAt: true,
        },
      }),
    ]);

    const registeredPhone = user?.phone || company?.phone || null;
    if (!registeredPhone) {
      throw new BadRequestException(
        'Telegram ulanishi uchun avval profil yoki kompaniya sozlamalarida telefon raqamini kiriting.',
      );
    }

    return {
      mode: 'phone' as const,
      botUrl,
      startUrl: botUrl,
      botUsername: this.telegramLinkService.getBotUsername(),
      registeredPhone,
      userTelegramLinked: !!user?.telegramChatId,
      companyTelegramLinked: !!company?.telegramChatId,
      instructions:
        'Botni oching va «Telefon raqamni ulashish» tugmasini bosing. Raqamni qo‘lda yozmang — Telegram o‘zi yuboradi.',
    };
  }

  async getTelegramBindings(companyId: string) {
    return (this.prisma as any).telegramChatBinding.findMany({
      where: { companyId },
      orderBy: [{ moduleKey: 'asc' }, { role: 'asc' }],
    });
  }

  async upsertTelegramBinding(companyId: string, dto: UpsertTelegramBindingDto) {
    const moduleKey = dto.moduleKey.toUpperCase();
    const role = dto.role.toUpperCase();
    const normalizedChatId = dto.chatId.trim();

    return (this.prisma as any).telegramChatBinding.upsert({
      where: {
        companyId_role_moduleKey: {
          companyId,
          role,
          moduleKey,
        },
      },
      update: {
        chatId: normalizedChatId,
        enabled: dto.enabled ?? true,
      },
      create: {
        companyId,
        role,
        moduleKey,
        chatId: normalizedChatId,
        enabled: dto.enabled ?? true,
      },
    });
  }

  async removeTelegramBinding(companyId: string, dto: RemoveTelegramBindingDto) {
    const moduleKey = dto.moduleKey.toUpperCase();
    const role = dto.role.toUpperCase();

    await (this.prisma as any).telegramChatBinding.deleteMany({
      where: { companyId, role, moduleKey },
    });
    return { success: true };
  }
}
