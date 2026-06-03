import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { DebtsService } from './debts.service';
import { CreatePaymentRecordDto } from './dto/payment-record.dto';
import { ApplyPartnerBulkPaymentDto } from './dto/apply-partner-bulk-payment.dto';
import { ConfirmPartnerBulkPaymentDto } from './dto/confirm-partner-bulk-payment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ReportsService } from '../reports/reports.service';
import { ReportExcelService } from '../reports/report-excel.service';
import { generatePartnerBalancePdfBuffer } from '../pdf/partner-balance-pdf.util';

@Controller('debts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DebtsController {
  constructor(
    private readonly debtsService: DebtsService,
    private readonly reportsService: ReportsService,
    private readonly reportExcel: ReportExcelService,
  ) {}

  @Get('entries/summary')
  @Permissions(Permission.DEBT_VIEW)
  entriesSummary(@CurrentUser() user: any) {
    return this.debtsService.getEntriesSummary(user.companyId);
  }

  @Get('partner-groups')
  @Permissions(Permission.DEBT_VIEW)
  partnerGroups(
    @CurrentUser() user: any,
    @Query('tab') tab?: 'receivable' | 'payable',
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.debtsService.findPartnerGroups(user.companyId, { tab, search, page, limit });
  }

  @Get('partner-reports')
  @Permissions(Permission.DEBT_VIEW)
  partnerReportArchive(
    @CurrentUser() user: any,
    @Query('tab') tab?: 'receivable' | 'payable',
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('settledOnly') settledOnly?: string,
  ) {
    return this.debtsService.findPartnerReportArchive(user.companyId, {
      tab,
      search,
      page,
      limit,
      settledOnly,
    });
  }

  @Get('partner-groups/:partnerCompanyId')
  @Permissions(Permission.DEBT_VIEW)
  partnerGroupOne(
    @CurrentUser() user: any,
    @Param('partnerCompanyId') partnerCompanyId: string,
    @Query('tab') tab?: 'receivable' | 'payable',
  ) {
    return this.debtsService.findPartnerGroupOne(
      user.companyId,
      partnerCompanyId,
      tab === 'payable' ? 'payable' : 'receivable',
    );
  }

  @Get('entries')
  @Permissions(Permission.DEBT_VIEW)
  findAll(
    @CurrentUser() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.debtsService.findAllEntries(user.companyId, { page, limit, status });
  }

  @Get('payment-records/pending')
  @Permissions(Permission.DEBT_CONFIRM_PAYMENT)
  findPendingPayments(@CurrentUser() user: any) {
    return this.debtsService.findPendingPaymentRecords(user.companyId);
  }

  @Get('entries/:id')
  @Permissions(Permission.DEBT_VIEW)
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.debtsService.findEntry(id, user.companyId);
  }

  @Get('partners/:partnerCompanyId/ledger')
  @Permissions(Permission.DEBT_VIEW)
  getPartnerLedger(@CurrentUser() user: any, @Param('partnerCompanyId') partnerId: string) {
    return this.debtsService.findPartnerLedger(user.companyId, partnerId);
  }

  @Get('partners/:partnerCompanyId/akt-sverka/pdf')
  @Permissions(Permission.DEBT_VIEW)
  async exportPartnerAktPdf(
    @CurrentUser() user: any,
    @Param('partnerCompanyId') partnerCompanyId: string,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Res() res: Response,
  ) {
    const data = await this.reportsService.getPartnerDetailedBalance(user.companyId, partnerCompanyId, {
      dateFrom,
      dateTo,
    });

    const pdfBuffer = await generatePartnerBalancePdfBuffer(data, { dateFrom, dateTo });

    const safeName =
      data.partner.name
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .slice(0, 40) || 'hamkor';
    const filename = `akt-sverka-${safeName}-${new Date().toISOString().slice(0, 10)}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  }

  @Get('partners/:partnerCompanyId/akt-sverka/excel')
  @Permissions(Permission.DEBT_VIEW)
  exportPartnerAktExcel(
    @CurrentUser() user: any,
    @Param('partnerCompanyId') partnerCompanyId: string,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Res() res: Response,
  ) {
    return this.reportExcel.exportPartnerBalanceExcel(
      user.companyId,
      partnerCompanyId,
      { dateFrom, dateTo },
      res,
    );
  }

  @Get('partners/:partnerCompanyId')
  @Permissions(Permission.DEBT_VIEW)
  getPartnerBalance(@CurrentUser() user: any, @Param('partnerCompanyId') partnerId: string) {
    return this.debtsService.findPartnerBalance(user.companyId, partnerId);
  }

  @Post('partners/:partnerCompanyId/record-bulk-payment')
  @Permissions(Permission.DEBT_CREATE_PAYMENT)
  recordPartnerBulkPayment(
    @CurrentUser() user: any,
    @Param('partnerCompanyId') partnerCompanyId: string,
    @Body() dto: ApplyPartnerBulkPaymentDto,
  ) {
    return this.debtsService.recordPartnerBulkPaymentByDebtor(
      user.companyId,
      partnerCompanyId,
      user.sub,
      dto,
    );
  }

  @Post('partners/:partnerCompanyId/confirm-bulk-payments')
  @Permissions(Permission.DEBT_CONFIRM_PAYMENT)
  confirmPartnerBulkPayments(
    @CurrentUser() user: any,
    @Param('partnerCompanyId') partnerCompanyId: string,
    @Body() dto: ConfirmPartnerBulkPaymentDto,
  ) {
    return this.debtsService.confirmPartnerBulkPaymentsByCreditor(
      user.companyId,
      partnerCompanyId,
      user.sub,
      dto,
    );
  }

  @Post('entries/:id/apply-payment')
  @Permissions(Permission.DEBT_CONFIRM_PAYMENT)
  applyPaymentByCreditor(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: CreatePaymentRecordDto,
  ) {
    return this.debtsService.applyPaymentByCreditor(id, user.companyId, user.sub, dto);
  }

  @Post(':debtEntryId/payment-records')
  @Permissions(Permission.DEBT_CREATE_PAYMENT)
  createPayment(@CurrentUser() user: any, @Param('debtEntryId') entryId: string, @Body() dto: CreatePaymentRecordDto) {
    return this.debtsService.createPaymentRecord(entryId, user.companyId, user.sub, dto);
  }

  @Post('payment-records/:id/confirm')
  @Permissions(Permission.DEBT_CONFIRM_PAYMENT)
  confirmPayment(@CurrentUser() user: any, @Param('id') id: string) {
    return this.debtsService.confirmPayment(id, user.companyId, user.sub);
  }

  @Post('payment-records/:id/reject')
  @Permissions(Permission.DEBT_REJECT_PAYMENT)
  rejectPayment(@CurrentUser() user: any, @Param('id') id: string) {
    return this.debtsService.rejectPayment(id, user.companyId, user.sub);
  }
}
