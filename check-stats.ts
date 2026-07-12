import Database from 'better-sqlite3';
import { DeepDocumentParser } from './src/lib/deep-parser';
import * as fs from 'fs';

const db = new Database('prisma/dev.db');
const pid = 'cmpjh74qt00u5d4g4utpllrbm';
console.log('Project ID:', pid);

const project: any = db.prepare("SELECT * FROM Project WHERE id=?").get(pid);
const sc = JSON.parse(project.structuredContent);

console.log('\n--- Stored StructuredContent Stats: ---');
console.log(sc.stats);

// Re-run parsing using DeepDocumentParser.parse
const reParsed = DeepDocumentParser.parse(sc.rawHtml, sc.mathBlocks, project.originalFilename || 'Document');
console.log('\n--- Re-parsed DeepData Stats: ---');
console.log(reParsed.stats);

// Print all equation and math-containing paragraph nodes
console.log('\n--- Body Equation and Math Nodes: ---');
reParsed.body.forEach((node: any, i: number) => {
  if (node.type === 'equation') {
    console.log(`[${i}] Equation:`, node.latex || node.text);
  } else if (node.type === 'paragraph' && /MATHBLOCK/i.test(node.text || '')) {
    console.log(`[${i}] Paragraph with Math:`, node.text);
  }
});

db.close();
