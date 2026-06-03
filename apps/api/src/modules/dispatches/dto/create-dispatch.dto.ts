import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class DispatchLineQtyDto {
  @IsString()
  @IsNotEmpty()
  orderItemId: string;

  @IsNumber()
  @Min(0)
  quantity: number;
}

export class CreateDispatchDto {
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @IsString()
  @IsNotEmpty()
  warehouseId: string;

  /** Qisman jo‘natma: buyurtma qatori ID + jo‘natiladigan miqdor (0 = o‘tkazib yuboriladi) */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DispatchLineQtyDto)
  items?: DispatchLineQtyDto[];
}
