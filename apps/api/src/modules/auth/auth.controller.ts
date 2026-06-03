import {
  Body,
  Controller,
  Post,
  Get,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { PasswordResetTelegramLinkDto } from './dto/password-reset-telegram-link.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { setAuthCookie, clearAuthCookie } from '../../common/auth-cookie';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(dto);
    if (result.access_token) {
      setAuthCookie(res, result.access_token);
    }
    return result;
  }

  @HttpCode(HttpStatus.OK)
  @Post('password-reset/telegram-link')
  createPasswordResetTelegramLink(@Body() dto: PasswordResetTelegramLinkDto) {
    return this.authService.createPasswordResetTelegramLink(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto);
    if (result.access_token) {
      setAuthCookie(res, result.access_token);
    }
    return result;
  }

  @HttpCode(HttpStatus.OK)
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    clearAuthCookie(res);
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@CurrentUser() user: any) {
    return this.authService.getMe(user.sub, user.companyId);
  }

  @Post('invite')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(Permission.USERS_MANAGE)
  inviteUser(@Request() req: any, @Body() dto: InviteUserDto) {
    return this.authService.inviteUser(req.user.companyId, dto);
  }
}
