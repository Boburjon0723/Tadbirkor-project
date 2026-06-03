import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Markup } from 'telegraf';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramBotContextService, TelegramBotUser } from './telegram-bot-context.service';
import { TelegramTasksService } from './telegram-tasks.service';
import { TelegramPosReportService } from './telegram-pos-report.service';

export const MENU_LINK = '📱 Ulanish / yangilash';
export const MENU_PASSWORD = '🔑 Parolni tiklash';
export const MENU_TASKS = '📋 Mening vazifalarim';
export const MENU_POS_REPORT = '📊 POS bugun';
export const MENU_WEB = '🌐 Veb-ilovani ochish';
export const MENU_HELP = 'ℹ️ Yordam';

export const MENU_BUTTONS = new Set([
  MENU_LINK,
  MENU_PASSWORD,
  MENU_TASKS,
  MENU_POS_REPORT,
  MENU_WEB,
  MENU_HELP,
]);

@Injectable()
export class TelegramMenuService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly botContext: TelegramBotContextService,
    private readonly tasksService: TelegramTasksService,
    private readonly posReportService: TelegramPosReportService,
  ) {}

  mainMenuKeyboard() {
    return Markup.keyboard([
      [Markup.button.contactRequest('📱 Telefon raqamni ulashish'), MENU_PASSWORD],
      [MENU_TASKS, MENU_POS_REPORT],
      [MENU_WEB, MENU_HELP],
    ]).resize();
  }

  contactOnlyKeyboard() {
    return Markup.keyboard([
      [Markup.button.contactRequest('📱 Telefon raqamni ulashish')],
    ])
      .resize()
      .oneTime();
  }

  welcomeText(): string {
    return [
      'Tadbirkor botiga xush kelibsiz.',
      '',
      'Pastdagi menyu:',
      '• Ulanish — bildirishnomalar',
      '• Parolni tiklash',
      '• Mening vazifalarim — ochiq ishlar',
      '• POS bugun — kassa hisoboti',
      '• Veb-ilova',
      '',
      'Raqamni qo‘lda yozmang — faqat tugma.',
    ].join('\n');
  }

  helpText(): string {
    return [
      'ℹ️ Yordam',
      '',
      '/menu — asosiy menyu',
      '/vazifalar — kutayotgan ishlar',
      '/pos — POS kunlik hisobot',
      '/kompaniya — kompaniya tanlash (bir nechta bo‘lsa)',
      '/parol — parolni tiklash',
      '/bekor — jarayonni bekor qilish',
      '',
      'Bildirishnomalardagi tugmalar (Qabul/Rad) shu chatda ishlaydi.',
    ].join('\n');
  }

  getWebAppUrl(): string {
    const base = (
      this.configService.get<string>('FRONTEND_URL') ||
      this.configService.get<string>('WEB_APP_URL') ||
      'http://localhost:3000'
    )
      .trim()
      .replace(/\/+$/, '');
    return `${base}/dashboard`;
  }

  isMenuButton(text: string): boolean {
    return MENU_BUTTONS.has(text.trim());
  }

  async handleMenuButton(
    text: string,
    chatId: string,
  ): Promise<{ message: string; extra?: { reply_markup?: any } }> {
    const normalized = text.trim();

    if (normalized === MENU_LINK) {
      return {
        message: [
          'Telefonni ulash uchun tugmani bosing.',
          'Tizimdagi profil raqami bilan mos kelishi kerak.',
        ].join('\n'),
        extra: this.contactOnlyKeyboard(),
      };
    }

    if (normalized === MENU_PASSWORD) {
      return { message: '__TRIGGER_PASSWORD_RESET__' };
    }

    if (normalized === MENU_TASKS) {
      return { message: await this.tasksService.buildTasksMessage(chatId) };
    }

    if (normalized === MENU_POS_REPORT) {
      return this.buildPosReportForChat(chatId);
    }

    if (normalized === MENU_WEB) {
      const url = this.getWebAppUrl();
      const user = await this.botContext.findLinkedUser(chatId);
      return {
        message: user
          ? [`🌐 Veb-ilova:`, url, '', 'Login bilan kiring.'].join('\n')
          : [`🌐 Veb-ilova:`, url, '', 'Avval botda telefonni ulang.'].join('\n'),
      };
    }

    if (normalized === MENU_HELP) {
      return { message: this.helpText() };
    }

    return { message: this.welcomeText(), extra: this.mainMenuKeyboard() };
  }

  companyPickerMarkup(user: TelegramBotUser) {
    return Markup.inlineKeyboard(
      user.memberships.map((m) => [
        Markup.button.callback(`${m.companyName} (${m.role})`, `mc:${m.companyId}`),
      ]),
    );
  }

  async buildPosReportMessage(companyId: string): Promise<string> {
    return this.posReportService.buildTodayReport(companyId);
  }

  private async buildPosReportForChat(
    chatId: string,
  ): Promise<{ message: string; extra?: { reply_markup?: any } }> {
    const user = await this.botContext.findLinkedUser(chatId);
    if (!user) {
      return {
        message: 'Avval telefon orqali ulaning — «Ulanish» tugmasi.',
      };
    }

    const membership = this.botContext.getActiveMembership(chatId, user);
    if (!membership) {
      return { message: 'Kompaniya topilmadi.' };
    }

    if (!this.roleCanPosReport(membership.role)) {
      return {
        message: 'POS hisoboti uchun ruxsat yo‘q (OWNER, MANAGER, ACCOUNTANT, SALES).',
      };
    }

    const enabled = await this.isPosModuleEnabled(membership.companyId);
    if (!enabled) {
      return {
        message: 'POS moduli kompaniyada o‘chirilgan. Sozlamalar → Modullar.',
      };
    }

    const report = await this.posReportService.buildTodayReport(membership.companyId);
    return {
      message: [this.botContext.formatProfileBlock(chatId, user), '', report].join('\n'),
    };
  }

  private roleCanPosReport(role: string) {
    return ['OWNER', 'MANAGER', 'ACCOUNTANT', 'SALES'].includes(role);
  }

  private async isPosModuleEnabled(companyId: string): Promise<boolean> {
    const rows = await (this.prisma as any).companyFeature.findMany({
      where: { companyId, enabled: true },
      include: { feature: { include: { module: { select: { key: true } } } } },
    });
    if (!rows.length) return true;
    return rows.some(
      (r: any) => String(r.feature?.module?.key || '').toUpperCase() === 'POS',
    );
  }
}
