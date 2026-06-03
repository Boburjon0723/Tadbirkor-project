import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  isPlatformAdminPinRequired,
  isPlatformAdminUser,
  verifyPlatformAdminPin,
} from '../platform-admin.util';

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const jwtUser = request['user'] as { sub?: string } | undefined;
    if (!jwtUser?.sub) {
      throw new ForbiddenException('Kirish talab qilinadi');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: jwtUser.sub },
      select: { email: true, login: true },
    });
    if (!user || !isPlatformAdminUser(user)) {
      throw new ForbiddenException('Platforma administratori huquqi yo‘q');
    }

    if (isPlatformAdminPinRequired()) {
      const pinHeader = String(request.headers['x-platform-admin-pin'] || '');
      if (!verifyPlatformAdminPin(pinHeader)) {
        throw new ForbiddenException({
          message: 'Admin panel paroli noto‘g‘ri yoki kiritilmagan',
          code: 'PLATFORM_ADMIN_PIN_REQUIRED',
        });
      }
    }

    return true;
  }
}
