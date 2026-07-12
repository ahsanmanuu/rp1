import Database from 'better-sqlite3';

try {
  const db = new Database('./prisma/dev.db');
  
  const projectId = 'cmovv6fbb00059kg4ya4otlpv';
  const contentRow = db.prepare("SELECT content FROM ProjectFile WHERE projectId = ? AND filename = 'main.tex'").get(projectId);
  
  if (contentRow) {
    const text = contentRow.content || "";
    
    // Find all begin environments in main.tex
    const beginMatches = text.match(/\\begin\{[a-zA-Z*]+\}/g) || [];
    console.log("All begin environments in main.tex:");
    const envs = [...new Set(beginMatches)];
    console.log(envs);
    
    // Search for tabular, tabularx, table, longtable, etc.
    const tableEnvs = text.match(/\\begin\{(?:table|table\*|longtable|tabular|tabularx|supertabular)\}/gi) || [];
    console.log("Found table/tabular environments:", tableEnvs.length);
    tableEnvs.forEach((e, idx) => console.log(`  Env ${idx + 1}: ${e}`));

    // Search for comments or anything containing "Table" or similar in main.tex
    // Let's search for \caption of any environment
    const captionRegex = /\\caption\{([\s\S]*?)\}/gi;
    let match;
    let idx = 1;
    console.log("=== All Captions in main.tex ===");
    while ((match = captionRegex.exec(text)) !== null) {
      console.log(`Caption ${idx++}: ${match[1].trim().replace(/\s+/g, ' ')}`);
    }
  } else {
    console.log("main.tex not found.");
  }
} catch (err) {
  console.error("Error:", err);
}
