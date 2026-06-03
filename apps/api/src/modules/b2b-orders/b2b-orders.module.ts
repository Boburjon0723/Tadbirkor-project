import { Module } from '@nestjs/common';
import { B2BOrdersService } from './b2b-orders.service';
import { B2BOrderWorkflowService } from './b2b-order-workflow.service';
import { B2BOrderExportService } from './b2b-order-export.service';
import { B2BOrdersController, IncomingOrdersController } from './b2b-orders.controller';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { PartnersModule } from '../partners/partners.module';
import { ProductMappingsModule } from '../product-mappings/product-mappings.module';
import { WorkflowsModule } from '../workflows/workflows.module';
import { WarehousesModule } from '../warehouses/warehouses.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    PartnersModule,
    ProductMappingsModule,
    WorkflowsModule,
    WarehousesModule,
  ],
  controllers: [B2BOrdersController, IncomingOrdersController],
  providers: [B2BOrdersService, B2BOrderWorkflowService, B2BOrderExportService],
  exports: [B2BOrdersService, B2BOrderWorkflowService, B2BOrderExportService],
})
export class B2BOrdersModule {}
