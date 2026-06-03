import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { PlatformService } from './platform.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { AppCacheModule } from '../../common/cache/app-cache.module';

@Module({
  imports: [NotificationsModule, AppCacheModule],
  controllers: [PlatformController],
  providers: [PlatformService],
  exports: [PlatformService],
})
export class PlatformModule {}

