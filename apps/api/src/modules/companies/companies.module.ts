import { Module, forwardRef } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CompaniesController } from './companies.controller';
import { TelegramModule } from '../telegram/telegram.module';
import { UsersModule } from '../users/users.module';
import { IntakeSettingsWriteGuard } from '../../common/guards/intake-settings-write.guard';

@Module({
  imports: [forwardRef(() => TelegramModule), forwardRef(() => UsersModule)],
  controllers: [CompaniesController],
  providers: [CompaniesService, IntakeSettingsWriteGuard],
  exports: [CompaniesService],
})
export class CompaniesModule {}
