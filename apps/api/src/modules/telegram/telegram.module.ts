import { Global, Module } from '@nestjs/common';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';
import { TelegramLinkService } from './telegram-link.service';
import { TelegramPasswordResetService } from './telegram-password-reset.service';
import { TelegramBotContextService } from './telegram-bot-context.service';
import { TelegramTasksService } from './telegram-tasks.service';
import { TelegramMenuService } from './telegram-menu.service';
import { TelegramPosReportService } from './telegram-pos-report.service';

@Global()
@Module({
  controllers: [TelegramController],
  providers: [
    TelegramService,
    TelegramLinkService,
    TelegramPasswordResetService,
    TelegramBotContextService,
    TelegramTasksService,
    TelegramPosReportService,
    TelegramMenuService,
  ],
  exports: [
    TelegramService,
    TelegramLinkService,
    TelegramPasswordResetService,
    TelegramMenuService,
  ],
})
export class TelegramModule {}

