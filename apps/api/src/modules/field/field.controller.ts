import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/role.enum';
import { FieldService } from './field.service';
import { CreateFieldTaskDto } from './dto/create-field-task.dto';
import { SubmitFieldReportDto } from './dto/submit-field-report.dto';
import { RejectFieldTaskDto } from './dto/reject-field-task.dto';

@Controller('field')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FieldController {
  constructor(private readonly fieldService: FieldService) {}

  @Get('tasks')
  @Permissions(Permission.FIELD_TASK_VIEW_ALL)
  listTasks(
    @Request() req: any,
    @Query('status') status?: string,
    @Query('assigneeId') assigneeId?: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.fieldService.findAll(req.user.companyId, {
      status,
      assigneeId,
      warehouseId,
    });
  }

  @Get('tasks/:id')
  @Permissions(Permission.FIELD_TASK_VIEW_ALL)
  getTask(@Request() req: any, @Param('id') id: string) {
    return this.fieldService.findOne(req.user.companyId, id);
  }

  @Post('tasks')
  @Permissions(Permission.FIELD_TASK_CREATE)
  createTask(@Request() req: any, @Body() dto: CreateFieldTaskDto) {
    return this.fieldService.createAndAssign(req.user.companyId, req.user.sub, dto);
  }

  @Post('tasks/:id/approve')
  @Permissions(Permission.FIELD_TASK_APPROVE)
  approve(@Request() req: any, @Param('id') id: string) {
    return this.fieldService.approveTask(req.user.companyId, req.user.sub, id);
  }

  @Post('tasks/:id/reject')
  @Permissions(Permission.FIELD_TASK_APPROVE)
  reject(@Request() req: any, @Param('id') id: string, @Body() dto: RejectFieldTaskDto) {
    return this.fieldService.rejectTask(req.user.companyId, req.user.sub, id, dto.reason);
  }

  @Get('workers/stock')
  @Permissions(Permission.FIELD_TASK_VIEW_ALL)
  workerStock(@Request() req: any) {
    return this.fieldService.listWorkerBalances(req.user.companyId);
  }

  @Get('reports/kpi')
  @Permissions(Permission.FIELD_TASK_VIEW_ALL)
  kpi(
    @Request() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.fieldService.getKpi(req.user.companyId, from, to);
  }

  @Get('me/tasks')
  @Permissions(Permission.FIELD_TASK_VIEW_OWN)
  myTasks(@Request() req: any, @Query('status') status?: string) {
    return this.fieldService.getMyTasks(req.user.sub, req.user.companyId, status);
  }

  @Get('me/tasks/:id')
  @Permissions(Permission.FIELD_TASK_VIEW_OWN)
  myTask(@Request() req: any, @Param('id') id: string) {
    return this.fieldService.findOne(req.user.companyId, id);
  }

  @Get('me/stock')
  @Permissions(Permission.FIELD_STOCK_VIEW_OWN)
  myStock(@Request() req: any) {
    return this.fieldService.getMyStock(req.user.sub, req.user.companyId);
  }

  @Get('me/history')
  @Permissions(Permission.FIELD_TASK_VIEW_OWN)
  myHistory(@Request() req: any) {
    return this.fieldService.getMyTasks(req.user.sub, req.user.companyId, 'APPROVED');
  }

  @Post('tasks/:id/accept')
  @Permissions(Permission.FIELD_TASK_ACCEPT)
  accept(@Request() req: any, @Param('id') id: string) {
    return this.fieldService.acceptTask(req.user.companyId, req.user.sub, id);
  }

  @Post('tasks/:id/report')
  @Permissions(Permission.FIELD_TASK_REPORT)
  report(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: SubmitFieldReportDto,
  ) {
    return this.fieldService.submitReport(req.user.companyId, req.user.sub, id, dto);
  }
}
