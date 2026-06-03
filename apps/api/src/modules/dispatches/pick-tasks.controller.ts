import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '../../common/enums/role.enum';
import { PickingService } from './picking.service';

@Controller('pick-tasks')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PickTasksController {
  constructor(private readonly pickingService: PickingService) {}

  @Get()
  @Permissions(Permission.WAREHOUSE_DISPATCH)
  list(
    @CurrentUser() user: any,
    @Query('status') status?: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.pickingService.list(user.companyId, { status, warehouseId });
  }

  @Get(':id')
  @Permissions(Permission.WAREHOUSE_DISPATCH)
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.pickingService.findOne(id, user.companyId);
  }

  @Patch(':id/scan')
  @Permissions(Permission.WAREHOUSE_DISPATCH)
  scan(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: { barcode: string; quantity?: number },
  ) {
    return this.pickingService.scan(id, user.companyId, user.sub, dto);
  }

  @Patch(':id/complete')
  @Permissions(Permission.WAREHOUSE_DISPATCH)
  complete(@CurrentUser() user: any, @Param('id') id: string) {
    return this.pickingService.complete(id, user.companyId, user.sub);
  }
}
