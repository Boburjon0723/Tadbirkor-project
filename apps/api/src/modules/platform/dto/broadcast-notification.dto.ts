import { IsString, IsNotEmpty, IsOptional, IsEnum, IsArray, IsUUID } from 'class-validator';

export class BroadcastNotificationDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsEnum(['INFO', 'SUCCESS', 'WARNING', 'ERROR'])
  @IsOptional()
  type?: string;

  /** Maqsad: 'all' | 'company' | 'user' */
  @IsEnum(['all', 'company', 'user'])
  target: 'all' | 'company' | 'user';

  /** target='company' bo'lsa kompaniya ID lari */
  @IsArray()
  @IsUUID('all', { each: true })
  @IsOptional()
  companyIds?: string[];

  /** target='user' bo'lsa foydalanuvchi ID lari */
  @IsArray()
  @IsUUID('all', { each: true })
  @IsOptional()
  userIds?: string[];
}
