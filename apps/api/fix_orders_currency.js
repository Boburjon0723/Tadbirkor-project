const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Starting B2B Order Item currency correction...");
    
    // Find all B2B order items
    const items = await prisma.b2BOrderItem.findMany({
      include: {
        productVariant: true
      }
    });

    let updatedCount = 0;

    for (const item of items) {
      if (!item.productVariant) {
        console.log(`Skipping Item ID ${item.id}: No linked ProductVariant.`);
        continue;
      }

      const variantCurrency = (item.productVariant.currency || 'UZS').toUpperCase();
      const itemCurrency = (item.expectedCurrency || 'UZS').toUpperCase();

      if (variantCurrency !== itemCurrency) {
        console.log(`Mismatch found for Item ID ${item.id} ("${item.productNameSnapshot}"):`);
        console.log(`  - Item Currency in DB: ${itemCurrency}`);
        console.log(`  - Variant Actual Currency: ${variantCurrency}`);
        
        await prisma.b2BOrderItem.update({
          where: { id: item.id },
          data: { expectedCurrency: variantCurrency }
        });
        
        console.log(`  -> Corrected to ${variantCurrency}!`);
        updatedCount++;
      }
    }

    console.log(`\nSuccessfully corrected ${updatedCount} order items!`);
  } catch (err) {
    console.error("Error correcting order currencies:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
