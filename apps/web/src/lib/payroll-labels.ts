import type { PayrollLineType, PayrollPeriodStatus, PayrollRunStatus } from '@/lib/payroll-types';

export const PERIOD_STATUS_LABEL: Record<PayrollPeriodStatus, string> = {
  DRAFT: 'Qoralama',
  CALCULATED: 'Hisoblangan',
  APPROVED: 'Tasdiqlangan',
  PAID: 'To‘langan',
  CLOSED: 'Yopilgan',
};

export const PERIOD_STATUS_STYLE: Record<PayrollPeriodStatus, string> = {
  DRAFT: 'bg-gray-500/20 text-gray-300',
  CALCULATED: 'bg-blue-500/20 text-blue-300',
  APPROVED: 'bg-emerald-500/20 text-emerald-300',
  PAID: 'bg-violet-500/20 text-violet-300',
  CLOSED: 'bg-white/10 text-gray-400',
};

export const RUN_STATUS_LABEL: Record<PayrollRunStatus, string> = {
  PENDING: 'Kutilmoqda',
  APPROVED: 'Tasdiqlangan',
  PAID: 'To‘langan',
};

export const LINE_TYPE_LABEL: Record<PayrollLineType, string> = {
  BASE: 'Asosiy oylik',
  BONUS: 'Bonus',
  PENALTY: 'Jarima',
  ADVANCE: 'Avans',
  COMMISSION: 'Komissiya',
  MANUAL: 'Qo‘lda',
};

export const PAYROLL_MONTH_NAMES = [
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

export function formatPayrollMonth(year: number, month: number) {
  return `${PAYROLL_MONTH_NAMES[month - 1] ?? month} ${year}`;
}

export function formatPayrollMonthLabel(month: number) {
  return PAYROLL_MONTH_NAMES[month - 1] ?? String(month);
}

export function formatSalaryTableAmount(amount: number) {
  return amount.toLocaleString('uz-UZ');
}

export function formatCompactPayrollTotal(amount: number) {
  if (amount >= 1_000_000_000) {
    return `${(amount / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B UZS`;
  }
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1).replace(/\.0$/, '')}M UZS`;
  }
  if (amount >= 1_000) {
    return `${Math.round(amount / 1_000)}K UZS`;
  }
  return `${amount} UZS`;
}

export function formatPayrollMoney(amount: number, currency: string) {
  return `${amount.toLocaleString('uz-UZ')} ${currency}`;
}

export function sumByCurrency(totals: Record<string, number> | undefined, currency: string) {
  return totals?.[currency] ?? 0;
}
