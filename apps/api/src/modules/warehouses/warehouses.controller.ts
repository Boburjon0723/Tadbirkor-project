import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  UseGuards 
} from '@nestjs/common';
import { WarehousesService } from './warehouses.service';
import { CreateWarehouseDto, UpdateWarehouseDto } from './dto/warehouse.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('warehouses')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  @Post()
  @Permissions(Permission.WAREHOUSE_CREATE)
  create(@CurrentUser() user: any, @Body() dto: CreateWarehouseDto) {
    return this.warehousesService.create(user.companyId, dto);
  }

  @Get()
  @Permissions(Permission.WAREHOUSE_VIEW)
  findAll(@CurrentUser() user: any) {
    return this.warehousesService.findAll(user.companyId, user.sub);
  }

  @Get(':id')
  @Permissions(Permission.WAREHOUSE_VIEW)
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.warehousesService.findOne(id, user.companyId);
  }

  @Patch(':id')
  @Permissions(Permission.WAREHOUSE_UPDATE)
  update(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: UpdateWarehouseDto) {
    return this.warehousesService.update(id, user.companyId, dto);
  }

  @Delete(':id')
  @Permissions(Permission.WAREHOUSE_DELETE)
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.warehousesService.remove(id, user.companyId, user.sub);
  }
}
