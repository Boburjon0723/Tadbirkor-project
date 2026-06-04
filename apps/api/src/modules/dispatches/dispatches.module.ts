import { Module } from '@nestjs/common';
import { DispatchesService } from './dispatches.service';
import { DispatchesController } from './dispatches.controller';
import { PickTasksController } from './pick-tasks.controller';
import { PickingService } from './picking.service';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { WarehousesModule } from '../warehouses/warehouses.module';
import { AppCacheModule } from '../../common/cache/app-cache.module';
import { CompaniesModule } from '../companies/companies.module';

@Module({
  imports: [PrismaModule, AuthModule, WarehousesModule, AppCacheModule, CompaniesModule],
  controllers: [DispatchesController, PickTasksController],
  providers: [DispatchesService, PickingService],
  exports: [DispatchesService, PickingService],
})
export class DispatchesModule {}
