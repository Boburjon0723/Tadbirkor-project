import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { StockService } from './stock.service';
import { AtpService } from './atp.service';
import { 
  CreateStockMovementDto, 
  CreateStockAdjustmentDto, 
  CreateStockTransferDto 
} from './dto/stock.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { WarehouseScopeService } from '../users/services/warehouse-scope.service';

@Controller('stock')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StockController {
  constructor(
    private readonly stockService: StockService,
    private readonly warehouseScopeService: WarehouseScopeService,
    private readonly atpService: AtpService,
  ) {}

  private async resolveWarehouseId(
    companyId: string,
    userId: string,
    requestedId?: string,
  ): Promise<string | undefined> {
    const scope = await this.warehouseScopeService.getForUser(companyId, userId);
    const requested = String(requestedId || '').trim();

    if (!scope.all) {
      if (!scope.warehouseIds.length) {
        throw new ForbiddenException(
          'Ombor biriktirilmagan. Jamoa bo‘limida omborni belgilang.',
        );
      }
      if (requested && !this.warehouseScopeService.isAllowed(scope, requested)) {
        throw new ForbiddenException('Ushbu ombor ma’lumotlariga ruxsat yo‘q');
      }
      return scope.defaultWarehouseId || scope.warehouseIds[0];
    }

    return requested || undefined;
  }

  @Get('balances')
  @Permissions(Permission.WAREHOUSE_VIEW)
  async getBalances(@CurrentUser() user: any, @Query('warehouseId') warehouseId?: string) {
    const resolved = await this.resolveWarehouseId(
      user.companyId,
      user.sub,
      warehouseId,
    );
    return this.stockService.getBalances(user.companyId, resolved);
  }

  @Get('movements')
  @Permissions(Permission.WAREHOUSE_VIEW)
  async getMovements(@CurrentUser() user: any, @Query('warehouseId') warehouseId?: string) {
    const resolved = await this.resolveWarehouseId(
      user.companyId,
      user.sub,
      warehouseId,
    );
    return this.stockService.getMovements(user.companyId, resolved);
  }

  @Post('movements/in')
  @Permissions(Permission.WAREHOUSE_RECEIVE)
  recordIn(@CurrentUser() user: any, @Body() dto: CreateStockMovementDto) {
    return this.stockService.recordMovement(user.companyId, dto, 'IN', 'MANUAL', user.sub);
  }

  @Post('movements/out')
  @Permissions(Permission.WAREHOUSE_DISPATCH)
  recordOut(@CurrentUser() user: any, @Body() dto: CreateStockMovementDto) {
    return this.stockService.recordMovement(user.companyId, dto, 'OUT', 'MANUAL', user.sub);
  }

  @Post('adjustments')
  @Permissions(Permission.WAREHOUSE_ADJUST)
  adjust(@CurrentUser() user: any, @Body() dto: CreateStockAdjustmentDto) {
    return this.stockService.adjustStock(user.companyId, dto, user.sub);
  }

  @Post('transfer')
  @Permissions(Permission.WAREHOUSE_TRANSFER)
  transfer(@CurrentUser() user: any, @Body() dto: CreateStockTransferDto) {
    return this.stockService.transferStock(user.companyId, dto, user.sub);
  }

  // --- ATP endpoints ---

  /**
   * GET /stock/availability/:variantId?warehouseId=...
   * Bitta mahsulot uchun erkin qoldiqni ko'rish
   */
  @Get('availability/:variantId')
  @Permissions(Permission.WAREHOUSE_VIEW)
  async getAvailability(
    @CurrentUser() user: any,
    @Param('variantId') variantId: string,
    @Query('warehouseId') warehouseId: string,
  ) {
    warehouseId = await this.resolveWarehouseId(user.companyId, user.sub, warehouseId);
    const result = await this.atpService.getFreeStock(variantId, warehouseId, user.companyId);
    return {
      productVariantId: variantId,
      warehouseId,
      onHand: result.onHand,
      reserved: result.reserved,
      blocked: result.blocked,
      free: result.free,
    };
  }

  /**
   * POST /stock/availability/batch
   * Ko'p variant uchun bir vaqtda erkin qoldiqni ko'rish
   * Body: { warehouseId: string, variantIds: string[] }
   */
  @Post('availability/batch')
  @Permissions(Permission.WAREHOUSE_VIEW)
  async getBatchAvailability(
    @CurrentUser() user: any,
    @Body() body: { warehouseId: string; variantIds: string[] },
  ) {
    const warehouseId = await this.resolveWarehouseId(
      user.companyId,
      user.sub,
      body.warehouseId,
    );
    const map = await this.atpService.getBatchFreeStock(
      user.companyId,
      warehouseId,
      body.variantIds,
    );
    return Array.from(map.entries()).map(([variantId, stock]) => ({
      productVariantId: variantId,
      warehouseId,
      onHand: stock.onHand,
      reserved: stock.reserved,
      blocked: stock.blocked,
      free: stock.free,
    }));
  }
}
