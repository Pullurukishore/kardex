const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper to normalize strings for comparison
function normalizeName(name) {
    if (!name) return '';
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

async function main() {
    console.log('=== CUSTOMER DEDUPLICATION & MERGING SCRIPT ===');
    
    // 1. Fetch all customers with their relations count
    const allCustomers = await prisma.customer.findMany({
        include: {
            _count: {
                select: {
                    assets: true,
                    contacts: true,
                    tickets: true,
                    offers: true,
                    activitySchedules: true,
                    users: true,
                    ratings: true
                }
            }
        }
    });

    console.log(`Total customer records in database: ${allCustomers.length}`);

    // 2. Group by normalized company name and zone ID
    const groups = {};
    allCustomers.forEach(customer => {
        const normName = normalizeName(customer.companyName);
        const zoneId = customer.serviceZoneId;
        const key = `${normName}|${zoneId}`;
        
        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(customer);
    });

    // Filter groups that have duplicates
    const duplicateGroups = Object.entries(groups)
        .filter(([key, list]) => list.length > 1)
        .map(([key, list]) => ({ key, list }));

    console.log(`Found ${duplicateGroups.length} duplicate groups.`);

    if (duplicateGroups.length === 0) {
        console.log('No duplicates found. Nothing to merge.');
        return;
    }

    // 3. Process each duplicate group
    for (const group of duplicateGroups) {
        const [normName, zoneId] = group.key.split('|');
        const list = group.list;
        
        console.log(`\n----------------------------------------`);
        console.log(`Merging duplicates for: "${normName}" in Zone ${zoneId}`);
        console.log(`Number of duplicates: ${list.length}`);

        // Find the best primary candidate
        // Priority:
        // 1. The one with most offers + tickets + assets
        // 2. The one with the lowest ID (oldest)
        list.sort((a, b) => {
            const scoreA = a._count.offers * 10 + a._count.tickets * 5 + a._count.assets * 3 + a._count.contacts;
            const scoreB = b._count.offers * 10 + b._count.tickets * 5 + b._count.assets * 3 + b._count.contacts;
            
            if (scoreB !== scoreA) {
                return scoreB - scoreA; // descending score
            }
            return a.id - b.id; // ascending ID (oldest first)
        });

        const primary = list[0];
        const duplicates = list.slice(1);

        console.log(`Keeping Primary Customer ID: ${primary.id}`);
        console.log(`  Assets: ${primary._count.assets}, Contacts: ${primary._count.contacts}, Tickets: ${primary._count.tickets}, Offers: ${primary._count.offers}`);
        console.log(`Removing Duplicate Customer IDs: ${duplicates.map(d => d.id).join(', ')}`);

        // Execute merge steps inside a transaction
        await prisma.$transaction(async (tx) => {
            for (const duplicate of duplicates) {
                console.log(`  > Merging ID ${duplicate.id} -> ID ${primary.id}...`);

                // A. Re-link assets
                if (duplicate._count.assets > 0) {
                    const res = await tx.asset.updateMany({
                        where: { customerId: duplicate.id },
                        data: { customerId: primary.id }
                    });
                    console.log(`    - Re-linked ${res.count} assets`);
                }

                // B. Re-link ratings
                if (duplicate._count.ratings > 0) {
                    const res = await tx.rating.updateMany({
                        where: { customerId: duplicate.id },
                        data: { customerId: primary.id }
                    });
                    console.log(`    - Re-linked ${res.count} ratings`);
                }

                // C. Re-link tickets
                if (duplicate._count.tickets > 0) {
                    const res = await tx.ticket.updateMany({
                        where: { customerId: duplicate.id },
                        data: { customerId: primary.id }
                    });
                    console.log(`    - Re-linked ${res.count} tickets`);
                }

                // D. Re-link users
                if (duplicate._count.users > 0) {
                    const res = await tx.user.updateMany({
                        where: { customerId: duplicate.id },
                        data: { customerId: primary.id }
                    });
                    console.log(`    - Re-linked ${res.count} users`);
                }

                // E. Re-link offers
                if (duplicate._count.offers > 0) {
                    const res = await tx.offer.updateMany({
                        where: { customerId: duplicate.id },
                        data: { customerId: primary.id }
                    });
                    console.log(`    - Re-linked ${res.count} offers`);
                }

                // F. Re-link activity schedules
                if (duplicate._count.activitySchedules > 0) {
                    const res = await tx.activitySchedule.updateMany({
                        where: { customerId: duplicate.id },
                        data: { customerId: primary.id }
                    });
                    console.log(`    - Re-linked ${res.count} activity schedules`);
                }

                // G. Re-link/Merge contacts
                const dupContacts = await tx.contact.findMany({
                    where: { customerId: duplicate.id }
                });

                for (const contact of dupContacts) {
                    // Check if contact with same phone already exists on primary customer
                    const existingPrimaryContact = await tx.contact.findFirst({
                        where: {
                            customerId: primary.id,
                            phone: contact.phone
                        }
                    });

                    if (existingPrimaryContact) {
                        // Point any tickets or offers referencing the duplicate contact to the primary contact
                        const ticketsRes = await tx.ticket.updateMany({
                            where: { contactId: contact.id },
                            data: { contactId: existingPrimaryContact.id }
                        });
                        const offersRes = await tx.offer.updateMany({
                            where: { contactId: contact.id },
                            data: { contactId: existingPrimaryContact.id }
                        });
                        
                        console.log(`    - Contact "${contact.name}" (${contact.phone}) merged. Re-linked ${ticketsRes.count} tickets and ${offersRes.count} offers.`);

                        // Delete duplicate contact
                        await tx.contact.delete({
                            where: { id: contact.id }
                        });
                    } else {
                        // Move contact to primary customer
                        await tx.contact.update({
                            where: { id: contact.id },
                            data: { customerId: primary.id }
                        });
                        console.log(`    - Contact "${contact.name}" (${contact.phone}) moved to primary customer.`);
                    }
                }

                // H. Finally delete the duplicate customer
                await tx.customer.delete({
                    where: { id: duplicate.id }
                });
                console.log(`    - Deleted customer record ID ${duplicate.id}`);
            }
        });
    }

    console.log('\n=== Merging Complete! ===');
}

main()
    .catch(err => {
        console.error('Fatal Error during merge:', err);
    })
    .finally(() => prisma.$disconnect());
