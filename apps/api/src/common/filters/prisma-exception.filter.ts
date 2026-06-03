import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

/**
 * Prisma'dan keladigan ma'lum xatolarni foydalanuvchi tushunadigan HTTP javoblariga aylantiradi.
 * Boshqa Prisma xatolari 500 sifatida qaytadi, lekin server log'iga yoziladi.
 */
@Catch(
  Prisma.PrismaClientKnownRequestError,
  Prisma.PrismaClientValidationError,
)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(
    exception:
      | Prisma.PrismaClientKnownRequestError
      | Prisma.PrismaClientValidationError,
    host: ArgumentsHost,
  ) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof Prisma.PrismaClientValidationError) {
      this.logger.error(exception.message);
      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'So‘rovda noto‘g‘ri ma’lumotlar bor.',
      });
    }

    const code = exception.code;
    const meta = (exception.meta || {}) as Record<string, unknown>;

    switch (code) {
      case 'P2002': {
        // Unique constraint failed
        const target = Array.isArray(meta.target) ? meta.target.join(', ') : String(meta.target || '');
        let message = 'Ushbu qiymat allaqachon mavjud.';
        if (target.includes('sku')) {
          message = 'Bunday SKU allaqachon mavjud. Boshqa SKU kiriting yoki avtomatik yaratishga ruxsat bering.';
        } else if (target.includes('barcode')) {
          message = 'Bunday shtrix-kod allaqachon mavjud.';
        } else if (target.includes('email')) {
          message = 'Bunday email allaqachon ro‘yxatdan o‘tgan.';
        } else if (target.includes('login')) {
          message = 'Bunday login allaqachon band.';
        } else if (target.includes('phone')) {
          message = 'Bunday telefon raqami allaqachon mavjud.';
        } else if (target) {
          message = `Takroriy qiymat: ${target}`;
        }
        return response.status(HttpStatus.CONFLICT).json({
          statusCode: HttpStatus.CONFLICT,
          message,
          field: target || undefined,
        });
      }

      case 'P2025': {
        // Record not found
        return response.status(HttpStatus.NOT_FOUND).json({
          statusCode: HttpStatus.NOT_FOUND,
          message: 'So‘ralgan yozuv topilmadi.',
        });
      }

      case 'P2003': {
        // Foreign key constraint failed
        return response.status(HttpStatus.BAD_REQUEST).json({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Bog‘liq yozuv topilmadi yoki o‘chirilgan.',
        });
      }

      case 'P2028': {
        return response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          message:
            'Ma’lumotlar bazasi band. Bir necha soniyadan keyin qayta urinib ko‘ring.',
        });
      }

      default: {
        this.logger.error(`Prisma xato (${code}): ${exception.message}`);
        return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Server xatosi. Qayta urinib ko‘ring.',
        });
      }
    }
  }
}
