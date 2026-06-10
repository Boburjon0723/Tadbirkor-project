import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramBotContextService, TelegramBotUser } from './telegram-bot-context.service';

const ACTION_LABELS: Record<string, string> = {
  DEBT_CONFIRM: 'Qarz to‘lovi — qabul qilish',
  DEBT_REJECT: 'Qarz to‘lovi — rad etish',
  ORDER_ACCEPT: 'B2B buyurtma — qabul',
  ORDER_REJECT: 'B2B buyurtma — rad',
  PARTNER_ACCEPT: 'Hamkor — qabul',
  PARTNER_REJECT: 'Hamkor — rad',
  FIELD_APPROVE: 'Dala hisoboti — tasdiq',
  FIELD_REJECT: 'Dala hisoboti — rad',
};

@Injectable()
export class TelegramTasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly botContext: TelegramBotContextService,
  ) {}

  async buildTasksMessage(chatId: string): Promise<string> {
    const user = await this.botContext.findLinkedUser(chatId);
    if (!user) {
      return [
        'Avval telefon orqali ulaning.',
        '«📱 Ulanish / yangilash» tugmasini bosing.',
      ].join('\n');
    }

    const membership = this.botContext.getActiveMembership(chatId, user);
    if (!membership) {
      return 'Kompaniya topilmadi. Administrator bilan bog‘laning.';
    }

    const { companyId, role } = membership;
    const enabledModules = await this.getEnabledModules(companyId);
    const lines: string[] = [
      this.botContext.formatProfileBlock(chatId, user),
      '',
      '📋 Mening vazifalarim',
      '',
    ];

    const pendingActions = await (this.prisma as any).telegramActionRecord.findMany({
      where: {
        chatId: String(chatId),
        companyId,
        status: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
      take: 8,
    });

    if (pendingActions.length > 0) {
      lines.push('🔔 Botdagi kutayotgan tugmalar:');
      for (const row of pendingActions) {
        const label = ACTION_LABELS[row.actionKey] || row.actionKey;
        lines.push(`• ${label}`);
      }
      lines.push('');
    }

    const counts: string[] = [];

    if (this.roleCanDebt(role) && this.moduleOn(enabledModules, 'DEBT')) {
      const n = await this.prisma.debtPaymentRecord.count({
        where: {
          status: 'PENDING',
          debtEntry: { creditorId: companyId },
        },
      });
      if (n > 0) counts.push(`💰 Qarz to‘lovi tasdiqlash: ${n} ta`);
    }

    if (this.roleCanB2b(role) && this.moduleOn(enabledModules, 'B2B')) {
      const n = await this.prisma.b2BOrder.count({
        where: { sellerCompanyId: companyId, status: 'SENT' },
      });
      if (n > 0) counts.push(`📦 Yangi B2B buyurtma: ${n} ta`);
    }

    if (this.roleCanPartner(role) && this.moduleOn(enabledModules, 'PARTNERS')) {
      const n = await this.prisma.partner.count({
        where: { partnerCompanyId: companyId, status: 'PENDING' },
      });
      if (n > 0) counts.push(`🤝 Hamkor so‘rovi: ${n} ta`);
    }

    if (this.roleCanField(role) && this.moduleOn(enabledModules, 'FIELD_SERVICE')) {
      const n = await this.prisma.fieldTask.count({
        where: { companyId, status: 'REPORTED' },
      });
      if (n > 0) counts.push(`🌾 Dala hisoboti tasdiqlash: ${n} ta`);
    }

    if (counts.length > 0) {
      lines.push('Tizimdagi ochiq ishlar:');
      lines.push(...counts.map((c) => `• ${c}`));
      lines.push('', 'Batafsil — veb-ilovada «Mening vazifalarim» bo‘limi.');
    } else if (pendingActions.length === 0) {
      lines.push('✅ Hozircha kutayotgan vazifa yo‘q.');
    }

    lines.push('', 'Yangi bildirishnoma kelganda shu yerda tugmalar paydo bo‘ladi.');
    return lines.join('\n');
  }

  async buildCompanyPickerMessage(user: TelegramBotUser): Promise<string> {
    const lines = ['Kompaniyani tanlang:', ''];
    for (const m of user.memberships) {
      lines.push(`• ${m.companyName} (${m.role})`);
    }
    return lines.join('\n');
  }

  private async getEnabledModules(companyId: string): Promise<Set<string>> {
    const rows = await (this.prisma as any).companyFeature.findMany({
      where: { companyId, enabled: true },
      include: { feature: { include: { module: { select: { key: true } } } } },
    });
    if (!rows.length) {
      return new Set(['WAREHOUSE', 'B2B', 'PARTNERS', 'DEBT', 'POS', 'FIELD_SERVICE', 'EMPLOYEES']);
    }
    return new Set(
      rows.map((r: any) => String(r.feature?.module?.key || '').toUpperCase()).filter(Boolean),
    );
  }

  private moduleOn(enabled: Set<string>, key: string) {
    return enabled.has(key.toUpperCase());
  }

  private roleCanDebt(role: string) {
    return ['OWNER', 'MANAGER', 'ACCOUNTANT'].includes(role);
  }

  private roleCanB2b(role: string) {
    return ['OWNER', 'MANAGER', 'SALES'].includes(role);
  }

  private roleCanPartner(role: string) {
    return ['OWNER', 'MANAGER'].includes(role);
  }

  private roleCanField(role: string) {
    return ['OWNER', 'MANAGER'].includes(role);
  }
}
