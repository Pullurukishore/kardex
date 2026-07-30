const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const ids = [1538, 1539, 1542, 1544];
    const honda = await prisma.customer.findMany({
        where: {
            id: { in: ids }
        },
        include: {
            contacts: true,
            offers: {
                select: {
                    id: true,
                    offerReferenceNumber: true,
                    title: true
                }
            },
            assets: true
        }
    });

    console.log(JSON.stringify(honda, null, 2));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
