import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteAllVendorAccounts() {
  try {
    console.log('Starting deletion of all vendor bank accounts and related data...');

    // Delete related records first
    const deleteOperations = [
      prisma.bankAccountAttachment.deleteMany(),
      prisma.bankAccountChangeRequest.deleteMany(),
      prisma.bankAccountActivityLog.deleteMany(),
      prisma.paymentBatchItem.deleteMany(),
    ];

    console.log('Deleting related records (attachments, change requests, activity logs, etc.)...');
    await prisma.$transaction(deleteOperations);
    console.log('Related records deleted successfully.');

    console.log('Deleting all Bank Accounts...');
    const result = await prisma.bankAccount.deleteMany({});
    
    console.log(`\nSuccessfully deleted ${result.count} vendor bank accounts!`);

  } catch (error) {
    console.error('Error deleting vendor accounts:', error);
  } finally {
    await prisma.$disconnect();
    console.log('Database connection closed.');
  }
}

deleteAllVendorAccounts();
