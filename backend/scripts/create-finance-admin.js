const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

/**
 * Create or Update Finance Admin User
 * 
 * Logic:
 * - If user has financeRole -> Finance module only
 * - If user has role (FSM role) -> FSM module only
 */
async function createFinanceAdmin() {
    const email = 'finance@kardex.com';
    const password = 'Finance@123';

    try {
        console.log('[INFO] Checking for finance user...');

        // Check if user exists
        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        if (existingUser) {
            // Update existing user to have financeRole and remove FSM role
            const updated = await prisma.user.update({
                where: { email },
                data: {
                    financeRole: 'FINANCE_ADMIN',
                    role: null // Remove FSM role
                },
            });
            console.log('');
            console.log('✅ Updated existing user to FINANCE_ADMIN');
            console.log('   Email:', email);
            console.log('   Finance Role: FINANCE_ADMIN');
            console.log('   FSM Role: None (Finance-only user)');
            console.log('   User ID:', updated.id);
            console.log('');
            console.log('   This user will now ONLY see the Finance module.');
        } else {
            // Create new user (no FSM role for finance-only users)
            const hashedPassword = await bcrypt.hash(password, 10);

            const user = await prisma.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    name: 'Finance Admin',
                    // role is NOT set - finance-only user has no FSM role
                    financeRole: 'FINANCE_ADMIN', // This determines Finance access
                    isActive: true,
                    tokenVersion: uuidv4(),
                },
            });

            console.log('');
            console.log('✅ Finance Admin created successfully!');
            console.log('   Email:', email);
            console.log('   Password:', password);
            console.log('   Finance Role: FINANCE_ADMIN');
            console.log('   FSM Role: None (Finance-only user)');
            console.log('   User ID:', user.id);
            console.log('');
            console.log('   This user will ONLY see the Finance module.');
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

createFinanceAdmin()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
