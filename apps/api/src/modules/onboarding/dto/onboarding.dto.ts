import { IsString, IsNotEmpty, IsOptional, IsArray, IsObject } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateOnboardingCompanyDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => String(value ?? '').trim())
  name: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null ? undefined : String(value).trim()))
  tin?: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null ? undefined : String(value).trim()))
  phone?: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null ? undefined : String(value).trim()))
  address?: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null ? undefined : String(value).trim()))
  businessType?: string;
}

export class UpdateOnboardingCompanyDto {
  @IsString()
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null ? undefined : String(value).trim(),
  )
  businessType?: string;
}

export class SubmitBusinessAnswersDto {
  @IsObject()
  @IsNotEmpty()
  answers: Record<string, string>;
}

export class AddTeamMemberDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @IsNotEmpty()
  login: string;

  @IsString()
  @IsNotEmpty()
  role: string;

  @IsString()
  @IsOptional()
  department?: string;

  @IsString()
  @IsNotEmpty()
  password?: string;
}
