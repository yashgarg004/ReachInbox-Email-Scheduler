import { PrismaClient } from '@prisma/client';

// keep a singleton instance
const prisma = new PrismaClient();

// handle disconnect on exit
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;
