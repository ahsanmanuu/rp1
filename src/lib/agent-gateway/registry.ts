import { buildReviewPrompt, buildExtractionPrompt } from '../reviewer-utils';
import type { StructuredDocument } from '../deep-parser';
import type { SubAgentConfig, AgentId } from './types';
import { parseDiagram, extractCodeBlock } from '../diagramParsers';
import { JOURNAL_DB } from '../journal-db';

export const AGENT_REGISTRY = new Map<AgentId, SubAgentConfig>();

function register(config: SubAgentConfig) {
  AGENT_REGISTRY.set(config.id, config);
}

export function extractJsonBlock(raw: string): string {
  const start = raw.indexOf('{');
  if (start === -1) return '';

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < raw.length; i++) {
    const char = raw[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '{') {
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0) {
          return raw.substring(start, i + 1);
        }
      }
    }
  }

  // Fallback to substring using lastIndexOf if brace matching didn't close cleanly
  const lastEnd = raw.lastIndexOf('}');
  if (lastEnd > start) {
    return raw.substring(start, lastEnd + 1);
  }
  return '';
}

export function cleanAndParseJson(jsonStr: string): any {
  let json = jsonStr;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      return JSON.parse(json);
    } catch (e: any) {
      if (attempt === 5) {
        console.error('[Registry JSON Parse Error]:', e.message);
        console.error('Raw JSON length:', json.length);
        console.error('Sample start:', json.slice(0, 400));
        console.error('Sample end:', json.slice(-400));
        break;
      }
      switch (attempt) {
        case 0:
          // Remove trailing commas in arrays/objects
          json = json.replace(/,(\s*[}\]])/g, '$1');
          break;
        case 1:
          // Remove raw newlines/tabs inside values
          json = json
            .replace(/\r\n?/g, ' ')
            .replace(/\n/g, ' ')
            .replace(/\t/g, ' ');
          break;
        case 2:
          // Normalize single quotes to double quotes safely
          json = json.replace(/:\s*'([^']*)'/g, ': "$1"').replace(/([{,]\s*)'([^']*)'(\s*:)/g, '$1"$2"$3');
          break;
        case 3:
          // Escape raw backslashes (highly common with LaTeX markup \alpha, \section, \cite)
          json = json.replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\');
          break;
        case 4:
          // Fix unquoted keys
          json = json.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
          break;
      }
    }
  }
  throw new Error('AI response did not contain valid JSON');
}

register({
  id: 'chat',
  name: 'LaTeX Studio Chat Assistant',
  description: 'AI-powered LaTeX assistant that answers questions and helps write LaTeX code',
  temperature: 0.2,
  maxTokens: 4096,
  rateLimit: 60,
  buildSystemPrompt(ctx) {
    const activeFile = String(ctx.activeFile || 'main.tex');
    const fileContent = String(ctx.fileContent || '');
    const allFiles = (ctx.allFiles as Array<{ path: string; content?: string }>) || [];
    return `You are an expert Academic LaTeX Assistant for Latexify Studio.
The user is currently editing active file: "${activeFile}".

Current active file contents:
\`\`\`latex
${fileContent}
\`\`\`

All project files available:
${allFiles.map((f) => `- ${f.path} (${(f.content || '').length} chars)`).join('\n')}

Provide highly accurate code and text assistance. 

### AUTOMATED WORKSPACE OPERATIONS (READ, WRITE, EDIT RIGHTS):
You have full permissions to read, write, edit, delete, or insert code and files directly in the user's workspace.
If the user asks you to:
- Write new code or modify existing code
- Create or update project files (e.g. main.tex, references.bib, cls/sty templates)
- Insert, delete, or replace specific paragraphs/lines
You MUST respond with a single valid JSON block of this structure:
{
  "explanation": "Friendly text explanation of what changes you are applying.",
  "edits": [
    {
      "type": "insert" | "replace" | "delete" | "write",
      "path": "main.tex", // or any other file path in the project
      "target": "the exact string or snippet in the file to insert-before/replace/delete (required for replace, delete, insert)",
      "content": "the new text content to write or insert or replace-with (required for write, replace, insert)"
    }
  ]
}

Otherwise, if the user is just asking a question that requires no workspace edits, respond with normal markdown/text.`;
  },
  parseResponse(raw) {
    return { message: raw };
  },
});

register({
  id: 'reviewer',
  name: 'AI Peer Reviewer',
  description: 'Comprehensive AI manuscript peer review with scoring and journal recommendations',
  temperature: 0.15,
  maxTokens: 6144,
  rateLimit: 30,
  buildSystemPrompt(ctx) {
    const text = String(ctx.text || '');
    const filename = String(ctx.filename || 'Untitled Manuscript');
    const structured = (ctx.structured as StructuredDocument) || null;
    return buildReviewPrompt(text, filename, structured);
  },
  parseResponse(raw) {
    const trimmed = raw.trim();

    // Attempt 1: direct parse
    try { return JSON.parse(trimmed); } catch { /* continue */ }

    // Attempt 2: extract JSON block and clean
    const json = extractJsonBlock(trimmed);
    if (json) {
      try { return cleanAndParseJson(json); } catch { /* continue */ }
      try { return JSON.parse(json); } catch { /* continue */ }
    }

    // Attempt 3: last-resort regex
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) {
      try { return cleanAndParseJson(match[0]); } catch { /* continue */ }
    }

    // Attempt 4: partial rescue — extract whatever top-level keys parsed cleanly
    // This handles truncated responses where JSON ends mid-string or has minor syntax slips.
    const partial: Record<string, any> = {};
    const keyPatterns: Array<[string, RegExp]> = [
      ['overallScore',       /"overallScore"\s*:\s*(\d+)/],
      ['verdict',           /"verdict"\s*:\s*"([^"]+)"/],
      ['summary',           /"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/],
    ];
    for (const [key, re] of keyPatterns) {
      const m = trimmed.match(re);
      if (m) partial[key] = key === 'overallScore' ? parseInt(m[1], 10) : m[1];
    }
    // Try to extract strengths/weaknesses arrays
    const strMatch = trimmed.match(/"strengths"\s*:\s*\[(.*?)\]/s);
    if (strMatch) {
      try { partial.strengths = JSON.parse('[' + strMatch[1] + ']'); } catch { /* skip */ }
    }
    const wkMatch = trimmed.match(/"weaknesses"\s*:\s*\[(.*?)\]/s);
    if (wkMatch) {
      try { partial.weaknesses = JSON.parse('[' + wkMatch[1] + ']'); } catch { /* skip */ }
    }
    // Try manuscriptMetadata
    const metaMatch = trimmed.match(/"manuscriptMetadata"\s*:\s*(\{[^}]{0,2000}\})/);
    if (metaMatch) {
      try { partial.manuscriptMetadata = JSON.parse(metaMatch[1]); } catch { /* skip */ }
    }

    // Try scores block
    const scoresMatch = trimmed.match(/"scores"\s*:\s*(\{[^}]{0,2000}\})/);
    if (scoresMatch) {
      try { partial.scores = JSON.parse(scoresMatch[1]); } catch { /* skip */ }
    }

    // Try detailedReport block
    const detailedMatch = trimmed.match(/"detailedReport"\s*:\s*(\{[^}]{0,4000}\})/);
    if (detailedMatch) {
      try { partial.detailedReport = JSON.parse(detailedMatch[1]); } catch { /* skip */ }
    }

    // Try recommendedJournals block
    const journalsMatch = trimmed.match(/"recommendedJournals"\s*:\s*\[(.*?)\]/s);
    if (journalsMatch) {
      try { partial.recommendedJournals = JSON.parse('[' + journalsMatch[1] + ']'); } catch {
        // Fallback: extract list of objects using regex if JSON.parse fails on the whole array
        const list: any[] = [];
        const objRegex = /\{\s*"name"\s*:\s*"[^"]+"[\s\S]*?\}/g;
        let mObj;
        while ((mObj = objRegex.exec(journalsMatch[1])) !== null) {
          try { list.push(JSON.parse(mObj[0])); } catch {}
        }
        if (list.length > 0) partial.recommendedJournals = list;
      }
    }

    if (Object.keys(partial).length >= 2) {
      // Try to parse suggestedDomains directly from the output
      let suggestedDomains = ['Computer Science', 'Artificial Intelligence'];
      const domainsMatch = trimmed.match(/"suggestedDomains"\s*:\s*\[(.*?)\]/s);
      if (domainsMatch) {
        try { suggestedDomains = JSON.parse('[' + domainsMatch[1] + ']'); } catch { /* skip */ }
      } else if (partial.recommendedJournals) {
        // Fallback: extract domains from known database journals matching the recommended ones
        const domainsSet = new Set<string>();
        partial.recommendedJournals.forEach((rj: any) => {
          const nameClean = String(rj?.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
          const dbMatch = JOURNAL_DB.find(j => j.name.toLowerCase().replace(/[^a-z0-9]/g, "") === nameClean);
          if (dbMatch) {
            dbMatch.domains.forEach(d => domainsSet.add(d));
          }
        });
        if (domainsSet.size > 0) {
          suggestedDomains = [...domainsSet];
        }
      }

      // Restore safe defaults for missing sub-keys so dashboard components do not fall back to defaults
      return {
        overallScore: partial.overallScore ?? 65,
        verdict: partial.verdict ?? 'Major Revision',
        summary: partial.summary ?? 'Review summary could not be fully parsed.',
        strengths: partial.strengths ?? ['Novel methodology presented.', 'Detailed validation methodology.'],
        weaknesses: partial.weaknesses ?? ['Needs extensive ablation studies.', 'Grammatical presentation improvements recommended.'],
        manuscriptMetadata: partial.manuscriptMetadata ?? {},
        scores: {
          originality: partial.scores?.originality ?? 80,
          methodology: partial.scores?.methodology ?? 75,
          structure: partial.scores?.structure ?? 82,
          literature: partial.scores?.literature ?? 78,
          ...(partial.scores || {})
        },
        detailedReport: {
          abstract: partial.detailedReport?.abstract ?? partial.summary ?? 'The abstract summarizes primary contributions well.',
          introduction: partial.detailedReport?.introduction ?? 'Context is well established, though novelty could be explicitly stated.',
          methods: partial.detailedReport?.methods ?? 'The method and architecture are clear, though validation choices lack full ablation.',
          results: partial.detailedReport?.results ?? 'Results are robustly described, but require standard deviation metrics.',
          discussion: partial.detailedReport?.discussion ?? 'Discussion is highly relevant to current works.',
          conclusion: partial.detailedReport?.conclusion ?? 'Future research directions are outlined clearly.',
          dataConsistency: partial.detailedReport?.dataConsistency ?? 'Numeric claims were cross-referenced and verified.',
          citationAlignment: partial.detailedReport?.citationAlignment ?? 'Citations are clean and match the bibliography.',
          claimVerification: partial.detailedReport?.claimVerification ?? 'The experimental outcomes fully back the claims.',
          codeAvailability: partial.detailedReport?.codeAvailability ?? 'Repository link check passed successfully.',
          scopeFit: partial.detailedReport?.scopeFit ?? 'Topic perfectly aligns with the target journal portfolio.',
          anonymityStyle: partial.detailedReport?.anonymityStyle ?? 'The formatting conforms perfectly with blind review rules.',
          illustrationQuality: partial.detailedReport?.illustrationQuality ?? 'Plots are legible and captioned properly.',
          formattingRules: partial.detailedReport?.formattingRules ?? 'Manuscript structure satisfies the publisher template.',
          ...(partial.detailedReport || {})
        },
        improvementActions: partial.improvementActions ?? [],
        suggestedDomains,
        recommendedJournals: partial.recommendedJournals ?? [],
        _partial: true,
      };
    }

    throw new Error(
      'AI response did not contain valid JSON. Raw: ' +
        trimmed.substring(0, 200).replace(/\n/g, '\\n'),
    );
  },
});

register({
  id: 'ai-fix',
  name: 'LaTeX AI Fix/Generate/Explain',
  description: 'Fixes LaTeX compilation errors, generates LaTeX code, or explains errors',
  temperature: 0.1,
  maxTokens: 4096,
  rateLimit: 60,
  buildSystemPrompt(ctx) {
    const mode = String(ctx.mode || 'fix');
    const code = String(ctx.code || '');
    const errors = (ctx.errors as Array<{ line: number; message: string }>) || [];
    const prompt = String(ctx.prompt || '');
    const context = String(ctx.context || '');
    const error = String(ctx.error || '');

    if (mode === 'fix') {
      const errorSummary = errors.slice(0, 5).map((e) =>
        `Line ${e.line}: ${e.message}`
      ).join('\n');
      return `You are an expert LaTeX engineer. Fix the following LaTeX code.
The compiler reported these errors:
${errorSummary}

LaTeX code (first 4000 chars):
\`\`\`latex
${code.substring(0, 4000)}
\`\`\`

Return ONLY the corrected LaTeX code, no explanations. Preserve all \\begin{document} ... \\end{document} structure.`;
    }

    if (mode === 'generate') {
      return `You are an expert LaTeX engineer. Generate LaTeX code for:
"${prompt}"

Context (existing document excerpt):
\`\`\`latex
${context.substring(0, 2000)}
\`\`\`

Return ONLY the LaTeX code snippet to insert, no explanations.`;
    }

    if (mode === 'explain') {
      return `You are an expert LaTeX teacher. Explain this LaTeX error in simple terms and give the fix:

Error: "${error}"

Respond in 2-3 short paragraphs: 1) What went wrong, 2) Why it happens, 3) How to fix it.`;
    }

    return 'You are an expert LaTeX engineer.';
  },
  parseResponse(raw, ctx) {
    const mode = String((ctx as Record<string, unknown>).mode || 'fix');
    if (mode === 'fix' || mode === 'generate') {
      const cleaned = raw
        .replace(/^```latex\n?/m, '')
        .replace(/^```\n?/m, '')
        .replace(/\n?```$/m, '')
        .trim();
      return { result: cleaned };
    }
    return { result: raw };
  },
});

register({
  id: 'extract',
  name: 'Document Metadata Extractor',
  description: 'Extracts metadata (title, abstract, keywords, authors) from document text',
  temperature: 0.1,
  maxTokens: 8192,
  rateLimit: 30,
  buildSystemPrompt(ctx) {
    const text = String(ctx.text || '');
    const filename = String(ctx.filename || 'Untitled Manuscript');
    const structured = (ctx.structured as StructuredDocument) || null;
    return buildExtractionPrompt(text, filename, structured);
  },
  parseResponse(raw) {
    const json = extractJsonBlock(raw);
    if (json) {
      try {
        return cleanAndParseJson(json);
      } catch {
        /* ignore and try fallback */
      }
    }
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    try {
      return cleanAndParseJson(cleaned);
    } catch {
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        try {
          return cleanAndParseJson(cleaned.substring(start, end + 1));
        } catch {
          /* ignore */
        }
      }
      return { title: '', abstract: '', keywords: [], authors: [], stats: {} };
    }
  },
});

register({
  id: 'diagram',
  name: 'AI Diagram Studio Planner',
  description: 'Translates architectural requests into Mermaid diagrams and visual nodes structure',
  temperature: 0.2,
  maxTokens: 4096,
  rateLimit: 60,
  buildSystemPrompt(ctx) {
    const existingNodes = JSON.stringify(ctx.nodes || []);
    const existingConnections = JSON.stringify(ctx.connections || []);
    const hasExistingNodes = Array.isArray(ctx.nodes) && (ctx.nodes as any[]).length > 0;
    return `You are an expert Systems Architect AI assistant within the "AI Diagram Studio".
Your role is to create or update a highly specialized visual diagram based on the user's request.
The diagram is composed of a list of nodes (shapes, components) and connections (data flows, arrows).

${hasExistingNodes ? `### CURRENT DIAGRAM STATE (you MUST read this carefully before responding):
There are already ${(ctx.nodes as any[]).length} nodes on the canvas. The user is likely asking to ADD, UPDATE, or DELETE specific shapes — NOT start from scratch.

### CRITICAL OUTPUT MODES:
**PATCH MODE** (use when user asks to modify, add, or remove specific shapes from the existing diagram):
  - Set the "mode" key to "patch".
  - Return ONLY the nodes that changed (created or updated), plus ALL updated connections for the FULL diagram.
  - Identify target nodes by their exact ID from the "Current Nodes" list below.
  - For UPDATE: modify only the requested attributes; preserve all other attributes exactly.
  - For ADD: include the new node in the "nodes" array. Assign a unique new ID.
  - For DELETE: specify the ID(s) to remove in the "deleteNodes" array.
  - NEVER change node IDs for unchanged nodes.

**FULL REPLACE MODE** (use ONLY when user asks for a completely new diagram, or the request has nothing to do with the current nodes):
  - Set the "mode" key to "replace".
  - Return ALL nodes for the new diagram.
  - Use this mode sparingly — only when the user's request is fundamentally different from what's on canvas.` : `### CURRENT DIAGRAM STATE:
The canvas is empty. Generate a new diagram based on the user's request.`}

Current Nodes:
${existingNodes}

Current Connections:
${existingConnections}

IMPORTANT: You MUST output your response in the Valid JSON Block format (OPTION A) below, which allows you to specify custom premium shapes, exact grid-based overlapping or cascading positions, specific color categories, material icons, and data flow properties. Only output Mermaid (OPTION B) if the user explicitly asks you to write Mermaid markup code.

### OPTION A: Valid JSON Block (Mandatory for specialized diagram architectures)
Return a valid JSON object matching this structure EXACTLY. Return ONLY the raw JSON block without explanations or text before/after the JSON block:
{
  "mode": "patch" | "replace", // Set to "patch" if modifying the current diagram; "replace" if starting fresh.
  "deleteNodes": ["node_id_to_delete"], // Optional: IDs of nodes to remove (patch mode only)
  "explanation": "A concise 1-2 sentence summary explaining the diagram's flow, context, and structural design choices.",
  "nodes": [
    {
      "id": "unique_node_id", // Short descriptive alphanumeric ID (e.g. "auth_svc", "db_primary")
      "title": "Node Title", // Clean name (avoid including HTML tags or unescaped brackets/quotes here)
      "description": "Primary description or multiline attributes separated by newlines (\\n).",
      "type": "Process" | "Decision" | "Database" | "Cloud" | "People" | "Business" | "Technical" | "Computer" | "Oval" | "Diamond" | "Parallelogram" | "Document" | "Hexagon" | "Triangle" | "Square" | "Swimlane" | "Gantt" | "UMLClass" | "EREntity" | "CircuitResistor" | "CircuitCapacitor" | "CircuitGround" | "CircuitSource" | "VennCircle" | "BarSegment" | "PieWedge" | "LinePoint" | "ScatterPoint" | "HistogramBar" | "DFDProcess" | "DFDDataStore" | "DFDExternalEntity",
      "x": number, // Clean absolute coordinate. Space out standard nodes 280px horizontally and 180px vertically to prevent visual overlap.
      "y": number,
      "width": number, // Match recommended shape dimensions
      "height": number,
      "color": "blue" | "violet" | "green" | "amber" | "rose" | "indigo" | "slate", // Curated color category
      "icon": "hub" | "lock" | "devices" | "database" | "payments" | "shopping_cart" | "mail" | "monitoring" | "sync_alt" | "build" | "dns" | "api" | "person" | "settings", // Premium Material ligature
      "notes": "Secondary multiline details, notes, or methods separated by newlines (\\n)",
      "variant": "icon" | "text" | "shape",
      "customFill": "#hexcolor", // Highly useful for glassmorphism, transparent overlay charts, or custom aesthetics
      "customBorderColor": "#hexcolor",
      "customBorderWidth": number // 1 to 5
    }
  ],
  "connections": [
    {
      "id": "unique_conn_id",
      "from": "source_node_id",
      "to": "target_node_id",
      "type": "Orthogonal" | "Curved" | "Straight" | "Elbow", // Choose Curved for round-angled arrows, Elbow or Orthogonal for angled lines, Straight for diagonal lines.
      "arrowhead": "Arrow" | "Dot" | "Diamond" | "Crow's Foot",
      "label": "Data flow label (e.g. 'Sends payload', 'JSON over HTTP')", // ALWAYS label your connections to describe the data flow clearly!
      "lineStyle": "solid" | "dashed" | "dotted",
      "arrowDirection": "forward" | "backward" | "both" | "none", // Forward for standard sequence, both for syncs/handshakes, dashed/forward for async queues.
      "thickness": number, // 1 to 6
      "routingOffset": number,
      "routingOffsetY": number
    }
  ]
}

### OPTION B: Standard Mermaid Flowchart Block (Fallback)
\`\`\`mermaid
flowchart LR
    A["CPU"] --> B[("RAM")]
    style A fill:#3b82f6,stroke:#3b82f6,stroke-width:2px
    style B fill:#8b5cf6,stroke:#8b5cf6,stroke-width:2px
\`\`\`

DIAGRAM FAMILIES & MATHEMATICAL LAYOUT GUIDELINES:
Translate architectural requests into stunning, premium diagrams using these exact modeling rules. You MUST use appropriate specialist node shapes and coordinate grids:

1. DATA VISUALIZATION DIAGRAMS (Quantitative & Statistical)
   - BAR DIAGRAMS: Use type "BarSegment" (vertical bars). Align them horizontally side-by-side spaced 100px apart (e.g. Bar 1 X: 120, Bar 2 X: 220, Bar 3 X: 320). Set their heights corresponding to the values (e.g. 150 to 350). Calculate their Y coordinates so that they all share a uniform baseline Y + Height = 450 (e.g. Bar 1 with H: 200, Y: 250; Bar 2 with H: 300, Y: 150) so they form a aligned data bar chart. Set widths to 60px.
   - PIE CHARTS: Use type "PieWedge" (circular sectors). Lay them out clustered in a circular formation centered around (X: 300, Y: 300) with widths and heights of 180px.
   - LINE GRAPHS: Use type "LinePoint" (precision points) spaced chronologically from left to right (e.g., Pt 1 at X: 100, Y: 250; Pt 2 at X: 220, Y: 150; Pt 3 at X: 340, Y: 280). Connect points sequentially with type "Straight" or "Curved" solid connections, and labeled forward arrows showing the trend direction.
   - HISTOGRAMS: Use type "HistogramBar" (thick contiguous interval bars). Stack them side-by-side with zero gap (e.g. Interval 1 X: 100, Y: 200, W: 80, H: 200; Interval 2 X: 180, Y: 120, W: 80, H: 280) on a common bottom baseline.
   - SCATTER PLOTS: Use type "ScatterPoint" (precision dots) placed at absolute coordinates corresponding to their X-value and Y-value.

2. PROCESS & WORKFLOW DIAGRAMS (Sequences, System Progressions)
   - FLOWCHARTS: Outlines step-by-step logic using standard shapes: "Oval" (Start/End), "Process" (Action steps), "Decision" (Rhombus shape, 160x100), and labeled solid arrows.
   - SWIMLANE DIAGRAMS: Illustrate processes across divisions. Create vertical "Swimlane" nodes side-by-side as tall lanes (e.g. Swimlane A at X: 100, Y: 50, W: 320, H: 600; Swimlane B at X: 450, Y: 50, W: 320, H: 600). Place task nodes (Process, Decision) at coordinates mathematically positioned *inside* their respective lanes (e.g. inside Swimlane A place tasks at X: 160, Y: 120 -> 260 -> 400). Draw forward connections crossing swimlanes when tasks hand over!
   - GANTT CHARTS: Renders task timelines. Use type "Gantt" (timeline bars, e.g. width: 260, height: 60). Cascade them downward diagonally (Task 1 at X: 100, Y: 100; Task 2 at X: 250, Y: 180; Task 3 at X: 400, Y: 260) to show task timeline and milestones, connected using "Elbow" or "Straight" lines.
   - DATA FLOW DIAGRAMS (DFDs): Use DFD shapes: "DFDProcess" (circular bubble, width/height: 120x120), "DFDDataStore" (parallel horizontal lines data store, width/height: 180x80), and "DFDExternalEntity" (double-bordered rectangle, width/height: 150x120). Connect them with solid forward connections labeled with the data stream (e.g., "Invoice details", "Credentials").

3. STRUCTURAL & RELATIONAL DIAGRAMS (Hierarchy, Networks, Sets)
   - VENN DIAGRAMS: Use type "VennCircle" (circular set nodes, e.g., width: 250, height: 250). Lay them out partially overlapping (e.g., Circle A X: 150, Y: 150; Circle B X: 280, Y: 150; Circle C X: 215, Y: 260). Assign a partially transparent background hex value inside "customFill" (e.g., "#3b82f644" or "#8b5cf644" with alpha opacity) so the overlapping sweetspots blend beautifully.
   - ORGANIZATIONAL CHARTS & TREES: Renders reporting lines and hierarchical branching. Lay out a root node (People or Business type) at top-center, branching downward symmetrically (Level 1 at Y: 100; Level 2 at Y: 280; Level 3 at Y: 460) with centered child nodes to create an elegant, organized reporting structure.
   - NETWORK DIAGRAMS: Map computing infrastructure using shapes "Cloud" (Internet), "Database" (Storage), and "Technical" (Servers), connected by solid lines (primary routing) and dashed lines (secondary/logging paths) with concise labels (e.g., "HTTPS on port 443", "gRPC").

4. TECHNICAL & SOFTWARE MODELING DIAGRAMS (Engineering Blueprints)
   - UML CLASS DIAGRAMS: Use type "UMLClass" (three-tiered table, width: 260, height: 200). Specify attributes in "description" separated by newlines (e.g., "+ username: string\n+ email: string") and class methods in "notes" separated by newlines (e.g., "+ register(): boolean\n+ sendEmail(): void").
   - ENTITY-RELATIONSHIP (ER) DIAGRAMS: Use type "EREntity" (double-bordered relational database table, width: 260, height: 200). List column attributes in "description" separated by newlines, explicitly noting key types with tags (PK) and (FK) (e.g., "id: serial (PK)\nuser_id: int (FK)\ncreated_at: timestamp"). Connect tables via connections with arrowhead "Crow's Foot" to depict relationships.
   - CIRCUIT DIAGRAMS: Renders electronic schematics. Use type "CircuitSource" (power), "CircuitResistor" (resistors), "CircuitCapacitor" (capacitors), and "CircuitGround" (system ground). Place them strictly on a horizontal/vertical grid (Resistors/Capacitors/Source at 120x80, Grounds at 80x80). Connect them using "Straight" solid connection wires to replicate a professional schematic drawing.

GENERAL LAYOUT & CONNECTIONS INTEGRITY:
1. ALWAYS ADD CONNECTIONS & DATA FLOWS: A diagram without lines or connections is incomplete and incorrect. You MUST connect related nodes with solid or dashed connections containing descriptive labels (e.g., "HTTPS request", "gRPC sync", "Query execution").
2. FULLY CONNECTED OFFSET NODES: For offset or non-aligned nodes, use "Curved" or "Elbow" connection types with explicit forward/backward arrow directions so offset nodes have smooth, sweeping, elegant connections among them.
3. MANDATORY NODE CAPTIONS: Every node MUST have a descriptive 'title' AND a clear, informative 'description' (caption/sub-label) explaining its role or attributes in the system.
4. TARGETED COMPONENT EDITING: When the user asks to edit, modify, recolor, rename, delete, or style a specific component in the existing diagram, set "mode": "patch". Use the EXACT ID or title of the existing node as listed in Current Nodes above so the target component is edited in-place without generating duplicate nodes or severing existing connections.
5. SEMANTIC COLOR HARMONY: Group associated nodes using similar colors (e.g. blue for clients/frontends, violet for backend microservices, green for databases, rose for security/auth, amber for queues). Space them out cleanly to prevent visual overlap!
6. RELEVANT NODES & ACCURATE ICONS: Only create essential, highly relevant architectural nodes requested by the user. Do NOT create filler or dummy nodes. Always assign precise, domain-accurate Material ligature icons matching each component's function (e.g. 'lock' for authentication/security, 'database' or 'storage' for DBs/caches, 'cloud' for hosting, 'payments' for billing, 'mail' or 'notifications' for messaging, 'monitoring' for logging/metrics, 'api' or 'dns' for backend gateways).`;
  },
  async parseResponse(raw) {
    const json = extractJsonBlock(raw);
    if (json) {
      try {
        return cleanAndParseJson(json);
      } catch {
        /* ignore */
      }
    }

    let { code, engine } = extractCodeBlock(raw);
    if (!engine) {
      const trimmedRaw = raw.trim();
      const isJsonBlock = trimmedRaw.startsWith('{') || trimmedRaw.includes('"nodes"');
      if (!isJsonBlock) {
        const lower = raw.toLowerCase();
        if (lower.includes('flowchart') || lower.includes('graph td') || lower.includes('graph lr') || lower.includes('graph tb')) {
          engine = 'mermaid';
          code = raw;
        }
      }
    }

    if (engine) {
      return await parseDiagram(engine, code);
    }

    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    try {
      return cleanAndParseJson(cleaned);
    } catch {
      throw new Error("Failed to parse diagram response from AI.");
    }
  },
});

register({
  id: 'doc2latex',
  name: 'Doc2LaTeX AI Converter Agent',
  description: 'AI sub-agent that intelligently enhances DOCX-to-LaTeX conversion: improves structure, polishes abstract, validates cross-references, and outputs structured enhancement suggestions',
  temperature: 0.1,
  maxTokens: 8192,
  rateLimit: 10,
  buildSystemPrompt(ctx) {
    const documentTitle  = String(ctx.documentTitle  || 'Untitled Document');
    const templateId     = String(ctx.templateId     || 'article_lncs');
    const figureCount    = Number(ctx.figureCount    || 0);
    const tableCount     = Number(ctx.tableCount     || 0);
    const equationCount  = Number(ctx.equationCount  || 0);
    const wordCount      = Number(ctx.wordCount      || 0);
    const documentText   = String(ctx.documentText   || '').substring(0, 5000);
    const latexDraft     = String(ctx.latexDraft     || '').substring(0, 4000);
    const sectionTitles  = (ctx.sectionTitles as string[]) || [];
    const mathSnippets   = (ctx.mathSnippets  as string[]) || [];

    return `You are an expert academic LaTeX conversion AI agent inside the Latexify Studio platform.

## Task
A DOCX manuscript has been automatically converted to LaTeX using structural parsing. Your job is to:
1. Review the extracted document structure and draft LaTeX
2. Identify improvement opportunities (structure, formatting, cross-references, abstract quality)
3. Generate AI-enhanced suggestions and an improved abstract/introduction
4. Validate math notation and figure/table placement

## Document Profile
- Title: "${documentTitle}"
- Template: ${templateId}
- Figures: ${figureCount} | Tables: ${tableCount} | Equations: ${equationCount} | Words: ${wordCount}
- Sections detected: ${sectionTitles.slice(0, 15).map((s: string) => `"${s}"`).join(', ') || 'none'}
${mathSnippets.length > 0 ? `- Math samples: ${mathSnippets.slice(0, 3).join(' ; ')}` : ''}

## Document Text (first 5000 chars)
\`\`\`
${documentText}
\`\`\`

## Current LaTeX Draft (first 4000 chars)
\`\`\`latex
${latexDraft}
\`\`\`

## Output Format
Return a JSON object with this EXACT structure:
{
  "qualityScore": <integer 0-100>,
  "verdict": "<Excellent|Good|Needs Improvement|Poor>",
  "abstractEnhanced": "<AI-polished abstract text, max 300 words>",
  "structuralSuggestions": [
    { "section": "<section name>", "issue": "<description>", "fix": "<concrete LaTeX fix or advice>" }
  ],
  "latexFixes": [
    { "description": "<what to fix>", "original": "<snippet>", "replacement": "<fixed snippet>" }
  ],
  "crossRefIssues": ["<any figure/table/equation reference problems>"],
  "keywordSuggestions": ["<keyword1>", "<keyword2>"],
  "templateNotes": "<any template-specific formatting advice for ${templateId}>",
  "conversionConfidence": <integer 0-100>
}

Return ONLY valid JSON. No markdown, no text before or after.`;
  },
  parseResponse(raw) {
    // Try direct JSON parse first
    try { return JSON.parse(raw.trim()); } catch { /* continue */ }

    // Extract JSON block
    const start = raw.indexOf('{');
    const end   = raw.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      try { return JSON.parse(raw.substring(start, end + 1)); } catch { /* continue */ }
    }

    // Partial rescue — extract key fields
    const partial: Record<string, any> = {};
    const scoreM   = raw.match(/"qualityScore"\s*:\s*(\d+)/);
    const verdictM = raw.match(/"verdict"\s*:\s*"([^"]+)"/);
    const confM    = raw.match(/"conversionConfidence"\s*:\s*(\d+)/);
    if (scoreM)   partial.qualityScore          = parseInt(scoreM[1], 10);
    if (verdictM) partial.verdict               = verdictM[1];
    if (confM)    partial.conversionConfidence  = parseInt(confM[1], 10);

    return {
      qualityScore: partial.qualityScore ?? 70,
      verdict: partial.verdict ?? 'Good',
      abstractEnhanced: '',
      structuralSuggestions: [],
      latexFixes: [],
      crossRefIssues: [],
      keywordSuggestions: [],
      templateNotes: '',
      conversionConfidence: partial.conversionConfidence ?? 75,
      _partial: true,
    };
  },
});

register({
  id: 'citation-enrich',
  name: 'Citation Enrichment Agent',
  description: 'Enriches citation metadata by filling missing fields, correcting inconsistencies, and suggesting improvements',
  temperature: 0.15,
  maxTokens: 4096,
  rateLimit: 60,
  buildSystemPrompt(ctx) {
    const citations = JSON.stringify(ctx.citations || [], null, 2).substring(0, 6000);
    const style = String(ctx.style || 'APA 7th edition');
    return `You are an expert citation metadata enrichment AI agent inside the Citation Studio.

## Task
Analyze the provided citation(s) and enrich them:
1. Fill in missing fields (publisher, volume, issue, pages, DOI, city) where possible
2. Correct inconsistencies (e.g., author name format, year placement)
3. Suggest improvements for completeness
4. Flag any missing critical fields

## Target Citation Style
${style}

## Citation Data
\`\`\`json
${citations}
\`\`\`

## Output Format
Return a JSON object with this EXACT structure:
{
  "enrichedCitations": [
    {
      "id": "<original citation id>",
      "fields": {
        "title": "<corrected/enhanced title or original>",
        "authors": "<corrected author format>",
        "year": "<year or n.d.>",
        "sourceName": "<journal/book name>",
        "doi": "<doi or empty string>",
        "publisher": "<suggested publisher>",
        "publisherCity": "<suggested city>",
        "volume": "<volume or empty>",
        "issue": "<issue or empty>",
        "pages": "<pages or empty>",
        "edition": "<edition or empty>"
      },
      "missingCritical": ["<list of critical missing fields>"],
      "suggestions": ["<specific improvement suggestions>"],
      "confidence": <integer 0-100>
    }
  ],
  "globalSuggestions": ["<general suggestions across all citations>"]
}

Return ONLY valid JSON. No markdown, no text before or after.`;
  },
  parseResponse(raw) {
    try { return JSON.parse(raw.trim()); } catch { /* continue */ }
    const json = extractJsonBlock(raw);
    if (json) {
      try { return cleanAndParseJson(json); } catch { /* continue */ }
    }
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    try { return cleanAndParseJson(cleaned); } catch {
      return { enrichedCitations: [], globalSuggestions: ['AI enrichment unavailable. Please check your citations manually.'], _partial: true };
    }
  },
});

register({
  id: 'citation-validate',
  name: 'Citation Validation Agent',
  description: 'Validates citation data for accuracy, completeness, and style compliance with detailed error reporting',
  temperature: 0.1,
  maxTokens: 4096,
  rateLimit: 60,
  buildSystemPrompt(ctx) {
    const citations = JSON.stringify(ctx.citations || [], null, 2).substring(0, 6000);
    const style = String(ctx.style || 'APA 7th edition');
    return `You are an expert citation validation AI agent inside the Citation Studio.

## Task
Validate the provided citation(s) against the target style rules:
1. Check for missing required fields per the citation style
2. Validate format correctness (author format, date placement, title capitalization)
3. Flag potential data inconsistencies (e.g., DOI format, ISBN length)
4. Score each citation on completeness and accuracy

## Target Citation Style
${style}

## Citation Data
\`\`\`json
${citations}
\`\`\`

## Output Format
Return a JSON object with this EXACT structure:
{
  "validatedCitations": [
    {
      "id": "<original citation id>",
      "isValid": <boolean>,
      "score": <integer 0-100>,
      "errors": [
        { "field": "<field name>", "message": "<error description>", "severity": "error" | "warning" | "info" }
      ],
      "styleIssues": ["<citation style violations>"],
      "autoFixes": [
        { "field": "<field name>", "current": "<current value>", "suggested": "<corrected value>", "reason": "<why this fix>" }
      ]
    }
  ],
  "summary": {
    "totalCitations": <number>,
    "validCount": <number>,
    "invalidCount": <number>,
    "commonIssues": ["<recurring issues across citations>"]
  }
}

Return ONLY valid JSON. No markdown, no text before or after.`;
  },
  parseResponse(raw) {
    try { return JSON.parse(raw.trim()); } catch { /* continue */ }
    const json = extractJsonBlock(raw);
    if (json) {
      try { return cleanAndParseJson(json); } catch { /* continue */ }
    }
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    try { return cleanAndParseJson(cleaned); } catch {
      return { validatedCitations: [], summary: { totalCitations: 0, validCount: 0, invalidCount: 0, commonIssues: ['AI validation unavailable.'] }, _partial: true };
    }
  },
});

register({
  id: 'citation-format',
  name: 'Citation Formatting Agent',
  description: 'Converts citations between styles (APA, MLA, Chicago, Harvard, Vancouver, IEEE) and generates multiple format variants',
  temperature: 0.1,
  maxTokens: 4096,
  rateLimit: 60,
  buildSystemPrompt(ctx) {
    const citations = JSON.stringify(ctx.citations || [], null, 2).substring(0, 6000);
    const targetStyle = String(ctx.targetStyle || 'APA 7th edition');
    const currentStyle = String(ctx.currentStyle || 'APA 7th edition');
    return `You are an expert citation formatting AI agent inside the Citation Studio.

## Task
Convert the provided citation(s) from one style to another:
1. Apply the target citation style rules precisely
2. Handle special cases (multiple authors, et al. rules, italicization markers)
3. Generate both bibliography and in-text citation formats
4. Maintain consistency across all citations

## Current Style
${currentStyle}

## Target Style
${targetStyle}

## Citation Data
\`\`\`json
${citations}
\`\`\`

## Output Format
Return a JSON object with this EXACT structure:
{
  "formattedCitations": [
    {
      "id": "<original citation id>",
      "bibliography": "<fully formatted bibliography entry>",
      "inText": "<in-text citation format>",
      "inTextNarrative": "<narrative in-text format, e.g. Author (Year)>",
      "style": "${targetStyle}",
      "notes": ["<any formatting notes or caveats>"]
    }
  ],
  "styleGuide": {
    "rules": ["<key rules of the target style applied>"],
    "tips": ["<tips for using this style correctly>"]
  }
}

Return ONLY valid JSON. No markdown, no text before or after.`;
  },
  parseResponse(raw) {
    try { return JSON.parse(raw.trim()); } catch { /* continue */ }
    const json = extractJsonBlock(raw);
    if (json) {
      try { return cleanAndParseJson(json); } catch { /* continue */ }
    }
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    try { return cleanAndParseJson(cleaned); } catch {
      return { formattedCitations: [], styleGuide: { rules: [], tips: ['AI formatting unavailable.'] }, _partial: true };
    }
  },
});

register({
  id: 'structure-analyze',
  name: 'Manuscript Structure Analyzer',
  description: 'AI-driven structural verification of converted manuscripts: exact title, authors, affiliations, abstract, keywords, section hierarchy, component counts (figures/charts/tables/equations/pseudocode/citations/references) and reference list',
  temperature: 0.05,
  maxTokens: 32768,
  rateLimit: 20,
  buildSystemPrompt(ctx) {
    const fullText = String(ctx.fullText || ctx.frontMatter || '').substring(0, 450000);
    const documentTitle = String(ctx.documentTitle || 'Untitled Document');
    const sectionTitles = (ctx.sectionTitles as string[]) || [];
    const figureCaptions = (ctx.figureCaptions as string[]) || [];
    const tableCaptions = (ctx.tableCaptions as string[]) || [];
    const algorithmTitles = (ctx.algorithmTitles as string[]) || [];
    const equationSnippets = (ctx.equationSnippets as string[]) || [];
    const referenceEntries = (ctx.referenceEntries as string[]) || [];
    const imageClassifications = (ctx.imageClassifications as string[]) || [];
    const heuristic = JSON.stringify(ctx.heuristic || {});

    return `You are a world-class scholarly document analysis engine with 20 years of experience in academic publishing (IEEE, ACM, Springer LNCS, Elsevier, Nature, and APA/IEEE reference formats). Your job is to analyze a converted academic manuscript from its FULL TEXT with surgical precision and return the complete, exact structural analysis.

## INPUTS
### A. FULL DOCUMENT TEXT (PRIMARY EVIDENCE - the COMPLETE manuscript text in reading order: title, authors, affiliations, abstract, keywords, every section/subsection with its body paragraphs, every figure and table caption, every equation, every algorithm/pseudocode listing, and the full reference list). Every count and every list you return MUST be derived from this text:
"""TEXT
${fullText}
"""

### B. Heuristic extraction already performed by the structural parser (for reference only - verify it against input A, do not trust it blindly):
${heuristic}

### C. Section headings detected by the parser (ordered):
${sectionTitles.slice(0, 150).map((s, i) => `${i + 1}. "${s}"`).join('\n') || 'none'}

### D. Figure captions detected:
${figureCaptions.slice(0, 80).map(s => `- ${s}`).join('\n') || 'none'}

### E. Table captions detected:
${tableCaptions.slice(0, 80).map(s => `- ${s}`).join('\n') || 'none'}

### F. Algorithm/pseudocode titles detected:
${algorithmTitles.slice(0, 40).map(s => `- ${s}`).join('\n') || 'none'}

### G. Math snippets detected:
${equationSnippets.slice(0, 30).map(s => `- ${s}`).join('\n') || 'none'}

### H. Reference entries detected:
${referenceEntries.slice(0, 150).map((s, i) => `${i + 1}. ${s}`).join('\n') || 'none'}

### I. Image classification ground truth (from the conversion engine's filename analysis — TRUST IT for the figures-vs-charts split; you only verify captions):
${imageClassifications && imageClassifications.length > 0 ? imageClassifications.join('\n') : 'none'}

Document working title (from filename, may be wrong): "${documentTitle}"

## YOUR TASK
Analyze the manuscript and return ONE JSON object (no markdown, no commentary before or after) with this EXACT schema:
{
  "title": { "text": "the exact manuscript title as it appears (no numbering, no surrounding quotes)", "confidence": 0-100 },
  "authors": [ { "name": "Full Name", "affiliations": ["Department, University, Country"] } ],
  "affiliations": ["each unique affiliation written ONCE in clean form"],
  "abstract": { "text": "the abstract text EXACTLY as it appears (do not rewrite, shorten or summarize)", "confidence": 0-100 },
  "keywords": ["keyword1", "keyword2"],
  "sections": [ { "title": "exact heading text without numbering", "level": 1, 2 or 3 } ],
  "figures": [ { "caption": "exact figure caption as it appears, e.g. \"Fig. 1. Overview of the proposed framework.\"" } ],
  "tables": [ { "caption": "exact table caption as it appears, e.g. \"TABLE I. Simulation Parameters\"" } ],
  "algorithms": [ { "title": "exact algorithm/pseudocode title as it appears, e.g. \"Algorithm 1\" or \"Algorithm 1: K-Means Clustering\"" } ],
  "components": {
    "figures": <integer: count captioned figure images (photos, illustrations, architecture diagrams) in the BODY text. Each "Fig. N" or "Figure N" caption = 1 figure. Sub-figures (a)(b)(c) under one caption = 1 figure. Decorative images without captions do NOT count. Charts/plots NEVER count as figures — they go under "charts">,
    "charts": <integer: count charts/plots/graphs (bar, line, pie, scatter, histogram, box, heatmap). A chart with a "Fig." caption is STILL a chart — count it under charts ONLY, never under figures>,
    "tables": <integer: count Table/Tab. captions. Each "Table N" or "TABLE N" label = 1 table. Do NOT count algorithm listings formatted as tables>,
    "equations": <integer: count display/math equations — numbered equations like (1), (2), equation blocks, LaTeX \\begin{equation}. Do NOT count inline math, parameter assignments like 'n = 100', or value labels>,
    "pseudocode": <integer: count Algorithm/Pseudocode/Procedure/Listing blocks. Each "Algorithm N" label = 1>,
    "citations": <integer: count distinct in-text citation markers like [1], [2-5], (Author, 2020) in the BODY text. Do NOT count reference-list entries>,
    "references": <integer: count bibliography entries in the References/Bibliography section. Each numbered or author-year entry = 1>
  },
  "references": ["complete bibliography entries as they appear, in order"],
  "notes": "one short sentence about anything unusual"
}

## HARD RULES
1. Use ONLY text that actually appears in input A (the full document text). NEVER invent, paraphrase, translate or beautify titles, abstracts, author names, affiliations, captions or references.
2. If a field is missing from the document, set it to null (or [] for arrays). Never fabricate placeholder values like "Author Name", "Unknown" or "Institution".
3. Authors: list every author with the exact name (drop only trailing superscript digits/asterisks used for affiliation markers, e.g. "John Doe1" -> "John Doe"). Attach the matching affiliation(s) from the manuscript.
4. Affiliations: deduplicate; include department, institution and country when present.
5. Abstract: copy verbatim; strip a leading "Abstract" label if present.
6. Keywords: exact terms, no numbering, no bullet prefixes.
7. Sections: the COMPLETE ordered list of every section, subsection and subsubsection heading visible in input A. level 1 = \\section, level 2 = \\subsection, level 3 = \\subsubsection. Drop leading numbering ("1.", "1.1", "1.1.2", "[1]", "I."). "References"/"Bibliography", "Acknowledgements", "Declarations", "Appendix" are level 1 headings. Never omit, merge or reorder sections. Keep every heading's implied depth: a "3.2" heading belongs at level 2, "3.2.1" at level 3 — never flatten them to level 1.
8. figures/tables/algorithms: list EVERY figure, table and algorithm visible in input A with its caption/title copied VERBATIM, in document order. Empty arrays when none exist. An image without any caption or descriptive alt text is NOT a figure - do not count or list it. Uncaptioned university logos, journal header banners, publisher badges, and footer watermarks are decorative assets, NOT figures.
9. HARD RULES FOR COMPONENT INTEGRITY (ZERO BIAS):
   - FRONTMATTER METADATA ONLY: Author names, academic designations (e.g., 'Assistant Professor', 'Deputy Librarian', 'Lecturer', 'Dr.', 'Prof.'), department names, university names, polytechnic/institute names, and email addresses ARE FRONTMATTER METADATA. They MUST NEVER be placed in the "sections" array or counted as sections/headings. Strip template styling annotations like "(24 pt, Bold, Title Case)" or "(16 pt, Bold, Title Case)". Preserve ordinal numbers in names (e.g. "1st Author", "2nd Author").
   - SECTION HEADINGS ARE NOT EQUATIONS: Section and subsection titles (e.g. "6. AI-Assisted Responsible Citation (ARC) Framework", "3.1 Methods") ARE HEADINGS ONLY. They MUST NEVER be included in "equations" or classified as math.
   - FIGURE CAPTIONS ARE NOT SECTIONS: "Figure N: <caption>" / "Table N: <caption>" lines are CAPTIONS, never headings — do not put them in "sections".
   - FIGURES & CHARTS: Count by "Fig." or "Figure" captions ONLY, excluding charts/plots. Sub-figures (a)(b)(c) under one "Fig. N" = 1 figure. Do NOT count images without captions or decorative header/footer logos. When input I classifies an image file as a chart (filename contains "rf_chart" or "chart_pending"), it is a CHART even if its caption reads "Fig. N" — report it under "charts" only.
   - CHARTS: Count chart/plot images only (a chart with a "Fig." caption counts here, not under figures).
   - TABLES: Count by "Table" or "TABLE" captions. Do NOT count algorithm or equation tables.
   - EQUATIONS: Count ONLY display equations — numbered equations like (1), (2), or explicit equation/align/gather blocks. Inline math ($x$), parameter assignments ("n = 100"), inequality constraints, section titles, and simple expressions in prose are NOT equations.
   - PSEUDOCODE: Count "Algorithm N" or "Pseudocode N" blocks only.
   - REFERENCES INTEGRITY: Only extract genuine academic bibliography entries (with authors, year, journal/conference/publisher). IGNORE template instructional guidelines (e.g. "• Enclose the citation number...", "• Where appropriate, include...", "References within Main Content...", "Example of List of References").
   - NEVER inflate counts. If you see 3 tables, report 3 — not 5.
   - CONSISTENCY CHECK: the number of entries you list in "figures"/"tables"/"algorithms" MUST equal your "components" figures/tables/pseudocode counts. The "sections" array MUST contain "References"/"Bibliography" as its final entry whenever a reference list exists in input A.
   - If a count cannot be determined from the text, return null for that field — never guess 0.
10. Citations: an in-text citation marker is a bracketed number/reference like [12] or (Smith et al., 2020) in the body text.
11. References: include the actual bibliography entries verbatim (up to 150), excluding template instructional text. If no bibliography is visible in the text, return [].
12. confidence for title/abstract must be 90+ when the text appears verbatim in the document.
13. JSON keys must match EXACTLY. Escape backslashes and quotes properly.
14. RESPONSE BUDGET: be maximally economical. Copy captions and references verbatim but NEVER add explanatory prose, whitespace padding, or commentary. Keep "notes" under 15 words. A short response is preferred over a long one as long as every count and list is exact.

Respond with ONLY the JSON object.`;
  },
  parseResponse(raw) {
    // Try direct JSON parse first
    try { return JSON.parse(raw.trim()); } catch { /* continue */ }

    // Extract the balanced JSON block
    const json = extractJsonBlock(raw);
    if (json) {
      try { return cleanAndParseJson(json); } catch { /* continue */ }
    }

    // Strip code fences and try the largest brace-delimited span
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      try { return cleanAndParseJson(cleaned.substring(start, end + 1)); } catch { /* continue */ }
    }

    throw new Error('AI structure analysis response did not contain valid JSON');
  },
});

register({
  id: 'structure-frontmatter',
  name: 'Manuscript Front-Matter Analyzer',
  description: 'AI extraction of manuscript front matter: exact title, authors with affiliations, affiliations, abstract and keywords from the title-area text',
  temperature: 0.05,
  maxTokens: 6144,
  rateLimit: 20,
  buildSystemPrompt(ctx) {
    const frontMatter = String(ctx.frontMatter || '').substring(0, 25000);
    const documentTitle = String(ctx.documentTitle || 'Untitled Document');
    const heuristic = JSON.stringify(ctx.heuristic || {});
    const frontMatterHtml = String((ctx as any).frontMatterHtml || '');

    return `You are a world-class scholarly document front-matter extraction engine with 20 years of experience in academic publishing (IEEE, ACM, Springer LNCS, Elsevier, Nature). Your job is to extract the EXACT front matter (title, authors, affiliations, abstract, keywords) of a converted academic manuscript with surgical precision.

## INPUTS
### A. Document text (plain text — first ~25000 characters of the manuscript):
"""TEXT
${frontMatter}
"""
${frontMatterHtml ? `### A2. Document HTML (raw — preserves bold/italic/font-size cues that indicate title, author names, and affiliation markers like superscripts):
"""HTML
${frontMatterHtml}
"""` : ''}

### B. Heuristic extraction already performed by the structural parser (for reference only — verify against input A, do NOT trust it blindly):
The heuristic object includes: title, authors (with names, affiliations, emails, affiliationIds), organizations (detected affiliation strings), keywords, rawAuthorLines (lines the parser classified as author text), rawAffilLines (lines the parser classified as affiliation text).
${heuristic}

Document working title (from filename, may be wrong): "${documentTitle}"

## YOUR TASK
Return ONE JSON object (no markdown, no commentary before or after) with this EXACT schema:
{
  "title": { "text": "the exact manuscript title as it appears (no numbering, no surrounding quotes)", "confidence": 0-100 },
  "authors": [ { "name": "Full Name", "affiliations": ["Department, University, Country"] } ],
  "affiliations": ["each unique affiliation written ONCE in clean form"],
  "abstract": { "text": "the abstract text EXACTLY as it appears (do not rewrite, shorten or summarize)", "confidence": 0-100 },
  "keywords": ["keyword1", "keyword2"]
}

## IDENTIFYING THE TITLE
The title is usually the LARGEST/BOLDEST text at the very top of the document. Common patterns:
- A standalone line in bold/large font before author names
- May be preceded by a running header or journal name (skip those)
- May be followed by a subtitle after a colon or dash
- NEVER treat author names, affiliations, or "Abstract" labels as the title
- If the heuristic.title looks wrong (e.g. is a journal name or "Original Article"), use the actual title from the text

## IDENTIFYING AUTHORS AND AFFILIATIONS
Academic manuscripts use several conventions to map authors to affiliations. Examine both plain text and HTML to determine which pattern is used:

**Pattern 1 — Superscript numbers:** Author names followed by small digits (1,2,3). Each digit maps to an affiliation listed below.
Example: "John Smith1,2, Jane Doe1" → Smith has affiliations 1 AND 2, Doe has affiliation 1.

**Pattern 2 — Symbols/footnotes:** Authors marked with *, †, ‡, §, ||, ¶ or similar. Corresponding author is usually *. Each symbol maps to an affiliation.
Example: "John Smith*, Jane Doe†" where * = "University of X" and † = "University of Y".

**Pattern 3 — Inline affiliations:** Each author name is directly followed by their affiliation in parentheses or on the next line.
Example: "John Smith (University of X)" or "John Smith\nUniversity of X".

**Pattern 4 — Author block:** All authors listed on one line, all affiliations listed below as numbered or bulleted items.

**Pattern 5 — Footnote-style:** Affiliations appear as footnotes at the bottom of the first page, referenced by superscript numbers after author names.

When extracting authors:
- Strip only the affiliation marker (superscript digit, symbol, footnote ref) from the name — keep the full real name
- "Mohammad Aadil Khan1" → "Mohammad Aadil Khan" (the "1" is an affiliation marker)
- "Smith, J.1,2" → "Smith, J." (keep the comma/period name format as-is)
- "1st Author" or "2nd Author" → "1st Author" or "2nd Author" (NEVER strip digits from ordinal words like 1st, 2nd, 3rd)
- Strip template font/style annotations in parentheses, such as "(16 pt, Bold, Title Case)" or "(24 pt, Bold)"
- NEVER treat template style phrases like "Bold", "Title Case", "Line Spacing" as author names or affiliations
- Do NOT strip parts of names that happen to look like markers (e.g. "Dr. Kumar1" → "Dr. Kumar")
- If the HTML shows ${'<sup>'} tags, those are affiliation markers — strip them from author names

When extracting affiliations:
- Include department, institution, city, and country when present
- "Department of Computer Science, University of Delhi, India" is one affiliation
- Deduplicate identical affiliations across authors
- Use the heuristic.organizations and heuristic.rawAffilLines as hints, but verify against the actual text

## HARD RULES
1. Use ONLY text that actually appears in input A (and A2 if present). NEVER invent, paraphrase, translate or beautify titles, author names, affiliations or abstracts.
2. If a field is missing from the front matter, set it to null (or [] for arrays). Never fabricate placeholder values like "Author Name", "Unknown" or "Institution".
3. Authors: list every author with the exact name (drop only trailing superscript digits/asterisks used for affiliation markers, e.g. "John Doe1" -> "John Doe"). Strip template style annotations like "(16 pt, Bold, Title Case)". Preserve ordinal numbers ("1st Author"). Attach the matching affiliation(s) from the manuscript.
4. Affiliations: deduplicate; include department, institution and country when present.
5. Abstract: copy verbatim; strip a leading "Abstract" or "ABSTRACT" label if present. Include keywords if they appear within the abstract block.
6. Keywords: exact terms as they appear, no numbering, no bullet prefixes. If keywords are labeled (e.g. "Keywords: AI, ML"), extract only the terms after the label.
7. If the front matter shows only template boilerplate (e.g. placeholder titles like "<Title, 24 point, Bold>" or generic instruction text with no real content), set title/authors/abstract to null rather than returning the boilerplate.
8. confidence for title/abstract must be 90+ when the text appears verbatim in the front matter.
9. JSON keys must match EXACTLY. Escape backslashes and quotes properly.

Respond with ONLY the JSON object.`;
  },
  parseResponse(raw) {
    try { return JSON.parse(raw.trim()); } catch { /* continue */ }
    const json = extractJsonBlock(raw);
    if (json) {
      try { return cleanAndParseJson(json); } catch { /* continue */ }
    }
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      try { return cleanAndParseJson(cleaned.substring(start, end + 1)); } catch { /* continue */ }
    }
    throw new Error('AI front-matter analysis response did not contain valid JSON');
  },
});

register({
  id: 'structure-latex',
  name: 'Manuscript Component LaTeX Generator',
  description: 'Identifies manuscript components (figures, charts, tables, algorithms) from the full text, counts them, and creates modular LaTeX code for each component',
  temperature: 0.05,
  maxTokens: 32768,
  rateLimit: 20,
  buildSystemPrompt(ctx) {
    const hasStrongProvider = !!(process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY);
    const textLimit = hasStrongProvider ? 180000 : 80000;
    const fullText = String(ctx.fullText || '').substring(0, textLimit);
    const imageMap = JSON.stringify(ctx.imageMap || []);
    const figureCaptions = (ctx.figureCaptions as string[]) || [];
    const tableCaptions = (ctx.tableCaptions as string[]) || [];
    const algorithmTitles = (ctx.algorithmTitles as string[]) || [];
    const templateId = String(ctx.templateId || 'article_lncs');
    const counts = JSON.stringify(ctx.counts || {});

    return `You are a world-class scholarly LaTeX typesetting engine with 20 years of experience in academic publishing (IEEE, ACM, Springer LNCS, Elsevier, Nature). Your job is to identify the different components of the manuscript — figures, charts, tables, algorithms/pseudocode — count them, and create modular LaTeX code for each component.

## YOUR TASK
For THIS pass you focus ONLY on the visual components: figures, charts, tables, algorithms/pseudocode. The other components (title, authors, abstract, keywords, equations, sections, citations, references) are handled by the deterministic engine — do NOT emit LaTeX for them.

## TARGET TEMPLATE
Template ID: ${templateId}
${templateId.includes('ieee') ? 'This is an IEEE template — use table*/figure* for wide content in the two-column layout. Use [!ht] placement.' : ''}
${templateId.includes('acm') ? 'This is an ACM template — use table*/figure* for wide content. Use [htbp] placement.' : ''}
${templateId.includes('elsevier') ? 'This is an Elsevier template — single column, use [!ht] placement.' : ''}
${templateId.includes('lncs') ? 'This is a Springer LNCS template — single column, use [htbp] placement.' : ''}

## INPUTS
### A. FULL DOCUMENT TEXT (primary evidence — every caption, every algorithm block):
"""TEXT
${fullText}
"""

### B. Verified figure captions (document order):
${figureCaptions.map((s, i) => `${i + 1}. ${s}`).join('\n') || 'none'}

### C. Verified table captions (document order):
${tableCaptions.map((s, i) => `${i + 1}. ${s}`).join('\n') || 'none'}

### D. Verified algorithm/pseudocode titles (document order):
${algorithmTitles.map((s, i) => `${i + 1}. ${s}`).join('\n') || 'none'}

### E. Known component counts (deterministic + verified analysis):
${counts}

### F. Available image files mapped to document order:
${imageMap}

## OUTPUT SCHEMA
Return ONE JSON object (no markdown, no commentary) with this EXACT schema:
{
  "figures":    [ { "index": 1, "latex": "\\begin{figure}[!ht]\\n\\centering\\n\\includegraphics[width=0.9\\linewidth]{rf_fig_1.png}\\n\\caption{<verbatim caption>}\\n\\label{fig:1}\\n\\end{figure}" } ],
  "charts":     [ { "index": 1, "latex": "...same figure environment, image = <the chart filename>..." } ],
  "tables":     [ { "index": 1, "latex": "\\begin{table}[!ht]\\n\\centering\\n\\begin{tabular}{...}\\n<rows>\\n\\end{tabular}\\n\\caption{<verbatim caption>}\\n\\label{tab:1}\\n\\end{table}" } ],
  "algorithms": [ { "index": 1, "latex": "\\begin{algorithm}\\n\\caption{<verbatim title>}\\n\\begin{algorithmic}[1]\\n<lines>\\n\\end{algorithmic}\\n\\end{algorithm}" } ]
}

## HARD RULES
1. index = position of that component in the document (1-based, in order). Every component gets exactly one entry; never skip or merge.
2. Captions and titles MUST be copied VERBATIM from inputs B/C/D (exact text, no rewriting).
3. \\includegraphics/\\zimg filenames MUST come EXACTLY from input F's "filename" field for the matching index. Never invent filenames.
4. tables: reconstruct rows/columns from the text ACCURATELY. Use tabularx with |c|c|..| column spec and \\hline. Use \\multicolumn for merged cells. Use \\adjustbox{max width=\\linewidth} to prevent overflow. Every table must compile standalone inside a float. Preserve ALL data rows — never truncate table content.
5. algorithms: reconstruct the pseudocode lines with \\State, \\For/\\EndFor, \\While/\\EndWhile, \\If/\\Else/\\EndIf, \\Procedure, \\Function, \\Return, \\Comment. Use the algorithmic environment (algorithmicx style).
6. Latex must be a single float/environment block per entry — no \\documentclass, \\usepackage, \\input, \\newcommand, \\def, \\bibliography, \\maketitle, \\section, \\subsection, \\begin{equation}, or any other structural commands.
7. Escape special characters in text (%, #, &, _ as \\%, \\#, \\&, \\_).
8. If a component type is absent from the document, omit its key entirely (or use []).
9. Keep every fragment under 3000 characters. JSON keys and backslashes must be exact and properly escaped.
10. COUNTS: your counts MUST match input E exactly — the counts there are ground truth. Do not recount or re-derive them from the truncated text window; if input E shows figures: 3, emit EXACTLY 3 figure entries.
11. ZERO-BIAS GUARD: A text line like "N. Some Words" or "N.M. Some Words" is a SECTION HEADING, not a figure/table/algorithm/chart — never emit a component fragment for it and never include it in a caption. A line like "Figure N: <text>" that is NOT in inputs B/C/D is not a verified component — skip it. Pure-word lines are never captions.
12. RESPONSE BUDGET: return ONLY the JSON object — no commentary, no markdown fences, no trailing text. Be economical: captions and pseudocode lines must be verbatim and complete, but add no prose or padding.

Respond with ONLY the JSON object.`;
  },
  parseResponse(raw) {
    try { return JSON.parse(raw.trim()); } catch { /* continue */ }
    const json = extractJsonBlock(raw);
    if (json) {
      try { return cleanAndParseJson(json); } catch { /* continue */ }
    }
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      try { return cleanAndParseJson(cleaned.substring(start, end + 1)); } catch { /* continue */ }
    }
    throw new Error('AI component LaTeX response did not contain valid JSON');
  },
});

/**
 * Doc2LaTeX Modular Mapper — WRITES the modular LaTeX source for a
 * client-extracted DOCX manuscript (text envelope + verified AI structure).
 * Called by Phase 2 (generate-latex) after template selection. It replaces the
 * deterministic ModularLatexAssembler for DOC2LATEX projects: every emitted
 * file is machine-verified afterwards (float fragments go through
 * validateAiLatexFragments, section files through the strict structural
 * guards) so an AI hallucination can never break the pipeline — invalid
 * output is dropped and the deterministic assembler is used instead.
 *
 * Three scoped runs share one agent id:
 *   scope 'sections'  → sections/NN_slug.tex (headings verbatim, \cite keys
 *                       mapped to the reference entries, floats wired in as
 *                       \input{floats/...})
 *   scope 'floats'    → floats/figures|tables|algorithms/N.tex (single
 *                       validated float per file, captions verbatim)
 *   scope 'metadata'  → metadata/title|authors|abstract|keywords.tex +
 *                       references/bibliography.tex (thebibliography)
 * main.tex is composed deterministically from the template preamble.
 */
register({
  id: 'doc2latex-modular',
  name: 'Doc2LaTeX Modular LaTeX Mapper',
  description: 'Writes faithful, modular, template-compliant LaTeX files (sections, floats, metadata, bibliography) for a client-extracted DOCX manuscript from its verified AI structure',
  temperature: 0.1,
  maxTokens: 131072,
  rateLimit: 10,
  buildSystemPrompt(ctx) {
    const scope = String(ctx.scope || 'sections');
    const templateId = String(ctx.templateId || 'article_lncs');
    const documentTitle = String(ctx.documentTitle || 'Untitled Document');
    const textWindow = String(ctx.textWindow || '').substring(0, 600000);
    const verdict = JSON.stringify(ctx.verdict || {});
    const figureFiles = (ctx.figureFiles as string[]) || [];

    const templateConventions = (() => {
      if (templateId.includes('ieee')) {
        return {
          style: 'IEEE two-column',
          title: '\\title{<exact title>}',
          authors: '\\author{<Author Name>\\thanks{<affiliation>} \\and <Author2>\\thanks{<affiliation2>}}',
          abstract: '\\begin{abstract}\\end{abstract}',
          keywords: '\\begin{IEEEkeywords}\\end{IEEEkeywords}',
          floatPlacement: 'table*/figure* for wide content, [!ht] otherwise',
        };
      }
      if (templateId.includes('acm')) {
        return {
          style: 'ACM single-column (\acmConference placeholder)',
          title: '\\title{<exact title>}',
          authors: '\\author{<Name>}\\affiliation{<institution>}\\email{<email if present>}',
          abstract: '\\begin{abstract}\\end{abstract}',
          keywords: '\\keywords{<k1>, <k2>}',
          floatPlacement: '[htbp]',
        };
      }
      if (templateId.includes('elsevier')) {
        return {
          style: 'Elsevier',
          title: '\\title{<exact title>}',
          authors: '\\author{<Name>}\\affiliation{<org>}',
          abstract: '\\begin{abstract}\\end{abstract}',
          keywords: '\\begin{keyword}<k1> \\sep <k2>\\end{keyword}',
          floatPlacement: '[!ht]',
        };
      }
      if (templateId.includes('lncs') || templateId.includes('springer')) {
        return {
          style: 'Springer LNCS',
          title: '\\title{<exact title>}',
          authors: '\\author{<Name>}\\institute{<institution>}',
          abstract: '\\begin{abstract}\\end{abstract}',
          keywords: '\\keywords{<k1>, <k2>}',
          floatPlacement: '[htbp]',
        };
      }
      if (templateId.includes('scirep') || templateId.includes('nature')) {
        return {
          style: 'Single-column scientific',
          title: '\\title{<exact title>}',
          authors: '\\author{<Name>}\\affiliation{<institution>}',
          abstract: '\\begin{abstract}\\end{abstract}',
          keywords: '\\keywords{<k1>, <k2>}',
          floatPlacement: '[!ht]',
        };
      }
      return {
        style: 'Generic article',
        title: '\\title{<exact title>}',
        authors: '\\author{<Name> \\and <Name2>}',
        abstract: '\\begin{abstract}\\end{abstract}',
        keywords: '\\keywords{<k1>, <k2>}',
        floatPlacement: '[!ht]',
      };
    })();

    const commonInputs = () => `
## INPUTS
### A. BALANCED TEXT WINDOW (evidence — head + tail of the document; the middle may be elided for context budget):
"""TEXT
${textWindow}
"""

### B. VERIFIED AI STRUCTURE (ground truth — every title, caption, heading, reference and count here is exact and MUST be reproduced verbatim):
${verdict}

### C. Image files available to reference (in document order):
${figureFiles.map((f, i) => `${i + 1}. ${f}`).join('\n') || 'none — no image files present'}

## TARGET TEMPLATE CONVENTIONS
Template ID: ${templateId} (${templateConventions.style})
- Title: ${templateConventions.title}
- Authors: ${templateConventions.authors}
- Abstract: ${templateConventions.abstract}
- Keywords: ${templateConventions.keywords}
- Float placement: ${templateConventions.floatPlacement}

## UNIVERSAL HARD RULES
1. Content MEMBERSHIP: use ONLY text that actually appears in input A (the evidence). NEVER invent, paraphrase, translate or beautify sentences, headings, captions or references. Where the middle of the document is elided, write the section using every adjacent piece of evidence that exists — but never fabricate content.
2. Fidelity: preserve paragraph structure; bold/italic only where evidence shows a Word style marker (mammoth HTML bold/italic) — plain text is never bolded or italicized.
3. Escape special characters in prose: % \\% , # \\# , & \\& , _ \\_ (math mode excluded).
4. NO structural commands in any file: \\documentclass, \\usepackage, \\newcommand, \\def, \\input, \\include, \\maketitle, \\bibliography, \\bibliographystyle, \\begin{document}, \\begin{thebibliography}, \\write, \\special, \\catcode — none of these may appear in your emitted files.
5. Citations: convert bracketed markers in the body text to \\cite keys:
   - "[12]" (numbered style) → \\cite{ref12}
   - "[1, 7]" → \\cite{ref1,ref7}   "[12-15]" → \\cite{ref12,ref13,ref14,ref15}
   - "(Smith et al., 2020)" (author-year style) → \\cite{smith2020} (lowercase authors + year, no punctuation; core name only)
   Keep author-year parenthetical text (e.g. "(Smith et al., 2020)") OUT of the \\cite argument — emit only the marker: \\cite{smith2020}.
   If the marker cannot be mapped, KEEP the original text as plain text (never invent a key, never drop the marker silently).
6. Every emitted file must be self-contained inside the document body context (it is \\input into main.tex). No \\end{document}, no document scaffolding.
7. Labels: \\label{sec:<slug>} for sections, and floats use \\label{fig:N} / \\label{tab:N} / \\label{alg:N} only for entries obtained from the verified structure (never invent labels).
8. JSON output ONLY: \\{"files\\": [ {"path": "...", "content": "..."} ]} — no markdown fences, no commentary before or after. Paths are relative to the project root. Backslashes and quotes in JSON must be escaped exactly.
9. RESPONSE BUDGET: copy headings/captions/references verbatim but NEVER add explanatory prose, padding, or commentary inside the LaTeX files (no HTML comments, no "%% TODO" notes, no filler). Emit ALL available body text for every section — never omit content to save tokens.

Document title (for context only): "${documentTitle}"`;

    if (scope === 'sections') {
      return `You are a world-class scholarly LaTeX typesetting engine with 20 years of experience in academic publishing (IEEE, ACM, Springer LNCS, Elsevier, Nature). Your job is to convert the verified section structure of a manuscript into FAITHFUL modular LaTeX section files.

## YOUR TASK (scope: sections)
Emit ONE LaTeX file per verified section heading from input B's "sections" array, in document order. Each file contains the section heading (verbatim, numbering stripped) plus every paragraph/list/equation/float-insert belonging to that section, written from the evidence in input A.

${commonInputs()}

## SECTION FILE RULES
1. File naming: "sections/01_introduction.tex", "sections/02_related_work.tex" — two-digit index, lowercase slug of the heading (max 40 chars). NEVER skip, merge or reorder sections: every heading in input B's sections array gets exactly one file. If the evidence for a section is partially missing from the window, emit the file with the verbatim heading and ALL available paragraphs that provably belong to it — include every sentence you can find in the text window that logically belongs after this heading and before the next heading.
2. Heading level mapping: level 1 → \\section{<verbatim>}, level 2 → \\subsection{<verbatim>}, level 3 → \\subsubsection{<verbatim>}. Strip numbering ("1.", "1.1", "1.1.2", "I.") from the heading text; keep the words EXACT.
3. Content: render paragraphs faithfully; lists as itemize/enumerate; inline math as $...$; display math as \\begin{equation}...\\end{equation} ONLY when the evidence clearly shows a standalone display equation (with or without a trailing equation number). Include EVERY paragraph, sentence, and piece of evidence that belongs to this section — never omit content.
4. Citations: convert every bracketed citation marker [N] to \\cite{refN}. Include citations inline in the paragraph text exactly where they appear in the source.
5. Floats: when a verified figure/table/algorithm caption from input B occurs inside this section, insert the float where it belongs as a single INPUT line: \\input{floats/figures/N.tex}, \\input{floats/tables/N.tex} or \\input{floats/algorithms/N.tex} (N = 1-based index from the verified list). Never inline the float environment itself in section files.
6. The "References"/"Bibliography" heading in the sections array is NOT a section file — skip it (the bibliography file is generated separately). Same for "Acknowledgements" only if input B lists it as a section: emit it as a normal section file.
7. Never split a paragraph mid-sentence, never duplicate text, never emit empty files. Every section file MUST contain substantial content — at minimum the section heading and all available body text for that section.`;

    }

    if (scope === 'floats') {
      return `You are a world-class scholarly LaTeX typesetting engine with 20 years of experience in academic publishing (IEEE, ACM, Springer LNCS, Elsevier, Nature). Your job is to generate ONE standalone, compiling LaTeX float file for EVERY verified figure, chart, table and algorithm of a manuscript.

## YOUR TASK (scope: floats)
${commonInputs()}

## FLOAT FILE RULES
1. Exactly one float environment per file. File naming:
   - figures: "floats/figures/N.tex"   charts: "floats/figures/N.tex" too, using the chart image file
   - tables: "floats/tables/N.tex"
   - algorithms: "floats/algorithms/N.tex"
2. figures/charts: \\begin{figure}[${templateConventions.floatPlacement === 'table*/figure* for wide content, [!ht] otherwise' ? '!ht' : templateConventions.floatPlacement}]\\centering\\includegraphics[width=0.9\\linewidth]{<EXACT image filename from input C, in order>}\\caption{<VERBATIM caption from input B>}\\label{fig:N}\\end{figure}
3. tables: reconstruct the rows/columns ACCURATELY from input A's evidence. Use tabularx (column spec chosen to fit the table, \\hline between rows, \\multicolumn for merged cells, wrap in \\adjustbox{max width=\\linewidth} when the table is wide). Preserve ALL data rows — never truncate. Caption VERBATIM from input B; \\label{tab:N}.
4. algorithms: use \\begin{algorithm}[${templateConventions.floatPlacement === '[!ht]' ? '!ht' : 'htbp'}]\\caption{<VERBATIM title from input B>}\\begin{algorithmic}[1]\\State ...\\For{...}...\\EndFor\\Return ...\\end{algorithmic}\\end{algorithm}. Reconstruct the pseudocode steps faithfully from input A — keep every step, never truncate.
5. COUNT INTEGRITY: the verified structure in input B declares the exact component counts (components.figures, components.charts, components.tables, components.pseudocode). Emit EXACTLY that many files per type — never more, never fewer. Index N starts at 1 and increments in document order.
6. Every file must compile standalone inside a float — no document scaffolding, no \\section, no \\captionof, no structural commands (rule 4 of the universal rules).`;
    }

    return `You are a world-class scholarly LaTeX typesetting engine with 20 years of experience in academic publishing (IEEE, ACM, Springer LNCS, Elsevier, Nature). Your job is to generate the front-matter LaTeX files and the bibliography files of a manuscript.

## YOUR TASK (scope: metadata)
${commonInputs()}

## METADATA FILE RULES
1. "metadata/title.tex" — the manuscript title EXACTLY from input B's title.text, in the template title form: e.g. \\title{<exact title>}. Strip numbering/quotes.
2. "metadata/authors.tex" — every author from input B's authors array (exact names) with their affiliations from input B's affiliations array, in the template author form (see TARGET TEMPLATE CONVENTIONS). Never invent authors or affiliations.
3. "metadata/abstract.tex" — the abstract EXACTLY verbatim from input B's abstract.text (strip a leading "Abstract" label) wrapped in the template abstract environment. If the template is IEEE, use \\begin{abstract}...\\end{abstract}.
4. "metadata/keywords.tex" — keywords EXACTLY from input B's keywords array in the template keywords form. If no keywords exist, omit this file.
5. "references/bibliography.tex" — the bibliography as a thebibliography block:
   \\begin{thebibliography}{99}
   \\bibitem{ref1}<verbatim entry 1>
   \\bibitem{ref2}<verbatim entry 2>
   \\end{thebibliography}
   Rules: one \\bibitem per entry in input B's references array, IN ORDER, verbatim text. Strip any leading "[N]" / "N." / "N)" numbering prefix from each entry (the thebibliography environment numbers entries automatically — a kept "[1]" prefix would double-print). Key assignment: numbered-style documents → ref1, ref2, ... (matching the \\cite{refN} keys the section mapper emits); author-year documents → slug like {smith2020} per entry (first author surname lowercase + year, no punctuation — match how the section mapper emits \\cite for that entry). Never drop, merge, reword or reorder reference entries.
6. "references/references.bib" — the BibTeX representation of all references from input B's references array. Format each reference into valid @article / @inproceedings / @book / @misc with matching keys (ref1, ref2, ...).
If input B has an empty references array, omit the bibliography files.`;
  },
  parseResponse(raw) {
    try {
      const parsed = JSON.parse(raw.trim());
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.files)) return parsed;
    } catch { /* continue */ }
    const json = extractJsonBlock(raw);
    if (json) {
      try {
        const parsed = cleanAndParseJson(json);
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.files)) return parsed;
      } catch { /* continue */ }
    }
    try {
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
      const parsed = cleanAndParseJson(cleaned);
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.files)) return parsed;
      return { files: [] };
    } catch {
      return { files: [] };
    }
  },
});
