/**
 * useDiagramAgent
 *
 * Custom React hook that connects the AI Diagram Studio chat panel to the
 * master Agent Gateway streaming endpoint (/api/diagrams/stream).
 *
 * Flow:
 *   1.  User types a message → sendMessage() called
 *   2.  Hook opens an SSE connection to /api/diagrams/stream
 *   3.  LLM tokens arrive incrementally → accumulated in rawBufferRef
 *   4.  After each token we attempt to parse the accumulated buffer as JSON
 *       (using the same extractJsonBlock + cleanAndParseJson helpers from the registry)
 *   5.  As soon as we can parse a complete "nodes" array, each node is added
 *       to the canvas one-by-one with a staggered delay → smooth animated assembly
 *   6.  When the "done" SSE event fires, connections are applied and the final
 *       explanation is pushed to the chat history
 *   7.  Everything is auto-saved via the debouncedSave callback
 *
 * Returns:
 *   { sendMessage, stopStreaming, status, streamingText, lastExplanation }
 */



import { useCallback, useEffect, useRef, useState } from 'react';
import { extractCodeBlock, parseDiagram, guessIconFromContext, organizeDiagramLayout, adaptConnectionsToContext, rescueCorruptedJson } from "../lib/diagramParsers";
import type { DiagramNode, DiagramConnection, NodeColor, NodeType, ConnType, Arrowhead } from '@/lib/diagramTypes';

export type AgentStatus =
  | 'idle'
  | 'connecting'
  | 'streaming'
  | 'applying'
  | 'done'
  | 'error'
  | 'aborted';

// ─── JSON extraction helpers (client-side mirror) ─────────────────────────────

function extractJsonBlock(raw: string): string {
  const start = raw.indexOf('{');
  if (start === -1) return '';
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (!inString) {
      if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) return raw.substring(start, i + 1); }
    }
  }
  const last = raw.lastIndexOf('}');
  if (last > start) return raw.substring(start, last + 1);
  return '';
}

function repairUnclosedJson(json: string): string {
  const stack: ('{' | '[')[] = [];
  let inString = false;
  let escaped = false;
  let cleanJson = '';

  for (let i = 0; i < json.length; i++) {
    const char = json[i];
    cleanJson += char;

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
        stack.push('{');
      } else if (char === '}') {
        if (stack[stack.length - 1] === '{') stack.pop();
      } else if (char === '[') {
        stack.push('[');
      } else if (char === ']') {
        if (stack[stack.length - 1] === '[') stack.pop();
      }
    }
  }

  if (inString) {
    cleanJson += '"';
  }

  // Remove trailing commas standard JSON hates
  cleanJson = cleanJson.trim().replace(/,\s*$/, '').replace(/,(\s*[}\]])/g, '$1');

  while (stack.length > 0) {
    const open = stack.pop();
    if (open === '{') cleanJson += '}';
    else if (open === '[') cleanJson += ']';
  }

  return cleanJson;
}

function tryParseJson(raw: string): any | null {
  const block = extractJsonBlock(raw);
  if (!block) return null;

  let cleaned = repairUnclosedJson(block);
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      return JSON.parse(cleaned);
    } catch {
      if (attempt === 5) break;
      switch (attempt) {
        case 0:
          // Remove trailing commas in arrays/objects
          cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
          break;
        case 1:
          // Remove raw newlines/tabs inside values
          cleaned = cleaned
            .replace(/\r\n?/g, ' ')
            .replace(/\n/g, ' ')
            .replace(/\t/g, ' ');
          break;
        case 2:
          // Normalize single quotes to double quotes safely
          cleaned = cleaned.replace(/:\s*'([^']*)'/g, ': "$1"').replace(/([{,]\s*)'([^']*)'(\s*:)/g, '$1"$2"$3');
          break;
        case 3:
          // Escape raw backslashes
          cleaned = cleaned.replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\');
          break;
        case 4:
          // Fix unquoted keys
          cleaned = cleaned.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
          break;
      }
    }
  }
  return null;
}

// ─── Validation helpers ────────────────────────────────────────────────────────

const VALID_COLORS  = new Set<NodeColor>(['blue','violet','green','amber','rose','indigo','slate']);
const VALID_TYPES   = new Set<NodeType>(['Process','Decision','Database','Cloud','People','Business','Technical','Computer','Oval','Diamond','Parallelogram','Document','Hexagon','Triangle','Square','Swimlane','Gantt','UMLClass','EREntity','CircuitResistor','CircuitCapacitor','CircuitGround','CircuitSource','VennCircle','BarSegment','PieWedge','LinePoint','ScatterPoint','HistogramBar','DFDProcess','DFDDataStore','DFDExternalEntity']);
const VALID_CONNS   = new Set<ConnType>(['Orthogonal','Curved','Straight','Elbow']);
const VALID_ARROWS  = new Set<Arrowhead>(['Arrow','Dot','Diamond',"Crow's Foot"]);

function sanitizeNode(raw: any, index: number): DiagramNode {
  const title = String(raw.title || 'Untitled');
  const description = String(raw.description || '');
  const type = VALID_TYPES.has(raw.type) ? raw.type : 'Process';
  const color = VALID_COLORS.has(raw.color) ? raw.color : 'blue';

  return {
    id:          String(raw.id          || `node_ai_${Date.now()}_${index}`),
    title,
    description,
    type,
    color,
    x:           typeof raw.x === 'number' ? raw.x : 100 + index * 280,
    y:           typeof raw.y === 'number' ? raw.y : 100,
    width:       typeof raw.width  === 'number' ? raw.width  : 240,
    height:      typeof raw.height === 'number' ? raw.height : 120,
    icon:        raw.icon || guessIconFromContext(title, description, type),
    notes:       raw.notes ? String(raw.notes) : undefined,
    variant:     (raw.variant === 'icon' || raw.variant === 'text' || raw.variant === 'shape') ? raw.variant : undefined,
    customFill:  raw.customFill ? String(raw.customFill) : undefined,
    customBorderColor: raw.customBorderColor ? String(raw.customBorderColor) : undefined,
    customBorderWidth: typeof raw.customBorderWidth === 'number' ? raw.customBorderWidth : undefined,
    rotation:    typeof raw.rotation === 'number' ? raw.rotation : undefined,
    imageUrl:    raw.imageUrl ? String(raw.imageUrl) : undefined,
    _animating:  true,
  };
}

function sanitizeConnection(raw: any, index: number): DiagramConnection {
  return {
    id:             String(raw.id   || `conn_ai_${Date.now()}_${index}`),
    from:           String(raw.from || ''),
    to:             String(raw.to   || ''),
    type:           VALID_CONNS.has(raw.type)       ? raw.type       : 'Orthogonal',
    arrowhead:      VALID_ARROWS.has(raw.arrowhead) ? raw.arrowhead  : 'Arrow',
    label:          raw.label ? String(raw.label) : undefined,
    lineStyle:      (raw.lineStyle === 'solid' || raw.lineStyle === 'dashed' || raw.lineStyle === 'dotted') ? raw.lineStyle : undefined,
    arrowDirection: (raw.arrowDirection === 'forward' || raw.arrowDirection === 'backward' || raw.arrowDirection === 'both' || raw.arrowDirection === 'none') ? raw.arrowDirection : undefined,
    thickness:      typeof raw.thickness === 'number' ? raw.thickness : undefined,
    routingOffset:  typeof raw.routingOffset === 'number' ? raw.routingOffset : undefined,
    routingOffsetY: typeof raw.routingOffsetY === 'number' ? raw.routingOffsetY : undefined,
  };
}

// ─── Staggered node applier ────────────────────────────────────────────────────

const NODE_STAGGER_MS  = 120; // delay between each node appearing
const ANIM_DURATION_MS = 400; // how long _animating stays true

function applyNodesStaggered(
  newNodes: DiagramNode[],
  setNodes: React.Dispatch<React.SetStateAction<DiagramNode[]>>,
  onComplete?: () => void,
) {
  newNodes.forEach((node, i) => {
    setTimeout(() => {
      setNodes(prev => {
        const exists = prev.find(n => n.id === node.id);
        if (exists) {
          // Update existing node (animate if position/title changed)
          return prev.map(n => n.id === node.id ? { ...node, _animating: true } : n);
        }
        return [...prev, { ...node, _animating: true }];
      });

      // Remove _animating flag after animation finishes
      setTimeout(() => {
        setNodes(prev => prev.map(n => n.id === node.id ? { ...n, _animating: false } : n));
      }, ANIM_DURATION_MS);

      if (i === newNodes.length - 1 && onComplete) onComplete();
    }, i * NODE_STAGGER_MS);
  });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseDiagramAgentOptions {
  nodes: DiagramNode[];
  connections: DiagramConnection[];
  setNodes: React.Dispatch<React.SetStateAction<DiagramNode[]>>;
  setConnections: React.Dispatch<React.SetStateAction<DiagramConnection[]>>;
  onExplanation: (text: string) => void;
  onError: (msg: string) => void;
  debouncedSave: (nodes: DiagramNode[], connections: DiagramConnection[]) => void;
}

export interface UseDiagramAgentReturn {
  sendMessage: (text: string, image?: string, history?: Array<{ role: 'user' | 'assistant'; content: string }>) => void;
  stopStreaming: () => void;
  status: AgentStatus;
  streamingText: string;   // raw accumulating LLM text (for display in chat)
  tokenCount: number;
}

export function useDiagramAgent({
  nodes,
  connections,
  setNodes,
  setConnections,
  onExplanation,
  onError,
  debouncedSave,
}: UseDiagramAgentOptions): UseDiagramAgentReturn {
  // ── Always-fresh refs for nodes & connections ─────────────────────────────
  // Using refs prevents stale-closure issues when sendMessage is memoized.
  const nodesRef = useRef<DiagramNode[]>(nodes);
  const connectionsRef = useRef<DiagramConnection[]>(connections);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { connectionsRef.current = connections; }, [connections]);

  const [status, setStatus]           = useState<AgentStatus>('idle');
  const [streamingText, setStreamingText] = useState('');
  const [tokenCount, setTokenCount]   = useState(0);

  const abortRef    = useRef<AbortController | null>(null);
  const rawBufferRef = useRef('');
  const appliedRef  = useRef(false); // did we already apply a complete parse mid-stream?

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    setStatus('aborted');
    setStreamingText('');
  }, []);

  const sendMessage = useCallback(async (
    text: string,
    image?: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }> = []
  ) => {
    if (!text.trim()) return;

    // Cancel any in-flight request
    abortRef.current?.abort();
    abortRef.current  = new AbortController();
    rawBufferRef.current = '';
    appliedRef.current   = false;

    setStatus('connecting');
    setStreamingText('');
    setTokenCount(0);

    // Build the full multi-turn conversation payload for 100% accuracy
    const historyPayload = history.map(h => ({ role: h.role, content: h.content }));
    historyPayload.push({ role: 'user', content: text, image } as any);

    // Capture current canvas state via refs (avoids stale-closure problem)
    const currentNodes = nodesRef.current;
    const currentConns = connectionsRef.current;

    try {
      const res = await fetch('/api/diagrams/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages:  historyPayload,
          context:   { nodes: currentNodes, connections: currentConns },
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => `HTTP ${res.status}`);
        if (errText.includes('AI_CAP_REACHED') || errText.includes('AI_CAP_RULE_BLOCKED') || res.status === 403 || res.status === 429) {
          throw new Error('AI_CAP_BLOCKED');
        }
        throw new Error(errText);
      }

      if (!res.body) throw new Error('No response body');

      setStatus('streaming');

      // ── Consume SSE stream ────────────────────────────────────────────────
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (abortRef.current.signal.aborted) break;

        sseBuffer += decoder.decode(value, { stream: true });

        // SSE events are separated by double newline
        const parts = sseBuffer.split('\n\n');
        sseBuffer = parts.pop() ?? ''; // keep incomplete tail

        for (const part of parts) {
          const eventMatch = part.match(/^event:\s*(.+)$/m);
          const dataMatch  = part.match(/^data:\s*(.+)$/m);
          if (!eventMatch || !dataMatch) continue;

          const eventName = eventMatch[1].trim();
          let   dataStr   = dataMatch[1].trim();

          // dataStr is JSON-encoded string from sseChunk()
          try { dataStr = JSON.parse(dataStr); } catch { /* use raw */ }

          if (eventName === 'token') {
            rawBufferRef.current += dataStr;
            setStreamingText(rawBufferRef.current);
            setTokenCount(c => c + 1);

            // ── Mid-stream progressive parse ──────────────────────────────
            // Try to parse the accumulated buffer on every ~10 tokens to get
            // early canvas updates while the LLM is still generating.
            // NOTE: Mid-stream apply is intentionally disabled to avoid partial
            // renders overwriting the canvas with incomplete node lists.
            // The final 'done' event always applies the authoritative result.
          } else if (eventName === 'done') {
            // ── Final parse: authoritative result ─────────────────────────
            setStatus('applying');
            let finalParsed = tryParseJson(rawBufferRef.current);

            if (!finalParsed) {
              const trimmedRaw = rawBufferRef.current.trim();
              const isJsonBlock = trimmedRaw.startsWith('{') || trimmedRaw.includes('"nodes"');
              if (!isJsonBlock) {
                let { code, engine } = extractCodeBlock(rawBufferRef.current);
                if (!engine) {
                  const lower = rawBufferRef.current.toLowerCase();
                  if (lower.includes('flowchart') || lower.includes('graph td') || lower.includes('graph lr') || lower.includes('graph tb')) {
                    engine = 'mermaid';
                    code = rawBufferRef.current;
                  }
                }
                if (engine) {
                  finalParsed = await parseDiagram(engine, code);
                }
              }
            }

            if (!finalParsed) {
              finalParsed = rescueCorruptedJson(rawBufferRef.current);
            }

            if (finalParsed) {
              const { explanation, nodes: aiNodes, connections: aiConns, mode, deleteNodes } = finalParsed;
              const sanitizedNodes = (aiNodes || []).map((n: any, i: number) => sanitizeNode(n, i));
              const sanitizedConns = (aiConns || []).map((c: any, i: number) => sanitizeConnection(c, i));

              const isPatch = mode === 'patch' || (
                sanitizedNodes.length > 0 &&
                sanitizedNodes.length < currentNodes.length &&
                sanitizedNodes.some((n: DiagramNode) => currentNodes.some(existing => existing.id === n.id))
              );

              let finalNodes: DiagramNode[];
              let finalConns: DiagramConnection[];

              if (isPatch) {
                const deleteIds = new Set<string>(deleteNodes || []);
                (aiNodes || []).forEach((n: any) => {
                  if (n.deleted === true || n.status === 'deleted') {
                    deleteIds.add(String(n.id));
                  }
                });

                const incomingMap = new Map<string, DiagramNode>(sanitizedNodes.map((n: DiagramNode) => [n.id, n] as [string, DiagramNode]));
                const updatedNodes = currentNodes
                  .filter(n => !deleteIds.has(n.id))
                  .map(existing => {
                    const incoming = incomingMap.get(existing.id);
                    if (incoming) {
                      incomingMap.delete(existing.id);
                      return { ...incoming, _animating: true };
                    }
                    return existing;
                  });

                const newNodesList: DiagramNode[] = [];
                incomingMap.forEach(newNode => {
                  if (!deleteIds.has(newNode.id)) {
                    newNodesList.push({ ...newNode, _animating: true });
                  }
                });

                finalNodes = [...updatedNodes, ...newNodesList];

                // Merge connections
                const newConnsMap = new Map<string, DiagramConnection>(sanitizedConns.map((c: DiagramConnection) => [`${c.from}->${c.to}`, c] as [string, DiagramConnection]));
                const mergedConns = currentConns
                  .filter(c => !deleteIds.has(c.from) && !deleteIds.has(c.to))
                  .map(existing => {
                    const key = `${existing.from}->${existing.to}`;
                    const incoming = newConnsMap.get(key);
                    if (incoming) {
                      newConnsMap.delete(key);
                      return incoming;
                    }
                    return existing;
                  });

                newConnsMap.forEach(newConn => {
                  if (!deleteIds.has(newConn.from) && !deleteIds.has(newConn.to)) {
                    mergedConns.push(newConn);
                  }
                });

                // Auto-route new connections if needed
                finalConns = adaptConnectionsToContext(finalNodes, mergedConns);
              } else {
                finalNodes = organizeDiagramLayout(sanitizedNodes, sanitizedConns);
                finalConns = adaptConnectionsToContext(finalNodes, sanitizedConns);
              }

              if (finalNodes.length > 0) {
                applyNodesStaggered(finalNodes, setNodes, () => {
                  setConnections(finalConns);
                  debouncedSave(finalNodes, finalConns);
                  setStatus('done');
                });
              } else if (finalNodes.length === 0 && currentNodes.length > 0) {
                debouncedSave(currentNodes, currentConns);
                setStatus('done');
              } else {
                setStatus('done');
              }

              onExplanation(explanation || 'Diagram updated successfully.');
            } else {
              // parse failed — keep current nodes, emit warning
              onExplanation('⚠️ AI responded but the diagram structure could not be parsed. Your canvas is unchanged.');
              setStatus('done');
            }

            setStreamingText('');
            break;
          } else if (eventName === 'error') {
            throw new Error(String(dataStr));
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || abortRef.current?.signal.aborted) {
        setStatus('aborted');
        setStreamingText('');
        return;
      }
      if (err.message === 'AI_CAP_BLOCKED') {
        setStatus('error');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('ai-cap-triggered'));
        }
        try {
          const capStatusRes = await fetch('/api/user/ai-cap/status');
          const capData = await capStatusRes.json();
          const renewDateStr = capData.quotaResetAt || capData.reactivatesAt || new Date(Date.now() + 86400000).toISOString();
          const formattedDate = new Date(renewDateStr).toLocaleDateString(undefined, { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          }) + ' at ' + new Date(renewDateStr).toLocaleTimeString(undefined, { 
            hour: '2-digit', 
            minute: '2-digit' 
          });
          onError(`AI_CAP_BLOCKED:You have consumed all tokens. Token will be renewed on ${formattedDate}. You can continue to work without AI agent.`);
        } catch (capErr) {
          const fallbackDate = new Date(Date.now() + 86400000).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
          onError(`AI_CAP_BLOCKED:You have consumed all tokens. Token will be renewed on ${fallbackDate}. You can continue to work without AI agent.`);
        }
        return;
      }
      const streamErrorMsg = err?.message || 'Unknown streaming error';
      console.warn('[useDiagramAgent] Stream failed, attempting gateway fallback...', streamErrorMsg);
      setStreamingText('');

      // Fallback: try the regular blocking gateway endpoint
      try {
        setStatus('connecting');
        const fallbackRes = await fetch('/api/agent-gateway', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            agent:    'diagram',
            messages: historyPayload,
            context:  { nodes: currentNodes, connections: currentConns },
          }),
        });
        const fallbackData = await fallbackRes.json();
        if (fallbackData.success && fallbackData.data) {
          const { explanation, nodes: aiNodes, connections: aiConns } = fallbackData.data;
          const sanitizedNodes = (aiNodes || []).map((n: any, i: number) => sanitizeNode(n, i));
          const sanitizedConns = (aiConns || []).map((c: any, i: number) => sanitizeConnection(c, i));
          if (sanitizedNodes.length > 0) {
            applyNodesStaggered(sanitizedNodes, setNodes, () => {
              setConnections(sanitizedConns);
              debouncedSave(sanitizedNodes, sanitizedConns);
              setStatus('done');
            });
          }
          onExplanation(explanation || 'Diagram updated (via fallback).');
          setStatus('done');
        } else {
          if (fallbackData.error?.includes('AI_CAP_REACHED') || fallbackData.error?.includes('AI_CAP_RULE_BLOCKED')) {
            throw new Error('AI_CAP_BLOCKED');
          }
          throw new Error(fallbackData.error || 'Fallback failed');
        }
      } catch (fallbackErr: any) {
        if (fallbackErr.message === 'AI_CAP_BLOCKED') {
          setStatus('error');
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('ai-cap-triggered'));
          }
          try {
            const capStatusRes = await fetch('/api/user/ai-cap/status');
            const capData = await capStatusRes.json();
            const renewDateStr = capData.quotaResetAt || capData.reactivatesAt || new Date(Date.now() + 86400000).toISOString();
            const formattedDate = new Date(renewDateStr).toLocaleDateString(undefined, { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            }) + ' at ' + new Date(renewDateStr).toLocaleTimeString(undefined, { 
              hour: '2-digit', 
              minute: '2-digit' 
            });
            onError(`AI_CAP_BLOCKED:You have consumed all tokens. Token will be renewed on ${formattedDate}. You can continue to work without AI agent.`);
          } catch (capErr) {
            const fallbackDate = new Date(Date.now() + 86400000).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
            onError(`AI_CAP_BLOCKED:You have consumed all tokens. Token will be renewed on ${fallbackDate}. You can continue to work without AI agent.`);
          }
          return;
        }
        console.error('[useDiagramAgent] Both streaming and fallback failed:', fallbackErr);
        onError(`⚠️ All AI models are currently busy or rate-limited. Please try again in a moment.`);
        setStatus('error');
      }
    }
  // sendMessage deliberately excludes nodes/connections from deps since we
  // read them via refs (nodesRef/connectionsRef) to avoid stale closures.
   
  }, [setNodes, setConnections, onExplanation, onError, debouncedSave]);

  return { sendMessage, stopStreaming, status, streamingText, tokenCount };
}
