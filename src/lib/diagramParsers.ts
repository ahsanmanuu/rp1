/* src/lib/diagramParsers.ts */

import type { NodeColor, NodeType, ConnType, Arrowhead, DiagramNode, DiagramConnection } from '@/lib/diagramTypes';

export type { NodeColor, NodeType, ConnType, Arrowhead, DiagramNode, DiagramConnection };

/**
 * Local JSON repair utility. Fixes trailing commas, raw newlines/tabs, normalized
 * single quotes to double quotes, escapes backslashes, and wraps unquoted keys.
 */
export function cleanAndParseJson(jsonStr: string): any {
  let json = jsonStr.trim();
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return JSON.parse(json);
    } catch (e) {
      if (attempt === 4) throw e;
      switch (attempt) {
        case 0:
          // Remove trailing commas in arrays/objects
          json = json.replace(/,(\s*[}\]])/g, '$1');
          break;
        case 1:
          // Remove raw newlines/tabs inside values
          json = json.replace(/\r\n?/g, ' ').replace(/\n/g, ' ').replace(/\t/g, ' ');
          break;
        case 2:
          // Normalize single quotes to double quotes safely
          json = json.replace(/:\s*'([^']*)'/g, ': "$1"').replace(/([{,]\s*)'([^']*)'(\s*:)/g, '$1"$2"$3');
          break;
        case 3:
          // Escape raw backslashes (frequent in LaTeX/LaTeXify outputs)
          json = json.replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\');
          break;
        case 4:
          // Fix unquoted keys
          json = json.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
          break;
      }
    }
  }
  throw new Error('Invalid JSON');
}

/**
 * Smart, context-aware icon guesser based on title, description, and type keywords.
 * Uses strict regular expressions with word boundaries to completely prevent false-positives
 * (e.g. "keyboard" triggers security "key" -> "lock" icon, or "business" triggers event queue "bus" -> "sync_alt").
 */
export function guessIconFromContext(title: string, description: string, type: string): string {
  const combined = `${title} ${description}`.toLowerCase();

  // Define structured regex rules with word boundaries (\b) where appropriate to ensure exact keyword matching.
  const rules = [
    // 1. Hardware / Compute Architecture (highest priority for hardware diagrams)
    { regex: /\b(cpu|processor|microprocessor|silicon|chip|chipset)\b/i, icon: 'memory' },
    { regex: /\b(ram|memory|cache|sram|dram|ddr)\b/i, icon: 'memory' },
    { regex: /\b(gpu|graphics|vga|display card|video card)\b/i, icon: 'settings_input_hdmi' },
    { regex: /\b(keyboard|mouse|mice|trackpad|touchpad|stylus|pen|joystick|gamepad|peripherals?|input-?devices?)\b/i, icon: 'keyboard' },
    { regex: /\b(monitor|screen|display|displays|projector|printer|printers|speakers?|headphones?|output-?devices?)\b/i, icon: 'desktop_windows' },
    { regex: /\b(bus|buses|motherboard|interconnect|pathways?|backplane)\b/i, icon: 'sync_alt' },

    // 2. Gateway / Networking
    { regex: /\b(gateway|router|proxy|load-?balancer|alb|elb|nginx|ingress|haproxy|envoy|reverse-?proxy)\b/i, icon: 'hub' },

    // 3. Auth & Security
    { regex: /\b(auth|login|signin|sign-?in|signup|sign-?up|logout|security|jwt|tokens?|oauth|lock|shield|keys?|password|credentials?|encryption|decryption|cryptography|keycloak|auth0)\b/i, icon: 'lock' },

    // 4. Clients / Frontends
    { regex: /\b(client|clients|browser|browsers|frontend|frontends|web|app|apps|webapp|webapps|ui|ux|dashboard|dashboards|gui|viewport|mobile|phone|tablet|desktop|spa|pwa)\b/i, icon: 'devices' },

    // 5. Databases & Storage
    { regex: /\b(db|dbs|database|databases|postgres|postgresql|mysql|mongo|mongodb|redis|cassandra|storage|sql|nosql|mariadb|sqlite|oracle|dynamodb|firestore|disks?|drives?|ssd|hdd|hard-?disk|backups?|memcached)\b/i, icon: 'database' },

    // 6. Payments & Billing
    { regex: /\b(payment|payments|stripe|billing|invoice|invoices|checkout|cards?|banks?|cash|money|paypal|transaction|transactions|ledger|finance|financial)\b/i, icon: 'payments' },

    // 7. Shopping & Commerce
    { regex: /\b(orders?|carts?|shopping|store|purchase|purchases|shop|e-?commerce)\b/i, icon: 'shopping_cart' },

    // 8. Communication & Messaging
    { regex: /\b(emails?|mail|mails|notifications?|sms|alerts?|messages?|letters?|gmail|outlook|smtp|push|notify|slack|discord)\b/i, icon: 'mail' },

    // 9. Monitoring & Logs (prevents "logic" -> Chart monitor)
    { regex: /\b(analytics|metrics?|logs?|logging|prometheus|grafana|reports?|charts?|bi|monitoring|monitor|telemetry|kibana|elasticsearch|splunk|datadog)\b/i, icon: 'monitoring' },

    // 10. Message Queues & Streaming (prevents "business" -> Queue)
    { regex: /\b(queue|queues|kafka|rabbitmq|brokers?|pubsub|events?|streams?|activemq|sqs|sns|nats|pulsar|mq|message-?queue)\b/i, icon: 'sync_alt' },

    // 11. CI/CD & Testing (prevents "greatest"/"latest" -> Build)
    { regex: /\b(builds?|compile|compiling|cicd|ci\/cd|pipelines?|github|gitlab|jenkins|tests?|testing|lint|linters?|linting|webpack|vite|rollup|gulp|grunt|actions?|circleci|travis)\b/i, icon: 'build' },

    // 12. Servers & Infrastructure (prevents environment/development -> VM)
    { regex: /\b(servers?|compute|hosts?|hosting|containers?|docker|kubernetes|k8s|pods?|vm|vms|ec2|vps|nodes?|instances?|clusters?|ecs|eks|backend|backends)\b/i, icon: 'dns' },

    // 13. API (prevents request/response -> API icon)
    { regex: /\b(api|apis|rest|graphql|webhooks?|endpoints?|grpc|soap|rpc)\b/i, icon: 'api' },

    // 14. People & Users
    { regex: /\b(users?|customers?|people|person|admins?|members?|consumers?|producers?|operators?|developers?|workers?|humans?|end-?users?)\b/i, icon: 'person' }
  ];

  for (const rule of rules) {
    if (rule.regex.test(combined)) {
      return rule.icon;
    }
  }

  const staticMap: Record<string, string> = {
    Process: 'settings',
    Decision: 'help',
    Database: 'database',
    Cloud: 'cloud',
    People: 'person',
    Business: 'business_center',
    Technical: 'dns',
    Computer: 'computer',
    Oval: 'radio_button_unchecked',
    Diamond: 'change_history',
    Parallelogram: 'label_important',
    Document: 'description',
    Hexagon: 'hexagon',
    Triangle: 'change_history',
    Square: 'crop_square',
    Swimlane: 'view_week',
    Gantt: 'calendar_today',
    UMLClass: 'domain',
    EREntity: 'table_rows',
    CircuitResistor: 'legend_toggle',
    CircuitCapacitor: 'commit',
    CircuitGround: 'vertical_align_bottom',
    CircuitSource: 'control_point',
    VennCircle: 'adjust',
    BarSegment: 'bar_chart',
    PieWedge: 'pie_chart',
    LinePoint: 'multiline_chart',
    HistogramBar: 'align_horizontal_left',
    DFDProcess: 'change_history',
    DFDDataStore: 'reorder',
    DFDExternalEntity: 'domain',
  };

  return staticMap[type] || 'settings';
}

/**
 * Ultra-robust custom regular expression parser for Mermaid flowcharts.
 * Extracts node definitions, bracket shapes, connections, labels, and auto-lays them out.
 */
export function parseMermaidRegex(source: string): { nodes: DiagramNode[]; connections: DiagramConnection[] } {
  const nodes: DiagramNode[] = [];
  const connections: DiagramConnection[] = [];
  const seenNodeIds = new Set<string>();
  const COLORS: NodeColor[] = ['blue', 'violet', 'green', 'amber', 'rose', 'indigo', 'slate'];

  const lines = source.split('\n');

  // Helper to register a node
  const registerNode = (id: string, title: string, typeContext: string) => {
    const cleanId = id.trim();
    if (!cleanId || seenNodeIds.has(cleanId)) return;
    seenNodeIds.add(cleanId);

    // Map delimiters to a rich, premium set of NodeType
    let type: NodeType = 'Process';
    const ctxClean = typeContext.replace(/<[^>]+>/g, '').toLowerCase();
    
    if (ctxClean.includes('[(') && ctxClean.includes(')]')) {
      type = 'Database';
    } else if (ctxClean.includes('((') && ctxClean.includes('))')) {
      type = 'Cloud';
    } else if (ctxClean.includes('{{') && ctxClean.includes('}}')) {
      type = 'Hexagon';
    } else if (ctxClean.includes('[/') && ctxClean.includes('/]')) {
      type = 'Parallelogram';
    } else if (ctxClean.includes('[\\') && ctxClean.includes('\\]')) {
      type = 'Parallelogram';
    } else if (ctxClean.includes('{') && ctxClean.includes('}')) {
      type = 'Decision'; // Decision maps to Diamond visually
    } else if (ctxClean.includes('(') && ctxClean.includes(')')) {
      type = 'Oval';
    } else if (ctxClean.includes('>') && ctxClean.includes(']')) {
      type = 'Triangle';
    } else if (ctxClean.includes('[') && ctxClean.includes(']')) {
      type = 'Process';
    }

    const color = COLORS[nodes.length % COLORS.length];
    const icon = guessIconFromContext(title, `Component: ${cleanId}`, type);

    nodes.push({
      id: cleanId,
      title: title.trim().replace(/^"|"$/g, '').replace(/\\n/g, ' '), // Strip quotes and newlines
      description: `Component: ${cleanId}`,
      type,
      x: 0, // will lay out later
      y: 0,
      width: 240,
      height: 120,
      color,
      icon,
    });
  };

  // Node definition extractor regex (handles all standard Mermaid node shapes)
  const nodeDefRegex = /(\w+)(?:\[\("([^"]+)"\)\]|\[\(([^)]+)\)\]|\(\("([^"]+)"\)\)|\(\(([^)]+)\)\)|\{\{"([^"]+)"\}\}|\{\{([^}]+)\}\}|\["([^"]+)"\]|\[([^\]]+)\]|\("([^"]+)"\)|\(([^)]+)\)|\{"([^"]+)"\}|\{([^}]+)\}|>["']?([^\]"'\r\n]+)["']?\]|\[\/["']?([^/]+)["']?\/\]|\[\\["']?([^\\]+)["']?\\\])/g;

  // Track lines that have been simplified (node shapes replaced by IDs)
  const simplifiedLines: string[] = [];

  // 1. First pass: extract all inline or explicit node definitions on each line
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('%%') || trimmed.startsWith('flowchart') || trimmed.startsWith('graph')) {
      continue;
    }

    // Find and register all nodes on this line, and simplify the line by replacing shape blocks with raw IDs
    let simplified = trimmed;
    const matches = [...trimmed.matchAll(nodeDefRegex)];
    for (const m of matches) {
      const fullMatchString = m[0];
      const id = m[1];
      // Title is whichever capture group succeeded
      const title = m[2] || m[3] || m[4] || m[5] || m[6] || m[7] || m[8] || m[9] || m[10] || m[11] || m[12] || m[13] || m[14] || m[15] || m[16] || id;
      
      registerNode(id, title, fullMatchString);
      
      // Replace the block with just the ID
      simplified = simplified.replace(fullMatchString, id);
    }
    simplifiedLines.push(simplified);
  }

  // 2. Second pass: parse connections from the simplified lines with high-fidelity arrow splitting
  const arrowRegex = /\s*(<-->|<==>|-->|---|==>|-\.-\->|<-.-\->|o--o|x--x)\s*(?:\|([^|]+)\|)?\s*/g;

  for (const line of simplifiedLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Split the simplified line by arrow symbols to handle multi-chain connections seamlessly (e.g. A -->|link| B --> C)
    const parts = trimmed.split(arrowRegex);
    if (parts.length < 4) continue; // Not a connection chain

    for (let i = 0; i + 3 < parts.length; i += 3) {
      const from = parts[i]?.trim();
      const arrow = parts[i+1];
      const label = parts[i+2];
      const to = parts[i+3]?.trim();

      if (from && to && arrow) {
        // Ensure nodes exist
        if (!seenNodeIds.has(from)) registerNode(from, from, '[]');
        if (!seenNodeIds.has(to)) registerNode(to, to, '[]');

        // Determine line style, thickness, arrowhead, and arrowDirection based on arrow type
        let lineStyle: 'solid' | 'dashed' | 'dotted' = 'solid';
        let thickness = 2;
        let arrowhead: Arrowhead = 'Arrow';
        let arrowDirection: 'forward' | 'backward' | 'both' | 'none' = 'forward';

        if (arrow === '<-->' || arrow === '<==>' || arrow === '<-.-->' || arrow === 'o--o' || arrow === 'x--x') {
          arrowDirection = 'both';
        } else if (arrow === '---') {
          arrowDirection = 'none';
        }

        if (arrow === '-.->' || arrow === '<-.-->' || arrow === '<-.->') {
          lineStyle = 'dashed';
        }

        if (arrow === '==>' || arrow === '<==>') {
          thickness = 4;
        }

        if (arrow === 'o--o') {
          arrowhead = 'Dot';
        } else if (arrow === 'x--x') {
          arrowhead = 'Diamond';
        }

        connections.push({
          id: `conn_${from}_${to}_${Math.random().toString(36).substr(2, 5)}`,
          from,
          to,
          type: 'Orthogonal',
          arrowhead,
          label: label ? label.trim().replace(/^"|"$/g, '') : undefined,
          lineStyle,
          arrowDirection,
          thickness,
        } as any);
      }
    }
  }

  // 4. Parse explicit style directives (e.g., style A fill:#8b5cf6) to map to premium theme colors
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('style ')) {
      const styleMatch = trimmed.match(/^style\s+(\w+)\s+(.+)$/i);
      if (styleMatch) {
        const id = styleMatch[1];
        const styleBody = styleMatch[2];
        const node = nodes.find(n => n.id === id);
        if (node) {
          const fillMatch = styleBody.match(/fill:\s*#?([a-fA-F0-9]+|\w+)/i);
          if (fillMatch) {
            const fillVal = fillMatch[1].toLowerCase();
            if (fillVal.includes('3b82f6') || fillVal.includes('blue')) node.color = 'blue';
            else if (fillVal.includes('8b5cf6') || fillVal.includes('violet') || fillVal.includes('purple')) node.color = 'violet';
            else if (fillVal.includes('10b981') || fillVal.includes('green') || fillVal.includes('emerald')) node.color = 'green';
            else if (fillVal.includes('f59e0b') || fillVal.includes('amber') || fillVal.includes('yellow') || fillVal.includes('orange')) node.color = 'amber';
            else if (fillVal.includes('f43f5e') || fillVal.includes('rose') || fillVal.includes('red')) node.color = 'rose';
            else if (fillVal.includes('6366f1') || fillVal.includes('indigo')) node.color = 'indigo';
            else if (fillVal.includes('64748b') || fillVal.includes('slate') || fillVal.includes('gray')) node.color = 'slate';
          }
        }
      }
    } else if (trimmed.startsWith('%%')) {
      // Parse custom connection type directives like %% conn_style A->B: Curved
      const connStyleMatch = trimmed.match(/%%\s*(?:conn_style|style|connection_type)\s+(\w+)\s*->\s*(\w+)\s*[:\s]\s*(\w+)/i);
      if (connStyleMatch) {
        const [, fromId, toId, styleName] = connStyleMatch;
        const found = connections.find(c => c.from === fromId && c.to === toId);
        if (found) {
          const lowerStyle = styleName.toLowerCase();
          if (lowerStyle.includes('curve') || lowerStyle.includes('round')) {
            found.type = 'Curved';
          } else if (lowerStyle.includes('elbow') || lowerStyle.includes('angle')) {
            found.type = 'Elbow';
          } else if (lowerStyle.includes('straight') || lowerStyle.includes('line')) {
            found.type = 'Straight';
          } else if (lowerStyle.includes('ortho')) {
            found.type = 'Orthogonal';
          }
        }
      }
    }
  }

  const organizedNodes = organizeDiagramLayout(nodes, connections);
  const adaptedConns = adaptConnectionsToContext(organizedNodes, connections);
  return { nodes: organizedNodes, connections: adaptedConns };
}

/**
 * Minimal Mermaid parser using @statelyai/graph with direct regular expression parser fallback.
 */
export async function parseMermaid(source: string): Promise<{nodes: DiagramNode[]; connections: DiagramConnection[]}> {
  try {
    const { fromMermaidFlowchart } = await import('@statelyai/graph/mermaid');
    const graph = fromMermaidFlowchart(source);
    
    if (graph && graph.nodes && graph.nodes.length > 0) {
      const COLORS: NodeColor[] = ['blue', 'violet', 'green', 'amber', 'rose', 'indigo', 'slate'];
      const nodes: DiagramNode[] = graph.nodes.map((n: any, i: number) => {
        const type = n.shape ? (n.shape === 'db' || n.shape === 'cylinder' ? 'Database' : n.shape === 'rhombus' || n.shape === 'diamond' ? 'Decision' : n.shape === 'circle' ? 'Cloud' : 'Process') : 'Process';
        const title = n.label ?? `Node ${i}`;
        const description = n.description ?? '';
        return {
          id: n.id ?? `node_${i}`,
          title,
          description,
          type,
          x: 100 + (i % 4) * 280,
          y: 100 + Math.floor(i / 4) * 180,
          width: 240,
          height: 120,
          color: COLORS[i % COLORS.length],
          icon: guessIconFromContext(title, description, type),
        };
      });

      // Apply explicit style directives directly to the StatelyAI parsed nodes
      const lines = source.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('style ')) {
          const styleMatch = trimmed.match(/^style\s+(\w+)\s+(.+)$/i);
          if (styleMatch) {
            const id = styleMatch[1];
            const styleBody = styleMatch[2];
            const node = nodes.find(n => n.id === id);
            if (node) {
              const fillMatch = styleBody.match(/fill:\s*#?([a-fA-F0-9]+|\w+)/i);
              if (fillMatch) {
                const fillVal = fillMatch[1].toLowerCase();
                if (fillVal.includes('3b82f6') || fillVal.includes('blue')) node.color = 'blue';
                else if (fillVal.includes('8b5cf6') || fillVal.includes('violet') || fillVal.includes('purple')) node.color = 'violet';
                else if (fillVal.includes('10b981') || fillVal.includes('green') || fillVal.includes('emerald')) node.color = 'green';
                else if (fillVal.includes('f59e0b') || fillVal.includes('amber') || fillVal.includes('yellow') || fillVal.includes('orange')) node.color = 'amber';
                else if (fillVal.includes('f43f5e') || fillVal.includes('rose') || fillVal.includes('red')) node.color = 'rose';
                else if (fillVal.includes('6366f1') || fillVal.includes('indigo')) node.color = 'indigo';
                else if (fillVal.includes('64748b') || fillVal.includes('slate') || fillVal.includes('gray')) node.color = 'slate';
              }
            }
          }
        }
      }

      const connections: DiagramConnection[] = graph.edges.map((e: any, i: number) => ({
        id: e.id ?? `conn_${i}`,
        from: e.sourceId ?? e.source ?? '',
        to: e.targetId ?? e.target ?? '',
        type: 'Orthogonal',
        arrowhead: 'Arrow',
        label: e.label || undefined,
        lineStyle: e.data?.stroke === 'dashed' ? 'dashed' : 'solid',
        arrowDirection: e.data?.arrowType === 'double' ? 'both' : (e.data?.arrowType === 'none' ? 'none' : 'forward'),
        thickness: e.data?.stroke === 'bold' ? 4 : 2,
      }));
      const organizedNodes = organizeDiagramLayout(nodes, connections);
      const adaptedConns = adaptConnectionsToContext(organizedNodes, connections);
      return { nodes: organizedNodes, connections: adaptedConns };
    }
  } catch (err) {
    console.warn('[DiagramParsers] StatelyAI parse failed, falling back to regex parser:', err);
  }

  // Fallback to our custom robust regex parser
  return parseMermaidRegex(source);
}

/**
 * PlantUML parser – extremely lightweight fallback.
 */
export async function parsePlantUML(_source: string): Promise<{nodes: DiagramNode[]; connections: DiagramConnection[]}> {
  return { nodes: [], connections: [] };
}

/**
 * Graphviz DOT parser.
 */
export async function parseGraphviz(_source: string): Promise<{nodes: DiagramNode[]; connections: DiagramConnection[]}> {
  return { nodes: [], connections: [] };
}

/**
 * D2 parser – not available in the browser.
 */
export async function parseD2(_source: string): Promise<{nodes: DiagramNode[]; connections: DiagramConnection[]}> {
  return { nodes: [], connections: [] };
}

/**
 * Excalidraw JSON.
 */
export async function parseExcalidraw(source: string): Promise<{nodes: DiagramNode[]; connections: DiagramConnection[]}> {
  try {
    const data = JSON.parse(source);
    const elements = data.elements ?? [];
    const nodes: DiagramNode[] = [];
    const connections: DiagramConnection[] = [];
    let idCounter = 0;
    for (const el of elements) {
      if (el.type === 'rectangle' || el.type === 'ellipse' || el.type === 'diamond') {
        nodes.push({
          id: el.id ?? `ex_node_${idCounter++}`,
          title: el.text ?? el.id ?? `Node ${idCounter}`,
          description: '',
          type: 'Process',
          x: el.x ?? 0,
          y: el.y ?? 0,
          width: el.width ?? 200,
          height: el.height ?? 100,
          color: 'blue',
        });
      } else if (el.type === 'arrow') {
        connections.push({
          id: el.id ?? `ex_conn_${idCounter++}`,
          from: el.startElement?.id ?? '',
          to: el.endElement?.id ?? '',
          type: 'Orthogonal',
          arrowhead: 'Arrow',
        });
      }
    }
    return { nodes, connections };
  } catch (err) {
    console.error('Excalidraw parse error', err);
    return { nodes: [], connections: [] };
  }
}

/**
 * Dispatch parser based on engine selection.
 */
export function extractCodeBlock(text: string): { code: string; engine: string | null } {
  // Match ```engine\ncode\n``` pattern
  const regex = /```\s*([a-zA-Z0-9]+)?\s*\n([\s\S]*?)\n```/g;
  const matches = [...text.matchAll(regex)];
  if (matches.length === 0) return { code: text, engine: null };
  // Return first block
  const [, engine, code] = matches[0];
  return { code: code.trim(), engine: engine ? engine.trim() : null };
}

export function getSmartIcon(title: string = '', description: string = '', type: string = ''): string {
  const text = `${title} ${description} ${type}`.toLowerCase();

  if (/auth|login|security|jwt|password|token|permission|oauth|crypto|lock|session/i.test(text)) return 'lock';
  if (/db|database|postgres|mongo|redis|sql|store|storage|repository|cache/i.test(text)) return 'database';
  if (/cloud|aws|azure|gcp|s3|cdn|hosting|serverless|lambda/i.test(text)) return 'cloud';
  if (/user|client|customer|actor|person|admin|member|profile|role/i.test(text)) return 'person';
  if (/api|gateway|service|microservice|rest|graphql|http|endpoint|route/i.test(text)) return 'api';
  if (/pay|payment|stripe|billing|card|checkout|price|invoice|cash|recharge/i.test(text)) return 'payments';
  if (/mail|email|notify|notification|sms|alert|message|push/i.test(text)) return 'mail';
  if (/queue|kafka|rabbitmq|pubsub|event|stream|broker|mq/i.test(text)) return 'sync_alt';
  if (/monitor|metric|stat|log|telemetry|analytics|dashboard|track|audit/i.test(text)) return 'monitoring';
  if (/mobile|app|phone|ios|android/i.test(text)) return 'smartphone';
  if (/web|browser|frontend|ui|page|website/i.test(text)) return 'language';
  if (/build|ci\/cd|pipeline|deploy|github|gitlab|docker|container/i.test(text)) return 'build';
  if (/settings|config|option|param|preference/i.test(text)) return 'settings';
  if (/network|wifi|dns|server|host|router|switch/i.test(text)) return 'dns';

  return '';
}

export function enrichNodeIcons(nodes: DiagramNode[]): DiagramNode[] {
  return nodes.map(node => {
    if (!node.icon || node.icon === 'settings' || node.icon === 'help' || node.icon === 'change_history') {
      const smartIcon = getSmartIcon(node.title, node.description, node.type);
      if (smartIcon) {
        return { ...node, icon: smartIcon };
      }
    }
    return node;
  });
}

/**
 * Smart, context-aware auto-layout engine to beautifully organize nodes
 * dynamically based on their diagram/chart families and connection topology.
 */
export function organizeDiagramLayout(nodes: DiagramNode[], connections: DiagramConnection[]): DiagramNode[] {
  if (nodes.length === 0) return [];

  const enrichedNodes = enrichNodeIcons(nodes);

  // Identify dominant node types to determine diagram family
  const types = enrichedNodes.map(n => n.type);
  const typeCounts = types.reduce((acc, t) => { acc[t] = (acc[t] || 0) + 1; return acc; }, {} as Record<string, number>);

  const isSwimlane = (typeCounts['Swimlane'] || 0) > 0;
  const isGantt = (typeCounts['Gantt'] || 0) > 0;
  const isVenn = (typeCounts['VennCircle'] || 0) > 0;
  const isBarChart = (typeCounts['BarSegment'] || 0) > 0;
  const isHistogram = (typeCounts['HistogramBar'] || 0) > 0;
  const isCircuit = (typeCounts['CircuitResistor'] || 0) > 0 || (typeCounts['CircuitCapacitor'] || 0) > 0 || (typeCounts['CircuitGround'] || 0) > 0 || (typeCounts['CircuitSource'] || 0) > 0;
  const isUmlOrErd = (typeCounts['UMLClass'] || 0) > 0 || (typeCounts['EREntity'] || 0) > 0;

  const arranged = enrichedNodes.map(n => ({ ...n }));

  if (isSwimlane) {
    const lanes = arranged.filter(n => n.type === 'Swimlane');
    const tasks = arranged.filter(n => n.type !== 'Swimlane');

    lanes.forEach((lane, i) => {
      lane.x = 100 + i * 360;
      lane.y = 50;
      lane.width = 320;
      lane.height = Math.max(500, 150 + tasks.length * 100);

      const laneTasks = tasks.filter((_, idx) => idx % lanes.length === i);
      laneTasks.forEach((task, tIdx) => {
        const matchingNode = arranged.find(n => n.id === task.id);
        if (matchingNode) {
          matchingNode.x = lane.x + 40;
          matchingNode.y = lane.y + 100 + tIdx * 160;
          matchingNode.width = 240;
          matchingNode.height = 100;
        }
      });
    });
    return arranged;
  }

  if (isGantt) {
    arranged.forEach((node, i) => {
      node.width = 260;
      node.height = 60;
      node.x = 100 + i * 180;
      node.y = 100 + i * 110;
    });
    return arranged;
  }

  if (isVenn) {
    const circles = arranged.filter(n => n.type === 'VennCircle');
    const others = arranged.filter(n => n.type !== 'VennCircle');

    if (circles.length === 2) {
      circles[0].x = 150; circles[0].y = 150; circles[0].width = 250; circles[0].height = 250;
      circles[1].x = 280; circles[1].y = 150; circles[1].width = 250; circles[1].height = 250;
    } else if (circles.length >= 3) {
      circles[0].x = 150; circles[0].y = 150; circles[0].width = 250; circles[0].height = 250;
      circles[1].x = 290; circles[1].y = 150; circles[1].width = 250; circles[1].height = 250;
      circles[2].x = 220; circles[2].y = 260; circles[2].width = 250; circles[2].height = 250;
      for (let i = 3; i < circles.length; i++) {
        circles[i].x = 220 + (i - 2) * 80;
        circles[i].y = 260;
        circles[i].width = 250;
        circles[i].height = 250;
      }
    } else {
      circles.forEach((c, i) => {
        c.x = 150 + i * 120; c.y = 150; c.width = 250; c.height = 250;
      });
    }

    others.forEach((n, i) => {
      n.x = 100 + i * 280;
      n.y = 550;
    });
    return arranged;
  }

  if (isBarChart) {
    const bars = arranged.filter(n => n.type === 'BarSegment');
    const others = arranged.filter(n => n.type !== 'BarSegment');

    bars.forEach((bar, i) => {
      bar.width = 60;
      const h = bar.height > 120 ? bar.height : (180 + (i % 3) * 60);
      bar.height = h;
      bar.x = 120 + i * 110;
      bar.y = 480 - h;
    });

    others.forEach((n, i) => {
      n.x = 100 + i * 280;
      n.y = 520;
    });
    return arranged;
  }

  if (isHistogram) {
    const bars = arranged.filter(n => n.type === 'HistogramBar');
    const others = arranged.filter(n => n.type !== 'HistogramBar');

    bars.forEach((bar, i) => {
      bar.width = 80;
      const h = bar.height > 120 ? bar.height : (160 + (i % 4) * 50);
      bar.height = h;
      bar.x = 100 + i * 80;
      bar.y = 480 - h;
    });

    others.forEach((n, i) => {
      n.x = 100 + i * 280;
      n.y = 520;
    });
    return arranged;
  }

  if (isCircuit) {
    const sources = arranged.filter(n => n.type === 'CircuitSource');
    const grounds = arranged.filter(n => n.type === 'CircuitGround');
    const loads = arranged.filter(n => n.type === 'CircuitResistor' || n.type === 'CircuitCapacitor');
    const others = arranged.filter(n => !n.type.startsWith('Circuit'));

    sources.forEach((src, i) => {
      src.x = 100;
      src.y = 150 + i * 150;
      src.width = 120;
      src.height = 80;
    });

    loads.forEach((ld, i) => {
      ld.width = 120;
      ld.height = 80;
      ld.x = 260 + i * 160;
      ld.y = 150;
    });

    grounds.forEach((gr, i) => {
      gr.x = 260 + i * 160;
      gr.y = 320;
      gr.width = 80;
      gr.height = 80;
    });

    others.forEach((n, i) => {
      n.x = 100 + i * 280;
      n.y = 450;
    });
    return arranged;
  }

  if (isUmlOrErd) {
    const tables = arranged.filter(n => n.type === 'UMLClass' || n.type === 'EREntity');
    const others = arranged.filter(n => n.type !== 'UMLClass' && n.type !== 'EREntity');

    tables.forEach((tbl, i) => {
      tbl.width = 240;
      tbl.height = 200;
      tbl.x = 100 + (i % 3) * 300;
      tbl.y = 100 + Math.floor(i / 3) * 260;
    });

    others.forEach((n, i) => {
      n.x = 100 + i * 280;
      n.y = 100 + Math.ceil(tables.length / 3) * 260;
    });
    return arranged;
  }

  // Build adjacency list and calculate in-degrees with cycle safety
  const adj: Record<string, string[]> = {};
  const inDegree: Record<string, number> = {};

  arranged.forEach(n => {
    adj[n.id] = [];
    inDegree[n.id] = 0;
  });

  connections.forEach(c => {
    if (adj[c.from] && inDegree[c.to] !== undefined) {
      adj[c.from].push(c.to);
      inDegree[c.to] = (inDegree[c.to] || 0) + 1;
    }
  });

  // Calculate topological levels using BFS with max-depth tracking and cycle prevention
  const levels: Record<string, number> = {};
  const rootNodes = arranged.filter(n => (inDegree[n.id] || 0) === 0);

  // If no root node (all in a cycle), pick the first node as root
  const queue: Array<{ id: string; lvl: number }> = (rootNodes.length > 0 ? rootNodes : [arranged[0]]).map(n => ({ id: n.id, lvl: 0 }));
  const visited = new Set<string>();

  queue.forEach(item => {
    levels[item.id] = 0;
    visited.add(item.id);
  });

  while (queue.length > 0) {
    const { id: curr, lvl } = queue.shift()!;
    const neighbors = adj[curr] || [];

    for (const target of neighbors) {
      const nextLvl = Math.max(levels[target] || 0, lvl + 1);
      levels[target] = nextLvl;
      if (!visited.has(target)) {
        visited.add(target);
        queue.push({ id: target, lvl: nextLvl });
      }
    }
  }

  // Handle any remaining unvisited nodes
  arranged.forEach((n, idx) => {
    if (levels[n.id] === undefined) {
      levels[n.id] = Math.floor(idx / 3);
    }
  });

  // Group nodes by level (rank)
  const levelGroups: Record<number, DiagramNode[]> = {};
  arranged.forEach(n => {
    const lvl = levels[n.id] ?? 0;
    if (!levelGroups[lvl]) levelGroups[lvl] = [];
    levelGroups[lvl].push(n);
  });

  // Layout parameters
  const NODE_W = 240;
  const NODE_H = 110;
  const GAP_X = 80;
  const GAP_Y = 100;
  const START_X = 100;
  const START_Y = 100;

  // Calculate max row width across all levels to center every row
  let maxRowWidth = 0;
  Object.values(levelGroups).forEach(group => {
    const rowW = group.length * NODE_W + (group.length - 1) * GAP_X;
    if (rowW > maxRowWidth) maxRowWidth = rowW;
  });

  // Apply centered Top-Down (TD) layout coordinates
  const sortedLevels = Object.keys(levelGroups).map(Number).sort((a, b) => a - b);
  sortedLevels.forEach(lvl => {
    const group = levelGroups[lvl];
    const rowW = group.length * NODE_W + (group.length - 1) * GAP_X;
    const offsetX = (maxRowWidth - rowW) / 2;

    group.forEach((node, colIdx) => {
      node.x = Math.round(START_X + offsetX + colIdx * (NODE_W + GAP_X));
      node.y = Math.round(START_Y + lvl * (NODE_H + GAP_Y));
      node.width = NODE_W;
      node.height = NODE_H;
    });
  });

  return arranged;
}

/**
 * Smart connection style adapter. Dynamically adjusts connection types, lineStyles,
 * arrowheads, and directions to perfectly fit shape contexts and modeling families.
 */
export function adaptConnectionsToContext(nodes: DiagramNode[], connections: DiagramConnection[]): DiagramConnection[] {
  return connections.map(conn => {
    const fromNode = nodes.find(n => n.id === conn.from);
    const toNode = nodes.find(n => n.id === conn.to);
    if (!fromNode || !toNode) return conn;

    const c = { ...conn };
    const hasExplicitType = conn.type && conn.type !== 'Orthogonal';

    // 1. Electronic Circuits schematic context
    const isCircuit = fromNode.type.startsWith('Circuit') || toNode.type.startsWith('Circuit');
    if (isCircuit) {
      if (!hasExplicitType) c.type = 'Straight';
      c.arrowhead = conn.arrowhead || 'Arrow';
      c.arrowDirection = conn.arrowDirection || 'none';
      c.thickness = conn.thickness || 2.5; // Solid wires
      return c;
    }

    // 2. Database ERD context
    const isERD = fromNode.type === 'EREntity' || toNode.type === 'EREntity';
    if (isERD) {
      if (!hasExplicitType) c.type = 'Orthogonal';
      c.arrowhead = conn.arrowhead || "Crow's Foot";
      c.arrowDirection = conn.arrowDirection || 'forward';
      c.lineStyle = conn.lineStyle || 'solid';
      return c;
    }

    // 3. Gantt timeline roadmaps
    const isGantt = fromNode.type === 'Gantt' || toNode.type === 'Gantt';
    if (isGantt) {
      if (!hasExplicitType) c.type = 'Elbow';
      c.arrowhead = conn.arrowhead || 'Arrow';
      c.arrowDirection = conn.arrowDirection || 'forward';
      c.lineStyle = conn.lineStyle || 'solid';
      return c;
    }

    // 4. UML Class models
    const isUML = fromNode.type === 'UMLClass' || toNode.type === 'UMLClass';
    if (isUML) {
      if (!hasExplicitType) c.type = 'Straight';
      c.arrowhead = conn.arrowhead || 'Arrow';
      c.lineStyle = conn.lineStyle || 'solid';
      return c;
    }

    // 5. Data Chart segments / Venn Diagrams
    const isDataChart = ['BarSegment', 'PieWedge', 'LinePoint', 'ScatterPoint', 'HistogramBar', 'VennCircle'].includes(fromNode.type) || 
                        ['BarSegment', 'PieWedge', 'LinePoint', 'ScatterPoint', 'HistogramBar', 'VennCircle'].includes(toNode.type);
    if (isDataChart) {
      if (fromNode.type === 'LinePoint' && toNode.type === 'LinePoint') {
        if (!hasExplicitType) c.type = 'Straight';
        c.arrowDirection = conn.arrowDirection || 'forward';
        c.arrowhead = conn.arrowhead || 'Arrow';
      } else {
        if (!hasExplicitType) c.type = 'Straight';
        c.arrowDirection = conn.arrowDirection || 'none';
      }
      return c;
    }

    // 6. Data Flow Diagrams (DFDs)
    const isDFD = ['DFDProcess', 'DFDDataStore', 'DFDExternalEntity'].includes(fromNode.type) ||
                  ['DFDProcess', 'DFDDataStore', 'DFDExternalEntity'].includes(toNode.type);
    if (isDFD) {
      if (!hasExplicitType) c.type = 'Curved';
      c.arrowDirection = conn.arrowDirection || 'forward';
      c.arrowhead = conn.arrowhead || 'Arrow';
      c.lineStyle = conn.lineStyle || 'solid';
      return c;
    }

    return c;
  });
}

/**
 * Regex-based JSON Rescuer. Parses fields and array blocks using direct context regex
 * patterns, acting as a high-fidelity recovery engine for corrupted or truncated JSON streams.
 */
export function rescueCorruptedJson(raw: string): any | null {
  try {
    const nodes: any[] = [];
    const connections: any[] = [];
    let explanation = 'Diagram parsed using AI rescue engine.';

    const expMatch = raw.match(/"explanation"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (expMatch) {
      explanation = expMatch[1].replace(/\\"/g, '"');
    }

    const extractField = (block: string, field: string): string => {
      const re = new RegExp(`"${field}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, 'i');
      const m = block.match(re);
      if (m) {
        return m[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
      }
      return '';
    };

    const extractNumberField = (block: string, field: string): number | undefined => {
      const re = new RegExp(`"${field}"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`, 'i');
      const m = block.match(re);
      return m ? parseFloat(m[1]) : undefined;
    };

    const blocks = raw.match(/\{\s*"id"[\s\S]*?\}/g) || [];
    const seenNodeIds = new Set<string>();

    blocks.forEach((block, idx) => {
      const id = extractField(block, 'id');
      const title = extractField(block, 'title') || extractField(block, 'id') || `Node ${idx}`;
      const isConnection = block.includes('"from"') || block.includes('"to"');

      if (id && !isConnection && !seenNodeIds.has(id)) {
        seenNodeIds.add(id);
        const description = extractField(block, 'description');
        const type = extractField(block, 'type') || 'Process';
        const color = extractField(block, 'color') || 'blue';
        const icon = extractField(block, 'icon');
        const notes = extractField(block, 'notes');
        const variant = extractField(block, 'variant');

        nodes.push({
          id,
          title,
          description,
          type,
          color,
          icon,
          notes,
          variant,
          x: extractNumberField(block, 'x'),
          y: extractNumberField(block, 'y'),
          width: extractNumberField(block, 'width'),
          height: extractNumberField(block, 'height'),
          customFill: extractField(block, 'customFill'),
          customBorderColor: extractField(block, 'customBorderColor'),
          customBorderWidth: extractNumberField(block, 'customBorderWidth'),
        });
      }
    });

    const connBlocks = raw.match(/\{\s*"from"[\s\S]*?\}/g) || raw.match(/\{\s*"id"[\s\S]*?"from"[\s\S]*?\}/g) || [];
    connBlocks.forEach((block, idx) => {
      const from = extractField(block, 'from');
      const to = extractField(block, 'to');
      if (from && to) {
        connections.push({
          id: extractField(block, 'id') || `conn_rescue_${idx}`,
          from,
          to,
          type: extractField(block, 'type') || 'Orthogonal',
          arrowhead: extractField(block, 'arrowhead') || 'Arrow',
          label: extractField(block, 'label') || undefined,
          lineStyle: extractField(block, 'lineStyle') || 'solid',
          arrowDirection: extractField(block, 'arrowDirection') || 'forward',
          thickness: extractNumberField(block, 'thickness'),
          routingOffset: extractNumberField(block, 'routingOffset'),
          routingOffsetY: extractNumberField(block, 'routingOffsetY'),
        });
      }
    });

    if (nodes.length > 0) {
      return { explanation, nodes, connections };
    }
  } catch (err) {
    console.warn('[DiagramParsers] Rescue parser failed:', err);
  }
  return null;
}

/**
 * Universal dispatcher supporting case-insensitive engines and direct JSON parsed structures.
 */
export async function parseDiagram(engine: string, source: string) {
  const norm = engine.trim().toLowerCase();

  if (norm === 'json') {
    try {
      const parsed = cleanAndParseJson(source);
      if (parsed && Array.isArray(parsed.nodes)) {
        parsed.nodes = organizeDiagramLayout(parsed.nodes, parsed.connections || []);
        parsed.connections = adaptConnectionsToContext(parsed.nodes, parsed.connections || []);
      }
      return parsed;
    } catch {
      try {
        const parsed = JSON.parse(source);
        if (parsed && Array.isArray(parsed.nodes)) {
          parsed.nodes = organizeDiagramLayout(parsed.nodes, parsed.connections || []);
          parsed.connections = adaptConnectionsToContext(parsed.nodes, parsed.connections || []);
        }
        return parsed;
      } catch {
        const rescued = rescueCorruptedJson(source);
        if (rescued && Array.isArray(rescued.nodes)) {
          rescued.nodes = organizeDiagramLayout(rescued.nodes, rescued.connections || []);
          rescued.connections = adaptConnectionsToContext(rescued.nodes, rescued.connections || []);
          return rescued;
        }
        return { nodes: [], connections: [] };
      }
    }
  }

  if (norm === 'mermaid') {
    return await parseMermaid(source);
  }

  if (norm === 'plantuml') {
    return await parsePlantUML(source);
  }

  if (norm === 'graphviz' || norm === 'dot') {
    return await parseGraphviz(source);
  }

  if (norm === 'd2') {
    return await parseD2(source);
  }

  if (norm === 'excalidraw') {
    return await parseExcalidraw(source);
  }

  return { nodes: [], connections: [] };
}
