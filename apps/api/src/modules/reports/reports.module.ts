import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportExcelService } from './report-excel.service';
import { PosReportsService } from './pos-reports.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { FieldModule } from '../field/field.module';
import { CompaniesModule } from '../companies/companies.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [PrismaModule, AuthModule, FieldModule, CompaniesModule, UsersModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportExcelService, PosReportsService],
  exports: [ReportsService, ReportExcelService, PosReportsService],
})
export class ReportsModule {}
