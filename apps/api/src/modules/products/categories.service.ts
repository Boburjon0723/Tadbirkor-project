import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppCacheService } from '../../common/cache/app-cache.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Injectable()
export class CategoriesService {
  private readonly cacheTtlMs = Number(process.env.CATEGORY_CACHE_TTL_MS || 5 * 60 * 1000);

  constructor(
    private prisma: PrismaService,
    private cache: AppCacheService,
  ) {}

  private cacheKey(companyId: string, warehouseId: string) {
    return `categories:${companyId}:${warehouseId || '*'}`;
  }

  private invalidateCompany(companyId: string) {
    void this.cache.delByPrefix(`categories:${companyId}:`);
  }

  async create(companyId: string, dto: CreateCategoryDto) {
    if (!dto.warehouseId) {
      throw new BadRequestException('Kategoriya uchun ombor tanlash majburiy.');
    }
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: dto.warehouseId, companyId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!warehouse) {
      throw new BadRequestException('Tanlangan ombor topilmadi yoki faol emas.');
    }
    const created = await this.prisma.productCategory.create({
      data: {
        companyId,
        warehouseId: warehouse.id,
        name: dto.name,
        parentId: dto.parentId,
        status: dto.status || 'ACTIVE',
      },
    });
    this.invalidateCompany(companyId);
    return created;
  }

  async findAll(companyId: string, query?: { warehouseId?: string }) {
    const warehouseId = (query?.warehouseId || '').trim();
    const key = this.cacheKey(companyId, warehouseId);
    const cached = await this.cache.getJson<unknown[]>(key);
    if (cached) return cached;

    const rows = await this.prisma.productCategory.findMany({
      where: {
        companyId,
        status: { not: 'ARCHIVED' },
        ...(warehouseId ? { warehouseId } : {}),
      },
      include: { parent: true, warehouse: true },
      orderBy: { createdAt: 'desc' },
    });
    await this.cache.setJson(key, rows, this.cacheTtlMs);
    return rows;
  }

  async findOne(id: string, companyId: string) {
    const category = await this.prisma.productCategory.findFirst({
      where: { id, companyId },
      include: { children: true, parent: true, warehouse: true },
    });
    if (!category) throw new NotFoundException('Kategoriya topilmadi');
    return category;
  }

  async update(id: string, companyId: string, dto: UpdateCategoryDto) {
    await this.findOne(id, companyId);
    if (dto.warehouseId) {
      const warehouse = await this.prisma.warehouse.findFirst({
        where: { id: dto.warehouseId, companyId, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!warehouse) {
        throw new BadRequestException('Tanlangan ombor topilmadi yoki faol emas.');
      }
    }
    const updated = await this.prisma.productCategory.update({
      where: { id },
      data: {
        name: dto.name,
        parentId: dto.parentId,
        warehouseId: dto.warehouseId,
        status: dto.status,
      },
    });
    this.invalidateCompany(companyId);
    return updated;
  }

  async remove(id: string, companyId: string) {
    await this.findOne(id, companyId);
    const productsCount = await this.prisma.product.count({ where: { categoryId: id } });
    const childrenCount = await this.prisma.productCategory.count({ where: { parentId: id } });

    if (productsCount > 0 || childrenCount > 0) {
      const archived = await this.prisma.productCategory.update({
        where: { id },
        data: { status: 'ARCHIVED' },
      });
      this.invalidateCompany(companyId);
      return {
        action: 'archived' as const,
        message: 'Kategoriyada mahsulot yoki bolalar bor — arxivlandi.',
        category: archived,
      };
    }

    const removed = await this.prisma.productCategory.delete({ where: { id } });
    this.invalidateCompany(companyId);
    return {
      action: 'deleted' as const,
      message: "Kategoriya o'chirildi.",
      category: removed,
    };
  }
}
