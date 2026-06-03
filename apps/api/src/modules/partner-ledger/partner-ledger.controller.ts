import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions, PermissionsAny } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import {
  CreatePartnerLedgerContactDto,
  CreatePartnerLedgerOperationDto,
  UpdatePartnerLedgerContactDto,
  UpdatePartnerLedgerOperationDto,
} from './dto/partner-ledger.dto';
import { CreatePartnerLedgerSaleOrderDto } from './dto/partner-ledger-sale.dto';
import { PartnerLedgerExcelService } from './partner-ledger-excel.service';
import { PartnerLedgerSaleService } from './partner-ledger-sale.service';
import { PartnerLedgerService } from './partner-ledger.service';

@Controller('partner-ledger')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PartnerLedgerController {
  constructor(
    private readonly partnerLedgerService: PartnerLedgerService,
    private readonly partnerLedgerSaleService: PartnerLedgerSaleService,
    private readonly partnerLedgerExcelService: PartnerLedgerExcelService,
  ) {}

  @Get('sale-order-template')
  @PermissionsAny(Permission.PARTNER_LEDGER_VIEW, Permission.PARTNER_LEDGER_MANAGE)
  saleOrderTemplate(
    @CurrentUser() user: any,
    @Query('warehouseId') warehouseId: string,
    @Query('contactName') contactName: string | undefined,
    @Res() res: Response,
  ) {
    return this.partnerLedgerExcelService.generateSaleOrderTemplate(
      user.companyId,
      warehouseId,
      res,
      contactName,
    );
  }

  @Post('contacts/:contactId/sale-orders/preview-excel')
  @Permissions(Permission.PARTNER_LEDGER_MANAGE)
  @UseInterceptors(FileInterceptor('file'))
  previewSaleOrderExcel(
    @CurrentUser() user: any,
    @Param('contactId') _contactId: string,
    @UploadedFile() file: { buffer?: Buffer },
    @Query('warehouseId') warehouseId: string,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('Fayl yuklanmadi');
    }
    return this.partnerLedgerSaleService.previewOrderFromExcel(
      user.companyId,
      warehouseId,
      file.buffer,
    );
  }

  @Get('contacts/:contactId/sale-orders/:batchId/export/excel')
  @Permissions(Permission.PARTNER_LEDGER_VIEW)
  exportSaleOrderExcel(
    @CurrentUser() user: any,
    @Param('contactId') contactId: string,
    @Param('batchId') batchId: string,
    @Res() res: Response,
  ) {
    return this.partnerLedgerExcelService.exportSaleOrder(
      user.companyId,
      contactId,
      batchId,
      res,
    );
  }

  @Get('summary')
  @Permissions(Permission.PARTNER_LEDGER_VIEW)
  summary(@CurrentUser() user: any) {
    return this.partnerLedgerService.getGlobalSummary(user.companyId);
  }

  @Get('contacts/select')
  @PermissionsAny(Permission.PARTNER_LEDGER_VIEW, Permission.WAREHOUSE_VIEW)
  listContactsForSelect(@CurrentUser() user: any, @Query('search') search?: string) {
    return this.partnerLedgerService.listContactsForSelect(user.companyId, search);
  }

  @Get('contacts')
  @Permissions(Permission.PARTNER_LEDGER_VIEW)
  listContacts(@CurrentUser() user: any, @Query('search') search?: string) {
    return this.partnerLedgerService.listContacts(user.companyId, search);
  }

  @Post('contacts')
  @Permissions(Permission.PARTNER_LEDGER_MANAGE)
  createContact(@CurrentUser() user: any, @Body() dto: CreatePartnerLedgerContactDto) {
    return this.partnerLedgerService.createContact(user.companyId, dto);
  }

  @Get('contacts/:contactId')
  @Permissions(Permission.PARTNER_LEDGER_VIEW)
  getContact(@CurrentUser() user: any, @Param('contactId') contactId: string) {
    return this.partnerLedgerService.getContact(user.companyId, contactId);
  }

  @Patch('contacts/:contactId')
  @Permissions(Permission.PARTNER_LEDGER_MANAGE)
  updateContact(
    @CurrentUser() user: any,
    @Param('contactId') contactId: string,
    @Body() dto: UpdatePartnerLedgerContactDto,
  ) {
    return this.partnerLedgerService.updateContact(user.companyId, contactId, dto);
  }

  @Delete('contacts/:contactId')
  @Permissions(Permission.PARTNER_LEDGER_MANAGE)
  deleteContact(@CurrentUser() user: any, @Param('contactId') contactId: string) {
    return this.partnerLedgerService.deleteContact(user.companyId, user.sub, contactId);
  }

  @Get('contacts/:contactId/operations/export/excel')
  @Permissions(Permission.PARTNER_LEDGER_VIEW)
  exportOperationsExcel(
    @CurrentUser() user: any,
    @Param('contactId') contactId: string,
    @Res() res: Response,
  ) {
    return this.partnerLedgerExcelService.exportContactOperations(
      user.companyId,
      contactId,
      res,
    );
  }

  @Get('contacts/:contactId/operations')
  @Permissions(Permission.PARTNER_LEDGER_VIEW)
  listOperations(
    @CurrentUser() user: any,
    @Param('contactId') contactId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.partnerLedgerService.listOperations(user.companyId, contactId, { page, limit });
  }

  @Get('contacts/:contactId/balance-history')
  @Permissions(Permission.PARTNER_LEDGER_VIEW)
  balanceHistory(
    @CurrentUser() user: any,
    @Param('contactId') contactId: string,
    @Query('days') days?: string,
  ) {
    return this.partnerLedgerService.getBalanceHistory(
      user.companyId,
      contactId,
      parseInt(days || '7', 10) || 7,
    );
  }

  @Get('sale-catalog')
  @PermissionsAny(Permission.PARTNER_LEDGER_VIEW, Permission.WAREHOUSE_VIEW)
  saleCatalog(
    @CurrentUser() user: any,
    @Query('warehouseId') warehouseId: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.partnerLedgerSaleService.getSaleCatalog(user.companyId, {
      warehouseId,
      search,
      page,
      limit,
    });
  }

  @Get('contacts/:contactId/sale-orders/:batchId/lines')
  @Permissions(Permission.PARTNER_LEDGER_VIEW)
  getSaleOrderLines(
    @CurrentUser() user: any,
    @Param('contactId') contactId: string,
    @Param('batchId') batchId: string,
  ) {
    return this.partnerLedgerSaleService.getSaleOrderLines(
      user.companyId,
      contactId,
      batchId,
    );
  }

  @Post('contacts/:contactId/sale-orders')
  @Permissions(Permission.PARTNER_LEDGER_MANAGE)
  createSaleOrder(
    @CurrentUser() user: any,
    @Param('contactId') contactId: string,
    @Body() dto: CreatePartnerLedgerSaleOrderDto,
  ) {
    return this.partnerLedgerSaleService.createSaleOrder(
      user.companyId,
      user.sub,
      contactId,
      dto,
    );
  }

  @Post('contacts/:contactId/sale-orders/:batchId/send')
  @Permissions(Permission.PARTNER_LEDGER_MANAGE)
  sendSaleOrderToPartner(
    @CurrentUser() user: any,
    @Param('contactId') contactId: string,
    @Param('batchId') batchId: string,
  ) {
    return this.partnerLedgerSaleService.sendSaleOrderToPartner(
      user.companyId,
      user.sub,
      contactId,
      batchId,
    );
  }

  @Post('contacts/:contactId/operations')
  @Permissions(Permission.PARTNER_LEDGER_MANAGE)
  createOperation(
    @CurrentUser() user: any,
    @Param('contactId') contactId: string,
    @Body() dto: CreatePartnerLedgerOperationDto,
  ) {
    return this.partnerLedgerService.createOperation(user.companyId, user.sub, contactId, dto);
  }

  @Get('operations/:operationId/lines')
  @Permissions(Permission.PARTNER_LEDGER_VIEW)
  getOperationLines(@CurrentUser() user: any, @Param('operationId') operationId: string) {
    return this.partnerLedgerSaleService.getOperationLines(user.companyId, operationId);
  }

  @Get('operations/:operationId/export/excel')
  @Permissions(Permission.PARTNER_LEDGER_VIEW)
  exportOperationExcel(
    @CurrentUser() user: any,
    @Param('operationId') operationId: string,
    @Res() res: Response,
  ) {
    return this.partnerLedgerExcelService.exportOperation(user.companyId, operationId, res);
  }

  @Patch('operations/:operationId')
  @Permissions(Permission.PARTNER_LEDGER_MANAGE)
  updateOperation(
    @CurrentUser() user: any,
    @Param('operationId') operationId: string,
    @Body() dto: UpdatePartnerLedgerOperationDto,
  ) {
    return this.partnerLedgerService.updateOperation(user.companyId, user.sub, operationId, dto);
  }

  @Delete('operations/:operationId')
  @Permissions(Permission.PARTNER_LEDGER_MANAGE)
  deleteOperation(@CurrentUser() user: any, @Param('operationId') operationId: string) {
    return this.partnerLedgerService.deleteOperation(user.companyId, user.sub, operationId);
  }
}
