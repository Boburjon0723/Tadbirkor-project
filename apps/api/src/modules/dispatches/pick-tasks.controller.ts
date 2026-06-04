import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '../../common/enums/role.enum';
import { PickingService } from './picking.service';
import { CompaniesService } from '../companies/companies.service';

@Controller('pick-tasks')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PickTasksController {
  constructor(
    private readonly pickingService: PickingService,
    private readonly companiesService: CompaniesService,
  ) {}

  @Get()
  @Permissions(Permission.WAREHOUSE_DISPATCH)
  async list(
    @CurrentUser() user: any,
    @Query('status') status?: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    await this.companiesService.assertFeatureEnabled(
      user.companyId,
      'WAREHOUSE_PICKING',
    );
    return this.pickingService.list(user.companyId, { status, warehouseId });
  }

  @Get(':id')
  @Permissions(Permission.WAREHOUSE_DISPATCH)
  async findOne(@CurrentUser() user: any, @Param('id') id: string) {
    await this.companiesService.assertFeatureEnabled(
      user.companyId,
      'WAREHOUSE_PICKING',
    );
    return this.pickingService.findOne(id, user.companyId);
  }

  @Patch(':id/scan')
  @Permissions(Permission.WAREHOUSE_DISPATCH)
  async scan(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: { barcode: string; quantity?: number },
  ) {
    await this.companiesService.assertFeatureEnabled(
      user.companyId,
      'WAREHOUSE_PICKING',
    );
    return this.pickingService.scan(id, user.companyId, user.sub, dto);
  }

  @Patch(':id/complete')
  @Permissions(Permission.WAREHOUSE_DISPATCH)
  async complete(@CurrentUser() user: any, @Param('id') id: string) {
    await this.companiesService.assertFeatureEnabled(
      user.companyId,
      'WAREHOUSE_PICKING',
    );
    return this.pickingService.complete(id, user.companyId, user.sub);
  }
}
