import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { UpdateFeatureDto } from './dto/update-feature.dto';
import { UpsertTelegramBindingDto } from './dto/upsert-telegram-binding.dto';
import { RemoveTelegramBindingDto } from './dto/remove-telegram-binding.dto';
import { TelegramLinkService } from '../telegram/telegram-link.service';
import { AppCacheService } from '../../common/cache/app-cache.service';
import { randomBytes } from 'crypto';

const FEATURES_CACHE_TTL_MS = Number(process.env.FEATURES_CACHE_TTL_MS || 300_000);

@Injectable()
export class CompaniesService {
  constructor(
    private prisma: PrismaService,
    private telegramLinkService: TelegramLinkService,
    private cache: AppCacheService,
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
    const key = AppCacheService.companyFeaturesKey(companyId);
    return this.cache.getOrSet(
      key,
      () => this.loadFeatureConfig(companyId),
      FEATURES_CACHE_TTL_MS,
    );
  }

  private async loadFeatureConfig(companyId: string) {
    const companyFeatures = await (this.prisma as any).companyFeature.findMany({
      where: {
        companyId,
        enabled: true,
      },
      include: {
        feature: {
          select: {
            key: true,
            module: {
              select: {
                key: true,
              },
            },
          },
        },
      },
    });

    const enabledFeatures = companyFeatures.map((cf: any) => cf.feature.key);
    const enabledModules = Array.from(
      new Set(companyFeatures.map((cf: any) => cf.feature.module?.key).filter(Boolean)),
    );

    return {
      hasFeatureConfig: companyFeatures.length > 0,
      enabledFeatures,
      enabledModules,
    };
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
      select: { posCreditEnabled: true, posMaxDiscountPercent: true },
    });
    const maxPct =
      company?.posMaxDiscountPercent != null
        ? Number(company.posMaxDiscountPercent)
        : 15;
    return {
      posCreditEnabled: !!company?.posCreditEnabled,
      posMaxDiscountPercent: maxPct,
    };
  }

  async updateFeatureConfig(companyId: string, dto: UpdateFeatureDto) {
    const moduleKey = dto.moduleKey.toUpperCase();
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
