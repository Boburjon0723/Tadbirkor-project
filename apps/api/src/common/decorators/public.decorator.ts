import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** JWT talab qilinmaydigan ochiq endpointlar (global JwtAuthGuard dan mustasno). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
