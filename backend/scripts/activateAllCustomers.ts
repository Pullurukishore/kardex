import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function activateAllCustomers() {
  try {
    console.log('Starting reactivation of all customer accounts...');

    const result = await prisma.customer.updateMany({
      where: { isActive: false },
      data: { isActive: true }
    });

    console.log(`\n========================================`);
    console.log(`SUCCESS: Reactivated ${result.count} customer account(s)!`);
    console.log(`All customer accounts are now ACTIVE.`);
    console.log(`========================================\n`);

  } catch (error) {
    console.error('Error reactivating customers:', error);
  } finally {
    await prisma.$disconnect();
    console.log('Database connection closed.');
  }
}

activateAllCustomers();
