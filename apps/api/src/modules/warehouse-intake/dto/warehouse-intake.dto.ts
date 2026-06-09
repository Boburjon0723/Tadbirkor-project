import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateWarehouseIntakeDto {
  @IsString()
  @IsNotEmpty()
  warehouseId: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  note?: string;

  @IsOptional()
  @IsUUID()
  partnerLedgerContactId?: string;
}

export class AddIntakeLineDto {
  @IsString()
  @IsNotEmpty()
  productVariantId: string;

  @IsNumber()
  @Min(0.0001)
  quantity: number;
}

export class ScanIntakeLineDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  barcode: string;

  @IsNumber()
  @IsOptional()
  @Min(0.0001)
  quantity?: number;
}

export class UpdateIntakeLineDto {
  @IsNumber()
  @Min(0.0001)
  quantity: number;
}

/** Noma'lum barcode — minimal mahsulot + kirim qatori */
export class QuickIntakeProductDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  barcode: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(32)
  unit?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  salePrice?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  purchasePrice?: number;

  @IsNumber()
  @IsOptional()
  @Min(0.0001)
  quantity?: number;
}
