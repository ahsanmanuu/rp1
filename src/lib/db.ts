import { PrismaClient } from '@prisma/client';

function createPrisma(): PrismaClient {
  return new PrismaClient();
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
