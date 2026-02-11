const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({
        select: { id: true, name: true, email: true, role: true, zoneId: true }
    });
    console.log('Users in database:');
    console.table(users);

    const zones = await prisma.serviceZone.findMany();
    console.log('\nZones in database:');
    console.table(zones);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
