const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 1,
      include: { files: true }
    });

    if (projects.length === 0) {
      console.log("No projects found.");
      return;
    }

    const proj = projects[0];
    console.log(`[PROJECT] ${proj.id} | ${proj.title}`);
    
    let mainTex = proj.files.find(f => f.filename === 'main.tex');
    let content = mainTex ? mainTex.content : proj.latexContent;

    if (!content) {
       console.log("No LaTeX content.");
       return;
    }

    const lines = content.split('\n');
    console.log(`Lines: ${lines.length}`);
    
    const start = Math.max(0, 150);
    const end = Math.min(lines.length, 180);
    
    for (let i = start; i < end; i++) {
      console.log(`${i + 1}: ${lines[i]}`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
