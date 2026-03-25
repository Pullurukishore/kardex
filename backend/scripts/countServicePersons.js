const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function count() {
  const count = await prisma.user.count({
    where: { role: 'SERVICE_PERSON' }
  });
  console.log(`Found ${count} service persons.`);
  await prisma.$disconnect();
}

count();
