import { IsNotEmpty, IsString, IsArray, ValidateNested, IsNumber, Min, IsOptional } from "class-validator";
import { Type } from "class-transformer";

class ReceiptQtyLineDto {
  @IsString()
  @IsNotEmpty()
  itemId: string;

  @IsNumber()
  @Min(0)
  receivedQuantity: number;
}

export class AcceptReceiptDto {
  @IsString()
  @IsNotEmpty()
  warehouseId: string;

  @IsString()
  @IsOptional()
  note?: string;

  /** Qisman qabul: har qator uchun qabul miqdori (bo‘sh = jo‘natilgan miqdor) */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiptQtyLineDto)
  items?: ReceiptQtyLineDto[];
}

class PartialAcceptItemDto {
  @IsString()
  @IsNotEmpty()
  itemId: string;

  @IsNumber()
  @Min(0)
  receivedQuantity: number;
}

export class PartialAcceptReceiptDto {
  @IsString()
  @IsNotEmpty()
  warehouseId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PartialAcceptItemDto)
  items: PartialAcceptItemDto[];

  @IsString()
  @IsOptional()
  note?: string;
}
