import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteAllCustomers() {
  try {
    console.log('Starting cascade deletion of ALL customers and related records...');

    const customerCount = await prisma.customer.count();
    if (customerCount === 0) {
      console.log('No customers found in database.');
      return;
    }

    console.log(`Found ${customerCount} customer(s) to delete.`);

    // 1. Unlink Customer ID from Users
    console.log('Unlinking customer accounts from User profiles...');
    await prisma.user.updateMany({
      where: { customerId: { not: null } },
      data: { customerId: null }
    });

    // 2. Delete Contract PM Schedules and Contracts
    console.log('Deleting Contract PM Schedules and Contracts...');
    await prisma.contractPMSchedule.deleteMany({});
    await prisma.contract.deleteMany({});

    // 3. Delete Offer Stage Remarks, Offer Spare Parts, Offer Assets, and Offers
    console.log('Deleting Offer related records and Offers...');
    await prisma.stageRemark.deleteMany({});
    await prisma.offerSparePart.deleteMany({});
    await prisma.offerAsset.deleteMany({});
    await prisma.offer.deleteMany({});

    // 4. Delete Ticket dependent records and Tickets
    console.log('Deleting Ticket related records (status history, notes, reports, feedbacks, PO requests, comments, attachments, etc.)...');
    await prisma.$transaction([
      prisma.ticketStatusHistory.deleteMany({}),
      prisma.ticketNote.deleteMany({}),
      prisma.ticketReport.deleteMany({}),
      prisma.ticketFeedback.deleteMany({}),
      prisma.onsiteVisitLog.deleteMany({}),
      prisma.pORequest.deleteMany({}),
      prisma.rating.deleteMany({}),
      prisma.comment.deleteMany({}),
      prisma.attachment.deleteMany({}),
      prisma.dailyActivityLog.deleteMany({ where: { ticketId: { not: null } } }),
      prisma.activitySchedule.deleteMany({ where: { OR: [{ ticketId: { not: null } }, { customerId: { not: null } }] } }),
      prisma.auditLog.deleteMany({ where: { OR: [{ ticketId: { not: null } }, { offerId: { not: null } }] } })
    ]);

    await prisma.ticket.deleteMany({});

    // 5. Delete Assets
    console.log('Deleting Assets...');
    await prisma.asset.deleteMany({});

    // 6. Delete Contacts
    console.log('Deleting Contacts...');
    await prisma.contact.deleteMany({});

    // 7. Delete Customers
    console.log('Deleting all Customer accounts...');
    const result = await prisma.customer.deleteMany({});

    console.log(`\n========================================`);
    console.log(`SUCCESS: Deleted ${result.count} customer account(s) and all dependent data!`);
    console.log(`========================================\n`);

  } catch (error) {
    console.error('Error deleting customers:', error);
  } finally {
    await prisma.$disconnect();
    console.log('Database connection closed.');
  }
}

deleteAllCustomers();
