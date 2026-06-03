import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { AssignTaskDto, CreateTaskDto, UpdateTaskStatusDto } from './dto/task.dto';
import { TasksService } from './tasks.service';

@Controller('tasks')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @Permissions(Permission.TASKS_VIEW)
  findAll(@CurrentUser() user: any) {
    return this.tasksService.findAll(user.companyId);
  }

  @Get('my')
  @Permissions(Permission.TASKS_VIEW)
  findMy(@CurrentUser() user: any) {
    return this.tasksService.findMy(user.companyId, user.sub);
  }

  @Post()
  @Permissions(Permission.TASKS_MANAGE)
  create(@CurrentUser() user: any, @Body() dto: CreateTaskDto) {
    return this.tasksService.create(user.companyId, user.sub, dto);
  }

  @Patch(':id/status')
  @Permissions(Permission.TASKS_VIEW)
  updateStatus(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateTaskStatusDto) {
    return this.tasksService.updateStatus(user.companyId, user.sub, id, dto);
  }

  @Post(':id/assign')
  @Permissions(Permission.TASKS_ASSIGN)
  assign(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: AssignTaskDto) {
    return this.tasksService.assign(user.companyId, id, dto);
  }
}
