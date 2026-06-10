import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateOnboardingCompanyDto,
  SubmitBusinessAnswersDto,
  AddTeamMemberDto,
} from './dto/onboarding.dto';
import { computeTrialEndsAt } from '../../common/trial.util';

const DEFAULT_FEATURE_KEYS = [
  'WAREHOUSE_BASIC',
  'STOCK_ADJUSTMENT',
  'B2B_ORDERS',
  'GOODS_RECEIPTS_MAIN',
  'DEBT_TRACKING',
];

@Injectable()
export class OnboardingService {
  constructor(private prisma: PrismaService) {}

  /** JWT da companyId bo‘lmasa — foydalanuvchining birinchi kompaniyasi */
  async resolveCompanyIdForUser(
    companyId: string | undefined,
    userId: string,
  ): Promise<string> {
    const trimmed = String(companyId || '').trim();
    if (trimmed) return trimmed;

    const membership = await this.prisma.companyUser.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { companyId: true },
    });
    if (!membership?.companyId) {
      throw new BadRequestException(
        'Kompaniya topilmadi. Chiqib qayta kiring (login).',
      );
    }
    return membership.companyId;
  }

  async createCompany(userId: string, dto: CreateOnboardingCompanyDto) {
    const trialEndsAt = computeTrialEndsAt();

    const { name, tin, phone, address, businessType } = dto;

    const companyUser = await this.prisma.companyUser.findFirst({
      where: { userId },
      include: { company: true },
    });

    if (companyUser) {
      if (tin && tin !== companyUser.company.tin) {
        const existing = await this.prisma.company.findUnique({ where: { tin } });
        if (existing) {
          throw new ConflictException(
            "Ushbu STIR (TIN) allaqachon boshqa kompaniya tomonidan ro'yxatdan o'tkazilgan",
          );
        }
      }

      const companyId = companyUser.companyId;
      const activeWarehouseCount = await this.prisma.warehouse.count({
        where: { companyId, status: { not: 'ARCHIVED' } },
      });
      if (activeWarehouseCount === 0) {
        await this.prisma.warehouse.create({
          data: {
            companyId,
            name: 'Asosiy Ombor',
            address: address || 'Toshkent',
            status: 'ACTIVE',
          },
        });
      }

      return this.prisma.company.update({
        where: { id: companyId },
        data: {
          name,
          tin,
          phone,
          address,
          ...(businessType ? { businessType } : {}),
        },
        include: { warehouses: true },
      });
    }

    const company = await this.prisma.company.create({
      data: {
        name,
        tin,
        phone,
        address,
        businessType: businessType || null,
        status: 'onboarding',
        trialEndsAt,
        subscriptionStatus: 'TRIAL',
        users: {
          create: {
            userId,
            role: 'OWNER',
          },
        },
        warehouses: {
          create: {
            name: 'Asosiy Ombor',
            address: address || 'Toshkent',
            status: 'ACTIVE',
          },
        },
      },
      include: {
        warehouses: true,
      },
    });

    return company;
  }

  async updateCompanyProfile(
    companyId: string | undefined,
    userId: string,
    data: { businessType?: string },
  ) {
    const resolvedCompanyId = await this.resolveCompanyIdForUser(
      companyId,
      userId,
    );
    const membership = await this.prisma.companyUser.findFirst({
      where: { companyId: resolvedCompanyId, userId },
    });
    if (!membership) {
      throw new NotFoundException('Kompaniya topilmadi');
    }

    return this.prisma.company.update({
      where: { id: resolvedCompanyId },
      data: {
        ...(data.businessType
          ? { businessType: String(data.businessType).trim() }
          : {}),
      },
    });
  }

  private computeStatusFields(
    company: {
      tin: string | null;
      businessType: string | null;
      status: string;
    },
    featureCount: number,
    role: string,
  ) {
    const tinDigits = String(company.tin || '').replace(/\D/g, '');
    const hasTin = tinDigits.length === 9;
    const hasBusinessType = !!String(company.businessType || '').trim();
    const hasModules = featureCount > 0;
    const companyStatus = String(company.status || '').toLowerCase();

    const isCompleted =
      companyStatus === 'active' && hasTin && hasBusinessType;

    let nextPath = '/onboarding/company';
    if (!hasTin) {
      nextPath = '/onboarding/company';
    } else if (!hasBusinessType) {
      nextPath = '/onboarding/business-type';
    } else if (!hasModules) {
      nextPath = '/onboarding/questions';
    } else if (!isCompleted) {
      nextPath = '/onboarding/modules';
    } else {
      nextPath = '/dashboard';
    }

    const requiresOnboarding = role === 'OWNER' && !isCompleted;

    return {
      isCompleted,
      requiresOnboarding,
      nextPath,
      hasTin,
      hasBusinessType,
      hasModules,
    };
  }

  async getOnboardingStatus(companyId: string | undefined, userId: string) {
    const resolvedCompanyId = await this.resolveCompanyIdForUser(
      companyId,
      userId,
    );

    const [company, featureCount, warehouseCount, membership] =
      await Promise.all([
        this.prisma.company.findUnique({
          where: { id: resolvedCompanyId },
          select: { tin: true, businessType: true, status: true, name: true },
        }),
        this.prisma.companyFeature.count({
          where: { companyId: resolvedCompanyId },
        }),
        this.prisma.warehouse.count({
          where: { companyId: resolvedCompanyId, status: { not: 'ARCHIVED' } },
        }),
        this.prisma.companyUser.findFirst({
          where: { companyId: resolvedCompanyId, userId },
          select: { role: true },
        }),
      ]);

    if (!company) {
      throw new NotFoundException('Kompaniya topilmadi');
    }

    const role = String(membership?.role || 'OWNER').toUpperCase();
    const core = this.computeStatusFields(company, featureCount, role);

    return {
      ...core,
      hasWarehouse: warehouseCount > 0,
      role,
    };
  }

  private async ensureDefaultCompanyFeatures(companyId: string) {
    const existing = await this.prisma.companyFeature.count({
      where: { companyId },
    });
    if (existing > 0) return;

    const allFeatures = await (this.prisma as any).feature.findMany({
      include: { module: true },
    });
    if (!allFeatures.length) return;

    const featuresToEnable = allFeatures.filter((f: { key: string }) =>
      DEFAULT_FEATURE_KEYS.includes(f.key),
    );
    if (!featuresToEnable.length) return;

    await (this.prisma as any).companyFeature.createMany({
      data: featuresToEnable.map((f: { id: string }) => ({
        companyId,
        featureId: f.id,
        enabled: true,
      })),
      skipDuplicates: true,
    });
  }

  async applyModules(
    companyId: string | undefined,
    userId: string,
    dto: SubmitBusinessAnswersDto,
  ) {
    const resolvedCompanyId = await this.resolveCompanyIdForUser(
      companyId,
      userId,
    );
    const answers = dto.answers || {};

    const isTruthyAnswer = (value?: string) => {
      if (!value) return false;
      const normalized = value.toLowerCase();
      return [
        'yes',
        'true',
        'always',
        'sometimes',
        'one',
        'many',
        'now',
        'later',
      ].includes(normalized);
    };

    const hasWarehouse =
      isTruthyAnswer(answers.hasWarehouse) || isTruthyAnswer(answers.q1);
    const hasPartners =
      isTruthyAnswer(answers.hasPartners) || isTruthyAnswer(answers.q2);
    const hasDebt =
      isTruthyAnswer(answers.hasDebt) || isTruthyAnswer(answers.q3);

    const allFeatures = await (this.prisma as any).feature.findMany({
      include: { module: true },
    });

    const enabledFeatureKeys: string[] = [];

    if (hasWarehouse) {
      enabledFeatureKeys.push('WAREHOUSE_BASIC', 'STOCK_ADJUSTMENT');
    }
    if (hasPartners) {
      enabledFeatureKeys.push(
        'B2B_ORDERS',
        'GOODS_RECEIPTS_MAIN',
        'PARTIAL_RECEIPT',
        'PRODUCT_MAPPING',
      );
    }
    if (hasDebt) {
      enabledFeatureKeys.push('DEBT_TRACKING', 'PAYMENT_RECORDS');
    }

    if (enabledFeatureKeys.length === 0) {
      enabledFeatureKeys.push(...DEFAULT_FEATURE_KEYS);
    }

    const featuresToEnable = allFeatures.filter((f: { key: string }) =>
      enabledFeatureKeys.includes(f.key),
    );

    if (featuresToEnable.length > 0) {
      await (this.prisma as any).companyFeature.createMany({
        data: featuresToEnable.map((f: { id: string }) => ({
          companyId: resolvedCompanyId,
          featureId: f.id,
          enabled: true,
        })),
        skipDuplicates: true,
      });
    } else {
      await this.ensureDefaultCompanyFeatures(resolvedCompanyId);
    }

    return {
      success: true,
      enabledModules: [
        ...new Set(
          featuresToEnable.map((f: { module: { key: string } }) => f.module.key),
        ),
      ],
    };
  }

  async addTeamMember(
    companyId: string | undefined,
    userId: string,
    dto: AddTeamMemberDto,
  ) {
    const resolvedCompanyId = await this.resolveCompanyIdForUser(
      companyId,
      userId,
    );

    const existingUser = await this.prisma.user.findUnique({
      where: { login: dto.login },
    });

    if (existingUser) {
      throw new ConflictException('Login allaqachon mavjud');
    }

    const rawPassword = String(dto.password || '').trim();
    if (!rawPassword || rawPassword.length < 6) {
      throw new ConflictException(
        "Parol kamida 6 belgidan iborat bo'lishi kerak",
      );
    }
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    const newUser = await this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        login: dto.login,
        passwordHash,
        companies: {
          create: {
            companyId: resolvedCompanyId,
            role: dto.role,
          },
        },
      },
      select: {
        id: true,
        fullName: true,
        login: true,
        email: true,
        phone: true,
      },
    });

    return newUser;
  }

  async completeOnboarding(companyId: string | undefined, userId: string) {
    const resolvedCompanyId = await this.resolveCompanyIdForUser(
      companyId,
      userId,
    );

    await this.ensureDefaultCompanyFeatures(resolvedCompanyId);

    const company = await this.prisma.company.update({
      where: { id: resolvedCompanyId },
      data: { status: 'active' },
    });

    const warehouseCount = await this.prisma.warehouse.count({
      where: { companyId: resolvedCompanyId, status: { not: 'ARCHIVED' } },
    });
    if (warehouseCount === 0) {
      await this.prisma.warehouse.create({
        data: {
          companyId: resolvedCompanyId,
          name: 'Asosiy Ombor',
          address: company.address || 'Toshkent',
          status: 'ACTIVE',
        },
      });
    }

    return company;
  }
}
