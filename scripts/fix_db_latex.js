import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'prisma', 'dev.db');
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('Searching for corrupted ProjectFile records...');
    
    const corruptedFiles = await prisma.projectFile.findMany({
        where: {
            OR: [
                { content: { contains: '\\\\begin' } },
                { content: { contains: '\\\\documentclass' } }
            ]
        }
    });

    console.log(`Found ${corruptedFiles.length} potentially corrupted files.`);

    for (const file of corruptedFiles) {
        console.log(`Fixing corrupted file: ${file.filename} (ID: ${file.id})`);
        const fixedContent = file.content.replace(/\\\\/g, '\\');
        await prisma.projectFile.update({
            where: { id: file.id },
            data: { content: fixedContent }
        });
    }

    const corruptedProjects = await prisma.project.findMany({
        where: {
            OR: [
                { latexContent: { contains: '\\\\begin' } },
                { latexContent: { contains: '\\\\documentclass' } }
            ]
        }
    });

    console.log(`Found ${corruptedProjects.length} potentially corrupted projects.`);

    for (const project of corruptedProjects) {
        console.log(`Fixing corrupted project: ${project.title} (ID: ${project.id})`);
        const fixedContent = (project.latexContent || '').replace(/\\\\/g, '\\');
        await prisma.project.update({
            where: { id: project.id },
            data: { latexContent: fixedContent }
        });
    }

    console.log('Database fix completed.');
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
