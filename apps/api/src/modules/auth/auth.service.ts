import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { isPublicRegistrationEnabled } from '../../common/registration.util';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { WarehouseScopeService } from '../users/services/warehouse-scope.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { CompaniesService } from '../companies/companies.service';
import {
  effectivePermissions,
  sanitizePosPermissionOverrides,
} from '../../common/role-permissions';
import { normalizeUzPhone } from '../../common/phone.util';
import { computeTrialEndsAt, getTrialDays } from '../../common/trial.util';
import { resolveSubscriptionAccess } from '../../common/subscription.util';
import { isPlatformAdminUser } from '../../common/platform-admin.util';
import { TelegramLinkService } from '../telegram/telegram-link.service';
import { PasswordResetTelegramLinkDto } from './dto/password-reset-telegram-link.dto';
import { AppCacheService } from '../../common/cache/app-cache.service';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';

const AUTH_ME_CACHE_TTL_MS = Number(process.env.AUTH_ME_CACHE_TTL_MS || 60_000);

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private usersService: UsersService,
    private warehouseScopeService: WarehouseScopeService,
    private jwtService: JwtService,
    private companiesService: CompaniesService,
    private telegramLinkService: TelegramLinkService,
    private cache: AppCacheService,
  ) {}

  invalidateMeCache(userId: string, companyId: string) {
    void this.cache.del(AppCacheService.authMeKey(userId, companyId));
  }

  /**
   * Veb «Parolni unutdingizmi» — bir martalik Telegram /start kodi.
   * Login mavjudligi haqida ma'lumot bermaydi (xavfsizlik).
   */
  async createPasswordResetTelegramLink(dto: PasswordResetTelegramLinkDto) {
    const login = String(dto.login || '').trim();
    const code = randomBytes(8).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    let loginHint: string | null = null;
    if (login) {
      const user = await this.usersService.findByLogin(login);
      if (user?.passwordHash) {
        loginHint = login;
      }
    }

    await (this.prisma as any).telegramBotIntent.create({
      data: {
        code,
        intent: 'PASSWORD_RESET',
        login: loginHint,
        expiresAt,
      },
    });

    const startPayload = `rp_${code}`;
    const botUrl = this.telegramLinkService.getBotStartUrl(startPayload);
    if (!botUrl) {
      throw new BadRequestException('TELEGRAM_BOT_USERNAME sozlanmagan');
    }

    return {
      botUrl,
      startUrl: botUrl,
      expiresAt,
      instructions:
        `Telegramda @${this.telegramLinkService.getBotUsername()} botni oching, «Telefon raqamni ulashish» tugmasini bosing, keyin yangi parol kiriting.`,
    };
  }

  async register(dto: RegisterDto) {
    if (!isPublicRegistrationEnabled()) {
      throw new ForbiddenException(
        'Ro‘yxatdan o‘tish vaqtincha yopiq. Mavjud hisob bilan kiring yoki administrator bilan bog‘laning.',
      );
    }

    // 1. Login tekshiruvi
    const existingUser = await this.usersService.findByLogin(dto.login);
    if (existingUser) {
      throw new BadRequestException('Bunday login allaqachon band');
    }

    // 2. Email tekshiruvi (agar kiritilgan bo'lsa)
    if (dto.email) {
      const userByEmail = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (userByEmail) {
        throw new BadRequestException('Bunday email allaqachon ro\'yxatdan o\'tgan');
      }
    }

    const phone = normalizeUzPhone(dto.phone);
    if (!phone) {
      throw new BadRequestException('Telefon raqami noto‘g‘ri (masalan: +998901234567)');
    }
    const userByPhone = await this.prisma.user.findUnique({ where: { phone } });
    if (userByPhone) {
      throw new BadRequestException('Bunday telefon raqami band');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    // PgBouncer: interaktiv tranzaksiyasiz ketma-ket yozuv
    const company = await this.prisma.company.create({
      data: {
        name: dto.companyName,
        tin: dto.tin || null,
        phone,
        status: 'onboarding',
        trialEndsAt: computeTrialEndsAt(),
        subscriptionStatus: 'TRIAL',
        warehouses: {
          create: {
            name: 'Asosiy Ombor',
            address: 'Toshkent',
            status: 'ACTIVE',
          },
        },
      },
    });

    const user = await this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        login: dto.login,
        passwordHash,
        email: dto.email,
        phone,
      },
    });

    await this.prisma.companyUser.create({
      data: {
        companyId: company.id,
        userId: user.id,
        role: 'OWNER',
      },
    });

    const token = await this.generateToken(user.id, company.id, 'OWNER');
    return {
      ...token,
      user: {
        id: user.id,
        fullName: user.fullName,
        login: user.login,
        role: 'OWNER',
      },
    };
  }

  async login(dto: LoginDto) {
    const identifier = String(dto.login || '').trim();
    const normalizedPhone = normalizeUzPhone(identifier);
    const user = normalizedPhone
      ? await this.usersService.findByPhone(identifier)
      : await this.usersService.findByLogin(identifier);
    if (!user) {
      throw new UnauthorizedException('Login, telefon yoki parol noto\'g\'ri');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException(
        'Hisob paroli sozlanmagan. Administrator bilan bog\'laning.',
      );
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Login, telefon yoki parol noto\'g\'ri');
    }

    const memberships = (user.companies || []).filter(
      (m) => m?.companyId && String(m.role || '').trim(),
    );
    if (!memberships.length) {
      throw new UnauthorizedException(
        'Hisobingiz hech qanday kompaniyaga biriktirilmagan. Administrator bilan bog\'laning.',
      );
    }

    const mainCompany = memberships[0];
    const token = await this.generateToken(
      user.id,
      mainCompany.companyId,
      mainCompany.role,
    );
    
    return {
      ...token,
      user: {
        id: user.id,
        fullName: user.fullName,
        login: user.login,
        role: mainCompany.role
      }
    };
  }

  private async generateToken(userId: string, companyId: string, role: string) {
    const payload = { sub: userId, companyId, role };
    return {
      access_token: await this.jwtService.signAsync(payload),
    };
  }

  private sanitizeUserResponse(user: {
    id: string;
    fullName: string;
    login: string;
    email?: string | null;
    phone?: string | null;
    telegramChatId?: string | null;
    telegramLinkedAt?: Date | null;
  }) {
    return {
      id: user.id,
      fullName: user.fullName,
      login: user.login,
      email: user.email ?? null,
      phone: user.phone ?? null,
      telegramChatId: user.telegramChatId ?? null,
      telegramLinkedAt: user.telegramLinkedAt ?? null,
    };
  }

  private async resolveCompanyIdForUser(
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
      throw new UnauthorizedException(
        'Kompaniya topilmadi. Qayta kiring.',
      );
    }
    return membership.companyId;
  }

  async getMe(userId: string, companyId: string | undefined) {
    const resolvedCompanyId = await this.resolveCompanyIdForUser(
      companyId,
      userId,
    );
    const cacheKey = AppCacheService.authMeKey(userId, resolvedCompanyId);
    return this.cache.getOrSet(
      cacheKey,
      () => this.loadMe(userId, resolvedCompanyId),
      AUTH_ME_CACHE_TTL_MS,
    );
  }

  private async loadMe(userId: string, resolvedCompanyId: string) {
    const [user, company, companyUser, warehouseScope] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          fullName: true,
          login: true,
          email: true,
          phone: true,
          telegramChatId: true,
          telegramLinkedAt: true,
        },
      }),
      this.prisma.company.findUnique({
        where: { id: resolvedCompanyId },
        select: {
          id: true,
          name: true,
          tin: true,
          status: true,
          address: true,
          businessType: true,
          storefrontUrl: true,
          storefrontToken: true,
          telegramChatId: true,
          telegramEnabled: true,
          telegramLinkedAt: true,
          trialEndsAt: true,
          subscriptionStatus: true,
          subscriptionNote: true,
          subscriptionActivatedAt: true,
          createdAt: true,
          posCreditEnabled: true,
          posMaxDiscountPercent: true,
          inventoryVarianceTolerancePct: true,
        },
      }),
      this.prisma.companyUser.findFirst({
        where: { userId, companyId: resolvedCompanyId },
        include: {
          warehouse: { select: { id: true, name: true, status: true } },
        },
      }),
      this.warehouseScopeService.getForUser(resolvedCompanyId, userId),
    ]);
    if (!company) {
      throw new UnauthorizedException(
        'Kompaniya topilmadi yoki hisobingiz ushbu kompaniyaga bog\'lanmagan.',
      );
    }

    const role = companyUser?.role || 'OWNER';
    const permissions = effectivePermissions(
      role,
      companyUser?.grantPermissions,
      companyUser?.denyPermissions,
    );

    const trialDays = getTrialDays();
    let access = resolveSubscriptionAccess(company);

    if (
      access.status === 'TRIAL' &&
      !access.trialActive &&
      company.subscriptionStatus === 'TRIAL'
    ) {
      await this.prisma.company.update({
        where: { id: resolvedCompanyId },
        data: { subscriptionStatus: 'EXPIRED' },
      });
      void this.cache.del(AppCacheService.authMeKey(userId, resolvedCompanyId));
      access = resolveSubscriptionAccess({
        ...company,
        subscriptionStatus: 'EXPIRED',
      });
    }

    const platformAdmin = user ? isPlatformAdminUser(user) : false;

    return {
      user: user ? this.sanitizeUserResponse(user) : null,
      isPlatformAdmin: platformAdmin,
      company: {
        ...company,
        trialDays,
        trialActive: access.trialActive,
        subscriptionStatus: access.status,
        canWrite: platformAdmin ? true : access.canWrite,
        subscriptionLabel: access.labelUz,
      },
      role,
      permissions,
      grantPermissions: companyUser?.grantPermissions ?? [],
      denyPermissions: companyUser?.denyPermissions ?? [],
      warehouse:
        companyUser?.warehouse?.status === 'ARCHIVED'
          ? null
          : companyUser?.warehouse || null,
      warehouseScope,
    };
  }

  async inviteUser(companyId: string, dto: InviteUserDto) {
    await this.companiesService.assertModuleEnabled(companyId, 'EMPLOYEES');
    const warehouseId = this.usersService.resolveWarehouseIdForRole(
      dto.role,
      dto.warehouseId ?? null,
    );
    if (warehouseId) {
      await this.usersService.assertWarehouseBelongsToCompany(companyId, warehouseId);
    }

    const phone = normalizeUzPhone(dto.phone);
    if (!phone) {
      throw new BadRequestException('Telefon raqami noto‘g‘ri (masalan: +998901234567)');
    }

    const existingUser = await this.usersService.findByLogin(dto.login);
    if (existingUser) {
      const alreadyHere = existingUser.companies?.some((m) => m.companyId === companyId);
      if (alreadyHere) {
        throw new BadRequestException('Bu login allaqachon jamoada mavjud');
      }
      const canReactivate =
        String(existingUser.status || '').toLowerCase() === 'inactive' ||
        !existingUser.companies?.length;
      if (!canReactivate) {
        throw new BadRequestException('Bunday login band');
      }
      const phoneOwner = await this.prisma.user.findUnique({ where: { phone } });
      if (phoneOwner && phoneOwner.id !== existingUser.id) {
        throw new BadRequestException('Bunday telefon raqami band');
      }

      const passwordHash = await bcrypt.hash(dto.password, 10);
      const posOverrides = sanitizePosPermissionOverrides(
        dto.grantPermissions,
        dto.denyPermissions,
      );

      return this.prisma.$transaction(async (tx) => {
        const user = await tx.user.update({
          where: { id: existingUser.id },
          data: {
            fullName: dto.fullName,
            passwordHash,
            email: dto.email ?? existingUser.email,
            phone,
            status: 'active',
            telegramChatId: null,
            telegramLinkedAt: null,
          },
        });

        const membership = await tx.companyUser.create({
          data: {
            companyId,
            userId: user.id,
            role: dto.role,
            warehouseId,
            grantPermissions: posOverrides.grantPermissions,
            denyPermissions: posOverrides.denyPermissions,
          },
        });

        return {
          id: user.id,
          companyUserId: membership.id,
          fullName: user.fullName,
          login: user.login,
          email: user.email,
          phone: user.phone,
          reactivated: true,
        };
      });
    }

    const userByPhone = await this.prisma.user.findUnique({ where: { phone } });
    if (userByPhone) {
      throw new BadRequestException('Bunday telefon raqami band');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          fullName: dto.fullName,
          login: dto.login,
          passwordHash,
          email: dto.email,
          phone,
        },
      });

      const posOverrides = sanitizePosPermissionOverrides(
        dto.grantPermissions,
        dto.denyPermissions,
      );

      const membership = await tx.companyUser.create({
        data: {
          companyId,
          userId: user.id,
          role: dto.role,
          warehouseId,
          grantPermissions: posOverrides.grantPermissions,
          denyPermissions: posOverrides.denyPermissions,
        },
      });

      return {
        id: user.id,
        companyUserId: membership.id,
        fullName: user.fullName,
        login: user.login,
        email: user.email,
        phone: user.phone,
      };
    });
  }
}
