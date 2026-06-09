import {
  Controller,
  Post,
  Get,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  BadRequestException,
  Req,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/role.enum';
import { SupabaseStorageService } from './supabase-storage.service';

@Controller('uploads')
export class UploadsController {
  private readonly logger = new Logger(UploadsController.name);

  constructor(private readonly storage: SupabaseStorageService) {}

  @Get('status')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions(Permission.SETTINGS_MANAGE)
  getStatus() {
    return {
      supabaseEnabled: this.storage.isEnabled(),
    };
  }

  @Post('image')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('image', {
      // Hamma fayllar avval memoryga yuklanadi; keyin Supabase yoki diskka yoziladi.
      storage: memoryStorage(),
      fileFilter: (_req, file, callback) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          return callback(new BadRequestException('Faqat rasm fayllari (jpg, png, gif, webp) ruxsat etilgan!'), false);
        }
        callback(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
  async uploadImage(@UploadedFile() file: any, @Req() req: any) {
    if (!file || !file.buffer) {
      throw new BadRequestException('Fayl yuklanmadi');
    }

    // 1) Birinchi tanlov — Supabase Storage (doimiy)
    if (this.storage.isEnabled()) {
      const { url, path } = await this.storage.uploadImage(
        {
          buffer: file.buffer,
          originalname: file.originalname,
          mimetype: file.mimetype,
        },
        { folder: 'products' },
      );
      this.logger.log(`Rasm Supabase Storage'ga yuklandi: ${path}`);
      return { url, path, filename: path.split('/').pop(), storage: 'supabase' };
    }

    // 2) Fallback — lokal disk (faqat dev / Supabase sozlanmagan holatda)
    this.logger.warn(
      'Supabase Storage sozlanmagan; rasm lokal diskka yozildi (Railway-da pod restart bo‘lganda yo‘qoladi).',
    );
    const uploadDir = './uploads';
    if (!existsSync(uploadDir)) {
      mkdirSync(uploadDir, { recursive: true });
    }
    const ext = extname(file.originalname || '') || '.jpg';
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    writeFileSync(`${uploadDir}/${filename}`, file.buffer);

    const rawProto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http');
    const rawHost = String(req.headers['x-forwarded-host'] || req.get('host') || '');
    const proto = rawProto.split(',')[0].trim() || 'http';
    const host = rawHost.split(',')[0].trim();
    const configuredBaseUrl = String(process.env.PUBLIC_BASE_URL || process.env.APP_URL || '').trim().replace(/\/+$/, '');
    const inferredBaseUrl = host ? `${proto}://${host}` : '';
    const publicBaseUrl = configuredBaseUrl || inferredBaseUrl;
    const filePath = `/uploads/${filename}`;

    return {
      url: publicBaseUrl ? `${publicBaseUrl}${filePath}` : filePath,
      path: filePath,
      filename,
      storage: 'local',
    };
  }
}
