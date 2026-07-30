const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const ids = [1538, 1539, 1542, 1544];
    const customers = await prisma.customer.findMany({
        where: { id: { in: ids } }
    });
    
    customers.forEach(c => {
        console.log(`ID ${c.id}:`);
        console.log(`  Name: ${JSON.stringify(c.companyName)}`);
        console.log(`  Length: ${c.companyName.length}`);
        console.log(`  Address: ${JSON.stringify(c.address)}`);
    });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
