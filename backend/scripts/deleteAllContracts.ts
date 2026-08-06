import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteAllContracts() {
  try {
    console.log('Starting deletion of all contracts and related PM schedules...');

    // Delete PM Schedules explicitly first for cleanliness
    const deletedSchedules = await prisma.contractPMSchedule.deleteMany({});
    console.log(`Deleted ${deletedSchedules.count} PM schedule entries.`);

    // Delete all contracts
    const deletedContracts = await prisma.contract.deleteMany({});
    console.log(`\n========================================`);
    console.log(`SUCCESS: Deleted ${deletedContracts.count} contract(s)!`);
    console.log(`========================================\n`);

  } catch (error: any) {
    console.error('Error deleting contracts:', error?.message || error);
  } finally {
    await prisma.$disconnect();
    console.log('Database connection closed.');
  }
}

deleteAllContracts();
