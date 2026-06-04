import { api } from '@/lib/api';
import type {
  EmployeeCompensation,
  PayrollAdvance,
  PayrollCurrency,
  PayrollEmployeeCalculation,
  PayrollEmployeeExtra,
  PayrollEmployeeProfile,
} from '@/lib/payroll-types';
import { payrollLeaveApi } from '@/services/payroll-leave.service';

export type PayrollMemberRecord = {
  id: string;
  role: string;
  createdAt?: string;
  user: {
    id: string;
    fullName: string;
    login: string;
    status?: string;
    phone?: string;
  };
  warehouse?: { id: string; name: string } | null;
};

export type MonthStatsResponse = {
  totalBaseSalaryUZS: number;
  totalBaseSalaryUSD: number;
  totalAdvancesUZS: number;
  /** Faqat oylik hali yopilmagan xodimlarning avanslari */
  totalOpenAdvancesUZS: number;
  totalPaidUZS: number;
  totalBonusUZS: number;
  totalPaidIncludingBonusUZS: number;
  paidEmployeeCount: number;
  advancesByUser: Record<string, number>;
  leaveDaysByUser: Record<string, number>;
  paidAmountByUser: Record<string, number>;
  paymentConfirmedByUser: Record<string, boolean>;
  bonusByUser: Record<string, number>;
};

export const payrollApi = {
  async listMembers(): Promise<PayrollMemberRecord[]> {
    return payrollLeaveApi.listMembers();
  },

  async listRosterCandidates(): Promise<PayrollMemberRecord[]> {
    const { data } = await api.get<PayrollMemberRecord[]>('/payroll/roster-candidates');
    return data;
  },

  async addMemberToRoster(companyUserId: string) {
    const { data } = await api.post<{ companyUserId: string; fullName?: string }>(
      `/payroll/members/${companyUserId}/roster`,
    );
    return data;
  },

  async listCompensations(): Promise<EmployeeCompensation[]> {
    const { data } = await api.get<EmployeeCompensation[]>('/payroll/compensations');
    return data;
  },

  async upsertCompensation(payload: {
    companyUserId: string;
    employeeName: string;
    employeeRole: string;
    baseSalary: number;
    currency?: PayrollCurrency;
    effectiveFrom?: string;
  }): Promise<EmployeeCompensation> {
    const { data } = await api.post<EmployeeCompensation>('/payroll/compensations', payload);
    return data;
  },

  async listEmployeeExtras(): Promise<PayrollEmployeeExtra[]> {
    const { data } = await api.get<PayrollEmployeeExtra[]>('/payroll/employee-extras');
    return data;
  },

  async getEmployeeExtra(companyUserId: string): Promise<PayrollEmployeeExtra> {
    const { data } = await api.get<PayrollEmployeeExtra>(
      `/payroll/members/${companyUserId}/employee`,
    );
    return data;
  },

  async saveEmployeeExtra(payload: PayrollEmployeeExtra): Promise<PayrollEmployeeExtra> {
    const { companyUserId, ...body } = payload;
    const { data } = await api.patch<PayrollEmployeeExtra>(
      `/payroll/members/${companyUserId}/employee`,
      body,
    );
    return data;
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
  }): Promise<{ companyUserId: string }> {
    const { data } = await api.post<{ companyUserId: string }>('/payroll/members', payload);
    return data;
  },

  async markEmployeeLeft(companyUserId: string, leftAt: string) {
    const { data } = await api.patch(`/payroll/members/${companyUserId}/mark-left`, {
      leftAt,
    });
    return data;
  },

  async listEmployeeAdvances(companyUserId: string, year: number, month: number) {
    const { data } = await api.get<PayrollAdvance[]>('/payroll/advances', {
      params: { companyUserId, year, month },
    });
    return data;
  },

  async addEmployeeAdvance(payload: {
    companyUserId: string;
    year: number;
    month: number;
    amount: number;
    reason: string;
    advanceDate?: string;
  }): Promise<PayrollAdvance> {
    const { data } = await api.post<PayrollAdvance>('/payroll/advances', payload);
    return data;
  },

  async addEmployeeBonus(payload: {
    companyUserId: string;
    year: number;
    month: number;
    amount: number;
    reason?: string;
  }) {
    const { data } = await api.post<{
      companyUserId: string;
      year: number;
      month: number;
      amountAdded: number;
      bonusTotal: number;
      reason: string | null;
    }>('/payroll/bonus', payload);
    return data;
  },

  async getMonthStats(year: number, month: number, companyUserIds: string[]) {
    const { data } = await api.get<MonthStatsResponse>('/payroll/month-stats', {
      params: {
        year,
        month,
        companyUserIds: companyUserIds.join(','),
      },
    });
    return data;
  },

  async getEmployeeCalculation(
    companyUserId: string,
    year: number,
    month: number,
    defaultBaseSalary = 0,
  ): Promise<PayrollEmployeeCalculation> {
    const { data } = await api.get<PayrollEmployeeCalculation>(
      `/payroll/members/${companyUserId}/settlement`,
      { params: { year, month, defaultBaseSalary } },
    );
    return data;
  },

  async upsertSettlement(
    companyUserId: string,
    year: number,
    month: number,
    input: Omit<
      PayrollEmployeeCalculation,
      'companyUserId' | 'year' | 'month' | 'paymentConfirmedAt'
    >,
    confirmPayment?: boolean,
  ) {
    const { data } = await api.patch<{
      calculation: PayrollEmployeeCalculation;
      finalAmount: number;
      advancesTotal: number;
    }>(
      `/payroll/members/${companyUserId}/settlement`,
      { ...input, confirmPayment: !!confirmPayment },
      { params: { year, month } },
    );
    return data;
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
    return this.upsertSettlement(companyUserId, year, month, input, true);
  },

  async getEmployeeProfile(companyUserId: string): Promise<PayrollEmployeeProfile> {
    return {
      companyUserId,
      kpiQuality: 0,
      kpiDiscipline: 0,
    };
  },
};
