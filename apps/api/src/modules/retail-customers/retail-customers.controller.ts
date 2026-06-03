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
import { RetailCustomersService } from './retail-customers.service';
import {
  CreateRetailCustomerDto,
  RecordPrepaidDto,
  UpdateRetailCustomerDto,
} from './dto/retail-customer.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('retail-customers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RetailCustomersController {
  constructor(private readonly service: RetailCustomersService) {}

  @Get()
  @Permissions(Permission.POS_VIEW)
  findAll(@CurrentUser() user: any) {
    return this.service.findAll(user.companyId);
  }

  @Get('search')
  @Permissions(Permission.POS_VIEW)
  search(
    @CurrentUser() user: any,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.search(user.companyId, q, limit ? Number(limit) : 20);
  }

  /** Kassa mijoz tanlash — oxirgi mijozlar + qidiruv */
  @Get('pos-picker')
  @Permissions(Permission.POS_VIEW)
  posPicker(
    @CurrentUser() user: any,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ) {
    const lim = limit ? Number(limit) : 12;
    const term = (q || '').trim();
    if (!term) {
      return this.service.listForPosPicker(user.companyId, lim);
    }
    return this.service.search(user.companyId, term, lim);
  }

  @Get('summary')
  @Permissions(Permission.POS_VIEW)
  findAllWithBalances(@CurrentUser() user: any) {
    void this.service.migratePosRegistryFlags(user.companyId);
    return this.service.findAllWithBalances(user.companyId);
  }

  @Get(':id/ledger/entries/:entryId/sale-items')
  @Permissions(Permission.POS_VIEW)
  getLedgerSaleItems(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Param('entryId') entryId: string,
  ) {
    return this.service.getLedgerEntrySaleItems(
      id,
      entryId,
      user.companyId,
    );
  }

  @Get(':id/ledger')
  @Permissions(Permission.POS_VIEW)
  findLedger(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.findLedger(id, user.companyId);
  }

  @Post(':id/prepaid')
  @Permissions(Permission.POS_CREDIT)
  recordPrepaid(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: RecordPrepaidDto,
  ) {
    return this.service.recordPrepaid(id, user.companyId, user.sub, dto);
  }

  @Post(':id/withdraw')
  @Permissions(Permission.POS_CREDIT)
  recordWithdraw(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: RecordPrepaidDto,
  ) {
    return this.service.recordWithdraw(id, user.companyId, user.sub, dto);
  }

  @Get(':id')
  @Permissions(Permission.POS_VIEW)
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.findOne(id, user.companyId);
  }

  @Post()
  @Permissions(Permission.POS_CREATE)
  create(@CurrentUser() user: any, @Body() dto: CreateRetailCustomerDto) {
    return this.service.create(user.companyId, dto);
  }

  @Patch(':id')
  @Permissions(Permission.POS_CREATE)
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateRetailCustomerDto,
  ) {
    return this.service.update(id, user.companyId, dto);
  }
}
