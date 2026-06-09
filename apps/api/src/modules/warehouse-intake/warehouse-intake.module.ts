import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { WarehousesModule } from '../warehouses/warehouses.module';
import { ProductsModule } from '../products/products.module';
import { CompaniesModule } from '../companies/companies.module';
import { UsersModule } from '../users/users.module';
import { WarehouseIntakeController } from './warehouse-intake.controller';
import { WarehouseIntakeService } from './warehouse-intake.service';

@Module({
  imports: [
    PrismaModule,
    WarehousesModule,
    ProductsModule,
    CompaniesModule,
    UsersModule,
  ],
  controllers: [WarehouseIntakeController],
  providers: [WarehouseIntakeService],
  exports: [WarehouseIntakeService],
})
export class WarehouseIntakeModule {}
