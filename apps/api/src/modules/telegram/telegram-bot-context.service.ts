import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type TelegramBotMembership = {
  companyId: string;
  companyName: string;
  role: string;
};

export type TelegramBotUser = {
  id: string;
  fullName: string;
  login: string;
  phone: string | null;
  memberships: TelegramBotMembership[];
};

@Injectable()
export class TelegramBotContextService {
  private readonly activeCompanyByChat = new Map<string, string>();

  constructor(private readonly prisma: PrismaService) {}

  async findLinkedUser(chatId: string): Promise<TelegramBotUser | null> {
    const user = await this.prisma.user.findFirst({
      where: { telegramChatId: String(chatId) },
      select: {
        id: true,
        fullName: true,
        login: true,
        phone: true,
        companies: {
          include: {
            company: { select: { id: true, name: true, status: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!user) return null;

    const memberships = user.companies
      .filter((m) => m.company?.status !== 'archived')
      .map((m) => ({
        companyId: m.companyId,
        companyName: m.company.name,
        role: String(m.role || '').toUpperCase(),
      }));

    return {
      id: user.id,
      fullName: user.fullName,
      login: user.login,
      phone: user.phone,
      memberships,
    };
  }

  getActiveCompanyId(chatId: string, user: TelegramBotUser): string | null {
    const key = String(chatId);
    const saved = this.activeCompanyByChat.get(key);
    if (saved && user.memberships.some((m) => m.companyId === saved)) {
      return saved;
    }
    return user.memberships[0]?.companyId || null;
  }

  getActiveMembership(chatId: string, user: TelegramBotUser): TelegramBotMembership | null {
    const companyId = this.getActiveCompanyId(chatId, user);
    if (!companyId) return null;
    return user.memberships.find((m) => m.companyId === companyId) || null;
  }

  setActiveCompany(chatId: string, companyId: string, user: TelegramBotUser): boolean {
    const ok = user.memberships.some((m) => m.companyId === companyId);
    if (!ok) return false;
    this.activeCompanyByChat.set(String(chatId), companyId);
    return true;
  }

  formatProfileBlock(chatId: string, user: TelegramBotUser): string {
    const membership = this.getActiveMembership(chatId, user);
    const lines = [
      `👤 ${user.fullName}`,
      `Login: ${user.login}`,
    ];
    if (membership) {
      lines.push(`Kompaniya: ${membership.companyName}`);
      lines.push(`Rol: ${membership.role}`);
    }
    if (user.memberships.length > 1) {
      lines.push('', '/kompaniya — boshqa kompaniyani tanlash');
    }
    return lines.join('\n');
  }
}
