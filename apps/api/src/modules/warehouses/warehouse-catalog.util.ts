import { Prisma } from '@prisma/client';

/** Import: boshqa ombor kategoriyasidagi SKU/barcode bilan moslashtirmaslik */
export function importVariantCatalogFilter(
  companyId: string,
  warehouseId: string,
): Prisma.ProductVariantWhereInput {
  return {
    companyId,
    status: 'ACTIVE',
    product: {
      status: 'ACTIVE',
      OR: [
        { categoryId: null },
        {
          category: {
            status: { not: 'ARCHIVED' },
            warehouseId,
          },
        },
      ],
    },
  };
}

/** Ombor o'chirilganda katalogdan olib tashlanadigan mahsulotlar filtri */
export function productsTiedToWarehouseFilter(
  companyId: string,
  warehouseId: string,
): Prisma.ProductWhereInput {
  return {
    companyId,
    status: { not: 'ARCHIVED' },
    OR: [
      { category: { warehouseId } },
      {
        variants: {
          some: { stockBalances: { some: { warehouseId } } },
        },
      },
    ],
  };
}

export function variantsInWarehouseCategoryFilter(
  companyId: string,
  warehouseId: string,
): Prisma.ProductVariantWhereInput {
  return {
    companyId,
    status: { not: 'ARCHIVED' },
    product: {
      status: { not: 'ARCHIVED' },
      category: { warehouseId },
    },
  };
}
