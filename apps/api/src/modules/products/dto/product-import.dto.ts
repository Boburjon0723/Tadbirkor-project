import { ArrayMinSize, IsArray, IsIn, IsOptional, IsString } from 'class-validator';

export class ImportConfirmDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Kamida bitta import qatori kerak' })
  rows: Record<string, unknown>[];

  @IsOptional()
  @IsIn(['set', 'add', 'subtract'])
  importMode?: 'set' | 'add' | 'subtract' = 'set';

  @IsOptional()
  @IsIn(['skip_zero_and_unchanged', 'apply_all'])
  stockPolicy?: 'skip_zero_and_unchanged' | 'apply_all' = 'apply_all';

  @IsOptional()
  @IsString()
  partnerLedgerContactId?: string;
}
