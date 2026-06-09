import { Body, Controller, Headers, HttpCode, Logger, Post, UnauthorizedException } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { TelegramService } from './telegram.service';

@Controller('telegram')
export class TelegramController {
  private readonly logger = new Logger(TelegramController.name);

  constructor(private readonly telegramService: TelegramService) {}

  @Public()
  @Post('webhook')
  @HttpCode(200)
  async webhook(
    @Body() body: unknown,
    @Headers('x-telegram-bot-api-secret-token') secretToken?: string,
  ) {
    try {
      await this.telegramService.handleWebhookUpdate(body, secretToken);
      return { ok: true };
    } catch (err) {
      if ((err as Error).message === 'Invalid Telegram webhook secret') {
        throw new UnauthorizedException('Invalid Telegram webhook secret');
      }
      this.logger.warn(`Telegram webhook processing failed: ${(err as Error).message}`);
      return { ok: true };
    }
  }
}
