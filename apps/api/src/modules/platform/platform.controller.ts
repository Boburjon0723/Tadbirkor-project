import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import { PlatformService } from './platform.service';
import { AppCacheService } from '../../common/cache/app-cache.service';
import { UpdateCompanySubscriptionDto } from './dto/update-company-subscription.dto';
import { BroadcastNotificationDto } from './dto/broadcast-notification.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import {
  isPlatformAdminPinRequired,
  isPlatformAdminUser,
  verifyPlatformAdminPin,
} from '../../common/platform-admin.util';
@Controller('platform')
export class PlatformController {
  constructor(
    private readonly platformService: PlatformService,
    private readonly prisma: PrismaService,
    private readonly appCache: AppCacheService,
  ) {}

  /** Admin panel uchun alohida PIN (JWT + email dan tashqari) */
  @Post('verify-pin')
  @UseGuards(JwtAuthGuard)
  async verifyPin(@CurrentUser() user: any, @Body() body: { pin?: string }) {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { email: true, login: true },
    });
    if (!dbUser || !isPlatformAdminUser(dbUser)) {
      throw new ForbiddenException('Platforma administratori emas');
    }
    if (!isPlatformAdminPinRequired()) {
      return { ok: true, pinRequired: false };
    }
    if (!verifyPlatformAdminPin(body?.pin || '')) {
      throw new ForbiddenException({
        message: 'Admin paroli noto‘g‘ri',
        code: 'PLATFORM_ADMIN_PIN_INVALID',
      });
    }
    return { ok: true, pinRequired: true };
  }

  @Get('access')
  @UseGuards(JwtAuthGuard)
  async accessInfo(@CurrentUser() user: any) {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { email: true, login: true },
    });
    const isAdmin = Boolean(dbUser && isPlatformAdminUser(dbUser));
    return {
      isPlatformAdmin: isAdmin,
      pinRequired: isAdmin && isPlatformAdminPinRequired(),
    };
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  stats() {
    return this.platformService.getStats();
  }

  /** Redis cache holati (admin diagnostika) */
  @Get('redis-health')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  async redisHealth() {
    const cache = this.appCache.getDiagnostics();
    const ping = await this.appCache.ping();
    return { cache, ping };
  }

  @Get('companies')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  listCompanies(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.platformService.listCompanies({
      search,
      page: Number(page) || 1,
      limit: Number(limit) || 30,
    });
  }

  @Patch('companies/:companyId')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  updateCompany(
    @Param('companyId') companyId: string,
    @Body() dto: UpdateCompanySubscriptionDto,
  ) {
    return this.platformService.updateCompanySubscription(companyId, dto);
  }

  /** Platforma admin: foydalanuvchilarga xabar yuborish */
  @Post('broadcast')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  broadcast(@Body() dto: BroadcastNotificationDto) {
    return this.platformService.broadcastToUsers(dto);
  }
}
