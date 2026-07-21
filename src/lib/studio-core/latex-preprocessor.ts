import { FilePayload } from './compiler-utils';

function normalizePath(p: string): string {
  return (p || '').replace(/^\.\//, '').replace(/\\/g, '/').toLowerCase();
}

function findInFiles(files: FilePayload[], filename: string): boolean {
  const norm = normalizePath(filename);
  return files.some(f => normalizePath(f.path) === norm);
}

function findInContent(content: string, pattern: RegExp): boolean {
  return pattern.test(content);
}

const AMSMATH_LIKE = /\\usepackage\s*(?:\[[^\]]*\])?\s*\{[^}]*\b(amsmath|amssymb|amsfonts|mathtools)\b[^}]*\}/i;
const GRAPHICX_LIKE = /\\usepackage\s*(?:\[[^\]]*\])?\s*\{[^}]*\bgraphicx\b[^}]*\}/i;
const HYPERREF_LIKE = /\\usepackage\s*(?:\[[^\]]*\])?\s*\{[^}]*\bhyperref\b[^}]*\}/i;
const CLEVEREF_LIKE = /\\usepackage\s*(?:\[[^\]]*\])?\s*\{[^}]*\bcleveref\b[^}]*\}/i;
const ADJUSTBOX_LIKE = /\\usepackage\s*(?:\[[^\]]*\])?\s*\{[^}]*\badjustbox\b[^}]*\}/i;
const ALLOWDISPLAYBREAKS = /\\allowdisplaybreaks\s*/g;
const GRAPHICSPATH = /\\graphicspath\s*\{[^}]*\}/g;
const DECLARE_GRAPHICS_EXT = /\\DeclareGraphicsExtensions\s*\{[^}]*\}/g;
const INCLUDE_MAX_KEYS = /\\includegraphics\s*(?:\[[^\]]*\b(max\s*(?:width|height))\b[^\]]*\])?\s*\{/i;
const PACKAGES_REF = /\\(usepackage|RequirePackage|input)\s*(?:\[[^\]]*\])?\s*\{packages\}\s*/gi;

export interface PreprocessorResult {
  content: string;
  fixes: string[];
}

function moveAfter(main: string, cmdPattern: RegExp, afterPattern: RegExp, cmdName: string): PreprocessorResult {
  const fixes: string[] = [];
  let content = main;

  const cmdRegex = new RegExp(cmdPattern.source, 'g' + (cmdPattern.flags.includes('i') ? 'i' : ''));

  const afterMatch = content.match(afterPattern);
  if (!afterMatch || afterMatch.index === undefined) return { content, fixes };

  const insertPoint = afterMatch.index + afterMatch[0].length;

  let match;
  const found: { full: string; index: number }[] = [];
  cmdRegex.lastIndex = 0;
  while ((match = cmdRegex.exec(content)) !== null) {
    found.push({ full: match[0], index: match.index });
  }

  if (found.length === 0) return { content, fixes };

  // Collect all commands that are BEFORE the insert point
  const toMove = found.filter(c => c.index < insertPoint);
  if (toMove.length === 0) return { content, fixes };

  // Remove them in reverse order (to preserve indices)
  for (let i = toMove.length - 1; i >= 0; i--) {
    const cmd = toMove[i];
    content = content.substring(0, cmd.index) + content.substring(cmd.index + cmd.full.length);
  }

  // Insert after the afterPattern — the insert point shifted by total removed length
  const totalRemoved = toMove.reduce((sum, c) => sum + c.full.length, 0);
  const adjustedInsertPoint = insertPoint - totalRemoved;

  const beforeInsert = content.substring(0, adjustedInsertPoint);
  const afterInsert = content.substring(adjustedInsertPoint);
  const movedCmds = toMove.map(c => c.full).join('\n');
  content = beforeInsert + '\n' + movedCmds + afterInsert;

  fixes.push(`Moved ${toMove.length} ${cmdName} after its required package`);
  return { content, fixes };
}

export function preprocessLatex(
  texContent: string,
  allFiles: FilePayload[]
): PreprocessorResult {
  let content = texContent;
  const allFixes: string[] = [];

  const hasPackagesSty = findInFiles(allFiles, 'packages.sty');
  const hasPackagesTex = findInFiles(allFiles, 'packages.tex');

  // 1. Comment out \usepackage{packages}, \RequirePackage{packages}, \input{packages}
  //    if no packages.sty or packages.tex exists in the project
  if (!hasPackagesSty && !hasPackagesTex) {
    content = content.replace(PACKAGES_REF, (match) => {
      allFixes.push('Commented out missing packages.sty reference');
      return `% ${match.trim()} -- REMOVED (not found in project)`;
    });
  }

  // 2. Move \allowdisplaybreaks after amsmath
  if (ALLOWDISPLAYBREAKS.test(content) && !AMSMATH_LIKE.test(content)) {
    // No amsmath found but allowdisplaybreaks exists — inject amsmath before the first one
    const firstBreak = content.match(ALLOWDISPLAYBREAKS);
    if (firstBreak) {
      const idx = firstBreak.index!;
      const before = content.substring(0, idx);
      const after = content.substring(idx);
      content = before + '\\usepackage{amsmath}\n' + after;
      allFixes.push('Injected amsmath before \\allowdisplaybreaks');
    }
  } else if (AMSMATH_LIKE.test(content) && ALLOWDISPLAYBREAKS.test(content)) {
    // Both exist — ensure allowdisplaybreaks comes after amsmath
    const result = moveAfter(content, /\\allowdisplaybreaks\s*/g, AMSMATH_LIKE, '\\allowdisplaybreaks');
    content = result.content;
    allFixes.push(...result.fixes);
  }

  // 3. Move \graphicspath and \DeclareGraphicsExtensions after graphicx
  if (GRAPHICSPATH.test(content) && !GRAPHICX_LIKE.test(content)) {
    const first = content.match(GRAPHICSPATH);
    if (first) {
      const idx = first.index!;
      const before = content.substring(0, idx);
      const after = content.substring(idx);
      content = before + '\\usepackage{graphicx}\n' + after;
      allFixes.push('Injected graphicx before \\graphicspath');
    }
  } else if (GRAPHICX_LIKE.test(content) && GRAPHICSPATH.test(content)) {
    const result = moveAfter(content, GRAPHICSPATH, GRAPHICX_LIKE, '\\graphicspath');
    content = result.content;
    allFixes.push(...result.fixes);
  }

  if (DECLARE_GRAPHICS_EXT.test(content) && !GRAPHICX_LIKE.test(content)) {
    const first = content.match(DECLARE_GRAPHICS_EXT);
    if (first) {
      const idx = first.index!;
      const before = content.substring(0, idx);
      const after = content.substring(idx);
      content = before + '\\usepackage{graphicx}\n' + after;
      allFixes.push('Injected graphicx before \\DeclareGraphicsExtensions');
    }
  } else if (GRAPHICX_LIKE.test(content) && DECLARE_GRAPHICS_EXT.test(content)) {
    const result = moveAfter(content, DECLARE_GRAPHICS_EXT, GRAPHICX_LIKE, '\\DeclareGraphicsExtensions');
    content = result.content;
    allFixes.push(...result.fixes);
  }

  // 4. Ensure cleveref comes after hyperref
  if (CLEVEREF_LIKE.test(content) && HYPERREF_LIKE.test(content)) {
    const result = moveAfter(content, CLEVEREF_LIKE, HYPERREF_LIKE, 'cleveref');
    content = result.content;
    allFixes.push(...result.fixes);
  }

  // 5. Ensure adjustbox[export] is loaded if \includegraphics uses max width/max height keys
  if (INCLUDE_MAX_KEYS.test(content) && !ADJUSTBOX_LIKE.test(content)) {
    content = content.replace(
      /(\\documentclass\s*(?:\[[^\]]*\])?\s*\{[^}]*\})/,
      '$1\n\\PassOptionsToPackage{export}{adjustbox}\n\\usepackage{adjustbox}'
    );
    allFixes.push('Injected adjustbox[export] for \\includegraphics max width/height support');
  }

  // 6. Strip empty \DeclareGraphicsExtensions that reference nothing
  content = content.replace(/\\DeclareGraphicsExtensions\s*\{\s*\}/g, '% Removed empty \\DeclareGraphicsExtensions');

  return { content, fixes: allFixes };
}

export function preprocessProjectFiles(
  files: FilePayload[],
  mainFile: string
): { files: FilePayload[]; fixes: string[] } {
  const allFixes: string[] = [];
  const normMain = normalizePath(mainFile);

  const processed = files.map(f => {
    const ext = f.path.split('.').pop()?.toLowerCase() || '';
    if (ext !== 'tex') return f;
    if (typeof f.content !== 'string') return f;

    const result = preprocessLatex(f.content, files);
    if (result.fixes.length > 0) {
      allFixes.push(`[${f.path}] ${result.fixes.join('; ')}`);
    }
    return { ...f, content: result.content };
  });

  return { files: processed, fixes: allFixes };
}
