/**
 * Payroll servisi — asosiy ma’lumotlar backend API orqali.
 * Davrlar (periods) hozircha localStorage mock (keyingi bosqich).
 */
import { payrollMockStore } from '@/lib/payroll-mock-store';
import type {
  EmployeeCompensation,
  PayrollAdvance,
  PayrollCurrency,
  PayrollEmployeeCalculation,
  PayrollEmployeeExtra,
  PayrollEmployeeProfile,
  PayrollLineType,
  PayrollPeriod,
  PayrollRun,
  PayrollSummary,
  EmployeeLeavePlan,
} from '@/lib/payroll-types';
import { buildLocalPayrollMember, isLocalPayrollEmployeeId } from '@/lib/payroll-employees';
import { payrollApi } from '@/services/payroll-api.service';

export type PayrollMemberRecord = {
  id: string;
  role: string;
  createdAt?: string;
  user: {
    id: string;
    fullName: string;
    login: string;
    status?: string;
  };
  warehouse?: { id: string; name: string } | null;
};

async function getMembers(): Promise<PayrollMemberRecord[]> {
  try {
    return await payrollApi.listMembers();
  } catch {
    return [];
  }
}

export const payrollService = {
  isMockMode: false,

  async listCompensations() {
    return payrollApi.listCompensations();
  },

  async upsertCompensation(payload: {
    companyUserId: string;
    employeeName: string;
    employeeRole: string;
    baseSalary: number;
    currency?: PayrollCurrency;
    effectiveFrom?: string;
  }): Promise<EmployeeCompensation> {
    return payrollApi.upsertCompensation(payload);
  },

  async listPeriods(): Promise<PayrollPeriod[]> {
    return payrollMockStore.listPeriods();
  },

  async getPeriod(id: string): Promise<PayrollPeriod | null> {
    return payrollMockStore.getPeriod(id);
  },

  async createPeriod(payload: { year: number; month: number; notes?: string }) {
    return payrollMockStore.createPeriod(payload.year, payload.month, payload.notes);
  },

  async calculatePeriod(periodId: string): Promise<PayrollPeriod> {
    const members = await getMembers();
    return payrollMockStore.calculatePeriod(periodId, members);
  },

  async addAdjustment(
    periodId: string,
    runId: string,
    payload: { type: PayrollLineType; label: string; amount: number },
  ): Promise<PayrollRun> {
    return payrollMockStore.addAdjustment(periodId, runId, payload);
  },

  async approvePeriod(periodId: string): Promise<PayrollPeriod> {
    return payrollMockStore.approvePeriod(periodId);
  },

  async markPeriodPaid(periodId: string): Promise<PayrollPeriod> {
    return payrollMockStore.markPeriodPaid(periodId);
  },

  async closePeriod(periodId: string): Promise<PayrollPeriod> {
    return payrollMockStore.closePeriod(periodId);
  },

  async getSummary(): Promise<PayrollSummary> {
    return payrollMockStore.getSummary();
  },

  async getMonthStats(year: number, month: number, companyUserIds: string[]) {
    return payrollApi.getMonthStats(year, month, companyUserIds);
  },

  async saveLeavePlan(payload: {
    companyUserId: string;
    year: number;
    month: number;
    dates: string[];
  }): Promise<EmployeeLeavePlan> {
    return payrollMockStore.saveLeavePlan(payload);
  },

  async getLeavePlan(companyUserId: string, year: number, month: number) {
    return payrollMockStore.getLeavePlan(companyUserId, year, month);
  },

  async getMembersForPayroll() {
    return getMembers();
  },

  async getMemberById(companyUserId: string) {
    if (isLocalPayrollEmployeeId(companyUserId)) {
      const extra = await this.getEmployeeExtra(companyUserId).catch(() => null);
      const comps = await this.listCompensations().catch(() => []);
      const comp =
        comps.find((c) => c.companyUserId === companyUserId && c.isActive) ?? null;
      if (!extra && !comp) return null;
      return buildLocalPayrollMember(companyUserId, extra, comp);
    }
    const members = await getMembers();
    return members.find((m) => m.id === companyUserId) ?? null;
  },

  async createPayrollOnlyEmployee(payload: {
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
  }) {
    return payrollApi.createPayrollOnlyEmployee(payload);
  },

  async getEmployeeProfile(companyUserId: string): Promise<PayrollEmployeeProfile> {
    return payrollApi.getEmployeeProfile(companyUserId);
  },

  async getEmployeeExtra(companyUserId: string) {
    if (isLocalPayrollEmployeeId(companyUserId)) {
      return payrollMockStore.getEmployeeExtra(companyUserId);
    }
    return payrollApi.getEmployeeExtra(companyUserId);
  },

  async saveEmployeeExtra(payload: PayrollEmployeeExtra) {
    if (isLocalPayrollEmployeeId(payload.companyUserId)) {
      return payrollMockStore.saveEmployeeExtra(payload);
    }
    return payrollApi.saveEmployeeExtra(payload);
  },

  async markEmployeeLeft(companyUserId: string, leftAt: string) {
    if (isLocalPayrollEmployeeId(companyUserId)) {
      return payrollMockStore.markEmployeeLeft(companyUserId, leftAt);
    }
    return payrollApi.markEmployeeLeft(companyUserId, leftAt);
  },

  async listEmployeeExtras() {
    const apiExtras = await payrollApi.listEmployeeExtras();
    const mockExtras = payrollMockStore.listEmployeeExtras().filter((e) =>
      isLocalPayrollEmployeeId(e.companyUserId),
    );
    const byId = new Map(apiExtras.map((e) => [e.companyUserId, e]));
    for (const m of mockExtras) {
      if (!byId.has(m.companyUserId)) byId.set(m.companyUserId, m);
    }
    return Array.from(byId.values());
  },

  async listEmployeeAdvances(companyUserId: string, year: number, month: number) {
    if (isLocalPayrollEmployeeId(companyUserId)) {
      return payrollMockStore.listAdvances(companyUserId, year, month);
    }
    return payrollApi.listEmployeeAdvances(companyUserId, year, month);
  },

  async getEmployeeCalculation(
    companyUserId: string,
    year: number,
    month: number,
    defaultBaseSalary?: number,
  ): Promise<PayrollEmployeeCalculation> {
    if (isLocalPayrollEmployeeId(companyUserId)) {
      return payrollMockStore.getCalculation(
        companyUserId,
        year,
        month,
        defaultBaseSalary ?? 0,
      );
    }
    return payrollApi.getEmployeeCalculation(
      companyUserId,
      year,
      month,
      defaultBaseSalary ?? 0,
    );
  },

  async saveEmployeeCalculation(calc: PayrollEmployeeCalculation) {
    if (isLocalPayrollEmployeeId(calc.companyUserId)) {
      return payrollMockStore.saveCalculation(calc);
    }
    const { calculation } = await payrollApi.upsertSettlement(
      calc.companyUserId,
      calc.year,
      calc.month,
      {
        baseSalary: calc.baseSalary,
        totalDays: calc.totalDays,
        workedDays: calc.workedDays,
        bonus: calc.bonus,
        penalties: calc.penalties,
      },
      false,
    );
    return calculation;
  },

  async getEmployeeAdvancesTotal(companyUserId: string, year: number, month: number) {
    const list = await this.listEmployeeAdvances(companyUserId, year, month);
    return list.reduce((a, x) => a + x.amount, 0);
  },

  async addEmployeeAdvance(payload: {
    companyUserId: string;
    year: number;
    month: number;
    amount: number;
    reason: string;
    advanceDate?: string;
    maxBaseSalary?: number;
  }): Promise<PayrollAdvance> {
    if (isLocalPayrollEmployeeId(payload.companyUserId)) {
      return payrollMockStore.addAdvance(payload);
    }
    return payrollApi.addEmployeeAdvance(payload);
  },

  async addEmployeeBonus(payload: {
    companyUserId: string;
    year: number;
    month: number;
    amount: number;
    reason?: string;
  }) {
    if (isLocalPayrollEmployeeId(payload.companyUserId)) {
      return payrollMockStore.addBonus(payload);
    }
    return payrollApi.addEmployeeBonus(payload);
  },

  async confirmEmployeePayment(
    companyUserId: string,
    year: number,
    month: number,
    input: Omit<
      PayrollEmployeeCalculation,
      'companyUserId' | 'year' | 'month' | 'paymentConfirmedAt'
    >,
  ) {
    if (isLocalPayrollEmployeeId(companyUserId)) {
      return payrollMockStore.confirmEmployeePayment(companyUserId, year, month, input);
    }
    return payrollApi.confirmEmployeePayment(companyUserId, year, month, input);
  },
};

export type { EmployeeCompensation, PayrollPeriod, PayrollRun, PayrollSummary };
