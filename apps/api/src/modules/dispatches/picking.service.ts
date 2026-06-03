import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

type PrismaTx = Prisma.TransactionClient;

@Injectable()
export class PickingService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async createPickTasksForDispatch(dispatchId: string, externalTx?: PrismaTx) {
    const client = externalTx ?? this.prisma;
    const dispatch = await client.dispatch.findUnique({
      where: { id: dispatchId },
      include: { items: true },
    });

    if (!dispatch) throw new NotFoundException("Jo'natma topilmadi");
    if (!dispatch.items.length) return [];

    await client.pickTask.createMany({
      data: dispatch.items.map((item) => ({
        dispatchId: dispatch.id,
        companyId: dispatch.sellerCompanyId,
        warehouseId: dispatch.warehouseId,
        productVariantId: item.productVariantId,
        productNameSnapshot: item.productNameSnapshot,
        quantityRequired: item.quantity,
        status: 'PENDING',
      })),
    });

    const tasks = await client.pickTask.findMany({
      where: { dispatchId },
      orderBy: { createdAt: 'asc' },
    });

    if (!externalTx && tasks.length) {
      void this.notifyPickTasksCreated(dispatch, tasks).catch((err) =>
        console.error('pick_tasks notification failed', err),
      );
    }

    return tasks;
  }

  private async notifyPickTasksCreated(
    dispatch: { id: string; dispatchNumber: string; sellerCompanyId: string },
    tasks: Array<{ productNameSnapshot: string; quantityRequired: unknown; binLocation: string | null }>,
  ) {
    const summary = tasks
      .slice(0, 3)
      .map((t) => `${t.productNameSnapshot} (${Number(t.quantityRequired)} ta)`)
      .join(', ');
    const more = tasks.length > 3 ? ` +${tasks.length - 3} ta boshqa` : '';

    await this.notificationsService.notifyCompany(
      dispatch.sellerCompanyId,
      'Yangi saralash vazifasi',
      `${dispatch.dispatchNumber}: ${summary}${more}`,
      'INFO',
      {
        moduleKey: 'WAREHOUSE',
        eventKey: 'pick_task.created',
        details: {
          dispatchId: dispatch.id,
          dispatchNumber: dispatch.dispatchNumber,
          taskCount: tasks.length,
        },
        targetRoles: ['WAREHOUSE', 'MANAGER'],
      },
    );
  }

  async findOne(taskId: string, companyId: string) {
    const task = await this.prisma.pickTask.findFirst({
      where: { id: taskId, companyId },
      include: {
        dispatch: { select: { id: true, dispatchNumber: true, orderId: true, status: true } },
        productVariant: { select: { id: true, name: true, sku: true, barcode: true } },
        warehouse: { select: { id: true, name: true } },
      },
    });
    if (!task) throw new NotFoundException('Picking vazifasi topilmadi');
    return task;
  }

  async list(companyId: string, query?: { status?: string; warehouseId?: string }) {
    const status = String(query?.status || '').trim().toUpperCase();
    return this.prisma.pickTask.findMany({
      where: {
        companyId,
        ...(query?.warehouseId ? { warehouseId: query.warehouseId } : {}),
        ...(status ? { status: status as any } : {}),
      },
      include: {
        dispatch: { select: { id: true, dispatchNumber: true, orderId: true, status: true } },
        productVariant: { select: { id: true, name: true, sku: true, barcode: true } },
        warehouse: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listForDispatch(dispatchId: string, companyId: string) {
    const dispatch = await this.prisma.dispatch.findFirst({
      where: {
        id: dispatchId,
        OR: [{ sellerCompanyId: companyId }, { buyerCompanyId: companyId }],
      },
      select: { id: true },
    });
    if (!dispatch) throw new NotFoundException("Jo'natma topilmadi");

    return this.prisma.pickTask.findMany({
      where: { dispatchId },
      include: {
        dispatch: { select: { id: true, dispatchNumber: true, status: true, orderId: true } },
        productVariant: { select: { id: true, name: true, sku: true, barcode: true } },
        warehouse: { select: { id: true, name: true } },
        assignee: { select: { id: true, user: { select: { fullName: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async scan(
    taskId: string,
    companyId: string,
    userId: string,
    dto: { barcode: string; quantity?: number },
  ) {
    const quantity = Number(dto.quantity ?? 1);
    const barcode = String(dto.barcode || '').trim();
    if (!barcode) throw new BadRequestException('Barcode yoki SKU kiriting');
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new BadRequestException("Miqdor noto'g'ri");
    }

    const companyUser = await this.prisma.companyUser.findFirst({
      where: { companyId, userId },
      select: { id: true },
    });
    if (!companyUser) throw new BadRequestException('Foydalanuvchi kompaniyada topilmadi');

    return this.prisma.$transaction(async (tx) => {
      const task = await tx.pickTask.findFirst({
        where: { id: taskId, companyId },
        include: { productVariant: { select: { sku: true, barcode: true } } },
      });
      if (!task) throw new NotFoundException('Picking vazifasi topilmadi');
      if (task.status === 'CANCELLED') throw new BadRequestException('Vazifa bekor qilingan');
      if (task.status === 'COMPLETED') throw new BadRequestException('Vazifa allaqachon tugagan');

      const expected = [task.productVariant.barcode, task.productVariant.sku]
        .filter(Boolean)
        .map((value) => String(value).trim());
      if (expected.length > 0 && !expected.includes(barcode)) {
        throw new BadRequestException("Noto'g'ri mahsulot skanerlandi");
      }

      const nextPicked = Number(task.quantityPicked) + quantity;
      const required = Number(task.quantityRequired);
      if (nextPicked > required) {
        throw new BadRequestException(`Miqdor oshib ketdi: kerak ${required}, skanerlangan ${nextPicked}`);
      }

      return tx.pickTask.update({
        where: { id: taskId },
        data: {
          quantityPicked: nextPicked,
          scannedBarcodes: { push: barcode },
          assignedTo: task.assignedTo ?? companyUser.id,
          startedAt: task.startedAt ?? new Date(),
          status: nextPicked >= required ? 'COMPLETED' : 'IN_PROGRESS',
          completedAt: nextPicked >= required ? new Date() : undefined,
        },
      });
    });
  }

  async complete(taskId: string, companyId: string, userId: string) {
    const companyUser = await this.prisma.companyUser.findFirst({
      where: { companyId, userId },
      select: { id: true },
    });
    if (!companyUser) throw new BadRequestException('Foydalanuvchi kompaniyada topilmadi');

    const task = await this.prisma.pickTask.findFirst({ where: { id: taskId, companyId } });
    if (!task) throw new NotFoundException('Picking vazifasi topilmadi');
    if (Number(task.quantityPicked) < Number(task.quantityRequired)) {
      throw new BadRequestException("To'liq saralanmagan vazifani tugatib bo'lmaydi");
    }

    return this.prisma.pickTask.update({
      where: { id: taskId },
      data: {
        status: 'COMPLETED',
        assignedTo: task.assignedTo ?? companyUser.id,
        completedAt: task.completedAt ?? new Date(),
      },
    });
  }

  async deleteTasksForDispatch(dispatchId: string, externalTx?: PrismaTx) {
    const client = externalTx ?? this.prisma;
    await client.pickTask.deleteMany({ where: { dispatchId } });
  }

  async cancelTasksForDispatch(dispatchId: string, externalTx?: PrismaTx) {
    const client = externalTx ?? this.prisma;
    await client.pickTask.updateMany({
      where: { dispatchId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
      data: { status: 'CANCELLED' },
    });
  }

  async assertDispatchPicked(dispatchId: string, externalTx?: PrismaTx) {
    const client = externalTx ?? this.prisma;
    const unfinished = await client.pickTask.count({
      where: { dispatchId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
    });
    if (unfinished > 0) {
      throw new BadRequestException(`${unfinished} ta picking vazifasi hali tugallanmagan`);
    }
  }
}
