import { Injectable } from '@nestjs/common';
import { Markup } from 'telegraf';
import { PayrollDataService } from '../payroll/payroll-data.service';
import { PayrollLeaveService } from '../payroll/payroll-leave.service';
import {
  TelegramBotContextService,
  TelegramBotUser,
} from './telegram-bot-context.service';
import {
  computeEffectiveSalaryCap,
  computeWorkedDaysForSalaryCap,
} from '../payroll/payroll-calculation.util';
import {
  countLeaveWeekdaysInMonth,
  formatDateOnlyUz,
} from '../payroll/payroll-work-days.util';

export const MENU_PAYROLL_EMPLOYEES = '👥 Xodimlar oylik';

const PAYROLL_MANAGER_ROLES = new Set(['OWNER', 'MANAGER']);
const MONTH_UZ = [
  'Yanvar',
  'Fevral',
  'Mart',
  'Aprel',
  'May',
  'Iyun',
  'Iyul',
  'Avgust',
  'Sentabr',
  'Oktabr',
  'Noyabr',
  'Dekabr',
];

type PayrollSession =
  | {
      step: 'advance_amount';
      companyUserId: string;
      year: number;
      month: number;
      maxAmount: number;
    }
  | {
      step: 'bonus_amount';
      companyUserId: string;
      year: number;
      month: number;
    };

@Injectable()
export class TelegramPayrollBotService {
  private readonly sessions = new Map<string, PayrollSession>();

  constructor(
    private readonly payrollData: PayrollDataService,
    private readonly payrollLeave: PayrollLeaveService,
    private readonly botContext: TelegramBotContextService,
  ) {}

  isPayrollMenuButton(text: string) {
    return text.trim() === MENU_PAYROLL_EMPLOYEES;
  }

  isPayrollCallback(data: string) {
    return data.startsWith('pr:');
  }

  canManagePayroll(role: string) {
    return PAYROLL_MANAGER_ROLES.has(String(role || '').toUpperCase());
  }

  private currentYearMonth() {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }

  private formatMoney(n: number) {
    return `${Math.round(n).toLocaleString('uz-UZ')} so'm`;
  }

  private monthLabel(year: number, month: number) {
    return `${MONTH_UZ[month - 1] ?? month} ${year}`;
  }

  private clearSession(chatId: string) {
    this.sessions.delete(chatId);
  }

  private async resolveMembership(chatId: string, linkedUser?: TelegramBotUser | null) {
    const user = linkedUser ?? (await this.botContext.findLinkedUser(chatId));
    if (!user) return { error: 'Avval telefon orqali ulaning — «Ulanish» tugmasi.' as const };
    const membership = this.botContext.getActiveMembership(chatId, user);
    if (!membership) return { error: '/kompaniya — kompaniya tanlang.' as const };
    if (!this.canManagePayroll(membership.role)) {
      return { error: 'Bu bo‘lim faqat owner va menejer uchun.' as const };
    }
    try {
      await this.payrollLeave.assertPayrollModule(membership.companyId);
    } catch (e) {
      return { error: (e as Error).message || 'Ish haqi moduli yoqilmagan.' };
    }
    return { user, membership };
  }

  async handlePayrollMenu(
    chatId: string,
  ): Promise<{ message: string; extra?: { reply_markup?: any } }> {
    const ctx = await this.resolveMembership(chatId);
    if ('error' in ctx) return { message: ctx.error };

    this.clearSession(chatId);
    const members = await this.payrollLeave.listCompanyMembers(ctx.membership.companyId);
    if (!members.length) {
      return {
        message: 'Oylik ro‘yxatida xodim yo‘q. Veb-ilovada «Mavjud xodimni qo‘shish» dan foydalaning.',
      };
    }

    const { year, month } = this.currentYearMonth();
    return {
      message: [
        `👥 Xodimlar — ${this.monthLabel(year, month)}`,
        '',
        'Xodimni tanlang:',
      ].join('\n'),
      extra: this.employeeListKeyboard(members, 0),
    };
  }

  private employeeListKeyboard(members: Array<{ id: string; user: { fullName: string } }>, page: number) {
    const pageSize = 8;
    const start = page * pageSize;
    const slice = members.slice(start, start + pageSize);
    const rows = slice.map((m) => [
      Markup.button.callback(
        m.user.fullName.slice(0, 38),
        `pr:e:${m.id}`,
      ),
    ]);
    const nav: ReturnType<typeof Markup.button.callback>[] = [];
    if (start > 0) nav.push(Markup.button.callback('◀️', `pr:p:${page - 1}`));
    if (start + pageSize < members.length) {
      nav.push(Markup.button.callback('▶️', `pr:p:${page + 1}`));
    }
    if (nav.length) rows.push(nav);
    rows.push([Markup.button.callback('❌ Yopish', 'pr:cancel')]);
    return Markup.inlineKeyboard(rows);
  }

  private leaveSummary(
    leaves: Array<{ startDate: Date; endDate: Date }>,
    year: number,
    month: number,
  ) {
    let leaveDays = 0;
    const leaveLines: string[] = [];
    for (const leave of leaves) {
      const days = countLeaveWeekdaysInMonth(
        leave.startDate,
        leave.endDate,
        year,
        month,
      );
      leaveDays += days;
      leaveLines.push(
        `  • ${formatDateOnlyUz(leave.startDate)} — ${formatDateOnlyUz(leave.endDate)} (${days} kun)`,
      );
    }
    return { leaveDays, leaveLines };
  }

  private async loadEmployeePayrollState(companyId: string, companyUserId: string) {
    const { year, month } = this.currentYearMonth();

    const [member, comp, advancesTotal, settlement, leaves, profile, workMonth] =
      await Promise.all([
        this.payrollLeave.getRosterMember(companyId, companyUserId),
        this.payrollData.getActiveCompensation(companyId, companyUserId),
        this.payrollData.sumAdvances(companyId, companyUserId, year, month),
        this.payrollData.getSettlement(companyId, companyUserId, year, month, 0),
        this.payrollLeave.listApprovedLeaveDays(
          companyId,
          companyUserId,
          year,
          month,
        ),
        this.payrollLeave.getPayrollProfile(companyId, companyUserId),
        this.payrollLeave.getWorkMonthForBot(companyId, companyUserId, year, month),
      ]);

    const baseSalary = comp?.baseSalary ?? 0;
    const currency = comp?.currency ?? 'UZS';
    const bonus = settlement.bonus ?? 0;
    const paidQuota = profile.monthlyPaidLeaveQuota ?? 0;
    const { leaveDays, leaveLines } = this.leaveSummary(leaves, year, month);
    const excessLeave = Math.max(0, leaveDays - paidQuota);
    const workedForCap = computeWorkedDaysForSalaryCap({
      totalDays: workMonth.totalDays,
      workedDaysFromRecord: workMonth.workedDays,
      excessLeaveDays: excessLeave,
      isManual: workMonth.isManual,
      workedDaysMode: workMonth.workedDaysMode,
    });
    const salaryCap = computeEffectiveSalaryCap(
      baseSalary,
      workMonth.totalDays,
      workedForCap,
    );
    const salaryClosed =
      baseSalary > 0 && advancesTotal >= salaryCap && salaryCap > 0;

    return {
      year,
      month,
      member,
      baseSalary,
      currency,
      advancesTotal,
      bonus,
      leaveDays,
      leaveLines,
      paidQuota,
      salaryCap,
      salaryClosed,
      profile,
    };
  }

  private async buildEmployeeCard(companyId: string, companyUserId: string) {
    const state = await this.loadEmployeePayrollState(companyId, companyUserId);
    const {
      year,
      month,
      member: row,
      baseSalary,
      currency,
      advancesTotal,
      bonus,
      leaveDays,
      leaveLines,
      paidQuota,
      salaryCap,
      salaryClosed,
      profile,
    } = state;

    const position = profile.position?.trim() || '—';
    const department = profile.department?.trim() || '—';

    const lines = [
      `👤 ${row.user.fullName}`,
      `📌 ${position} · ${department}`,
      '',
      `💰 Oylik: ${this.formatMoney(baseSalary)}${currency !== 'UZS' ? ` (${currency})` : ''}`,
      `📅 ${this.monthLabel(year, month)}`,
      `• Avanslar: ${this.formatMoney(advancesTotal)}`,
      bonus > 0 ? `• Bonus: ${this.formatMoney(bonus)}` : null,
      `• Dam olish (tasdiq): ${leaveDays} kun${paidQuota > 0 ? ` / limit ${paidQuota}` : ''}`,
      leaveLines.length
        ? ['', 'Dam olish sanalari:', ...leaveLines.slice(0, 5)]
        : null,
      leaveLines.length > 5 ? `  … va yana ${leaveLines.length - 5} ta` : null,
      '',
      salaryClosed
        ? '✅ Oylik to‘liq to‘langan (avanslar limitga yetdi)'
        : baseSalary > 0
          ? `📊 Avans qoldiq: ${this.formatMoney(Math.max(0, salaryCap - advancesTotal))}`
          : '⚠️ Oylik maosh belgilanmagan',
    ]
      .flat()
      .filter(Boolean) as string[];

    return {
      message: lines.join('\n'),
      markup: this.employeeDetailKeyboard(companyUserId, baseSalary > 0, salaryClosed),
      salaryCap,
      advancesTotal,
      baseSalary,
    };
  }

  private employeeDetailKeyboard(
    companyUserId: string,
    hasSalary: boolean,
    salaryClosed: boolean,
  ) {
    const rows: ReturnType<typeof Markup.button.callback>[][] = [];
    if (hasSalary && !salaryClosed) {
      rows.push([
        Markup.button.callback('💵 Avans/To‘lov', `pr:a:${companyUserId}`),
      ]);
    }
    if (hasSalary) {
      rows.push([Markup.button.callback('🎁 Bonus', `pr:b:${companyUserId}`)]);
    }
    rows.push([
      Markup.button.callback('◀️ Ro‘yxat', 'pr:list'),
      Markup.button.callback('❌', 'pr:cancel'),
    ]);
    return Markup.inlineKeyboard(rows);
  }

  async handleCallback(
    chatId: string,
    data: string,
    actorUserId: string,
    linkedUser?: TelegramBotUser | null,
  ): Promise<{ toast: string; message?: string; markup?: any }> {
    if (data === 'pr:cancel') {
      this.clearSession(chatId);
      return { toast: 'Yopildi', message: 'Amal bekor qilindi.' };
    }

    if (data === 'pr:list') {
      return this.handlePayrollMenuAsCallback(chatId);
    }

    const ctx = await this.resolveMembership(chatId, linkedUser);
    if ('error' in ctx) {
      return { toast: 'Xato', message: ctx.error };
    }

    if (data.startsWith('pr:p:')) {
      const page = Number(data.slice(5)) || 0;
      const members = await this.payrollLeave.listCompanyMembers(ctx.membership.companyId);
      const { year, month } = this.currentYearMonth();
      return {
        toast: 'Sahifa',
        message: `👥 Xodimlar — ${this.monthLabel(year, month)}`,
        markup: this.employeeListKeyboard(members, page),
      };
    }

    if (data.startsWith('pr:e:')) {
      const companyUserId = data.slice(5);
      try {
        const card = await this.buildEmployeeCard(
          ctx.membership.companyId,
          companyUserId,
        );
        return { toast: 'Xodim', message: card.message, markup: card.markup };
      } catch (e) {
        return { toast: 'Xato', message: (e as Error).message };
      }
    }

    if (data.startsWith('pr:a:')) {
      const companyUserId = data.slice(5);
      try {
        const state = await this.loadEmployeePayrollState(
          ctx.membership.companyId,
          companyUserId,
        );
        const remaining = Math.max(0, state.salaryCap - state.advancesTotal);
        const markup = this.employeeDetailKeyboard(
          companyUserId,
          state.baseSalary > 0,
          state.salaryClosed,
        );
        if (remaining <= 0) {
          return {
            toast: 'To‘langan',
            message: 'Oylik allaqachon to‘liq to‘langan.',
            markup,
          };
        }
        this.sessions.set(chatId, {
          step: 'advance_amount',
          companyUserId,
          year: state.year,
          month: state.month,
          maxAmount: remaining,
        });
        return {
          toast: 'Avans',
          message: [
            '💵 Avans / oylik to‘lov',
            '',
            `Maksimal: ${this.formatMoney(remaining)}`,
            'Summani yozing (faqat raqam, masalan 500000):',
            '',
            'Bekor: /bekor',
          ].join('\n'),
        };
      } catch (e) {
        return { toast: 'Xato', message: (e as Error).message };
      }
    }

    if (data.startsWith('pr:b:')) {
      const companyUserId = data.slice(5);
      const { year, month } = this.currentYearMonth();
      this.sessions.set(chatId, {
        step: 'bonus_amount',
        companyUserId,
        year,
        month,
      });
      return {
        toast: 'Bonus',
        message: [
          '🎁 Bonus berish',
          '',
          'Summani yozing (faqat raqam):',
          'Bekor: /bekor',
        ].join('\n'),
      };
    }

    return { toast: 'Noma’lum', message: 'Amal topilmadi.' };
  }

  private async handlePayrollMenuAsCallback(chatId: string) {
    const r = await this.handlePayrollMenu(chatId);
    return { toast: 'Ro‘yxat', message: r.message, markup: r.extra };
  }

  async handleText(
    chatId: string,
    text: string,
    actorUserId: string,
  ): Promise<{ handled: boolean; reply: string; markup?: any }> {
    const session = this.sessions.get(chatId);
    if (!session) return { handled: false, reply: '' };

    const ctx = await this.resolveMembership(chatId);
    if ('error' in ctx) {
      this.clearSession(chatId);
      return { handled: true, reply: ctx.error };
    }

    const amount = Math.round(
      Number(text.replace(/\s/g, '').replace(/,/g, '.')),
    );
    if (!Number.isFinite(amount) || amount <= 0) {
      return {
        handled: true,
        reply: 'Noto‘g‘ri summa. Faqat musbat raqam kiriting.',
      };
    }

    if (session.step === 'advance_amount') {
      if (amount > session.maxAmount) {
        return {
          handled: true,
          reply: `Limitdan oshdi. Maksimal: ${this.formatMoney(session.maxAmount)}`,
        };
      }
      try {
        const result = await this.payrollData.addAdvance(
          ctx.membership.companyId,
          actorUserId,
          {
            companyUserId: session.companyUserId,
            year: session.year,
            month: session.month,
            amount,
            reason: 'Telegram bot orqali avans',
          },
        );
        this.clearSession(chatId);
        const paid =
          result.paymentCompleted === true
            ? '\n\n✅ Oylik to‘liq to‘langan deb belgilandi.'
            : '';
        return {
          handled: true,
          reply: `✅ Avans saqlandi: ${this.formatMoney(amount)}${paid}`,
        };
      } catch (e) {
        return { handled: true, reply: `❗️ ${(e as Error).message}` };
      }
    }

    if (session.step === 'bonus_amount') {
      try {
        const result = await this.payrollData.addBonus(
          ctx.membership.companyId,
          actorUserId,
          {
            companyUserId: session.companyUserId,
            year: session.year,
            month: session.month,
            amount,
            reason: 'Telegram bot orqali bonus',
          },
        );
        this.clearSession(chatId);
        return {
          handled: true,
          reply: `✅ Bonus qo‘shildi: ${this.formatMoney(amount)}\nJami bonus (oy): ${this.formatMoney(result.bonusTotal)}`,
        };
      } catch (e) {
        return { handled: true, reply: `❗️ ${(e as Error).message}` };
      }
    }

    return { handled: false, reply: '' };
  }

  cancelSession(chatId: string) {
    return this.sessions.delete(chatId);
  }
}
