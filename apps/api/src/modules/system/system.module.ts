import { Module } from '@nestjs/common';
import { TestFlowService } from './test-flow.service';
import { SystemController } from './system.controller';
import { SystemDevGuard } from './system-dev.guard';
import { ProductsModule } from '../products/products.module';
import { WarehousesModule } from '../warehouses/warehouses.module';
import { PartnersModule } from '../partners/partners.module';
import { ProductMappingsModule } from '../product-mappings/product-mappings.module';
import { B2BOrdersModule } from '../b2b-orders/b2b-orders.module';
import { DispatchesModule } from '../dispatches/dispatches.module';
import { GoodsReceiptsModule } from '../goods-receipts/goods-receipts.module';
import { DebtsModule } from '../debts/debts.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ProductsModule,
    WarehousesModule,
    PartnersModule,
    ProductMappingsModule,
    B2BOrdersModule,
    DispatchesModule,
    GoodsReceiptsModule,
    DebtsModule,
  ],
  controllers: [SystemController],
  providers: [TestFlowService, SystemDevGuard],
})
export class SystemModule {}
