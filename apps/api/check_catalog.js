const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// We can copy the logic from getSellerCatalogForBuyer to see what it returns
async function getSellerCatalogForBuyer(buyerCompanyId, sellerCompanyId, search) {
  const q = search?.trim();

  const whereVariant = {
    companyId: sellerCompanyId,
    status: 'ACTIVE',
    product: { status: 'ACTIVE' },
  };

  const andClauses = [];

  if (q) {
    andClauses.push({
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { sku: { contains: q, mode: 'insensitive' } },
        { product: { name: { contains: q, mode: 'insensitive' } } },
      ],
    });
  }

  if (andClauses.length) {
    whereVariant.AND = andClauses;
  }

  const variants = await prisma.productVariant.findMany({
    where: whereVariant,
    take: 200,
    orderBy: [{ product: { name: 'asc' } }, { name: 'asc' }],
    include: {
      product: { select: { id: true, name: true, imageUrl: true } },
      stockBalances: true,
    },
  });

  return variants;
}

async function main() {
  try {
    const buyerCompanyId = 'f3ca9e39-53e0-4001-a666-1e45e2979044';
    const sellerCompanyId = 'bf1d0d78-a5fa-4077-a7c3-1027ac45e34d';

    console.log("Calling mock getSellerCatalogForBuyer...");
    const variants = await getSellerCatalogForBuyer(buyerCompanyId, sellerCompanyId);
    console.log(`Total variants returned: ${variants.length}`);

    // Let's print unique product names returned
    const productNames = Array.from(new Set(variants.map(v => v.product.name)));
    console.log(`Total unique products: ${productNames.length}`);
    console.log("Products in catalog:", productNames);

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
