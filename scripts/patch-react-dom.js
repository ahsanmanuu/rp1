import fs from 'fs';
import path from 'path';

const targetDirs = [
  path.resolve(process.cwd(), 'node_modules/next/dist/compiled/react-dom/cjs'),
  path.resolve(process.cwd(), 'node_modules/next/dist/compiled/react-dom-experimental/cjs'),
];

let totalPatched = 0;

for (const dir of targetDirs) {
  if (!fs.existsSync(dir)) continue;

  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (!file.endsWith('.development.js')) continue;

    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Fix 1: Guard null/non-object prev and next inside addObjectDiffToProperties
    const targetFunc = 'function addObjectDiffToProperties(prev, next, properties, indent) {\n      var isDeeplyEqual = !0,';
    const patchedFunc = 'function addObjectDiffToProperties(prev, next, properties, indent) {\n      if (null === prev || "object" !== typeof prev) prev = {};\n      if (null === next || "object" !== typeof next) next = {};\n      var isDeeplyEqual = !0,';

    if (content.includes(targetFunc)) {
      content = content.replace(targetFunc, patchedFunc);
      modified = true;
    }

    // Fix 2: Guard null alternate.memoizedProps in logComponentRender
    const targetCall = 'null !== props &&\n        null !== alternate &&\n        alternate.memoizedProps !== props';
    const patchedCall = 'null !== props &&\n        null !== alternate &&\n        null !== alternate.memoizedProps &&\n        alternate.memoizedProps !== props';

    if (content.includes(targetCall)) {
      content = content.replace(targetCall, patchedCall);
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`[React-DOM Patch] Patched null check in: ${file}`);
      totalPatched++;
    }
  }
}

console.log(`[React-DOM Patch] Completed. Patched ${totalPatched} files.`);
