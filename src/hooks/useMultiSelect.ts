/**
 * useMultiSelect
 *
 * Handles multi-node selection for the AI Diagram Studio.
 *
 * Features:
 *  – Shift+Click to toggle a node in/out of the selection set
 *  – Rubber-band box drag on empty canvas to select nodes in region
 *  – Bulk operations: move all selected nodes together
 *
 * Usage:
 *   const ms = useMultiSelect();
 *   // On node click: ms.toggleSelect(id, shiftKey)
 *   // On canvas mousedown (no shift): ms.startBox(e.clientX, e.clientY)
 *   // On canvas mousemove: ms.updateBox(e.clientX, e.clientY, nodes, scale)
 *   // On canvas mouseup: ms.endBox()
 */

import { useCallback, useRef, useState } from 'react';

export interface SelectBox {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export interface MultiSelectNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function useMultiSelect() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectBox, setSelectBox]     = useState<SelectBox | null>(null);
  const isDrawingBox = useRef(false);

  /** Toggle one node; if shift is false, replace entire selection */
  const toggleSelect = useCallback((id: string, shift: boolean) => {
    setSelectedIds(prev => {
      if (!shift) {
        // Single-select (no shift) — just that one node
        return new Set([id]);
      }
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /** Add a node to selection without clearing others */
  const addSelect = useCallback((id: string) => {
    setSelectedIds(prev => new Set([...prev, id]));
  }, []);

  /** Set selection to all given node ids */
  const selectAll = useCallback((nodeIds?: string[]) => {
    if (nodeIds) {
      setSelectedIds(new Set(nodeIds));
    }
  }, []);

  /** Clear all selections */
  const clearSelect = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  /** Set the entire selection */
  const setSelection = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  /** Begin rubber-band box drag from canvas (clientX/Y in screen coords) */
  const startBox = useCallback((clientX: number, clientY: number) => {
    isDrawingBox.current = true;
    setSelectBox({ startX: clientX, startY: clientY, endX: clientX, endY: clientY });
    setSelectedIds(new Set());
  }, []);

  /**
   * Update box during drag; simultaneously compute which nodes fall inside
   * the box and mark them selected.
   *
   * @param clientX   current mouse X (screen)
   * @param clientY   current mouse Y (screen)
   * @param nodes     current diagram nodes (with x/y/width/height in canvas coords)
   * @param scale     current zoom factor (zoom / 100)
   * @param panOffset canvas pan offset in screen pixels
   * @param canvasRect  bounding rect of the canvas element
   */
  const updateBox = useCallback((
    clientX: number,
    clientY: number,
    nodes: MultiSelectNode[],
    scale: number,
    panOffset: { x: number; y: number },
    canvasRect: DOMRect,
  ) => {
    if (!isDrawingBox.current) return;

    setSelectBox(prev => {
      if (!prev) return null;
      return { ...prev, endX: clientX, endY: clientY };
    });

    // Convert screen box to canvas-local coords for intersection test
    setSelectBox(prev => {
      if (!prev) return null;
      const boxMinScreenX = Math.min(prev.startX, clientX) - canvasRect.left;
      const boxMaxScreenX = Math.max(prev.startX, clientX) - canvasRect.left;
      const boxMinScreenY = Math.min(prev.startY, clientY) - canvasRect.top;
      const boxMaxScreenY = Math.max(prev.startY, clientY) - canvasRect.top;

      // Convert screen-space box to canvas-local coords
      const toCanvas = (sx: number, sy: number) => ({
        cx: (sx - panOffset.x) / scale,
        cy: (sy - panOffset.y) / scale,
      });
      const tl = toCanvas(boxMinScreenX, boxMinScreenY);
      const br = toCanvas(boxMaxScreenX, boxMaxScreenY);

      const intersected = nodes
        .filter(n => {
          return (
            n.x < br.cx &&
            n.x + n.width > tl.cx &&
            n.y < br.cy &&
            n.y + n.height > tl.cy
          );
        })
        .map(n => n.id);

      setSelectedIds(new Set(intersected));
      return prev;
    });
  }, []);

  /** End rubber-band box drag */
  const endBox = useCallback(() => {
    isDrawingBox.current = false;
    setSelectBox(null);
  }, []);

  return {
    selectedIds,
    selectBox,
    toggleSelect,
    addSelect,
    selectAll,
    clearSelect,
    setSelection,
    startBox,
    updateBox,
    endBox,
    isDrawingBox: isDrawingBox.current,
  };
}
