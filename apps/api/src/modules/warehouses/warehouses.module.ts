import { Module, forwardRef } from '@nestjs/common';
import { WarehousesService } from './warehouses.service';
import { WarehousesController } from './warehouses.controller';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';
import { InventoryGateway } from './inventory.gateway';
import { AtpService } from './atp.service';
import { InventoryCountService } from './inventory-count.service';
import { InventoryCountController } from './inventory-count.controller';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { UsersModule } from '../users/users.module';
import { PartnerLedgerModule } from '../partner-ledger/partner-ledger.module';
import { CompaniesModule } from '../companies/companies.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    CompaniesModule,
    forwardRef(() => PartnerLedgerModule),
  ],
  controllers: [WarehousesController, StockController, InventoryCountController],
  providers: [WarehousesService, StockService, InventoryGateway, AtpService, InventoryCountService],
  exports: [WarehousesService, StockService, InventoryGateway, AtpService, InventoryCountService],
})
export class WarehousesModule {}
