const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const buyerId = 'b4e4f4bd-4566-4d2b-acb0-0c97ebac87f1'; // Partner B (Buyer)
  const sellerId = 'e1fb6a6a-e9c6-4f5e-ba33-65460b0a5453'; // User A (Seller)

  // 1. Find a product variant of User A
  const variant = await prisma.productVariant.findFirst({
    where: { companyId: sellerId, status: 'ACTIVE' },
    include: { product: true }
  });

  if (!variant) {
    console.log('No active variants found for User A');
    return;
  }

  // 2. Find a user in the buyer company to be the creator
  // Fix: User model doesn't have companyId, use CompanyUser instead
  const companyUser = await prisma.companyUser.findFirst({
    where: { companyId: buyerId }
  });

  if (!companyUser) {
    console.log('No user found in buyer company');
    return;
  }

  // 3. Create a B2B Order from B to A
  const order = await prisma.b2BOrder.create({
    data: {
      buyerCompanyId: buyerId,
      sellerCompanyId: sellerId,
      status: 'SENT',
      createdBy: companyUser.userId,
      items: {
        create: [
          {
            productVariantId: variant.id,
            productNameSnapshot: variant.product.name,
            quantity: 10,
            expectedPrice: variant.salePrice,
            mappingStatus: 'MAPPED'
          }
        ]
      }
    }
  });

  console.log(`Order created successfully! ID: ${order.id}`);
  console.log(`Partner B (NuurHome) ordered 10 units of "${variant.product.name}" from you.`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
