import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class PlannedItemDto {
  @IsString()
  @IsNotEmpty()
  variantId: string;

  @IsNumber()
  @Min(1)
  qty: number;

  @IsString()
  @IsOptional()
  label?: string;
}

export class CreateFieldTaskDto {
  @IsString()
  @IsNotEmpty()
  assigneeId: string;

  @IsString()
  @IsNotEmpty()
  sourceWarehouseId: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  customerName?: string;

  @IsString()
  @IsOptional()
  customerPhone?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsNumber()
  @IsOptional()
  lat?: number;

  @IsNumber()
  @IsOptional()
  lng?: number;

  @IsDateString()
  @IsOptional()
  scheduledAt?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlannedItemDto)
  plannedItems: PlannedItemDto[];
}
