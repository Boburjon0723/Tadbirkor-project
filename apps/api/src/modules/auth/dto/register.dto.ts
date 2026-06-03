import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => String(value ?? '').trim())
  companyName: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => String(value ?? '').trim())
  fullName: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  @Transform(({ value }) => String(value ?? '').trim())
  login: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @Transform(({ value }) => String(value ?? ''))
  password: string;

  @IsString()
  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null ? undefined : String(value).trim()))
  tin?: string;

  @IsEmail()
  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null ? undefined : String(value).trim()))
  email?: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (value === undefined || value === null ? undefined : String(value).trim()))
  phone: string;
}
