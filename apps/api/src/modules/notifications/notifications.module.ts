import { Module, Global, forwardRef } from '@nestjs/common';
import { TelegramModule } from '../telegram/telegram.module';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationDeliveryService } from './notification-delivery.service';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';

@Global()
@Module({
  imports: [JwtModule, ConfigModule, forwardRef(() => TelegramModule)],
  providers: [NotificationsService, NotificationsGateway, NotificationDeliveryService],
  controllers: [NotificationsController],
  exports: [NotificationsService, NotificationsGateway, NotificationDeliveryService],
})
export class NotificationsModule {}
