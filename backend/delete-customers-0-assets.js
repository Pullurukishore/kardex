const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Finding customer records with 0 assets, 0 contracts, 0 tickets, and 0 offers...');
  
  const customers = await prisma.customer.findMany({
    where: {
      assets: { none: {} },
      contracts: { none: {} },
      tickets: { none: {} },
      offers: { none: {} }
    },
    select: {
      id: true,
      companyName: true
    }
  });

  console.log(`Found ${customers.length} customer accounts with NO assets, NO contracts, NO tickets, and NO offers.`);

  if (customers.length === 0) {
    console.log('No unreferenced customer accounts found.');
    return;
  }

  let deletedCount = 0;
  for (const c of customers) {
    const customerId = c.id;

    // Delete linked contacts (if any contact details were saved for this customer)
    await prisma.contact.deleteMany({
      where: { customerId }
    }).catch(() => {});

    try {
      await prisma.customer.delete({
        where: { id: customerId }
      });
      deletedCount++;
    } catch (err) {
      console.error(`Could not delete customer ${customerId} (${c.companyName}):`, err.message);
    }
  }

  console.log(`\n================ Summary ================`);
  console.log(`Successfully deleted ${deletedCount} unused customer accounts.`);
  console.log(`Kept all contracts, tickets, offers, and asset-linked customers 100% intact.`);
  console.log(`=========================================\n`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
