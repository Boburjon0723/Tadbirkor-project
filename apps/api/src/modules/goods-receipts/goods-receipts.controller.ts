import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  Query,
  UseGuards,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { GoodsReceiptsService } from './goods-receipts.service';
import { GoodsReceiptAcceptService } from './goods-receipt-accept.service';
import { GoodsReceiptExportService } from './goods-receipt-export.service';
import { AcceptReceiptDto, PartialAcceptReceiptDto } from './dto/goods-receipt.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

import { generateReceiptPdfBuffer } from '../pdf/receipt-pdf.util';

@Controller('goods-receipts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class GoodsReceiptsController {
  constructor(
    private readonly goodsReceiptsService: GoodsReceiptsService,
    private readonly goodsReceiptAcceptService: GoodsReceiptAcceptService,
    private readonly goodsReceiptExportService: GoodsReceiptExportService,
  ) {}

  @Get()
  @Permissions(Permission.GOODS_RECEIPTS_VIEW)
  findAll(
    @CurrentUser() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.goodsReceiptsService.findAll(user.companyId, 'BUYER', {
      page,
      limit,
      status,
      search,
    });
  }

  @Get('export/excel')
  @Permissions(Permission.GOODS_RECEIPTS_VIEW)
  exportAllExcel(@CurrentUser() user: any, @Res() res: Response) {
    return this.goodsReceiptExportService.exportAllToExcel(user.companyId, res);
  }

  @Get(':id')
  @Permissions(Permission.GOODS_RECEIPTS_VIEW)
  findOne(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Query('mode') mode?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.goodsReceiptsService.findOne(id, user.companyId, {
      mode: mode === 'full' ? 'full' : 'view',
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post(':id/accept')
  @Permissions(Permission.GOODS_RECEIPTS_ACCEPT)
  accept(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: AcceptReceiptDto) {
    return this.goodsReceiptAcceptService.accept(id, user.companyId, user.sub, dto);
  }

  @Post(':id/partial-accept')
  @Permissions(Permission.GOODS_RECEIPTS_ACCEPT)
  partialAccept(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: PartialAcceptReceiptDto) {
    return this.goodsReceiptAcceptService.partialAccept(id, user.companyId, user.sub, dto);
  }

  @Post(':id/reject')
  @Permissions(Permission.GOODS_RECEIPTS_REJECT)
  reject(@CurrentUser() user: any, @Param('id') id: string) {
    return this.goodsReceiptAcceptService.reject(id, user.companyId, user.sub);
  }
  @Get(':id/export/excel')
  @Permissions(Permission.GOODS_RECEIPTS_VIEW)
  exportExcel(@CurrentUser() user: any, @Param('id') id: string, @Res() res: Response) {
    return this.goodsReceiptExportService.exportReceiptToExcel(id, user.companyId, res);
  }

  @Get(':id/pdf')
  @Permissions(Permission.GOODS_RECEIPTS_VIEW)
  async downloadPdf(@CurrentUser() user: any, @Param('id') id: string, @Res() res: Response) {
    const receipt = await this.goodsReceiptsService.findOne(id, user.companyId, { mode: 'view' });
    if (!receipt) throw new NotFoundException('Qabul hujjati topilmadi');

    const receiptData = {
      receiptNumber: `RCP-${receipt.id.slice(0, 8).toUpperCase()}`,
      date: receipt.createdAt,
      status: receipt.status,
      seller: receipt.sellerCompany,
      buyer: receipt.buyerCompany,
      items: receipt.items.map(item => {
        // Resolve category from order items if available
        const orderItem = (receipt.order as any)?.items?.find((oi: any) => 
          oi.productNameSnapshot === item.productNameSnapshot || 
          oi.productVariantId === item.productVariantId
        );
        
        return {
          productName: item.productNameSnapshot,
          variantName:
            (item as any).productVariant?.name ||
            (item as any).mapping?.ownProductVariant?.name ||
            '',
          categoryName: (orderItem?.productVariant as any)?.product?.category?.name || 'Boshqa',
          quantity: item.quantity,
          receivedQuantity: (item as any).receivedQuantity ?? item.quantity,
          price: Number(orderItem?.expectedPrice || 0)
        };
      })
    };

    const pdfBuffer = await generateReceiptPdfBuffer({
      receiptNumber: receiptData.receiptNumber,
      date: receiptData.date,
      status: receiptData.status,
      seller: receiptData.seller,
      buyer: receiptData.buyer,
      currency: String(
        (receipt.order as any)?.items?.find((oi: any) => oi.expectedCurrency)?.expectedCurrency ||
          'UZS',
      ),
      items: receiptData.items.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        receivedQuantity: Number(item.receivedQuantity),
      })),
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=receipt-${receiptData.receiptNumber}.pdf`);
    res.send(pdfBuffer);
  }
}
