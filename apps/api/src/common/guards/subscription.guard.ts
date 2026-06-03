import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { canCompanyWrite } from '../subscription.util';
import { isPlatformAdminUser } from '../platform-admin.util';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Yozuvga ruxsat beriladigan yo‘llar (obuna tugagan bo‘lsa ham) */
const WRITE_ALLOW_PREFIXES = [
  '/auth/',
  '/support/',
  '/platform/',
  '/telegram/',
  '/onboarding/',
];

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const method = String(request.method || 'GET').toUpperCase();

    if (!MUTATION_METHODS.has(method)) {
      return true;
    }

    const path = String(request.path || request.url || '').split('?')[0];
    if (WRITE_ALLOW_PREFIXES.some((p) => path.includes(p))) {
      return true;
    }

    const jwtUser = request['user'] as { sub?: string; companyId?: string } | undefined;
    if (!jwtUser?.companyId) {
      return true;
    }

    const dbUser = await this.prisma.user.findUnique({
      where: { id: jwtUser.sub },
      select: { id: true, email: true, login: true },
    });
    if (dbUser && isPlatformAdminUser(dbUser)) {
      return true;
    }

    const company = await this.prisma.company.findUnique({
      where: { id: jwtUser.companyId },
      select: { subscriptionStatus: true, trialEndsAt: true },
    });
    if (!company) {
      return true;
    }

    if (canCompanyWrite(company)) {
      return true;
    }

    throw new ForbiddenException({
      message:
        'Sinov muddati tugagan. Ma’lumotlarni ko‘rishingiz mumkin, yangi amallar uchun obunani faollashtiring (Sozlamalar → Obuna).',
      code: 'SUBSCRIPTION_EXPIRED',
    });
  }
}
