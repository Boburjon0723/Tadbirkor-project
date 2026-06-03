import { Module } from '@nestjs/common';
import { DebtsService } from './debts.service';
import { DebtsController } from './debts.controller';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { ReportsModule } from '../reports/reports.module';
import { WarehousesModule } from '../warehouses/warehouses.module';

@Module({
  imports: [PrismaModule, AuthModule, ReportsModule, WarehousesModule],
  controllers: [DebtsController],
  providers: [DebtsService],
  exports: [DebtsService],
})
export class DebtsModule {}
