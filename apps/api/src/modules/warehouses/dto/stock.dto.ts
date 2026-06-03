import { IsString, IsNotEmpty, IsOptional, IsNumber, IsEnum, Min } from 'class-validator';

export class CreateStockMovementDto {
  @IsString()
  @IsNotEmpty()
  warehouseId: string;

  @IsString()
  @IsNotEmpty()
  productVariantId: string;

  @IsNumber()
  @Min(0.0001)
  quantity: number;

  @IsString()
  @IsOptional()
  note?: string;

  @IsString()
  @IsOptional()
  sourceId?: string;

  @IsString()
  @IsOptional()
  partnerLedgerContactId?: string;
}

export class CreateStockAdjustmentDto {
  @IsString()
  @IsNotEmpty()
  warehouseId: string;

  @IsString()
  @IsNotEmpty()
  productVariantId: string;

  @IsNumber()
  quantity: number; // >0 kirim, <0 chiqim (tuzatish)

  @IsString()
  @IsNotEmpty()
  note: string;

  @IsString()
  @IsOptional()
  partnerLedgerContactId?: string;
}

export class CreateStockTransferDto {
  @IsString()
  @IsNotEmpty()
  fromWarehouseId: string;

  @IsString()
  @IsNotEmpty()
  toWarehouseId: string;

  @IsString()
  @IsNotEmpty()
  productVariantId: string;

  @IsNumber()
  @Min(0.0001)
  quantity: number;

  @IsString()
  @IsOptional()
  note?: string;
}
