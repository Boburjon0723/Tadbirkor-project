import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class ReportItemDto {
  @IsString()
  variantId: string;

  @IsNumber()
  @Min(0)
  usedQty: number;

  @IsNumber()
  @Min(0)
  returnedQty: number;

  @IsNumber()
  @Min(0)
  lostQty: number;
}

export class SubmitFieldReportDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportItemDto)
  items: ReportItemDto[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  photos?: string[];

  @IsNumber()
  @IsOptional()
  gpsLat?: number;

  @IsNumber()
  @IsOptional()
  gpsLng?: number;

  @IsString()
  @IsOptional()
  comment?: string;
}
