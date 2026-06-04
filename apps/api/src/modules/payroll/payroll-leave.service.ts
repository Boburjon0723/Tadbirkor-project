import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CompaniesService } from '../companies/companies.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { CreateMemberLeaveDto } from './dto/create-member-leave.dto';
import {
  addDaysUtc,
  countLeaveWeekdaysInMonth,
  countWeekdaysInMonth,
  countWeekdaysInclusive,
  formatDateOnlyUz,
  monthsTouchedByRange,
  parseDateOnly,
  toDateOnlyUtc,
} from './payroll-work-days.util';

export const PAYROLL_LEAVE_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const;

export const STAFF_ROLES_FOR_LEAVE = [
  'WORKER',
  'FIELD_WORKER',
  'WAREHOUSE',
  'SALES',
  'ACCOUNTANT',
] as const;

export const LEAVE_APPROVER_ROLES = ['OWNER', 'MANAGER'] as const;

const PAYROLL_MODULE_ASSERT_MS = 120_000;

@Injectable()
export class PayrollLeaveService {
  private readonly payrollModuleAssertUntil = new Map<string, number>();
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notifications: NotificationsService,
    private readonly companiesService: CompaniesService,
  ) {}

  async assertPayrollModule(companyId: string) {
    const until = this.payrollModuleAssertUntil.get(companyId);
    if (until != null && until > Date.now()) return;
    await this.companiesService.assertModuleEnabled(companyId, 'PAYROLL');
    this.payrollModuleAssertUntil.set(companyId, Date.now() + PAYROLL_MODULE_ASSERT_MS);
  }

  private async getMembership(companyId: string, userId: string) {
    const member = await this.prisma.companyUser.findFirst({
      where: { companyId, userId },
      include: { user: { select: { id: true, fullName: true, login: true } } },
    });
    if (!member) throw new ForbiddenException('Kompaniya a’zosi emas');
    return member;
  }

  private endDateFromStartAndDays(start: Date, daysCount: number): Date {
    return addDaysUtc(start, Math.max(0, daysCount - 1));
  }

  private async assertNoLeaveOverlap(
    companyUserId: string,
    startDate: Date,
    endDate: Date,
  ) {
    const overlapping = await this.prisma.employeeLeaveRequest.findFirst({
      where: {
        companyUserId,
        status: { in: ['PENDING', 'APPROVED'] },
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    });
    if (overlapping) {
      throw new BadRequestException('Bu sanalarda allaqachon dam olish mavjud');
    }
  }

  private leaveInclude() {
    return {
      companyUser: {
        include: { user: { select: { id: true, fullName: true, login: true } } },
      },
    } as const;
  }

  async getSettings(companyId: string) {
    await this.assertPayrollModule(companyId);
    const row = await this.prisma.payrollCompanySettings.findUnique({
      where: { companyId },
    });
    return {
      workedDaysMode: (row?.workedDaysMode || 'AUTO') as 'AUTO' | 'MANUAL',
    };
  }

  async updateSettings(companyId: string, workedDaysMode: 'AUTO' | 'MANUAL') {
    await this.assertPayrollModule(companyId);
    return this.prisma.payrollCompanySettings.upsert({
      where: { companyId },
      create: { companyId, workedDaysMode },
      update: { workedDaysMode },
    });
  }

  async createLeaveRequest(
    companyId: string,
    userId: string,
    dto: CreateLeaveRequestDto,
  ) {
    await this.assertPayrollModule(companyId);
    const member = await this.getMembership(companyId, userId);
    const role = String(member.role || '').toUpperCase();
    if (!STAFF_ROLES_FOR_LEAVE.includes(role as (typeof STAFF_ROLES_FOR_LEAVE)[number])) {
      throw new ForbiddenException('Dam olish so‘rovi faqat xodimlar uchun');
    }

    const startDate = parseDateOnly(dto.startDate);
    const endDate = this.endDateFromStartAndDays(startDate, dto.daysCount);
    const weekdays = countWeekdaysInclusive(startDate, endDate);
    if (weekdays < 1) {
      throw new BadRequestException('Tanlangan oralig‘da ish kuni yo‘q (dam olish kunlari)');
    }

    await this.assertNoLeaveOverlap(member.id, startDate, endDate);

    const request = await this.prisma.employeeLeaveRequest.create({
      data: {
        companyId,
        companyUserId: member.id,
        startDate,
        endDate,
        daysCount: dto.daysCount,
        reason: dto.reason?.trim() || null,
        status: PAYROLL_LEAVE_STATUS.PENDING,
      },
      include: this.leaveInclude(),
    });

    await this.notifyLeavePending(companyId, request);
    return request;
  }

  private async notifyLeavePending(
    companyId: string,
    request: {
      id: string;
      startDate: Date;
      endDate: Date;
      daysCount: number;
      reason: string | null;
      companyUser: { user: { fullName: string } };
    },
  ) {
    const name = request.companyUser.user.fullName;
    const range = `${formatDateOnlyUz(request.startDate)} — ${formatDateOnlyUz(request.endDate)}`;
    const reasonLine = request.reason ? `\nSabab: ${request.reason}` : '';

    await this.notifications.notifyCompanyRoles(
      companyId,
      [...LEAVE_APPROVER_ROLES],
      'Dam olish so‘rovi',
      `${name} — ${request.daysCount} kun (${range}).${reasonLine}`,
      'WARNING',
      {
        moduleKey: 'PAYROLL',
        eventKey: 'payroll.leave.requested',
        details: {
          leaveRequestId: request.id,
          employeeName: name,
          daysCount: request.daysCount,
          startDate: request.startDate.toISOString().slice(0, 10),
          endDate: request.endDate.toISOString().slice(0, 10),
        },
        targetRoles: [...LEAVE_APPROVER_ROLES],
        actions: [
          {
            key: 'LEAVE_APPROVE',
            label: '✅ Tasdiqlash',
            targetType: 'EMPLOYEE_LEAVE_REQUEST',
            targetId: request.id,
          },
          {
            key: 'LEAVE_REJECT',
            label: '❌ Rad etish',
            targetType: 'EMPLOYEE_LEAVE_REQUEST',
            targetId: request.id,
          },
        ],
      },
    );
  }

  async listLeaveRequests(
    companyId: string,
    userId: string,
    filters?: { status?: string; mine?: boolean },
  ) {
    await this.assertPayrollModule(companyId);
    const member = await this.getMembership(companyId, userId);
    const role = String(member.role || '').toUpperCase();
    const isApprover = LEAVE_APPROVER_ROLES.includes(
      role as (typeof LEAVE_APPROVER_ROLES)[number],
    );

    const where: any = { companyId };
    if (filters?.status) where.status = filters.status.toUpperCase();
    if (filters?.mine || !isApprover) {
      where.companyUserId = member.id;
    }

    return this.prisma.employeeLeaveRequest.findMany({
      where,
      orderBy: { requestedAt: 'desc' },
      take: 100,
      include: this.leaveInclude(),
    });
  }

  async listMemberLeaveRequests(
    companyId: string,
    actorUserId: string,
    companyUserId: string,
    year?: number,
    month?: number,
  ) {
    await this.assertPayrollModule(companyId);
    const actor = await this.getMembership(companyId, actorUserId);
    const role = String(actor.role || '').toUpperCase();
    const isApprover = LEAVE_APPROVER_ROLES.includes(
      role as (typeof LEAVE_APPROVER_ROLES)[number],
    );
    if (!isApprover && actor.id !== companyUserId) {
      throw new ForbiddenException('Ruxsat yo‘q');
    }

    const target = await this.prisma.companyUser.findFirst({
      where: { id: companyUserId, companyId },
    });
    if (!target) throw new NotFoundException('Xodim topilmadi');

    const where: any = { companyId, companyUserId };
    if (year && month) {
      const monthStart = new Date(Date.UTC(year, month - 1, 1));
      const monthEnd = new Date(Date.UTC(year, month, 0));
      where.startDate = { lte: monthEnd };
      where.endDate = { gte: monthStart };
    }

    return this.prisma.employeeLeaveRequest.findMany({
      where,
      orderBy: [{ startDate: 'desc' }, { requestedAt: 'desc' }],
      take: 50,
      include: this.leaveInclude(),
    });
  }

  async recordLeaveForMember(
    companyId: string,
    actorUserId: string,
    companyUserId: string,
    dto: CreateMemberLeaveDto,
  ) {
    await this.assertPayrollModule(companyId);
    const actor = await this.getMembership(companyId, actorUserId);
    const role = String(actor.role || '').toUpperCase();
    if (
      !LEAVE_APPROVER_ROLES.includes(role as (typeof LEAVE_APPROVER_ROLES)[number])
    ) {
      throw new ForbiddenException('Faqat owner yoki menejer dam olish yozadi');
    }

    const target = await this.prisma.companyUser.findFirst({
      where: { id: companyUserId, companyId },
      include: { user: { select: { id: true, fullName: true } } },
    });
    if (!target) throw new NotFoundException('Xodim topilmadi');

    const startDate = parseDateOnly(dto.startDate);
    const endDate = this.endDateFromStartAndDays(startDate, dto.daysCount);
    const weekdays = countWeekdaysInclusive(startDate, endDate);
    if (weekdays < 1) {
      throw new BadRequestException('Tanlangan oralig‘da dam olish kuni yo‘q');
    }

    await this.assertNoLeaveOverlap(companyUserId, startDate, endDate);

    const created = await this.prisma.employeeLeaveRequest.create({
      data: {
        companyId,
        companyUserId,
        startDate,
        endDate,
        daysCount: dto.daysCount,
        reason: dto.reason?.trim() || null,
        status: PAYROLL_LEAVE_STATUS.APPROVED,
        reviewedAt: new Date(),
        reviewedByUserId: actorUserId,
        reviewNote: 'Platformada qo‘lda kiritildi',
      },
      include: this.leaveInclude(),
    });

    await this.recalculateWorkMonthsAfterLeave(companyId, companyUserId, {
      startDate,
      endDate,
    });

    await this.notifications.create(
      target.user.id,
      'Dam olish qayd etildi',
      `${formatDateOnlyUz(startDate)} — ${formatDateOnlyUz(endDate)} (${dto.daysCount} kun).`,
      'INFO',
      { moduleKey: 'PAYROLL', eventKey: 'payroll.leave.recorded' },
    );

    return created;
  }

  async countPendingLeave(companyId: string, userId: string) {
    await this.assertPayrollModule(companyId);
    const member = await this.getMembership(companyId, userId);
    const role = String(member.role || '').toUpperCase();
    if (
      !LEAVE_APPROVER_ROLES.includes(role as (typeof LEAVE_APPROVER_ROLES)[number])
    ) {
      return { count: 0 };
    }
    const count = await this.prisma.employeeLeaveRequest.count({
      where: { companyId, status: PAYROLL_LEAVE_STATUS.PENDING },
    });
    return { count };
  }

  async approveLeaveRequest(
    companyId: string,
    reviewerUserId: string,
    requestId: string,
    reviewNote?: string,
    channel: 'WEB' | 'TELEGRAM' = 'WEB',
  ) {
    void channel;
    await this.assertPayrollModule(companyId);
    const reviewer = await this.getMembership(companyId, reviewerUserId);
    const role = String(reviewer.role || '').toUpperCase();
    if (
      !LEAVE_APPROVER_ROLES.includes(role as (typeof LEAVE_APPROVER_ROLES)[number])
    ) {
      throw new ForbiddenException('Faqat owner yoki menejer tasdiqlaydi');
    }

    const request = await this.prisma.employeeLeaveRequest.findFirst({
      where: { id: requestId, companyId },
      include: {
        companyUser: { include: { user: { select: { id: true, fullName: true } } } },
      },
    });
    if (!request) throw new NotFoundException('So‘rov topilmadi');
    if (request.status !== PAYROLL_LEAVE_STATUS.PENDING) {
      throw new BadRequestException('So‘rov allaqachon ko‘rib chiqilgan');
    }

    const updated = await this.prisma.employeeLeaveRequest.update({
      where: { id: requestId },
      data: {
        status: PAYROLL_LEAVE_STATUS.APPROVED,
        reviewedAt: new Date(),
        reviewedByUserId: reviewerUserId,
        reviewNote: reviewNote?.trim() || null,
      },
      include: {
        companyUser: { include: { user: { select: { id: true, fullName: true } } } },
      },
    });

    await this.recalculateWorkMonthsAfterLeave(companyId, updated.companyUserId, {
      startDate: updated.startDate,
      endDate: updated.endDate,
    });

    await this.notifications.create(
      updated.companyUser.user.id,
      'Dam olish tasdiqlandi',
      `${formatDateOnlyUz(updated.startDate)} — ${formatDateOnlyUz(updated.endDate)} (${updated.daysCount} kun).`,
      'SUCCESS',
      { moduleKey: 'PAYROLL', eventKey: 'payroll.leave.approved' },
    );

    return updated;
  }

  async rejectLeaveRequest(
    companyId: string,
    reviewerUserId: string,
    requestId: string,
    reviewNote?: string,
    channel: 'WEB' | 'TELEGRAM' = 'WEB',
  ) {
    void channel;
    await this.assertPayrollModule(companyId);
    const reviewer = await this.getMembership(companyId, reviewerUserId);
    const role = String(reviewer.role || '').toUpperCase();
    if (
      !LEAVE_APPROVER_ROLES.includes(role as (typeof LEAVE_APPROVER_ROLES)[number])
    ) {
      throw new ForbiddenException('Faqat owner yoki menejer rad etadi');
    }

    const request = await this.prisma.employeeLeaveRequest.findFirst({
      where: { id: requestId, companyId },
      include: {
        companyUser: { include: { user: { select: { id: true, fullName: true } } } },
      },
    });
    if (!request) throw new NotFoundException('So‘rov topilmadi');
    if (request.status !== PAYROLL_LEAVE_STATUS.PENDING) {
      throw new BadRequestException('So‘rov allaqachon ko‘rib chiqilgan');
    }

    const updated = await this.prisma.employeeLeaveRequest.update({
      where: { id: requestId },
      data: {
        status: PAYROLL_LEAVE_STATUS.REJECTED,
        reviewedAt: new Date(),
        reviewedByUserId: reviewerUserId,
        reviewNote: reviewNote?.trim() || null,
      },
      include: {
        companyUser: { include: { user: { select: { id: true, fullName: true } } } },
      },
    });

    await this.notifications.create(
      updated.companyUser.user.id,
      'Dam olish rad etildi',
      reviewNote?.trim()
        ? `Sabab: ${reviewNote.trim()}`
        : 'So‘rovingiz rad etildi. Batafsil — menejer bilan bog‘laning.',
      'WARNING',
      { moduleKey: 'PAYROLL', eventKey: 'payroll.leave.rejected' },
    );

    return updated;
  }

  async recalculateWorkMonthsAfterLeave(
    companyId: string,
    companyUserId: string,
    range: { startDate: Date; endDate: Date },
  ) {
    const settings = await this.getSettings(companyId);
    if (settings.workedDaysMode === 'MANUAL') return;

    const months = monthsTouchedByRange(range.startDate, range.endDate);
    for (const { year, month } of months) {
      await this.syncWorkMonthAuto(companyId, companyUserId, year, month);
    }
  }

  async syncWorkMonthAuto(
    companyId: string,
    companyUserId: string,
    year: number,
    month: number,
  ) {
    const existing = await this.prisma.employeeWorkMonth.findUnique({
      where: { companyUserId_year_month: { companyUserId, year, month } },
    });
    if (existing?.isManual) return;

    const totalDays = countWeekdaysInMonth(year, month);
    const approvedLeaves = await this.prisma.employeeLeaveRequest.findMany({
      where: {
        companyUserId,
        companyId,
        status: PAYROLL_LEAVE_STATUS.APPROVED,
        startDate: { lte: new Date(Date.UTC(year, month, 0)) },
        endDate: { gte: new Date(Date.UTC(year, month - 1, 1)) },
      },
    });

    let leaveDays = 0;
    for (const leave of approvedLeaves) {
      leaveDays += countLeaveWeekdaysInMonth(
        leave.startDate,
        leave.endDate,
        year,
        month,
      );
    }

    const profile = await this.prisma.employeePayrollProfile.findUnique({
      where: { companyUserId },
    });
    const paidQuota = profile?.monthlyPaidLeaveQuota ?? 0;
    const salaryDeductLeave = Math.max(0, leaveDays - paidQuota);

    const workedDays = Math.max(0, totalDays - salaryDeductLeave);

    await this.prisma.employeeWorkMonth.upsert({
      where: { companyUserId_year_month: { companyUserId, year, month } },
      create: {
        companyId,
        companyUserId,
        year,
        month,
        totalDays,
        workedDays,
        isManual: false,
      },
      update: {
        totalDays,
        workedDays,
        isManual: false,
      },
    });
  }

  async getWorkMonth(
    companyId: string,
    companyUserId: string,
    year: number,
    month: number,
  ) {
    await this.assertPayrollModule(companyId);
    const settings = await this.getSettings(companyId);
    let row = await this.prisma.employeeWorkMonth.findUnique({
      where: { companyUserId_year_month: { companyUserId, year, month } },
    });
    if (!row && settings.workedDaysMode === 'AUTO') {
      await this.syncWorkMonthAuto(companyId, companyUserId, year, month);
      row = await this.prisma.employeeWorkMonth.findUnique({
        where: { companyUserId_year_month: { companyUserId, year, month } },
      });
    }
    if (!row) {
      const totalDays = countWeekdaysInMonth(year, month);
      return {
        companyUserId,
        year,
        month,
        totalDays,
        workedDays: totalDays,
        isManual: false,
        source: 'default' as const,
      };
    }
    return { ...row, source: row.isManual ? ('manual' as const) : ('auto' as const) };
  }

  async updateWorkMonthManual(
    companyId: string,
    actorUserId: string,
    companyUserId: string,
    year: number,
    month: number,
    payload: { workedDays?: number; totalDays?: number },
  ) {
    await this.assertPayrollModule(companyId);
    const actor = await this.getMembership(companyId, actorUserId);
    const role = String(actor.role || '').toUpperCase();
    if (
      !LEAVE_APPROVER_ROLES.includes(role as (typeof LEAVE_APPROVER_ROLES)[number])
    ) {
      throw new ForbiddenException('Faqat owner yoki menejer tahrirlaydi');
    }

    const member = await this.prisma.companyUser.findFirst({
      where: { id: companyUserId, companyId },
    });
    if (!member) throw new NotFoundException('Xodim topilmadi');

    const totalDays =
      payload.totalDays ?? countWeekdaysInMonth(year, month);
    const workedDays =
      payload.workedDays ??
      (await this.getWorkMonth(companyId, companyUserId, year, month)).workedDays;

    if (workedDays > totalDays) {
      throw new BadRequestException('Ishlangan kun umumiy kundan ko‘p bo‘lmasin');
    }

    return this.prisma.employeeWorkMonth.upsert({
      where: { companyUserId_year_month: { companyUserId, year, month } },
      create: {
        companyId,
        companyUserId,
        year,
        month,
        totalDays,
        workedDays,
        isManual: true,
      },
      update: {
        totalDays,
        workedDays,
        isManual: true,
      },
    });
  }

  async listApprovedLeaveDays(
    companyId: string,
    companyUserId: string,
    year: number,
    month: number,
  ) {
    await this.assertPayrollModule(companyId);
    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 0));
    return this.prisma.employeeLeaveRequest.findMany({
      where: {
        companyId,
        companyUserId,
        status: PAYROLL_LEAVE_STATUS.APPROVED,
        startDate: { lte: monthEnd },
        endDate: { gte: monthStart },
      },
      orderBy: { startDate: 'asc' },
    });
  }

  async upsertPayrollProfile(
    companyId: string,
    actorUserId: string,
    companyUserId: string,
    monthlyPaidLeaveQuota: number,
  ) {
    await this.assertPayrollModule(companyId);
    const actor = await this.getMembership(companyId, actorUserId);
    const role = String(actor.role || '').toUpperCase();
    if (
      !LEAVE_APPROVER_ROLES.includes(role as (typeof LEAVE_APPROVER_ROLES)[number])
    ) {
      throw new ForbiddenException('Faqat owner yoki menejer tahrirlaydi');
    }

    const target = await this.prisma.companyUser.findFirst({
      where: { id: companyUserId, companyId },
    });
    if (!target) throw new NotFoundException('Xodim topilmadi');

    return this.prisma.employeePayrollProfile.upsert({
      where: { companyUserId },
      create: { companyUserId, monthlyPaidLeaveQuota },
      update: { monthlyPaidLeaveQuota },
    });
  }

  /** Bitta xodim (oylik ro‘yxati) — bot kartochkasi uchun */
  async getRosterMember(companyId: string, companyUserId: string) {
    await this.assertPayrollModule(companyId);
    const member = await this.prisma.companyUser.findFirst({
      where: {
        id: companyUserId,
        companyId,
        role: { not: 'OWNER' },
        payrollProfile: { is: { onPayrollRoster: true } },
      },
      include: {
        user: { select: { id: true, fullName: true } },
      },
    });
    if (!member) throw new NotFoundException('Xodim topilmadi');
    return member;
  }

  /** AUTO rejimda yozuvsiz — syncsiz (Telegram bot tezligi uchun) */
  async getWorkMonthForBot(
    companyId: string,
    companyUserId: string,
    year: number,
    month: number,
  ) {
    await this.assertPayrollModule(companyId);
    const settings = await this.getSettings(companyId);
    const totalDays = countWeekdaysInMonth(year, month);
    if (settings.workedDaysMode !== 'MANUAL') {
      return {
        totalDays,
        workedDays: totalDays,
        isManual: false,
        workedDaysMode: settings.workedDaysMode as 'AUTO' | 'MANUAL',
      };
    }
    const row = await this.prisma.employeeWorkMonth.findUnique({
      where: { companyUserId_year_month: { companyUserId, year, month } },
    });
    if (!row) {
      return {
        totalDays,
        workedDays: totalDays,
        isManual: false,
        workedDaysMode: 'MANUAL' as const,
      };
    }
    return {
      totalDays: row.totalDays,
      workedDays: row.workedDays,
      isManual: row.isManual,
      workedDaysMode: 'MANUAL' as const,
    };
  }

  /** Ish haqi sahifasi — faqat oylik ro‘yxatiga qo‘shilgan xodimlar */
  async listCompanyMembers(companyId: string) {
    await this.assertPayrollModule(companyId);
    return this.prisma.companyUser.findMany({
      where: {
        companyId,
        role: { not: 'OWNER' },
        payrollProfile: { is: { onPayrollRoster: true } },
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            login: true,
            email: true,
            phone: true,
            telegramChatId: true,
            telegramLinkedAt: true,
          },
        },
        warehouse: {
          select: { id: true, name: true, status: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getPayrollProfile(companyId: string, companyUserId: string) {
    await this.assertPayrollModule(companyId);
    const row = await this.prisma.employeePayrollProfile.findUnique({
      where: { companyUserId },
    });
    if (!row) {
      return { monthlyPaidLeaveQuota: 0 };
    }
    return {
      monthlyPaidLeaveQuota: row.monthlyPaidLeaveQuota ?? 0,
      firstName: row.firstName,
      lastName: row.lastName,
      position: row.position,
      department: row.department,
      address: row.address,
      email: row.email,
      notes: row.notes,
      phone: row.phone,
      leftAt: row.leftAt?.toISOString().slice(0, 10) ?? null,
      employmentStatus: row.employmentStatus,
    };
  }

  /** Bot: tez so‘rov (kunlar + boshlanish offset) */
  async createLeaveFromBot(
    companyId: string,
    userId: string,
    daysCount: number,
    startOffsetDays: number,
    reason?: string,
  ) {
    const start = addDaysUtc(toDateOnlyUtc(new Date()), startOffsetDays);
    return this.createLeaveRequest(companyId, userId, {
      daysCount,
      startDate: start.toISOString().slice(0, 10),
      reason,
    });
  }
}
