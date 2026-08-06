import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deactivateAllCustomers() {
  try {
    console.log('Starting deactivation (soft delete) of all customer accounts...');

    const result = await prisma.customer.updateMany({
      where: { isActive: true },
      data: { isActive: false }
    });

    console.log(`\n========================================`);
    console.log(`SUCCESS: Deactivated ${result.count} customer account(s)!`);
    console.log(`All linked Tickets, Offers, Contracts, and Assets remain 100% intact and safe.`);
    console.log(`========================================\n`);

  } catch (error) {
    console.error('Error deactivating customers:', error);
  } finally {
    await prisma.$disconnect();
    console.log('Database connection closed.');
  }
}

deactivateAllCustomers();
