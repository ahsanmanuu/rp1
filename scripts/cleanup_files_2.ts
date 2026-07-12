import { prisma } from '../src/lib/prisma';

async function main() {
    let deletedCount = 0;
    
    // Check for publisher bst/cls in WRONG projects.
    const allProjects = await prisma.project.findMany();
    for (const p of allProjects) {
        const tplName = (p.templateName || '').toLowerCase();
        
        // If not PNAS, delete pnas-specific files
        if (tplName !== 'pnas') {
             const r = await prisma.projectFile.deleteMany({
                 where: { 
                     projectId: p.id,
                     filename: { in: ['pnas-new.bst', 'pnas-new.cls', 'pnas-new.sty'] }
                 }
             });
             if (r.count > 0) deletedCount += r.count;
        }
        
        // Also delete sample.bib everywhere
        const rBib = await prisma.projectFile.deleteMany({
             where: { 
                 projectId: p.id,
                 filename: 'sample.bib'
             }
        });
        if (rBib.count > 0) deletedCount += rBib.count;
    }

    console.log(`Deleted ${deletedCount} publisher-specific/sample files from DB`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());