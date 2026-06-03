import { Module } from '@nestjs/common';
import { GoodsReceiptsService } from './goods-receipts.service';
import { GoodsReceiptAcceptService } from './goods-receipt-accept.service';
import { GoodsReceiptExportService } from './goods-receipt-export.service';
import { GoodsReceiptsController } from './goods-receipts.controller';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { WarehousesModule } from '../warehouses/warehouses.module';
import { ProductMappingsModule } from '../product-mappings/product-mappings.module';
import { DebtsModule } from '../debts/debts.module';

@Module({
  imports: [PrismaModule, AuthModule, WarehousesModule, ProductMappingsModule, DebtsModule],
  controllers: [GoodsReceiptsController],
  providers: [GoodsReceiptsService, GoodsReceiptAcceptService, GoodsReceiptExportService],
  exports: [GoodsReceiptsService, GoodsReceiptAcceptService, GoodsReceiptExportService],
})
export class GoodsReceiptsModule {}
