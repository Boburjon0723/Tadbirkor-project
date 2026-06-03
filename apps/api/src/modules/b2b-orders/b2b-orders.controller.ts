import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { B2BOrdersService } from './b2b-orders.service';
import { B2BOrderWorkflowService } from './b2b-order-workflow.service';
import { B2BOrderExportService } from './b2b-order-export.service';
import { CreateB2BOrderDto, MapIncomingOrderItemDto, UpdateDraftB2BOrderDto } from './dto/b2b-order.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('b2b-orders')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class B2BOrdersController {
  constructor(
    private readonly ordersService: B2BOrdersService,
    private readonly orderWorkflow: B2BOrderWorkflowService,
    private readonly orderExport: B2BOrderExportService,
  ) {}

  @Post()
  @Permissions(Permission.ORDERS_CREATE)
  create(@CurrentUser() user: any, @Body() dto: CreateB2BOrderDto) {
    return this.ordersService.createOrder(user.companyId, user.sub, dto);
  }

  @Get('hub/stats')
  @Permissions(Permission.ORDERS_VIEW)
  hubStats(@CurrentUser() user: any) {
    return this.ordersService.getOrdersHubStats(user.companyId);
  }

  @Get('stats')
  @Permissions(Permission.ORDERS_VIEW)
  listStats(@CurrentUser() user: any) {
    return this.ordersService.getListStats(user.companyId, 'BUYER');
  }

  @Get()
  @Permissions(Permission.ORDERS_VIEW)
  findAll(@CurrentUser() user: any, @Query() query: any) {
    return this.ordersService.findAll(user.companyId, 'BUYER', query);
  }

  /** :id dan oldin — aks holda "pricing" UUID deb tutib qoladi */
  @Get('pricing/suggestion')
  @Permissions(Permission.ORDERS_VIEW)
  getPricingSuggestion(
    @CurrentUser() user: any,
    @Query('sellerCompanyId') sellerCompanyId: string,
    @Query('productName') productName: string,
  ) {
    return this.ordersService.getSellerPriceSuggestion(user.companyId, sellerCompanyId, productName);
  }

  @Get('seller-catalog')
  @Permissions(Permission.ORDERS_VIEW)
  getSellerCatalog(
    @CurrentUser() user: any,
    @Query('sellerCompanyId') sellerCompanyId: string,
    @Query('search') search?: string,
  ) {
    return this.ordersService.getSellerCatalogForBuyer(user.companyId, sellerCompanyId, search);
  }

  @Get(':id/export/excel')
  @Permissions(Permission.ORDERS_VIEW)
  exportExcel(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    return this.orderExport.exportOrderToExcel(id, user.companyId, res);
  }

  @Get(':id/items')
  @Permissions(Permission.ORDERS_VIEW)
  findOrderItems(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Query() query: { page?: string; limit?: string; search?: string; unmappedOnly?: string },
  ) {
    return this.ordersService.findOrderItemsPage(id, user.companyId, query);
  }

  @Get(':id')
  @Permissions(Permission.ORDERS_VIEW)
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.ordersService.findOne(id, user.companyId);
  }

  @Post(':id/send')
  @Permissions(Permission.ORDERS_SEND)
  send(@CurrentUser() user: any, @Param('id') id: string) {
    return this.orderWorkflow.sendOrder(id, user.companyId, user.sub);
  }

  @Patch(':id')
  @Permissions(Permission.ORDERS_CREATE)
  updateDraft(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateDraftB2BOrderDto) {
    return this.ordersService.updateDraftOrder(id, user.companyId, dto);
  }

  @Post(':id/cancel')
  @Permissions(Permission.ORDERS_CREATE) // Or a specific CANCEL permission
  cancel(@CurrentUser() user: any, @Param('id') id: string) {
    return this.orderWorkflow.cancelOrder(id, user.companyId, user.sub);
  }

  @Post(':id/close-remainder')
  @Permissions(Permission.ORDERS_VIEW)
  closeRemainder(@CurrentUser() user: any, @Param('id') id: string) {
    return this.orderWorkflow.closeUndispatchedRemainder(id, user.companyId, user.sub);
  }

  @Delete(':id')
  @Permissions(Permission.ORDERS_CREATE)
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.orderWorkflow.deleteOrder(id, user.companyId, user.sub);
  }
}

@Controller('incoming-orders')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class IncomingOrdersController {
  constructor(
    private readonly ordersService: B2BOrdersService,
    private readonly orderWorkflow: B2BOrderWorkflowService,
  ) {}

  @Get('stats')
  @Permissions(Permission.ORDERS_VIEW)
  listStats(@CurrentUser() user: any) {
    return this.ordersService.getListStats(user.companyId, 'SELLER');
  }

  @Get()
  @Permissions(Permission.ORDERS_VIEW)
  findAll(@CurrentUser() user: any, @Query() query: any) {
    return this.ordersService.findAll(user.companyId, 'SELLER', query);
  }

  @Get(':id')
  @Permissions(Permission.ORDERS_VIEW)
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.ordersService.findOne(id, user.companyId);
  }

  @Post(':id/accept')
  @Permissions(Permission.ORDERS_ACCEPT)
  accept(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body?: { allowPartial?: boolean },
  ) {
    return this.orderWorkflow.acceptOrder(id, user.companyId, user.sub, {
      allowPartial: Boolean(body?.allowPartial),
    });
  }

  @Post(':id/reject')
  @Permissions(Permission.ORDERS_REJECT)
  reject(@CurrentUser() user: any, @Param('id') id: string) {
    return this.orderWorkflow.rejectOrder(id, user.companyId, user.sub);
  }

  @Post(':id/close-remainder')
  @Permissions(Permission.ORDERS_ACCEPT)
  closeRemainder(@CurrentUser() user: any, @Param('id') id: string) {
    return this.orderWorkflow.closeUndispatchedRemainder(id, user.companyId, user.sub);
  }

  @Post(':id/items/:itemId/map')
  @Permissions(Permission.ORDERS_ACCEPT)
  mapIncomingItem(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: MapIncomingOrderItemDto,
  ) {
    return this.orderWorkflow.mapIncomingOrderItem(id, itemId, user.companyId, user.sub, dto);
  }
}
