
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- PRISMA TEST START ---');
  try {
    const companies = await prisma.company.findMany({ take: 5 });
    console.log('Companies found:', companies.length);
    
    const products = await prisma.product.findMany({
      include: { variants: true },
      take: 5
    });
    console.log('Products found:', products.length);
    
    if (products.length > 0) {
      console.log('First product sample:', JSON.stringify(products[0], null, 2));
    }

    const sellerCatalog = await prisma.productVariant.findMany({
      where: {
        status: 'ACTIVE',
        product: { status: 'ACTIVE' },
        stockBalances: {
          some: {
            quantity: { gt: 0 },
          },
        },
      },
      include: {
        product: true,
        stockBalances: true
      },
      take: 5
    });
    console.log('Seller Catalog items with stock > 0 found:', sellerCatalog.length);

  } catch (error) {
    console.error('PRISMA ERROR:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
