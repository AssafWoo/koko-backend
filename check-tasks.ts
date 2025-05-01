import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tasks = await prisma.task.findMany({
    where: {
      userId: '02cdcc14-3256-42e1-b7ae-ce09a3d100bf'
    }
  });

  console.log('Tasks found:', tasks.length);
  for (const task of tasks) {
    console.log('\nTask:', task.id);
    console.log('Metadata:', task.metadata);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect()); 