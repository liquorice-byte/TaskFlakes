import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Running Prisma seed script...');
  console.log('ℹ️  Default subjects (Chinese, Maths, English) are created per-user via the API in Phase 2.');
  console.log('✅ Nothing to seed in Phase 1. Skipping.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
