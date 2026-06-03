import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { SupabaseStorageService } from './supabase-storage.service';

@Module({
  controllers: [UploadsController],
  providers: [SupabaseStorageService],
  exports: [SupabaseStorageService],
})
export class UploadsModule {}
