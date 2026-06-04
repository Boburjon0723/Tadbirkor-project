import { ROLE_LABELS, type SystemRole } from '@/lib/roles';
import type { EmployeeCompensation, PayrollEmployeeExtra } from '@/lib/payroll-types';

export type PayrollEmployeeStatus = 'ACTIVE' | 'LEAVE' | 'LEFT';

export const PAYROLL_STATUS_LABEL: Record<PayrollEmployeeStatus, string> = {
  ACTIVE: 'Faol',
  LEAVE: 'Ta’tilda',
  LEFT: 'Ishdan ketgan',
};

export const PAYROLL_STATUS_STYLE: Record<PayrollEmployeeStatus, string> = {
  ACTIVE: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  LEAVE: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  LEFT: 'bg-red-500/15 text-red-400 border-red-500/25',
};

const DEPT_BY_ROLE: Record<string, string> = {
  MANAGER: 'Boshqaruv',
  ACCOUNTANT: 'Moliya',
  WAREHOUSE: 'IT & DevOps',
  SALES: 'Sales',
  FIELD_WORKER: 'Operatsiya',
  WORKER: 'Ishlab chiqarish',
};

const POSITION_BY_ROLE: Record<string, string> = {
  MANAGER: 'Menejer',
  ACCOUNTANT: 'Buxgalter',
  WAREHOUSE: 'Omborchi',
  SALES: 'Sotuvchi',
  FIELD_WORKER: 'Dala xodimi',
  WORKER: 'Oddiy ishchi',
};

export const LOCAL_PAYROLL_ID_PREFIX = 'local-';

export function isLocalPayrollEmployeeId(id: string) {
  return id.startsWith(LOCAL_PAYROLL_ID_PREFIX);
}

export type PayrollMemberInput = {
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

export type PayrollEmployeeRow = {
  companyUserId: string;
  employeeId: string;
  fullName: string;
  initials: string;
  position: string;
  department: string;
  joinedLabel: string;
  salary: number;
  currency: string;
  status: PayrollEmployeeStatus;
  role: string;
  /** Ishdan ketgan sana — shu oydan keyingi oylarda ro‘yxatda chiqmaydi */
  leftAt?: string | null;
};

/** Tanlangan oyda xodim hali ro‘yxatda bo‘lishi kerakmi */
export function isEmployeeVisibleForMonth(
  leftAt: string | undefined | null,
  year: number,
  month: number,
) {
  if (!leftAt) return true;
  const d = new Date(`${leftAt.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return true;
  const ly = d.getFullYear();
  const lm = d.getMonth() + 1;
  return year < ly || (year === ly && month <= lm);
}

export function lastDayOfMonthKey(year: number, month: number) {
  const d = new Date(year, month, 0);
  const day = d.getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function resolveRowStatus(
  member: PayrollMemberInput,
  extra: PayrollEmployeeExtra | undefined,
): PayrollEmployeeStatus {
  if (extra?.leftAt || extra?.employmentStatus === 'LEFT') return 'LEFT';
  if (extra?.employmentStatus) return extra.employmentStatus;
  return resolveEmployeeStatus(member.user.status);
}

export function employeeIdLabel(companyUserId: string) {
  const tail = companyUserId.replace(/-/g, '').slice(-4).toUpperCase();
  return `#EMP-${tail || '0000'}`;
}

export function initialsFromName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return (parts[0]?.[0] || '?').toUpperCase();
}

export function resolveEmployeeStatus(userStatus?: string): PayrollEmployeeStatus {
  const s = String(userStatus || 'active').toLowerCase();
  if (s === 'inactive' || s === 'disabled' || s === 'left') return 'LEFT';
  if (s === 'leave' || s === 'on_leave') return 'LEAVE';
  return 'ACTIVE';
}

export function resolveDepartment(member: PayrollMemberInput) {
  if (member.warehouse?.name) return member.warehouse.name;
  return DEPT_BY_ROLE[member.role] || 'Boshqa';
}

export function resolvePosition(member: PayrollMemberInput) {
  return (
    POSITION_BY_ROLE[member.role] ||
    ROLE_LABELS[member.role as SystemRole] ||
    member.role
  );
}

export function formatJoinedDate(createdAt?: string) {
  if (!createdAt) return '—';
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function buildPayrollEmployeeRows(
  members: PayrollMemberInput[],
  compensations: EmployeeCompensation[],
  extras: PayrollEmployeeExtra[] = [],
): PayrollEmployeeRow[] {
  const extraMap = new Map(extras.map((e) => [e.companyUserId, e]));
  const compMap = new Map(
    compensations.filter((c) => c.isActive).map((c) => [c.companyUserId, c]),
  );

  const memberRows = members
    .filter((m) => m.role !== 'OWNER')
    .map((member) => {
      const comp = compMap.get(member.id);
      const extra = extraMap.get(member.id);
      const fullName =
        extra?.firstName || extra?.lastName
          ? [extra.firstName, extra.lastName].filter(Boolean).join(' ')
          : member.user.fullName;
      return {
        companyUserId: member.id,
        employeeId: employeeIdLabel(member.id),
        fullName,
        initials: initialsFromName(fullName),
        position: extra?.position?.trim() || resolvePosition(member),
        department: extra?.department?.trim() || resolveDepartment(member),
        joinedLabel: formatJoinedDate(member.createdAt),
        salary: comp?.baseSalary ?? 0,
        currency: comp?.currency ?? 'UZS',
        status: resolveRowStatus(member, extra),
        role: member.role,
        leftAt: extra?.leftAt ?? null,
      };
    });

  const memberIds = new Set(memberRows.map((r) => r.companyUserId));
  const localIds = new Set<string>();
  for (const e of extras) {
    if (isLocalPayrollEmployeeId(e.companyUserId)) localIds.add(e.companyUserId);
  }
  for (const c of compensations) {
    if (isLocalPayrollEmployeeId(c.companyUserId)) localIds.add(c.companyUserId);
  }

  const localRows: PayrollEmployeeRow[] = [];
  for (const id of Array.from(localIds)) {
    if (memberIds.has(id)) continue;
    const extra = extraMap.get(id);
    const comp = compMap.get(id);
    const fullName = [extra?.firstName, extra?.lastName].filter(Boolean).join(' ') || 'Xodim';
    const role = extra?.role || comp?.employeeRole || 'WORKER';
    localRows.push({
      companyUserId: id,
      employeeId: employeeIdLabel(id),
      fullName,
      initials: initialsFromName(fullName),
      position:
        extra?.position?.trim() ||
        POSITION_BY_ROLE[role] ||
        ROLE_LABELS[role as SystemRole] ||
        role,
      department: extra?.department?.trim() || DEPT_BY_ROLE[role] || 'Boshqa',
      joinedLabel: formatJoinedDate(extra?.createdAt),
      salary: comp?.baseSalary ?? 0,
      currency: comp?.currency ?? 'UZS',
      status: extra?.leftAt || extra?.employmentStatus === 'LEFT' ? 'LEFT' : 'ACTIVE',
      role,
      leftAt: extra?.leftAt ?? null,
    });
  }

  return [...memberRows, ...localRows];
}

export function buildLocalPayrollMember(
  companyUserId: string,
  extra: PayrollEmployeeExtra | null,
  comp: EmployeeCompensation | null,
): PayrollMemberInput {
  const role = extra?.role || comp?.employeeRole || 'WORKER';
  const fullName =
    [extra?.firstName, extra?.lastName].filter(Boolean).join(' ') ||
    comp?.employeeName ||
    'Xodim';
  return {
    id: companyUserId,
    role,
    createdAt: extra?.createdAt,
    user: {
      id: companyUserId,
      fullName,
      login: '',
      status: 'active',
    },
    warehouse: null,
  };
}

export function experienceYearsFromDate(createdAt?: string): string {
  if (!createdAt) return '—';
  const start = new Date(createdAt);
  if (Number.isNaN(start.getTime())) return '—';
  const years = (Date.now() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  if (years < 0.1) return '< 1 oy';
  if (years < 1) return `${Math.round(years * 12)} oy`;
  return `${years.toFixed(1).replace(/\.0$/, '')} yil`;
}

export function uniqueDepartments(rows: PayrollEmployeeRow[]) {
  return Array.from(new Set(rows.map((r) => r.department))).sort((a, b) =>
    a.localeCompare(b, 'uz'),
  );
}
