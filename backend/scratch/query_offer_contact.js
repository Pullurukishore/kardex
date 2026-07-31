const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const offer = await prisma.offer.findFirst({
    where: {
      offerReferenceNumber: {
        contains: 'KAR/S/K/2026'
      }
    },
    include: {
      contact: true,
      createdBy: true,
      customer: {
        include: {
          contacts: true
        }
      }
    }
  });
  console.log(JSON.stringify({
    id: offer?.id,
    offerReferenceNumber: offer?.offerReferenceNumber,
    contactPersonNameOnOffer: offer?.contactPersonName,
    createdBy: offer?.createdBy?.name,
    contactRelation: offer?.contact ? {
      name: offer.contact.name,
      contactPersonName: offer.contact.contactPersonName,
      role: offer.contact.role
    } : null,
    customerContacts: offer?.customer?.contacts?.map(c => ({
      name: c.name,
      contactPersonName: c.contactPersonName,
      role: c.role
    }))
  }, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
