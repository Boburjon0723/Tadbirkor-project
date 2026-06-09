import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

const INTAKE_ROLES = new Set(['OWNER', 'MANAGER', 'WAREHOUSE']);

/** Ombor kirimi — faqat egasi, menejer va omborchi */
@Injectable()
export class WarehouseIntakeAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const role = String(req.user?.role || '').toUpperCase();
    if (INTAKE_ROLES.has(role)) return true;
    throw new ForbiddenException(
      'Ombor kirimiga faqat boshqaruvchi yoki omborchi kirishi mumkin',
    );
  }
}
