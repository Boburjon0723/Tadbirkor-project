import { IsIn, IsNotEmpty, IsOptional, IsString, IsArray } from 'class-validator';

/** OWNER bu yerda berilmaydi — faqat kompaniya a'zosiga ishchi rol tanlash */
const ASSIGNABLE_ROLES = ['MANAGER', 'ACCOUNTANT', 'WAREHOUSE', 'SALES', 'FIELD_WORKER'] as const;

export class UpdateMemberRoleDto {
  @IsString()
  @IsNotEmpty()
  @IsIn([...ASSIGNABLE_ROLES])
  role: (typeof ASSIGNABLE_ROLES)[number];

  /**
   * SALES va WAREHOUSE rollari uchun majburiy — kassir/omborchi qaysi
   * do'kon/omborda ishlaydi. Boshqa rollar uchun e'tiborga olinmaydi.
   * Null/empty berilsa, mavjud biriktiruv bekor qilinadi.
   */
  @IsString()
  @IsOptional()
  warehouseId?: string | null;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  grantPermissions?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  denyPermissions?: string[];
}
