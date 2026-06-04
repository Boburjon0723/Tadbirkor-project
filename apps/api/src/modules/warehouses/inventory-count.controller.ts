import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permission } from '../../common/enums/role.enum';
import { InventoryCountService } from './inventory-count.service';
import { CompaniesService } from '../companies/companies.service';

@Controller('inventory-counts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InventoryCountController {
  constructor(
    private readonly inventoryCountService: InventoryCountService,
    private readonly companiesService: CompaniesService,
  ) {}

  private async assertInventoryCount(user: { companyId: string }) {
    await this.companiesService.assertFeatureEnabled(
      user.companyId,
      'WAREHOUSE_INVENTORY_COUNT',
    );
  }

  @Get()
  @Permissions(Permission.WAREHOUSE_VIEW)
  async list(
    @CurrentUser() user: any,
    @Query('status') status?: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    await this.assertInventoryCount(user);
    return this.inventoryCountService.list(user.companyId, { status, warehouseId });
  }

  @Get(':id')
  @Permissions(Permission.WAREHOUSE_VIEW)
  async findOne(@CurrentUser() user: any, @Param('id') id: string) {
    await this.assertInventoryCount(user);
    return this.inventoryCountService.findOne(id, user.companyId);
  }

  @Post(':id/scan')
  @Permissions(Permission.WAREHOUSE_ADJUST)
  async scan(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: { barcode: string; countedQuantity: number },
  ) {
    await this.assertInventoryCount(user);
    return this.inventoryCountService.recordCountByBarcode(
      id,
      user.companyId,
      user.sub,
      dto.barcode,
      Number(dto.countedQuantity),
    );
  }

  @Post()
  @Permissions(Permission.WAREHOUSE_ADJUST)
  async start(
    @CurrentUser() user: any,
    @Body() dto: { warehouseId: string; productVariantIds?: string[] },
  ) {
    await this.assertInventoryCount(user);
    return this.inventoryCountService.startCount(user.companyId, user.sub, dto);
  }

  @Patch('items/:itemId/count')
  @Permissions(Permission.WAREHOUSE_ADJUST)
  async recordCount(
    @CurrentUser() user: any,
    @Param('itemId') itemId: string,
    @Body() dto: { countedQuantity: number },
  ) {
    await this.assertInventoryCount(user);
    return this.inventoryCountService.recordCount(
      itemId,
      user.companyId,
      user.sub,
      Number(dto.countedQuantity),
    );
  }

  @Patch('items/:itemId/approve')
  @Permissions(Permission.WAREHOUSE_MANAGE)
  async approveItem(@CurrentUser() user: any, @Param('itemId') itemId: string) {
    await this.assertInventoryCount(user);
    return this.inventoryCountService.approveItem(itemId, user.companyId, user.sub);
  }

  @Post(':id/complete')
  @Permissions(Permission.WAREHOUSE_MANAGE)
  async complete(@CurrentUser() user: any, @Param('id') id: string) {
    await this.assertInventoryCount(user);
    return this.inventoryCountService.completeCount(id, user.companyId, user.sub);
  }

  @Post(':id/cancel')
  @Permissions(Permission.WAREHOUSE_ADJUST)
  async cancel(@CurrentUser() user: any, @Param('id') id: string) {
    await this.assertInventoryCount(user);
    return this.inventoryCountService.cancelCount(id, user.companyId);
  }
}
