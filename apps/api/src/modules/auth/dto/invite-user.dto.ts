import { IsString, IsNotEmpty, IsOptional, IsEnum, IsArray } from 'class-validator';

export enum UserRole {
  OWNER = 'OWNER',
  MANAGER = 'MANAGER',
  ACCOUNTANT = 'ACCOUNTANT',
  WAREHOUSE = 'WAREHOUSE',
  SALES = 'SALES',
  FIELD_WORKER = 'FIELD_WORKER',
  WORKER = 'WORKER',
}

export class InviteUserDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @IsNotEmpty()
  login: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsEnum(UserRole)
  role: UserRole;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  /**
   * SALES va WAREHOUSE rollari uchun majburiy: kassir/omborchi qaysi
   * do'kon/omborga biriktiriladi. Boshqa rollar uchun e'tiborga olinmaydi.
   */
  @IsString()
  @IsOptional()
  warehouseId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  grantPermissions?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  denyPermissions?: string[];
}
