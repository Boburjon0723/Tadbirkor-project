const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const orders = await prisma.b2BOrder.findMany({
      include: {
        items: true,
        buyer: { select: { name: true } },
        seller: { select: { name: true } }
      }
    });
    console.log(`Found ${orders.length} total orders.`);
    orders.forEach(o => {
      console.log(`\nOrder ID: ${o.id}`);
      console.log(`Status: ${o.status}`);
      console.log(`Date: ${o.createdAt}`);
      console.log(`Buyer: ${o.buyer.name} | Seller: ${o.seller.name}`);
      o.items.forEach(item => {
        console.log(`  - Item: ${item.productNameSnapshot}`);
        console.log(`    Qty: ${item.quantity}`);
        console.log(`    Expected Price: ${item.expectedPrice}`);
        console.log(`    Currency: ${item.expectedCurrency}`);
        const total = Number(item.quantity) * Number(item.expectedPrice || 0);
        console.log(`    Total: ${total}`);
      });
    });
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
