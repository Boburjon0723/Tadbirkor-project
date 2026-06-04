export type PayrollPeriodStatus =
  | 'DRAFT'
  | 'CALCULATED'
  | 'APPROVED'
  | 'PAID'
  | 'CLOSED';

export type PayrollRunStatus = 'PENDING' | 'APPROVED' | 'PAID';

export type PayrollLineType =
  | 'BASE'
  | 'BONUS'
  | 'PENALTY'
  | 'ADVANCE'
  | 'COMMISSION'
  | 'MANUAL';

export type PayrollCurrency = 'UZS' | 'USD';

export type EmployeeCompensation = {
  id: string;
  companyUserId: string;
  employeeName: string;
  employeeRole: string;
  baseSalary: number;
  currency: PayrollCurrency;
  effectiveFrom: string;
  isActive: boolean;
};

export type PayrollLine = {
  id: string;
  type: PayrollLineType;
  label: string;
  amount: number;
};

export type PayrollRun = {
  id: string;
  periodId: string;
  companyUserId: string;
  employeeName: string;
  employeeRole: string;
  baseAmount: number;
  bonusAmount: number;
  deductionAmount: number;
  advanceAmount: number;
  grossAmount: number;
  netAmount: number;
  currency: PayrollCurrency;
  status: PayrollRunStatus;
  lines: PayrollLine[];
};

export type PayrollPeriod = {
  id: string;
  year: number;
  month: number;
  status: PayrollPeriodStatus;
  periodStart: string;
  periodEnd: string;
  calculatedAt?: string | null;
  approvedAt?: string | null;
  paidAt?: string | null;
  notes?: string | null;
  runs: PayrollRun[];
};

export type PayrollSummary = {
  employeeCount: number;
  totalGross: Record<string, number>;
  totalNet: Record<string, number>;
  byStatus: Record<PayrollPeriodStatus, number>;
};

export type CompanyMemberRef = {
  id: string;
  role: string;
  user: { id: string; fullName: string; login: string };
};

export type PayrollAdvance = {
  id: string;
  companyUserId: string;
  year: number;
  month: number;
  amount: number;
  advanceDate: string;
  reason: string;
};

export type PayrollEmployeeCalculation = {
  companyUserId: string;
  year: number;
  month: number;
  baseSalary: number;
  totalDays: number;
  workedDays: number;
  bonus: number;
  penalties: number;
  paymentConfirmedAt?: string | null;
};

export type PayrollEmployeeProfile = {
  companyUserId: string;
  kpiQuality: number;
  kpiDiscipline: number;
};

/** Qo‘shimcha kadrlar ma’lumoti (manzil, bo‘lim matni va h.k.) */
export type PayrollEmployeeExtra = {
  companyUserId: string;
  firstName?: string;
  lastName?: string;
  position?: string;
  department?: string;
  address?: string;
  email?: string;
  notes?: string;
  phone?: string;
  role?: string;
  createdAt?: string;
  /** Oyiga maoshga ta’sir qilmaydigan dam olish limiti (ish kunlari) */
  monthlyPaidLeaveQuota?: number;
  /** Ishdan ketgan sana (YYYY-MM-DD) — shu oydan keyin ro‘yxatda ko‘rinmaydi */
  leftAt?: string | null;
  employmentStatus?: 'ACTIVE' | 'LEAVE' | 'LEFT';
};

export type EmployeeLeavePlan = {
  companyUserId: string;
  year: number;
  month: number;
  dates: string[];
};
