import { prisma } from '../src/lib/prisma';

async function main() {
    console.log('--- Cleaning up stale component files from ProjectFiles ---');
    
    // Patterns of files to delete across all projects
    const patterns = [
        'packages.sty',
        'abstract.tex',
        'title.tex',
        'dedication.tex',
        'keywords.tex',
        'contribution.tex',
        'organization.tex',
        'bibliography.tex',
        // Also remove specific pnas files if they snuck into other templates over time
        // but wait, if it's actually a PNAS project, it needs them.
        // Let's just delete the components for now.
    ];
    
    let deletedCount = 0;
    
    const resExact = await prisma.projectFile.deleteMany({
        where: { filename: { in: patterns } }
    });
    deletedCount += resExact.count;
    console.log(`Deleted ${resExact.count} exact match files.`);

    const prefixPatterns = [
        'section_',
        'paragraph_',
        'figure_',
        'table_',
        'equation_',
        'algo_'
    ];

    for (const prefix of prefixPatterns) {
        const res = await prisma.projectFile.deleteMany({
            where: { filename: { startsWith: prefix } }
        });
        if (res.count > 0) {
            console.log(`Deleted ${res.count} files matching prefix ${prefix}`);
            deletedCount += res.count;
        }
    }
    
    // Check for publisher bst/cls in WRONG projects.
    // e.g. pnas-new.bst in a project that is NOT pnas.
    // Since we don't easily know the project's current template, it's safer
    // to just let them be, or the user can delete them manually. The big issue
    // was the huge list of paragraph_N.tex and section_N.tex.
    // We WILL delete 'pnas-new.bst', 'pnas-new.cls', 'pnas-new.sty' globally IF they are 
    // not in a PNAS project.
    
    const allProjects = await prisma.project.findMany();
    for (const p of allProjects) {
        const tplName = p.templateName?.toLowerCase() || '';
        if (!tplName.includes('pnas')) {
             const r = await prisma.projectFile.deleteMany({
                 where: { 
                     projectId: p.id,
                     filename: { in: ['pnas-new.bst', 'pnas-new.cls', 'pnas-new.sty'] }
                 }
             });
             if (r.count > 0) deletedCount += r.count;
        }
    }

    console.log(`Total files deleted: ${deletedCount}`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());