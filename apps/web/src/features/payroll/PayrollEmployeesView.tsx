'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  Plus,
  Calendar,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Pencil,
  Banknote,
  HandCoins,
  Palmtree,
  UserMinus,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { PageSkeleton } from '@/components/ui/page-skeleton';
import {
  AddPayrollEmployeeModal,
  type AddPayrollEmployeePayload,
  type PayrollEmployeeFormInitial,
} from '@/features/payroll/AddPayrollEmployeeModal';
import { CompensationModal } from '@/features/payroll/CompensationModal';
import {
  payrollKeys,
  usePayrollCompensations,
  usePayrollEmployeeExtras,
  usePayrollMembers,
  usePayrollMutations,
} from '@/hooks/payroll/use-payroll';
import { authService } from '@/services/auth.service';
import { payrollService } from '@/services/payroll.service';
import { usersService } from '@/services/users.service';
import { usePayrollAccess } from '@/hooks/use-payroll-access';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import {
  buildPayrollEmployeeRows,
  employeeIdLabel,
  isEmployeeVisibleForMonth,
  lastDayOfMonthKey,
  uniqueDepartments,
  type PayrollEmployeeRow,
  type PayrollEmployeeStatus,
} from '@/lib/payroll-employees';
import {
  formatPayrollMonth,
  formatPayrollMoney,
  formatSalaryTableAmount,
  PAYROLL_MONTH_NAMES,
} from '@/lib/payroll-labels';
import { toast, formatApiError } from '@/lib/toast';
import { PayrollLeaveRequestsPanel } from '@/features/payroll/PayrollLeaveRequestsPanel';
import { EmployeeAdvanceModal } from '@/features/payroll/EmployeeAdvanceModal';
import { EmployeeBonusModal } from '@/features/payroll/EmployeeBonusModal';
import { EmployeeLeaveModal } from '@/features/payroll/EmployeeLeaveModal';
import { PayrollWorkDaysSettings } from '@/features/payroll/PayrollWorkDaysSettings';
import { AddExistingPayrollMemberModal } from '@/features/payroll/AddExistingPayrollMemberModal';
import {
  EmployeeActionButtons,
  PayrollEmployeeMobileCard,
} from '@/features/payroll/PayrollEmployeeMobileCard';
import { payrollLeaveApi, type LeaveRequestRow } from '@/services/payroll-leave.service';
import { payrollApi } from '@/services/payroll-api.service';
import {
  mergeDateKeysToRanges,
  sumApprovedLeaveWeekdaysInMonth,
} from '@/lib/payroll-leave-dates.util';
import {
  computeEffectiveSalaryCap,
  computeWorkedDaysForSalaryCap,
} from '@/lib/payroll-calculation';
import {
  enrichPayrollMonthStats,
  payrollSalarySubline,
} from '@/lib/payroll-salary-display';

const DEFAULT_PAID_LEAVE_QUOTA = 4;
import type { PayrollAdvance } from '@/lib/payroll-types';

const PAGE_SIZE = 10;

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] || '', lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

const STATUS_FILTER_OPTIONS: { value: '' | PayrollEmployeeStatus; label: string }[] = [
  { value: '', label: 'Holat: Barchasi' },
  { value: 'ACTIVE', label: 'Faol' },
  { value: 'LEAVE', label: 'Ta’tilda' },
  { value: 'LEFT', label: 'Ishdan ketgan' },
];

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = 'text-white',
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: LucideIcon;
  accent?: string;
}) {
  return (
    <div className="glass-card rounded-2xl border border-white/5 p-4 sm:p-5 min-h-[100px] sm:min-h-[120px] flex flex-col justify-between">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-black uppercase tracking-widest text-gray-500 leading-snug">
          {label}
        </p>
        {Icon && (
          <span className="p-2 rounded-xl bg-white/5 border border-white/10 text-violet-400 shrink-0">
            <Icon size={18} />
          </span>
        )}
      </div>
      <div>
        <p className={`text-lg sm:text-xl lg:text-2xl font-black tracking-tight mt-2 sm:mt-3 ${accent}`}>
          {value}
        </p>
        {sub && <p className="text-xs font-bold text-gray-500 mt-1.5">{sub}</p>}
      </div>
    </div>
  );
}

const ROW_MENU_WIDTH = 200;
const ROW_MENU_HEIGHT = 140;

function RowActionsMenu({
  onEditSalary,
  onEditEmployee,
  onMarkLeft,
  showMarkLeft,
}: {
  onEditSalary: () => void;
  onEditEmployee: () => void;
  onMarkLeft: () => void;
  showMarkLeft: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  const updateMenuPosition = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let left = r.right - ROW_MENU_WIDTH;
    if (left < 8) left = 8;
    if (left + ROW_MENU_WIDTH > window.innerWidth - 8) {
      left = window.innerWidth - ROW_MENU_WIDTH - 8;
    }
    const spaceBelow = window.innerHeight - r.bottom - 8;
    const top =
      spaceBelow < ROW_MENU_HEIGHT
        ? Math.max(8, r.top - ROW_MENU_HEIGHT - 8)
        : r.bottom + 8;
    setMenuPos({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    updateMenuPosition();
    const onReposition = () => updateMenuPosition();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open, updateMenuPosition]);

  const menuPortal =
    typeof document !== 'undefined' &&
    open &&
    createPortal(
      <>
        <div
          className="fixed inset-0 z-[200]"
          aria-hidden
          onClick={() => setOpen(false)}
        />
        <div
          style={{ top: menuPos.top, left: menuPos.left, width: ROW_MENU_WIDTH }}
          className="fixed z-[210] py-2 rounded-2xl bg-[#141414] border border-white/10 shadow-2xl"
        >
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onEditEmployee();
            }}
            className="w-full px-4 py-2.5 text-left text-sm font-bold text-gray-300 hover:bg-white/5 flex items-center gap-2"
          >
            <Pencil size={16} className="text-blue-400" />
            Tahrirlash
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onEditSalary();
            }}
            className="w-full px-4 py-2.5 text-left text-sm font-bold text-gray-300 hover:bg-white/5 flex items-center gap-2"
          >
            <Banknote size={16} className="text-violet-400" />
            Maosh belgilash
          </button>
          {showMarkLeft && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onMarkLeft();
              }}
              className="w-full px-4 py-2.5 text-left text-sm font-bold text-red-300 hover:bg-red-500/10 flex items-center gap-2"
            >
              <UserMinus size={16} className="text-red-400" />
              Ishdan ketgan qilish
            </button>
          )}
        </div>
      </>,
      document.body,
    );

  return (
    <div className="inline-flex">
      <button
        ref={btnRef}
        type="button"
        onClick={() => {
          if (!open) updateMenuPosition();
          setOpen((v) => !v);
        }}
        className="p-2 rounded-xl hover:bg-white/10 text-gray-400"
        aria-label="Amallar"
        aria-expanded={open}
      >
        <MoreVertical size={18} />
      </button>
      {menuPortal}
    </div>
  );
}

export function PayrollEmployeesView() {
  const queryClient = useQueryClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | PayrollEmployeeStatus>('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<{
    row: PayrollEmployeeRow;
    member: { id: string; role: string; user: { fullName: string } };
  } | null>(null);
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [employeeModalMode, setEmployeeModalMode] = useState<'add' | 'edit'>('add');
  const [employeeFormInitial, setEmployeeFormInitial] =
    useState<PayrollEmployeeFormInitial | null>(null);
  const [employeeModalLoading, setEmployeeModalLoading] = useState(false);
  const [savingEmployee, setSavingEmployee] = useState(false);
  const [advanceTarget, setAdvanceTarget] = useState<PayrollEmployeeRow | null>(null);
  const [advanceHistory, setAdvanceHistory] = useState<PayrollAdvance[]>([]);
  const [advanceHistoryLoading, setAdvanceHistoryLoading] = useState(false);
  const [advanceSaving, setAdvanceSaving] = useState(false);
  const [advanceCapInfo, setAdvanceCapInfo] = useState({
    effectiveSalaryCap: 0,
    excessLeaveDays: 0,
    leaveDaysUsed: 0,
    paidLeaveQuota: DEFAULT_PAID_LEAVE_QUOTA,
    totalWorkDays: 0,
    workedDaysForCap: 0,
    loading: false,
  });
  const [leaveTarget, setLeaveTarget] = useState<PayrollEmployeeRow | null>(null);
  const [bonusTarget, setBonusTarget] = useState<PayrollEmployeeRow | null>(null);
  const [bonusSaving, setBonusSaving] = useState(false);
  const [existingMemberModalOpen, setExistingMemberModalOpen] = useState(false);
  const [workedDaysMode, setWorkedDaysMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [leaveHistory, setLeaveHistory] = useState<LeaveRequestRow[]>([]);
  const [leaveHistoryLoading, setLeaveHistoryLoading] = useState(false);
  const [leaveSaving, setLeaveSaving] = useState(false);
  const [monthStats, setMonthStats] = useState({
    totalBaseSalaryUZS: 0,
    totalBaseSalaryUSD: 0,
    totalAdvancesUZS: 0,
    totalOpenAdvancesUZS: 0,
    totalPaidUZS: 0,
    totalBonusUZS: 0,
    totalPaidIncludingBonusUZS: 0,
    paidEmployeeCount: 0,
    advancesByUser: {} as Record<string, number>,
    leaveDaysByUser: {} as Record<string, number>,
    paidAmountByUser: {} as Record<string, number>,
    paymentConfirmedByUser: {} as Record<string, boolean>,
    bonusByUser: {} as Record<string, number>,
  });
  const [monthLeaveDays, setMonthLeaveDays] = useState<Record<string, number>>({});

  const debouncedSearch = useDebouncedValue(search, 250);
  const { canManage, loading: accessLoading } = usePayrollAccess();
  const { data: members = [], isPending: membersLoading } = usePayrollMembers();
  const { data: compensations = [], isPending: compLoading } = usePayrollCompensations();
  const { data: extras = [] } = usePayrollEmployeeExtras();
  const mutations = usePayrollMutations();

  const allRows = useMemo(
    () => buildPayrollEmployeeRows(members, compensations, extras),
    [members, compensations, extras],
  );

  const rowsForMonth = useMemo(
    () => allRows.filter((row) => isEmployeeVisibleForMonth(row.leftAt, year, month)),
    [allRows, year, month],
  );

  const departments = useMemo(() => uniqueDepartments(rowsForMonth), [rowsForMonth]);

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return rowsForMonth.filter((row) => {
      if (department && row.department !== department) return false;
      if (statusFilter && row.status !== statusFilter) return false;
      if (!q) return true;
      return (
        row.fullName.toLowerCase().includes(q) ||
        row.employeeId.toLowerCase().includes(q) ||
        row.position.toLowerCase().includes(q)
      );
    });
  }, [rowsForMonth, debouncedSearch, department, statusFilter]);

  const monthLabel = formatPayrollMonth(year, month);

  useEffect(() => {
    void payrollLeaveApi
      .getSettings()
      .then((s) => setWorkedDaysMode(s.workedDaysMode))
      .catch(() => setWorkedDaysMode('AUTO'));
  }, []);

  useEffect(() => {
    const ids = rowsForMonth.map((r) => r.companyUserId);
    if (!ids.length) {
      setMonthStats({
        totalBaseSalaryUZS: 0,
        totalBaseSalaryUSD: 0,
        totalAdvancesUZS: 0,
        totalOpenAdvancesUZS: 0,
        totalPaidUZS: 0,
        totalBonusUZS: 0,
        totalPaidIncludingBonusUZS: 0,
        paidEmployeeCount: 0,
        advancesByUser: {},
        leaveDaysByUser: {},
        paidAmountByUser: {},
        paymentConfirmedByUser: {},
        bonusByUser: {},
      });
      setMonthLeaveDays({});
      return;
    }
    void payrollService.getMonthStats(year, month, ids).then((s) => {
      setMonthStats(s);
      setMonthLeaveDays(s.leaveDaysByUser ?? {});
    });
  }, [rowsForMonth, year, month]);

  useEffect(() => {
    const ids = rowsForMonth.map((r) => r.companyUserId);
    if (!ids.length) return;
    void payrollLeaveApi
      .listLeave({ status: 'APPROVED' })
      .then((leaves) => {
        setMonthLeaveDays((prev) => {
          const map = { ...prev };
          const apiDays: Record<string, number> = {};
          for (const l of leaves) {
            const days = sumApprovedLeaveWeekdaysInMonth(
              [
                {
                  status: l.status,
                  startDate: l.startDate,
                  endDate: l.endDate,
                },
              ],
              year,
              month,
            );
            if (days > 0) {
              apiDays[l.companyUserId] = (apiDays[l.companyUserId] || 0) + days;
            }
          }
          for (const id of ids) {
            map[id] = apiDays[id] ?? prev[id] ?? 0;
          }
          return map;
        });
      })
      .catch(() => {});
  }, [year, month, rowsForMonth]);

  useEffect(() => {
    if (!advanceTarget) {
      setAdvanceHistory([]);
      return;
    }
    setAdvanceHistoryLoading(true);
    void payrollService
      .listEmployeeAdvances(advanceTarget.companyUserId, year, month)
      .then(setAdvanceHistory)
      .finally(() => setAdvanceHistoryLoading(false));
  }, [advanceTarget, year, month]);

  useEffect(() => {
    if (!advanceTarget) {
      setAdvanceCapInfo({
        effectiveSalaryCap: 0,
        excessLeaveDays: 0,
        leaveDaysUsed: 0,
        paidLeaveQuota: DEFAULT_PAID_LEAVE_QUOTA,
        totalWorkDays: 0,
        workedDaysForCap: 0,
        loading: false,
      });
      return;
    }
    const base = advanceTarget.salary;
    setAdvanceCapInfo((s) => ({ ...s, loading: true, effectiveSalaryCap: base }));
    void (async () => {
      try {
        const [workMonth, leaves, profile] = await Promise.all([
          payrollLeaveApi.getWorkMonth(advanceTarget.companyUserId, year, month),
          payrollLeaveApi.listApprovedLeaves(advanceTarget.companyUserId, year, month),
          payrollLeaveApi.getMemberProfile(advanceTarget.companyUserId),
        ]);
        const paidQuota =
          profile.monthlyPaidLeaveQuota > 0
            ? profile.monthlyPaidLeaveQuota
            : DEFAULT_PAID_LEAVE_QUOTA;
        const leaveDaysUsed = sumApprovedLeaveWeekdaysInMonth(leaves, year, month);
        const excessLeaveDays = Math.max(0, leaveDaysUsed - paidQuota);
        const workedDaysForCap = computeWorkedDaysForSalaryCap({
          totalDays: workMonth.totalDays,
          workedDaysFromRecord: workMonth.workedDays,
          excessLeaveDays,
          isManual: workMonth.isManual,
          workedDaysMode,
        });
        const effectiveSalaryCap = computeEffectiveSalaryCap(
          base,
          workMonth.totalDays,
          workedDaysForCap,
        );
        setAdvanceCapInfo({
          effectiveSalaryCap,
          excessLeaveDays,
          leaveDaysUsed,
          paidLeaveQuota: paidQuota,
          totalWorkDays: workMonth.totalDays,
          workedDaysForCap,
          loading: false,
        });
      } catch {
        setAdvanceCapInfo({
          effectiveSalaryCap: base,
          excessLeaveDays: 0,
          leaveDaysUsed: 0,
          paidLeaveQuota: DEFAULT_PAID_LEAVE_QUOTA,
          totalWorkDays: 0,
          workedDaysForCap: 0,
          loading: false,
        });
      }
    })();
  }, [advanceTarget, year, month, workedDaysMode]);

  useEffect(() => {
    if (!leaveTarget) {
      setLeaveHistory([]);
      return;
    }
    setLeaveHistoryLoading(true);
    void payrollLeaveApi
      .listMemberLeave(leaveTarget.companyUserId, year, month)
      .then(setLeaveHistory)
      .finally(() => setLeaveHistoryLoading(false));
  }, [leaveTarget, year, month]);

  const advanceTotalForTarget = useMemo(
    () => advanceHistory.reduce((a, x) => a + x.amount, 0),
    [advanceHistory],
  );

  const refreshMonthStats = async () => {
    const ids = rowsForMonth.map((r) => r.companyUserId);
    const statsFresh = await payrollService.getMonthStats(year, month, ids);
    setMonthStats(statsFresh);
    setMonthLeaveDays(statsFresh.leaveDaysByUser ?? {});
  };

  const handleAddAdvance = async (payload: {
    amount: number;
    reason: string;
    advanceDate: string;
  }) => {
    if (!advanceTarget) return;
    if (advanceTarget.salary <= 0) {
      toast.error('Avval oylik maosh belgilang');
      return;
    }
    const salaryCap =
      advanceCapInfo.effectiveSalaryCap > 0
        ? advanceCapInfo.effectiveSalaryCap
        : advanceTarget.salary;
    const remaining = salaryCap - advanceTotalForTarget;
    if (remaining <= 0) {
      toast.error('Oylik qoplandi — qo‘shimcha avans berib bo‘lmaydi');
      return;
    }
    if (payload.amount > remaining) {
      toast.error(`Maksimal avans: ${remaining.toLocaleString('uz-UZ')} UZS`);
      return;
    }
    setAdvanceSaving(true);
    try {
      await mutations.addEmployeeAdvance.mutateAsync({
        companyUserId: advanceTarget.companyUserId,
        year,
        month,
        maxBaseSalary: salaryCap,
        ...payload,
      });
      await queryClient.invalidateQueries({ queryKey: payrollKeys.all });
      const fresh = await payrollService.listEmployeeAdvances(
        advanceTarget.companyUserId,
        year,
        month,
      );
      setAdvanceHistory(fresh);
      await refreshMonthStats();
      const totalAfter = fresh.reduce((a, x) => a + x.amount, 0);
      toast.success('Avans qo‘shildi');
      if (totalAfter >= salaryCap) {
        toast.success('Oylik to‘lov amalga oshdi');
      }
    } catch (e) {
      toast.error(formatApiError(e));
      throw e;
    } finally {
      setAdvanceSaving(false);
    }
  };

  const handleAddBonus = async (payload: { amount: number; reason: string }) => {
    if (!bonusTarget) return;
    if (bonusTarget.salary <= 0) {
      toast.error('Avval oylik maosh belgilang');
      return;
    }
    setBonusSaving(true);
    try {
      await payrollService.addEmployeeBonus({
        companyUserId: bonusTarget.companyUserId,
        year,
        month,
        amount: payload.amount,
        reason: payload.reason,
      });
      await queryClient.invalidateQueries({ queryKey: payrollKeys.all });
      await refreshMonthStats();
      toast.success('Bonus qo‘shildi');
    } catch (e) {
      toast.error(formatApiError(e));
      throw e;
    } finally {
      setBonusSaving(false);
    }
  };

  const handleRecordLeave = async (payload: {
    daysCount: number;
    startDate: string;
    reason?: string;
  }) => {
    if (!leaveTarget) return;
    setLeaveSaving(true);
    try {
      await payrollLeaveApi.recordMemberLeave(leaveTarget.companyUserId, payload);
      const fresh = await payrollLeaveApi.listMemberLeave(
        leaveTarget.companyUserId,
        year,
        month,
      );
      setLeaveHistory(fresh);
      await refreshMonthStats();
      await queryClient.invalidateQueries({ queryKey: payrollKeys.all });
      toast.success('Dam olish saqlandi');
    } catch (e) {
      toast.error(formatApiError(e));
      throw e;
    } finally {
      setLeaveSaving(false);
    }
  };

  const handleApproveLeave = async (id: string) => {
    try {
      await payrollLeaveApi.approve(id);
      if (leaveTarget) {
        const fresh = await payrollLeaveApi.listMemberLeave(
          leaveTarget.companyUserId,
          year,
          month,
        );
        setLeaveHistory(fresh);
      }
      await refreshMonthStats();
      await queryClient.invalidateQueries({ queryKey: payrollKeys.all });
      toast.success('Dam olish tasdiqlandi');
    } catch (e) {
      toast.error(formatApiError(e));
      throw e;
    }
  };

  const handleRejectLeave = async (id: string) => {
    try {
      await payrollLeaveApi.reject(id);
      if (leaveTarget) {
        const fresh = await payrollLeaveApi.listMemberLeave(
          leaveTarget.companyUserId,
          year,
          month,
        );
        setLeaveHistory(fresh);
      }
      toast.success('Rad etildi');
    } catch (e) {
      toast.error(formatApiError(e));
      throw e;
    }
  };

  const handleMarkEmployeeLeft = async (row: PayrollEmployeeRow) => {
    const label = formatPayrollMonth(year, month);
    if (
      !window.confirm(
        `${row.fullName} ishda ${label} oxirida tugatiladi. Keyingi oylarda ro‘yxatda ko‘rinmaydi. Davom etasizmi?`,
      )
    ) {
      return;
    }
    try {
      const leftAt = lastDayOfMonthKey(year, month);
      await payrollService.markEmployeeLeft(row.companyUserId, leftAt);
      await queryClient.invalidateQueries({ queryKey: payrollKeys.all });
      await refreshMonthStats();
      toast.success(`${row.fullName} — ${label} dan keyin yashiriladi`);
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const displayMonthStats = useMemo(
    () => enrichPayrollMonthStats(monthStats, rowsForMonth),
    [monthStats, rowsForMonth],
  );

  const stats = useMemo(() => {
    const withSalary = rowsForMonth.filter((r) => r.salary > 0).length;
    return {
      total: rowsForMonth.length,
      withSalary,
      ...displayMonthStats,
    };
  }, [rowsForMonth, displayMonthStats]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const updateLeavePolicy = async (
    memberId: string,
    policy?: AddPayrollEmployeePayload['leavePolicy'],
  ) => {
    if (!policy) return;
    try {
      await payrollLeaveApi.upsertMemberProfile(memberId, policy.monthlyPaidLeaveQuota);
    } catch {
      /* mock extra */
    }
    await payrollService.saveLeavePlan({
      companyUserId: memberId,
      year: policy.year,
      month: policy.month,
      dates: policy.leaveDates,
    });
  };

  const applyLeavePolicyOnCreate = async (
    memberId: string,
    policy?: AddPayrollEmployeePayload['leavePolicy'],
  ) => {
    await updateLeavePolicy(memberId, policy);
    if (!policy?.leaveDates.length) return;
    const ranges = mergeDateKeysToRanges(policy.leaveDates);
    for (const range of ranges) {
      try {
        await payrollLeaveApi.recordMemberLeave(memberId, {
          daysCount: range.daysCount,
          startDate: range.startDate,
          reason: 'Xodim qo‘shishda belgilangan dam olish',
        });
      } catch {
        /* API yo‘q bo‘lsa mock rejada qoladi */
      }
    }
  };

  const openEditEmployeeModal = async (row: PayrollEmployeeRow) => {
    setEmployeeModalMode('edit');
    setEmployeeModalOpen(true);
    setEmployeeModalLoading(true);
    setEmployeeFormInitial(null);
    try {
      const [extra, member, profile, plan] = await Promise.all([
        payrollService.getEmployeeExtra(row.companyUserId),
        payrollService.getMemberById(row.companyUserId),
        payrollLeaveApi
          .getMemberProfile(row.companyUserId)
          .catch(() => ({ monthlyPaidLeaveQuota: 0 })),
        payrollService.getLeavePlan(row.companyUserId, year, month),
      ]);

      const names =
        extra?.firstName || extra?.lastName
          ? {
              firstName: extra.firstName ?? '',
              lastName: extra.lastName ?? '',
            }
          : splitFullName(row.fullName);

      const quota =
        profile.monthlyPaidLeaveQuota > 0
          ? profile.monthlyPaidLeaveQuota
          : extra?.monthlyPaidLeaveQuota ?? DEFAULT_PAID_LEAVE_QUOTA;

      const memberPhone =
        (member as { user?: { phone?: string } })?.user?.phone ||
        extra?.phone ||
        '+998';

      setEmployeeFormInitial({
        companyUserId: row.companyUserId,
        firstName: names.firstName,
        lastName: names.lastName,
        position: extra?.position?.trim() || row.position,
        department: extra?.department?.trim() || row.department,
        role: extra?.role || member?.role || row.role,
        baseSalary: row.salary,
        currency: (row.currency === 'USD' ? 'USD' : 'UZS') as 'UZS' | 'USD',
        phone: memberPhone,
        address: extra?.address ?? '',
        notes: extra?.notes,
        login: member?.user?.login,
        warehouseId:
          (member as { warehouse?: { id: string } | null })?.warehouse?.id ?? '',
        leaveYear: year,
        leaveMonth: month,
        paidLeaveQuota: quota,
        leaveDates: plan?.dates ?? [],
      });
    } catch (e) {
      toast.error(formatApiError(e));
      setEmployeeModalOpen(false);
    } finally {
      setEmployeeModalLoading(false);
    }
  };

  const handleUpdateEmployee = async (payload: AddPayrollEmployeePayload) => {
    const memberId = payload.companyUserId;
    if (!memberId) return;
    setSavingEmployee(true);
    try {
      const fullName = `${payload.firstName} ${payload.lastName}`.trim();
      await payrollService.upsertCompensation({
        companyUserId: memberId,
        employeeName: fullName,
        employeeRole: payload.role,
        baseSalary: payload.baseSalary,
        currency: payload.currency,
      });
      await payrollService.saveEmployeeExtra({
        companyUserId: memberId,
        firstName: payload.firstName,
        lastName: payload.lastName,
        position: payload.position,
        department: payload.department,
        address: payload.address,
        notes: payload.notes,
        phone: payload.phone,
        role: payload.role,
        monthlyPaidLeaveQuota: payload.leavePolicy?.monthlyPaidLeaveQuota,
      });
      try {
        await usersService.updateMemberPhone(memberId, payload.phone);
      } catch {
        /* EMPLOYEES moduli o‘chiq bo‘lishi mumkin */
      }
      if (payload.role) {
        try {
          await usersService.updateMemberRole(
            memberId,
            payload.role,
            payload.warehouseId,
          );
        } catch {
          /* */
        }
      }
      await updateLeavePolicy(memberId, payload.leavePolicy);
      await queryClient.invalidateQueries({ queryKey: payrollKeys.all });
      await refreshMonthStats();
      toast.success('Xodim yangilandi');
      setEmployeeModalOpen(false);
      setEmployeeFormInitial(null);
    } catch (e) {
      toast.error(formatApiError(e));
      throw e;
    } finally {
      setSavingEmployee(false);
    }
  };

  const handleAddEmployee = async (payload: AddPayrollEmployeePayload) => {
    setSavingEmployee(true);
    try {
      const fullName = `${payload.firstName} ${payload.lastName}`.trim();
      const hasSystemAccess = Boolean(payload.login?.trim() && payload.password);
      let memberId: string;

      if (hasSystemAccess) {
        const inviteResult = await authService.inviteUser({
          fullName,
          login: payload.login!,
          password: payload.password!,
          role: payload.role,
          phone: payload.phone,
          warehouseId: payload.warehouseId,
        });

        memberId =
          (inviteResult as { companyUserId?: string })?.companyUserId ||
          (await usersService.getCompanyUsers()).find(
            (m: { id: string; user: { login: string; id: string } }) =>
              m.user?.login === payload.login?.trim() ||
              m.user?.id === inviteResult?.id,
          )?.id;

        if (!memberId) {
          throw new Error('Xodim yaratildi, lekin ro‘yxatda topilmadi. Sahifani yangilang.');
        }

        await payrollApi.addMemberToRoster(memberId);

        await payrollService.upsertCompensation({
          companyUserId: memberId,
          employeeName: fullName,
          employeeRole: payload.role,
          baseSalary: payload.baseSalary,
          currency: payload.currency,
        });

        await payrollService.saveEmployeeExtra({
          companyUserId: memberId,
          firstName: payload.firstName,
          lastName: payload.lastName,
          position: payload.position,
          department: payload.department,
          address: payload.address,
          notes: payload.notes,
          phone: payload.phone,
          role: payload.role,
          monthlyPaidLeaveQuota: payload.leavePolicy?.monthlyPaidLeaveQuota,
        });
      } else {
        const created = await payrollService.createPayrollOnlyEmployee({
          firstName: payload.firstName,
          lastName: payload.lastName,
          position: payload.position,
          department: payload.department,
          role: payload.role,
          phone: payload.phone,
          address: payload.address,
          notes: payload.notes,
          baseSalary: payload.baseSalary,
          currency: payload.currency,
          monthlyPaidLeaveQuota: payload.leavePolicy?.monthlyPaidLeaveQuota,
        });
        memberId = created.companyUserId;
      }

      await applyLeavePolicyOnCreate(memberId, payload.leavePolicy);

      await queryClient.invalidateQueries({ queryKey: payrollKeys.all });
      toast.success(
        hasSystemAccess ? 'Xodim qo‘shildi' : 'Xodim ish haqi ro‘yxatiga qo‘shildi',
      );
      setEmployeeModalOpen(false);
    } catch (e) {
      toast.error(formatApiError(e));
      throw e;
    } finally {
      setSavingEmployee(false);
    }
  };

  const handleEmployeeSubmit = async (payload: AddPayrollEmployeePayload) => {
    if (payload.companyUserId) {
      await handleUpdateEmployee(payload);
      return;
    }
    await handleAddEmployee(payload);
  };

  const handleSaveSalary = async (payload: { baseSalary: number; currency: 'UZS' | 'USD' }) => {
    if (!editing) return;
    try {
      await mutations.upsertCompensation.mutateAsync({
        companyUserId: editing.row.companyUserId,
        employeeName: editing.row.fullName,
        employeeRole: editing.row.role,
        baseSalary: payload.baseSalary,
        currency: payload.currency,
      });
      toast.success('Maosh saqlandi');
      setEditing(null);
    } catch (e) {
      toast.error(formatApiError(e));
      throw e;
    }
  };

  const loading = membersLoading || compLoading || accessLoading;

  const monthStatsSlice = useMemo(
    () => ({
      advancesByUser: stats.advancesByUser,
      paymentConfirmedByUser: stats.paymentConfirmedByUser,
      paidAmountByUser: stats.paidAmountByUser,
      bonusByUser: stats.bonusByUser ?? {},
    }),
    [
      stats.advancesByUser,
      stats.paymentConfirmedByUser,
      stats.paidAmountByUser,
      stats.bonusByUser,
    ],
  );

  const paidCardTotal =
    stats.totalPaidIncludingBonusUZS ??
    (stats.totalPaidUZS ?? 0) + (stats.totalBonusUZS ?? 0);

  const renderRowMenu = (row: PayrollEmployeeRow) =>
    canManage ? (
      <RowActionsMenu
        onEditEmployee={() => void openEditEmployeeModal(row)}
        showMarkLeft={row.status !== 'LEFT'}
        onMarkLeft={() => void handleMarkEmployeeLeft(row)}
        onEditSalary={() =>
          setEditing({
            row,
            member: {
              id: row.companyUserId,
              role: row.role,
              user: { fullName: row.fullName },
            },
          })
        }
      />
    ) : null;

  return (
    <div className="space-y-4 sm:space-y-6 pb-20 px-0 sm:px-0 max-w-[1600px]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white">
          Xodimlar
        </h1>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <PayrollWorkDaysSettings onChange={setWorkedDaysMode} />
          <label className="flex items-center gap-2 flex-1 sm:flex-none min-w-0 px-3 sm:px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm font-bold text-gray-300">
            <Calendar size={16} className="text-violet-400 shrink-0" />
            <select
              value={month}
              onChange={(e) => {
                setMonth(Number(e.target.value));
                setPage(1);
              }}
              className="bg-transparent outline-none cursor-pointer min-w-[100px]"
            >
              {PAYROLL_MONTH_NAMES.map((name, i) => (
                <option key={name} value={i + 1} className="bg-[#111]">
                  {name}
                </option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => {
                setYear(Number(e.target.value));
                setPage(1);
              }}
              className="bg-transparent outline-none cursor-pointer border-l border-white/10 pl-2"
            >
              {[year - 1, year, year + 1].map((y) => (
                <option key={y} value={y} className="bg-[#111]">
                  {y}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {loading ? (
        <PageSkeleton rows={8} />
      ) : (
        <>
          <p className="text-xs font-bold text-gray-600 -mt-2 mb-1 hidden sm:block">
            Avans berish → oylik to‘liq yopilganda «To‘langan oylik»; dam olish — alohida tugma
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard
              icon={Users}
              label="Jami xodimlar"
              value={stats.total.toLocaleString('uz-UZ')}
              sub={monthLabel}
              accent="text-white"
            />
            <StatCard
              icon={Banknote}
              label="Umumiy oylik fondi"
              value={formatPayrollMoney(stats.totalBaseSalaryUZS, 'UZS')}
              sub={
                stats.totalBaseSalaryUSD > 0
                  ? `${monthLabel} · + ${formatPayrollMoney(stats.totalBaseSalaryUSD, 'USD')}`
                  : `${monthLabel} · asosiy maoshlar`
              }
              accent="text-violet-300"
            />
            <StatCard
              icon={Wallet}
              label="To‘langan oylik"
              value={formatPayrollMoney(paidCardTotal, 'UZS')}
              sub={
                (stats.totalBonusUZS ?? 0) > 0
                  ? `${monthLabel} · oylik + bonus ${formatPayrollMoney(stats.totalBonusUZS, 'UZS')}`
                  : stats.paidEmployeeCount > 0
                    ? `${monthLabel} · ${stats.paidEmployeeCount} ta xodim`
                    : `${monthLabel} · to‘lov va bonuslar`
              }
              accent="text-emerald-300"
            />
            <StatCard
              icon={HandCoins}
              label="Berilgan avanslar"
              value={formatPayrollMoney(
                stats.totalOpenAdvancesUZS ?? 0,
                'UZS',
              )}
              sub={`${monthLabel} · oylik to‘liq yopilmagan xodimlar`}
              accent="text-amber-300"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto] gap-2 sm:gap-3 lg:items-center">
            <div className="relative sm:col-span-2 lg:col-span-1">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
                size={18}
              />
              <input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Xodim ismi yoki ID bo‘yicha qidirish..."
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm font-bold focus:outline-none focus:border-violet-500/40"
              />
            </div>
            <select
              value={department}
              onChange={(e) => {
                setDepartment(e.target.value);
                setPage(1);
              }}
              className="hidden md:block w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm font-bold text-gray-300"
            >
              <option value="" className="bg-[#111]">
                Barcha bo‘limlar
              </option>
              {departments.map((d) => (
                <option key={d} value={d} className="bg-[#111]">
                  {d}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as '' | PayrollEmployeeStatus);
                setPage(1);
              }}
              className="hidden md:block w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm font-bold text-gray-300"
            >
              {STATUS_FILTER_OPTIONS.map((o) => (
                <option key={o.label} value={o.value} className="bg-[#111]">
                  {o.label}
                </option>
              ))}
            </select>
            {canManage && (
              <div className="flex flex-col gap-2 w-full sm:col-span-2 lg:col-span-1">
                <button
                  type="button"
                  onClick={() => setExistingMemberModalOpen(true)}
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 font-black text-sm"
                >
                  <Users size={18} className="text-violet-400" />
                  Mavjud xodimni qo‘shish
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmployeeModalMode('add');
                    setEmployeeFormInitial(null);
                    setEmployeeModalOpen(true);
                  }}
                  className="flex items-center justify-center gap-2 w-full px-4 sm:px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-black text-sm whitespace-nowrap shadow-lg shadow-blue-600/20"
                >
                  <Plus size={18} />
                  Yangi xodim
                </button>
              </div>
            )}
          </div>

          {/* Mobil: kartalar */}
          <div className="md:hidden space-y-3">
            {pageRows.length === 0 ? (
              <div className="glass-card rounded-2xl border border-white/5 py-14 text-center text-gray-500 font-bold">
                Xodimlar topilmadi
              </div>
            ) : (
              pageRows.map((row) => (
                <PayrollEmployeeMobileCard
                  key={row.companyUserId}
                  row={row}
                  monthLabel={monthLabel}
                  leaveDays={monthLeaveDays[row.companyUserId] ?? 0}
                  stats={monthStatsSlice}
                  canManage={canManage}
                  onAdvance={() => setAdvanceTarget(row)}
                  onLeave={() => setLeaveTarget(row)}
                  onBonus={() => setBonusTarget(row)}
                  menuSlot={renderRowMenu(row)}
                />
              ))
            )}
          </div>

          {/* Planshet / desktop: jadval */}
          <div className="hidden md:block glass-card rounded-2xl border border-white/5 overflow-hidden">
            <div className="overflow-x-auto overscroll-x-contain">
              <table className="w-full text-sm min-w-[720px] lg:min-w-0">
                <thead>
                  <tr className="border-b border-white/5 bg-white/[0.02]">
                    <th className="text-left py-3 px-2 lg:px-4 text-[10px] font-black uppercase tracking-widest text-gray-500 hidden lg:table-cell">
                      ID
                    </th>
                    <th className="text-left py-3 px-2 lg:px-4 text-[10px] font-black uppercase tracking-widest text-gray-500 min-w-[140px]">
                      Xodim ismi
                    </th>
                    <th className="text-left py-3 px-2 lg:px-4 text-[10px] font-black uppercase tracking-widest text-gray-500 hidden lg:table-cell">
                      Lavozim
                    </th>
                    <th className="text-left py-3 px-2 lg:px-4 text-[10px] font-black uppercase tracking-widest text-gray-500 hidden xl:table-cell">
                      Bo‘lim
                    </th>
                    <th className="text-left py-3 px-2 lg:px-4 text-[10px] font-black uppercase tracking-widest text-gray-500 hidden md:table-cell">
                      Dam olish
                    </th>
                    <th className="text-right py-3 px-2 lg:px-4 text-[10px] font-black uppercase tracking-widest text-gray-500">
                      Maosh / to‘lov
                    </th>
                    <th className="text-center py-3 px-1.5 text-[10px] font-black uppercase tracking-widest text-gray-500 min-w-[220px]">
                      Amallar
                    </th>
                    <th className="w-10 lg:w-12 py-3 px-1" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center text-gray-500 font-bold">
                        Xodimlar topilmadi
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((row) => (
                      <tr
                        key={row.companyUserId}
                        className="hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="py-3 px-2 lg:px-4 font-mono text-xs font-bold text-gray-500 hidden lg:table-cell">
                          {row.employeeId}
                        </td>
                        <td className="py-3 px-2 lg:px-4">
                          <div className="flex items-center gap-2 lg:gap-3 min-w-0">
                            <div className="w-9 h-9 lg:w-10 lg:h-10 rounded-full bg-gradient-to-br from-violet-500/30 to-blue-500/20 border border-white/10 flex items-center justify-center text-sm font-black text-violet-300 shrink-0">
                              {row.initials}
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-white block truncate max-w-[200px] lg:max-w-none">
                                {row.fullName}
                              </span>
                              <span className="lg:hidden text-[10px] font-mono font-bold text-gray-600">
                                {row.employeeId}
                              </span>
                              <span className="md:hidden text-xs font-bold text-gray-500 truncate block">
                                {row.position}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-2 lg:px-4 text-gray-300 font-bold hidden lg:table-cell">
                          {row.position}
                        </td>
                        <td className="py-3 px-2 lg:px-4 hidden xl:table-cell">
                          <span className="inline-block px-2 lg:px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-xs font-bold text-gray-400">
                            {row.department}
                          </span>
                        </td>
                        <td className="py-3 px-2 lg:px-4 text-gray-400 font-bold hidden md:table-cell whitespace-nowrap">
                          {(monthLeaveDays[row.companyUserId] ?? 0) > 0
                            ? `${monthLeaveDays[row.companyUserId]} kun`
                            : '—'}
                        </td>
                        <td className="py-3 px-2 lg:px-4 text-right whitespace-nowrap">
                          {(() => {
                            const bonus =
                              stats.bonusByUser?.[row.companyUserId] ?? 0;
                            const sub = payrollSalarySubline({
                              salary: row.salary,
                              advancesTotal:
                                stats.advancesByUser[row.companyUserId] ?? 0,
                              paymentConfirmed:
                                stats.paymentConfirmedByUser[row.companyUserId],
                              paidAmount:
                                stats.paidAmountByUser[row.companyUserId],
                              bonus,
                            });
                            if (row.salary <= 0) {
                              return (
                                <span className="text-xs font-bold text-gray-600">—</span>
                              );
                            }
                            return (
                              <>
                                <p className="font-black text-white">
                                  {formatSalaryTableAmount(row.salary)}
                                </p>
                                {sub.kind === 'paid' && (
                                  <p className="text-[11px] font-bold text-emerald-400 mt-0.5">
                                    To‘langan:{' '}
                                    {formatSalaryTableAmount(sub.amount)}
                                  </p>
                                )}
                                {sub.kind === 'advance' && (
                                  <p className="text-[11px] font-bold text-amber-400 mt-0.5">
                                    Avans:{' '}
                                    {formatSalaryTableAmount(sub.amount)}
                                  </p>
                                )}
                                {bonus > 0 && (
                                  <p className="text-[11px] font-bold text-amber-300 mt-0.5">
                                    + Bonus: {formatSalaryTableAmount(bonus)}
                                  </p>
                                )}
                              </>
                            );
                          })()}
                        </td>
                        <td
                          className="py-2.5 px-1.5 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <EmployeeActionButtons
                            row={row}
                            advancesTotal={stats.advancesByUser[row.companyUserId] ?? 0}
                            canManage={canManage}
                            onAdvance={() => setAdvanceTarget(row)}
                            onLeave={() => setLeaveTarget(row)}
                            onBonus={() => setBonusTarget(row)}
                            paymentCompleted={
                              stats.paymentConfirmedByUser[row.companyUserId]
                            }
                            layout="row"
                          />
                        </td>
                        <td className="py-3 px-1" onClick={(e) => e.stopPropagation()}>
                          {renderRowMenu(row)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {filtered.length > 0 && (
            <div className="glass-card rounded-2xl border border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 px-3 sm:px-4 py-3 sm:py-4">
              <p className="text-xs font-bold text-gray-500 text-center sm:text-left w-full sm:w-auto">
                {filtered.length === 0
                  ? '0 ta xodim'
                  : `${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, filtered.length)} / ${filtered.length.toLocaleString('uz-UZ')}`}
              </p>
              <div className="flex items-center justify-center gap-1 w-full sm:w-auto">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="p-2 rounded-lg bg-white/5 border border-white/10 disabled:opacity-30 hover:bg-white/10"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="sm:hidden text-xs font-black text-gray-400 px-2 min-w-[4rem] text-center">
                  {safePage} / {totalPages}
                </span>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let num: number;
                  if (totalPages <= 5) {
                    num = i + 1;
                  } else if (safePage <= 3) {
                    num = i + 1;
                  } else if (safePage >= totalPages - 2) {
                    num = totalPages - 4 + i;
                  } else {
                    num = safePage - 2 + i;
                  }
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setPage(num)}
                      className={`hidden sm:inline-flex min-w-[36px] h-9 rounded-lg text-sm font-black items-center justify-center ${
                        num === safePage
                          ? 'bg-blue-600 text-white'
                          : 'bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      {num}
                    </button>
                  );
                })}
                {totalPages > 5 && safePage < totalPages - 2 && (
                  <span className="hidden sm:inline px-1 text-gray-600">…</span>
                )}
                {totalPages > 5 && (
                  <button
                    type="button"
                    onClick={() => setPage(totalPages)}
                    className={`hidden sm:inline-flex min-w-[36px] h-9 rounded-lg text-sm font-black items-center justify-center ${
                      safePage === totalPages
                        ? 'bg-blue-600 text-white'
                        : 'bg-white/5 border border-white/10 text-gray-400'
                    }`}
                  >
                    {totalPages}
                  </button>
                )}
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="p-2 rounded-lg bg-white/5 border border-white/10 disabled:opacity-30 hover:bg-white/10"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}

          {canManage && (
            <div className="pt-2">
              <PayrollLeaveRequestsPanel canReview />
            </div>
          )}
        </>
      )}

      <AddPayrollEmployeeModal
        open={employeeModalOpen}
        onClose={() => {
          setEmployeeModalOpen(false);
          setEmployeeFormInitial(null);
        }}
        mode={employeeModalMode}
        initial={employeeFormInitial}
        loadingInitial={employeeModalLoading}
        onSubmit={handleEmployeeSubmit}
        busy={savingEmployee}
      />

      <CompensationModal
        open={!!editing}
        employeeName={editing?.row.fullName ?? ''}
        initialSalary={editing?.row.salary || undefined}
        initialCurrency={editing?.row.currency === 'USD' ? 'USD' : 'UZS'}
        onClose={() => setEditing(null)}
        onSubmit={handleSaveSalary}
        busy={mutations.upsertCompensation.isPending}
      />

      <EmployeeAdvanceModal
        open={!!advanceTarget}
        onClose={() => setAdvanceTarget(null)}
        employeeName={advanceTarget?.fullName ?? ''}
        baseSalary={advanceTarget?.salary ?? 0}
        effectiveSalaryCap={
          advanceCapInfo.loading ? undefined : advanceCapInfo.effectiveSalaryCap
        }
        excessLeaveDays={advanceCapInfo.excessLeaveDays}
        leaveDaysUsed={advanceCapInfo.leaveDaysUsed}
        paidLeaveQuota={advanceCapInfo.paidLeaveQuota}
        totalWorkDays={advanceCapInfo.totalWorkDays}
        workedDaysForCap={advanceCapInfo.workedDaysForCap}
        year={year}
        month={month}
        advances={advanceHistory}
        advancesTotal={advanceTotalForTarget}
        onSubmit={handleAddAdvance}
        busy={advanceSaving}
        loadingHistory={advanceHistoryLoading}
        loadingCap={advanceCapInfo.loading}
      />

      <EmployeeBonusModal
        open={!!bonusTarget}
        onClose={() => setBonusTarget(null)}
        employeeName={bonusTarget?.fullName ?? ''}
        year={year}
        month={month}
        currentBonus={
          bonusTarget ? stats.bonusByUser?.[bonusTarget.companyUserId] ?? 0 : 0
        }
        onSubmit={handleAddBonus}
        busy={bonusSaving}
      />

      <EmployeeLeaveModal
        open={!!leaveTarget}
        onClose={() => setLeaveTarget(null)}
        employeeName={leaveTarget?.fullName ?? ''}
        year={year}
        month={month}
        leaves={leaveHistory}
        loading={leaveHistoryLoading}
        canManage={canManage}
        onRecordLeave={handleRecordLeave}
        onApprove={handleApproveLeave}
        onReject={handleRejectLeave}
        busy={leaveSaving}
      />

      <AddExistingPayrollMemberModal
        open={existingMemberModalOpen}
        onClose={() => setExistingMemberModalOpen(false)}
        onAdded={async (companyUserId, fullName) => {
          await queryClient.invalidateQueries({ queryKey: payrollKeys.all });
          setEditing({
            row: {
              companyUserId,
              employeeId: employeeIdLabel(companyUserId),
              fullName,
              initials: fullName.slice(0, 2).toUpperCase(),
              position: '—',
              department: '—',
              joinedLabel: '—',
              salary: 0,
              currency: 'UZS',
              status: 'ACTIVE',
              role: 'WORKER',
            },
            member: {
              id: companyUserId,
              role: 'WORKER',
              user: { fullName },
            },
          });
        }}
      />

    </div>
  );
}
