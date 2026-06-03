import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { WarehouseScopeService } from './services/warehouse-scope.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { CompaniesModule } from '../companies/companies.module';

@Module({
  imports: [PrismaModule, CompaniesModule],
  controllers: [UsersController],
  providers: [UsersService, WarehouseScopeService],
  exports: [UsersService, WarehouseScopeService],
})
export class UsersModule {}
