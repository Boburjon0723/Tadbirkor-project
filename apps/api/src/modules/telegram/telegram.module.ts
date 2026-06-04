import { Global, Module, forwardRef } from '@nestjs/common';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';
import { TelegramLinkService } from './telegram-link.service';
import { TelegramPasswordResetService } from './telegram-password-reset.service';
import { TelegramBotContextService } from './telegram-bot-context.service';
import { TelegramTasksService } from './telegram-tasks.service';
import { TelegramMenuService } from './telegram-menu.service';
import { TelegramPosReportService } from './telegram-pos-report.service';
import { TelegramLeaveBotService } from './telegram-leave-bot.service';
import { TelegramPayrollBotService } from './telegram-payroll-bot.service';
import { PayrollModule } from '../payroll/payroll.module';

@Global()
@Module({
  imports: [forwardRef(() => PayrollModule)],
  controllers: [TelegramController],
  providers: [
    TelegramService,
    TelegramLinkService,
    TelegramPasswordResetService,
    TelegramBotContextService,
    TelegramTasksService,
    TelegramPosReportService,
    TelegramMenuService,
    TelegramLeaveBotService,
    TelegramPayrollBotService,
  ],
  exports: [
    TelegramService,
    TelegramLinkService,
    TelegramPasswordResetService,
    TelegramMenuService,
  ],
})
export class TelegramModule {}

