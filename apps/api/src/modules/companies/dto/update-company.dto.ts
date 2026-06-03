import { IsBoolean, IsNumber, IsOptional, IsString, IsUrl, Max, Min, MinLength } from 'class-validator';

export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  legalName?: string;

  @IsOptional()
  @IsString()
  @MinLength(9)
  tin?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  businessType?: string;

  @IsOptional()
  @IsUrl()
  storefrontUrl?: string;

  /** POS nasiya (mijozlar qarzi) — yoqilgan bo‘lsa CREDIT to‘lov ishlaydi */
  @IsOptional()
  @IsBoolean()
  posCreditEnabled?: boolean;

  /** Kassir uchun maksimal chegirma foizi (masalan 10). Owner/Manager cheklovsiz override. */
  @IsOptional()
  posMaxDiscountPercent?: number;

  /** Inventarizatsiya farqi uchun ruxsat etilgan foiz (masalan 1 = 1%) */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  inventoryVarianceTolerancePct?: number;
}
