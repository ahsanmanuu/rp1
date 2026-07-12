/**
 * LaTeX Structure Parser
 * Extracts sections, subsections, figures, tables, and labels from LaTeX code.
 */

export interface OutlineNode {
  type: 'section' | 'subsection' | 'subsubsection' | 'paragraph' | 'figure' | 'table' | 'label';
  label: string;
  line: number;
  level: number; // 0 for section, 1 for sub, etc.
}

/**
 * Balanced brace extraction: finds the content inside the first { } 
 * and handles nested braces.
 */
function extractBalanced(text: string, startIdx: number): string {
  let depth = 0;
  let content = '';
  for (let i = startIdx; i < text.length; i++) {
    const char = text[i];
    if (char === '{') depth++;
    else if (char === '}') {
      depth--;
      if (depth === 0) return content;
    }
    if (depth > 0 && !(char === '{' && depth === 1)) {
      content += char;
    }
  }
  return content;
}

export function parseLaTeXStructure(code: string): OutlineNode[] {
  const nodes: OutlineNode[] = [];
  const lines = code.split('\n');

  // Regexes for common structures
  // Note: We use \b to ensure we match the start of commands
  const patterns = [
    { type: 'section', regex: /\\section\*?\{/g, level: 0 },
    { type: 'subsection', regex: /\\subsection\*?\{/g, level: 1 },
    { type: 'subsubsection', regex: /\\subsubsection\*?\{/g, level: 2 },
    { type: 'paragraph', regex: /\\paragraph\*?\{/g, level: 3 },
    { type: 'figure', regex: /\\begin\{figure\}/g, level: 0 },
    { type: 'table', regex: /\\begin\{table\}/g, level: 0 },
    { type: 'label', regex: /\\label\{/g, level: 0 },
  ];

  lines.forEach((lineText, lineIdx) => {
    // Skip comments
    if (lineText.trim().startsWith('%')) return;

    patterns.forEach(p => {
      let match;
      // Use local copy of regex to avoid state issues in loop
      const regex = new RegExp(p.regex);
      while ((match = regex.exec(lineText)) !== null) {
        let label = '';
        if (p.type === 'figure' || p.type === 'table') {
          // Look ahead for caption if possible (not perfect in line-by-line)
          label = p.type.charAt(0).toUpperCase() + p.type.slice(1);
          // Try to find \caption in subsequent lines (limit 10 lines)
          for (let k = lineIdx; k < Math.min(lineIdx + 15, lines.length); k++) {
            const capMatch = /\\caption\{/g.exec(lines[k]);
            if (capMatch) {
              const capStart = lines[k].indexOf('\\caption{') + 9;
              label = `${p.type === 'figure' ? 'Fig' : 'Tab'}: ${extractBalanced(lines[k], capStart - 1)}`;
              break;
            }
          }
        } else {
          // Standard command with { }
          const startIdx = match.index + match[0].length - 1;
          label = extractBalanced(lineText, startIdx);
        }

        nodes.push({
          type: p.type as any,
          label: label || '(Untitled)',
          line: lineIdx + 1,
          level: p.level
        });
      }
    });
  });

  return nodes.sort((a, b) => a.line - b.line);
}

export function findActiveSection(nodes: OutlineNode[], currentLine: number): OutlineNode | null {
  let active: OutlineNode | null = null;
  for (const node of nodes) {
    if (node.line <= currentLine) {
      if (['section', 'subsection', 'subsubsection', 'paragraph'].includes(node.type)) {
        active = node;
      }
    } else {
      break;
    }
  }
  return active;
}
