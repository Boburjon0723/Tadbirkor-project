import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  Res,
  Param,
  ForbiddenException,
} from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { ReportExcelService } from './report-excel.service';
import { PosReportsService } from './pos-reports.service';
import { ReportQueryDto } from './dto/report-query.dto';
import { MonthlyOverviewQueryDto } from './dto/monthly-overview-query.dto';
import { MonthlyOverviewService } from './monthly-overview.service';
import { ProductExportQueryDto } from './dto/product-export-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions, PermissionsAny } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/role.enum';
import { generatePartnerBalancePdfBuffer } from '../pdf/partner-balance-pdf.util';
import { FieldService } from '../field/field.service';
import { WarehouseScopeService } from '../users/services/warehouse-scope.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly reportExcel: ReportExcelService,
    private readonly posReportsService: PosReportsService,
    private readonly monthlyOverviewService: MonthlyOverviewService,
    private readonly fieldService: FieldService,
    private readonly warehouseScopeService: WarehouseScopeService,
  ) {}

  /** Oy bo‘yicha moliya: POS, kirim, xarajat, oylik va foyda/zarar */
  @Get('monthly-overview')
  @Permissions(Permission.REPORTS_VIEW)
  getMonthlyOverview(@Request() req: any, @Query() query: MonthlyOverviewQueryDto) {
    return this.monthlyOverviewService.getOverview(req.user.companyId, {
      year: query.year,
      month: query.month,
    });
  }

  /** SALES/WAREHOUSE — faqat biriktirilgan ombor; OWNER/MANAGER — tanlangan ombor */
  private async resolvePosReportWarehouseId(
    companyId: string,
    userId: string,
    requestedId?: string,
  ): Promise<string | undefined> {
    const scope = await this.warehouseScopeService.getForUser(companyId, userId);
    const requested = String(requestedId || '').trim();

    if (!scope.all) {
      if (!scope.warehouseIds.length) {
        throw new ForbiddenException(
          'Hisobot uchun ombor biriktirilmagan. Jamoa bo‘limida omborni belgilang.',
        );
      }
      if (requested && !this.warehouseScopeService.isAllowed(scope, requested)) {
        throw new ForbiddenException('Ushbu ombor POS hisobotiga ruxsat yo‘q');
      }
      return scope.defaultWarehouseId || scope.warehouseIds[0];
    }

    return requested || undefined;
  }

  /** Faqat POS cheklaridan — chakana savdo hisoboti */
  @Get('pos/summary')
  @Permissions(Permission.POS_VIEW)
  async getPosSummary(@Request() req: any, @Query() query: ReportQueryDto) {
    const warehouseId = await this.resolvePosReportWarehouseId(
      req.user.companyId,
      req.user.sub,
      query.warehouseId,
    );
    return this.posReportsService.getSummary(req.user.companyId, {
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      warehouseId,
    });
  }

  @Get('pos/top-products')
  @Permissions(Permission.POS_VIEW)
  async getPosTopProducts(
    @Request() req: any,
    @Query() query: ReportQueryDto,
    @Query('limit') limit?: string,
  ) {
    const warehouseId = await this.resolvePosReportWarehouseId(
      req.user.companyId,
      req.user.sub,
      query.warehouseId,
    );
    return this.posReportsService.getTopProducts(req.user.companyId, {
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      warehouseId,
      limit: limit ? Number(limit) : 10,
    });
  }

  /**
   * Kirim/sotuv/foyda/ombor qiymati yig'ma hisoboti.
   * Filtrlar: dateFrom, dateTo, warehouseId. Valyutalar (UZS/USD) alohida qaytariladi.
   */
  /**
   * Dala xodimlari bo‘yicha tasdiqlangan vazifalarda o‘rnatilgan mahsulotlar (davr bo‘yicha).
   */
  @Get('field-workers/installations')
  @Permissions(Permission.REPORTS_VIEW)
  getFieldWorkerInstallations(@Request() req: any, @Query() query: ReportQueryDto) {
    return this.fieldService.getKpi(req.user.companyId, query.dateFrom, query.dateTo);
  }

  @Get('summary')
  @Permissions(Permission.REPORTS_VIEW)
  getCostSummary(@Request() req: any, @Query() query: ReportQueryDto) {
    return this.reportsService.getCostSummary(req.user.companyId, {
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      warehouseId: query.warehouseId,
    });
  }

  /**
   * Kunlik kirim/sotuv/foyda — chiziqli grafik uchun.
   */
  @Get('summary/daily')
  @Permissions(Permission.REPORTS_VIEW)
  getDailyBreakdown(@Request() req: any, @Query() query: ReportQueryDto) {
    return this.reportsService.getDailyBreakdown(req.user.companyId, {
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      warehouseId: query.warehouseId,
    });
  }

  /**
   * Top sotilgan mahsulotlar (default: 10 ta).
   * Query: limit (1..50).
   */
  @Get('summary/top-products')
  @Permissions(Permission.REPORTS_VIEW)
  getTopProducts(
    @Request() req: any,
    @Query() query: ReportQueryDto,
    @Query('limit') limit?: string,
  ) {
    return this.reportsService.getTopProducts(req.user.companyId, {
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      warehouseId: query.warehouseId,
      limit: limit ? Number(limit) : 10,
    });
  }

  /**
   * Yig'ma + kunlik + top mahsulotlarni Excel'ga eksport qilish.
   */
  @Get('summary/export')
  @Permissions(Permission.REPORTS_VIEW)
  exportSummary(@Request() req: any, @Query() query: ReportQueryDto, @Res() res: Response) {
    return this.reportExcel.exportSummaryToExcel(
      req.user.companyId,
      {
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        warehouseId: query.warehouseId,
      },
      res,
    );
  }

  @Get('stock')
  @Permissions(Permission.REPORTS_VIEW)
  getStockReport(@Request() req: any, @Query() query: ReportQueryDto) {
    return this.reportsService.getStockReport(req.user.companyId, query);
  }

  @Get('stock-movements')
  @Permissions(Permission.REPORTS_VIEW)
  getStockMovementReport(@Request() req: any, @Query() query: ReportQueryDto) {
    return this.reportsService.getStockMovementReport(req.user.companyId, query);
  }

  @Get('debtors')
  @Permissions(Permission.REPORTS_VIEW)
  getDebtorsReport(@Request() req: any, @Query() query: ReportQueryDto) {
    return this.reportsService.getDebtorsReport(req.user.companyId, query);
  }

  @Get('creditors')
  @Permissions(Permission.REPORTS_VIEW)
  getCreditorsReport(@Request() req: any, @Query() query: ReportQueryDto) {
    return this.reportsService.getCreditorsReport(req.user.companyId, query);
  }

  @Get('partners-balance')
  @Permissions(Permission.REPORTS_VIEW)
  getPartnersBalanceReport(@Request() req: any) {
    return this.reportsService.getPartnersBalanceReport(req.user.companyId);
  }

  @Get('b2b-orders')
  @Permissions(Permission.REPORTS_VIEW)
  getB2BOrdersReport(@Request() req: any, @Query() query: ReportQueryDto) {
    return this.reportsService.getB2BOrdersReport(req.user.companyId, query);
  }

  @Get('analytics/orders')
  @PermissionsAny(Permission.REPORTS_VIEW, Permission.ORDERS_VIEW)
  getB2BOrdersAnalytics(@Request() req: any, @Query('days') days?: string) {
    return this.reportsService.getB2BOrdersAnalytics(req.user.companyId, days ? Number(days) : 30);
  }

  @Get('analytics/stock')
  @PermissionsAny(Permission.REPORTS_VIEW, Permission.WAREHOUSE_VIEW)
  getStockMovementAnalytics(@Request() req: any, @Query('days') days?: string) {
    return this.reportsService.getStockMovementAnalytics(req.user.companyId, days ? Number(days) : 30);
  }

  @Get('export/stock')
  @Permissions(Permission.REPORTS_VIEW)
  exportStock(@Request() req: any, @Query() query: ReportQueryDto, @Res() res: Response) {
    return this.reportExcel.exportStockToExcel(req.user.companyId, query, res);
  }

  @Get('export/stock/pdf')
  @Permissions(Permission.REPORTS_VIEW)
  exportStockPdf(@Request() req: any, @Query() query: ReportQueryDto, @Res() res: Response) {
    return this.reportExcel.exportStockToPdf(req.user.companyId, query, res);
  }

  @Get('export/products-import-format')
  @Permissions(Permission.REPORTS_VIEW)
  exportProductsImportFormat(
    @Request() req: any,
    @Query() query: ProductExportQueryDto,
    @Res() res: Response,
  ) {
    return this.reportExcel.exportProductsForImportToExcel(
      req.user.companyId,
      query.warehouseId,
      query.mode || 'with_stock',
      res,
    );
  }

  @Get('templates/products')
  @Permissions(Permission.REPORTS_VIEW)
  getProductTemplate(@Request() req: any, @Res() res: Response) {
    return this.reportExcel.generateProductImportTemplate(req.user.companyId, res);
  }

  @Get('partners/:partnerCompanyId/balance/pdf')
  @Permissions(Permission.REPORTS_VIEW)
  async getPartnerBalancePdf(
    @Request() req: any,
    @Param('partnerCompanyId') partnerCompanyId: string,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Res() res: Response
  ) {
    const data = await this.reportsService.getPartnerDetailedBalance(
      req.user.companyId,
      partnerCompanyId,
      { dateFrom, dateTo }
    );

    const pdfBuffer = await generatePartnerBalancePdfBuffer(data, { dateFrom, dateTo });

    const filename = `akt-sverka-${data.partner.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 7)}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(pdfBuffer);
  }
}
