const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({
        select: { id: true, name: true, email: true }
    });
    console.log('Users in database:');
    console.table(users);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
