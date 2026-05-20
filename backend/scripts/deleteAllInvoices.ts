import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteAllInvoices() {
  try {
    console.log('Starting deletion of regular invoices and related data (excluding milestones)...');

    // 1. Get all REGULAR invoice IDs
    const regularInvoices = await prisma.aRInvoice.findMany({
      where: { invoiceType: 'REGULAR' },
      select: { id: true }
    });

    const invoiceIds = regularInvoices.map((inv: any) => inv.id);

    if (invoiceIds.length === 0) {
      console.log('No regular invoices found to delete.');
      return;
    }

    console.log(`Found ${invoiceIds.length} regular invoices to delete.`);

    // 2. Delete loosely related records for these invoices
    // ARInvoiceRemark has onDelete: Cascade so it will be deleted automatically when the invoice is deleted
    const deleteOperations = [
      prisma.aRPaymentHistory.deleteMany({
        where: { invoiceId: { in: invoiceIds } }
      }),
      prisma.aRInvoiceActivityLog.deleteMany({
        where: { invoiceId: { in: invoiceIds } }
      })
    ];

    console.log('Deleting related records (payments, activity logs)...');
    await prisma.$transaction(deleteOperations);
    console.log('Related records deleted successfully.');

    // 3. Delete the invoices themselves
    console.log('Deleting Regular Invoices...');
    const result = await prisma.aRInvoice.deleteMany({
      where: { id: { in: invoiceIds } }
    });
    
    console.log(`\nSuccessfully deleted ${result.count} regular invoices!`);

  } catch (error) {
    console.error('Error deleting invoices:', error);
  } finally {
    await prisma.$disconnect();
    console.log('Database connection closed.');
  }
}

deleteAllInvoices();
