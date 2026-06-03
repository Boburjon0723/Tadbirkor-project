import { Injectable, InternalServerErrorException, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageClient } from '@supabase/storage-js';
import { extname } from 'path';

export interface UploadResult {
  url: string;
  path: string;
}

@Injectable()
export class SupabaseStorageService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseStorageService.name);
  private client: StorageClient | null = null;
  private bucket = 'product-images';
  private baseUrl = '';
  private enabled = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    // Bir vaqtning o'zida SUPABASE_URL va NEXT_PUBLIC_SUPABASE_URL ikkalasini ham qabul qilamiz:
    // chalkashlik kamayadi (NEXT_PUBLIC_* — Next.js frontend uchun, lekin user xato qo'yishi mumkin).
    const url = (
      this.config.get<string>('SUPABASE_URL') ||
      this.config.get<string>('NEXT_PUBLIC_SUPABASE_URL') ||
      ''
    ).trim().replace(/\/+$/, '');
    const serviceKey = (this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY') || '').trim();
    const bucket = (this.config.get<string>('SUPABASE_STORAGE_BUCKET') || '').trim();

    if (!url || !serviceKey) {
      this.logger.warn(
        'SUPABASE_URL yoki SUPABASE_SERVICE_ROLE_KEY berilmagan — rasm yuklash mahalliy diskka tushadi (Railway-da rasm pod restart bo‘lganda yo‘qoladi).',
      );
      this.enabled = false;
      return;
    }

    if (bucket) this.bucket = bucket;

    // StorageClient'ni to'g'ridan-to'g'ri ishlatamiz — supabase-js'ning realtime (WebSocket) bog'liqligi yo'q.
    // Bu Node.js 18 muhitida ham muammosiz ishlaydi.
    this.baseUrl = url;
    this.client = new StorageClient(`${url}/storage/v1`, {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    });
    this.enabled = true;
    this.logger.log(`Supabase Storage faollashtirildi (bucket: ${this.bucket}).`);
  }

  isEnabled(): boolean {
    return this.enabled && !!this.client;
  }

  getBucket(): string {
    return this.bucket;
  }

  async uploadImage(
    file: { buffer: Buffer; originalname: string; mimetype: string },
    options?: { folder?: string },
  ): Promise<UploadResult> {
    if (!this.client) {
      throw new InternalServerErrorException(
        'Supabase Storage sozlanmagan: SUPABASE_URL va SUPABASE_SERVICE_ROLE_KEY env qiymatlarini sozlang.',
      );
    }

    const folder = (options?.folder || 'products').replace(/^\/+|\/+$/g, '');
    const ext = (extname(file.originalname || '') || '').toLowerCase().replace(/[^a-z0-9.]/g, '');
    const safeExt = ext.startsWith('.') ? ext : '.jpg';
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const path = `${folder}/${unique}${safeExt}`;

    const { error } = await this.client
      .from(this.bucket)
      .upload(path, file.buffer, {
        contentType: file.mimetype || 'application/octet-stream',
        upsert: false,
        cacheControl: '31536000',
      });

    if (error) {
      this.logger.error(`Supabase upload xatolik: ${error.message}`);
      throw new InternalServerErrorException(`Faylni yuklab bo‘lmadi: ${error.message}`);
    }

    const { data } = this.client.from(this.bucket).getPublicUrl(path);
    if (!data?.publicUrl) {
      throw new InternalServerErrorException('Yuklangan rasm uchun public URL olinmadi.');
    }

    return { url: data.publicUrl, path };
  }

  async deleteByPath(path: string): Promise<void> {
    if (!this.client || !path) return;
    const { error } = await this.client.from(this.bucket).remove([path]);
    if (error) {
      this.logger.warn(`Supabase delete xatolik (${path}): ${error.message}`);
    }
  }
}
