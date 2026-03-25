import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deletePhantomUsers() {
  try {
    console.log('Finding and deleting phantom users created from import notes...');

    // These users typically have:
    // 1. Long names (> 30 chars)
    // 2. Emails containing words like 'jan', 'feb', 'logged', etc.
    // 3. Or just emails that don't look like real names.

    const allUsers = await prisma.user.findMany({
      where: {
        role: { in: ['ZONE_USER', 'EXPERT_HELPDESK', 'SERVICE_PERSON'] }
      },
      select: { id: true, name: true, email: true }
    });

    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const keywords = ['logged', 'resolved', 'before', 'after', 'hour', 'min', 'closed', 'call', 'ticket', 'work'];

    const junkUsers = allUsers.filter(u => {
      const n = (u.name || '').toLowerCase();
      const e = (u.email || '').toLowerCase();
      
      return n.length > 30 || 
             /\d/.test(n) || 
             months.some(m => n.includes(m)) || 
             keywords.some(k => n.includes(k)) ||
             months.some(m => e.includes(m)) ||
             keywords.some(k => e.includes(k));
    });

    if (junkUsers.length === 0) {
      console.log('No phantom users found matching criteria.');
      return;
    }

    console.log(`Found ${junkUsers.length} junk users to delete.`);
    junkUsers.forEach(u => console.log(` - ${u.name} (<${u.email}>)`));

    const idsToDelete = junkUsers.map(u => u.id);

    // To delete safely, we need to handle relations like we did for service persons.
    // Since these users were created by mistake from notes, their tickets are usually also junk or un-ownable.
    
    await prisma.$transaction(async (tx) => {
        // Nullify assignment in tickets
        await tx.ticket.updateMany({
            where: { OR: [{ assignedToId: { in: idsToDelete } }, { subOwnerId: { in: idsToDelete } }, { ownerId: { in: idsToDelete } }] },
            data: { assignedToId: null, subOwnerId: null }
        });

        // Delete the users
        const result = await tx.user.deleteMany({
            where: { id: { in: idsToDelete } }
        });
        
        console.log(`Successfully deleted ${result.count} junction users.`);
    });

  } catch (error) {
    console.error('Error deleting phantom users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deletePhantomUsers();
