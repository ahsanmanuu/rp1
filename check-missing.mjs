import fs from 'fs';

const prisma = fs.readFileSync('prisma/schema.prisma', 'utf8');
const setup = fs.readFileSync('scripts/setup-pocketbase.ts', 'utf8');

const prismaModels = [...prisma.matchAll(/@@map\("([^"]+)"\)/g)].map(m => m[1]);
const setupCols = [...setup.matchAll(/name:\s*'([^']+)'/g)].map(m => m[1]);

const missingInSetup = prismaModels.filter(m => !setupCols.includes(m));
console.log('Prisma models missing in setup-pocketbase.ts:', missingInSetup);
