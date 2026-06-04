import { Injectable } from '@nestjs/common';
import { Markup } from 'telegraf';
import { PayrollLeaveService, STAFF_ROLES_FOR_LEAVE } from '../payroll/payroll-leave.service';
import { TelegramBotContextService } from './telegram-bot-context.service';
import {
  MENU_LEAVE_PENDING,
  MENU_LEAVE_REQUEST,
} from './telegram-menu.service';
import { addDaysUtc, formatDateOnlyUz, toDateOnlyUtc } from '../payroll/payroll-work-days.util';

@Injectable()
export class TelegramLeaveBotService {
  constructor(
    private readonly payrollLeave: PayrollLeaveService,
    private readonly botContext: TelegramBotContextService,
  ) {}

  isLeaveMenuButton(text: string) {
    const t = text.trim();
    return t === MENU_LEAVE_REQUEST || t === MENU_LEAVE_PENDING;
  }

  canRequestLeave(role: string) {
    return STAFF_ROLES_FOR_LEAVE.includes(
      String(role || '').toUpperCase() as (typeof STAFF_ROLES_FOR_LEAVE)[number],
    );
  }

  canReviewLeave(role: string) {
    return ['OWNER', 'MANAGER'].includes(String(role || '').toUpperCase());
  }

  leaveDaysKeyboard() {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback('1 kun', 'lr:d:1'),
        Markup.button.callback('2 kun', 'lr:d:2'),
        Markup.button.callback('3 kun', 'lr:d:3'),
      ],
      [
        Markup.button.callback('5 kun', 'lr:d:5'),
        Markup.button.callback('7 kun', 'lr:d:7'),
        Markup.button.callback('10 kun', 'lr:d:10'),
      ],
    ]);
  }

  leaveStartKeyboard(days: number) {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback('Bugun', `lr:s:${days}:0`),
        Markup.button.callback('Ertaga', `lr:s:${days}:1`),
      ],
      [Markup.button.callback('3 kundan keyin', `lr:s:${days}:3`)],
      [Markup.button.callback('❌ Bekor', 'lr:cancel')],
    ]);
  }

  async handleLeaveMenu(
    text: string,
    chatId: string,
  ): Promise<{ message: string; extra?: { reply_markup?: any } }> {
    const user = await this.botContext.findLinkedUser(chatId);
    if (!user) {
      return { message: 'Avval telefon orqali ulaning — «Ulanish» tugmasi.' };
    }

    const membership = this.botContext.getActiveMembership(chatId, user);
    if (!membership) {
      return { message: 'Kompaniya tanlanmagan. /kompaniya' };
    }

    try {
      await this.payrollLeave.assertPayrollModule(membership.companyId);
    } catch (e) {
      return {
        message: (e as Error).message || 'Ish haqi moduli yoqilmagan.',
      };
    }

    if (text.trim() === MENU_LEAVE_PENDING) {
      if (!this.canReviewLeave(membership.role)) {
        return { message: 'Bu bo‘lim faqat owner va menejer uchun.' };
      }
      const { count } = await this.payrollLeave.countPendingLeave(
        membership.companyId,
        user.id,
      );
      const list = await this.payrollLeave.listLeaveRequests(
        membership.companyId,
        user.id,
        { status: 'PENDING' },
      );
      if (!list.length) {
        return {
          message: count > 0 ? `Kutilayotgan: ${count}` : 'Kutilayotgan dam olish so‘rovi yo‘q.',
        };
      }
      const lines = list.slice(0, 8).map((r) => {
        const name = r.companyUser.user.fullName;
        const from = formatDateOnlyUz(r.startDate);
        const to = formatDateOnlyUz(r.endDate);
        return `• ${name}: ${r.daysCount} kun (${from} — ${to})`;
      });
      return {
        message: [
          `📋 Kutilayotgan so‘rovlar: ${list.length}`,
          '',
          ...lines,
          '',
          'Tasdiqlash/rad — bildirishnomadagi tugmalar yoki veb-ilova.',
        ].join('\n'),
      };
    }

    if (!this.canRequestLeave(membership.role)) {
      return {
        message:
          'Dam olish so‘rovi faqat xodimlar uchun (oddiy ishchi, omborchi, sotuvchi va h.k.).',
      };
    }

    return {
      message: [
        '🏖 Dam olish muddati',
        '',
        'Necha kun dam olmoqchisiz?',
      ].join('\n'),
      extra: this.leaveDaysKeyboard(),
    };
  }

  async handleLeaveCallback(
    chatId: string,
    data: string,
    userId: string,
  ): Promise<{ toast: string; message?: string; markup?: any }> {
    if (data === 'lr:cancel') {
      return { toast: 'Bekor qilindi', message: 'Dam olish so‘rovi bekor qilindi.' };
    }

    const user = await this.botContext.findLinkedUser(chatId);
    if (!user) {
      return { toast: 'Ulanmagan', message: 'Avval telefonni ulang.' };
    }
    const membership = this.botContext.getActiveMembership(chatId, user);
    if (!membership) {
      return { toast: 'Kompaniya yo‘q', message: '/kompaniya — kompaniya tanlang.' };
    }

    if (data.startsWith('lr:d:')) {
      const days = Number(data.slice(5));
      if (!Number.isFinite(days) || days < 1) {
        return { toast: 'Xato', message: 'Noto‘g‘ri kun soni.' };
      }
      return {
        toast: 'Tanlandi',
        message: `${days} kun — boshlanish sanasini tanlang:`,
        markup: this.leaveStartKeyboard(days),
      };
    }

    if (data.startsWith('lr:s:')) {
      const parts = data.split(':');
      const days = Number(parts[2]);
      const offset = Number(parts[3]);
      if (!Number.isFinite(days) || days < 1 || !Number.isFinite(offset)) {
        return { toast: 'Xato', message: 'Noto‘g‘ri ma’lumot.' };
      }

      const start = addDaysUtc(toDateOnlyUtc(new Date()), offset);
      const end = addDaysUtc(start, days - 1);

      try {
        const created = await this.payrollLeave.createLeaveFromBot(
          membership.companyId,
          userId,
          days,
          offset,
        );
        return {
          toast: 'Yuborildi',
          message: [
            '✅ Dam olish so‘rovi yuborildi.',
            `📅 ${formatDateOnlyUz(start)} — ${formatDateOnlyUz(end)} (${days} kun)`,
            '',
            'Owner va menejerga xabar borildi. Tasdiqlangach tizimda qayd etiladi.',
            `ID: ${created.id.slice(0, 8)}…`,
          ].join('\n'),
        };
      } catch (e) {
        return {
          toast: 'Xatolik',
          message: `❗️ ${(e as Error).message}`,
        };
      }
    }

    return { toast: 'Noma’lum', message: 'Amal topilmadi.' };
  }
}
