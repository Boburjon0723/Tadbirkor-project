import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CompaniesService } from '../companies/companies.service';
import {
  computeEffectiveSalaryCap,
  computeFinalPayrollPayment,
  decimalToNumber,
} from './payroll-calculation.util';
import { PayrollLeaveService } from './payroll-leave.service';
import {
  countLeaveWeekdaysInMonth,
  countWeekdaysInMonth,
  parseDateOnly,
} from './payroll-work-days.util';
import {
  AddPayrollAdvanceDto,
  AddPayrollBonusDto,
  CreatePayrollOnlyMemberDto,
  MarkEmployeeLeftDto,
  UpsertCompensationDto,
  UpsertPayrollEmployeeDto,
  UpsertPayrollSettlementDto,
} from './dto/payroll-employee.dto';

const PAYROLL_MANAGER_ROLES = ['OWNER', 'MANAGER'] as const;
const PAYROLL_LEAVE_STATUS = { APPROVED: 'APPROVED' } as const;

@Injectable()
export class PayrollDataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companiesService: CompaniesService,
    private readonly payrollLeave: PayrollLeaveService,
  ) {}

  private async assertPayrollModule(companyId: string) {
    await this.companiesService.assertModuleEnabled(companyId, 'PAYROLL');
  }

  private async assertPayrollManager(companyId: string, actorUserId: string) {
    const member = await this.prisma.companyUser.findFirst({
      where: { companyId, userId: actorUserId },
    });
    if (!member) throw new ForbiddenException('Kompaniya a’zosi emas');
    const role = String(member.role || '')
      .trim()
      .toUpperCase();
    if (!PAYROLL_MANAGER_ROLES.includes(role as (typeof PAYROLL_MANAGER_ROLES)[number])) {
      throw new ForbiddenException('Faqat owner yoki menejer tahrirlaydi');
    }
    return member;
  }

  private async assertMember(companyId: string, companyUserId: string) {
    const row = await this.prisma.companyUser.findFirst({
      where: { id: companyUserId, companyId },
      include: {
        user: { select: { id: true, fullName: true, login: true } },
      },
    });
    if (!row) throw new NotFoundException('Xodim topilmadi');
    return row;
  }

  mapProfileToExtra(
    companyUserId: string,
    profile: {
      firstName?: string | null;
      lastName?: string | null;
      position?: string | null;
      department?: string | null;
      address?: string | null;
      email?: string | null;
      notes?: string | null;
      phone?: string | null;
      monthlyPaidLeaveQuota?: number;
      leftAt?: Date | null;
      employmentStatus?: string | null;
      updatedAt?: Date;
    } | null,
    createdAt?: Date,
  ) {
    if (!profile) return null;
    return {
      companyUserId,
      firstName: profile.firstName ?? undefined,
      lastName: profile.lastName ?? undefined,
      position: profile.position ?? undefined,
      department: profile.department ?? undefined,
      address: profile.address ?? undefined,
      email: profile.email ?? undefined,
      notes: profile.notes ?? undefined,
      phone: profile.phone ?? undefined,
      monthlyPaidLeaveQuota: profile.monthlyPaidLeaveQuota ?? 0,
      leftAt: profile.leftAt
        ? profile.leftAt.toISOString().slice(0, 10)
        : null,
      employmentStatus: (profile.employmentStatus || 'ACTIVE') as
        | 'ACTIVE'
        | 'LEAVE'
        | 'LEFT',
      createdAt: createdAt?.toISOString(),
    };
  }

  mapCompensation(row: {
    id: string;
    companyUserId: string;
    employeeName: string;
    employeeRole: string;
    baseSalary: Prisma.Decimal;
    currency: string;
    effectiveFrom: Date;
    isActive: boolean;
  }) {
    return {
      id: row.id,
      companyUserId: row.companyUserId,
      employeeName: row.employeeName,
      employeeRole: row.employeeRole,
      baseSalary: decimalToNumber(row.baseSalary),
      currency: row.currency as 'UZS' | 'USD',
      effectiveFrom: row.effectiveFrom.toISOString().slice(0, 10),
      isActive: row.isActive,
    };
  }

  private async markOnPayrollRoster(companyUserId: string) {
    await this.prisma.employeePayrollProfile.upsert({
      where: { companyUserId },
      create: { companyUserId, onPayrollRoster: true },
      update: { onPayrollRoster: true },
    });
  }

  async listCompensations(companyId: string) {
    await this.assertPayrollModule(companyId);
    const rows = await this.prisma.employeeCompensation.findMany({
      where: {
        companyId,
        isActive: true,
        companyUser: { payrollProfile: { is: { onPayrollRoster: true } } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((r) => this.mapCompensation(r));
  }

  async upsertCompensation(companyId: string, actorUserId: string, dto: UpsertCompensationDto) {
    await this.assertPayrollManager(companyId, actorUserId);
    await this.assertMember(companyId, dto.companyUserId);

    const effectiveFrom = dto.effectiveFrom
      ? parseDateOnly(dto.effectiveFrom)
      : new Date();

    const existing = await this.prisma.employeeCompensation.findFirst({
      where: { companyId, companyUserId: dto.companyUserId, isActive: true },
    });

    if (existing) {
      const updated = await this.prisma.employeeCompensation.update({
        where: { id: existing.id },
        data: {
          employeeName: dto.employeeName.trim(),
          employeeRole: dto.employeeRole,
          baseSalary: dto.baseSalary,
          currency: dto.currency ?? 'UZS',
          effectiveFrom,
        },
      });
      await this.markOnPayrollRoster(dto.companyUserId);
      return this.mapCompensation(updated);
    }

    const created = await this.prisma.employeeCompensation.create({
      data: {
        companyId,
        companyUserId: dto.companyUserId,
        employeeName: dto.employeeName.trim(),
        employeeRole: dto.employeeRole,
        baseSalary: dto.baseSalary,
        currency: dto.currency ?? 'UZS',
        effectiveFrom,
      },
    });
    await this.markOnPayrollRoster(dto.companyUserId);
    return this.mapCompensation(created);
  }

  /** Kompaniya xodimlari — hali oylik ro‘yxatida bo‘lmaganlar */
  async listRosterCandidates(companyId: string) {
    await this.assertPayrollModule(companyId);
    const rows = await this.prisma.companyUser.findMany({
      where: {
        companyId,
        role: { not: 'OWNER' },
        OR: [
          { payrollProfile: null },
          { payrollProfile: { onPayrollRoster: false } },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            login: true,
            phone: true,
            status: true,
          },
        },
        warehouse: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((m) => ({
      id: m.id,
      role: m.role,
      createdAt: m.createdAt,
      user: m.user,
      warehouse: m.warehouse,
    }));
  }

  async addMemberToPayrollRoster(
    companyId: string,
    actorUserId: string,
    companyUserId: string,
  ) {
    await this.assertPayrollManager(companyId, actorUserId);
    const member = await this.assertMember(companyId, companyUserId);
    await this.markOnPayrollRoster(companyUserId);
    return {
      companyUserId,
      fullName: member.user.fullName,
    };
  }

  async listEmployeeExtras(companyId: string) {
    await this.assertPayrollModule(companyId);
    const members = await this.prisma.companyUser.findMany({
      where: {
        companyId,
        role: { not: 'OWNER' },
        payrollProfile: { is: { onPayrollRoster: true } },
      },
      include: { payrollProfile: true },
    });
    return members
      .map((m) => this.mapProfileToExtra(m.id, m.payrollProfile, m.createdAt))
      .filter(Boolean);
  }

  async getEmployeeExtra(companyId: string, companyUserId: string) {
    await this.assertPayrollModule(companyId);
    const member = await this.prisma.companyUser.findFirst({
      where: { id: companyUserId, companyId },
      include: { payrollProfile: true },
    });
    if (!member) throw new NotFoundException('Xodim topilmadi');
    return (
      this.mapProfileToExtra(member.id, member.payrollProfile, member.createdAt) ?? {
        companyUserId,
      }
    );
  }

  async upsertEmployeeExtra(
    companyId: string,
    actorUserId: string,
    companyUserId: string,
    dto: UpsertPayrollEmployeeDto,
  ) {
    await this.assertPayrollManager(companyId, actorUserId);
    await this.assertMember(companyId, companyUserId);

    const leftAt = dto.leftAt ? parseDateOnly(dto.leftAt) : null;

    const profile = await this.prisma.employeePayrollProfile.upsert({
      where: { companyUserId },
      create: {
        companyUserId,
        firstName: dto.firstName?.trim() || null,
        lastName: dto.lastName?.trim() || null,
        position: dto.position?.trim() || null,
        department: dto.department?.trim() || null,
        address: dto.address?.trim() || null,
        email: dto.email?.trim() || null,
        notes: dto.notes?.trim() || null,
        phone: dto.phone?.trim() || null,
        monthlyPaidLeaveQuota: dto.monthlyPaidLeaveQuota ?? 0,
        onPayrollRoster: true,
        leftAt,
        employmentStatus: dto.employmentStatus ?? 'ACTIVE',
      },
      update: {
        onPayrollRoster: true,
        ...(dto.firstName !== undefined && { firstName: dto.firstName.trim() || null }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName.trim() || null }),
        ...(dto.position !== undefined && { position: dto.position.trim() || null }),
        ...(dto.department !== undefined && { department: dto.department.trim() || null }),
        ...(dto.address !== undefined && { address: dto.address.trim() || null }),
        ...(dto.email !== undefined && { email: dto.email.trim() || null }),
        ...(dto.notes !== undefined && { notes: dto.notes.trim() || null }),
        ...(dto.phone !== undefined && { phone: dto.phone.trim() || null }),
        ...(dto.monthlyPaidLeaveQuota !== undefined && {
          monthlyPaidLeaveQuota: dto.monthlyPaidLeaveQuota,
        }),
        ...(dto.leftAt !== undefined && { leftAt }),
        ...(dto.employmentStatus !== undefined && {
          employmentStatus: dto.employmentStatus,
        }),
      },
    });

    const member = await this.prisma.companyUser.findUnique({
      where: { id: companyUserId },
    });

    if (dto.role && member && dto.role !== member.role) {
      await this.prisma.companyUser.update({
        where: { id: companyUserId },
        data: { role: dto.role },
      });
    }

    return this.mapProfileToExtra(companyUserId, profile, member?.createdAt);
  }

  async createPayrollOnlyMember(
    companyId: string,
    actorUserId: string,
    dto: CreatePayrollOnlyMemberDto,
  ) {
    await this.assertPayrollManager(companyId, actorUserId);

    const fullName = `${dto.firstName} ${dto.lastName}`.trim();
    const loginSuffix = Date.now().toString(36);
    const login = `pay.${loginSuffix}`;
    const passwordHash = await bcrypt.hash(
      `payroll-${loginSuffix}-${Math.random().toString(36).slice(2)}`,
      10,
    );

    let phone = dto.phone.trim();
    const phoneTaken = await this.prisma.user.findUnique({ where: { phone } });
    if (phoneTaken) {
      phone = `+99899${Math.floor(1000000 + Math.random() * 8999999)}`;
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          fullName,
          login,
          passwordHash,
          phone,
          status: 'active',
        },
      });

      const companyUser = await tx.companyUser.create({
        data: {
          companyId,
          userId: user.id,
          role: dto.role,
        },
      });

      await tx.employeePayrollProfile.create({
        data: {
          companyUserId: companyUser.id,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          position: dto.position.trim(),
          department: dto.department.trim(),
          address: dto.address?.trim() || null,
          notes: dto.notes?.trim() || null,
          phone: dto.phone.trim(),
          monthlyPaidLeaveQuota: dto.monthlyPaidLeaveQuota ?? 0,
          onPayrollRoster: true,
        },
      });

      await tx.employeeCompensation.create({
        data: {
          companyId,
          companyUserId: companyUser.id,
          employeeName: fullName,
          employeeRole: dto.role,
          baseSalary: dto.baseSalary,
          currency: dto.currency ?? 'UZS',
        },
      });

      return { companyUserId: companyUser.id };
    });

    return result;
  }

  async markEmployeeLeft(
    companyId: string,
    actorUserId: string,
    companyUserId: string,
    dto: MarkEmployeeLeftDto,
  ) {
    await this.assertPayrollManager(companyId, actorUserId);
    await this.assertMember(companyId, companyUserId);
    const leftAt = parseDateOnly(dto.leftAt);

    await this.prisma.employeePayrollProfile.upsert({
      where: { companyUserId },
      create: {
        companyUserId,
        leftAt,
        employmentStatus: 'LEFT',
      },
      update: {
        leftAt,
        employmentStatus: 'LEFT',
      },
    });

    return { companyUserId, leftAt: leftAt.toISOString().slice(0, 10) };
  }

  async getActiveCompensation(companyId: string, companyUserId: string) {
    await this.assertPayrollModule(companyId);
    const row = await this.prisma.employeeCompensation.findFirst({
      where: { companyId, companyUserId, isActive: true },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (!row) return null;
    return {
      baseSalary: decimalToNumber(row.baseSalary),
      currency: row.currency,
      employeeName: row.employeeName,
    };
  }

  async sumAdvances(
    companyId: string,
    companyUserId: string,
    year: number,
    month: number,
  ) {
    await this.assertPayrollModule(companyId);
    const agg = await this.prisma.employeePayrollAdvance.aggregate({
      where: { companyId, companyUserId, year, month },
      _sum: { amount: true },
    });
    return decimalToNumber(agg._sum.amount);
  }

  async listAdvances(
    companyId: string,
    companyUserId: string,
    year: number,
    month: number,
  ) {
    await this.assertPayrollModule(companyId);
    const rows = await this.prisma.employeePayrollAdvance.findMany({
      where: { companyId, companyUserId, year, month },
      orderBy: { advanceDate: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      companyUserId: r.companyUserId,
      year: r.year,
      month: r.month,
      amount: decimalToNumber(r.amount),
      advanceDate: r.advanceDate.toISOString().slice(0, 10),
      reason: r.reason,
    }));
  }

  async addAdvance(companyId: string, actorUserId: string, dto: AddPayrollAdvanceDto) {
    await this.assertPayrollManager(companyId, actorUserId);
    await this.assertMember(companyId, dto.companyUserId);

    const advanceDate = dto.advanceDate
      ? parseDateOnly(dto.advanceDate)
      : new Date();

    const row = await this.prisma.employeePayrollAdvance.create({
      data: {
        companyId,
        companyUserId: dto.companyUserId,
        year: dto.year,
        month: dto.month,
        amount: dto.amount,
        advanceDate,
        reason: dto.reason.trim(),
      },
    });

    const paymentCompleted = await this.syncPaymentIfAdvancesCoverSalary(
      companyId,
      dto.companyUserId,
      dto.year,
      dto.month,
    );

    return {
      id: row.id,
      companyUserId: row.companyUserId,
      year: row.year,
      month: row.month,
      amount: decimalToNumber(row.amount),
      advanceDate: row.advanceDate.toISOString().slice(0, 10),
      reason: row.reason,
      paymentCompleted,
    };
  }

  /** Avanslar oylik (yoki ish kunlari bo‘yicha limit) ni qoplaganda to‘lov tasdiqlanadi */
  private async syncPaymentIfAdvancesCoverSalary(
    companyId: string,
    companyUserId: string,
    year: number,
    month: number,
  ): Promise<boolean> {
    const compensation = await this.prisma.employeeCompensation.findFirst({
      where: { companyId, companyUserId, isActive: true },
      orderBy: { effectiveFrom: 'desc' },
    });
    const baseSalary = decimalToNumber(compensation?.baseSalary);
    if (baseSalary <= 0) return false;

    const workMonth = await this.payrollLeave.getWorkMonth(
      companyId,
      companyUserId,
      year,
      month,
    );
    const salaryCap = computeEffectiveSalaryCap(
      baseSalary,
      workMonth.totalDays,
      workMonth.workedDays,
    );
    if (salaryCap <= 0) return false;

    const advances = await this.listAdvances(companyId, companyUserId, year, month);
    const advancesTotal = advances.reduce((sum, a) => sum + a.amount, 0);
    if (advancesTotal < salaryCap) return false;

    const existing = await this.prisma.employeePayrollSettlement.findUnique({
      where: {
        companyUserId_year_month: { companyUserId, year, month },
      },
    });

    await this.prisma.employeePayrollSettlement.upsert({
      where: {
        companyUserId_year_month: { companyUserId, year, month },
      },
      create: {
        companyId,
        companyUserId,
        year,
        month,
        baseSalary,
        totalDays: workMonth.totalDays,
        workedDays: workMonth.workedDays,
        bonus: 0,
        penalties: 0,
        paymentConfirmedAt: new Date(),
      },
      update: {
        baseSalary,
        totalDays: workMonth.totalDays,
        workedDays: workMonth.workedDays,
        bonus: existing ? existing.bonus : 0,
        penalties: existing ? existing.penalties : 0,
        paymentConfirmedAt: new Date(),
      },
    });

    return true;
  }

  async addBonus(companyId: string, actorUserId: string, dto: AddPayrollBonusDto) {
    await this.assertPayrollManager(companyId, actorUserId);
    await this.assertMember(companyId, dto.companyUserId);

    const compensation = await this.prisma.employeeCompensation.findFirst({
      where: { companyId, companyUserId: dto.companyUserId, isActive: true },
      orderBy: { effectiveFrom: 'desc' },
    });
    const baseSalary = decimalToNumber(compensation?.baseSalary);
    if (baseSalary <= 0) {
      throw new BadRequestException('Avval oylik maosh belgilang');
    }

    const workMonth = await this.payrollLeave.getWorkMonth(
      companyId,
      dto.companyUserId,
      dto.year,
      dto.month,
    );

    const existing = await this.prisma.employeePayrollSettlement.findUnique({
      where: {
        companyUserId_year_month: {
          companyUserId: dto.companyUserId,
          year: dto.year,
          month: dto.month,
        },
      },
    });

    const currentBonus = existing ? decimalToNumber(existing.bonus) : 0;
    const newBonus = currentBonus + dto.amount;

    const row = await this.prisma.employeePayrollSettlement.upsert({
      where: {
        companyUserId_year_month: {
          companyUserId: dto.companyUserId,
          year: dto.year,
          month: dto.month,
        },
      },
      create: {
        companyId,
        companyUserId: dto.companyUserId,
        year: dto.year,
        month: dto.month,
        baseSalary,
        totalDays: workMonth.totalDays,
        workedDays: workMonth.workedDays,
        bonus: dto.amount,
        penalties: 0,
        paymentConfirmedAt: existing?.paymentConfirmedAt ?? null,
      },
      update: {
        baseSalary,
        totalDays: workMonth.totalDays,
        workedDays: workMonth.workedDays,
        bonus: newBonus,
        penalties: existing ? existing.penalties : 0,
      },
    });

    return {
      companyUserId: dto.companyUserId,
      year: dto.year,
      month: dto.month,
      amountAdded: dto.amount,
      bonusTotal: decimalToNumber(row.bonus),
      reason: dto.reason?.trim() || null,
    };
  }

  async getSettlement(
    companyId: string,
    companyUserId: string,
    year: number,
    month: number,
    defaultBaseSalary = 0,
  ) {
    await this.assertPayrollModule(companyId);
    const row = await this.prisma.employeePayrollSettlement.findUnique({
      where: {
        companyUserId_year_month: { companyUserId, year, month },
      },
    });

    if (row) {
      return {
        companyUserId,
        year,
        month,
        baseSalary: decimalToNumber(row.baseSalary),
        totalDays: row.totalDays,
        workedDays: row.workedDays,
        bonus: decimalToNumber(row.bonus),
        penalties: decimalToNumber(row.penalties),
        paymentConfirmedAt: row.paymentConfirmedAt?.toISOString() ?? null,
      };
    }

    const totalDays = countWeekdaysInMonth(year, month);
    const workedDays = Math.max(totalDays - 1, 1);
    return {
      companyUserId,
      year,
      month,
      baseSalary: defaultBaseSalary,
      totalDays,
      workedDays,
      bonus: 0,
      penalties: 0,
      paymentConfirmedAt: null,
    };
  }

  async upsertSettlement(
    companyId: string,
    actorUserId: string,
    companyUserId: string,
    year: number,
    month: number,
    dto: UpsertPayrollSettlementDto,
  ) {
    await this.assertPayrollManager(companyId, actorUserId);
    await this.assertMember(companyId, companyUserId);

    const paymentConfirmedAt = dto.confirmPayment ? new Date() : undefined;

    const row = await this.prisma.employeePayrollSettlement.upsert({
      where: {
        companyUserId_year_month: { companyUserId, year, month },
      },
      create: {
        companyId,
        companyUserId,
        year,
        month,
        baseSalary: dto.baseSalary,
        totalDays: dto.totalDays,
        workedDays: dto.workedDays,
        bonus: dto.bonus ?? 0,
        penalties: dto.penalties ?? 0,
        paymentConfirmedAt: paymentConfirmedAt ?? null,
      },
      update: {
        baseSalary: dto.baseSalary,
        totalDays: dto.totalDays,
        workedDays: dto.workedDays,
        bonus: dto.bonus ?? 0,
        penalties: dto.penalties ?? 0,
        ...(dto.confirmPayment ? { paymentConfirmedAt: new Date() } : {}),
      },
    });

    const advances = await this.listAdvances(companyId, companyUserId, year, month);
    const advancesTotal = advances.reduce((sum, a) => sum + a.amount, 0);
    const finalAmount = computeFinalPayrollPayment({
      baseSalary: dto.baseSalary,
      totalDays: dto.totalDays,
      workedDays: dto.workedDays,
      bonus: dto.bonus ?? 0,
      penalties: dto.penalties ?? 0,
      advancesTotal,
    });

    return {
      calculation: {
        companyUserId,
        year,
        month,
        baseSalary: decimalToNumber(row.baseSalary),
        totalDays: row.totalDays,
        workedDays: row.workedDays,
        bonus: decimalToNumber(row.bonus),
        penalties: decimalToNumber(row.penalties),
        paymentConfirmedAt: row.paymentConfirmedAt?.toISOString() ?? null,
      },
      finalAmount,
      advancesTotal,
    };
  }

  async getMonthStats(
    companyId: string,
    year: number,
    month: number,
    companyUserIds: string[],
  ) {
    await this.assertPayrollModule(companyId);
    const idSet = new Set(companyUserIds);

    const compensations = await this.prisma.employeeCompensation.findMany({
      where: { companyId, isActive: true, companyUserId: { in: companyUserIds } },
    });

    let totalBaseSalaryUZS = 0;
    let totalBaseSalaryUSD = 0;
    for (const c of compensations) {
      if (!idSet.has(c.companyUserId)) continue;
      const amount = decimalToNumber(c.baseSalary);
      if (c.currency === 'USD') totalBaseSalaryUSD += amount;
      else totalBaseSalaryUZS += amount;
    }

    const advances = await this.prisma.employeePayrollAdvance.findMany({
      where: { companyId, year, month, companyUserId: { in: companyUserIds } },
    });

    let totalAdvancesUZS = 0;
    const advancesByUser: Record<string, number> = {};
    for (const id of companyUserIds) advancesByUser[id] = 0;
    for (const a of advances) {
      const amount = decimalToNumber(a.amount);
      totalAdvancesUZS += amount;
      advancesByUser[a.companyUserId] =
        (advancesByUser[a.companyUserId] || 0) + amount;
    }

    const settlements = await this.prisma.employeePayrollSettlement.findMany({
      where: {
        companyId,
        year,
        month,
        companyUserId: { in: companyUserIds },
        paymentConfirmedAt: { not: null },
      },
    });

    let totalPaidUZS = 0;
    let paidEmployeeCount = 0;
    const paidAmountByUser: Record<string, number> = {};
    const paymentConfirmedByUser: Record<string, boolean> = {};
    for (const id of companyUserIds) {
      paidAmountByUser[id] = 0;
      paymentConfirmedByUser[id] = false;
    }

    for (const calc of settlements) {
      if (!idSet.has(calc.companyUserId)) continue;
      paymentConfirmedByUser[calc.companyUserId] = true;
      paidEmployeeCount += 1;
      const advancesTotal = advancesByUser[calc.companyUserId] || 0;
      paidAmountByUser[calc.companyUserId] = advancesTotal;
      totalPaidUZS += advancesTotal;
    }

    const compByUser = new Map(
      compensations.map((c) => [c.companyUserId, c]),
    );

    for (const id of companyUserIds) {
      if (paymentConfirmedByUser[id]) continue;
      const advancesTotal = advancesByUser[id] || 0;
      if (advancesTotal <= 0) continue;
      const comp = compByUser.get(id);
      if (!comp) continue;
      const baseSalary = decimalToNumber(comp.baseSalary);
      if (baseSalary <= 0) continue;

      const workMonth = await this.payrollLeave.getWorkMonth(
        companyId,
        id,
        year,
        month,
      );
      const salaryCap = computeEffectiveSalaryCap(
        baseSalary,
        workMonth.totalDays,
        workMonth.workedDays,
      );
      if (advancesTotal < salaryCap) continue;

      await this.syncPaymentIfAdvancesCoverSalary(companyId, id, year, month);
      paymentConfirmedByUser[id] = true;
      paidAmountByUser[id] = advancesTotal;
      totalPaidUZS += advancesTotal;
      paidEmployeeCount += 1;
    }

    let totalOpenAdvancesUZS = 0;
    for (const id of companyUserIds) {
      if (paymentConfirmedByUser[id]) continue;
      totalOpenAdvancesUZS += advancesByUser[id] || 0;
    }

    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 0));
    const leaveRows = await this.prisma.employeeLeaveRequest.findMany({
      where: {
        companyId,
        companyUserId: { in: companyUserIds },
        status: PAYROLL_LEAVE_STATUS.APPROVED,
        startDate: { lte: monthEnd },
        endDate: { gte: monthStart },
      },
    });

    const leaveDaysByUser: Record<string, number> = {};
    for (const id of companyUserIds) leaveDaysByUser[id] = 0;
    for (const leave of leaveRows) {
      leaveDaysByUser[leave.companyUserId] =
        (leaveDaysByUser[leave.companyUserId] || 0) +
        countLeaveWeekdaysInMonth(leave.startDate, leave.endDate, year, month);
    }

    const allSettlements = await this.prisma.employeePayrollSettlement.findMany({
      where: {
        companyId,
        year,
        month,
        companyUserId: { in: companyUserIds },
      },
    });

    let totalBonusUZS = 0;
    const bonusByUser: Record<string, number> = {};
    for (const id of companyUserIds) bonusByUser[id] = 0;
    for (const s of allSettlements) {
      if (!idSet.has(s.companyUserId)) continue;
      const bonus = decimalToNumber(s.bonus);
      if (bonus <= 0) continue;
      bonusByUser[s.companyUserId] = bonus;
      totalBonusUZS += bonus;
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
  }
}
