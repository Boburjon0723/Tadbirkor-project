import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { Telegraf } from 'telegraf';
import type { FieldService } from '../field/field.service';
import { TelegramLinkService } from './telegram-link.service';
import { TelegramPasswordResetService } from './telegram-password-reset.service';
import { TelegramMenuService, MENU_POS_REPORT } from './telegram-menu.service';
import { TelegramBotContextService } from './telegram-bot-context.service';
import { TelegramTasksService } from './telegram-tasks.service';
import {
  formatTelegramDetailLines,
  formatTelegramRoles,
} from './telegram-message-format.util';

type TelegramEventAction = {
  key: string;
  label: string;
  targetType: string;
  targetId: string;
  payload?: Record<string, any>;
};

type TelegramEventPayload = {
  moduleKey: string;
  eventKey: string;
  title: string;
  message: string;
  type?: string;
  details?: Record<string, any>;
  targetRoles?: string[];
  actions?: TelegramEventAction[];
};

type TelegramActionExecutionResult = {
  summary?: string;
  awaitComment?: {
    companyId: string;
    batchId: string;
    status: 'PARTIAL' | 'REJECTED';
  };
};

@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private bot: Telegraf | null = null;
  private webhookSecret: string | null = null;
  private readonly validRoles = ['OWNER', 'MANAGER', 'WAREHOUSE', 'ACCOUNTANT', 'SALES', 'FIELD_WORKER'];
  private readonly statusLabelMap: Record<string, string> = {
    PENDING: 'Kutilmoqda',
    ACCEPTED: 'Qabul qilindi',
    PARTIALLY_ACCEPTED: 'Qisman qabul qilindi',
    REJECTED: 'Rad etildi',
    OPEN: 'Ochiq',
    PARTIAL: 'Qisman to‘langan',
    PAID: 'To‘langan',
    CONFIRMED: 'Tasdiqlangan',
    DONE: 'Bajarilgan',
    FAILED: 'Xatolik',
    DRAFT: 'Qoralama',
    SENT: 'Yuborilgan',
    APPROVED: 'Tasdiqlangan',
    CANCELLED: 'Bekor qilingan',
    COMPLETED: 'Yakunlangan',
    DISPATCHED: 'Jo‘natilgan',
  };
  private readonly pendingPartnerOrderComment = new Map<
    string,
    { companyId: string; batchId: string; status: 'PARTIAL' | 'REJECTED' }
  >();

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly moduleRef: ModuleRef,
    private readonly telegramLinkService: TelegramLinkService,
    private readonly passwordResetService: TelegramPasswordResetService,
    private readonly menuService: TelegramMenuService,
    private readonly botContext: TelegramBotContextService,
    private readonly tasksService: TelegramTasksService,
  ) {}

  /** Lazy load — FieldService ↔ NotificationsService ↔ TelegramService tsiklini uzadi */
  private async getFieldService(): Promise<FieldService> {
    const { FieldService: FieldServiceClass } = await import('../field/field.service');
    return this.moduleRef.get(FieldServiceClass, { strict: false });
  }

  async onModuleInit() {
    const token = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN setilmagan. Telegram bot yoqilmaydi.');
      return;
    }

    this.bot = new Telegraf(token);

    void this.bot.telegram
      .setMyCommands([
        { command: 'start', description: 'Boshlash' },
        { command: 'menu', description: 'Asosiy menyu' },
        { command: 'vazifalar', description: 'Mening vazifalarim' },
        { command: 'pos', description: 'POS kunlik hisobot' },
        { command: 'kompaniya', description: 'Kompaniya tanlash' },
        { command: 'parol', description: 'Parolni tiklash' },
        { command: 'bekor', description: 'Bekor qilish' },
      ])
      .catch((err) => {
        this.logger.warn(`setMyCommands: ${(err as Error).message}`);
      });

    this.bot.command('menu', async (ctx) => {
      const chatId = ctx.chat?.id;
      if (!chatId) return;
      await ctx.reply(this.menuService.welcomeText(), this.menuService.mainMenuKeyboard());
    });

    this.bot.command('vazifalar', async (ctx) => {
      const chatId = ctx.chat?.id;
      if (!chatId) return;
      const text = await this.tasksService.buildTasksMessage(String(chatId));
      await ctx.reply(text, this.menuService.mainMenuKeyboard());
    });

    this.bot.command('kompaniya', async (ctx) => {
      const chatId = ctx.chat?.id;
      if (!chatId) return;
      await this.handleCompanyPicker(ctx, String(chatId));
    });

    this.bot.command('pos', async (ctx) => {
      const chatId = ctx.chat?.id;
      if (!chatId) return;
      const result = await this.menuService.handleMenuButton(MENU_POS_REPORT, String(chatId));
      await ctx.reply(result.message, this.menuService.mainMenuKeyboard());
    });

    this.bot.command('parol', async (ctx) => {
      const chatId = ctx.chat?.id;
      if (!chatId) return;
      await this.promptPasswordReset(ctx, String(chatId));
    });

    this.bot.command('bekor', async (ctx) => {
      const chatId = ctx.chat?.id;
      if (!chatId) return;
      if (this.passwordResetService.cancelFlow(String(chatId))) {
        await ctx.reply('Jarayon bekor qilindi.', { reply_markup: { remove_keyboard: true } });
        await ctx.reply('Menyu:', this.menuService.mainMenuKeyboard());
      } else {
        await ctx.reply('Bekor qilinadigan jarayon yo‘q.');
      }
    });

    this.bot.start(async (ctx) => {
      const payload = (ctx.startPayload || '').trim();
      const chatId = ctx.chat?.id;
      if (!chatId) return;

      if (payload) {
        if (payload.toLowerCase() === 'parol') {
          await this.promptPasswordReset(ctx, String(chatId));
          return;
        }
        if (payload.startsWith('rp_')) {
          const intentCode = payload.slice(3);
          const intent = await this.passwordResetService.beginFromIntentCode(
            String(chatId),
            intentCode,
          );
          if (!intent) {
            await ctx.reply(
              [
                '⚠️ Havola muddati o‘tgan yoki allaqachon ishlatilgan.',
                'Veb-saytda qayta «Parolni unutdingizmi» ni bosing.',
              ].join('\n'),
            );
            return;
          }
          await this.promptPasswordReset(ctx, String(chatId), intent.loginHint);
          return;
        }
        try {
          const linked = await this.telegramLinkService.linkCompanyByStartCode(
            String(chatId),
            payload,
          );
          await ctx.reply(
            `✅ «${linked.companyName}» kompaniyasi Telegramga ulandi. Bildirishnomalar shu chatga keladi.`,
            { reply_markup: { remove_keyboard: true } },
          );
        } catch (err) {
          const message = (err as Error).message || 'Ulanish kodi noto‘g‘ri yoki muddati o‘tgan.';
          await ctx.reply(message);
        }
        return;
      }

      await ctx.reply(this.menuService.welcomeText(), this.menuService.mainMenuKeyboard());
    });

    this.bot.on('contact', async (ctx) => {
      const chatId = ctx.chat?.id;
      const contact = ctx.message?.contact;
      const phone = contact?.phone_number;
      if (!chatId || !phone) return;

      // Faqat tugma orqali yuborilgan O‘Z raqami (boshqa kontakt kartasi emas)
      if (contact.user_id && ctx.from?.id && contact.user_id !== ctx.from.id) {
        await ctx.reply(
          'Boshqa odamning kontaktini yubormang. Faqat «📱 Telefon raqamni ulashish» tugmasini bosing.',
          this.menuService.contactOnlyKeyboard(),
        );
        return;
      }

      if (this.passwordResetService.isAwaitingPhone(String(chatId))) {
        try {
          const verified = await this.passwordResetService.verifyPhone(String(chatId), phone);
          await ctx.reply(
            [
              `✅ Tasdiqlandi: ${verified.fullName}`,
              `Login: ${verified.login}`,
              '',
              'Endi yangi parolni yozing (kamida 6 belgi).',
              'Keyin tasdiqlash uchun bir marta yana yuboring.',
              '/bekor — bekor qilish',
            ].join('\n'),
            { reply_markup: { remove_keyboard: true } },
          );
        } catch (err) {
          await ctx.reply((err as Error).message, this.menuService.contactOnlyKeyboard());
        }
        return;
      }

      try {
        const linked = await this.telegramLinkService.linkChatToUserByPhone(
          String(chatId),
          phone,
        );
        const rolesText =
          linked.roles.length > 0 ? formatTelegramRoles(linked.roles) : '—';
        await ctx.reply(
          [
            `✅ Salom, ${linked.fullName}!`,
            `📱 Telefon: ${linked.phone}`,
            `👤 Rollar: ${rolesText}`,
            linked.companies.length
              ? `🏢 Kompaniyalar: ${linked.companies.join(', ')}`
              : '',
            '',
            'Bildirishnomalar shu chatga keladi.',
            '',
            'Menyudan «Mening vazifalarim» ni oching.',
          ]
            .filter(Boolean)
            .join('\n'),
          { reply_markup: { remove_keyboard: true } },
        );
        await ctx.reply('Asosiy menyu:', this.menuService.mainMenuKeyboard());
      } catch (err) {
        try {
          const partnerLinked = await this.telegramLinkService.linkChatToPartnerLedgerByPhone(
            String(chatId),
            phone,
          );
          await ctx.reply(
            [
              `✅ Salom, ${partnerLinked.contactName}!`,
              `🏢 Hamkor kartasi topildi: ${partnerLinked.companyName}`,
              `📱 Telefon: ${partnerLinked.phone}`,
              '',
              'Bildirishnomalar shu chatga keladi.',
            ].join('\n'),
            { reply_markup: { remove_keyboard: true } },
          );
        } catch {
          const message =
            (err as Error).message ||
            'Telefon tizimda topilmadi. Tizimdagi raqamni tekshiring va tugma orqali qayta ulashing.';
          await ctx.reply(
            [message, '', 'Raqamni qo‘lda yozmang — faqat tugmani bosing.'].join('\n'),
            this.menuService.contactOnlyKeyboard(),
          );
        }
      }
    });

    this.bot.on('text', async (ctx) => {
      const chatId = ctx.chat?.id;
      const text = (ctx.message?.text || '').trim();
      if (!chatId || !text) return;

      if (this.menuService.isMenuButton(text)) {
        const result = await this.menuService.handleMenuButton(text, String(chatId));
        if (result.message === '__TRIGGER_PASSWORD_RESET__') {
          await this.promptPasswordReset(ctx, String(chatId));
          return;
        }
        await ctx.reply(result.message, result.extra || this.menuService.mainMenuKeyboard());
        return;
      }

      if (!text.startsWith('/')) {
        const resetResult = await this.passwordResetService.handleText(String(chatId), text);
        if (resetResult.handled) {
          await ctx.reply(resetResult.reply);
          if (!this.passwordResetService.isInFlow(String(chatId))) {
            await ctx.reply('Menyu:', this.menuService.mainMenuKeyboard());
          }
          return;
        }
      }

      const pendingPartnerComment = this.pendingPartnerOrderComment.get(String(chatId));
      if (pendingPartnerComment && !text.startsWith('/')) {
        const comment = text.trim();
        if (comment.length < 3) {
          await ctx.reply('Izoh kamida 3 ta belgi bo‘lsin. Qisqa yozmang.');
          return;
        }
        await this.appendPartnerOrderStatusNote(
          pendingPartnerComment.companyId,
          pendingPartnerComment.batchId,
          pendingPartnerComment.status,
          comment,
        );
        this.pendingPartnerOrderComment.delete(String(chatId));
        const statusLabel =
          pendingPartnerComment.status === 'PARTIAL' ? 'Qisman qabul qilindi' : 'Qabul qilinmadi';
        await ctx.reply(`✅ Holat saqlandi: ${statusLabel}\n📝 Izoh: ${comment}`);
        return;
      }

      if (text.startsWith('/')) return;

      const alreadyLinked = await this.prisma.user.findFirst({
        where: { telegramChatId: String(chatId) },
        select: { id: true },
      });
      if (alreadyLinked || this.passwordResetService.isInFlow(String(chatId))) return;

      const digits = text.replace(/\D/g, '');
      const looksLikePhone = digits.length >= 9;
      if (!looksLikePhone) return;

      await ctx.reply(
        [
          'Raqamni matn sifatida yubormang.',
          'Pastdagi menyudan tugmani tanlang.',
        ].join('\n'),
        this.menuService.mainMenuKeyboard(),
      );
    });

    this.bot.on('callback_query', async (ctx) => {
      const callbackData = typeof ctx.callbackQuery?.['data'] === 'string' ? ctx.callbackQuery['data'] : '';
      const chatId = String(ctx.chat?.id || '');

      if (callbackData.startsWith('mc:')) {
        const companyId = callbackData.slice(3);
        const user = await this.botContext.findLinkedUser(chatId);
        if (!user) {
          await ctx.answerCbQuery('Avval telefonni ulang');
          return;
        }
        if (!this.botContext.setActiveCompany(chatId, companyId, user)) {
          await ctx.answerCbQuery('Kompaniya topilmadi');
          return;
        }
        await ctx.answerCbQuery('Tanlandi');
        const tasks = await this.tasksService.buildTasksMessage(chatId);
        await ctx.reply(tasks, this.menuService.mainMenuKeyboard());
        return;
      }

      const actionResult = await this.processActionCallback(
        callbackData,
        String(ctx.chat?.id || ''),
        String(ctx.callbackQuery.id),
      );

      await ctx.answerCbQuery(actionResult.toast);
      if (actionResult.chatMessage) {
        await ctx.reply(actionResult.chatMessage);
      }
    });

    this.bot.catch((err) => {
      const message = (err as any)?.message ? String((err as any).message) : String(err);
      this.logger.error(`Telegram bot error: ${message}`);
    });

    const webhookUrl = (this.configService.get<string>('TELEGRAM_WEBHOOK_URL') || '').trim();
    this.webhookSecret = (this.configService.get<string>('TELEGRAM_WEBHOOK_SECRET') || '').trim() || null;
    if (webhookUrl) {
      try {
        await this.bot.telegram.setWebhook(webhookUrl, {
          secret_token: this.webhookSecret || undefined,
          drop_pending_updates: true,
        });
        this.logger.log(`Telegram webhook ulandi: ${webhookUrl}`);
      } catch (err) {
        const message = (err as any)?.message ? String((err as any).message) : String(err);
        this.logger.error(`Telegram webhook sozlashda xato: ${message}`);
      }
      return;
    }

    const updatesEnabledRaw = this.configService.get<string>('TELEGRAM_UPDATES_ENABLED');
    const updatesEnabled =
      (updatesEnabledRaw || '').toLowerCase() === 'true' ||
      ((updatesEnabledRaw || '') === '' && this.configService.get<string>('NODE_ENV') !== 'production');

    if (!updatesEnabled) {
      this.logger.warn(
        'TELEGRAM_UPDATES_ENABLED=false. Polling yoqilmadi, bot faqat outgoing xabarlar uchun ishlaydi.',
      );
      return;
    }

    try {
      await this.bot.launch({ dropPendingUpdates: true });
      this.logger.log('Telegram bot update polling ishga tushdi.');
    } catch (err) {
      const message = (err as any)?.message ? String((err as any).message) : String(err);
      this.logger.error(`Telegram bot launch failed: ${message}`);
      this.logger.warn('Backend ishini davom ettiradi, Telegram update polling vaqtincha o‘chiriladi.');
    }
  }

  async handleWebhookUpdate(update: unknown, secretFromHeader?: string) {
    if (!this.bot) return;

    if (this.webhookSecret && secretFromHeader !== this.webhookSecret) {
      throw new Error('Invalid Telegram webhook secret');
    }

    await this.bot.handleUpdate(update as any);
  }

  async onModuleDestroy() {
    await this.bot?.stop();
  }

  private async promptPasswordReset(
    ctx: { reply: (...args: any[]) => Promise<unknown> },
    chatId: string,
    loginHint?: string,
  ) {
    if (!this.passwordResetService.isInFlow(chatId)) {
      this.passwordResetService.startFlow(chatId, loginHint);
    }
    const lines = [
      '🔑 Parolni tiklash (veb-saytdan keldingiz)',
      ...(loginHint ? [`Login: ${loginHint}`] : []),
      '',
      '1. «📱 Telefon raqamni ulashish» tugmasini bosing (qo‘lda yozmang)',
      '2. Yangi parol yozing (kamida 6 belgi)',
      '3. Tasdiqlash uchun parolni yana bir marta yuboring',
      '',
      '/bekor — bekor qilish',
    ];
    await ctx.reply(lines.join('\n'), this.menuService.contactOnlyKeyboard());
  }

  private async handleCompanyPicker(
    ctx: { reply: (...args: any[]) => Promise<unknown> },
    chatId: string,
  ) {
    const user = await this.botContext.findLinkedUser(chatId);
    if (!user) {
      await ctx.reply('Avval «Ulanish» tugmasi orqali telefonni ulang.');
      return;
    }
    if (user.memberships.length <= 1) {
      const m = user.memberships[0];
      await ctx.reply(
        m
          ? `Sizda bitta kompaniya: ${m.companyName} (${m.role})`
          : 'Kompaniya topilmadi.',
        this.menuService.mainMenuKeyboard(),
      );
      return;
    }
    await ctx.reply(
      await this.tasksService.buildCompanyPickerMessage(user),
      this.menuService.companyPickerMarkup(user),
    );
  }

  async sendToCompany(
    companyId: string,
    title: string,
    message: string,
    type: string = 'INFO',
    payload?: Omit<TelegramEventPayload, 'title' | 'message' | 'type'>,
  ) {
    if (!this.bot) throw new Error('Telegram bot not configured');

    const eventPayload: TelegramEventPayload = {
      moduleKey: payload?.moduleKey || 'GENERAL',
      eventKey: payload?.eventKey || 'general.notification',
      title,
      message,
      type,
      details: payload?.details,
      targetRoles: payload?.targetRoles,
      actions: payload?.actions,
    };

    const chats = await this.resolveTargetChats(companyId, eventPayload.moduleKey, eventPayload.targetRoles);
    if (chats.length === 0) return;

    const text = this.formatTelegramMessage(eventPayload);
    let sentCount = 0;
    let lastError: Error | undefined;

    for (const chat of chats) {
      try {
        const actionRecords = await this.createActionRecords(companyId, chat.chatId, eventPayload.moduleKey, eventPayload.actions || []);
        const inlineKeyboard = actionRecords.length
          ? {
              inline_keyboard: [
                actionRecords.map((item) => ({
                  text: item.label,
                  callback_data: `ta:${item.recordId}`,
                })),
              ],
            }
          : undefined;

        await this.bot.telegram.sendMessage(chat.chatId, text, inlineKeyboard ? { reply_markup: inlineKeyboard } : undefined);
        sentCount += 1;
      } catch (err) {
        lastError = err as Error;
        this.logger.warn(`Telegram sendMessage failed: ${(err as Error).message}`);
      }
    }

    if (sentCount === 0 && chats.length > 0) {
      throw lastError ?? new Error('Telegram sendMessage failed for all targets');
    }
  }

  async sendToChat(
    companyId: string,
    chatId: string,
    title: string,
    message: string,
    type: string = 'INFO',
    payload?: Omit<TelegramEventPayload, 'title' | 'message' | 'type' | 'targetRoles'>,
  ) {
    if (!this.bot) throw new Error('Telegram bot not configured');
    const normalizedChatId = String(chatId || '').trim();
    if (!normalizedChatId) throw new Error('chatId missing');

    const eventPayload: TelegramEventPayload = {
      moduleKey: payload?.moduleKey || 'GENERAL',
      eventKey: payload?.eventKey || 'general.notification',
      title,
      message,
      type,
      details: payload?.details,
      actions: payload?.actions,
    };

    const text = this.formatTelegramMessage(eventPayload);
    try {
      const actionRecords = await this.createActionRecords(
        companyId,
        normalizedChatId,
        eventPayload.moduleKey,
        eventPayload.actions || [],
      );
      const inlineKeyboard = actionRecords.length
        ? {
            inline_keyboard: [
              actionRecords.map((item) => ({
                text: item.label,
                callback_data: `ta:${item.recordId}`,
              })),
            ],
          }
        : undefined;
      await this.bot.telegram.sendMessage(
        normalizedChatId,
        text,
        inlineKeyboard ? { reply_markup: inlineKeyboard } : undefined,
      );
    } catch (err) {
      this.logger.warn(`Telegram sendToChat failed: ${(err as Error).message}`);
      throw err;
    }
  }

  /** Platforma support chatiga to'g'ridan-to'g'ri xabar (company binding'siz) */
  async sendRawMessage(chatId: string, text: string): Promise<boolean> {
    if (!this.bot) return false;
    const normalized = String(chatId || '').trim();
    if (!normalized) return false;
    try {
      await this.bot.telegram.sendMessage(normalized, text);
      return true;
    } catch (err) {
      this.logger.warn(`Telegram sendRawMessage failed: ${(err as Error).message}`);
      return false;
    }
  }

  isBotReady(): boolean {
    return !!this.bot;
  }

  private formatTelegramMessage(payload: TelegramEventPayload) {
    const emoji =
      payload.type === 'ERROR' ? '❗️' : payload.type === 'WARNING' ? '⚠️' : payload.type === 'SUCCESS' ? '✅' : '🔔';
    const lines = [`${emoji} ${payload.title}`, '', payload.message];

    const detailLines = formatTelegramDetailLines(
      payload.details as Record<string, unknown> | undefined,
    );
    if (detailLines.length > 0) {
      lines.push('', '────────────', ...detailLines);
    }

    if (payload.actions?.length) {
      lines.push('', '👇 Quyidagi tugmalardan harakat tanlang.');
    }

    return lines.join('\n');
  }

  private async resolveTargetChats(companyId: string, moduleKey: string, targetRoles?: string[]) {
    const normalizedRoles = (targetRoles || []).map((r) => r.toUpperCase()).filter((r) => this.validRoles.includes(r));
    const bindings = await (this.prisma as any).telegramChatBinding.findMany({
      where: {
        companyId,
        enabled: true,
        moduleKey: { in: [moduleKey.toUpperCase(), 'ALL'] },
        ...(normalizedRoles.length ? { role: { in: normalizedRoles } } : {}),
      },
      select: { chatId: true, role: true },
    });

    if (bindings.length > 0) {
      const unique = new Map<string, { chatId: string; role: string }>();
      for (const item of bindings) {
        unique.set(String(item.chatId), { chatId: String(item.chatId), role: String(item.role) });
      }
      return Array.from(unique.values());
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { telegramChatId: true, telegramEnabled: true },
    });
    if (!company?.telegramEnabled || !company.telegramChatId) return [];
    return [{ chatId: String(company.telegramChatId), role: 'OWNER' }];
  }

  private async createActionRecords(
    companyId: string,
    chatId: string,
    moduleKey: string,
    actions: TelegramEventAction[],
  ): Promise<Array<{ label: string; recordId: string }>> {
    const records: Array<{ label: string; recordId: string }> = [];
    for (const action of actions) {
      const created = await (this.prisma as any).telegramActionRecord.create({
        data: {
          companyId,
          chatId,
          moduleKey: moduleKey.toUpperCase(),
          actionKey: action.key,
          targetType: action.targetType,
          targetId: action.targetId,
          payload: action.payload || {},
        },
      });
      records.push({ label: action.label, recordId: created.id });
    }
    return records;
  }

  private async appendPartnerOrderStatusNote(
    companyId: string,
    batchId: string,
    status: 'ACCEPTED' | 'PARTIAL' | 'REJECTED',
    comment?: string,
  ) {
    const oneOp = await this.prisma.partnerLedgerOperation.findFirst({
      where: {
        companyId,
        sourceType: 'PARTNER_SALE_ORDER',
        sourceId: batchId,
      },
      select: { contactId: true },
    });
    if (oneOp?.contactId) {
      try {
        await this.prisma.$executeRaw`
          INSERT INTO "PartnerLedgerSaleOrderStatus"
            ("companyId","contactId","batchId","status","comment","source","updatedById","createdAt","updatedAt")
          VALUES
            (${companyId}, ${oneOp.contactId}, ${batchId}, ${status}, ${comment ?? null}, ${'TELEGRAM'}, ${null}, NOW(), NOW())
          ON CONFLICT ("companyId","batchId")
          DO UPDATE SET
            "contactId" = EXCLUDED."contactId",
            "status" = EXCLUDED."status",
            "comment" = EXCLUDED."comment",
            "source" = EXCLUDED."source",
            "updatedById" = EXCLUDED."updatedById",
            "updatedAt" = NOW()
        `;
      } catch (err) {
        this.logger.warn(`Partner order status table write skipped: ${(err as Error).message}`);
      }
    }

    const ops = await this.prisma.partnerLedgerOperation.findMany({
      where: {
        companyId,
        sourceType: 'PARTNER_SALE_ORDER',
        sourceId: batchId,
      },
      select: { id: true, notes: true },
    });
    if (!ops.length) return;

    const line = comment?.trim()
      ? `[BOT_ORDER] status=${status}; comment=${comment.trim()}; at=${new Date().toISOString()}`
      : `[BOT_ORDER] status=${status}; at=${new Date().toISOString()}`;

    await Promise.all(
      ops.map((op) =>
        this.prisma.partnerLedgerOperation.update({
          where: { id: op.id },
          data: {
            notes: op.notes?.trim() ? `${op.notes.trim()}\n${line}` : line,
          },
        }),
      ),
    );
  }

  private async processActionCallback(
    rawData: string,
    chatId: string,
    callbackQueryId: string,
  ): Promise<{ toast: string; chatMessage?: string }> {
    if (!rawData.startsWith('ta:')) {
      return { toast: 'Noto‘g‘ri action', chatMessage: '❗️ Amal bajarilmadi: callback formati noto‘g‘ri.' };
    }
    const recordId = rawData.slice(3);
    const record = await (this.prisma as any).telegramActionRecord.findUnique({
      where: { id: recordId },
    });
    if (!record || String(record.chatId) !== chatId) {
      return { toast: 'Topilmadi', chatMessage: '⚠️ Ushbu action yozuvi topilmadi yoki chatga tegishli emas.' };
    }
    if (record.status === 'DONE') {
      return { toast: 'Allaqachon bajarilgan', chatMessage: 'ℹ️ Bu amal avval bajarilgan.' };
    }
    if (record.callbackQueryId && record.callbackQueryId === callbackQueryId) {
      return { toast: 'Qayta so‘rov', chatMessage: 'ℹ️ Ushbu callback allaqachon qayd etilgan.' };
    }

    try {
      const linkedUser = await this.prisma.user.findUnique({
        where: { telegramChatId: chatId },
        select: { id: true },
      });
      let actor = linkedUser
        ? await this.prisma.companyUser.findFirst({
            where: { companyId: record.companyId, userId: linkedUser.id },
            select: { userId: true, role: true },
          })
        : null;
      if (!actor) {
        const binding = await (this.prisma as any).telegramChatBinding.findFirst({
          where: {
            companyId: record.companyId,
            chatId,
            enabled: true,
            moduleKey: { in: [record.moduleKey, 'ALL'] },
          },
          orderBy: { updatedAt: 'desc' },
        });
        actor = binding
          ? await this.prisma.companyUser.findFirst({
              where: { companyId: record.companyId, role: binding.role },
              select: { userId: true, role: true },
            })
          : null;
      }
      const executionResult = await this.executeAction(record, actor?.userId || null, chatId);
      await (this.prisma as any).telegramActionRecord.update({
        where: { id: record.id },
        data: {
          status: 'DONE',
          processedAt: new Date(),
          callbackQueryId,
          errorMessage: null,
        },
      });
      if (executionResult.awaitComment) {
        this.pendingPartnerOrderComment.set(chatId, executionResult.awaitComment);
      }
      return {
        toast: 'Bajarildi',
        chatMessage: executionResult.summary || `✅ Amal bajarildi: ${record.actionKey}`,
      };
    } catch (err) {
      await (this.prisma as any).telegramActionRecord.update({
        where: { id: record.id },
        data: {
          status: 'FAILED',
          processedAt: new Date(),
          callbackQueryId,
          errorMessage: (err as Error).message,
        },
      });
      return {
        toast: 'Xatolik',
        chatMessage: `❗️ Amal bajarilmadi: ${(err as Error).message}`,
      };
    }
  }

  private async executeAction(
    record: any,
    actorUserId: string | null,
    chatId: string,
  ): Promise<TelegramActionExecutionResult> {
    void chatId;
    if (record.actionKey === 'DEBT_CONFIRM') {
      const payment = await this.prisma.debtPaymentRecord.findUnique({
        where: { id: record.targetId },
        include: { debtEntry: true },
      });
      if (!payment || payment.status !== 'PENDING' || payment.debtEntry.creditorId !== record.companyId) {
        return { summary: 'ℹ️ To‘lov allaqachon ko‘rib chiqilgan yoki mavjud emas.' };
      }
      const nextRemaining = Math.max(0, Number(payment.debtEntry.remainingAmount) - Number(payment.amount));
      await this.prisma.$transaction(async (tx) => {
        await tx.debtPaymentRecord.update({
          where: { id: payment.id },
          data: { status: 'CONFIRMED', confirmedBy: actorUserId || undefined },
        });
        await tx.debtEntry.update({
          where: { id: payment.debtEntryId },
          data: {
            remainingAmount: nextRemaining,
            status: nextRemaining <= 0 ? 'PAID' : 'PARTIAL',
          },
        });
        if (actorUserId) {
          await tx.auditLog.create({
            data: {
              companyId: record.companyId,
              userId: actorUserId,
              action: 'debt.payment_confirmed.telegram',
              entityType: 'DEBT_PAYMENT',
              entityId: payment.id,
              oldData: { status: payment.status } as any,
              newData: { status: 'CONFIRMED', source: 'TELEGRAM' } as any,
            },
          });
        }
      });
      const amountText = Number(payment.amount).toLocaleString('uz-UZ');
      const remainingText = Number(nextRemaining).toLocaleString('uz-UZ');
      const suffix =
        nextRemaining <= 0 ? '✅ Barchasi to‘landi.' : `Qolgan qarzdorlik: ${remainingText} so‘m.`;
      return {
        summary: `✅ To‘lov tasdiqlandi: ${amountText} so‘m. ${suffix}`,
      };
    }
    if (record.actionKey === 'DEBT_REJECT') {
      const payment = await this.prisma.debtPaymentRecord.findUnique({
        where: { id: record.targetId },
        include: { debtEntry: true },
      });
      if (!payment || payment.status !== 'PENDING' || payment.debtEntry.creditorId !== record.companyId) {
        return { summary: 'ℹ️ To‘lov allaqachon ko‘rib chiqilgan yoki mavjud emas.' };
      }
      await this.prisma.debtPaymentRecord.update({
        where: { id: payment.id },
        data: { status: 'REJECTED' },
      });
      if (actorUserId) {
        await this.prisma.auditLog.create({
          data: {
            companyId: record.companyId,
            userId: actorUserId,
            action: 'debt.payment_rejected.telegram',
            entityType: 'DEBT_PAYMENT',
            entityId: payment.id,
            oldData: { status: payment.status } as any,
            newData: { status: 'REJECTED', source: 'TELEGRAM' } as any,
          },
        });
      }
      return { summary: `⚠️ To‘lov rad etildi: ${Number(payment.amount).toLocaleString('uz-UZ')} so‘m.` };
    }
    if (record.actionKey === 'PARTNER_ACCEPT') {
      const partner = await this.prisma.partner.findUnique({ where: { id: record.targetId } });
      if (!partner || partner.status !== 'PENDING' || partner.partnerCompanyId !== record.companyId) {
        return { summary: 'ℹ️ Hamkor so‘rovi allaqachon ko‘rib chiqilgan yoki mavjud emas.' };
      }
      await this.prisma.partner.update({
        where: { id: partner.id },
        data: { status: 'ACTIVE', acceptedAt: new Date() },
      });
      if (actorUserId) {
        await this.prisma.auditLog.create({
          data: {
            companyId: record.companyId,
            userId: actorUserId,
            action: 'partner.accepted.telegram',
            entityType: 'PARTNER',
            entityId: partner.id,
          },
        });
      }
      return { summary: '✅ Hamkorlik so‘rovi qabul qilindi.' };
    }
    if (record.actionKey === 'PARTNER_REJECT') {
      const partner = await this.prisma.partner.findUnique({ where: { id: record.targetId } });
      if (!partner || partner.status !== 'PENDING' || partner.partnerCompanyId !== record.companyId) {
        return { summary: 'ℹ️ Hamkor so‘rovi allaqachon ko‘rib chiqilgan yoki mavjud emas.' };
      }
      await this.prisma.partner.update({
        where: { id: partner.id },
        data: { status: 'REJECTED' },
      });
      if (actorUserId) {
        await this.prisma.auditLog.create({
          data: {
            companyId: record.companyId,
            userId: actorUserId,
            action: 'partner.rejected.telegram',
            entityType: 'PARTNER',
            entityId: partner.id,
          },
        });
      }
      return { summary: '⚠️ Hamkorlik so‘rovi rad etildi.' };
    }
    if (record.actionKey === 'ORDER_ACCEPT') {
      const order = await this.prisma.b2BOrder.findUnique({ where: { id: record.targetId } });
      if (!order || order.sellerCompanyId !== record.companyId) {
        return { summary: 'ℹ️ Buyurtma topilmadi yoki ushbu kompaniyaga tegishli emas.' };
      }
      if (['REJECTED', 'CANCELLED', 'COMPLETED', 'DISPATCHED'].includes(order.status)) {
        return { summary: `ℹ️ Buyurtma holati sababli qabul qilib bo‘lmaydi (${order.status}).` };
      }
      await this.prisma.b2BOrder.update({
        where: { id: order.id },
        data: { status: 'ACCEPTED' },
      });
      if (actorUserId) {
        await this.prisma.auditLog.create({
          data: {
            companyId: record.companyId,
            userId: actorUserId,
            action: 'order.accepted.telegram',
            entityType: 'B2B_ORDER',
            entityId: order.id,
          },
        });
      }
      return { summary: '✅ Buyurtma qabul qilindi.' };
    }
    if (record.actionKey === 'ORDER_REJECT') {
      const order = await this.prisma.b2BOrder.findUnique({ where: { id: record.targetId } });
      if (!order || order.sellerCompanyId !== record.companyId) {
        return { summary: 'ℹ️ Buyurtma topilmadi yoki ushbu kompaniyaga tegishli emas.' };
      }
      if (['COMPLETED', 'DISPATCHED', 'CANCELLED'].includes(order.status)) {
        return { summary: `ℹ️ Buyurtma holati sababli rad etib bo‘lmaydi (${order.status}).` };
      }
      await this.prisma.b2BOrder.update({
        where: { id: order.id },
        data: { status: 'REJECTED' },
      });
      if (actorUserId) {
        await this.prisma.auditLog.create({
          data: {
            companyId: record.companyId,
            userId: actorUserId,
            action: 'order.rejected.telegram',
            entityType: 'B2B_ORDER',
            entityId: order.id,
          },
        });
      }
      return { summary: '⚠️ Buyurtma rad etildi.' };
    }
    if (record.actionKey === 'PL_ORDER_ACCEPT') {
      await this.appendPartnerOrderStatusNote(record.companyId, record.targetId, 'ACCEPTED');
      if (actorUserId) {
        await this.prisma.auditLog.create({
          data: {
            companyId: record.companyId,
            userId: actorUserId,
            action: 'partner_ledger.order.accepted.telegram',
            entityType: 'PARTNER_LEDGER_ORDER',
            entityId: String(record.targetId),
            newData: { status: 'ACCEPTED', source: 'TELEGRAM' } as any,
          },
        });
      }
      return { summary: '✅ Buyurtma qabul qilindi.' };
    }
    if (record.actionKey === 'PL_ORDER_PARTIAL') {
      return {
        summary:
          '📝 Qisman qabul qilindi deb belgilash uchun izoh yozing (masalan: 10 tasi yo‘q, 5 tasi ertaga).',
        awaitComment: {
          companyId: String(record.companyId),
          batchId: String(record.targetId),
          status: 'PARTIAL',
        },
      };
    }
    if (record.actionKey === 'PL_ORDER_REJECT') {
      return {
        summary: '📝 Qabul qilinmadi deb belgilash uchun izoh yozing.',
        awaitComment: {
          companyId: String(record.companyId),
          batchId: String(record.targetId),
          status: 'REJECTED',
        },
      };
    }
    if (record.actionKey === 'FIELD_APPROVE') {
      const fieldService = await this.getFieldService();
      await fieldService.approveFromTelegram(record.companyId, record.targetId, actorUserId);
      return { summary: '✅ Dala vazifasi hisoboti tasdiqlandi.' };
    }
    if (record.actionKey === 'FIELD_REJECT') {
      const fieldService = await this.getFieldService();
      await fieldService.rejectFromTelegram(record.companyId, record.targetId, actorUserId);
      return { summary: '⚠️ Dala vazifasi hisoboti rad etildi. Xodim qayta yuborishi kerak.' };
    }
    throw new Error(`Unsupported action: ${record.actionKey}`);
  }
}

