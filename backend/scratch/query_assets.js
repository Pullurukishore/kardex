const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const assets = await prisma.asset.findMany({
        take: 10,
        include: {
            customer: true
        }
    });
    console.log('Assets in database:');
    console.dir(assets, { depth: null });

    const offerAssets = await prisma.offerAsset.findMany({
        take: 10,
        include: {
            asset: true
        }
    });
    console.log('\nOfferAssets in database:');
    console.dir(offerAssets, { depth: null });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
