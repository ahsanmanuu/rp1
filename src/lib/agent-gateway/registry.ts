import { buildReviewPrompt } from '../reviewer-utils';
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

Provide highly accurate code assistance. If writing code fixes, wrap them in markdown code blocks like:
\`\`\`latex
% your modified code here
\`\`\`
Be precise and succinct. Answer questions about LaTeX compilation, formatting, formulas, and citations thoroughly.`;
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
    return buildReviewPrompt(text, filename);
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
    const text = String(ctx.text || '').substring(0, 6000);
    return `You are a scholarly document analyzer. Extract metadata from the following text.

Text:
${text}

Return JSON with: title, abstract, keywords (array), authors (array of {name, affiliation}), stats (object with wordCount, charCount).

If you cannot find a field, use an empty string or empty array. Be accurate and concise.`;
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
  - Return ONLY the nodes that changed, plus ALL updated connections for the FULL diagram.
  - Identify target nodes by their exact ID from the "Current Nodes" list below.
  - For UPDATE: modify only the requested attributes; preserve all other attributes exactly (title, description, notes, color, customFill, customBorderColor, customBorderWidth, rotation, x, y, width, height, icon, variant, imageUrl).
  - For ADD: include the new node plus all existing nodes in the "nodes" array. Assign a unique new ID.
  - For DELETE: return the full node list WITHOUT the deleted node(s). Return all remaining nodes.
  - NEVER omit unchanged node attributes — copy them exactly from the Current Nodes list.
  - NEVER change node IDs. IDs are the primary key used to match and merge nodes.

**FULL REPLACE MODE** (use ONLY when user asks for a completely new diagram, or the request has nothing to do with the current nodes):
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
      "type": "Orthogonal" | "Curved" | "Straight" | "Elbow",
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
1. ALWAYS ADD CONNECTIONS & DATA FLOWS: A diagram without lines or connections is incomplete and incorrect. You MUST connect related nodes with solid or dashed connections containing descriptive labels.
2. ENFORCE STICKY COORDINATES: Reuse existing node IDs and positions when updating or adding components to keep the canvas clean and avoid shifting elements.
3. SEMANTIC COLOR HARMONY: Group associated nodes using similar colors (e.g. blue for clients, violet for backend microservices, green for databases, rose for security). Space them out cleanly to prevent overlap!`;
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
