import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteServicePersons() {
  try {
    console.log('Starting deletion of all service persons...');

    // 1. Find all users with role SERVICE_PERSON
    const servicePersons = await prisma.user.findMany({
      where: {
        role: 'SERVICE_PERSON',
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    if (servicePersons.length === 0) {
      console.log('No service persons found.');
      return;
    }

    const servicePersonIds = servicePersons.map((p) => p.id);
    console.log(`Found ${servicePersons.length} service persons to delete: ${servicePersons.map(p => p.email).join(', ')}`);

    // 2. Prepare for deletion - handle relations
    console.log('Cleaning up related data for service persons...');

    // We use a transaction for consistency
    await prisma.$transaction(async (tx) => {
      // Nullify references in Tickets (where nullable)
      console.log('Nullifying assigned technician in tickets...');
      await tx.ticket.updateMany({
        where: { assignedToId: { in: servicePersonIds } },
        data: { assignedToId: null },
      });

      await tx.ticket.updateMany({
        where: { subOwnerId: { in: servicePersonIds } },
        data: { subOwnerId: null },
      });

      // Handle mandatory references in Tickets - we might have to delete the tickets
      // or re-assign them to an admin. Deleting tickets created/owned by service persons seems safer
      // for a "delete all service persons" request if they are not supposed to be creators.
      // However, it's better to check if any exist.
      const ticketsOwnedByServicePersons = await tx.ticket.findMany({
          where: {
              OR: [
                  { ownerId: { in: servicePersonIds } },
                  { createdById: { in: servicePersonIds } }
              ]
          },
          select: { id: true }
      });

      if (ticketsOwnedByServicePersons.length > 0) {
          const ownedTicketIds = ticketsOwnedByServicePersons.map(t => t.id);
          console.log(`Found ${ownedTicketIds.length} tickets owned or created by service persons. Deleting them...`);
          
          // Delete ticket-related data first (similar to deleteTickets.ts)
          await tx.ticketStatusHistory.deleteMany({ where: { ticketId: { in: ownedTicketIds } } });
          await tx.ticketNote.deleteMany({ where: { ticketId: { in: ownedTicketIds } } });
          await tx.ticketReport.deleteMany({ where: { ticketId: { in: ownedTicketIds } } });
          await tx.ticketFeedback.deleteMany({ where: { ticketId: { in: ownedTicketIds } } });
          await tx.onsiteVisitLog.deleteMany({ where: { ticketId: { in: ownedTicketIds } } });
          await tx.comment.deleteMany({ where: { ticketId: { in: ownedTicketIds } } });
          await tx.attachment.deleteMany({ where: { ticketId: { in: ownedTicketIds } } });
          await tx.dailyActivityLog.deleteMany({ where: { ticketId: { in: ownedTicketIds } } });
          await tx.activitySchedule.deleteMany({ where: { ticketId: { in: ownedTicketIds } } });
          await tx.auditLog.deleteMany({ where: { ticketId: { in: ownedTicketIds } } });
          await tx.rating.deleteMany({ where: { ticketId: { in: ownedTicketIds } } });
          await tx.pORequest.deleteMany({ where: { ticketId: { in: ownedTicketIds } } });
          
          await tx.ticket.deleteMany({ where: { id: { in: ownedTicketIds } } });
      }

      // Delete specific logs and records belonging to these users
      console.log('Deleting activity logs, attendance, and onsite visit logs...');
      await tx.dailyActivityLog.deleteMany({ where: { userId: { in: servicePersonIds } } });
      await tx.attendance.deleteMany({ where: { userId: { in: servicePersonIds } } });
      await tx.onsiteVisitLog.deleteMany({ where: { userId: { in: servicePersonIds } } });
      
      console.log('Deleting schedules and notifications...');
      await tx.activitySchedule.deleteMany({ where: { servicePersonId: { in: servicePersonIds } } });
      await tx.notification.deleteMany({ where: { userId: { in: servicePersonIds } } });
      
      console.log('Deleting service person zones and assignments...');
      await tx.servicePersonZone.deleteMany({ where: { userId: { in: servicePersonIds } } });

      console.log('Deleting audit logs performed by these users...');
      await tx.auditLog.deleteMany({
          where: {
              OR: [
                  { userId: { in: servicePersonIds } },
                  { performedById: { in: servicePersonIds } }
              ]
          }
      });

      // Handle Finance/AR module items if any
      await tx.aRInvoiceRemark.deleteMany({ where: { createdById: { in: servicePersonIds } } });
      await tx.bankAccountAttachment.deleteMany({ where: { uploadedById: { in: servicePersonIds } } });
      await tx.paymentBatch.deleteMany({ where: { requestedById: { in: servicePersonIds } } });

      // Finally delete the users
      console.log('Deleting User records...');
      const result = await tx.user.deleteMany({
        where: { id: { in: servicePersonIds } },
      });

      console.log(`\nSuccessfully deleted ${result.count} service persons and all their related data!`);
    });

  } catch (error) {
    console.error('Error deleting service persons:', error);
  } finally {
    await prisma.$disconnect();
    console.log('Database connection closed.');
  }
}

deleteServicePersons();
