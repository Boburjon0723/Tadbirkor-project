import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PosService } from './pos.service';
import {
  CheckoutPosSaleDto,
  QuickCheckoutPosSaleDto,
  CreatePosSaleDto,
  ListPosSalesQueryDto,
  UpdatePosSaleDto,
  VoidPosSaleDto,
} from './dto/pos-sale.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('pos')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PosController {
  constructor(private readonly posService: PosService) {}

  // --- Yordamchi endpointlar (statik path'lar :id dan oldin turishi shart) ---

  @Get('catalog')
  @Permissions(Permission.POS_VIEW)
  catalog(
    @CurrentUser() user: any,
    @Query('warehouseId') warehouseId: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ) {
    return this.posService.getCatalog(user.companyId, user.sub, {
      warehouseId,
      search,
      limit,
      page,
    });
  }

  @Get('quick-search')
  @Permissions(Permission.POS_VIEW)
  quickSearch(
    @CurrentUser() user: any,
    @Query('query') query: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.posService.quickSearch(
      user.companyId,
      user.sub,
      query,
      warehouseId,
    );
  }

  @Get('summary/today')
  @Permissions(Permission.POS_VIEW)
  summaryToday(
    @CurrentUser() user: any,
    @Query('cashierId') cashierId?: string,
  ) {
    return this.posService.summaryToday(user.companyId, cashierId);
  }

  // --- Sotuvlar ---

  @Post('sales')
  @Permissions(Permission.POS_CREATE)
  create(@CurrentUser() user: any, @Body() dto: CreatePosSaleDto) {
    return this.posService.create(user.companyId, user.sub, dto);
  }

  /** Chek yaratish + to‘lov — bitta tranzaksiya (POS to‘lov tezligi). */
  @Post('sales/quick-checkout')
  @Permissions(Permission.POS_CREATE)
  quickCheckout(
    @CurrentUser() user: any,
    @Body() dto: QuickCheckoutPosSaleDto,
  ) {
    return this.posService.quickCheckout(user.companyId, user.sub, dto);
  }

  @Get('sales')
  @Permissions(Permission.POS_VIEW)
  findAll(@CurrentUser() user: any, @Query() query: ListPosSalesQueryDto) {
    return this.posService.findAll(user.companyId, query);
  }

  @Get('sales/:id')
  @Permissions(Permission.POS_VIEW)
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.posService.findOne(id, user.companyId);
  }

  @Patch('sales/:id')
  @Permissions(Permission.POS_CREATE)
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdatePosSaleDto,
  ) {
    return this.posService.update(id, user.companyId, user.sub, dto);
  }

  @Post('sales/:id/checkout')
  @Permissions(Permission.POS_CREATE)
  checkout(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: CheckoutPosSaleDto,
  ) {
    return this.posService.checkout(id, user.companyId, user.sub, dto);
  }

  @Post('sales/:id/void')
  @Permissions(Permission.POS_VOID)
  void(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: VoidPosSaleDto,
  ) {
    return this.posService.void(id, user.companyId, user.sub, dto);
  }

  @Delete('sales/:id')
  @Permissions(Permission.POS_CREATE)
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.posService.remove(id, user.companyId, user.sub);
  }
}
