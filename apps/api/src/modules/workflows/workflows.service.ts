import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateWorkflowDefinitionDto,
  CreateWorkflowStepDto,
  ExecuteWorkflowEventDto,
} from './dto/workflow.dto';

@Injectable()
export class WorkflowsService {
  constructor(private prisma: PrismaService) {}

  async findAll(companyId: string) {
    return this.prisma.workflowDefinition.findMany({
      where: { companyId },
      include: { steps: { orderBy: { orderIndex: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createDefinition(companyId: string, dto: CreateWorkflowDefinitionDto) {
    return this.prisma.workflowDefinition.create({
      data: {
        companyId,
        eventKey: dto.eventKey,
        name: dto.name,
        enabled: dto.enabled ?? true,
      },
    });
  }

  async addStep(companyId: string, workflowId: string, dto: CreateWorkflowStepDto) {
    const workflow = await this.prisma.workflowDefinition.findFirst({
      where: { id: workflowId, companyId },
    });
    if (!workflow) {
      throw new NotFoundException('Workflow topilmadi');
    }

    return this.prisma.workflowStep.create({
      data: {
        workflowDefinitionId: workflowId,
        stepKey: dto.stepKey,
        role: dto.role,
        orderIndex: dto.orderIndex,
        required: dto.required ?? true,
      },
    });
  }

  async executeEvent(
    companyId: string,
    eventKey: string,
    payload: ExecuteWorkflowEventDto,
    actorUserId: string,
    tx?: any,
  ) {
    const prisma = tx || this.prisma;
    const workflows = await prisma.workflowDefinition.findMany({
      where: { companyId, eventKey, enabled: true },
      include: { steps: { orderBy: { orderIndex: 'asc' } } },
    });

    if (!workflows.length) {
      return { created: 0 };
    }

    let created = 0;
    for (const workflow of workflows) {
      for (const step of workflow.steps) {
        const assignee = await prisma.companyUser.findFirst({
          where: { companyId, role: step.role },
          select: { userId: true },
          orderBy: { createdAt: 'asc' },
        });

        await prisma.task.create({
          data: {
            companyId,
            sourceType: payload.sourceType || eventKey,
            sourceId: payload.sourceId,
            title: step.stepKey,
            description: `Workflow: ${workflow.name} / ${step.stepKey}`,
            assignedRole: step.role,
            assigneeId: assignee?.userId,
            status: 'TODO',
            priority: step.required ? 'HIGH' : 'MEDIUM',
            creatorId: actorUserId,
          },
        });
        created += 1;
      }
    }

    return { created };
  }
}

