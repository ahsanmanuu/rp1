import Database from 'better-sqlite3';

try {
  const db = new Database('./prisma/dev.db');
  
  const projectId = 'cmovv6fbb00059kg4ya4otlpv';
  const contentRow = db.prepare("SELECT content FROM ProjectFile WHERE projectId = ? AND filename = 'main.tex'").get(projectId);
  
  if (contentRow) {
    const text = contentRow.content || "";
    
    // Let's find all \begin{table} and extract the context up to \end{table}
    const tableRegex = /\\begin\{(?:table|table\*)\}([\s\S]*?)\\end\{(?:table|table\*)\}/gi;
    let match;
    let idx = 1;
    console.log("=== All Table Environments in LaTeX ===");
    while ((match = tableRegex.exec(text)) !== null) {
      console.log(`\n--- TABLE ${idx++} ---`);
      console.log(match[0]);
    }
  }
} catch (err) {
  console.error("Error:", err);
}
