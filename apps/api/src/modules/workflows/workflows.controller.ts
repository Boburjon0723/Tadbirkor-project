import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import {
  CreateWorkflowDefinitionDto,
  CreateWorkflowStepDto,
  ExecuteWorkflowEventDto,
} from './dto/workflow.dto';
import { WorkflowsService } from './workflows.service';

@Controller('workflows')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WorkflowsController {
  constructor(private readonly workflowsService: WorkflowsService) {}

  @Get()
  @Permissions(Permission.SETTINGS_MANAGE)
  findAll(@CurrentUser() user: any) {
    return this.workflowsService.findAll(user.companyId);
  }

  @Post()
  @Permissions(Permission.SETTINGS_MANAGE)
  create(@CurrentUser() user: any, @Body() dto: CreateWorkflowDefinitionDto) {
    return this.workflowsService.createDefinition(user.companyId, dto);
  }

  @Post(':id/steps')
  @Permissions(Permission.SETTINGS_MANAGE)
  addStep(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: CreateWorkflowStepDto) {
    return this.workflowsService.addStep(user.companyId, id, dto);
  }

  @Post('execute/:eventKey')
  @Permissions(Permission.TASKS_MANAGE)
  execute(
    @CurrentUser() user: any,
    @Param('eventKey') eventKey: string,
    @Body() dto: ExecuteWorkflowEventDto,
  ) {
    return this.workflowsService.executeEvent(user.companyId, eventKey, dto, user.sub);
  }
}

