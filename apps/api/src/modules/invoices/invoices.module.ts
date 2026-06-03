import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { B2BOrdersModule } from '../b2b-orders/b2b-orders.module';

@Module({
  imports: [B2BOrdersModule],
  controllers: [InvoicesController],
})
export class InvoicesModule {}
