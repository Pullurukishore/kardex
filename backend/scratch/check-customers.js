const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Fetching customers...');
    const customers = await prisma.customer.findMany({
        select: {
            id: true,
            companyName: true,
            serviceZoneId: true,
            isActive: true,
            _count: {
                select: {
                    assets: true,
                    contacts: true,
                    tickets: true,
                    offers: true
                }
            }
        }
    });

    console.log(`Total customers: ${customers.length}`);

    // Find duplicates by company name
    const countByName = {};
    customers.forEach(c => {
        const name = c.companyName.trim().toLowerCase();
        if (!countByName[name]) {
            countByName[name] = [];
        }
        countByName[name].push(c);
    });

    const duplicates = Object.entries(countByName).filter(([name, list]) => list.length > 1);

    console.log(`\nFound ${duplicates.length} duplicate company names:`);
    duplicates.forEach(([name, list]) => {
        console.log(`- "${name}": ${list.length} occurrences`);
        list.forEach(c => {
            console.log(`    ID: ${c.id}, Zone: ${c.serviceZoneId}, Active: ${c.isActive}, Assets: ${c._count.assets}, Contacts: ${c._count.contacts}, Tickets: ${c._count.tickets}, Offers: ${c._count.offers}`);
        });
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
