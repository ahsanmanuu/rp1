import Database from 'better-sqlite3';

try {
  const db = new Database('./prisma/dev.db');
  
  const projectId = 'cmovv6fbb00059kg4ya4otlpv';
  const contentRow = db.prepare("SELECT content FROM ProjectFile WHERE projectId = ? AND filename = 'main.tex'").get(projectId);
  
  if (contentRow) {
    const text = contentRow.content || "";
    const index = text.indexOf('Truth Table of the Proposed Methodology');
    if (index !== -1) {
      console.log("Found text at index:", index);
      console.log(text.substring(index - 200, index + 400));
    } else {
      console.log("Text not found.");
    }
  }
} catch (err) {
  console.error("Error:", err);
}
