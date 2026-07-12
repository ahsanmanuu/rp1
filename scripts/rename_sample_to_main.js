import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'prisma', 'dev.db');
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('Searching for ProjectFile records named sample.tex...');
    
    const sampleFiles = await prisma.projectFile.findMany({
        where: {
            filename: 'sample.tex'
        }
    });

    console.log(`Found ${sampleFiles.length} records to rename.`);

    for (const file of sampleFiles) {
        console.log(`Renaming file in project ${file.projectId}: sample.tex -> main.tex`);
        
        // We need to check if main.tex already exists for this project to avoid unique constraint violation
        const existingMain = await prisma.projectFile.findUnique({
            where: {
                projectId_filename: {
                    projectId: file.projectId,
                    filename: 'main.tex'
                }
            }
        });

        if (existingMain) {
            console.log(`  [SKIP] main.tex already exists for project ${file.projectId}. Deleting sample.tex instead.`);
            await prisma.projectFile.delete({
                where: { id: file.id }
            });
        } else {
            await prisma.projectFile.update({
                where: { id: file.id },
                data: { 
                    filename: 'main.tex',
                    filePath: file.filePath.replace('sample.tex', 'main.tex')
                }
            });
        }
    }

    console.log('Database rename completed.');
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
