import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class UpdateFeatureDto {
  @IsString()
  @IsNotEmpty()
  moduleKey: string;

  @IsBoolean()
  enabled: boolean;
}

