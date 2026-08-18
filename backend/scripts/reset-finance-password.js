const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

async function resetPassword() {
    const email = 'kishorereddypullur123@gmail.com';
    const password = 'kishore@123';

    try {
        console.log(`[INFO] Searching for user: ${email}...`);

        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        const hashedPassword = await bcrypt.hash(password, 10);

        if (existingUser) {
            console.log(`[INFO] User found (ID: ${existingUser.id}). Resetting password and unlocking...`);
            const updated = await prisma.user.update({
                where: { email },
                data: {
                    password: hashedPassword,
                    isActive: true,
                    failedLoginAttempts: 0,
                    accountLockedUntil: null,
                    lastFailedLogin: null,
                    financeRole: existingUser.financeRole || 'FINANCE_ADMIN', // Make sure it is finance admin if not set
                    tokenVersion: uuidv4() // Invalidate existing sessions
                }
            });

            console.log('');
            console.log('✅ User updated successfully!');
            console.log('   Email:', email);
            console.log('   New Password:', password);
            console.log('   Status: Unlocked & Active');
            console.log('   Finance Role:', updated.financeRole);
            console.log('');
        } else {
            console.log(`[INFO] User ${email} not found. Creating a new Finance Admin user...`);
            const user = await prisma.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    name: 'Kishore',
                    financeRole: 'FINANCE_ADMIN',
                    isActive: true,
                    tokenVersion: uuidv4(),
                    failedLoginAttempts: 0
                }
            });

            console.log('');
            console.log('✅ User created successfully!');
            console.log('   Email:', email);
            console.log('   Password:', password);
            console.log('   Status: Active');
            console.log('   Finance Role: FINANCE_ADMIN');
            console.log('   User ID:', user.id);
            console.log('');
        }
    } catch (error) {
        console.error('❌ Error executing script:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

resetPassword()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
