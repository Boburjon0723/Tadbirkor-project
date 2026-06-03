import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeUzPhone } from '../../common/phone.util';

export type TelegramLinkByPhoneResult = {
  userId: string;
  fullName: string;
  phone: string;
  roles: string[];
  companies: string[];
};

export type TelegramPartnerLinkResult = {
  contactId: string;
  companyId: string;
  companyName: string;
  contactName: string;
  phone: string;
};

@Injectable()
export class TelegramLinkService {
  private readonly logger = new Logger(TelegramLinkService.name);
  private readonly validRoles = [
    'OWNER',
    'MANAGER',
    'WAREHOUSE',
    'ACCOUNTANT',
    'SALES',
    'FIELD_WORKER',
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  getBotUsername(): string {
    return (this.configService.get<string>('TELEGRAM_BOT_USERNAME') || '')
      .trim()
      .replace(/^@+/, '');
  }

  getBotStartUrl(startPayload?: string): string | null {
    const botUsername = this.getBotUsername();
    if (!botUsername) return null;
    if (startPayload?.trim()) {
      return `https://t.me/${botUsername}?start=${encodeURIComponent(startPayload.trim())}`;
    }
    return `https://t.me/${botUsername}`;
  }

  async findUserByPhone(phoneRaw: string) {
    const phone = normalizeUzPhone(phoneRaw);
    if (!phone) return null;
    return this.prisma.user.findUnique({
      where: { phone },
      include: {
        companies: {
          include: { company: { select: { id: true, name: true } } },
        },
      },
    });
  }

  /**
   * Telegram contact / telefon orqali foydalanuvchini bog‘lash va barcha rollar uchun binding yaratish.
   */
  async linkChatToUserByPhone(
    chatId: string,
    phoneRaw: string,
  ): Promise<TelegramLinkByPhoneResult> {
    const normalizedChatId = String(chatId || '').trim();
    if (!normalizedChatId) {
      throw new BadRequestException('Telegram chat topilmadi');
    }

    const user = await this.findUserByPhone(phoneRaw);
    if (!user) {
      throw new BadRequestException(
        'Bu telefon tizimda topilmadi. Ro‘yxatdan o‘tish yoki jamoa sozlamalarida kiritilgan raqamni tekshiring.',
      );
    }

    const existingChatOwner = await this.prisma.user.findUnique({
      where: { telegramChatId: normalizedChatId },
      select: { id: true, fullName: true },
    });
    if (existingChatOwner && existingChatOwner.id !== user.id) {
      throw new BadRequestException(
        'Bu Telegram akkaunt boshqa foydalanuvchiga bog‘langan.',
      );
    }

    const now = new Date();
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        telegramChatId: normalizedChatId,
        telegramLinkedAt: now,
      },
    });

    await this.syncBindingsForUser(user.id, normalizedChatId, now);

    const roles = user.companies.map((m) => String(m.role || '').toUpperCase());
    const companies = user.companies.map((m) => m.company.name);

    return {
      userId: user.id,
      fullName: user.fullName,
      phone: user.phone || normalizeUzPhone(phoneRaw) || '',
      roles,
      companies,
    };
  }

  /** Hamkor daftari kontakti: telefon orqali chat ni bog'lash. */
  async linkChatToPartnerLedgerByPhone(
    chatId: string,
    phoneRaw: string,
  ): Promise<TelegramPartnerLinkResult> {
    const normalizedChatId = String(chatId || '').trim();
    if (!normalizedChatId) {
      throw new BadRequestException('Telegram chat topilmadi');
    }

    const normalizedPhone = normalizeUzPhone(phoneRaw);
    if (!normalizedPhone) {
      throw new BadRequestException('Telefon formati noto‘g‘ri');
    }

    const candidates = await this.prisma.partnerLedgerContact.findMany({
      where: {
        isActive: true,
        phone: normalizedPhone,
      },
      include: {
        company: { select: { id: true, name: true } },
      },
    });

    if (candidates.length === 0) {
      throw new BadRequestException(
        'Bu telefon bo‘yicha hamkor daftari kontakti topilmadi.',
      );
    }

    if (candidates.length > 1) {
      throw new BadRequestException(
        'Bu telefon bir nechta hamkor kontaktida bor. Bog‘lash uchun admin bilan aniqlang.',
      );
    }

    const contact = candidates[0];
    await this.prisma.partnerLedgerContact.update({
      where: { id: contact.id },
      data: {
        phone: normalizedPhone,
        telegramChatId: normalizedChatId,
        telegramLinkedAt: new Date(),
        telegramLinkStatus: 'LINKED',
      },
    });

    return {
      contactId: contact.id,
      companyId: contact.company.id,
      companyName: contact.company.name,
      contactName: contact.name,
      phone: normalizedPhone,
    };
  }

  /** Eski usul: kompaniya link kodi (ixtiyoriy fallback). */
  async linkCompanyByStartCode(chatId: string, code: string): Promise<{ companyName: string }> {
    const now = new Date();
    const company = await this.prisma.company.findFirst({
      where: {
        telegramLinkCode: code.trim(),
        telegramLinkCodeExpiresAt: { gt: now },
      },
    });
    if (!company) {
      throw new BadRequestException('Ulanish kodi noto‘g‘ri yoki muddati o‘tgan.');
    }

    await this.prisma.company.update({
      where: { id: company.id },
      data: {
        telegramChatId: String(chatId),
        telegramEnabled: true,
        telegramLinkedAt: now,
        telegramLinkCode: null,
        telegramLinkCodeExpiresAt: null,
      },
    });

    const ownerMembership = await this.prisma.companyUser.findFirst({
      where: { companyId: company.id, role: 'OWNER' },
      select: { userId: true },
    });
    if (ownerMembership?.userId) {
      await this.prisma.user.update({
        where: { id: ownerMembership.userId },
        data: {
          telegramChatId: String(chatId),
          telegramLinkedAt: now,
        },
      });
      await this.syncBindingsForUser(ownerMembership.userId, String(chatId), now);
    }

    return { companyName: company.name };
  }

  private async syncBindingsForUser(
    userId: string,
    chatId: string,
    linkedAt: Date,
  ) {
    const memberships = await this.prisma.companyUser.findMany({
      where: { userId },
      select: { companyId: true, role: true },
    });

    for (const membership of memberships) {
      const role = String(membership.role || '').toUpperCase();
      if (!this.validRoles.includes(role)) continue;

      await (this.prisma as any).telegramChatBinding.upsert({
        where: {
          companyId_role_moduleKey: {
            companyId: membership.companyId,
            role,
            moduleKey: 'ALL',
          },
        },
        update: {
          chatId,
          enabled: true,
        },
        create: {
          companyId: membership.companyId,
          role,
          moduleKey: 'ALL',
          chatId,
          enabled: true,
        },
      });

      if (role === 'OWNER') {
        await this.prisma.company.update({
          where: { id: membership.companyId },
          data: {
            telegramChatId: chatId,
            telegramEnabled: true,
            telegramLinkedAt: linkedAt,
          },
        });
      }
    }

    this.logger.debug(
      `Telegram linked user=${userId} chat=${chatId} memberships=${memberships.length}`,
    );
  }
}
