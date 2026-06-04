import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateExpenseCategoryDto,
  UpdateExpenseCategoryDto,
} from './dto/expense-category.dto';
import { CreateExpenseDto, RejectExpenseDto, UpdateExpenseDto } from './dto/expense.dto';

const DEFAULT_CATEGORIES = [
  'Ijara',
  'Transport',
  'Kommunal',
  'Ofis',
  'Reklama',
  'Xizmatlar',
  'Xodimlar oyligi',
  'Xodimlar avansi',
  'Soliq',
  'Boshqa',
];

const expenseInclude = {
  category: { select: { id: true, name: true } },
  createdBy: { select: { id: true, fullName: true, login: true } },
  approvedBy: { select: { id: true, fullName: true, login: true } },
} as const;

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeCurrency(currency?: string): string {
    return String(currency || 'UZS').toUpperCase() === 'USD' ? 'USD' : 'UZS';
  }

  private async ensureDefaultCategories(companyId: string) {
    await this.prisma.expenseCategory.createMany({
      data: DEFAULT_CATEGORIES.map((name, index) => ({
        companyId,
        name,
        sortOrder: index,
      })),
      skipDuplicates: true,
    });
  }

  async listCategories(companyId: string, includeInactive = false) {
    await this.ensureDefaultCategories(companyId);
    return this.prisma.expenseCategory.findMany({
      where: {
        companyId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async createCategory(companyId: string, dto: CreateExpenseCategoryDto) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Kategoriya nomi bo‘sh bo‘lmasligi kerak');

    const existing = await this.prisma.expenseCategory.findFirst({
      where: { companyId, name: { equals: name, mode: 'insensitive' } },
    });
    if (existing) {
      throw new BadRequestException('Bunday kategoriya allaqachon mavjud');
    }

    return this.prisma.expenseCategory.create({
      data: {
        companyId,
        name,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateCategory(companyId: string, id: string, dto: UpdateExpenseCategoryDto) {
    const cat = await this.prisma.expenseCategory.findFirst({ where: { id, companyId } });
    if (!cat) throw new NotFoundException('Kategoriya topilmadi');

    if (dto.name?.trim()) {
      const dup = await this.prisma.expenseCategory.findFirst({
        where: {
          companyId,
          id: { not: id },
          name: { equals: dto.name.trim(), mode: 'insensitive' },
        },
      });
      if (dup) throw new BadRequestException('Bunday kategoriya allaqachon mavjud');
    }

    return this.prisma.expenseCategory.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async getSummary(
    companyId: string,
    params: { from?: string; to?: string; currency?: string },
  ) {
    const currency = params.currency ? this.normalizeCurrency(params.currency) : undefined;
    const where: Prisma.ExpenseWhereInput = { companyId };
    if (currency) where.currency = currency;
    if (params.from || params.to) {
      where.expenseDate = {};
      if (params.from) where.expenseDate.gte = new Date(params.from);
      if (params.to) {
        const to = new Date(params.to);
        to.setHours(23, 59, 59, 999);
        where.expenseDate.lte = to;
      }
    }

    const rows = await this.prisma.expense.groupBy({
      by: ['status', 'currency'],
      where,
      _sum: { amount: true },
      _count: { id: true },
    });

    const pending: Record<string, number> = {};
    const approved: Record<string, number> = {};
    const rejected: Record<string, number> = {};
    let pendingCount = 0;
    let approvedCount = 0;
    let rejectedCount = 0;

    for (const row of rows) {
      const amt = Number(row._sum.amount || 0);
      const cur = row.currency;
      if (row.status === 'PENDING') {
        pending[cur] = (pending[cur] || 0) + amt;
        pendingCount += row._count.id;
      } else if (row.status === 'APPROVED') {
        approved[cur] = (approved[cur] || 0) + amt;
        approvedCount += row._count.id;
      } else if (row.status === 'REJECTED') {
        rejected[cur] = (rejected[cur] || 0) + amt;
        rejectedCount += row._count.id;
      }
    }

    return {
      pending,
      approved,
      rejected,
      counts: { pending: pendingCount, approved: approvedCount, rejected: rejectedCount },
    };
  }

  async findAll(
    companyId: string,
    params: {
      status?: string;
      categoryId?: string;
      from?: string;
      to?: string;
      search?: string;
      page?: string;
      limit?: string;
    },
  ) {
    const page = Math.max(1, parseInt(params.page || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(params.limit || '50', 10) || 50));
    const skip = (page - 1) * limit;

    const where: Prisma.ExpenseWhereInput = { companyId };
    if (params.status) where.status = params.status.toUpperCase();
    if (params.categoryId) where.categoryId = params.categoryId;
    if (params.from || params.to) {
      where.expenseDate = {};
      if (params.from) where.expenseDate.gte = new Date(params.from);
      if (params.to) {
        const to = new Date(params.to);
        to.setHours(23, 59, 59, 999);
        where.expenseDate.lte = to;
      }
    }
    if (params.search?.trim()) {
      const q = params.search.trim();
      where.OR = [
        { description: { contains: q, mode: 'insensitive' } },
        { notes: { contains: q, mode: 'insensitive' } },
        { category: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        include: expenseInclude,
        orderBy: [{ expenseDate: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.expense.count({ where }),
    ]);

    return {
      items: items.map((e) => this.serializeExpense(e)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findOne(companyId: string, id: string) {
    const expense = await this.prisma.expense.findFirst({
      where: { id, companyId },
      include: expenseInclude,
    });
    if (!expense) throw new NotFoundException('Xarajat topilmadi');
    return this.serializeExpense(expense);
  }

  private async assertCategory(companyId: string, categoryId: string) {
    const cat = await this.prisma.expenseCategory.findFirst({
      where: { id: categoryId, companyId, isActive: true },
    });
    if (!cat) throw new BadRequestException('Kategoriya topilmadi yoki faol emas');
    return cat;
  }

  async create(companyId: string, userId: string, dto: CreateExpenseDto) {
    await this.assertCategory(companyId, dto.categoryId);
    const expenseDate = new Date(dto.expenseDate);
    if (Number.isNaN(expenseDate.getTime())) {
      throw new BadRequestException('Sana noto‘g‘ri');
    }

    const expense = await this.prisma.expense.create({
      data: {
        companyId,
        categoryId: dto.categoryId,
        amount: dto.amount,
        currency: this.normalizeCurrency(dto.currency),
        expenseDate,
        description: dto.description?.trim() || null,
        notes: dto.notes?.trim() || null,
        status: 'PENDING',
        createdById: userId,
      },
      include: expenseInclude,
    });

    await this.prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: 'expense.create',
        entityType: 'EXPENSE',
        entityId: expense.id,
        newData: { amount: dto.amount, status: 'PENDING' } as Prisma.InputJsonValue,
      },
    });

    return this.serializeExpense(expense);
  }

  async update(
    companyId: string,
    userId: string,
    id: string,
    dto: UpdateExpenseDto,
    canManage: boolean,
  ) {
    const expense = await this.prisma.expense.findFirst({ where: { id, companyId } });
    if (!expense) throw new NotFoundException('Xarajat topilmadi');
    if (expense.status !== 'PENDING') {
      throw new BadRequestException('Faqat kutilayotgan xarajatni tahrirlash mumkin');
    }
    if (!canManage && expense.createdById !== userId) {
      throw new ForbiddenException('Faqat o‘z xarajatingizni tahrirlashingiz mumkin');
    }

    if (dto.categoryId) await this.assertCategory(companyId, dto.categoryId);

    const updated = await this.prisma.expense.update({
      where: { id },
      data: {
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
        ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
        ...(dto.currency !== undefined ? { currency: this.normalizeCurrency(dto.currency) } : {}),
        ...(dto.expenseDate !== undefined
          ? { expenseDate: new Date(dto.expenseDate) }
          : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
      },
      include: expenseInclude,
    });

    return this.serializeExpense(updated);
  }

  async approve(companyId: string, userId: string, id: string) {
    const expense = await this.prisma.expense.findFirst({ where: { id, companyId } });
    if (!expense) throw new NotFoundException('Xarajat topilmadi');
    if (expense.status !== 'PENDING') {
      throw new BadRequestException('Faqat kutilayotgan xarajat tasdiqlanadi');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.expense.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedById: userId,
          approvedAt: new Date(),
          rejectReason: null,
        },
        include: expenseInclude,
      });

      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: 'expense.approve',
          entityType: 'EXPENSE',
          entityId: id,
          newData: { status: 'APPROVED' } as Prisma.InputJsonValue,
        },
      });

      return row;
    });

    return this.serializeExpense(updated);
  }

  async reject(companyId: string, userId: string, id: string, dto: RejectExpenseDto) {
    const expense = await this.prisma.expense.findFirst({ where: { id, companyId } });
    if (!expense) throw new NotFoundException('Xarajat topilmadi');
    if (expense.status !== 'PENDING') {
      throw new BadRequestException('Faqat kutilayotgan xarajat rad etiladi');
    }

    const reason = dto.reason.trim();
    if (!reason) throw new BadRequestException('Rad etish sababi majburiy');

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.expense.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectReason: reason,
          approvedById: userId,
          approvedAt: new Date(),
        },
        include: expenseInclude,
      });

      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: 'expense.reject',
          entityType: 'EXPENSE',
          entityId: id,
          newData: { status: 'REJECTED', reason } as Prisma.InputJsonValue,
        },
      });

      return row;
    });

    return this.serializeExpense(updated);
  }

  async remove(companyId: string, userId: string, id: string, canManage: boolean) {
    const expense = await this.prisma.expense.findFirst({ where: { id, companyId } });
    if (!expense) throw new NotFoundException('Xarajat topilmadi');
    if (expense.status !== 'PENDING') {
      throw new BadRequestException('Faqat kutilayotgan xarajatni o‘chirish mumkin');
    }
    if (!canManage && expense.createdById !== userId) {
      throw new ForbiddenException('Faqat o‘z xarajatingizni o‘chirishingiz mumkin');
    }

    await this.prisma.expense.delete({ where: { id } });
    await this.prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: 'expense.delete',
        entityType: 'EXPENSE',
        entityId: id,
        oldData: { amount: Number(expense.amount) } as Prisma.InputJsonValue,
      },
    });

    return { success: true };
  }

  private serializeExpense(expense: {
    id: string;
    companyId: string;
    categoryId: string;
    amount: Prisma.Decimal;
    currency: string;
    expenseDate: Date;
    description: string | null;
    notes: string | null;
    status: string;
    rejectReason: string | null;
    createdById: string;
    approvedById: string | null;
    approvedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    category: { id: string; name: string };
    createdBy: { id: string; fullName: string; login: string };
    approvedBy: { id: string; fullName: string; login: string } | null;
  }) {
    return {
      ...expense,
      amount: Number(expense.amount),
    };
  }
}
