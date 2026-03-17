import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteAllTickets() {
  try {
    console.log('Starting deletion of all tickets and related data...');

    // Explicitly delete all related records first because some relations lack onDelete: Cascade
    const deleteOperations = [
      prisma.ticketStatusHistory.deleteMany(),
      prisma.ticketNote.deleteMany(),
      prisma.ticketReport.deleteMany(),
      prisma.ticketFeedback.deleteMany(),
      prisma.onsiteVisitLog.deleteMany(),
      prisma.pORequest.deleteMany(),
      prisma.rating.deleteMany(),
      prisma.comment.deleteMany(),
      prisma.attachment.deleteMany(),
      prisma.dailyActivityLog.deleteMany({ where: { ticketId: { not: null } } }),
      prisma.activitySchedule.deleteMany({ where: { ticketId: { not: null } } }),
      prisma.auditLog.deleteMany({ where: { ticketId: { not: null } } }),
    ];

    console.log('Deleting related records (status history, notes, reports, logs, etc.)...');
    await prisma.$transaction(deleteOperations);
    console.log('Related records deleted successfully.');

    console.log('Deleting all Tickets...');
    const result = await prisma.ticket.deleteMany({});
    
    console.log(`\nSuccessfully deleted ${result.count} tickets!`);

  } catch (error) {
    console.error('Error deleting tickets:', error);
  } finally {
    await prisma.$disconnect();
    console.log('Database connection closed.');
  }
}

deleteAllTickets();
