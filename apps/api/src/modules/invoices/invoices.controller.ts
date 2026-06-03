import { Controller, Get, Param, UseGuards, Request, Res, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { B2BOrdersService } from '../b2b-orders/b2b-orders.service';
import { generateInvoicePdfBuffer } from '../pdf/invoice-pdf.util';

@Controller('invoices')
@UseGuards(JwtAuthGuard)
export class InvoicesController {
  constructor(private readonly ordersService: B2BOrdersService) {}

  @Get(':id/pdf')
  async downloadInvoice(@Param('id') id: string, @Request() req: any, @Res() res: Response) {
    const order = await this.ordersService.findOne(id, req.user.companyId);
    
    if (!order) throw new NotFoundException('Invoice topilmadi');

    const totalAmount = order.items.reduce((sum, item) => 
      sum + (Number(item.quantity) * Number(item.expectedPrice || 0)), 0
    );

    const invoiceData = {
      invoiceNumber: `INV-${new Date(order.createdAt).getFullYear()}-${order.id.slice(0, 4).toUpperCase()}`,
      date: order.createdAt,
      status: order.status,
      seller: order.seller,
      buyer: {
        ...order.buyer,
        phone: (order.buyer as any)?.phone || '---'
      },
      totalAmount,
      currency: String(order.items[0]?.expectedCurrency || 'UZS'),
      items: order.items.map(item => ({
        productName: item.productNameSnapshot,
        variantName: '',
        categoryName: 'Boshqa',
        quantity: Number(item.quantity),
        price: Number(item.expectedPrice || 0),
        total: Number(item.quantity) * Number(item.expectedPrice || 0)
      }))
    };

    const pdfBuffer = await generateInvoicePdfBuffer(invoiceData);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoiceData.invoiceNumber}.pdf`);
    res.send(pdfBuffer);
  }
}
