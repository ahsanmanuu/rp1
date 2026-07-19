import { PrismaClient } from '@prisma/client';

function createPrisma(): PrismaClient {
  try {
    return new PrismaClient();
  } catch (err: any) {
    if (err?.message?.includes('non-empty') || err?.message?.includes('PrismaClientOptions')) {
      throw new Error(
        '❌ Database connection failed: Prisma client is not generated or schema is missing.\n' +
        '   Run: npx prisma generate\n' +
        '   Then restart the dev server.'
      );
    }
    throw err;
  }
}

const g = globalThis as any;
function getPrisma(): PrismaClient {
  if (!g.__prisma) g.__prisma = createPrisma();
  return g.__prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_, prop: string | symbol) {
    return (getPrisma() as any)[prop];
  },
});
