import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { WarehouseIntakeAccessGuard } from '../../common/guards/warehouse-intake-access.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { WarehouseIntakeService } from './warehouse-intake.service';
import {
  AddIntakeLineDto,
  CreateWarehouseIntakeDto,
  QuickIntakeProductDto,
  ScanIntakeLineDto,
  UpdateIntakeLineDto,
} from './dto/warehouse-intake.dto';

type IntakeUser = { companyId: string; sub: string };

@Controller('warehouse-intake')
@UseGuards(JwtAuthGuard, PermissionsGuard, WarehouseIntakeAccessGuard)
export class WarehouseIntakeController {
  constructor(private readonly intakeService: WarehouseIntakeService) {}

  @Get('lookup')
  @Permissions(Permission.WAREHOUSE_RECEIVE)
  lookup(
    @CurrentUser() user: IntakeUser,
    @Query('barcode') barcode: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.intakeService.lookupBarcode(
      user.companyId,
      user.sub,
      barcode,
      warehouseId,
    );
  }

  @Post()
  @Permissions(Permission.WAREHOUSE_RECEIVE)
  create(@CurrentUser() user: IntakeUser, @Body() dto: CreateWarehouseIntakeDto) {
    return this.intakeService.create(user.companyId, user.sub, dto);
  }

  @Get()
  @Permissions(Permission.WAREHOUSE_VIEW)
  list(
    @CurrentUser() user: IntakeUser,
    @Query('status') status?: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.intakeService.list(user.companyId, user.sub, { status, warehouseId });
  }

  @Get(':id/nakladnoy/pdf')
  @Permissions(Permission.WAREHOUSE_VIEW)
  async downloadNakladnoy(
    @CurrentUser() user: IntakeUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.intakeService.getNakladnoyPdfBuffer(
      id,
      user.companyId,
      user.sub,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename=nakladnoy-${id.slice(0, 8)}.pdf`,
    );
    res.send(pdfBuffer);
  }

  @Get(':id')
  @Permissions(Permission.WAREHOUSE_VIEW)
  findOne(@CurrentUser() user: IntakeUser, @Param('id') id: string) {
    return this.intakeService.findOne(id, user.companyId, user.sub);
  }

  @Post(':id/lines')
  @Permissions(Permission.WAREHOUSE_RECEIVE)
  addLine(
    @CurrentUser() user: IntakeUser,
    @Param('id') id: string,
    @Body() dto: AddIntakeLineDto,
  ) {
    return this.intakeService.addLine(id, user.companyId, user.sub, dto);
  }

  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Post(':id/scan')
  @Permissions(Permission.WAREHOUSE_RECEIVE)
  scan(
    @CurrentUser() user: IntakeUser,
    @Param('id') id: string,
    @Body() dto: ScanIntakeLineDto,
  ) {
    return this.intakeService.scanLine(id, user.companyId, user.sub, dto);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post(':id/quick-product')
  @Permissions(Permission.WAREHOUSE_RECEIVE)
  quickProduct(
    @CurrentUser() user: IntakeUser,
    @Param('id') id: string,
    @Body() dto: QuickIntakeProductDto,
  ) {
    return this.intakeService.quickProduct(id, user.companyId, user.sub, dto);
  }

  @Patch(':id/lines/:lineId')
  @Permissions(Permission.WAREHOUSE_RECEIVE)
  updateLine(
    @CurrentUser() user: IntakeUser,
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() dto: UpdateIntakeLineDto,
  ) {
    return this.intakeService.updateLine(id, lineId, user.companyId, user.sub, dto);
  }

  @Delete(':id/lines/:lineId')
  @Permissions(Permission.WAREHOUSE_RECEIVE)
  removeLine(
    @CurrentUser() user: IntakeUser,
    @Param('id') id: string,
    @Param('lineId') lineId: string,
  ) {
    return this.intakeService.removeLine(id, lineId, user.companyId, user.sub);
  }

  @Post(':id/complete')
  @Permissions(Permission.WAREHOUSE_RECEIVE)
  complete(@CurrentUser() user: IntakeUser, @Param('id') id: string) {
    return this.intakeService.complete(id, user.companyId, user.sub);
  }

  @Post(':id/cancel')
  @Permissions(Permission.WAREHOUSE_RECEIVE)
  cancel(@CurrentUser() user: IntakeUser, @Param('id') id: string) {
    return this.intakeService.cancel(id, user.companyId, user.sub);
  }
}
