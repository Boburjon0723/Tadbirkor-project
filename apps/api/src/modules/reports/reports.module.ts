import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportExcelService } from './report-excel.service';
import { PosReportsService } from './pos-reports.service';
import { MonthlyOverviewService } from './monthly-overview.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { FieldModule } from '../field/field.module';
import { CompaniesModule } from '../companies/companies.module';
import { UsersModule } from '../users/users.module';
import { ExpensesModule } from '../expenses/expenses.module';
import { IncomeModule } from '../income/income.module';
import { PayrollModule } from '../payroll/payroll.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    FieldModule,
    CompaniesModule,
    UsersModule,
    ExpensesModule,
    IncomeModule,
    PayrollModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService, ReportExcelService, PosReportsService, MonthlyOverviewService],
  exports: [ReportsService, ReportExcelService, PosReportsService, MonthlyOverviewService],
})
export class ReportsModule {}
