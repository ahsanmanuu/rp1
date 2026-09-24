import fs from 'fs';
import path from 'path';

const loaderPath = path.resolve(process.cwd(), 'node_modules/next/dist/compiled/@next/font/dist/google/loader.js');
const findFilesPath = path.resolve(process.cwd(), 'node_modules/next/dist/compiled/@next/font/dist/google/find-font-files-in-css.js');

let patched = 0;

if (fs.existsSync(loaderPath)) {
  let content = fs.readFileSync(loaderPath, 'utf8');
  const target = 'const ext = /\\.(woff|woff2|eot|ttf|otf)$/.exec(googleFontFileUrl)[1];';
  const replacement = 'const cleanUrl = String(googleFontFileUrl || "").replace(/[\'"]/g, "").split("?")[0].split("#")[0].trim(); const extMatch = /\\.(woff|woff2|eot|ttf|otf)$/i.exec(cleanUrl); const ext = extMatch ? extMatch[1] : "woff2";';
  if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(loaderPath, content, 'utf8');
    console.log('[Next-Font Patch] Patched loader.js extension extraction regex');
    patched++;
  }
}

if (fs.existsSync(findFilesPath)) {
  let content = fs.readFileSync(findFilesPath, 'utf8');
  const target = 'const googleFontFileUrl = (_b = /src: url\\((.+?)\\)/.exec(line)) === null || _b === void 0 ? void 0 : _b[1];';
  const replacement = 'let googleFontFileUrl = (_b = /src:\\s*(?:local\\([^)]+\\),\\s*)*url\\(([\'"]?)(.+?)\\1\\)/.exec(line) || /src: url\\((.+?)\\)/.exec(line)) === null || _b === void 0 ? void 0 : (_b[2] || _b[1]); if (googleFontFileUrl) googleFontFileUrl = googleFontFileUrl.replace(/[\'"]/g, "").trim();';
  if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(findFilesPath, content, 'utf8');
    console.log('[Next-Font Patch] Patched find-font-files-in-css.js URL parser');
    patched++;
  }
}

console.log(`[Next-Font Patch] Completed. Patched ${patched} files.`);
