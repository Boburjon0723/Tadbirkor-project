import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RetailReceivablesService } from './retail-receivables.service';
import { RecordReceivablePaymentDto } from './dto/retail-receivable.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('retail-receivables')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RetailReceivablesController {
  constructor(private readonly service: RetailReceivablesService) {}

  @Get()
  @Permissions(Permission.POS_VIEW)
  findAll(
    @CurrentUser() user: any,
    @Query('status') status?: string,
    @Query('retailCustomerId') retailCustomerId?: string,
  ) {
    return this.service.findAll(user.companyId, { status, retailCustomerId });
  }

  @Get(':id')
  @Permissions(Permission.POS_VIEW)
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.findOne(id, user.companyId);
  }

  @Post(':id/payments')
  @Permissions(Permission.POS_CREDIT)
  recordPayment(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: RecordReceivablePaymentDto,
  ) {
    return this.service.recordPayment(id, user.companyId, user.sub, dto);
  }
}
