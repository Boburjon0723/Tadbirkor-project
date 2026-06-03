const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testCreate() {
  const companyId = 'e1fb6a6a-e9c6-4f5e-ba33-65460b0a5453'; // A kompaniya ID
  const userId = '8f3a3a3a-3a3a-3a3a-3a3a-3a3a3a3a3a3a'; // Test user
  
  const dto = {
    name: 'Test Mahsulot',
    unit: 'dona',
    type: 'GOODS',
    variants: [
      {
        name: 'Standart',
        sku: 'TEST-SKU-100',
        barcode: '123456789',
        purchasePrice: 1000,
        salePrice: 2000
      }
    ]
  };

  console.log('Testing product creation...');
  
  try {
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          companyId,
          name: dto.name,
          unit: dto.unit,
          type: dto.type,
          status: 'ACTIVE',
          createdBy: userId,
        },
      });

      for (const v of dto.variants) {
        await tx.productVariant.create({
          data: {
            companyId,
            productId: product.id,
            name: v.name,
            sku: v.sku,
            barcode: v.barcode,
            salePrice: v.salePrice,
            purchasePrice: v.purchasePrice,
            currency: 'UZS',
            status: 'ACTIVE',
            createdBy: userId,
          },
        });
      }

      return tx.product.findUnique({
        where: { id: product.id },
        include: { variants: true },
      });
    });

    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Error during creation:', err);
  } finally {
    await prisma.$disconnect();
  }
}

testCreate();
