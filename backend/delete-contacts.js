const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.contact.deleteMany();
  console.log(`Successfully deleted ${result.count} contact records from the database.`);
  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Error deleting contacts:', err);
  process.exit(1);
});
