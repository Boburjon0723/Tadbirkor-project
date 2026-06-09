import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

/** Ombor kirimi sozlamalarini faqat OWNER va MANAGER tahrirlaydi */
@Injectable()
export class IntakeSettingsWriteGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const role = String(req.user?.role || '').toUpperCase();
    if (role === 'OWNER' || role === 'MANAGER') return true;
    throw new ForbiddenException(
      'Ombor kirimi sozlamalarini faqat boshqaruvchi tahrirlashi mumkin',
    );
  }
}
