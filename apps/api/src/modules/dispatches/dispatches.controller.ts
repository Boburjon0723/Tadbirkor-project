import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DispatchesService } from './dispatches.service';
import { CreateDispatchDto } from './dto/create-dispatch.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PickingService } from './picking.service';

@Controller('dispatches')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DispatchesController {
  constructor(
    private readonly dispatchesService: DispatchesService,
    private readonly pickingService: PickingService,
  ) {}

  @Post()
  @Permissions(Permission.DISPATCHES_CREATE)
  create(@CurrentUser() user: any, @Body() dto: CreateDispatchDto) {
    return this.dispatchesService.create(user.companyId, user.sub, dto);
  }

  @Post('create-and-send')
  @Permissions(Permission.DISPATCHES_CREATE, Permission.DISPATCHES_SEND)
  createAndSend(@CurrentUser() user: any, @Body() dto: CreateDispatchDto) {
    return this.dispatchesService.createAndSend(user.companyId, user.sub, dto);
  }

  @Get()
  @Permissions(Permission.DISPATCHES_VIEW)
  findAll(
    @CurrentUser() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.dispatchesService.findAll(user.companyId, 'SENDER', {
      page,
      limit,
      status,
      search,
    });
  }

  @Get(':id')
  @Permissions(Permission.DISPATCHES_VIEW)
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.dispatchesService.findOne(id, user.companyId);
  }

  @Post(':id/send')
  @Permissions(Permission.DISPATCHES_SEND)
  send(@CurrentUser() user: any, @Param('id') id: string) {
    return this.dispatchesService.send(id, user.companyId, user.sub);
  }

  @Get(':id/pick-tasks')
  @Permissions(Permission.DISPATCHES_VIEW)
  pickTasks(@CurrentUser() user: any, @Param('id') id: string) {
    return this.pickingService.listForDispatch(id, user.companyId);
  }

  @Post(':id/cancel')
  @Permissions(Permission.DISPATCHES_CANCEL)
  cancel(@CurrentUser() user: any, @Param('id') id: string) {
    return this.dispatchesService.cancel(id, user.companyId, user.sub);
  }
}
