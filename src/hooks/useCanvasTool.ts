'use client';

import { useState, useCallback } from 'react';

export type ToolMode = 'select' | 'hand' | 'connect' | 'text';

interface UseCanvasToolReturn {
  activeTool: ToolMode;
  setTool: (tool: ToolMode) => void;
  isSelect: boolean;
  isHand: boolean;
  isConnect: boolean;
  isText: boolean;
}

/**
 * useCanvasTool
 *
 * Manages the active tool mode for the diagram canvas.
 *
 * Tool modes:
 * - 'select': Default. Click/drag to select nodes, box-select multiple nodes.
 * - 'hand': Pan mode. Click and drag to pan the canvas.
 * - 'connect': Connection mode. Click source port then target node to create a connection.
 * - 'text': Text mode. Click on canvas to add a text label node.
 *
 * Flow:
 *   User clicks a tool button → setTool(mode) → mode updates →
 *   canvas reads activeTool to determine cursor, behavior, etc.
 */
export function useCanvasTool(): UseCanvasToolReturn {
  const [activeTool, setActiveTool] = useState<ToolMode>('select');

  const setTool = useCallback((tool: ToolMode) => {
    setActiveTool(tool);
  }, []);

  return {
    activeTool,
    setTool,
    isSelect: activeTool === 'select',
    isHand: activeTool === 'hand',
    isConnect: activeTool === 'connect',
    isText: activeTool === 'text',
  };
}
