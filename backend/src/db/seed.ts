import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');
  
  const userCount = await prisma.user.count();
  if (userCount === 0) {
    const defaultEmail = 'admin@socialsync.local';
    const defaultPassword = 'AdminPassword2026!';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);
    
    await prisma.user.create({
      data: {
        name: 'Default Admin',
        email: defaultEmail,
        passwordHash,
        role: 'ADMIN',
      },
    });
    
    console.log('--------------------------------------------------');
    console.log('Admin user seeded successfully!');
    console.log(`Email:    ${defaultEmail}`);
    console.log(`Password: ${defaultPassword}`);
    console.log('--------------------------------------------------');
  } else {
    console.log('Database already has users. Skipping seeding.');
  }
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
