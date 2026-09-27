// Runtime resolver for the `@/*` path alias used by the Next.js sources, so the
// scratch/compiled-ai CommonJS build can be required from plain `node` scripts.
// Install FIRST: require('./_require-hook');
const Module = require('module');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, 'compiled-ai');
const SRC = path.join(__dirname, '..', 'src');
const orig = Module._resolveFilename;

Module._resolveFilename = function (request, ...rest) {
  if (typeof request === 'string' && request.startsWith('@/')) {
    const rel = request.slice(2);
    for (const base of [path.join(OUT, rel), path.join(SRC, rel)]) {
      for (const cand of [`${base}.js`, path.join(base, 'index.js')]) {
        if (fs.existsSync(cand)) return orig.call(this, cand, ...rest);
      }
    }
  }
  return orig.call(this, request, ...rest);
};

module.exports = {};
