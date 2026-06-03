import { IsBoolean } from 'class-validator';

export class PublishVariantDto {
  @IsBoolean()
  isPublishedToWebsite: boolean;
}

