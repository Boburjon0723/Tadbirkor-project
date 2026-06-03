import { IsString, IsNotEmpty } from 'class-validator';

export class AcceptReceiptDto {
  @IsString()
  @IsNotEmpty()
  warehouseId: string; // Warehouse to put stock INTO
}
