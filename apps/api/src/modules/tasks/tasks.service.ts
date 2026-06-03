import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AssignTaskDto, CreateTaskDto, UpdateTaskStatusDto } from './dto/task.dto';

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  async findAll(companyId: string) {
    return this.prisma.task.findMany({
      where: { companyId },
      include: {
        creator: { select: { id: true, fullName: true, login: true } },
        assignee: { select: { id: true, fullName: true, login: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findMy(companyId: string, userId: string) {
    return this.prisma.task.findMany({
      where: { companyId, assigneeId: userId },
      include: {
        creator: { select: { id: true, fullName: true, login: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(companyId: string, creatorId: string, dto: CreateTaskDto) {
    let assigneeId = dto.assigneeId;

    if (dto.assignedRole && !assigneeId) {
      const byRole = await this.prisma.companyUser.findFirst({
        where: { companyId, role: dto.assignedRole },
        select: { userId: true },
      });
      assigneeId = byRole?.userId;
    }

    if (assigneeId) {
      const assigneeMembership = await this.prisma.companyUser.findFirst({
        where: { companyId, userId: assigneeId },
      });
      if (!assigneeMembership) {
        throw new BadRequestException('Belgilangan foydalanuvchi ushbu kompaniyaga tegishli emas');
      }
    }

    return this.prisma.task.create({
      data: {
        companyId,
        sourceType: dto.sourceType,
        sourceId: dto.sourceId,
        title: dto.title,
        description: dto.description,
        assignedRole: dto.assignedRole,
        status: 'TODO',
        priority: dto.priority || 'MEDIUM',
        creatorId,
        assigneeId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
    });
  }

  async updateStatus(companyId: string, userId: string, taskId: string, dto: UpdateTaskStatusDto) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, companyId },
    });
    if (!task) {
      throw new NotFoundException('Task topilmadi');
    }
    if (task.assigneeId !== userId && task.creatorId !== userId) {
      throw new ForbiddenException('Faqat task egasi yoki yaratuvchisi holatni o‘zgartira oladi');
    }

    return this.prisma.task.update({
      where: { id: taskId },
      data: { status: dto.status },
    });
  }

  async assign(companyId: string, taskId: string, dto: AssignTaskDto) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, companyId },
    });
    if (!task) {
      throw new NotFoundException('Task topilmadi');
    }

    let assigneeId = dto.assigneeId;
    let role = dto.role ?? task.assignedRole ?? undefined;

    if (!assigneeId && dto.role) {
      const byRole = await this.prisma.companyUser.findFirst({
        where: { companyId, role: dto.role },
        select: { userId: true },
      });
      if (!byRole) {
        throw new BadRequestException('Berilgan rol uchun xodim topilmadi');
      }
      assigneeId = byRole.userId;
    }

    if (!assigneeId) {
      throw new BadRequestException('assigneeId yoki role berilishi shart');
    }

    const assigneeMembership = await this.prisma.companyUser.findFirst({
      where: { companyId, userId: assigneeId },
    });
    if (!assigneeMembership) {
      throw new BadRequestException('Belgilangan foydalanuvchi ushbu kompaniyaga tegishli emas');
    }

    if (!role) {
      role = assigneeMembership.role;
    }

    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        assigneeId,
        assignedRole: role,
      },
    });
  }
}
