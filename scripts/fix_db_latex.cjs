const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Searching for corrupted ProjectFile records...');
    
    // Find files that contain the double-escaped signature
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
        
        // Replace \\ with \ globally
        const fixedContent = file.content.replace(/\\\\/g, '\\');
        
        await prisma.projectFile.update({
            where: { id: file.id },
            data: { content: fixedContent }
        });
    }

    // Also update project.latexContent field
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
