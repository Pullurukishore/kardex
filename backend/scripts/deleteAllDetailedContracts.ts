import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteAllDetailedContracts() {
  try {
    console.log('Starting deletion of all detailed annual contracts...');

    // Delete all detailed contracts
    const deleted = await (prisma as any).detailedContract.deleteMany({});
    console.log(`\n========================================`);
    console.log(`SUCCESS: Deleted ${deleted.count} detailed contract record(s)!`);
    console.log(`========================================\n`);

  } catch (error: any) {
    console.error('Error deleting detailed contracts:', error?.message || error);
  } finally {
    await prisma.$disconnect();
    console.log('Database connection closed.');
  }
}

deleteAllDetailedContracts();
