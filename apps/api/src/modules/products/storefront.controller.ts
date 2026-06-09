import { Controller, Get, Headers, Param, Query } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { VariantsService } from './variants.service';

@Public()
@Controller('storefront')
export class StorefrontController {
  constructor(private readonly variantsService: VariantsService) {}

  @Get(':companyId/products')
  getWebsiteCatalog(
    @Param('companyId') companyId: string,
    @Headers('x-storefront-token') storefrontToken?: string,
    @Query('search') search?: string,
  ) {
    return this.variantsService.getWebsiteCatalog(companyId, storefrontToken, { search });
  }
}

