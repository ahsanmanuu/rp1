import { DeepDocumentParser } from './src/lib/deep-parser.js';
import fs from 'fs';

const html = fs.readFileSync('scratch/raw.html', 'utf-8');
const doc = DeepDocumentParser.parse(html, [], "DenseNet201 MODIF_22 May Equations");

console.log("=== PARSED STATS ===");
console.log(doc.stats);

console.log("\n=== PARSED HEADINGS ===");
const headings = doc.body.filter((n: any) => n.type === 'heading');
headings.forEach((h: any) => {
  console.log(`- Level ${h.level}: "${h.text}"`);
});

console.log("\n=== PARSED TABLES ===");
const tables = doc.body.filter((n: any) => n.type === 'table');
tables.forEach((t: any, idx: number) => {
  console.log(`Table ${idx + 1}: Caption="${t.caption}"`);
});

console.log("\n=== PARSED FIGURES / GROUPS ===");
const figures = doc.body.filter((n: any) => n.type === 'figure' || n.type === 'figure-group');
figures.forEach((f: any, idx: number) => {
  console.log(`Figure ${idx + 1}: Type=${f.type}, Caption="${f.caption || f.text}"`);
  if (f.images) {
    f.images.forEach((img: any, sIdx: number) => {
      console.log(`  -> Subfigure ${sIdx + 1}: Src="${img.src}", Caption="${img.caption}"`);
    });
  }
});

console.log("\n=== PARSED EQUATIONS ===");
const equations = doc.body.filter((n: any) => n.type === 'equation');
console.log(`Found ${equations.length} equations.`);
equations.slice(0, 5).forEach((e: any, idx: number) => {
  console.log(`Equation ${idx + 1}: Math="${e.latex || e.text || ''}"`);
});
