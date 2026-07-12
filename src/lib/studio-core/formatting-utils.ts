export function formatLatexCode(code: string): string {
  if (!code) return "";

  const lines = code.split('\n');
  let currentIndent = 0;
  const indentStep = '  ';

  const indentedLines = lines.map(line => {
    let trimmed = line.trim();
    if (!trimmed) return "";

    if (trimmed.startsWith('%')) {
      return indentStep.repeat(currentIndent) + trimmed;
    }

    // ── Tabular/Math Alignment: Normalize spaces around unescaped & ──
    if (trimmed.includes('&')) {
      try {
        const parts = trimmed.split(/(?<!\\)&/);
        trimmed = parts.map(p => p.trim()).join(' & ');
      } catch (err) {
        // Fallback in case of regex issues
      }
    }

    const hasBegin = /\\begin(\*)?\{/.test(trimmed);
    const hasEnd = /\\end(\*)?\{/.test(trimmed);
    const hasMathOpen = /\\\[/.test(trimmed);
    const hasMathClose = /\\\]/.test(trimmed);

    // Adjust indentation level BEFORE the line if it closes a block
    if (hasEnd && !hasBegin) {
      currentIndent = Math.max(0, currentIndent - 1);
    }
    if (hasMathClose && !hasMathOpen) {
      currentIndent = Math.max(0, currentIndent - 1);
    }

    const indent = indentStep.repeat(currentIndent);
    const result = indent + trimmed;

    // Adjust indentation level AFTER the line if it opens a block
    if (hasBegin && !hasEnd) {
      currentIndent++;
    }
    if (hasMathOpen && !hasMathClose) {
      currentIndent++;
    }

    return result;
  });

  const formattedLines = [];

  let inMathBlock = false;
  let inTable = false;
  let inFigure = false;
  let inAlgorithm = false;
  let inBib = false;

  const blockStart = (t: string) =>
    /^\\begin(\*)?\{(equation|align|multiline|gather|flalign)/.test(t) ||
    /^\\\[/.test(t) || /^\$\$/.test(t);

  const blockEnd = (t: string) =>
    /^\\end(\*)?\{(equation|align|multiline|gather|flalign)/.test(t) ||
    /^\\\]/.test(t) || /^\$\$$/.test(t);

  const isBlockCmd = (t: string) =>
    /^\\(begin|end)(\*)?\{/.test(t) ||
    /^\\(section|subsection|subsubsection|paragraph|subparagraph)/.test(t) ||
    /^\\(title|author|date|maketitle|thanks|affil)/.test(t) ||
    /^\\\['/.test(t) || /^\\\]/.test(t) ||
    /^\\(input|include|usepackage|documentclass|newcommand|renewcommand|providecommand|def)/.test(t) ||
    /^\\(label|ref|cite|bibitem|bibliography|bibliographystyle)/.test(t) ||
    /^\\(item|item\[)/.test(t);

  for (let i = 0; i < indentedLines.length; i++) {
    const line = indentedLines[i];
    const trimmed = line.trim();
    if (!trimmed) { formattedLines.push(""); continue; }

    if (blockStart(trimmed)) inMathBlock = true;
    if (/^\\begin(\*)?\{(tabular|table)/.test(trimmed)) inTable = true;
    if (/^\\begin(\*)?\{figure/.test(trimmed)) inFigure = true;
    if (/^\\begin(\*)?\{(algorithm|algorithmic)/.test(trimmed)) inAlgorithm = true;
    if (/^\\begin(\*)?\{thebibliography/.test(trimmed)) inBib = true;

    const currentIndentStr = line.match(/^\s*/)?.[0] || "";
    const shouldWrap = !isBlockCmd(trimmed) &&
      !inMathBlock && !inTable && !inFigure && !inAlgorithm && !inBib &&
      trimmed.length > 85 && !trimmed.startsWith('%');

    if (shouldWrap) {
      const words = trimmed.split(/\s+/);
      let currentLine = "";
      const outLines = [];

      for (const word of words) {
        const testLine = currentLine ? currentLine + " " + word : word;
        if ((currentIndentStr + testLine).length > 80 && currentLine) {
          outLines.push(currentIndentStr + currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) outLines.push(currentIndentStr + currentLine);
      formattedLines.push(...outLines);
    } else {
      formattedLines.push(line);
    }

    if (blockEnd(trimmed)) inMathBlock = false;
    if (/^\\end(\*)?\{(tabular|table)/.test(trimmed)) inTable = false;
    if (/^\\end(\*)?\{figure/.test(trimmed)) inFigure = false;
    if (/^\\end(\*)?\{(algorithm|algorithmic)/.test(trimmed)) inAlgorithm = false;
    if (/^\\end(\*)?\{thebibliography/.test(trimmed)) inBib = false;
  }

  const finalLines = [];
  let emptyCount = 0;

  for (const line of formattedLines) {
    if (line.trim() === "") {
      emptyCount++;
      if (emptyCount <= 2) finalLines.push(line);
    } else {
      emptyCount = 0;
      finalLines.push(line);
    }
  }

  return finalLines.join('\n');
}

export type EditorMood = 'obsidian' | 'midnight' | 'slate' | 'classic';

export const EDITOR_MOODS: Record<EditorMood, { bg: string; name: string }> = {
  obsidian: { bg: '#050505', name: 'Deep Obsidian (Pitch Black)' },
  midnight: { bg: '#0a0a1a', name: 'Astral Midnight (Deep Blue)' },
  slate: { bg: '#161920', name: 'Academic Slate (Pro)' },
  classic: { bg: '#1e1e1e', name: 'Legacy VS (Gray)' },
};
