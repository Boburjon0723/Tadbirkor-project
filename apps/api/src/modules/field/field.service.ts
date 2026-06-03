import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StockService } from '../warehouses/stock.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CompaniesService } from '../companies/companies.service';
import { CreateFieldTaskDto } from './dto/create-field-task.dto';
import { SubmitFieldReportDto } from './dto/submit-field-report.dto';
import {
  FIELD_STOCK_SOURCE,
  FIELD_TASK_STATUS,
  PlannedItem,
  ReportItem,
} from './field.constants';
import { haversineDistanceM } from './field.utils';

@Injectable()
export class FieldService {
  constructor(
    private prisma: PrismaService,
    private stockService: StockService,
    private notifications: NotificationsService,
    private companiesService: CompaniesService,
  ) {}

  private taskInclude = {
    assignee: { select: { id: true, fullName: true, login: true, phone: true } },
    sourceWarehouse: { select: { id: true, name: true } },
    createdBy: { select: { id: true, fullName: true } },
    report: true,
  } as const;

  async assertFieldModule(companyId: string) {
    await this.companiesService.assertModuleEnabled(companyId, 'FIELD_SERVICE');
  }

  private async assertFieldWorker(companyId: string, userId: string) {
    const member = await this.prisma.companyUser.findFirst({
      where: { companyId, userId },
    });
    if (!member || member.role !== 'FIELD_WORKER') {
      throw new BadRequestException('Tayinlangan xodim FIELD_WORKER roliga ega bo‘lishi kerak');
    }
    if (!member.warehouseId) {
      throw new BadRequestException('Dala xodimi omborga biriktirilmagan');
    }
    return member;
  }

  private parsePlannedItems(raw: unknown): PlannedItem[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((item: any) => ({
      variantId: String(item.variantId),
      qty: Number(item.qty) || 0,
      label: item.label,
    }));
  }

  private async enrichPlannedItems(companyId: string, raw: unknown): Promise<PlannedItem[]> {
    const items = this.parsePlannedItems(raw);
    if (!items.length) return [];
    const variants = await this.prisma.productVariant.findMany({
      where: { companyId, id: { in: items.map((i) => i.variantId) } },
      include: { product: { select: { name: true } } },
    });
    const map = new Map(variants.map((v) => [v.id, v]));
    return items.map((item) => {
      const v = map.get(item.variantId);
      const productName = v?.product?.name || 'Mahsulot';
      const variantName = v?.name?.trim();
      const label =
        item.label ||
        (variantName && variantName !== productName
          ? `${productName} · ${variantName}`
          : productName);
      return { ...item, label };
    });
  }

  private formatTaskForApi<T extends { plannedItems: unknown }>(
    companyId: string,
    task: T,
    plannedItems: PlannedItem[],
  ) {
    return { ...task, plannedItems };
  }

  private async withEnrichedPlannedItems(companyId: string, task: any) {
    const plannedItems = await this.enrichPlannedItems(companyId, task.plannedItems);
    return this.formatTaskForApi(companyId, task, plannedItems);
  }

  async createAndAssign(companyId: string, userId: string, dto: CreateFieldTaskDto) {
    await this.assertFieldModule(companyId);
    await this.assertFieldWorker(companyId, dto.assigneeId);

    if (!dto.plannedItems?.length) {
      throw new BadRequestException('Kamida bitta mahsulot qatori kerak');
    }

    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: dto.sourceWarehouseId, companyId },
    });
    if (!warehouse) throw new NotFoundException('Ombor topilmadi');

    const assigneeMember = await this.prisma.companyUser.findFirst({
      where: { companyId, userId: dto.assigneeId },
      include: { user: { select: { fullName: true } } },
    });

    const plannedWithLabels = await this.enrichPlannedItems(companyId, dto.plannedItems);

    const task = await this.prisma.$transaction(async (tx) => {
      const created = await tx.fieldTask.create({
        data: {
          companyId,
          assigneeId: dto.assigneeId,
          sourceWarehouseId: dto.sourceWarehouseId,
          createdById: userId,
          title: dto.title,
          description: dto.description,
          customerName: dto.customerName,
          customerPhone: dto.customerPhone,
          address: dto.address,
          lat: dto.lat,
          lng: dto.lng,
          scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
          status: FIELD_TASK_STATUS.ASSIGNED,
          plannedItems: plannedWithLabels as unknown as Prisma.InputJsonValue,
        },
      });

      for (const item of plannedWithLabels) {
        await this.stockService.recordMovement(
          companyId,
          {
            warehouseId: dto.sourceWarehouseId,
            productVariantId: item.variantId,
            quantity: item.qty,
            sourceId: created.id,
            note: `Dala vazifasi: ${dto.title}`,
          },
          'OUT',
          FIELD_STOCK_SOURCE.FIELD_ASSIGN,
          userId,
          tx,
        );

        await tx.userStock.upsert({
          where: {
            userId_productVariantId_sourceWarehouseId: {
              userId: dto.assigneeId,
              productVariantId: item.variantId,
              sourceWarehouseId: dto.sourceWarehouseId,
            },
          },
          create: {
            companyId,
            userId: dto.assigneeId,
            productVariantId: item.variantId,
            sourceWarehouseId: dto.sourceWarehouseId,
            quantity: item.qty,
          },
          update: { quantity: { increment: item.qty } },
        });
      }

      await tx.auditLog.create({
        data: {
          companyId,
          userId,
          action: 'field.task.assigned',
          entityType: 'FIELD_TASK',
          entityId: created.id,
          newData: { plannedItems: plannedWithLabels, assigneeId: dto.assigneeId } as any,
        },
      });

      return created;
    });

    const itemSummary = plannedWithLabels
      .map((i) => `${i.label || 'Mahsulot'}: ${i.qty}`)
      .join(', ');

    await this.notifications.create(
      dto.assigneeId,
      'Yangi dala vazifasi',
      `"${dto.title}" — ${itemSummary}. Ilovada qabul qiling.`,
      'INFO',
    );

    await this.notifications.notifyCompanyRoles(
      companyId,
      ['OWNER', 'MANAGER', 'WAREHOUSE'],
      'Ombordan dala xodimiga tovar berildi',
      `${assigneeMember?.user?.fullName || 'Xodim'}: "${dto.title}". Ombor: ${warehouse.name}. ${itemSummary}`,
      'INFO',
      {
        moduleKey: 'FIELD_SERVICE',
        eventKey: 'field.stock.assigned',
        details: { taskId: task.id, warehouse: warehouse.name },
        targetRoles: ['OWNER', 'MANAGER', 'WAREHOUSE'],
      },
    );

    return this.findOne(companyId, task.id);
  }

  async findAll(
    companyId: string,
    filters?: { status?: string; assigneeId?: string; warehouseId?: string },
  ) {
    await this.assertFieldModule(companyId);
    return this.prisma.fieldTask.findMany({
      where: {
        companyId,
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.assigneeId ? { assigneeId: filters.assigneeId } : {}),
        ...(filters?.warehouseId ? { sourceWarehouseId: filters.warehouseId } : {}),
      },
      include: this.taskInclude,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async findOne(companyId: string, taskId: string) {
    const task = await this.prisma.fieldTask.findFirst({
      where: { id: taskId, companyId },
      include: {
        ...this.taskInclude,
        approvals: { orderBy: { decidedAt: 'desc' }, take: 5 },
      },
    });
    if (!task) throw new NotFoundException('Vazifa topilmadi');
    return this.withEnrichedPlannedItems(companyId, task);
  }

  async getMyTasks(userId: string, companyId: string, status?: string) {
    await this.assertFieldModule(companyId);
    const tasks = await this.prisma.fieldTask.findMany({
      where: {
        companyId,
        assigneeId: userId,
        ...(status ? { status } : {}),
      },
      include: this.taskInclude,
      orderBy: { scheduledAt: 'asc' },
    });
    return Promise.all(tasks.map((t) => this.withEnrichedPlannedItems(companyId, t)));
  }

  async getMyStock(userId: string, companyId: string) {
    await this.assertFieldModule(companyId);
    return this.prisma.userStock.findMany({
      where: { companyId, userId, quantity: { gt: 0 } },
      include: {
        productVariant: { include: { product: true } },
        sourceWarehouse: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async acceptTask(companyId: string, userId: string, taskId: string) {
    const task = await this.findOne(companyId, taskId);
    if (task.assigneeId !== userId) {
      throw new ForbiddenException('Bu vazifa sizga tegishli emas');
    }
    if (task.status !== FIELD_TASK_STATUS.ASSIGNED) {
      throw new BadRequestException('Vazifa allaqachon qabul qilingan yoki yakunlangan');
    }
    const updated = await this.prisma.fieldTask.update({
      where: { id: taskId },
      data: { status: FIELD_TASK_STATUS.IN_PROGRESS },
      include: this.taskInclude,
    });
    return this.withEnrichedPlannedItems(companyId, updated);
  }

  async submitReport(
    companyId: string,
    userId: string,
    taskId: string,
    dto: SubmitFieldReportDto,
  ) {
    const task = await this.findOne(companyId, taskId);
    if (task.assigneeId !== userId) {
      throw new ForbiddenException('Bu vazifa sizga tegishli emas');
    }
    const reportable = [FIELD_TASK_STATUS.IN_PROGRESS, FIELD_TASK_STATUS.NEEDS_FIX];
    if (!reportable.includes(task.status as typeof FIELD_TASK_STATUS.IN_PROGRESS)) {
      throw new BadRequestException(
        'Avval topshiriqni qabul qiling, keyin tugatganingizda hisobot yuboring',
      );
    }

    const planned = await this.enrichPlannedItems(companyId, task.plannedItems);
    const plannedMap = new Map(planned.map((p) => [p.variantId, p.qty]));
    const submittedIds = new Set(dto.items.map((i) => i.variantId));

    for (const item of dto.items) {
      if (!plannedMap.has(item.variantId)) {
        throw new BadRequestException('Faqat vazifadagi mahsulotlarni kiritish mumkin');
      }
      const plannedQty = plannedMap.get(item.variantId) || 0;
      const total = item.usedQty + item.returnedQty + item.lostQty;
      if (total > plannedQty) {
        throw new BadRequestException(
          `Variant ${item.variantId}: jami ${total} reja miqdoridan (${plannedQty}) oshib ketdi`,
        );
      }
    }

    if (submittedIds.size !== plannedMap.size) {
      throw new BadRequestException('Barcha vazifa mahsulotlari bo‘yicha hisobot to‘ldiring');
    }

    let gpsDistanceM: number | null = null;
    if (
      dto.gpsLat != null &&
      dto.gpsLng != null &&
      task.lat != null &&
      task.lng != null
    ) {
      gpsDistanceM = haversineDistanceM(task.lat, task.lng, dto.gpsLat, dto.gpsLng);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.fieldTaskReport.upsert({
        where: { fieldTaskId: taskId },
        create: {
          fieldTaskId: taskId,
          items: dto.items as unknown as Prisma.InputJsonValue,
          photos: (dto.photos || []) as unknown as Prisma.InputJsonValue,
          gpsLat: dto.gpsLat,
          gpsLng: dto.gpsLng,
          gpsDistanceM,
          comment: dto.comment,
        },
        update: {
          items: dto.items as unknown as Prisma.InputJsonValue,
          photos: (dto.photos || []) as unknown as Prisma.InputJsonValue,
          gpsLat: dto.gpsLat,
          gpsLng: dto.gpsLng,
          gpsDistanceM,
          comment: dto.comment,
          submittedAt: new Date(),
        },
      });

      const row = await tx.fieldTask.update({
        where: { id: taskId },
        data: { status: FIELD_TASK_STATUS.REPORTED },
        include: { ...this.taskInclude, report: true },
      });
      return row;
    });

    const summary = dto.items
      .map((i) => `ishlatildi ${i.usedQty}, qoldi ${i.returnedQty}`)
      .join('; ');

    await this.notifications.notifyCompanyRoles(
      companyId,
      ['OWNER', 'MANAGER'],
      'Dala vazifasi hisoboti',
      `${task.assignee.fullName} — "${task.title}". ${summary}. Tasdiqlaysizmi?`,
      'WARNING',
      {
        moduleKey: 'FIELD_SERVICE',
        eventKey: 'field.task.reported',
        details: {
          taskId: task.id,
          worker: task.assignee.fullName,
          gpsDistanceM: gpsDistanceM != null ? Math.round(gpsDistanceM) : null,
        },
        targetRoles: ['OWNER', 'MANAGER'],
        actions: [
          {
            key: 'FIELD_APPROVE',
            label: '✅ Tasdiqlash',
            targetType: 'FIELD_TASK',
            targetId: task.id,
          },
          {
            key: 'FIELD_REJECT',
            label: '❌ Rad etish',
            targetType: 'FIELD_TASK',
            targetId: task.id,
          },
        ],
      },
    );

    return this.withEnrichedPlannedItems(companyId, updated);
  }

  async approveTask(
    companyId: string,
    approverId: string,
    taskId: string,
    channel: 'WEB' | 'TELEGRAM' = 'WEB',
  ) {
    const task = await this.findOne(companyId, taskId);
    if (task.status !== FIELD_TASK_STATUS.REPORTED) {
      throw new BadRequestException('Faqat hisobot yuborilgan vazifani tasdiqlash mumkin');
    }
    if (!task.report) throw new BadRequestException('Hisobot topilmadi');

    const items = task.report.items as unknown as ReportItem[];

    await this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        const userStock = await tx.userStock.findUnique({
          where: {
            userId_productVariantId_sourceWarehouseId: {
              userId: task.assigneeId,
              productVariantId: item.variantId,
              sourceWarehouseId: task.sourceWarehouseId,
            },
          },
        });
        const onHand = userStock?.quantity || 0;
        const totalOut = item.usedQty + item.returnedQty + item.lostQty;
        if (totalOut > onHand) {
          throw new BadRequestException(
            `Ishchi balansida yetarli tovar yo‘q (variant ${item.variantId})`,
          );
        }

        if (item.usedQty > 0) {
          if (!userStock) {
            throw new BadRequestException(
              `Ishchi balansida tovar yo‘q (variant ${item.variantId})`,
            );
          }
          await tx.userStock.update({
            where: { id: userStock.id },
            data: { quantity: { decrement: item.usedQty } },
          });
          await tx.stockMovement.create({
            data: {
              companyId,
              warehouseId: task.sourceWarehouseId,
              productVariantId: item.variantId,
              type: 'OUT',
              quantity: item.usedQty,
              sourceType: FIELD_STOCK_SOURCE.WORKER_TO_CUSTOMER,
              sourceId: task.id,
              note: `Mijozga sarflandi: ${task.title}`,
              createdBy: approverId,
            },
          });
        }

        if (item.returnedQty > 0) {
          if (!userStock) {
            throw new BadRequestException(
              `Ishchi balansida tovar yo‘q (variant ${item.variantId})`,
            );
          }
          await tx.userStock.update({
            where: { id: userStock.id },
            data: { quantity: { decrement: item.returnedQty } },
          });
          await this.stockService.recordMovement(
            companyId,
            {
              warehouseId: task.sourceWarehouseId,
              productVariantId: item.variantId,
              quantity: item.returnedQty,
              sourceId: task.id,
              note: `Omborga qaytdi: ${task.title}`,
            },
            'IN',
            FIELD_STOCK_SOURCE.WORKER_RETURN,
            approverId,
            tx,
          );
        }

        if (item.lostQty > 0) {
          if (!userStock) {
            throw new BadRequestException(
              `Ishchi balansida tovar yo‘q (variant ${item.variantId})`,
            );
          }
          await tx.userStock.update({
            where: { id: userStock.id },
            data: { quantity: { decrement: item.lostQty } },
          });
          await tx.stockMovement.create({
            data: {
              companyId,
              warehouseId: task.sourceWarehouseId,
              productVariantId: item.variantId,
              type: 'OUT',
              quantity: item.lostQty,
              sourceType: FIELD_STOCK_SOURCE.WORKER_LOSS,
              sourceId: task.id,
              note: `Yo‘qotish/sindirish: ${task.title}`,
              createdBy: approverId,
            },
          });
        }
      }

      await tx.fieldTaskApproval.create({
        data: {
          reportId: task.report!.id,
          fieldTaskId: task.id,
          approverId,
          decision: 'APPROVED',
          channel,
        },
      });

      await tx.fieldTask.update({
        where: { id: task.id },
        data: {
          status: FIELD_TASK_STATUS.APPROVED,
          approvedById: approverId,
          approvedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          companyId,
          userId: approverId,
          action: 'field.task.approved',
          entityType: 'FIELD_TASK',
          entityId: task.id,
          newData: { items } as any,
        },
      });
    });

    await this.notifications.create(
      task.assigneeId,
      'Vazifa tasdiqlandi',
      `"${task.title}" hisobotingiz tasdiqlandi.`,
      'SUCCESS',
    );

    return this.findOne(companyId, taskId);
  }

  async rejectTask(
    companyId: string,
    approverId: string,
    taskId: string,
    reason: string,
    channel: 'WEB' | 'TELEGRAM' = 'WEB',
  ) {
    const task = await this.findOne(companyId, taskId);
    if (task.status !== FIELD_TASK_STATUS.REPORTED) {
      throw new BadRequestException('Faqat hisobot yuborilgan vazifani rad etish mumkin');
    }
    if (!task.report) throw new BadRequestException('Hisobot topilmadi');

    await this.prisma.$transaction(async (tx) => {
      await tx.fieldTaskApproval.create({
        data: {
          reportId: task.report!.id,
          fieldTaskId: task.id,
          approverId,
          decision: 'REJECTED',
          reason,
          channel,
        },
      });
      await tx.fieldTask.update({
        where: { id: task.id },
        data: { status: FIELD_TASK_STATUS.NEEDS_FIX },
      });
    });

    await this.notifications.create(
      task.assigneeId,
      'Hisobot rad etildi',
      `"${task.title}": ${reason}. Qayta hisobot yuboring.`,
      'WARNING',
    );

    return this.findOne(companyId, taskId);
  }

  async approveFromTelegram(companyId: string, taskId: string, actorUserId: string | null) {
    return this.approveTask(companyId, actorUserId || 'system', taskId, 'TELEGRAM');
  }

  async rejectFromTelegram(companyId: string, taskId: string, actorUserId: string | null) {
    return this.rejectTask(
      companyId,
      actorUserId || 'system',
      taskId,
      'Telegram orqali rad etildi',
      'TELEGRAM',
    );
  }

  async listWorkerBalances(companyId: string) {
    await this.assertFieldModule(companyId);
    const stocks = await this.prisma.userStock.findMany({
      where: { companyId, quantity: { gt: 0 } },
      include: {
        user: { select: { id: true, fullName: true, login: true } },
        productVariant: { include: { product: true } },
        sourceWarehouse: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const workers = await this.prisma.companyUser.findMany({
      where: { companyId, role: 'FIELD_WORKER' },
      include: { user: { select: { id: true, fullName: true, login: true } } },
    });

    return { stocks, workers };
  }

  async getKpi(companyId: string, from?: string, to?: string) {
    await this.assertFieldModule(companyId);

    const dateTo = to ? new Date(to) : new Date();
    if (to && !String(to).includes('T')) {
      dateTo.setHours(23, 59, 59, 999);
    }

    const dateFrom = from
      ? new Date(from)
      : new Date(dateTo.getFullYear(), dateTo.getMonth(), 1);

    const tasks = await this.prisma.fieldTask.findMany({
      where: {
        companyId,
        status: FIELD_TASK_STATUS.APPROVED,
        approvedAt: { gte: dateFrom, lte: dateTo },
      },
      include: {
        assignee: { select: { id: true, fullName: true } },
        report: true,
      },
    });

    const fieldWorkers = await this.prisma.companyUser.findMany({
      where: { companyId, role: 'FIELD_WORKER' },
      include: { user: { select: { id: true, fullName: true } } },
    });

    const byWorker = new Map<
      string,
      {
        userId: string;
        name: string;
        tasksTotal: number;
        approved: number;
        usedQty: number;
        returnedQty: number;
        lostQty: number;
      }
    >();

    for (const member of fieldWorkers) {
      byWorker.set(member.userId, {
        userId: member.userId,
        name: member.user.fullName,
        tasksTotal: 0,
        approved: 0,
        usedQty: 0,
        returnedQty: 0,
        lostQty: 0,
      });
    }

    for (const task of tasks) {
      const key = task.assigneeId;
      if (!byWorker.has(key)) {
        byWorker.set(key, {
          userId: key,
          name: task.assignee.fullName,
          tasksTotal: 0,
          approved: 0,
          usedQty: 0,
          returnedQty: 0,
          lostQty: 0,
        });
      }
      const row = byWorker.get(key)!;
      row.tasksTotal += 1;
      row.approved += 1;
      if (task.report?.items) {
        const items = task.report.items as unknown as ReportItem[];
        for (const i of items) {
          row.usedQty += i.usedQty || 0;
          row.returnedQty += i.returnedQty || 0;
          row.lostQty += i.lostQty || 0;
        }
      }
    }

    const workers = Array.from(byWorker.values()).sort((a, b) => b.usedQty - a.usedQty);

    return {
      period: { from: dateFrom, to: dateTo },
      workers,
    };
  }
}
