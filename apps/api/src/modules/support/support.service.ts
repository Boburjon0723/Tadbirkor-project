import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { SubmitSupportMessageDto } from './dto/support-message.dto';

@Injectable()
export class SupportService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly telegramService: TelegramService,
  ) {}

  private normalizeUsername(raw?: string): string | null {
    const value = String(raw || '')
      .trim()
      .replace(/^@/, '');
    return value || null;
  }

  getPublicConfig() {
    const telegramUsername =
      this.normalizeUsername(
        this.configService.get<string>('SUPPORT_TELEGRAM_USERNAME'),
      ) ||
      this.normalizeUsername(
        this.configService.get<string>('TELEGRAM_BOT_USERNAME'),
      );

    const telegramUrl = telegramUsername
      ? `https://t.me/${telegramUsername}`
      : null;

    return {
      telegramUsername,
      telegramUrl,
      email:
        String(this.configService.get<string>('SUPPORT_EMAIL') || '').trim() ||
        'support@tadbirkor.uz',
      phone:
        String(this.configService.get<string>('SUPPORT_PHONE') || '').trim() ||
        null,
      hours:
        String(this.configService.get<string>('SUPPORT_HOURS') || '').trim() ||
        'Dush–Juma, 09:00–18:00',
      chatEnabled: !!telegramUsername || !!this.configService.get('SUPPORT_TELEGRAM_CHAT_ID'),
    };
  }

  async getContext(companyId: string, userId: string) {
    const [user, company] = await Promise.all([
      this.prisma.user.findFirst({
        where: { id: userId },
        select: { id: true, fullName: true, email: true, phone: true },
      }),
      this.prisma.company.findFirst({
        where: { id: companyId },
        select: { id: true, name: true },
      }),
    ]);

    return {
      config: this.getPublicConfig(),
      user: user
        ? {
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            phone: user.phone,
          }
        : null,
      company: company ? { id: company.id, name: company.name } : null,
    };
  }

  async submitMessage(
    companyId: string,
    userId: string,
    dto: SubmitSupportMessageDto,
  ) {
    const ctx = await this.getContext(companyId, userId);
    const topic = String(dto.topic || 'Umumiy savol').trim();
    const body = String(dto.message || '').trim();

    const lines = [
      '💬 Tadbirkor — Support chat',
      '',
      `Kompaniya: ${ctx.company?.name || companyId}`,
      `Foydalanuvchi: ${ctx.user?.fullName || userId}`,
      ctx.user?.email ? `Email: ${ctx.user.email}` : null,
      ctx.user?.phone ? `Tel: ${ctx.user.phone}` : null,
      `Mavzu: ${topic}`,
      '',
      body,
    ].filter(Boolean);

    const supportChatId = String(
      this.configService.get<string>('SUPPORT_TELEGRAM_CHAT_ID') || '',
    ).trim();

    let delivered = false;
    if (supportChatId && this.telegramService.isBotReady()) {
      delivered = await this.telegramService.sendRawMessage(
        supportChatId,
        lines.join('\n'),
      );
    }

    await this.prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: 'support.message_sent',
        entityType: 'SUPPORT',
        entityId: `${Date.now()}`,
        newData: {
          topic,
          deliveredToTelegram: delivered,
          preview: body.slice(0, 200),
        } as any,
      },
    });

    return {
      ok: true,
      deliveredToTelegram: delivered,
      telegramUrl: ctx.config.telegramUrl,
      message: delivered
        ? 'Xabaringiz qabul qilindi. Tez orada javob beramiz.'
        : 'Xabaringiz saqlandi. Telegram orqali ham yozishingiz mumkin.',
    };
  }

  async submitPublicMessage(dto: { name: string; contact: string; message: string; topic?: string }) {
    const topic = String(dto.topic || 'Mehmon savoli').trim();
    const body = String(dto.message || '').trim();
    const name = String(dto.name || 'Mehmon').trim();
    const contact = String(dto.contact || '').trim();

    const lines = [
      '💬 Tadbirkor — Support chat (MEHMON)',
      '',
      `Foydalanuvchi: ${name}`,
      `Aloqa: ${contact}`,
      `Mavzu: ${topic}`,
      '',
      body,
    ].filter(Boolean);

    const supportChatId = String(
      this.configService.get<string>('SUPPORT_TELEGRAM_CHAT_ID') || '',
    ).trim();

    let delivered = false;
    if (supportChatId && this.telegramService.isBotReady()) {
      delivered = await this.telegramService.sendRawMessage(
        supportChatId,
        lines.join('\n'),
      );
    }

    return {
      ok: true,
      deliveredToTelegram: delivered,
      message: delivered
        ? 'Xabaringiz qabul qilindi. Tez orada javob beramiz.'
        : 'Tizimda xatolik yuz berdi. Telegram orqali ham yozishingiz mumkin.',
    };
  }

  buildTelegramDeepLink(
    username: string | null,
    companyName?: string,
    userName?: string,
    draftMessage?: string,
  ): string | null {
    const u = this.normalizeUsername(username || undefined);
    if (!u) return null;

    const parts: string[] = [];
    if (companyName) parts.push(`Kompaniya: ${companyName}`);
    if (userName) parts.push(`Men: ${userName}`);
    if (draftMessage) parts.push('', draftMessage);

    const text = encodeURIComponent(parts.join('\n').trim());
    return text ? `https://t.me/${u}?text=${text}` : `https://t.me/${u}`;
  }
}
