import { countWeekdaysInMonth, computeFinalPayrollPayment } from '@/lib/payroll-calculation';
import { LOCAL_PAYROLL_ID_PREFIX } from '@/lib/payroll-employees';
import { countWeekdaysInDateKeys, parseDateKey } from '@/lib/payroll-leave-dates.util';
import type {
  CompanyMemberRef,
  EmployeeCompensation,
  PayrollAdvance,
  PayrollCurrency,
  PayrollEmployeeCalculation,
  PayrollEmployeeExtra,
  PayrollEmployeeProfile,
  EmployeeLeavePlan,
  PayrollLine,
  PayrollLineType,
  PayrollPeriod,
  PayrollPeriodStatus,
  PayrollRun,
  PayrollSummary,
} from '@/lib/payroll-types';

const STORAGE_PREFIX = 'tadbirkor-payroll-v1';

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function getCompanyId(): string {
  if (typeof window === 'undefined') return 'server';
  try {
    const raw = localStorage.getItem('company');
    if (raw) {
      const company = JSON.parse(raw) as { id?: string };
      if (company.id) return company.id;
    }
  } catch {
    /* ignore */
  }
  return 'demo-company';
}

function storageKey(companyId: string) {
  return `${STORAGE_PREFIX}:${companyId}`;
}

type StoreData = {
  compensations: EmployeeCompensation[];
  periods: PayrollPeriod[];
  advances: PayrollAdvance[];
  calculations: PayrollEmployeeCalculation[];
  profiles: PayrollEmployeeProfile[];
  employeeExtras: PayrollEmployeeExtra[];
  employeeLeavePlans: EmployeeLeavePlan[];
};

function emptyStore(): StoreData {
  return {
    compensations: [],
    periods: [],
    advances: [],
    calculations: [],
    profiles: [],
    employeeExtras: [],
    employeeLeavePlans: [],
  };
}

function readStore(companyId = getCompanyId()): StoreData {
  if (typeof window === 'undefined') {
    return emptyStore();
  }
  try {
    const raw = localStorage.getItem(storageKey(companyId));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoreData>;
      return {
        ...emptyStore(),
        ...parsed,
        advances: parsed.advances ?? [],
        calculations: parsed.calculations ?? [],
        profiles: parsed.profiles ?? [],
        employeeExtras: parsed.employeeExtras ?? [],
        employeeLeavePlans: parsed.employeeLeavePlans ?? [],
      };
    }
  } catch {
    /* ignore */
  }
  return emptyStore();
}

function calcKey(companyUserId: string, year: number, month: number) {
  return `${companyUserId}:${year}:${month}`;
}

function pseudoKpi(companyUserId: string): PayrollEmployeeProfile {
  let h = 0;
  for (let i = 0; i < companyUserId.length; i++) {
    h = (h + companyUserId.charCodeAt(i) * (i + 1)) % 997;
  }
  return {
    companyUserId,
    kpiQuality: 88 + (h % 10),
    kpiDiscipline: 80 + ((h * 3) % 12),
  };
}

function writeStore(data: StoreData, companyId = getCompanyId()) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(storageKey(companyId), JSON.stringify(data));
}

function monthBounds(year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return {
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
  };
}

function recalcRunTotals(run: PayrollRun): PayrollRun {
  const baseLine = run.lines.find((l) => l.type === 'BASE');
  const baseAmount = baseLine?.amount ?? run.baseAmount ?? 0;

  let bonusAmount = 0;
  let deductionAmount = 0;
  let advanceAmount = 0;

  for (const line of run.lines) {
    if (line.type === 'BASE') continue;
    if (line.amount >= 0) {
      bonusAmount += line.amount;
    } else if (line.type === 'ADVANCE') {
      advanceAmount += Math.abs(line.amount);
    } else {
      deductionAmount += Math.abs(line.amount);
    }
  }

  const grossAmount = baseAmount + bonusAmount;
  const netAmount = grossAmount - deductionAmount - advanceAmount;

  return {
    ...run,
    baseAmount,
    bonusAmount,
    deductionAmount,
    advanceAmount,
    grossAmount,
    netAmount,
  };
}

function assertPeriodEditable(period: PayrollPeriod) {
  if (period.status === 'CLOSED' || period.status === 'PAID') {
    throw new Error('Yopilgan yoki to‘langan davrni o‘zgartirib bo‘lmaydi');
  }
}

export const payrollMockStore = {
  getCompanyId,

  listCompensations(): EmployeeCompensation[] {
    return readStore().compensations.filter((c) => c.isActive);
  },

  listAllCompensations(): EmployeeCompensation[] {
    return readStore().compensations;
  },

  upsertCompensation(payload: {
    companyUserId: string;
    employeeName: string;
    employeeRole: string;
    baseSalary: number;
    currency?: PayrollCurrency;
    effectiveFrom?: string;
  }): EmployeeCompensation {
    const store = readStore();
    const existingIdx = store.compensations.findIndex(
      (c) => c.companyUserId === payload.companyUserId && c.isActive,
    );

    const row: EmployeeCompensation = {
      id: existingIdx >= 0 ? store.compensations[existingIdx].id : uid(),
      companyUserId: payload.companyUserId,
      employeeName: payload.employeeName,
      employeeRole: payload.employeeRole,
      baseSalary: payload.baseSalary,
      currency: payload.currency ?? 'UZS',
      effectiveFrom: payload.effectiveFrom ?? new Date().toISOString().slice(0, 10),
      isActive: true,
    };

    if (existingIdx >= 0) {
      store.compensations[existingIdx] = row;
    } else {
      store.compensations.push(row);
    }

    writeStore(store);
    return row;
  },

  listPeriods(): PayrollPeriod[] {
    return readStore()
      .periods.sort((a, b) => b.year - a.year || b.month - a.month);
  },

  getPeriod(id: string): PayrollPeriod | null {
    return readStore().periods.find((p) => p.id === id) ?? null;
  },

  createPeriod(year: number, month: number, notes?: string): PayrollPeriod {
    const store = readStore();
    if (store.periods.some((p) => p.year === year && p.month === month)) {
      throw new Error('Bu oy uchun davr allaqachon mavjud');
    }
    if (month < 1 || month > 12) {
      throw new Error('Oy 1–12 oralig‘ida bo‘lishi kerak');
    }

    const bounds = monthBounds(year, month);
    const period: PayrollPeriod = {
      id: uid(),
      year,
      month,
      status: 'DRAFT',
      ...bounds,
      notes: notes?.trim() || null,
      runs: [],
    };

    store.periods.push(period);
    writeStore(store);
    return period;
  },

  calculatePeriod(periodId: string, members: CompanyMemberRef[]): PayrollPeriod {
    const store = readStore();
    const idx = store.periods.findIndex((p) => p.id === periodId);
    if (idx < 0) throw new Error('Davr topilmadi');

    const period = store.periods[idx];
    assertPeriodEditable(period);

    const compensations = store.compensations.filter((c) => c.isActive);
    const compByMember = new Map(compensations.map((c) => [c.companyUserId, c]));

    const existingAdjustments = new Map<string, PayrollLine[]>();
    for (const run of period.runs) {
      const manual = run.lines.filter((l) => l.type !== 'BASE');
      if (manual.length) existingAdjustments.set(run.companyUserId, manual);
    }

    const runs: PayrollRun[] = members
      .filter((m) => m.role !== 'OWNER')
      .map((member) => {
        const comp = compByMember.get(member.id);
        const currency = comp?.currency ?? 'UZS';
        const baseSalary = comp?.baseSalary ?? 0;
        const prev = period.runs.find((r) => r.companyUserId === member.id);
        const manualLines = existingAdjustments.get(member.id) ?? [];

        const lines: PayrollLine[] = [
          {
            id: uid(),
            type: 'BASE',
            label: 'Asosiy oylik',
            amount: baseSalary,
          },
          ...manualLines.map((l) => ({ ...l, id: l.id || uid() })),
        ];

        const run = recalcRunTotals({
          id: prev?.id ?? uid(),
          periodId: period.id,
          companyUserId: member.id,
          employeeName: member.user.fullName,
          employeeRole: member.role,
          baseAmount: baseSalary,
          bonusAmount: 0,
          deductionAmount: 0,
          advanceAmount: 0,
          grossAmount: baseSalary,
          netAmount: baseSalary,
          currency,
          status: prev?.status ?? 'PENDING',
          lines,
        });

        return run;
      });

    store.periods[idx] = {
      ...period,
      runs,
      status: 'CALCULATED',
      calculatedAt: new Date().toISOString(),
    };

    writeStore(store);
    return store.periods[idx];
  },

  addAdjustment(
    periodId: string,
    runId: string,
    payload: { type: PayrollLineType; label: string; amount: number },
  ): PayrollRun {
    const store = readStore();
    const periodIdx = store.periods.findIndex((p) => p.id === periodId);
    if (periodIdx < 0) throw new Error('Davr topilmadi');

    const period = store.periods[periodIdx];
    assertPeriodEditable(period);

    const runIdx = period.runs.findIndex((r) => r.id === runId);
    if (runIdx < 0) throw new Error('Xodim qatori topilmadi');

    const run = period.runs[runIdx];
    const line: PayrollLine = {
      id: uid(),
      type: payload.type,
      label: payload.label.trim() || LINE_TYPE_FALLBACK[payload.type],
      amount: payload.amount,
    };

    const updated = recalcRunTotals({
      ...run,
      lines: [...run.lines, line],
    });

    period.runs[runIdx] = updated;
    if (period.status === 'DRAFT') {
      period.status = 'CALCULATED';
      period.calculatedAt = new Date().toISOString();
    }

    store.periods[periodIdx] = { ...period, runs: [...period.runs] };
    writeStore(store);
    return updated;
  },

  approvePeriod(periodId: string): PayrollPeriod {
    const store = readStore();
    const idx = store.periods.findIndex((p) => p.id === periodId);
    if (idx < 0) throw new Error('Davr topilmadi');

    const period = store.periods[idx];
    if (period.status !== 'CALCULATED') {
      throw new Error('Avval hisoblash kerak');
    }
    if (!period.runs.length) {
      throw new Error('Xodimlar ro‘yxati bo‘sh');
    }

    store.periods[idx] = {
      ...period,
      status: 'APPROVED',
      approvedAt: new Date().toISOString(),
      runs: period.runs.map((r) => ({ ...r, status: 'APPROVED' as const })),
    };

    writeStore(store);
    return store.periods[idx];
  },

  markPeriodPaid(periodId: string): PayrollPeriod {
    const store = readStore();
    const idx = store.periods.findIndex((p) => p.id === periodId);
    if (idx < 0) throw new Error('Davr topilmadi');

    const period = store.periods[idx];
    if (period.status !== 'APPROVED') {
      throw new Error('Avval tasdiqlash kerak');
    }

    store.periods[idx] = {
      ...period,
      status: 'PAID',
      paidAt: new Date().toISOString(),
      runs: period.runs.map((r) => ({ ...r, status: 'PAID' as const })),
    };

    writeStore(store);
    return store.periods[idx];
  },

  closePeriod(periodId: string): PayrollPeriod {
    const store = readStore();
    const idx = store.periods.findIndex((p) => p.id === periodId);
    if (idx < 0) throw new Error('Davr topilmadi');

    const period = store.periods[idx];
    if (period.status !== 'PAID') {
      throw new Error('Faqat to‘langan davr yopiladi');
    }

    store.periods[idx] = { ...period, status: 'CLOSED' };
    writeStore(store);
    return store.periods[idx];
  },

  getSummary(): PayrollSummary {
    const periods = readStore().periods;
    const byStatus = {
      DRAFT: 0,
      CALCULATED: 0,
      APPROVED: 0,
      PAID: 0,
      CLOSED: 0,
    } satisfies Record<PayrollPeriodStatus, number>;

    const totalGross: Record<string, number> = { UZS: 0, USD: 0 };
    const totalNet: Record<string, number> = { UZS: 0, USD: 0 };
    let employeeCount = 0;

    for (const period of periods) {
      byStatus[period.status] += 1;
      if (!['CALCULATED', 'APPROVED', 'PAID', 'CLOSED'].includes(period.status)) continue;
      for (const run of period.runs) {
        employeeCount += 1;
        totalGross[run.currency] = (totalGross[run.currency] || 0) + run.grossAmount;
        totalNet[run.currency] = (totalNet[run.currency] || 0) + run.netAmount;
      }
    }

    return { employeeCount, totalGross, totalNet, byStatus };
  },

  listEmployeeExtras(): PayrollEmployeeExtra[] {
    return readStore().employeeExtras;
  },

  /** API ishlamaganda — mockdagi kompensatsiya/extra dan xodimlar ro‘yxati */
  buildFallbackMembers(): Array<{
    id: string;
    role: string;
    createdAt?: string;
    user: { id: string; fullName: string; login: string; status?: string };
    warehouse?: { id: string; name: string } | null;
  }> {
    const store = readStore();
    const ids = new Set<string>();
    for (const c of store.compensations) ids.add(c.companyUserId);
    for (const e of store.employeeExtras) ids.add(e.companyUserId);
    return Array.from(ids).map((id) => {
      const extra = store.employeeExtras.find((e) => e.companyUserId === id);
      const comp = store.compensations.find((c) => c.companyUserId === id);
      const fullName =
        [extra?.firstName, extra?.lastName].filter(Boolean).join(' ') ||
        comp?.employeeName ||
        'Xodim';
      return {
        id,
        role: extra?.role || comp?.employeeRole || 'WORKER',
        user: {
          id,
          fullName,
          login: extra?.phone || id.slice(0, 8),
        },
      };
    });
  },

  getEmployeeExtra(companyUserId: string): PayrollEmployeeExtra | null {
    return readStore().employeeExtras.find((e) => e.companyUserId === companyUserId) ?? null;
  },

  markEmployeeLeft(companyUserId: string, leftAt: string) {
    const existing = this.getEmployeeExtra(companyUserId);
    return this.saveEmployeeExtra({
      companyUserId,
      ...existing,
      leftAt,
      employmentStatus: 'LEFT',
    });
  },

  saveEmployeeExtra(payload: PayrollEmployeeExtra): PayrollEmployeeExtra {
    const store = readStore();
    const idx = store.employeeExtras.findIndex(
      (e) => e.companyUserId === payload.companyUserId,
    );
    const row = { ...payload };
    if (idx >= 0) store.employeeExtras[idx] = row;
    else store.employeeExtras.push(row);
    writeStore(store);
    return row;
  },

  saveLeavePlan(payload: EmployeeLeavePlan): EmployeeLeavePlan {
    const store = readStore();
    const idx = store.employeeLeavePlans.findIndex(
      (p) =>
        p.companyUserId === payload.companyUserId &&
        p.year === payload.year &&
        p.month === payload.month,
    );
    const row = { ...payload, dates: [...payload.dates].sort() };
    if (idx >= 0) store.employeeLeavePlans[idx] = row;
    else store.employeeLeavePlans.push(row);
    writeStore(store);
    return row;
  },

  getLeavePlan(companyUserId: string, year: number, month: number) {
    return (
      readStore().employeeLeavePlans.find(
        (p) =>
          p.companyUserId === companyUserId && p.year === year && p.month === month,
      ) ?? null
    );
  },

  createLocalEmployee(payload: {
    firstName: string;
    lastName: string;
    position: string;
    department: string;
    role: string;
    phone: string;
    address: string;
    notes?: string;
    baseSalary: number;
    currency?: PayrollCurrency;
    monthlyPaidLeaveQuota?: number;
  }): { companyUserId: string } {
    const companyUserId = `${LOCAL_PAYROLL_ID_PREFIX}${uid()}`;
    const employeeName = `${payload.firstName} ${payload.lastName}`.trim();
    this.upsertCompensation({
      companyUserId,
      employeeName,
      employeeRole: payload.role,
      baseSalary: payload.baseSalary,
      currency: payload.currency,
    });
    this.saveEmployeeExtra({
      companyUserId,
      firstName: payload.firstName,
      lastName: payload.lastName,
      position: payload.position,
      department: payload.department,
      address: payload.address,
      notes: payload.notes,
      phone: payload.phone,
      role: payload.role,
      createdAt: new Date().toISOString(),
      monthlyPaidLeaveQuota: payload.monthlyPaidLeaveQuota ?? 0,
    });
    return { companyUserId };
  },

  getEmployeeProfile(companyUserId: string): PayrollEmployeeProfile {
    const store = readStore();
    const found = store.profiles.find((p) => p.companyUserId === companyUserId);
    if (found) return found;
    const profile = pseudoKpi(companyUserId);
    store.profiles.push(profile);
    writeStore(store);
    return profile;
  },

  listAdvances(companyUserId: string, year: number, month: number): PayrollAdvance[] {
    return readStore()
      .advances.filter(
        (a) =>
          a.companyUserId === companyUserId && a.year === year && a.month === month,
      )
      .sort((a, b) => b.advanceDate.localeCompare(a.advanceDate));
  },

  getAdvancesTotal(companyUserId: string, year: number, month: number) {
    return this.listAdvances(companyUserId, year, month).reduce(
      (acc, a) => acc + a.amount,
      0,
    );
  },

  addAdvance(payload: {
    companyUserId: string;
    year: number;
    month: number;
    amount: number;
    reason: string;
    advanceDate?: string;
    maxBaseSalary?: number;
  }): PayrollAdvance {
    const store = readStore();
    if (payload.maxBaseSalary != null && payload.maxBaseSalary > 0) {
      const current = this.getAdvancesTotal(
        payload.companyUserId,
        payload.year,
        payload.month,
      );
      const remaining = payload.maxBaseSalary - current;
      if (remaining <= 0) {
        throw new Error('Oylik qoplandi — qo‘shimcha avans berib bo‘lmaydi');
      }
      if (payload.amount > remaining) {
        throw new Error(
          `Avans limiti: maksimal ${remaining.toLocaleString('uz-UZ')} UZS`,
        );
      }
    }
    const row: PayrollAdvance = {
      id: uid(),
      companyUserId: payload.companyUserId,
      year: payload.year,
      month: payload.month,
      amount: payload.amount,
      reason: payload.reason.trim() || 'Avans',
      advanceDate: payload.advanceDate ?? new Date().toISOString().slice(0, 10),
    };
    store.advances.push(row);
    writeStore(store);

    const cap =
      payload.maxBaseSalary != null && payload.maxBaseSalary > 0
        ? payload.maxBaseSalary
        : 0;
    const newTotal = this.getAdvancesTotal(
      payload.companyUserId,
      payload.year,
      payload.month,
    );
    if (cap > 0 && newTotal >= cap) {
      const comp = store.compensations.find(
        (c) => c.companyUserId === payload.companyUserId && c.isActive,
      );
      const baseSalary = comp?.baseSalary ?? cap;
      const calc = this.getCalculation(
        payload.companyUserId,
        payload.year,
        payload.month,
        baseSalary,
      );
      this.saveCalculation({
        ...calc,
        baseSalary,
        paymentConfirmedAt: new Date().toISOString(),
      });
    }

    return row;
  },

  getCalculation(
    companyUserId: string,
    year: number,
    month: number,
    defaultBaseSalary = 0,
  ): PayrollEmployeeCalculation {
    const store = readStore();
    const key = calcKey(companyUserId, year, month);
    const existing = store.calculations.find(
      (c) => calcKey(c.companyUserId, c.year, c.month) === key,
    );
    if (existing) return existing;

    const totalDays = countWeekdaysInMonth(year, month);
    const workedDays = Math.max(totalDays - 1, 1);

    const draft: PayrollEmployeeCalculation = {
      companyUserId,
      year,
      month,
      baseSalary: defaultBaseSalary,
      totalDays,
      workedDays,
      bonus: 0,
      penalties: 0,
    };
    store.calculations.push(draft);
    writeStore(store);
    return draft;
  },

  saveCalculation(payload: PayrollEmployeeCalculation): PayrollEmployeeCalculation {
    const store = readStore();
    const key = calcKey(payload.companyUserId, payload.year, payload.month);
    const idx = store.calculations.findIndex(
      (c) => calcKey(c.companyUserId, c.year, c.month) === key,
    );
    const row = { ...payload };
    if (idx >= 0) store.calculations[idx] = row;
    else store.calculations.push(row);
    writeStore(store);
    return row;
  },

  getMonthStats(year: number, month: number, companyUserIds: string[]) {
    const store = readStore();
    const idSet = new Set(companyUserIds);

    let totalBaseSalaryUZS = 0;
    let totalBaseSalaryUSD = 0;
    for (const c of store.compensations) {
      if (!c.isActive || !idSet.has(c.companyUserId)) continue;
      if (c.currency === 'USD') totalBaseSalaryUSD += c.baseSalary;
      else totalBaseSalaryUZS += c.baseSalary;
    }

    let totalAdvancesUZS = 0;
    for (const a of store.advances) {
      if (a.year === year && a.month === month && idSet.has(a.companyUserId)) {
        totalAdvancesUZS += a.amount;
      }
    }

    const advancesByUser: Record<string, number> = {};
    const leaveDaysByUser: Record<string, number> = {};
    const paidAmountByUser: Record<string, number> = {};
    const paymentConfirmedByUser: Record<string, boolean> = {};
    for (const id of companyUserIds) {
      advancesByUser[id] = 0;
      leaveDaysByUser[id] = 0;
      paidAmountByUser[id] = 0;
      paymentConfirmedByUser[id] = false;
    }
    for (const a of store.advances) {
      if (a.year === year && a.month === month && idSet.has(a.companyUserId)) {
        advancesByUser[a.companyUserId] =
          (advancesByUser[a.companyUserId] || 0) + a.amount;
      }
    }

    for (const id of companyUserIds) {
      const plan = this.getLeavePlan(id, year, month);
      if (!plan?.dates?.length) continue;
      const inMonth = plan.dates.filter((key) => {
        const p = parseDateKey(key);
        return p.year === year && p.month === month;
      });
      leaveDaysByUser[id] = countWeekdaysInDateKeys(inMonth);
    }

    let totalPaidUZS = 0;
    let paidEmployeeCount = 0;
    for (const calc of store.calculations) {
      if (calc.year !== year || calc.month !== month || !idSet.has(calc.companyUserId)) {
        continue;
      }
      if (!calc.paymentConfirmedAt) continue;
      paymentConfirmedByUser[calc.companyUserId] = true;
      const advancesTotal = advancesByUser[calc.companyUserId] || 0;
      paidAmountByUser[calc.companyUserId] = advancesTotal;
      totalPaidUZS += advancesTotal;
      paidEmployeeCount += 1;
    }

    for (const id of companyUserIds) {
      if (paymentConfirmedByUser[id]) continue;
      const advancesTotal = advancesByUser[id] || 0;
      if (advancesTotal <= 0) continue;
      const comp = store.compensations.find(
        (c) => c.companyUserId === id && c.isActive,
      );
      if (!comp || comp.baseSalary <= 0) continue;
      if (advancesTotal < comp.baseSalary) continue;

      paymentConfirmedByUser[id] = true;
      paidAmountByUser[id] = advancesTotal;
      totalPaidUZS += advancesTotal;
      paidEmployeeCount += 1;

      const calc = this.getCalculation(id, year, month, comp.baseSalary);
      if (!calc.paymentConfirmedAt) {
        this.saveCalculation({
          ...calc,
          paymentConfirmedAt: new Date().toISOString(),
        });
      }
    }

    let totalOpenAdvancesUZS = 0;
    for (const id of companyUserIds) {
      if (paymentConfirmedByUser[id]) continue;
      totalOpenAdvancesUZS += advancesByUser[id] || 0;
    }

    let totalBonusUZS = 0;
    const bonusByUser: Record<string, number> = {};
    for (const id of companyUserIds) bonusByUser[id] = 0;
    for (const calc of store.calculations) {
      if (calc.year !== year || calc.month !== month || !idSet.has(calc.companyUserId)) {
        continue;
      }
      if (calc.bonus > 0) {
        bonusByUser[calc.companyUserId] = calc.bonus;
        totalBonusUZS += calc.bonus;
      }
    }

    return {
      totalBaseSalaryUZS,
      totalBaseSalaryUSD,
      totalAdvancesUZS,
      totalOpenAdvancesUZS,
      totalPaidUZS,
      totalBonusUZS,
      totalPaidIncludingBonusUZS: totalPaidUZS + totalBonusUZS,
      paidEmployeeCount,
      advancesByUser,
      leaveDaysByUser,
      paidAmountByUser,
      paymentConfirmedByUser,
      bonusByUser,
    };
  },

  addBonus(payload: {
    companyUserId: string;
    year: number;
    month: number;
    amount: number;
    reason?: string;
  }) {
    const store = readStore();
    const comp = store.compensations.find(
      (c) => c.companyUserId === payload.companyUserId && c.isActive,
    );
    if (!comp || comp.baseSalary <= 0) {
      throw new Error('Avval oylik maosh belgilang');
    }
    const calc = this.getCalculation(
      payload.companyUserId,
      payload.year,
      payload.month,
      comp.baseSalary,
    );
    const bonusTotal = (calc.bonus || 0) + payload.amount;
    this.saveCalculation({ ...calc, bonus: bonusTotal });
    return {
      companyUserId: payload.companyUserId,
      year: payload.year,
      month: payload.month,
      amountAdded: payload.amount,
      bonusTotal,
      reason: payload.reason?.trim() || null,
    };
  },

  confirmEmployeePayment(
    companyUserId: string,
    year: number,
    month: number,
    input: Omit<PayrollEmployeeCalculation, 'companyUserId' | 'year' | 'month' | 'paymentConfirmedAt'>,
  ) {
    const advancesTotal = this.getAdvancesTotal(companyUserId, year, month);
    const finalAmount = computeFinalPayrollPayment({
      baseSalary: input.baseSalary,
      totalDays: input.totalDays,
      workedDays: input.workedDays,
      bonus: input.bonus,
      penalties: input.penalties,
      advancesTotal,
    });

    const saved = this.saveCalculation({
      companyUserId,
      year,
      month,
      ...input,
      paymentConfirmedAt: new Date().toISOString(),
    });

    return { calculation: saved, finalAmount, advancesTotal };
  },
};

const LINE_TYPE_FALLBACK: Record<PayrollLineType, string> = {
  BASE: 'Asosiy oylik',
  BONUS: 'Bonus',
  PENALTY: 'Jarima',
  ADVANCE: 'Avans',
  COMMISSION: 'Komissiya',
  MANUAL: 'Qo‘lda qo‘shimcha',
};
