import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';

/**
 * test-e2e / init-modules / seed-stock — faqat dev va maxfiy kalit bilan.
 * Production: NODE_ENV=production bo'lsa har doim rad.
 */
@Injectable()
export class SystemDevGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Bu amal production muhitida mavjud emas');
    }

    const expected = String(process.env.SYSTEM_DEV_SECRET || '').trim();
    if (!expected) {
      throw new ForbiddenException(
        'SYSTEM_DEV_SECRET muhit o\'zgaruvchisi o\'rnatilmagan — dev endpointlar o\'chirilgan',
      );
    }

    const request = context.switchToHttp().getRequest<Request>();
    const provided = String(request.headers['x-system-dev-secret'] || '').trim();
    if (provided !== expected) {
      throw new ForbiddenException('Dev endpoint uchun maxfiy kalit noto\'g\'ri yoki yo\'q');
    }

    return true;
  }
}
