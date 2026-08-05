const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.contract.deleteMany();
  console.log(`Successfully deleted ${result.count} contract records from the database.`);
  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Error deleting contracts:', err);
  process.exit(1);
});
