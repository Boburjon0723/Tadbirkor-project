import { Module } from '@nestjs/common';
import { PosService } from './pos.service';
import { PosController } from './pos.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { WarehousesModule } from '../warehouses/warehouses.module';
import { UsersModule } from '../users/users.module';
import { CompaniesModule } from '../companies/companies.module';
import { RetailCustomersModule } from '../retail-customers/retail-customers.module';
import { RetailReceivablesModule } from '../retail-receivables/retail-receivables.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    WarehousesModule,
    UsersModule,
    CompaniesModule,
    RetailCustomersModule,
    RetailReceivablesModule,
  ],
  controllers: [PosController],
  providers: [PosService],
  exports: [PosService],
})
export class PosModule {}
