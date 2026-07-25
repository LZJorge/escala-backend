import type { PrismaClient } from '@prisma/client';

export async function clearDatabase(prisma: PrismaClient): Promise<void> {
  const tableNames = await prisma.$queryRaw<
    Array<{ tablename: string }>
  >`SELECT tablename FROM pg_tables WHERE schemaname='public'`;

  const cleanable = tableNames
    .map((row) => row.tablename)
    .filter((name) => name !== '_prisma_migrations');

  if (cleanable.length === 0) {
    return;
  }

  const tables = cleanable.map((name) => `"public"."${name}"`).join(', ');

  try {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
  } catch {
    // clear on teardown, swallow if tables are gone
  }
}
