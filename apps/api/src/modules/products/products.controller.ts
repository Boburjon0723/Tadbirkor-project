import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProductsService } from './products.service';
import { ProductImportService } from './product-import.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';
import { ImportConfirmDto } from './dto/product-import.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('products')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly productImportService: ProductImportService,
  ) {}

  @Post()
  @Permissions(Permission.PRODUCTS_CREATE)
  create(@CurrentUser() user: any, @Body() dto: CreateProductDto) {
    return this.productsService.create(user.companyId, dto, user.sub);
  }

  @Get()
  @Permissions(Permission.PRODUCTS_VIEW)
  findAll(@CurrentUser() user: any, @Query() query: any) {
    const targetCompanyId = query.companyId || user.companyId;
    return this.productsService.findAll(targetCompanyId, query);
  }

  @Get('summary/stats')
  @Permissions(Permission.PRODUCTS_VIEW)
  catalogSummary(@CurrentUser() user: any, @Query() query: any) {
    const targetCompanyId = query.companyId || user.companyId;
    return this.productsService.getCatalogSummary(targetCompanyId, query);
  }

  @Get(':id')
  @Permissions(Permission.PRODUCTS_VIEW)
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.productsService.findOne(id, user.companyId, { warehouseId });
  }

  @Patch(':id')
  @Permissions(Permission.PRODUCTS_UPDATE)
  update(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, user.companyId, dto, user.sub);
  }

  @Delete(':id')
  @Permissions(Permission.PRODUCTS_DELETE)
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.productsService.remove(id, user.companyId, user.sub);
  }

  @Post('import/preview')
  @Permissions(Permission.PRODUCTS_CREATE)
  @UseInterceptors(FileInterceptor('file'))
  importPreview(
    @CurrentUser() user: any,
    @UploadedFile() file: any,
    @Query('warehouseId') warehouseId?: string,
    @Query('importMode') importMode?: string,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('Fayl yuklanmadi');
    }
    const mode =
      importMode === 'add' || importMode === 'subtract' || importMode === 'set'
        ? importMode
        : 'set';
    return this.productImportService.processImportFile(user.companyId, file.buffer, {
      defaultWarehouseId: warehouseId,
      importMode: mode,
      stockPolicy: 'apply_all',
    });
  }

  @Post('import/confirm')
  @Permissions(Permission.PRODUCTS_CREATE)
  importConfirm(
    @CurrentUser() user: any,
    @Body() body: ImportConfirmDto,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.productImportService.enqueueImport(
      user.companyId,
      user.sub,
      body.rows,
      {
        importMode: body.importMode || 'set',
        stockPolicy: body.stockPolicy || 'apply_all',
        partnerLedgerContactId: body.partnerLedgerContactId?.trim() || undefined,
      },
      warehouseId?.trim() || undefined,
    );
  }

  @Get('import/jobs/:jobId')
  @Permissions(Permission.PRODUCTS_CREATE)
  importJobStatus(@CurrentUser() user: any, @Param('jobId') jobId: string) {
    return this.productImportService.getImportJobStatus(user.companyId, jobId);
  }

  @Get('import/jobs/:jobId/failures')
  @Permissions(Permission.PRODUCTS_CREATE)
  importJobFailures(
    @CurrentUser() user: any,
    @Param('jobId') jobId: string,
    @Query('limit') limit?: string,
  ) {
    const n = limit ? Number(limit) : 30;
    return this.productImportService.getImportJobFailures(user.companyId, jobId, n);
  }

  @Post('import/jobs/:jobId/cancel')
  @Permissions(Permission.PRODUCTS_CREATE)
  cancelImportJob(@CurrentUser() user: any, @Param('jobId') jobId: string) {
    return this.productImportService.cancelImportJob(user.companyId, jobId);
  }
}
