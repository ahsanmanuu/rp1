/**
 * useDiagramHistory
 *
 * Provides Undo / Redo capability for the AI Diagram Studio canvas.
 *
 * Usage:
 *   const { pushHistory, undo, redo, canUndo, canRedo } = useDiagramHistory(setNodes, setConnections);
 *
 * Call pushHistory(nodes, connections) BEFORE every mutation (add, delete,
 * move, resize, connect, disconnect).  The hook stores up to MAX_HISTORY
 * snapshots and exposes undo/redo callbacks.
 */

import { useCallback, useRef, useState } from 'react';
import type { DiagramNode, DiagramConnection } from '@/lib/diagramTypes';

interface HistorySnapshot {
  nodes: DiagramNode[];
  connections: DiagramConnection[];
}

const MAX_HISTORY = 50;

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useDiagramHistory(
  setNodes: React.Dispatch<React.SetStateAction<DiagramNode[]>>,
  setConnections: React.Dispatch<React.SetStateAction<DiagramConnection[]>>,
) {
  // Stack of past snapshots (index 0 = oldest)
  const pastRef   = useRef<HistorySnapshot[]>([]);
  // Stack of future snapshots (index 0 = most-recent redo)
  const futureRef = useRef<HistorySnapshot[]>([]);

  // Simple counter to force re-renders when stacks change
  const [revision, setRevision] = useState(0);
  const bump = () => setRevision(r => r + 1);

  /**
   * pushHistory – call BEFORE mutating nodes/connections.
   * Clears the redo stack (new branch) and pushes the current state.
   */
  const pushHistory = useCallback((
    nodes: DiagramNode[],
    connections: DiagramConnection[],
  ) => {
    futureRef.current = []; // clear redo
    pastRef.current = [
      ...pastRef.current.slice(-(MAX_HISTORY - 1)),
      {
        nodes:       nodes.map(n => ({ ...n })),
        connections: connections.map(c => ({ ...c })),
      },
    ];
    bump();
  }, []);

  /**
   * undo – restore the most recent past snapshot; push current to future.
   * Accepts the current nodes/connections so they can be saved to future.
   */
  const undo = useCallback((
    currentNodes: DiagramNode[],
    currentConnections: DiagramConnection[],
  ) => {
    if (pastRef.current.length === 0) return;
    const snapshot = pastRef.current[pastRef.current.length - 1];
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [
      {
        nodes:       currentNodes.map(n => ({ ...n })),
        connections: currentConnections.map(c => ({ ...c })),
      },
      ...futureRef.current,
    ];
    setNodes(snapshot.nodes.map(n => ({ ...n, _animating: false })));
    setConnections(snapshot.connections.map(c => ({ ...c })));
    bump();
  }, [setNodes, setConnections]);

  /**
   * redo – re-apply a previously undone snapshot; push current to past.
   */
  const redo = useCallback((
    currentNodes: DiagramNode[],
    currentConnections: DiagramConnection[],
  ) => {
    if (futureRef.current.length === 0) return;
    const snapshot = futureRef.current[0];
    futureRef.current = futureRef.current.slice(1);
    pastRef.current = [
      ...pastRef.current.slice(-(MAX_HISTORY - 1)),
      {
        nodes:       currentNodes.map(n => ({ ...n })),
        connections: currentConnections.map(c => ({ ...c })),
      },
    ];
    setNodes(snapshot.nodes.map(n => ({ ...n, _animating: false })));
    setConnections(snapshot.connections.map(c => ({ ...c })));
    bump();
  }, [setNodes, setConnections]);

  const canUndo = pastRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;

  return { pushHistory, undo, redo, canUndo, canRedo, revision };
}
