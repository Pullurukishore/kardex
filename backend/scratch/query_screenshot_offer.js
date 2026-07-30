const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // Find the offer asset that has serialNo '07010683/001' or model 'Store - FID'
    const assets = await prisma.asset.findMany({
        where: {
            OR: [
                { serialNo: '07010683/001' },
                { model: 'Store - FID' }
            ]
        },
        include: {
            offerAssets: {
                include: {
                    offer: {
                        include: {
                            customer: true,
                            offerSpareParts: {
                                include: {
                                    sparePart: true
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    console.log('Query result:');
    console.dir(assets, { depth: null });
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
