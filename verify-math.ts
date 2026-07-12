// Verify that mathData.filter(isDisplay).length matches what deep-parser reports
// by running the exact same DOCX parsing pipeline as upload/route.ts

const AdmZip = require('adm-zip');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

// Find the most recent glaucoma docx in uploads
const uploadsBase = path.join('public', 'uploads', 'projects');

// Try to find the docx from database
const Database = require('better-sqlite3');
const db = new Database('prisma/dev.db');

// Check the docx file for the latest project
const proj = db.prepare("SELECT id FROM Project WHERE title LIKE '%DenseNet%' OR title LIKE '%Glaucoma%' ORDER BY createdAt DESC LIMIT 1").get();
console.log('Project:', proj);

// Also check mathData inline counts from scratch
// Count m:oMathPara vs m:oMath in the original document
const originalDocxPath = fs.readdirSync('.').find((f: string) => f.endsWith('.docx') && (f.includes('DenseNet') || f.includes('Glaucoma')));
if (originalDocxPath) {
  console.log('Found DOCX:', originalDocxPath);
  const zip = new AdmZip(originalDocxPath);
  const xml = zip.readAsText('word/document.xml');
  const oMathParaCount = (xml.match(/<m:oMathPara\b/g) || []).length;
  const oMathCount = (xml.match(/<m:oMath\b/g) || []).length;
  console.log('m:oMathPara (display blocks):', oMathParaCount);
  console.log('m:oMath (all including inline):', oMathCount);
  console.log('Inline-only m:oMath:', oMathCount - oMathParaCount);
} else {
  console.log('DOCX not found in current directory');
  console.log('Files:', fs.readdirSync('.').filter((f: string) => f.endsWith('.docx')));
}

db.close();
