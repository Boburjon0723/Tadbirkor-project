import { Module, forwardRef } from '@nestjs/common';
import { CompaniesModule } from '../companies/companies.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PayrollController } from './payroll.controller';
import { PayrollLeaveService } from './payroll-leave.service';
import { PayrollDataService } from './payroll-data.service';

@Module({
  imports: [forwardRef(() => CompaniesModule), NotificationsModule],
  controllers: [PayrollController],
  providers: [PayrollLeaveService, PayrollDataService],
  exports: [PayrollLeaveService, PayrollDataService],
})
export class PayrollModule {}
