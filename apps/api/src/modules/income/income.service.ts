import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateIncomeCategoryDto, UpdateIncomeCategoryDto } from './dto/income-category.dto';
import { CreateIncomeDto, UpdateIncomeDto } from './dto/income.dto';

const DEFAULT_CATEGORIES = [
  'Savdo',
  'POS savdo',
  'B2B savdo',
  'Qarz qaytimi',
  'Xizmat haqi',
  'Investitsiya',
  'Boshqa',
];

const incomeInclude = {
  category: { select: { id: true, name: true } },
  createdBy: { select: { id: true, fullName: true, login: true } },
} as const;

@Injectable()
export class IncomeService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeCurrency(currency?: string): string {
    return String(currency || 'UZS').toUpperCase() === 'USD' ? 'USD' : 'UZS';
  }

  private async ensureDefaultCategories(companyId: string) {
    await this.prisma.incomeCategory.createMany({
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
    return this.prisma.incomeCategory.findMany({
      where: {
        companyId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async createCategory(companyId: string, dto: CreateIncomeCategoryDto) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Kategoriya nomi bo‘sh bo‘lmasligi kerak');

    const existing = await this.prisma.incomeCategory.findFirst({
      where: { companyId, name: { equals: name, mode: 'insensitive' } },
    });
    if (existing) throw new BadRequestException('Bunday kategoriya allaqachon mavjud');

    return this.prisma.incomeCategory.create({
      data: {
        companyId,
        name,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateCategory(companyId: string, id: string, dto: UpdateIncomeCategoryDto) {
    const cat = await this.prisma.incomeCategory.findFirst({ where: { id, companyId } });
    if (!cat) throw new NotFoundException('Kategoriya topilmadi');

    if (dto.name?.trim()) {
      const dup = await this.prisma.incomeCategory.findFirst({
        where: {
          companyId,
          id: { not: id },
          name: { equals: dto.name.trim(), mode: 'insensitive' },
        },
      });
      if (dup) throw new BadRequestException('Bunday kategoriya allaqachon mavjud');
    }

    return this.prisma.incomeCategory.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async findAll(
    companyId: string,
    params: {
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

    const where: Prisma.IncomeWhereInput = { companyId };
    if (params.categoryId) where.categoryId = params.categoryId;
    if (params.from || params.to) {
      where.incomeDate = {};
      if (params.from) where.incomeDate.gte = new Date(params.from);
      if (params.to) {
        const to = new Date(params.to);
        to.setHours(23, 59, 59, 999);
        where.incomeDate.lte = to;
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
      this.prisma.income.findMany({
        where,
        include: incomeInclude,
        orderBy: [{ incomeDate: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.income.count({ where }),
    ]);

    return {
      items: items.map((income) => this.serializeIncome(income)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findOne(companyId: string, id: string) {
    const income = await this.prisma.income.findFirst({
      where: { id, companyId },
      include: incomeInclude,
    });
    if (!income) throw new NotFoundException('Kirim topilmadi');
    return this.serializeIncome(income);
  }

  private async assertCategory(companyId: string, categoryId: string) {
    const cat = await this.prisma.incomeCategory.findFirst({
      where: { id: categoryId, companyId, isActive: true },
    });
    if (!cat) throw new BadRequestException('Kategoriya topilmadi yoki faol emas');
    return cat;
  }

  async create(companyId: string, userId: string, dto: CreateIncomeDto) {
    await this.assertCategory(companyId, dto.categoryId);
    const incomeDate = new Date(dto.incomeDate);
    if (Number.isNaN(incomeDate.getTime())) throw new BadRequestException('Sana noto‘g‘ri');

    const income = await this.prisma.income.create({
      data: {
        companyId,
        categoryId: dto.categoryId,
        amount: dto.amount,
        currency: this.normalizeCurrency(dto.currency),
        incomeDate,
        description: dto.description?.trim() || null,
        notes: dto.notes?.trim() || null,
        createdById: userId,
      },
      include: incomeInclude,
    });

    await this.prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: 'income.create',
        entityType: 'INCOME',
        entityId: income.id,
        newData: { amount: dto.amount } as Prisma.InputJsonValue,
      },
    });

    return this.serializeIncome(income);
  }

  async update(
    companyId: string,
    userId: string,
    id: string,
    dto: UpdateIncomeDto,
    canManage: boolean,
  ) {
    const income = await this.prisma.income.findFirst({ where: { id, companyId } });
    if (!income) throw new NotFoundException('Kirim topilmadi');
    if (!canManage && income.createdById !== userId) {
      throw new ForbiddenException('Faqat o‘z kirimingizni tahrirlashingiz mumkin');
    }

    if (dto.categoryId) await this.assertCategory(companyId, dto.categoryId);

    const updated = await this.prisma.income.update({
      where: { id },
      data: {
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
        ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
        ...(dto.currency !== undefined ? { currency: this.normalizeCurrency(dto.currency) } : {}),
        ...(dto.incomeDate !== undefined ? { incomeDate: new Date(dto.incomeDate) } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
      },
      include: incomeInclude,
    });

    return this.serializeIncome(updated);
  }

  async remove(companyId: string, userId: string, id: string, canManage: boolean) {
    const income = await this.prisma.income.findFirst({ where: { id, companyId } });
    if (!income) throw new NotFoundException('Kirim topilmadi');
    if (!canManage && income.createdById !== userId) {
      throw new ForbiddenException('Faqat o‘z kirimingizni o‘chirishingiz mumkin');
    }

    await this.prisma.income.delete({ where: { id } });
    await this.prisma.auditLog.create({
      data: {
        companyId,
        userId,
        action: 'income.delete',
        entityType: 'INCOME',
        entityId: id,
        oldData: { amount: Number(income.amount) } as Prisma.InputJsonValue,
      },
    });

    return { success: true };
  }

  private serializeIncome(income: {
    id: string;
    companyId: string;
    categoryId: string;
    amount: Prisma.Decimal;
    currency: string;
    incomeDate: Date;
    description: string | null;
    notes: string | null;
    createdById: string;
    createdAt: Date;
    updatedAt: Date;
    category: { id: string; name: string };
    createdBy: { id: string; fullName: string; login: string };
  }) {
    return {
      ...income,
      amount: Number(income.amount),
    };
  }
}
