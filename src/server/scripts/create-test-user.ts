import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createTestUser() {
  try {
    const username = 'testuser';
    const password = 'testpass123';
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const user = await prisma.user.create({
      data: {
        username,
        password: passwordHash
      }
    });

    console.log('Test user created successfully:');
    console.log(`Username: ${username}`);
    console.log(`Password: ${password}`);
    console.log('You can now use these credentials to log in.');
  } catch (error) {
    console.error('Error creating test user:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

createTestUser(); 