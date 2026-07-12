import { DeepDocumentParser } from './src/lib/deep-parser.js';
import fs from 'fs';

const html = fs.readFileSync('scratch/raw.html', 'utf-8');
const doc = DeepDocumentParser.parse(html, [], 'DenseNet201 MODIF_22 May Equations');

const equations = doc.body.filter((n: any) => n.type === 'equation');
console.log('TOTAL EQUATIONS:', equations.length);
equations.forEach((e: any, i: number) => {
  const text = (e.latex || e.text || '').slice(0, 200);
  console.log(`E${i + 1}: ${JSON.stringify(text)}`);
});

console.log('\nCITATION COUNT:', doc.stats.citationCount);
console.log('REFERENCE COUNT:', doc.stats.referenceCount);
