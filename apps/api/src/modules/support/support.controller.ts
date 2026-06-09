import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Throttle } from '@nestjs/throttler';
import { SupportService } from './support.service';
import { SubmitSupportMessageDto } from './dto/support-message.dto';

@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get('context')
  @UseGuards(JwtAuthGuard)
  getContext(@CurrentUser() user: { companyId: string; sub: string }) {
    return this.supportService.getContext(user.companyId, user.sub);
  }

  @Post('messages')
  @UseGuards(JwtAuthGuard)
  submitMessage(
    @CurrentUser() user: { companyId: string; sub: string },
    @Body() dto: SubmitSupportMessageDto,
  ) {
    return this.supportService.submitMessage(user.companyId, user.sub, dto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('public-messages')
  submitPublicMessage(
    @Body() dto: { name: string; contact: string; message: string; topic?: string },
  ) {
    return this.supportService.submitPublicMessage(dto);
  }
}
