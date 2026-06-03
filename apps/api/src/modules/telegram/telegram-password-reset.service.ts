import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramLinkService } from './telegram-link.service';
import * as bcrypt from 'bcryptjs';

type ResetStep = 'await_phone' | 'await_password' | 'await_confirm';

type ResetSession = {
  step: ResetStep;
  userId?: string;
  login?: string;
  fullName?: string;
  loginHint?: string;
  pendingPassword?: string;
  expiresAt: number;
};

const SESSION_TTL_MS = 15 * 60 * 1000;
const MIN_PASSWORD_LEN = 6;
const MAX_RESETS_PER_HOUR = 5;

@Injectable()
export class TelegramPasswordResetService {
  private readonly logger = new Logger(TelegramPasswordResetService.name);
  private readonly sessions = new Map<string, ResetSession>();
  private readonly rateLimits = new Map<string, { count: number; windowStart: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramLinkService: TelegramLinkService,
  ) {}

  isInFlow(chatId: string): boolean {
    return this.getSession(chatId) !== null;
  }

  isAwaitingPhone(chatId: string): boolean {
    const session = this.getSession(chatId);
    return session?.step === 'await_phone';
  }

  startFlow(chatId: string, loginHint?: string): void {
    this.sessions.set(String(chatId), {
      step: 'await_phone',
      loginHint: loginHint?.trim() || undefined,
      expiresAt: Date.now() + SESSION_TTL_MS,
    });
  }

  /**
   * Veb havoladan: /start=rp_<code> — bot parol tiklash rejimini ochadi.
   */
  async beginFromIntentCode(
    chatId: string,
    code: string,
  ): Promise<{ loginHint?: string } | null> {
    const normalizedCode = String(code || '').trim();
    if (!normalizedCode) return null;

    const now = new Date();
    const intent = await (this.prisma as any).telegramBotIntent.findFirst({
      where: {
        code: normalizedCode,
        intent: 'PASSWORD_RESET',
        usedAt: null,
        expiresAt: { gt: now },
      },
    });
    if (!intent) return null;

    await (this.prisma as any).telegramBotIntent.update({
      where: { id: intent.id },
      data: { usedAt: now },
    });

    const loginHint = intent.login ? String(intent.login) : undefined;
    this.startFlow(chatId, loginHint);
    return { loginHint };
  }

  cancelFlow(chatId: string): boolean {
    return this.sessions.delete(String(chatId));
  }

  async verifyPhone(chatId: string, phoneRaw: string): Promise<{ login: string; fullName: string }> {
    const session = this.requireSession(chatId, 'await_phone');
    const user = await this.telegramLinkService.findUserByPhone(phoneRaw);
    if (!user) {
      throw new BadRequestException(
        'Bu telefon tizimda topilmadi. Administrator yoki jamoa sozlamalaridagi raqamni tekshiring.',
      );
    }
    if (!user.passwordHash) {
      throw new BadRequestException(
        'Hisobda parol sozlanmagan. Administrator bilan bog‘laning.',
      );
    }

    if (session.loginHint && user.login !== session.loginHint) {
      throw new BadRequestException(
        `Bu telefon «${user.login}» akkauntiga tegishli. Vebda kiritilgan loginni tekshiring.`,
      );
    }

    this.assertRateLimit(user.id);

    session.userId = user.id;
    session.login = user.login;
    session.fullName = user.fullName;
    session.step = 'await_password';
    session.expiresAt = Date.now() + SESSION_TTL_MS;
    this.sessions.set(String(chatId), session);

    return { login: user.login, fullName: user.fullName };
  }

  /**
   * Parol tiklash bosqichidagi matn. true = xabar qayta ishlandi.
   */
  async handleText(chatId: string, text: string): Promise<{ handled: boolean; reply: string }> {
    const session = this.getSession(chatId);
    if (!session) {
      return { handled: false, reply: '' };
    }

    const normalized = text.trim();
    if (!normalized) {
      return { handled: true, reply: 'Matn bo‘sh. Qayta yuboring yoki /bekor bosing.' };
    }

    if (normalized.toLowerCase() === 'bekor') {
      this.cancelFlow(chatId);
      return {
        handled: true,
        reply: 'Parol tiklash bekor qilindi. Kerak bo‘lsa /parol buyrug‘ini yuboring.',
      };
    }

    if (session.step === 'await_password') {
      if (normalized.length < MIN_PASSWORD_LEN) {
        return {
          handled: true,
          reply: `Parol kamida ${MIN_PASSWORD_LEN} belgidan iborat bo‘lishi kerak. Qayta yozing.`,
        };
      }
      session.pendingPassword = normalized;
      session.step = 'await_confirm';
      session.expiresAt = Date.now() + SESSION_TTL_MS;
      this.sessions.set(String(chatId), session);
      return {
        handled: true,
        reply: 'Parolni tasdiqlang — bir xil parolni yana bir marta yuboring.',
      };
    }

    if (session.step === 'await_confirm') {
      if (!session.pendingPassword || !session.userId) {
        this.cancelFlow(chatId);
        return {
          handled: true,
          reply: 'Sessiya tugadi. /parol bilan qaytadan boshlang.',
        };
      }
      if (normalized !== session.pendingPassword) {
        session.step = 'await_password';
        session.pendingPassword = undefined;
        this.sessions.set(String(chatId), session);
        return {
          handled: true,
          reply: 'Parollar mos kelmadi. Yangi parolni qaytadan yozing.',
        };
      }

      return this.completeReset(chatId, session.userId, session.login || '', session.fullName || '');
    }

    return { handled: false, reply: '' };
  }

  private async completeReset(
    chatId: string,
    userId: string,
    login: string,
    fullName: string,
  ): Promise<{ handled: boolean; reply: string }> {
    const session = this.getSession(chatId);
    const password = session?.pendingPassword;
    if (!password) {
      this.cancelFlow(chatId);
      return {
        handled: true,
        reply: 'Sessiya tugadi. /parol bilan qaytadan boshlang.',
      };
    }

    try {
      await this.applyNewPassword(userId, password);
      this.recordRateLimit(userId);
      this.cancelFlow(chatId);

      await this.prisma.user.update({
        where: { id: userId },
        data: { telegramChatId: String(chatId), telegramLinkedAt: new Date() },
      }).catch(() => undefined);

      return {
        handled: true,
        reply: [
          `✅ Parol yangilandi, ${fullName}!`,
          `Login: ${login}`,
          '',
          'Endi veb-ilovada yangi parol bilan kiring.',
          'Xavfsizlik uchun ushbu xabarlarni o‘chirishingiz mumkin.',
        ].join('\n'),
      };
    } catch (err) {
      this.logger.warn(`Telegram password reset failed: ${(err as Error).message}`);
      return {
        handled: true,
        reply: (err as Error).message || 'Parolni saqlashda xato. Keyinroq urinib ko‘ring.',
      };
    }
  }

  private getSession(chatId: string): ResetSession | null {
    const key = String(chatId);
    const session = this.sessions.get(key);
    if (!session) return null;
    if (session.expiresAt < Date.now()) {
      this.sessions.delete(key);
      return null;
    }
    return session;
  }

  private requireSession(chatId: string, step: ResetStep): ResetSession {
    const session = this.getSession(chatId);
    if (!session || session.step !== step) {
      throw new BadRequestException('Sessiya tugagan. /parol buyrug‘i bilan qaytadan boshlang.');
    }
    return session;
  }

  private assertRateLimit(userId: string) {
    const now = Date.now();
    const hourMs = 60 * 60 * 1000;
    const entry = this.rateLimits.get(userId);
    if (!entry || now - entry.windowStart > hourMs) {
      return;
    }
    if (entry.count >= MAX_RESETS_PER_HOUR) {
      throw new BadRequestException(
        'Juda ko‘p urinish. 1 soatdan keyin qayta urinib ko‘ring yoki administrator bilan bog‘laning.',
      );
    }
  }

  private async applyNewPassword(userId: string, newPassword: string) {
    const trimmed = String(newPassword || '').trim();
    if (trimmed.length < MIN_PASSWORD_LEN) {
      throw new BadRequestException(
        `Parol kamida ${MIN_PASSWORD_LEN} belgidan iborat bo‘lishi kerak`,
      );
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Foydalanuvchi topilmadi');
    }
    const passwordHash = await bcrypt.hash(trimmed, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  private recordRateLimit(userId: string) {
    const now = Date.now();
    const hourMs = 60 * 60 * 1000;
    const entry = this.rateLimits.get(userId);
    if (!entry || now - entry.windowStart > hourMs) {
      this.rateLimits.set(userId, { count: 1, windowStart: now });
      return;
    }
    entry.count += 1;
  }
}
