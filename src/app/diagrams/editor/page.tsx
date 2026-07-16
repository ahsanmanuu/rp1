"use client";

import '../diagrams.css';
import React, {
  useState, useEffect, useRef, useCallback, useMemo
} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSession } from "@/lib/pb-auth-react";
import { useLayoutSync } from "@/hooks/useLayoutSync";
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { useDiagramAgent } from '@/hooks/useDiagramAgent';
import { useDiagramHistory } from '@/hooks/useDiagramHistory';
import { useMultiSelect } from '@/hooks/useMultiSelect';
import { useExport } from '@/hooks/useExport';
import { useCanvasTool } from '@/hooks/useCanvasTool';
import { parseMermaidRegex } from '@/lib/diagramParsers';
import { DIAGRAM_TEMPLATES, DiagramTemplate } from '@/lib/diagramTemplates';
import type { NodeColor, NodeType, ConnType, Arrowhead, DiagramNode, DiagramConnection, EditorMode } from '@/lib/diagramTypes';
import ProjectLimitModal from '@/components/ProjectLimitModal';
import { useProjectLimit } from '@/hooks/useProjectLimit';
import ThemeSwitcher from '@/components/scholarly-editor/ThemeSwitcher';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ─── Color helpers ─────────────────────────────────────────────────────────────

const DARK_COLOR_MAP: Record<NodeColor, { bg: string; border: string; text: string; glow: string; nodeText: string }> = {
  blue:   { bg: 'rgba(59,130,246,0.10)',  border: '#3b82f6', text: '#93c5fd', glow: 'rgba(59,130,246,0.35)', nodeText: '#ffffff' },
  violet: { bg: 'rgba(139,92,246,0.10)', border: '#8b5cf6', text: '#c4b5fd', glow: 'rgba(139,92,246,0.35)', nodeText: '#ffffff' },
  green:  { bg: 'rgba(34,197,94,0.10)',  border: '#22c55e', text: '#86efac', glow: 'rgba(34,197,94,0.35)', nodeText: '#ffffff' },
  amber:  { bg: 'rgba(245,158,11,0.10)', border: '#f59e0b', text: '#fcd34d', glow: 'rgba(245,158,11,0.35)', nodeText: '#ffffff' },
  rose:   { bg: 'rgba(244,63,94,0.10)',  border: '#f43f5e', text: '#fda4af', glow: 'rgba(244,63,94,0.35)', nodeText: '#ffffff' },
  indigo: { bg: 'rgba(99,102,241,0.10)', border: '#6366f1', text: '#a5b4fc', glow: 'rgba(99,102,241,0.35)', nodeText: '#ffffff' },
  slate:  { bg: 'rgba(100,116,139,0.10)',border: '#64748b', text: '#94a3b8', glow: 'rgba(100,116,139,0.35)', nodeText: '#ffffff' },
};

const LIGHT_COLOR_MAP: Record<NodeColor, { bg: string; border: string; text: string; glow: string; nodeText: string }> = {
  blue:   { bg: 'rgba(59,130,246,0.12)',  border: '#2563eb', text: '#1e40af', glow: 'rgba(59,130,246,0.25)', nodeText: '#1e293b' },
  violet: { bg: 'rgba(139,92,246,0.12)', border: '#7c3aed', text: '#5b21b6', glow: 'rgba(139,92,246,0.25)', nodeText: '#1e293b' },
  green:  { bg: 'rgba(34,197,94,0.12)',  border: '#16a34a', text: '#166534', glow: 'rgba(34,197,94,0.25)', nodeText: '#1e293b' },
  amber:  { bg: 'rgba(245,158,11,0.12)', border: '#d97706', text: '#92400e', glow: 'rgba(245,158,11,0.25)', nodeText: '#1e293b' },
  rose:   { bg: 'rgba(244,63,94,0.12)',  border: '#e11d48', text: '#9f1239', glow: 'rgba(244,63,94,0.25)', nodeText: '#1e293b' },
  indigo: { bg: 'rgba(99,102,241,0.12)', border: '#4f46e5', text: '#3730a3', glow: 'rgba(99,102,241,0.25)', nodeText: '#1e293b' },
  slate:  { bg: 'rgba(100,116,139,0.12)',border: '#475569', text: '#334155', glow: 'rgba(100,116,139,0.25)', nodeText: '#1e293b' },
};

const LIGHT_CANVASES = new Set(['white']);

function getColorMap(canvasBg: string) {
  return LIGHT_CANVASES.has(canvasBg) ? LIGHT_COLOR_MAP : DARK_COLOR_MAP;
}

function getDynamicColor(savedColor: string | undefined, nodeColor: NodeColor, canvasBg: string) {
  const isLight = LIGHT_CANVASES.has(canvasBg);
  const darkCol = DARK_COLOR_MAP[nodeColor];
  const lightCol = LIGHT_COLOR_MAP[nodeColor];
  
  if (!savedColor) {
    return isLight ? lightCol.text : darkCol.text;
  }
  
  const isDefaultDarkText = Object.values(DARK_COLOR_MAP).some(v => v.text === savedColor);
  const isDefaultLightText = Object.values(LIGHT_COLOR_MAP).some(v => v.text === savedColor);
  
  if (isDefaultDarkText || isDefaultLightText) {
    return isLight ? lightCol.text : darkCol.text;
  }
  
  return savedColor;
}

const TYPE_ICON: Record<NodeType, string> = {
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
  ScatterPoint: 'bubble_chart',
  HistogramBar: 'align_horizontal_left',
  DFDProcess: 'change_history',
  DFDDataStore: 'reorder',
  DFDExternalEntity: 'domain',
};

// ─── Mermaid generator/parser ──────────────────────────────────────────────────

function nodesToMermaid(nodes: DiagramNode[], connections: DiagramConnection[]): string {
  const lines: string[] = ['flowchart LR'];
  nodes.forEach(n => {
    const safeTitle = n.title.replace(/"/g, "'");
    if (n.type === 'Decision') {
      lines.push(`  ${n.id}{{"${safeTitle}"}}`);
    } else if (n.type === 'Database') {
      lines.push(`  ${n.id}[("${safeTitle}")]`);
    } else if (n.type === 'Cloud') {
      lines.push(`  ${n.id}(("${safeTitle}"))`);
    } else {
      lines.push(`  ${n.id}["${safeTitle}"]`);
    }
  });
  connections.forEach(c => {
    const arrow = c.arrowhead === 'Dot' ? 'o--o' : c.arrowhead === 'Diamond' ? 'x--x' : '-->';
    lines.push(`  ${c.from} ${arrow} ${c.to}`);
  });
  return lines.join('\n');
}

function mermaidToNodes(code: string): { nodes: DiagramNode[]; connections: DiagramConnection[] } {
  return parseMermaidRegex(code);
}

// ─── SVG Connection path builder ───────────────────────────────────────────────

function getBestPorts(from: DiagramNode, to: DiagramNode) {
  if (from.id === to.id) {
    return {
      fromPort: { x: from.x + from.width, y: from.y + from.height / 3, dir: 'R' },
      toPort: { x: from.x + from.width, y: from.y + from.height * 2/3, dir: 'R' }
    };
  }

  // Calculate offsets to determine dominant relative direction
  const isRight = to.x >= from.x + from.width - 20;
  const isLeft = to.x + to.width <= from.x + 20;
  const isBelow = to.y >= from.y + from.height - 20;
  const isAbove = to.y + to.height <= from.y + 20;

  // Ports list for the source node
  const rightPort  = { x: from.x + from.width, y: from.y + from.height / 2, dir: 'R' };
  const leftPort   = { x: from.x, y: from.y + from.height / 2, dir: 'L' };
  const bottomPort = { x: from.x + from.width / 2, y: from.y + from.height, dir: 'B' };
  const topPort    = { x: from.x + from.width / 2, y: from.y, dir: 'T' };

  // Ports list for the target node
  const toRightPort  = { x: to.x + to.width, y: to.y + to.height / 2, dir: 'R' };
  const toLeftPort   = { x: to.x, y: to.y + to.height / 2, dir: 'L' };
  const toBottomPort = { x: to.x + to.width / 2, y: to.y + to.height, dir: 'B' };
  const toTopPort    = { x: to.x + to.width / 2, y: to.y, dir: 'T' };

  // 1. Clean horizontal & vertical layouts
  if (isRight && !isBelow && !isAbove) {
    return { fromPort: rightPort, toPort: toLeftPort };
  }
  if (isLeft && !isBelow && !isAbove) {
    return { fromPort: leftPort, toPort: toRightPort };
  }
  if (isBelow && !isRight && !isLeft) {
    return { fromPort: bottomPort, toPort: toTopPort };
  }
  if (isAbove && !isRight && !isLeft) {
    return { fromPort: topPort, toPort: toBottomPort };
  }

  // 2. Diagonal layouts: choose the dominant axis to keep the connection straight and clean
  if (isRight && isBelow) {
    const dx = to.x - (from.x + from.width);
    const dy = to.y - (from.y + from.height);
    return dx > dy ? { fromPort: rightPort, toPort: toLeftPort } : { fromPort: bottomPort, toPort: toTopPort };
  }
  if (isRight && isAbove) {
    const dx = to.x - (from.x + from.width);
    const dy = from.y - (to.y + to.height);
    return dx > dy ? { fromPort: rightPort, toPort: toLeftPort } : { fromPort: topPort, toPort: toBottomPort };
  }
  if (isLeft && isBelow) {
    const dx = from.x - (to.x + to.width);
    const dy = to.y - (from.y + from.height);
    return dx > dy ? { fromPort: leftPort, toPort: toRightPort } : { fromPort: bottomPort, toPort: toTopPort };
  }
  if (isLeft && isAbove) {
    const dx = from.x - (to.x + to.width);
    const dy = from.y - (to.y + to.height);
    return dx > dy ? { fromPort: leftPort, toPort: toRightPort } : { fromPort: topPort, toPort: toBottomPort };
  }

  // 3. Fallback: Euclidean minimum distance
  const fromPorts = [rightPort, leftPort, bottomPort, topPort];
  const toPorts = [toRightPort, toLeftPort, toBottomPort, toTopPort];
  let minDistance = Infinity;
  let bestFrom = rightPort;
  let bestTo = toLeftPort;

  for (const fp of fromPorts) {
    for (const tp of toPorts) {
      const dist = Math.hypot(fp.x - tp.x, fp.y - tp.y);
      if (dist < minDistance) {
        minDistance = dist;
        bestFrom = fp;
        bestTo = tp;
      }
    }
  }

  return { fromPort: bestFrom, toPort: bestTo };
}

function buildPath(
  from: DiagramNode,
  to: DiagramNode,
  type: ConnType,
  offset: number = 0,
  smartRouting: boolean = true,
  explicitFromPort?: 't'|'r'|'b'|'l',
  explicitToPort?: 't'|'r'|'b'|'l',
  offsetY: number = 0
): string {
  if (from.id === to.id) {
    const x = from.x + from.width;
    const y1 = from.y + from.height / 3;
    const y2 = from.y + from.height * 2/3;
    return `M ${x} ${y1} C ${x + 40} ${y1 - 20}, ${x + 40} ${y2 + 20}, ${x} ${y2}`;
  }

  let fx, fy, tx, ty, fromDir, toDir;

  if (smartRouting) {
    const { fromPort, toPort } = getBestPorts(from, to);
    fx = fromPort.x; fy = fromPort.y; fromDir = fromPort.dir;
    tx = toPort.x; ty = toPort.y; toDir = toPort.dir;
  } else {
    // Free routing: use explicit ports if provided, otherwise default to center calculation
    const getPortCoords = (node: DiagramNode, p?: 't'|'r'|'b'|'l') => {
      if (p === 't') return { x: node.x + node.width / 2, y: node.y, dir: 'T' };
      if (p === 'b') return { x: node.x + node.width / 2, y: node.y + node.height, dir: 'B' };
      if (p === 'l') return { x: node.x, y: node.y + node.height / 2, dir: 'L' };
      if (p === 'r') return { x: node.x + node.width, y: node.y + node.height / 2, dir: 'R' };
      return { x: node.x + node.width / 2, y: node.y + node.height / 2, dir: 'C' };
    };
    const fp = getPortCoords(from, explicitFromPort);
    const tp = getPortCoords(to, explicitToPort);
    fx = fp.x; fy = fp.y; fromDir = fp.dir;
    tx = tp.x; ty = tp.y; toDir = tp.dir;
    
    // If no explicit ports, infer direction from centers
    if (fromDir === 'C') {
      fromDir = Math.abs(tx - fx) > Math.abs(ty - fy) ? (tx > fx ? 'R' : 'L') : (ty > fy ? 'B' : 'T');
    }
    if (toDir === 'C') {
      toDir = Math.abs(fx - tx) > Math.abs(fy - ty) ? (fx > tx ? 'R' : 'L') : (fy > ty ? 'B' : 'T');
    }
  }

  const ratio = Math.max(0.1, Math.min(0.9, 0.5 + (offset / 100)));
  const dx = tx - fx;
  const dy = ty - fy;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  // Perpendicular unit vector
  const ux = -dy / len;
  const uy = dx / len;
  const perpDist = (offsetY || 0);
  const mx = fx + dx * ratio + ux * perpDist;
  const my = fy + dy * ratio + uy * perpDist;

  if (type === 'Straight') {
    return `M ${fx} ${fy} L ${tx} ${ty}`;
  }
  if (type === 'Curved') {
    let cx1 = fx, cy1 = fy;
    let cx2 = tx, cy2 = ty;
    const CURVE_OFFSET = 60 + offset; // Adjust curve height based on offset slider
    if (fromDir === 'R') cx1 += CURVE_OFFSET;
    if (fromDir === 'L') cx1 -= CURVE_OFFSET;
    if (fromDir === 'B') cy1 += CURVE_OFFSET;
    if (fromDir === 'T') cy1 -= CURVE_OFFSET;
    
    if (toDir === 'R') cx2 += CURVE_OFFSET;
    if (toDir === 'L') cx2 -= CURVE_OFFSET;
    if (toDir === 'B') cy2 += CURVE_OFFSET;
    if (toDir === 'T') cy2 -= CURVE_OFFSET;
    
    return `M ${fx} ${fy} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${tx} ${ty}`;
  }
  if (type === 'Orthogonal' || type === 'Elbow') {
    // Safe clearance margin
    const margin = 24;

    // Helper to check if a vertical line segment intersects a node
    const intersectsNode = (x: number, y1: number, y2: number, node: DiagramNode) => {
      const minY = Math.min(y1, y2);
      const maxY = Math.max(y1, y2);
      return x >= node.x && x <= node.x + node.width && minY <= node.y + node.height && maxY >= node.y;
    };

    // Helper to check if a horizontal line segment intersects a node
    const intersectsNodeH = (y: number, x1: number, x2: number, node: DiagramNode) => {
      const minX = Math.min(x1, x2);
      const maxX = Math.max(x1, x2);
      return y >= node.y && y <= node.y + node.height && minX <= node.x + node.width && maxX >= node.x;
    };

    // Exiting points
    let x1 = fx;
    let y1 = fy;
    if (fromDir === 'R') x1 = from.x + from.width + margin;
    else if (fromDir === 'L') x1 = from.x - margin;
    else if (fromDir === 'B') y1 = from.y + from.height + margin;
    else if (fromDir === 'T') y1 = from.y - margin;

    // Entering points
    let x2 = tx;
    let y2 = ty;
    if (toDir === 'R') x2 = to.x + to.width + margin;
    else if (toDir === 'L') x2 = to.x - margin;
    else if (toDir === 'B') y2 = to.y + to.height + margin;
    else if (toDir === 'T') y2 = to.y - margin;

    const path: string[] = [`M ${fx} ${fy}`];
    if (x1 !== fx || y1 !== fy) {
      path.push(`L ${x1} ${y1}`);
    }

    const isFromH = fromDir === 'R' || fromDir === 'L';
    if (isFromH) {
      const x_mid = (x1 + x2) / 2;
      if (!intersectsNode(x_mid, y1, y2, from) && !intersectsNode(x_mid, y1, y2, to)) {
        path.push(`H ${x_mid}`, `V ${y2}`, `H ${tx}`);
        if (y2 !== ty) path.push(`V ${ty}`);
        return path.join(' ');
      }
    } else {
      const y_mid = (y1 + y2) / 2;
      if (!intersectsNodeH(y_mid, x1, x2, from) && !intersectsNodeH(y_mid, x1, x2, to)) {
        path.push(`V ${y_mid}`, `H ${x2}`, `V ${ty}`);
        if (x2 !== tx) path.push(`H ${tx}`);
        return path.join(' ');
      }
    }

    // Bypass routing
    const y_above = Math.min(from.y, to.y) - margin;
    const y_below = Math.max(from.y + from.height, to.y + to.height) + margin;
    const y_safe = Math.abs(y1 - y_above) < Math.abs(y1 - y_below) ? y_above : y_below;

    path.push(`V ${y_safe}`, `H ${x2}`, `V ${ty}`);
    if (x2 !== tx) path.push(`H ${tx}`);
    return path.join(' ');
  }
  return `M ${fx} ${fy} L ${tx} ${ty}`;
}

interface PathSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function parsePathSegments(d: string): PathSegment[] {
  const segments: PathSegment[] = [];
  const commands = d.match(/[MLHVCSZ][^MLHVCSZ]*/g) || [];
  let cx = 0, cy = 0;
  for (const cmd of commands) {
    const type = cmd[0];
    const args = cmd.substring(1).trim().split(/[\s,]+/).map(Number);
    if (type === 'M') {
      cx = args[0];
      cy = args[1];
    } else if (type === 'L') {
      segments.push({ x1: cx, y1: cy, x2: args[0], y2: args[1] });
      cx = args[0];
      cy = args[1];
    } else if (type === 'H') {
      segments.push({ x1: cx, y1: cy, x2: args[0], y2: cy });
      cx = args[0];
    } else if (type === 'V') {
      segments.push({ x1: cx, y1: cy, x2: cx, y2: args[0] });
      cy = args[0];
    }
  }
  return segments;
}

function applyLineJumps(d: string, otherPaths: string[]): string {
  const segments = parsePathSegments(d);
  if (segments.length === 0) return d;

  const otherSegments: PathSegment[] = [];
  for (const op of otherPaths) {
    otherSegments.push(...parsePathSegments(op));
  }

  let newPath = `M ${segments[0].x1} ${segments[0].y1}`;

  for (const seg of segments) {
    const isH = Math.abs(seg.y1 - seg.y2) < 0.1;
    if (isH) {
      const intersections: number[] = [];
      const y = seg.y1;
      const minX = Math.min(seg.x1, seg.x2);
      const maxX = Math.max(seg.x1, seg.x2);

      for (const oSeg of otherSegments) {
        const isOV = Math.abs(oSeg.x1 - oSeg.x2) < 0.1;
        if (isOV) {
          const oX = oSeg.x1;
          const oMinY = Math.min(oSeg.y1, oSeg.y2);
          const oMaxY = Math.max(oSeg.y1, oSeg.y2);

          if (oX > minX + 10 && oX < maxX - 10 && y > oMinY + 10 && y < oMaxY - 10) {
            intersections.push(oX);
          }
        }
      }

      if (intersections.length > 0) {
        const drawDirRight = seg.x2 > seg.x1;
        intersections.sort((a, b) => drawDirRight ? a - b : b - a);

        let lastX = seg.x1;
        for (const ix of intersections) {
          const sign = drawDirRight ? 1 : -1;
          newPath += ` L ${ix - 6 * sign} ${y}`;
          newPath += ` A 6 6 0 0 1 ${ix + 6 * sign} ${y}`;
          lastX = ix + 6 * sign;
        }
        newPath += ` L ${seg.x2} ${seg.y2}`;
      } else {
        newPath += ` L ${seg.x2} ${seg.y2}`;
      }
    } else {
      newPath += ` L ${seg.x2} ${seg.y2}`;
    }
  }

  return newPath;
}

const ASSETS_CATEGORIES = [
  { label: 'Academic & Research', items: ['school', 'science', 'psychology', 'calculate', 'menu_book', 'insights'] },
  { label: 'Publications & Print', items: ['article', 'menu_book', 'library_books', 'text_snippet', 'newspaper'] },
  { label: 'Cloud & Arch', items: ['cloud', 'cloud_queue', 'cloud_done', 'dns', 'router', 'storage', 'terminal', 'memory', 'hub', 'api'] },
  { label: 'Users & Roles', items: ['person', 'group', 'account_circle', 'admin_panel_settings', 'supervisor_account', 'face'] },
  { label: 'Data & Analytics', items: ['analytics', 'bar_chart', 'insights', 'data_usage', 'pie_chart'] },
  { label: 'Business & Finance', items: ['business_center', 'shopping_cart', 'store', 'receipt', 'account_balance', 'attach_money', 'credit_card', 'trending_up', 'work'] },
  { label: 'UI & Navigation', items: ['home', 'search', 'menu', 'settings', 'notifications', 'dashboard', 'apps', 'widgets', 'explore', 'build'] },
  { label: 'Communication', items: ['mail', 'chat', 'forum', 'call', 'share', 'wifi', 'rss_feed', 'send'] },
  { label: 'Electrical', items: ['power', 'power_off', 'power_settings_new', 'battery_alert', 'battery_full', 'battery_std', 'bolt', 'flash_on', 'outlet', 'plug'] },
  { label: 'Electronic', items: ['sensors', 'memory', 'sd_storage', 'sim_card', 'storage', 'router', 'terminal', 'device_hub', 'cast', 'scanner', 'dns'] },
  { label: 'Computer Science', items: ['code', 'computer', 'laptop', 'desktop_windows', 'devices', 'developer_mode', 'dns', 'folder', 'folder_open', 'file_copy', 'file_download', 'file_upload', 'api', 'key', 'lock', 'security', 'bug_report', 'lan'] },
  { label: 'ML & AI', items: ['assistant', 'psychology', 'tune', 'analytics', 'insights', 'trending_up', 'trending_down', 'bubble_chart', 'memory'] },
  { label: 'IoT & Embedded', items: ['sensors', 'wifi', 'wifi_off', 'bluetooth', 'cast', 'device_hub', 'devices', 'near_me', 'network_check', 'router', 'scanner', 'smartphone', 'tablet', 'tv', 'tv_off', 'usb'] },
  { label: 'Civil & Construction', items: ['construction', 'domain', 'factory', 'fence', 'foundation', 'home', 'house', 'landscape', 'location_city', 'park', 'school', 'stairs', 'store', 'terrain', 'toll', 'traffic', 'train', 'tunnel', 'water_damage', 'water_drop', 'map'] },
  { label: 'Mechanical & Industrial', items: ['build', 'construction', 'factory', 'settings', 'settings_applications', 'settings_backup_restore', 'settings_brightness', 'settings_ethernet', 'settings_power', 'speed', 'power', 'bolt', 'work', 'local_shipping', 'lock', 'key', 'shield'] },
  { label: 'Plumbing & HVAC', items: ['pool', 'bathtub', 'shower', 'wash', 'water', 'ac_unit', 'air', 'alarm', 'warning', 'settings', 'build', 'construction'] },
  { label: 'Bio & Life Sciences', items: ['science', 'nature', 'health'] },
  { label: 'Medical & Health', items: ['hospital', 'healthcare', 'description', 'ambulance', 'first_aid', 'thermometer', 'bed', 'wheelchair', 'health', 'fitness'] },
  { label: 'Industrial & Manufacturing', items: ['factory', 'warehouse', 'inventory', 'local_shipping', 'bolt', 'settings', 'air', 'speed', 'moving', 'shield', 'construction'] },
  { label: 'Data Center', items: ['dns', 'router', 'storage', 'cloud', 'cloud_queue', 'cloud_done', 'cloud_off', 'backup', 'shield', 'list_alt', 'key', 'security', 'domain', 'network_check', 'vpn', 'lan', 'sim_card', 'memory', 'terminal', 'code', 'api', 'folder', 'folder_open', 'file_copy', 'file_download', 'file_upload', 'settings', 'speed', 'bolt', 'power', 'alarm', 'warning', 'notifications', 'lock', 'verified', 'admin_panel_settings', 'supervisor_account', 'person', 'group'] },
  { label: 'Networking', items: ['network_check', 'router', 'dns', 'vpn', 'lan', 'wifi', 'wifi_off', 'settings_ethernet', 'route', 'cloud', 'cloud_queue', 'cloud_done', 'cloud_off', 'security', 'lock', 'key', 'shield', 'verified_user', 'admin_panel_settings', 'supervisor_account', 'speed', 'bolt', 'power', 'battery_full'] },
];

// ─── Main page shell (Suspense required for useSearchParams) ──────────────────

export default function AIDiagramStudioPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen bg-[#051424] items-center justify-center">
        <div className="text-[#d4e4fa] text-sm animate-pulse">Loading Diagram Studio…</div>
      </div>
    }>
      <DiagramStudio />
    </Suspense>
  );
}

// ─── Core Component ────────────────────────────────────────────────────────────

function DiagramStudio() {
  const { data: session } = useSession();
  const { settings, updatePanels } = useLayoutSync(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = searchParams.get('id');

  // ── Theme State & Real-time Observers ────────────────────────────────────────
  const [isAppLight, setIsAppLight] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const checkTheme = () => {
        const isL = document.documentElement.getAttribute('data-theme') === 'light';
        setIsAppLight(isL);
      };
      checkTheme();
      
      const observer = new MutationObserver(checkTheme);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      
      // Apply preferred color palette class (theme-purple, theme-emerald, etc.)
      const preferredTheme = localStorage.getItem('scholarly-preferred-theme') || 'purple';
      const themes = ['indigo', 'purple', 'emerald', 'gold', 'slate'];
      themes.forEach(t => {
        document.documentElement.classList.remove(`theme-${t}`);
        document.body.classList.remove(`theme-${t}`);
      });
      document.documentElement.classList.add(`theme-${preferredTheme}`);
      document.body.classList.add(`theme-${preferredTheme}`);

      return () => observer.disconnect();
    }
  }, []);

  // ── Canvas State ─────────────────────────────────────────────────────────────
  const [nodes, setNodes] = useState<DiagramNode[]>([]);
  const [connections, setConnections] = useState<DiagramConnection[]>([]);
  const { showLimitModal, setShowLimitModal } = useProjectLimit();

  // ── UI State ──────────────────────────────────────────────────────────────────
  const [selectedNode, setSelectedNode]   = useState<string | null>(null);
  const [draggingId, setDraggingId]       = useState<string | null>(null);
  const [dragOffset, setDragOffset]       = useState<{ x: number, y: number } | Record<string, { x: number, y: number }>>({ x: 0, y: 0 });
  const [connectingFrom, setConnectingFrom] = useState<{ nodeId: string, portId: 't'|'r'|'b'|'l' } | null>(null);
  const [zoom, setZoom]                   = useState(100);
  const [panOffset, setPanOffset]         = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning]         = useState(false);
  const [panStart, setPanStart]           = useState({ x: 0, y: 0 });
  const [panMode, setPanMode]             = useState(false);
  const [editorMode, setEditorMode]       = useState<EditorMode>('Visual Edit');
  const [chatImage, setChatImage]         = useState<string | null>(null);

  const [activeRightTab, setActiveRightTab] = useState<'properties' | 'update'>('properties');
  const [shapesOpen, setShapesOpen]       = useState(true);
  const [connectorsOpen, setConnectorsOpen] = useState(true);
  const [assetsOpen, setAssetsOpen]       = useState(true);
  const [smartRouting, setSmartRouting]   = useState(true);
  const [lineJump, setLineJump]           = useState(false);
  const [activeConnType, setActiveConnType] = useState<ConnType>('Orthogonal');
  const [activeArrow, setActiveArrow]     = useState<Arrowhead>('Arrow');
  const [mermaidCode, setMermaidCode]     = useState('');
  const [copied, setCopied]               = useState(false);
  const [saving, setSaving]               = useState(false);
  const [saveStatus, setSaveStatus]       = useState<'saved' | 'unsaved' | 'saving'>('saved');
  const [creating, setCreating]           = useState(false);
  const [bgPickerOpen, setBgPickerOpen]   = useState(false);
  type CanvasBg = 'dots' | 'grid' | 'lines' | 'plain' | 'white' | 'blueprint';
  const [canvasBg, setCanvasBg]           = useState<CanvasBg>('dots');

  // ── Recent Projects State ────────────────────────────────────────────────────
  const [recentProjects, setRecentProjects] = useState<Array<{ id: string; title: string; updatedAt: string; nodeCount: number }>>([]);
  const [recentMenuOpen, setRecentMenuOpen] = useState(false);
  const recentMenuRef = useRef<HTMLDivElement>(null);

  // ── Project Title State ─────────────────────────────────────────────────────
  const [projectTitle, setProjectTitle]       = useState('Untitled Diagram');
  const [isEditingTitle, setIsEditingTitle]   = useState(false);
  const [editTitleValue, setEditTitleValue]   = useState('');
  const titleInputRef                         = useRef<HTMLInputElement>(null);

  // ── Chat State ────────────────────────────────────────────────────────────────
  const [chatMessages, setChatMessages]   = useState<ChatMessage[]>([
    { role: 'assistant', content: "Hello! I'm your AI Systems Architect. Describe the component you'd like to add, modify, or remove — and I'll update the diagram instantly." },
  ]);
  const [chatInput, setChatInput]         = useState('');
  const [copiedIndex, setCopiedIndex]     = useState<number | null>(null);
  const chatEndRef                        = useRef<HTMLDivElement>(null);


  // ── Connection styling and resizing states ────────────────────────────────────
  const [selectedConnId, setSelectedConnId] = useState<string | null>(null);
  const [activeLineStyle, setActiveLineStyle] = useState<'solid' | 'dotted' | 'dashed'>('solid');
  const [activeArrowDirection, setActiveArrowDirection] = useState<'forward' | 'both' | 'none'>('forward');
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [resizeStartSize, setResizeStartSize] = useState({ x: 0, y: 0, w: 0, h: 0 });

  // ── Custom Confirm Dialog State ───────────────────────────────────────────────
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // ── Eraser-like Feature State ─────────────────────────────────────────────────
  const [showTemplates, setShowTemplates]       = useState(false);
  const [showShortcuts, setShowShortcuts]       = useState(false);
  const [showMinimap, setShowMinimap]           = useState(true);
  const [minimapPos, setMinimapPos]             = useState<{ x: number; y: number } | null>(null);
  const dragStartRef                            = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(null);

  const [codeFreeMode, setCodeFreeMode]         = useState(false);
  const [draggingConnHandle, setDraggingConnHandle] = useState<{ connId: string; end: 'from' | 'to' | 'mid'; startPos?: {x:number, y:number}; startOffset?: number; axis?: 'x'|'y' } | null>(null);
  const [canvasMousePos, setCanvasMousePos]     = useState<{ x: number; y: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    type: 'node' | 'connection' | 'canvas';
    x: number; y: number;
    targetId?: string;
  } | null>(null);
  const [windowSize, setWindowSize] = useState({ width: 1200, height: 800 });

  const requestConfirm = useCallback((title: string, message: string, onConfirm: () => void) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  }, []);

  useEffect(() => {
    if (settings.panels?.diagrams_activeRightTab) {
      setActiveRightTab(settings.panels.diagrams_activeRightTab);
    }
    if (settings.panels?.diagrams_canvasBg) {
      setCanvasBg(settings.panels.diagrams_canvasBg);
    }
    if (settings.panels?.diagrams_showMinimap !== undefined) {
      setShowMinimap(settings.panels.diagrams_showMinimap);
    }
  }, [settings.panels?.diagrams_activeRightTab, settings.panels?.diagrams_canvasBg, settings.panels?.diagrams_showMinimap]);

  useEffect(() => {
    updatePanels({
      diagrams_activeRightTab: activeRightTab,
      diagrams_canvasBg: canvasBg,
      diagrams_showMinimap: showMinimap,
    });
  }, [activeRightTab, canvasBg, showMinimap, updatePanels]);

  // ── Refs ──────────────────────────────────────────────────────────────────────
  const canvasRef = useRef<HTMLDivElement>(null);

  // ── History (Undo / Redo) ─────────────────────────────────────────────────────
  const { pushHistory, undo, redo, canUndo, canRedo } = useDiagramHistory(setNodes, setConnections);

  // ── Multi-Select ──────────────────────────────────────────────────────────────
  const multiSelect = useMultiSelect();

  // ── Canvas Tool Mode ──────────────────────────────────────────────────────────
  const { activeTool, setTool, isSelect, isHand } = useCanvasTool();

  // ── Export ────────────────────────────────────────────────────────────────────
  const {
    exportDialog, setExportDialog, exportMenuOpen, setExportMenuOpen,
    isExporting, defaultExportOptions,
    doExportPNG, doExportJPEG, doExportSVG, exportMermaid, exportJSON,
  } = useExport({
    canvasRef, nodes, connections, zoom, mermaidCode,
    multiSelect,
    setSelectedNode: (id: string | null) => setSelectedNode(id),
    setSelectedConnId: (id: string | null) => setSelectedConnId(id),
  });

  // ── Persist / Load ────────────────────────────────────────────────────────────
  const chatMessagesRef = useRef<ChatMessage[]>([]);
  useEffect(() => {
    chatMessagesRef.current = chatMessages;
  }, [chatMessages]);

  // ── Persist / Load ────────────────────────────────────────────────────────────
  const saveToServer = useCallback(async (
    updatedNodes: DiagramNode[],
    updatedConns: DiagramConnection[],
    title?: string
  ) => {
    if (!projectId) return;
    setSaving(true);
    setSaveStatus('saving');
    try {
      const structured = JSON.stringify({ 
        nodes: updatedNodes, 
        connections: updatedConns,
        chatHistory: chatMessagesRef.current 
      });
      const mermaid = nodesToMermaid(updatedNodes, updatedConns);
      await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: mermaid,
          structuredContent: structured,
          ...(title ? { title } : {}),
        }),
      });
      setSaveStatus('saved');
    } catch (err) {
      console.error('[DiagramSave]', err);
      setSaveStatus('unsaved');
    } finally {
      setSaving(false);
    }
  }, [projectId]);

  // Auto-save debounce
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connDragRaf = useRef<number | null>(null);
  const debouncedSave = useCallback((n: DiagramNode[], c: DiagramConnection[]) => {
    setSaveStatus('unsaved');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveToServer(n, c), 2000);
  }, [saveToServer]);

  // Trigger auto-save when chatMessages change
  useEffect(() => {
    if (!projectId) return;
    // Skip saving if it's the initial default message
    if (chatMessages.length === 1 && chatMessages[0].role === 'assistant' && chatMessages[0].content.startsWith("Hello! I'm your AI Systems Architect")) {
      return;
    }
    debouncedSave(nodes, connections);
  }, [chatMessages, projectId, nodes, connections, debouncedSave]);

  // ── Fetch Recent Diagram Projects ────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    fetch('/api/diagrams')
      .then(r => r.json())
      .then(data => {
        if (!data.projects) return;
        const mapped = data.projects.slice(0, 10).map((p: any) => {
          let nodeCount = 0;
          try {
            const sc = JSON.parse(p.structuredContent || '{}');
            nodeCount = Array.isArray(sc.nodes) ? sc.nodes.length : 0;
          } catch {}
          return { id: p.id, title: p.title || 'Untitled Diagram', updatedAt: p.updatedAt, nodeCount };
        });
        setRecentProjects(mapped);
      })
      .catch(() => {});
  }, [session]);

  // Close recent menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (recentMenuRef.current && !recentMenuRef.current.contains(e.target as Node)) {
        setRecentMenuOpen(false);
      }
    };
    if (recentMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [recentMenuOpen]);

  // ── Connect Streaming Agent Hook ──────────────────────────────────────────────
  const { sendMessage, stopStreaming, status: agentStatus, streamingText } = useDiagramAgent({
    nodes,
    connections,
    setNodes,
    setConnections,
    onExplanation: (explanation) => {
      setChatMessages(prev => [...prev, { role: 'assistant', content: explanation }]);
    },
    onError: (msg) => {
      const cleanMsg = msg.startsWith('AI_CAP_BLOCKED:') ? msg.replace('AI_CAP_BLOCKED:', '') : msg;
      setChatMessages(prev => [...prev, { role: 'assistant', content: cleanMsg }]);
    },
    debouncedSave,
  });

  const aiLoading = agentStatus === 'connecting' || agentStatus === 'streaming' || agentStatus === 'applying';

  // Auto-create a diagram project when logged in but no ID in the URL
  useEffect(() => {
    if (!session || projectId) return;
    fetch('/api/diagrams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Untitled Diagram' }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.error === 'LIMIT_REACHED') {
          setShowLimitModal(true);
          return;
        }
        if (data.projectId) {
          router.replace(`/diagrams/editor?id=${data.projectId}`);
        }
      })
      .catch(console.error);
  }, [session, projectId, router]);

  // Load from server on mount
  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}`)
      .then(r => r.json())
      .then(data => {
        const p = data.project;
        if (!p) return;
        let loadedHistory = null;
        if (p.structuredContent && p.structuredContent !== '{}') {
          try {
            const parsed = JSON.parse(p.structuredContent);
            setNodes(parsed.nodes || []);
            setConnections(parsed.connections || []);
            if (parsed.chatHistory && Array.isArray(parsed.chatHistory)) {
              loadedHistory = parsed.chatHistory;
            }
          } catch {
            setNodes([]);
            setConnections([]);
          }
        } else {
          setNodes([]);
          setConnections([]);
        }
        // Reset local UI/state when loading/switching project
        setSelectedNode(null);
        setProjectTitle(p.title || 'Untitled Diagram');
        setChatMessages(loadedHistory || [
          { role: 'assistant', content: "Hello! I'm your AI Systems Architect. Describe the component you'd like to add, modify, or remove — and I'll update the diagram instantly." }
        ]);
        setSaveStatus('saved');
        setZoom(100);
        setPanOffset({ x: 0, y: 0 });
      })
      .catch(console.error);
  }, [projectId]);

  // Sync window size safely to avoid hydration mismatch
  useEffect(() => {
    setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    const handleResize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync mermaid code when canvas changes
  useEffect(() => {
    setMermaidCode(nodesToMermaid(nodes, connections));
  }, [nodes, connections]);

  // Scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // ── Property helpers ──────────────────────────────────────────────────────────
  const selected = useMemo(() => nodes.find(n => n.id === selectedNode) ?? null, [nodes, selectedNode]);
  const selectedConn = useMemo(() => connections.find(c => c.id === selectedConnId) ?? null, [connections, selectedConnId]);

  const updateNode = useCallback((id: string, patch: Partial<DiagramNode>) => {
    pushHistory(nodes, connections);
    setNodes(prev => {
      const next = prev.map(n => n.id === id ? { ...n, ...patch } : n);
      debouncedSave(next, connections);
      return next;
    });
  }, [nodes, connections, debouncedSave, pushHistory]);

  const updateConnection = useCallback((id: string, patch: Partial<DiagramConnection>, saveHistory: boolean = true) => {
    if (saveHistory) pushHistory(nodes, connections);
    setConnections(prev => {
      const next = prev.map(c => c.id === id ? { ...c, ...patch } : c);
      debouncedSave(nodes, next);
      return next;
    });
  }, [nodes, connections, debouncedSave, pushHistory]);

  // ── Drag & Drop, Resizing, Multi-select ──────────────────────────────────────
  const onNodeMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    if (e.button === 2) {
      // Right click node
      e.stopPropagation();
      setContextMenu({ type: 'node', targetId: id, x: e.clientX, y: e.clientY });
      return;
    }
    if (e.button !== 0) return;
    e.stopPropagation();
    
    setContextMenu(null);
    setSelectedConnId(null);

    // If node not in selection, and no shift, select only this
    if (!multiSelect.selectedIds.has(id)) {
      multiSelect.toggleSelect(id, e.shiftKey);
      if (!e.shiftKey) setSelectedNode(id);
    } else if (e.shiftKey) {
      multiSelect.toggleSelect(id, true);
    }

    const scale = zoom / 100;
    setDraggingId(id); // Use draggingId as a generic "drag in progress" flag
    pushHistory(nodes, connections); // Push before drag
    
    // Store original positions for relative group dragging
    const offsetMap: Record<string, { x: number, y: number }> = {};
    const targetIds = multiSelect.selectedIds.has(id) ? Array.from(multiSelect.selectedIds) : [id];
    targetIds.forEach(tId => {
      const n = nodes.find(node => node.id === tId);
      if (n) offsetMap[tId] = { x: e.clientX / scale - n.x, y: e.clientY / scale - n.y };
    });
    setDragOffset(offsetMap as any);
  }, [nodes, zoom, multiSelect, pushHistory, connections]);

  const onResizeMouseDown = useCallback((e: React.MouseEvent, nodeId: string, handle: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    setSelectedNode(nodeId);
    setSelectedConnId(null);
    multiSelect.clearSelect();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    pushHistory(nodes, connections); // Push before resize
    setResizingId(nodeId);
    setResizeHandle(handle);
    setResizeStartSize({ x: node.x, y: node.y, w: node.width, h: node.height });
    setDragOffset({ x: e.clientX, y: e.clientY });
  }, [nodes, multiSelect, pushHistory, connections]);

  // ── Delete Node ───────────────────────────────────────────────────────────────
  const deleteNode = useCallback((id: string) => {
    pushHistory(nodes, connections);
    setNodes(prev => {
      const next = prev.filter(n => n.id !== id);
      debouncedSave(next, connections.filter(c => c.from !== id && c.to !== id));
      return next;
    });
    setConnections(prev => prev.filter(c => c.from !== id && c.to !== id));
    if (selectedNode === id) setSelectedNode(null);
  }, [nodes, connections, selectedNode, debouncedSave, pushHistory]);

  // ── Delete Connection ─────────────────────────────────────────────────────────
  const deleteConnection = useCallback((id: string) => {
    pushHistory(nodes, connections);
    setConnections(prev => {
      const next = prev.filter(c => c.id !== id);
      debouncedSave(nodes, next);
      return next;
    });
  }, [nodes, connections, debouncedSave, pushHistory]);

  // ── Clipboard Operations (Cut / Copy / Paste) ─────────────────────────────────
  const [clipboard, setClipboard] = useState<{ nodes: DiagramNode[], connections: DiagramConnection[] } | null>(null);

  const copySelected = useCallback(() => {
    const nodesToCopy: DiagramNode[] = [];
    const ids = new Set<string>();

    if (multiSelect.selectedIds.size > 0) {
      multiSelect.selectedIds.forEach(id => {
        const n = nodes.find(node => node.id === id);
        if (n) {
          nodesToCopy.push(n);
          ids.add(id);
        }
      });
    } else if (selectedNode) {
      const n = nodes.find(node => node.id === selectedNode);
      if (n) {
        nodesToCopy.push(n);
        ids.add(selectedNode);
      }
    }

    if (nodesToCopy.length === 0) return;

    const connsToCopy = connections.filter(c => ids.has(c.from) && ids.has(c.to));

    setClipboard({
      nodes: JSON.parse(JSON.stringify(nodesToCopy)),
      connections: JSON.parse(JSON.stringify(connsToCopy)),
    });
  }, [nodes, connections, selectedNode, multiSelect]);

  const cutSelected = useCallback(() => {
    copySelected();
    
    pushHistory(nodes, connections);
    const idsToDelete = new Set<string>();
    if (multiSelect.selectedIds.size > 0) {
      multiSelect.selectedIds.forEach(id => idsToDelete.add(id));
    } else if (selectedNode) {
      idsToDelete.add(selectedNode);
    }

    if (idsToDelete.size > 0) {
      setNodes(prev => {
        const next = prev.filter(n => !idsToDelete.has(n.id));
        debouncedSave(next, connections.filter(c => !idsToDelete.has(c.from) && !idsToDelete.has(c.to)));
        return next;
      });
      setConnections(prev => prev.filter(c => !idsToDelete.has(c.from) && !idsToDelete.has(c.to)));
      setSelectedNode(null);
      multiSelect.clearSelect();
    }
  }, [copySelected, nodes, connections, selectedNode, multiSelect, pushHistory, debouncedSave]);

  const pasteSelected = useCallback(() => {
    if (!clipboard || clipboard.nodes.length === 0) return;

    pushHistory(nodes, connections);

    const idMap: Record<string, string> = {};
    const newNodes = clipboard.nodes.map(n => {
      const newId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      idMap[n.id] = newId;

      return {
        ...n,
        id: newId,
        x: n.x + 50,
        y: n.y + 50,
        _animating: true,
      };
    });

    const newConns = clipboard.connections.map(c => {
      const newId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      return {
        ...c,
        id: newId,
        from: idMap[c.from] || c.from,
        to: idMap[c.to] || c.to,
      };
    });

    setNodes(prev => {
      const next = [...prev, ...newNodes];
      debouncedSave(next, [...connections, ...newConns]);
      return next;
    });
    setConnections(prev => [...prev, ...newConns]);

    const pastedIds = newNodes.map(n => n.id);
    if (pastedIds.length === 1) {
      setSelectedNode(pastedIds[0]);
      multiSelect.clearSelect();
    } else {
      setSelectedNode(null);
      multiSelect.setSelection(pastedIds);
    }
  }, [clipboard, nodes, connections, pushHistory, debouncedSave, multiSelect]);

  const pasteFromText = useCallback((text: string) => {
    try {
      const parsed = JSON.parse(text);
      if (parsed && (parsed.nodes || parsed.title)) {
        pushHistory(nodes, connections);
        if (parsed.title) {
          const newId = `node_${Date.now()}`;
          const newNode: DiagramNode = {
            id: newId,
            title: String(parsed.title),
            description: String(parsed.description || ''),
            type: parsed.type || 'Process',
            color: parsed.color || 'blue',
            x: parsed.x || 150,
            y: parsed.y || 150,
            width: parsed.width || 240,
            height: parsed.height || 120,
            icon: parsed.icon,
            notes: parsed.notes,
            variant: parsed.variant,
            customFill: parsed.customFill,
            customBorderColor: parsed.customBorderColor,
            customBorderWidth: parsed.customBorderWidth,
            rotation: parsed.rotation,
          };
          setNodes(prev => [...prev, newNode]);
          setSelectedNode(newId);
          multiSelect.clearSelect();
        } else if (Array.isArray(parsed.nodes)) {
          const idMap: Record<string, string> = {};
          const newNodes = parsed.nodes.map((n: any) => {
            const newId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            idMap[n.id] = newId;
            return {
              ...n,
              id: newId,
              x: (n.x || 100) + 20,
              y: (n.y || 100) + 20,
            };
          });
          const newConns = (parsed.connections || []).map((c: any) => {
            const newId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
            return {
              ...c,
              id: newId,
              from: idMap[c.from] || c.from,
              to: idMap[c.to] || c.to,
            };
          });
          setNodes(prev => [...prev, ...newNodes]);
          setConnections(prev => [...prev, ...newConns]);
        }
      }
    } catch {
      // ignore
    }
  }, [nodes, connections, pushHistory, multiSelect]);

  // ── Node Rotation ─────────────────────────────────────────────────────────────
  const rotateNode = useCallback((id: string, angle: number = 90) => {
    pushHistory(nodes, connections);
    setNodes(prev => prev.map(n => {
      if (n.id === id) {
        const nextRotation = ((n.rotation || 0) + angle) % 360;
        return { ...n, rotation: nextRotation };
      }
      return n;
    }));
  }, [nodes, connections, pushHistory]);

  // ── Group Alignment Operations ───────────────────────────────────────────────
  const alignSelectedNodes = useCallback((alignment: 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom') => {
    const selectedNodes = nodes.filter(n => multiSelect.selectedIds.has(n.id));
    if (selectedNodes.length < 2) return;

    pushHistory(nodes, connections);

    let targetVal = 0;
    if (alignment === 'left') {
      targetVal = Math.min(...selectedNodes.map(n => n.x));
    } else if (alignment === 'right') {
      targetVal = Math.max(...selectedNodes.map(n => n.x + n.width));
    } else if (alignment === 'top') {
      targetVal = Math.min(...selectedNodes.map(n => n.y));
    } else if (alignment === 'bottom') {
      targetVal = Math.max(...selectedNodes.map(n => n.y + n.height));
    } else if (alignment === 'centerX') {
      const minX = Math.min(...selectedNodes.map(n => n.x));
      const maxX = Math.max(...selectedNodes.map(n => n.x + n.width));
      targetVal = minX + (maxX - minX) / 2;
    } else if (alignment === 'centerY') {
      const minY = Math.min(...selectedNodes.map(n => n.y));
      const maxY = Math.max(...selectedNodes.map(n => n.y + n.height));
      targetVal = minY + (maxY - minY) / 2;
    }

    setNodes(prev => prev.map(n => {
      if (!multiSelect.selectedIds.has(n.id)) return n;
      if (alignment === 'left') return { ...n, x: targetVal };
      if (alignment === 'top') return { ...n, y: targetVal };
      if (alignment === 'right') return { ...n, x: targetVal - n.width };
      if (alignment === 'bottom') return { ...n, y: targetVal - n.height };
      if (alignment === 'centerX') return { ...n, x: targetVal - n.width / 2 };
      if (alignment === 'centerY') return { ...n, y: targetVal - n.height / 2 };
      return n;
    }));
  }, [nodes, connections, multiSelect, pushHistory]);

  const distributeSelected = useCallback((direction: 'horizontal' | 'vertical') => {
    const selectedNodes = [...nodes.filter(n => multiSelect.selectedIds.has(n.id))];
    if (selectedNodes.length < 3) return;

    pushHistory(nodes, connections);

    if (direction === 'horizontal') {
      selectedNodes.sort((a, b) => a.x - b.x);
      const minX = selectedNodes[0].x;
      const maxX = selectedNodes[selectedNodes.length - 1].x;
      const totalWidthOfInnerNodes = selectedNodes.slice(1, -1).reduce((sum, n) => sum + n.width, 0);
      const totalSpacing = maxX - minX - selectedNodes[0].width - totalWidthOfInnerNodes;
      const spacing = totalSpacing / (selectedNodes.length - 1);

      setNodes(prev => prev.map(n => {
        if (!multiSelect.selectedIds.has(n.id) || n.id === selectedNodes[0].id || n.id === selectedNodes[selectedNodes.length - 1].id) {
          return n;
        }
        const idx = selectedNodes.findIndex(sn => sn.id === n.id);
        let accX = minX;
        for (let i = 0; i < idx; i++) {
          accX += selectedNodes[i].width + spacing;
        }
        return { ...n, x: Math.round(accX) };
      }));
    } else {
      selectedNodes.sort((a, b) => a.y - b.y);
      const minY = selectedNodes[0].y;
      const maxY = selectedNodes[selectedNodes.length - 1].y;
      const totalHeightOfInnerNodes = selectedNodes.slice(1, -1).reduce((sum, n) => sum + n.height, 0);
      const totalSpacing = maxY - minY - selectedNodes[0].height - totalHeightOfInnerNodes;
      const spacing = totalSpacing / (selectedNodes.length - 1);

      setNodes(prev => prev.map(n => {
        if (!multiSelect.selectedIds.has(n.id) || n.id === selectedNodes[0].id || n.id === selectedNodes[selectedNodes.length - 1].id) {
          return n;
        }
        const idx = selectedNodes.findIndex(sn => sn.id === n.id);
        let accY = minY;
        for (let i = 0; i < idx; i++) {
          accY += selectedNodes[i].height + spacing;
        }
        return { ...n, y: Math.round(accY) };
      }));
    }
  }, [nodes, connections, multiSelect, pushHistory]);

  // ── Image Upload Node Creator ────────────────────────────────────────────────
  const handleCanvasImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Data = event.target?.result as string;
      if (!base64Data) return;

      const colors: NodeColor[] = ['blue', 'violet', 'green', 'amber', 'rose', 'indigo'];
      const color = colors[nodes.length % colors.length];
      const newNode: DiagramNode = {
        id: `node_${Date.now()}`,
        title: file.name.split('.')[0] || 'Uploaded Image',
        description: 'Uploaded image node',
        type: 'Process',
        x: 150 + (nodes.length % 3) * 280,
        y: 150 + Math.floor(nodes.length / 3) * 180,
        width: 240,
        height: 180,
        color,
        imageUrl: base64Data,
      };

      pushHistory(nodes, connections);
      setNodes(prev => {
        const next = [...prev, newNode];
        debouncedSave(next, connections);
        return next;
      });
      setSelectedNode(newNode.id);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [nodes, connections, debouncedSave, pushHistory]);

  const deleteSelected = useCallback(() => {
    pushHistory(nodes, connections);
    const nodesToDelete = new Set<string>();
    if (selectedNode) nodesToDelete.add(selectedNode);
    multiSelect.selectedIds.forEach(id => nodesToDelete.add(id));

    if (nodesToDelete.size > 0) {
      setNodes(prev => {
        const next = prev.filter(n => !nodesToDelete.has(n.id));
        debouncedSave(next, connections.filter(c => !nodesToDelete.has(c.from) && !nodesToDelete.has(c.to)));
        return next;
      });
      setConnections(prev => prev.filter(c => !nodesToDelete.has(c.from) && !nodesToDelete.has(c.to)));
      setSelectedNode(null);
      multiSelect.clearSelect();
    } else if (selectedConnId) {
      deleteConnection(selectedConnId);
    }
  }, [nodes, connections, selectedNode, selectedConnId, multiSelect, deleteConnection, debouncedSave, pushHistory]);

  const onCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    const scale = zoom / 100;
    if (draggingId && dragOffset && typeof dragOffset === 'object') {
      const targetIds = multiSelect.selectedIds.has(draggingId) ? Array.from(multiSelect.selectedIds) : [draggingId];
      setNodes(prev => prev.map(n => {
        if (targetIds.includes(n.id)) {
          const offsets = (dragOffset as Record<string, {x:number, y:number}>)[n.id];
          if (!offsets) return n;
          const nx = Math.round((e.clientX / scale - offsets.x) / 10) * 10;
          const ny = Math.round((e.clientY / scale - offsets.y) / 10) * 10;
          return { ...n, x: Math.max(0, nx), y: Math.max(0, ny) };
        }
        return n;
      }));
    } else if (resizingId && resizeHandle) {
      const dx = (e.clientX - (dragOffset as any).x) / scale;
      const dy = (e.clientY - (dragOffset as any).y) / scale;
      setNodes(prev => prev.map(n => {
        if (n.id !== resizingId) return n;
        let { x, y, w, h } = resizeStartSize;
        if (resizeHandle.includes('right')) w = Math.max(80, w + dx);
        if (resizeHandle.includes('bottom')) h = Math.max(60, h + dy);
        if (resizeHandle.includes('left')) { const newW = Math.max(80, w - dx); x = x + (w - newW); w = newW; }
        if (resizeHandle.includes('top')) { const newH = Math.max(60, h - dy); y = y + (h - newH); h = newH; }
        return { ...n, x, y, width: w, height: h };
      }));
    } else if (isPanning) {
      setPanOffset({ x: panOffset.x + (e.clientX - panStart.x), y: panOffset.y + (e.clientY - panStart.y) });
      setPanStart({ x: e.clientX, y: e.clientY });
    } else if (multiSelect.isDrawingBox && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      multiSelect.updateBox(e.clientX, e.clientY, nodes, scale, panOffset, rect);
    }
    
    if (connectingFrom || draggingConnHandle) {
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left - panOffset.x) / scale;
        const mouseY = (e.clientY - rect.top - panOffset.y) / scale;
        setCanvasMousePos({ x: mouseX, y: mouseY });
        
        if (draggingConnHandle && draggingConnHandle.end === 'mid' && draggingConnHandle.startPos) {
          const dx = mouseX - draggingConnHandle.startPos.x;
          const dy = mouseY - draggingConnHandle.startPos.y;
          const offsetDiff = draggingConnHandle.axis === 'x' ? dx : dy;
          const newOffset = Math.round((draggingConnHandle.startOffset || 0) + offsetDiff);
          
          if (connDragRaf.current !== null) cancelAnimationFrame(connDragRaf.current);
          connDragRaf.current = requestAnimationFrame(() => {
            connDragRaf.current = null;
            setConnections(prev => prev.map(c => 
              c.id === draggingConnHandle.connId ? { ...c, routingOffset: newOffset } : c
            ));
          });
        }
      }
    }
  }, [draggingId, dragOffset, zoom, isPanning, panOffset, panStart, resizingId, resizeHandle, resizeStartSize, multiSelect, nodes, connectingFrom, draggingConnHandle]);

  const onCanvasMouseUp = useCallback(() => {
    if (draggingId || resizingId) {
      debouncedSave(nodes, connections);
    }
    if (multiSelect.isDrawingBox) {
      multiSelect.endBox();
    }
    setDraggingId(null);
    setResizingId(null);
    setResizeHandle(null);
    setIsPanning(false);

    if (draggingConnHandle) {
      if (connDragRaf.current !== null) cancelAnimationFrame(connDragRaf.current);
      connDragRaf.current = null;
      if (draggingConnHandle.end === 'mid') {
        debouncedSave(nodes, connections);
      } else {
        // dropped on canvas -> delete connection
        deleteConnection(draggingConnHandle.connId);
      }
      setDraggingConnHandle(null);
    }
    if (connectingFrom) {
      setConnectingFrom(null);
    }
  }, [draggingId, resizingId, nodes, connections, debouncedSave, multiSelect, draggingConnHandle, deleteConnection, connectingFrom]);

  // ── Minimap Drag Handlers ──────────────────────────────────────────────────
  const handleMinimapDragStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Only allow left-click
    const currentX = minimapPos?.x ?? 280;
    const currentY = minimapPos?.y ?? (windowSize.height - 200);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: currentX,
      posY: currentY,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.stopPropagation();
  }, [minimapPos, windowSize.height]);

  const handleMinimapDragMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;
    const newX = Math.max(0, Math.min(windowSize.width - 200, dragStartRef.current.posX + dx));
    const newY = Math.max(0, Math.min(windowSize.height - 180, dragStartRef.current.posY + dy));
    setMinimapPos({ x: newX, y: newY });
    e.stopPropagation();
  }, [windowSize]);

  const handleMinimapDragEnd = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;
    dragStartRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
    e.stopPropagation();
  }, []);

  const onCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 2) {
      // Right click canvas
      setContextMenu({ type: 'canvas', x: e.clientX, y: e.clientY });
      return;
    }
    setSelectedNode(null);
    setSelectedConnId(null);
    setContextMenu(null);
    setConnectingFrom(null);
    if (e.button === 1 || (e.button === 0 && (e.altKey || panMode))) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
    } else if (e.button === 0) {
      if (!e.shiftKey) multiSelect.clearSelect();
      multiSelect.startBox(e.clientX, e.clientY);
    }
  }, [multiSelect, panMode]);

  // ── Connect Mode ──────────────────────────────────────────────────────────────
  const onPortClick = useCallback((e: React.MouseEvent, nodeId: string, portId: 't'|'r'|'b'|'l') => {
    e.stopPropagation();
    if (draggingConnHandle) {
      pushHistory(nodes, connections);
      setConnections(prev => {
        const next = prev.map(c => c.id === draggingConnHandle.connId ? { ...c, [draggingConnHandle.end]: nodeId } : c);
        debouncedSave(nodes, next);
        return next;
      });
      setDraggingConnHandle(null);
      } else if (connectingFrom && connectingFrom.nodeId !== nodeId) {
        pushHistory(nodes, connections);
        const newConn: DiagramConnection = {
          id: `conn_${Date.now()}`,
          from: connectingFrom.nodeId,
          to: nodeId,
          fromPort: connectingFrom.portId,
          toPort: 't', // default to top if they just clicked the node
          type: activeConnType,
          arrowhead: activeArrow,
          lineStyle: activeLineStyle,
          arrowDirection: activeArrowDirection,
        };
        setConnections(prev => {
          const next = [...prev, newConn];
          debouncedSave(nodes, next);
          return next;
        });
        setConnectingFrom(null);
      } else {
        setConnectingFrom({ nodeId, portId });
      }
  }, [connectingFrom, activeConnType, activeArrow, activeLineStyle, activeArrowDirection, nodes, connections, debouncedSave, pushHistory, draggingConnHandle]);

  // ── Add Node ──────────────────────────────────────────────────────────────────
  const addNode = useCallback((type: NodeType) => {
    const colors: NodeColor[] = ['blue', 'violet', 'green', 'amber', 'rose', 'indigo'];
    const color = colors[nodes.length % colors.length];
    
    let width = 240;
    let height = 120;
    let desc = 'Click to edit this node';
    let notes: string | undefined = undefined;

    if (type === 'Square') { width = 150; height = 150; }
    else if (type === 'Swimlane') { width = 280; height = 500; desc = 'Role / Process Lane'; }
    else if (type === 'Gantt') { width = 280; height = 60; desc = 'Task Duration'; }
    else if (type === 'UMLClass') { 
      width = 240; height = 160; 
      desc = '+ id: int\n+ name: string'; 
      notes = '+ save(): void\n+ delete(): void'; 
    }
    else if (type === 'EREntity') { width = 240; height = 160; desc = 'id (pk)\nname\nemail'; }
    else if (type === 'CircuitResistor' || type === 'CircuitCapacitor') { width = 120; height = 60; desc = ''; }
    else if (type === 'CircuitGround') { width = 80; height = 80; desc = ''; }
    else if (type === 'CircuitSource') { width = 100; height = 100; desc = ''; }
    else if (type === 'VennCircle') { width = 250; height = 250; desc = 'Category overlapping group'; }
    else if (type === 'BarSegment') { width = 80; height = 240; desc = 'Value: 85'; }
    else if (type === 'PieWedge') { width = 150; height = 150; desc = 'Share: 35%'; }
    else if (type === 'LinePoint' || type === 'ScatterPoint') { width = 60; height = 60; desc = ''; }
    else if (type === 'HistogramBar') { width = 80; height = 240; desc = 'Frequency: 45'; }
    else if (type === 'DFDProcess') { width = 120; height = 120; desc = 'Process Data'; }
    else if (type === 'DFDDataStore') { width = 180; height = 80; desc = 'Data Store'; }
    else if (type === 'DFDExternalEntity') { width = 150; height = 120; desc = 'External Entity'; }

    const newNode: DiagramNode = {
      id: `node_${Date.now()}`,
      title: `New ${type}`,
      description: desc,
      type,
      x: 100 + (nodes.length % 4) * 280,
      y: 100 + Math.floor(nodes.length / 4) * 180,
      width,
      height,
      color,
      notes,
    };
    pushHistory(nodes, connections);
    setNodes(prev => {
      const next = [...prev, newNode];
      debouncedSave(next, connections);
      return next;
    });
    setSelectedNode(newNode.id);
  }, [nodes, connections, debouncedSave, pushHistory]);

  const addIconNode = useCallback((iconName: string) => {
    const colors: NodeColor[] = ['blue', 'violet', 'green', 'amber', 'rose', 'indigo'];
    const color = colors[nodes.length % colors.length];
    
    // Attempt to guess category based on some basic matching, else default to Process
    let type: NodeType = 'Process';
    if (['person', 'group', 'account_circle', 'support_agent', 'engineering', 'manage_accounts', 'badge', 'supervisor_account', 'face', 'admin_panel_settings', 'nurse', 'physician', 'doctor', 'dentist', 'pharmacist', 'worker', 'operator', 'supervisor', 'user_health', 'user_heart', 'paramedic', 'surgeon', 'man_worker', 'man_manufacturing', 'real_estate_agent'].includes(iconName)) type = 'People';
    else if (['database', 'dns', 'router', 'storage', 'terminal', 'memory', 'memory_alt', 'developer_board', 'hub', 'api', 'code', 'computer', 'laptop', 'desktop_windows', 'desktop_mac', 'devices', 'developer_mode', 'folder', 'file_copy', 'file_download', 'file_upload', 'data_array', 'data_object', 'key', 'lock', 'security', 'bug_report', 'deployed_code', 'function', 'algorithm', 'schema', 'tree', 'node', 'command_line', 'code_blocks', 'source', 'lan', 'electric_bolt', 'electric_car', 'power', 'power_off', 'battery_full', 'battery_std', 'battery_charging_full', 'cable', 'charging_station', 'electrical_services', 'flash_on', 'high_voltage', 'outlet', 'plug', 'socket', 'sensors', 'hardware', 'chip', 'circuit_board', 'component', 'motherboard', 'processor', 'ram', 'sd_card', 'sim_card', 'smart_toy', 'auto_awesome', 'psychology', 'brain', 'neural_network', 'cognition', 'model_training', 'analytics', 'monitoring', 'wifi', 'bluetooth', 'smartphone', 'signal_cellular_alt', 'signal_wifi_4_bar', 'thermostat', 'tv', 'usb', 'nfc', 'satellite_alt', 'scanner', 'smart_display', 'smart_screen', 'device_thermostat', 'sensor_door', 'sensor_occupied', 'iot', 'iot_outline', 'microprocessor', 'microcontroller', 'architecture', 'construction', 'crane', 'hard_hat', 'civil_engineering', 'infrastructure', 'engineer', 'blueprint', 'draw', 'floorplan', 'plan_building', 'ruler', 'survey', 'topography', 'build', 'build_circle', 'handyman', 'gear', 'cog', 'precision_manufacturing', 'assembly', 'automation', 'conveyor', 'factory', 'manufacturing', 'machine', 'machinery', 'mechanical', 'mechanic', 'robot', 'robotics', 'turbine', 'generator', 'engine', 'motor', 'pump', 'valve', 'compressor', 'boiler', 'pipeline', 'plumbing', 'pipe', 'faucet', 'sink', 'bath', 'shower', 'toilet', 'bathtub', 'hot_tub', 'pool', 'tap', 'drain', 'water_pump', 'water_heater', 'biotech', 'science', 'experiment', 'biology', 'dna', 'chromosome', 'genetics', 'microscope', 'lab', 'laboratory', 'flask', 'chemistry', 'chemical', 'petri_dish', 'virus', 'bacteria', 'molecule', 'cell_biology', 'gene', 'genome', 'organism', 'protein', 'enzyme', 'seed', 'leaf', 'sprout', 'plant', 'medical_services', 'hospital', 'health_and_safety', 'healthcare', 'medicine', 'medication', 'pill', 'vaccine', 'emergency', 'first_aid', 'stethoscope', 'heartbeat', 'ecg', 'ekg', 'blood_pressure', 'thermometer', 'ambulance', 'surgery', 'wheelchair', 'bone', 'tooth', 'eye', 'ear', 'lungs', 'kidney', 'liver', 'medical_mask', 'sanitizer', 'health', 'wellness', 'fitness', 'clinical', 'lab_results', 'server', 'rack', 'blade', 'chassis', 'mainframe', 'supercomputer', 'hosting', 'cluster', 'load_balancer', 'firewall', 'proxy', 'gateway', 'vpn', 'subnet', 'topology', 'lan', 'wan', 'ethernet', 'fiber', 'modem', 'switch', 'bridge', 'repeater', 'access_point', 'protocol', 'packet', 'bandwidth', 'latency', 'throughput', 'traffic', 'ip_address', 'mac_address', 'vlan', 'broadcast', 'multicast', 'load_balancing', 'failover', 'networking', 'network_switch', 'network_router', 'network_firewall', 'network_node', 'network_hub', 'network_management', 'network_intelligence', 'network_ping', 'network_question'].includes(iconName)) type = 'Technical';
    else if (['cloud', 'cloud_queue', 'cloud_done', 'cloud_off', 'cast', 'cast_connected', 'device_hub', 'network_check', 'network_locked', 'network_wifi', 'wifi_tethering', 'wifi_calling', 'wifi_channel', 'wifi_find', 'wireless_home', 'private_cloud', 'public_cloud', 'hybrid_cloud', 'multi_cloud', 'cloud_storage', 'cloud_backup', 'cloud_sync', 'cloud_upload', 'cloud_download', 'cloud_circle'].includes(iconName)) type = 'Cloud';

    const newNode: DiagramNode = {
      id: `node_${Date.now()}`,
      title: iconName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      description: '',
      type,
      icon: iconName,
      variant: 'icon',
      x: 100 + (nodes.length % 4) * 280,
      y: 100 + Math.floor(nodes.length / 4) * 180,
      width: 80,
      height: 80,
      color,
    };
    pushHistory(nodes, connections);
    setNodes(prev => {
      const next = [...prev, newNode];
      debouncedSave(next, connections);
      return next;
    });
    setSelectedNode(newNode.id);
  }, [nodes, connections, debouncedSave, pushHistory]);

  // ── Duplicate Node ────────────────────────────────────────────────────────────
  const duplicateNode = useCallback((id: string) => {
    const src = nodes.find(n => n.id === id);
    if (!src) return;
    const dup: DiagramNode = {
      ...src,
      id: `node_${Date.now()}`,
      x: src.x + 30,
      y: src.y + 30,
      _animating: true,
    };
    pushHistory(nodes, connections);
    setNodes(prev => {
      const next = [...prev, dup];
      debouncedSave(next, connections);
      return next;
    });
    setSelectedNode(dup.id);
  }, [nodes, connections, debouncedSave, pushHistory]);

  // ── Alignment Controls ────────────────────────────────────────────────────────
  const alignSelected = useCallback((axis: 'left' | 'right' | 'top' | 'bottom' | 'centerH' | 'centerV') => {
    if (!selectedNode) return;
    const sel = nodes.find(n => n.id === selectedNode);
    if (!sel) return;
    pushHistory(nodes, connections);
    const ref = { left: sel.x, top: sel.y, right: sel.x + sel.width, bottom: sel.y + sel.height };
    setNodes(prev => {
      const next = prev.map(n => {
        if (n.id === selectedNode) return n;
        switch (axis) {
          case 'left':    return { ...n, x: ref.left };
          case 'right':   return { ...n, x: ref.right - n.width };
          case 'top':     return { ...n, y: ref.top };
          case 'bottom':  return { ...n, y: ref.bottom - n.height };
          case 'centerH': return { ...n, x: ref.left + (sel.width - n.width) / 2 };
          case 'centerV': return { ...n, y: ref.top + (sel.height - n.height) / 2 };
          default: return n;
        }
      });
      debouncedSave(next, connections);
      return next;
    });
  }, [selectedNode, nodes, connections, debouncedSave, pushHistory]);

  // ── Auto layout ───────────────────────────────────────────────────────────────
  const autoLayout = useCallback(() => {
    pushHistory(nodes, connections);
    const cols = Math.ceil(Math.sqrt(nodes.length));
    setNodes(prev => {
      const next = prev.map((n, i) => ({
        ...n,
        x: 60 + (i % cols) * 300,
        y: 60 + Math.floor(i / cols) * 200,
      }));
      debouncedSave(next, connections);
      return next;
    });
  }, [nodes, connections, debouncedSave, pushHistory]);

  // ── Apply Template ────────────────────────────────────────────────────────────
  const applyTemplate = useCallback((template: DiagramTemplate) => {
    pushHistory(nodes, connections);
    const newNodes = template.nodes.map(n => ({ ...n, _animating: true }));
    const newConns = template.connections.map(c => ({ ...c }));
    setNodes([]);
    setTimeout(() => {
      setNodes(newNodes);
      setTimeout(() => {
        setNodes(prev => prev.map(n => ({ ...n, _animating: false })));
      }, 500);
      setConnections(newConns);
      debouncedSave(newNodes, newConns);
    }, 80);
    setShowTemplates(false);
    setSelectedNode(null);
    multiSelect.clearSelect();
  }, [nodes, connections, debouncedSave, pushHistory, multiSelect]);

  const applyTemplateStaggered = useCallback((template: DiagramTemplate) => {
    pushHistory(nodes, connections);
    
    // Clear canvas first
    setNodes([]);
    setConnections([]);
    
    const newNodes = template.nodes.map(n => ({ ...n, _animating: true }));
    const newConns = template.connections.map(c => ({ ...c }));
    
    // Animate nodes appearing one-by-one in a progressive staggered manner
    newNodes.forEach((node, i) => {
      setTimeout(() => {
        setNodes(prev => {
          const exists = prev.find(n => n.id === node.id);
          if (exists) return prev.map(n => n.id === node.id ? { ...node, _animating: true } : n);
          return [...prev, { ...node, _animating: true }];
        });
        
        // Disable animating flag after entrance animation completes
        setTimeout(() => {
          setNodes(prev => prev.map(n => n.id === node.id ? { ...n, _animating: false } : n));
        }, 400);
        
        // Once last node is loaded, apply connections
        if (i === newNodes.length - 1) {
          setTimeout(() => {
            setConnections(newConns);
            debouncedSave(newNodes, newConns);
          }, 200);
        }
      }, i * 150); // staggered 150ms delay between nodes
    });
  }, [nodes, connections, debouncedSave, pushHistory]);

  // ── Mermaid code mode sync ────────────────────────────────────────────────────
  const applyMermaidCode = useCallback(() => {
    const { nodes: newNodes, connections: newConns } = mermaidToNodes(mermaidCode);
    if (newNodes.length > 0) {
      setNodes(newNodes);
      setConnections(newConns);
      debouncedSave(newNodes, newConns);
    }
  }, [mermaidCode, debouncedSave]);

  // ── Sync Canvas Tool Mode with Pan State ──────────────────────────────────────
  useEffect(() => {
    setPanMode(activeTool === 'hand');
    if (activeTool !== 'connect') {
      setConnectingFrom(null);
    }
  }, [activeTool, setPanMode, setConnectingFrom]);

  // ── Share ─────────────────────────────────────────────────────────────────────
  const handleShare = useCallback(() => {
    try {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = window.location.href;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, []);

  // ── AI Chat ───────────────────────────────────────────────────────────────────
  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setChatImage(reader.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, []);

  const handleSendChat = useCallback((overrideInput?: string, overrideImage?: string | null) => {
    let text = (overrideInput ?? chatInput).trim();
    const image = overrideImage !== undefined ? overrideImage : chatImage;
    if (!text && image) {
      text = "Analyze this diagram screenshot and build/update it on the canvas.";
    }
    if (!text || aiLoading) return;

    // Gallery Matching Interception
    const lower = text.toLowerCase();
    let matchedTemplate: DiagramTemplate | null = null;

    if (lower.includes('computer block') || lower.includes('block diagram') || (lower.includes('computer') && lower.includes('diagram') && !lower.includes('network') && !lower.includes('cloud'))) {
      matchedTemplate = DIAGRAM_TEMPLATES.find(t => t.id === 'computer-block') || null;
    } else if (lower.includes('microservices') || lower.includes('microservice') || lower.includes('service mesh')) {
      matchedTemplate = DIAGRAM_TEMPLATES.find(t => t.id === 'microservices') || null;
    } else if (lower.includes('cicd') || lower.includes('ci/cd') || lower.includes('pipeline') || lower.includes('deployment flow')) {
      matchedTemplate = DIAGRAM_TEMPLATES.find(t => t.id === 'cicd') || null;
    } else if (lower.includes('rest api') || lower.includes('api flow') || (lower.includes('api') && lower.includes('load balancer'))) {
      matchedTemplate = DIAGRAM_TEMPLATES.find(t => t.id === 'rest-api') || null;
    } else if (lower.includes('event driven') || lower.includes('kafka') || lower.includes('event-driven') || lower.includes('broker') || lower.includes('pub sub')) {
      matchedTemplate = DIAGRAM_TEMPLATES.find(t => t.id === 'event-driven') || null;
    } else if (lower.includes('database schema') || lower.includes('database erd') || lower.includes('entity relationship') || lower.includes('er-diagram') || lower.includes('erd')) {
      matchedTemplate = DIAGRAM_TEMPLATES.find(t => t.id === 'er-diagram') || null;
    } else if (lower.includes('uml class') || lower.includes('class diagram') || lower.includes('uml diagram')) {
      matchedTemplate = DIAGRAM_TEMPLATES.find(t => t.id === 'uml-class') || null;
    } else if (lower.includes('venn diagram') || lower.includes('venn chart') || lower.includes('overlap')) {
      matchedTemplate = DIAGRAM_TEMPLATES.find(t => t.id === 'venn-diagram') || null;
    } else if (lower.includes('swimlane') || lower.includes('swim lane') || lower.includes('process lane')) {
      matchedTemplate = DIAGRAM_TEMPLATES.find(t => t.id === 'swimlane-flow') || null;
    } else if (lower.includes('gantt') || lower.includes('project schedule') || lower.includes('timeline bar')) {
      matchedTemplate = DIAGRAM_TEMPLATES.find(t => t.id === 'gantt-chart') || null;
    } else if (lower.includes('circuit') || lower.includes('schematic') || lower.includes('resistor') || lower.includes('capacitor') || lower.includes('ground wire')) {
      matchedTemplate = DIAGRAM_TEMPLATES.find(t => t.id === 'circuit-diagram') || null;
    } else if (lower.includes('bar diagram') || lower.includes('bar chart') || lower.includes('cost comparison')) {
      matchedTemplate = DIAGRAM_TEMPLATES.find(t => t.id === 'bar-chart') || null;
    } else if (lower.includes('pie chart') || lower.includes('pie diagram') || lower.includes('market share')) {
      matchedTemplate = DIAGRAM_TEMPLATES.find(t => t.id === 'pie-chart') || null;
    } else if (lower.includes('aws') || lower.includes('cloudfront') || lower.includes('aurora') || lower.includes('s3 bucket')) {
      matchedTemplate = DIAGRAM_TEMPLATES.find(t => t.id === 'aws') || null;
    } else if (lower.includes('kubernetes') || lower.includes('k8s') || lower.includes('ingress') || lower.includes('cluster')) {
      matchedTemplate = DIAGRAM_TEMPLATES.find(t => t.id === 'kubernetes') || null;
    } else if (lower.includes('auth flow') || lower.includes('login') || lower.includes('authentication') || lower.includes('jwt')) {
      matchedTemplate = DIAGRAM_TEMPLATES.find(t => t.id === 'auth-flow') || null;
    } else if (lower.includes('monolith migration') || lower.includes('strangler fig') || lower.includes('strangler migration') || lower.includes('monolith to microservices')) {
      matchedTemplate = DIAGRAM_TEMPLATES.find(t => t.id === 'monolith-migration') || null;
    }

    if (matchedTemplate) {
      setChatInput('');
      setChatImage(null);
      setChatMessages(prev => [...prev, { role: 'user', content: text }]);
      
      const explanation = `I have recognized your request as a standard architectural pattern! I am picking our premium Systems Architect Gallery template: **${matchedTemplate.name}** to serve as your foundation. 🚀

Reconstructing and assembling this verified architecture pattern on your canvas in a buttery-smooth, animated, progressive staggered manner...`;
      
      setTimeout(() => {
        setChatMessages(prev => [...prev, { role: 'assistant', content: explanation }]);
        applyTemplateStaggered(matchedTemplate!);
      }, 350);
      return;
    }
    setChatInput('');
    setChatImage(null);
    // Build the full history including the NEW user message before calling sendMessage.
    // We cannot rely on chatMessages here because setChatMessages is async — the new
    // user turn has NOT been appended to chatMessages yet at this point in the call.
    const fullHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [
      ...chatMessages,
      { role: 'user', content: text },
    ];
    setChatMessages(prev => [...prev, { role: 'user', content: text }]);
    sendMessage(text, image || undefined, fullHistory);
  }, [chatInput, chatImage, aiLoading, sendMessage, applyTemplateStaggered, chatMessages]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
      const shift = e.shiftKey;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelected();
      }
      if (cmdOrCtrl && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        copySelected();
      }
      if (cmdOrCtrl && e.key.toLowerCase() === 'x') {
        e.preventDefault();
        cutSelected();
      }
      if (cmdOrCtrl && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        pasteSelected();
      }
      if (cmdOrCtrl && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (shift) { redo(nodes, connections); }
        else { undo(nodes, connections); }
      }
      if (cmdOrCtrl && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo(nodes, connections);
      }
      if (cmdOrCtrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveToServer(nodes, connections);
      }
      if (cmdOrCtrl && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        multiSelect.selectAll(nodes.map(n => n.id));
      }
      if (cmdOrCtrl && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        if (selectedNode) duplicateNode(selectedNode);
      }
      if (cmdOrCtrl && shift && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        const selected = nodes.find(n => n.id === selectedNode);
        if (selected) {
          const colorKeys = Object.keys(DARK_COLOR_MAP) as NodeColor[];
          const nextIdx = (colorKeys.indexOf(selected.color) + 1) % colorKeys.length;
          updateNode(selected.id, { color: colorKeys[nextIdx], customFill: undefined });
        }
      }
      if (e.key === '=' || e.key === '+') setZoom(z => Math.min(200, z + 10));
      if (e.key === '-') setZoom(z => Math.max(30, z - 10));
      if (e.key === '0') { setZoom(100); setPanOffset({ x: 0, y: 0 }); }
      if (e.key === 'Escape') { setSelectedNode(null); setSelectedConnId(null); setConnectingFrom(null); multiSelect.clearSelect(); }
      if (e.key === 'h' || e.key === 'H') { setTool(isHand ? 'select' : 'hand'); }
    };

    const onPaste = (e: ClipboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return;
      const text = e.clipboardData?.getData('text');
      if (text) {
        pasteFromText(text);
      }
    };

    window.addEventListener('keydown', onKey);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('paste', onPaste);
    };
  }, [selectedNode, selectedConnId, multiSelect, deleteSelected, copySelected, cutSelected, pasteSelected, pasteFromText, undo, redo, nodes, connections, saveToServer, duplicateNode, updateNode, isHand, setTool]);

  const isLight = canvasBg === 'white' || isAppLight;
  // Theme-aware card/button background and text for inline styles (cannot be targeted by CSS selectors)
  const cardBg   = isAppLight ? '#f0f2f5' : '#1c2b3c';
  const cardText  = isAppLight ? '#1f2937' : '#c6c6cb';
  const inputBg  = isAppLight ? '#ffffff' : '#0b1424';
  const inputText = isAppLight ? '#111827' : '#ffffff';
  const panelBg  = isAppLight ? 'rgba(255,255,255,0.92)' : 'rgba(7,16,28,0.97)';

  return (
    <div
      className={`flex h-screen font-sans overflow-hidden select-none ${isLight ? 'theme-light text-slate-900' : 'theme-dark text-[#d4e4fa]'}`}
      style={{ background: isLight ? '#f3f4f6' : '#051424' }}
      onMouseMove={onCanvasMouseMove}
      onMouseUp={onCanvasMouseUp}
    >
      <input
        type="file"
        id="canvas-image-upload"
        accept="image/*"
        className="hidden"
        onChange={handleCanvasImageUpload}
      />

      {/* ══════════════════════════════════════════════════════════════════════
          TOP HEADER
      ══════════════════════════════════════════════════════════════════════ */}
      <header
        className="glass rim fixed top-0 w-full h-[70px] border-b flex justify-between items-center px-3 md:px-6 z-50 overflow-hidden gap-2"
        style={{ borderColor: isLight ? 'var(--editor-border)' : 'rgba(69,71,75,0.25)' }}
      >
        {/* Left: brand + nav — flex-1 allows shrink, min-w-0 prevents overflow */}
        <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
          {/* App Brand + Project Title */}
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-amber-400 flex-shrink-0" style={{ fontSize: 22 }}>schema</span>
            <div className="flex flex-col justify-center leading-tight">
              <span className="text-[9px] font-black uppercase tracking-widest text-[#6b7a8d]">AI Diagram Studio</span>

              {/* Inline-editable project title */}
              {isEditingTitle ? (
                <input
                  ref={titleInputRef}
                  value={editTitleValue}
                  onChange={e => setEditTitleValue(e.target.value)}
                  onBlur={() => {
                    const trimmed = editTitleValue.trim() || 'Untitled Diagram';
                    setProjectTitle(trimmed);
                    setIsEditingTitle(false);
                    saveToServer(nodes, connections, trimmed);
                    // Also refresh recent projects list so it reflects the new name
                    setRecentProjects(prev => prev.map(p => p.id === projectId ? { ...p, title: trimmed } : p));
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    if (e.key === 'Escape') { setIsEditingTitle(false); setEditTitleValue(projectTitle); }
                  }}
                  className="text-[13px] font-bold text-white bg-transparent border-b border-violet-400 outline-none w-48 pb-0.5 placeholder-white/30"
                  style={{ minWidth: 80, maxWidth: 240 }}
                  maxLength={80}
                  placeholder="Project name…"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => { setEditTitleValue(projectTitle); setIsEditingTitle(true); setTimeout(() => titleInputRef.current?.select(), 30); }}
                  className="flex items-center gap-1 group cursor-pointer bg-transparent border-none p-0 text-left"
                  title="Click to rename this diagram"
                >
                  <span className="text-[13px] font-bold text-white group-hover:text-violet-300 transition-colors truncate max-w-[200px]">
                    {projectTitle}
                  </span>
                  <span className="material-symbols-outlined text-white/25 group-hover:text-violet-400 transition-colors flex-shrink-0" style={{ fontSize: 13 }}>edit</span>
                </button>
              )}
            </div>
            {saveStatus === 'saving' && <span className="text-[10px] text-[#c6c6cb] animate-pulse ml-1">Saving…</span>}
            {saveStatus === 'saved'  && <span className="text-[10px] text-emerald-400 ml-1">● Saved</span>}
            {saveStatus === 'unsaved'&& <span className="text-[10px] text-amber-400 ml-1">● Unsaved</span>}
          </div>

          <div className="h-5 w-px bg-white/10" />

          {/* Recent Projects Dropdown */}
          <div className="relative" ref={recentMenuRef}>
            <button
              onClick={() => setRecentMenuOpen(v => !v)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                recentMenuOpen
                  ? 'bg-violet-500/20 text-violet-300 border-violet-500/50'
                  : 'bg-[#1c2b3c] text-[#c6c6cb] border-white/8 hover:text-white hover:border-white/20'
              }`}
              title="Open a recent diagram project"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>history</span>
              Recent
              <span className="material-symbols-outlined transition-transform" style={{ fontSize: 12, transform: recentMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>expand_more</span>
            </button>

            {recentMenuOpen && (
              <div
                className="absolute left-0 top-full mt-2 z-[200] rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
                style={{
                  width: 320,
                  background: panelBg,
                  backdropFilter: 'blur(24px)',
                  boxShadow: '0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(139,92,246,0.1)',
                }}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-violet-400" style={{ fontSize: 16 }}>history</span>
                    <span className="text-[11px] font-black uppercase tracking-widest text-white">Recent Projects</span>
                  </div>
                  <button
                    onClick={() => {
                      setCreating(true);
                      fetch('/api/diagrams', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ title: 'Untitled Diagram' }),
                      })
                        .then(r => r.json())
                        .then(data => {
                          if (data.error === 'LIMIT_REACHED') {
                            setShowLimitModal(true);
                            return;
                          }
                          if (data.projectId) {
                            setRecentMenuOpen(false);
                            router.push(`/diagrams/editor?id=${data.projectId}`);
                          }
                        })
                        .catch(console.error)
                        .finally(() => setCreating(false));
                    }}
                    disabled={creating}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold text-white border border-violet-500/40 transition-all cursor-pointer disabled:opacity-50"
                    style={{ background: 'rgba(139,92,246,0.20)' }}
                    title="Create a new blank diagram"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>add</span>
                    New
                  </button>
                </div>

                {/* Project List */}
                <div className="overflow-y-auto custom-scroll" style={{ maxHeight: 380 }}>
                  {recentProjects.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-3">
                      <span className="material-symbols-outlined text-white/20" style={{ fontSize: 40 }}>schema</span>
                      <span className="text-xs text-white/30 font-medium">No diagram projects yet</span>
                      <span className="text-[10px] text-white/20">Click "New" above to create your first diagram</span>
                    </div>
                  ) : (
                    <div className="p-2 space-y-1">
                      {recentProjects.map((proj, idx) => {
                        const isActive = proj.id === projectId;
                        const updatedDate = new Date(proj.updatedAt);
                        const now = new Date();
                        const diffMs = now.getTime() - updatedDate.getTime();
                        const diffMins = Math.floor(diffMs / 60000);
                        const diffHours = Math.floor(diffMs / 3600000);
                        const diffDays = Math.floor(diffMs / 86400000);
                        const timeAgo = diffMins < 1 ? 'just now'
                          : diffMins < 60 ? `${diffMins}m ago`
                          : diffHours < 24 ? `${diffHours}h ago`
                          : diffDays < 7 ? `${diffDays}d ago`
                          : updatedDate.toLocaleDateString();

                        return (
                          <button
                            key={proj.id}
                            onClick={() => {
                              setRecentMenuOpen(false);
                              router.push(`/diagrams/editor?id=${proj.id}`);
                            }}
                            className={`w-full text-left px-3 py-2.5 rounded-xl transition-all border flex items-start gap-3 group cursor-pointer ${
                              isActive
                                ? 'bg-violet-500/15 border-violet-500/40'
                                : 'border-transparent hover:bg-white/5 hover:border-white/8'
                            }`}
                            style={{ background: isActive ? undefined : 'transparent' }}
                          >
                            {/* Icon */}
                            <div
                              className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center mt-0.5"
                              style={{
                                background: isActive
                                  ? 'rgba(139,92,246,0.25)'
                                  : `hsl(${(idx * 47) % 360}, 55%, 25%)`,
                                border: isActive ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(255,255,255,0.08)',
                              }}
                            >
                              <span
                                className="material-symbols-outlined"
                                style={{ fontSize: 18, color: isActive ? '#c4b5fd' : `hsl(${(idx * 47) % 360}, 70%, 70%)` }}
                              >
                                schema
                              </span>
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className={`text-[12px] font-semibold truncate ${
                                  isActive ? 'text-violet-200' : 'text-white group-hover:text-white'
                                }`}>
                                  {proj.title}
                                </span>
                                {isActive && (
                                  <span className="flex-shrink-0 text-[9px] font-black uppercase tracking-widest text-violet-400 bg-violet-500/20 px-1.5 py-0.5 rounded-full border border-violet-500/30">
                                    Open
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-white/35">{timeAgo}</span>
                                {proj.nodeCount > 0 && (
                                  <>
                                    <span className="text-white/15">·</span>
                                    <span className="text-[10px] text-white/35">
                                      {proj.nodeCount} {proj.nodeCount === 1 ? 'node' : 'nodes'}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Arrow */}
                            <span
                              className="material-symbols-outlined flex-shrink-0 mt-1 opacity-0 group-hover:opacity-60 transition-opacity text-white"
                              style={{ fontSize: 14 }}
                            >
                              arrow_forward
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Footer */}
                {recentProjects.length > 0 && (
                  <div className="px-4 py-2.5 border-t border-white/8 flex items-center justify-between">
                    <span className="text-[10px] text-white/25">{recentProjects.length} project{recentProjects.length !== 1 ? 's' : ''} total</span>
                    <button
                      onClick={() => {
                        fetch('/api/diagrams')
                          .then(r => r.json())
                          .then(data => {
                            if (!data.projects) return;
                            const mapped = data.projects.slice(0, 10).map((p: any) => {
                              let nodeCount = 0;
                              try { const sc = JSON.parse(p.structuredContent || '{}'); nodeCount = Array.isArray(sc.nodes) ? sc.nodes.length : 0; } catch {}
                              return { id: p.id, title: p.title || 'Untitled Diagram', updatedAt: p.updatedAt, nodeCount };
                            });
                            setRecentProjects(mapped);
                          })
                          .catch(() => {});
                      }}
                      className="flex items-center gap-1 text-[10px] text-white/35 hover:text-white/60 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 11 }}>refresh</span>
                      Refresh
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="h-5 w-px bg-white/10 hidden lg:block" />

          <nav className="hidden md:flex gap-1 text-xs font-semibold flex-shrink-0">
            {/* Undo / Redo */}
            <div className="flex items-center bg-white/5 rounded-lg overflow-hidden mr-1">
              <button disabled={!canUndo} onClick={() => undo(nodes, connections)} title="Undo (Ctrl+Z)"
                className="text-[#c6c6cb] hover:bg-white/10 hover:text-white disabled:opacity-30 transition-colors px-2.5 py-1.5 flex items-center justify-center">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>undo</span>
              </button>
              <button disabled={!canRedo} onClick={() => redo(nodes, connections)} title="Redo (Ctrl+Y)"
                className="text-[#c6c6cb] hover:bg-white/10 hover:text-white disabled:opacity-30 transition-colors px-2.5 py-1.5 flex items-center justify-center">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>redo</span>
            </button>
            <button onClick={() => setTool(isHand ? 'select' : 'hand')}
              className={`px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 ${isHand ? 'bg-violet-500/20 text-violet-300 border border-violet-500/50 shadow-[0_0_15px_rgba(139,92,246,0.2)]' : 'bg-[#1c2b3c] text-[#c6c6cb] border border-white/8 hover:text-white hover:border-white/20'}`}
              title="Drag to pan canvas"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>pan_tool</span>
              <span className="hidden xl:inline">{isHand ? 'Pan Active' : 'Hand'}</span>
            </button>
          </div>

          <button onClick={() => setShowMinimap(v => !v)}
            className={`px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${showMinimap ? 'bg-violet-500/20 text-violet-300 border border-violet-500/50 shadow-[0_0_15px_rgba(139,92,246,0.2)]' : 'bg-[#1c2b3c] text-[#c6c6cb] border border-white/8 hover:text-white hover:border-white/20'}`}
            title="Toggle Minimap View"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>map</span>
            <span className="hidden xl:inline">Minimap</span>
          </button>

          <div className="h-5 w-px bg-white/10" />

          {/* Zoom indicator */}
          <div className="flex items-center gap-1">
            <button onClick={() => setZoom(z => Math.max(30, z - 10))}
              className="w-7 h-7 rounded hover:bg-white/8 text-[#c6c6cb] hover:text-white flex items-center justify-center transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>remove</span>
            </button>
            <span className="text-[11px] font-bold text-white w-10 text-center">{zoom}%</span>
            <button onClick={() => setZoom(z => Math.min(200, z + 10))}
              className="w-7 h-7 rounded hover:bg-white/8 text-[#c6c6cb] hover:text-white flex items-center justify-center transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
            </button>
            
          {/* Mode Segmented Control */}
          <div className="flex items-center bg-white/5 rounded-lg border border-white/8 p-0.5 ml-2 mr-1 select-none">
            <button
              onClick={() => setEditorMode('Visual Edit')}
              className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all border-none cursor-pointer ${
                editorMode === 'Visual Edit'
                  ? 'bg-violet-500 text-white shadow-md shadow-violet-500/20'
                  : 'text-[#c6c6cb] hover:text-white bg-transparent'
              }`}
            >
              Visual
            </button>
            <button
              onClick={() => setEditorMode('Code')}
              className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all border-none cursor-pointer ${
                editorMode === 'Code'
                  ? 'bg-violet-500 text-white shadow-md shadow-violet-500/20'
                  : 'text-[#c6c6cb] hover:text-white bg-transparent'
              }`}
            >
              Code
            </button>
          </div>

          <button onClick={() => saveToServer(nodes, connections)} disabled={saving}
            className="p-2 rounded-lg hover:bg-white/8 transition-colors text-[#c6c6cb] hover:text-white border-none bg-transparent cursor-pointer" title="Save Now">
            <span className="material-symbols-outlined" style={{ fontSize: 19 }}>cloud_upload</span>
          </button>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setExportMenuOpen(v => !v)}
              className="px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 text-[#d4e4fa] border transition-all cursor-pointer hover:bg-white/8 hover:text-white"
              style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.12)' }}
            >
              <span className="material-symbols-outlined text-sm" style={{ fontSize: 16 }}>download</span>
              Export
              <span className="material-symbols-outlined text-[10px] text-white/50" style={{ fontSize: 12 }}>expand_more</span>
            </button>

            {exportMenuOpen && (
              <div
                className="glass rim absolute right-0 top-full mt-3 border border-white/10 rounded-2xl shadow-2xl z-50 p-2 w-64 popover-entry"
                style={{ background: 'rgba(9,19,32,0.95)', backdropFilter: 'blur(20px)' }}
                onMouseLeave={() => setExportMenuOpen(false)}
              >
                {/* Image Section */}
                <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-violet-400">Raster Image</div>
                <button
                  onClick={() => {
                    setExportDialog({ isOpen: true, format: 'png', options: defaultExportOptions });
                    setExportMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-violet-500/10 text-white flex flex-col transition-all border-none cursor-pointer bg-transparent group"
                >
                  <div className="flex gap-2.5 items-center">
                    <span className="material-symbols-outlined text-violet-400 group-hover:scale-110 transition-transform" style={{ fontSize: 18 }}>image</span>
                    <span className="text-xs font-semibold">Export as PNG</span>
                  </div>
                  <span className="text-[9px] text-[#8b9bb4] pl-7 group-hover:text-white/70 transition-colors">HD image with optional transparency</span>
                </button>
                <button
                  onClick={() => {
                    setExportDialog({ isOpen: true, format: 'jpeg', options: defaultExportOptions });
                    setExportMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-violet-500/10 text-white flex flex-col transition-all border-none cursor-pointer bg-transparent group"
                >
                  <div className="flex gap-2.5 items-center">
                    <span className="material-symbols-outlined text-violet-400 group-hover:scale-110 transition-transform" style={{ fontSize: 18 }}>photo</span>
                    <span className="text-xs font-semibold">Export as JPEG</span>
                  </div>
                  <span className="text-[9px] text-[#8b9bb4] pl-7 group-hover:text-white/70 transition-colors">Compressed premium high-quality image</span>
                </button>

                <div className="h-px bg-white/8 my-1.5" />

                {/* Vector Section */}
                <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-blue-400">Vector & Docs</div>
                <button
                  onClick={() => {
                    setExportDialog({ isOpen: true, format: 'svg', options: defaultExportOptions });
                    setExportMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-blue-500/10 text-white flex flex-col transition-all border-none cursor-pointer bg-transparent group"
                >
                  <div className="flex gap-2.5 items-center">
                    <span className="material-symbols-outlined text-blue-400 group-hover:scale-110 transition-transform" style={{ fontSize: 18 }}>category</span>
                    <span className="text-xs font-semibold">Export as SVG</span>
                  </div>
                  <span className="text-[9px] text-[#8b9bb4] pl-7 group-hover:text-white/70 transition-colors">Infinite resolution vector format</span>
                </button>

                <div className="h-px bg-white/8 my-1.5" />

                {/* Code & Backup Section */}
                <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-emerald-400">Code & Backup</div>
                <button
                  onClick={() => {
                    exportMermaid();
                    setExportMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-emerald-500/10 text-white flex flex-col transition-all border-none cursor-pointer bg-transparent group"
                >
                  <div className="flex gap-2.5 items-center">
                    <span className="material-symbols-outlined text-emerald-400 group-hover:scale-110 transition-transform" style={{ fontSize: 18 }}>code</span>
                    <span className="text-xs font-semibold">Export Mermaid</span>
                  </div>
                  <span className="text-[9px] text-[#8b9bb4] pl-7 group-hover:text-white/70 transition-colors">Markdown file with raw Mermaid code</span>
                </button>
                <button
                  onClick={() => {
                    exportJSON();
                    setExportMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl hover:bg-emerald-500/10 text-white flex flex-col transition-all border-none cursor-pointer bg-transparent group"
                >
                  <div className="flex gap-2.5 items-center">
                    <span className="material-symbols-outlined text-emerald-400 group-hover:scale-110 transition-transform" style={{ fontSize: 18 }}>data_object</span>
                    <span className="text-xs font-semibold">Export JSON Backup</span>
                  </div>
                  <span className="text-[9px] text-[#8b9bb4] pl-7 group-hover:text-white/70 transition-colors">Full studio backup file (nodes + links)</span>
                </button>
              </div>
            )}
          </div>

          <button onClick={handleShare}
            className="px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 text-blue-200 border transition-all cursor-pointer"
            style={{ background: 'rgba(59,130,246,0.10)', borderColor: 'rgba(59,130,246,0.30)' }}>
            {copied ? '✓' : <span className="material-symbols-outlined" style={{ fontSize: 14 }}>share</span>}
            <span className="hidden xl:inline">{copied ? 'Copied' : 'Share'}</span>
          </button>
          </div>

          <div className="h-5 w-px bg-white/10" />

          {/* Canvas Background Picker */}
          <div className="relative">
            <button
              onClick={() => setBgPickerOpen(v => !v)}
              title="Canvas Background"
              className="w-8 h-8 rounded-lg hover:bg-white/8 text-[#c6c6cb] hover:text-white flex items-center justify-center transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 19 }}>wallpaper</span>
            </button>
            {bgPickerOpen && (
              <div
                className="glass rim absolute right-0 top-full mt-2 border border-white/10 rounded-2xl shadow-2xl z-50 p-3 w-64 popover-entry"
                onMouseLeave={() => setBgPickerOpen(false)}
              >
                <div className="text-[10px] font-black uppercase tracking-widest text-[#c6c6cb] mb-3 px-1">Canvas Background</div>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { id: 'dots',      label: 'Dots',      icon: 'grain',          preview: 'radial-gradient(rgba(255,255,255,0.3) 2px, transparent 2px)', bg: '#051424', size: '12px 12px' },
                    { id: 'grid',      label: 'Grid',      icon: 'grid_on',        preview: 'linear-gradient(rgba(255,255,255,0.18) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.18) 1px,transparent 1px)', bg: '#051424', size: '16px 16px' },
                    { id: 'lines',     label: 'Lines',     icon: 'format_line_spacing', preview: 'linear-gradient(rgba(255,255,255,0.18) 1px,transparent 1px)', bg: '#051424', size: '100% 14px' },
                    { id: 'plain',     label: 'Plain',     icon: 'square',         preview: 'none', bg: '#051424', size: 'auto' },
                    { id: 'white',     label: 'White',     icon: 'light_mode',     preview: 'none', bg: '#f8faff', size: 'auto' },
                    { id: 'blueprint', label: 'Blueprint', icon: 'architecture',    preview: 'linear-gradient(rgba(100,160,255,0.28) 1px,transparent 1px),linear-gradient(90deg,rgba(100,160,255,0.28) 1px,transparent 1px)', bg: '#0a1e3c', size: '20px 20px' },
                  ] as { id: CanvasBg; label: string; icon: string; preview: string; bg: string; size: string }[]).map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => { setCanvasBg(opt.id); setBgPickerOpen(false); }}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border transition-all p-2 ${
                        canvasBg === opt.id
                          ? 'border-violet-400 shadow-md'
                          : 'border-white/8 hover:border-white/20'
                      }`}
                      style={{ background: canvasBg === opt.id ? 'rgba(139,92,246,0.15)' : cardBg }}
                      title={opt.label}
                    >
                      {/* Mini preview */}
                      <div
                        className="w-full rounded-lg border border-white/10 overflow-hidden"
                        style={{
                          height: 36,
                          backgroundColor: opt.bg,
                          backgroundImage: opt.preview,
                          backgroundSize: opt.size,
                        }}
                      />
                      <span className="text-[10px] font-semibold text-[#c6c6cb]">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="h-5 w-px bg-white/10" />

          {connectingFrom && (
            <div className="flex items-center text-xs text-white/70 animate-pulse bg-violet-500/20 px-3 py-1.5 rounded-full border border-violet-500/30 font-semibold" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
              Connecting from <strong className="ml-1">{nodes.find(n => n.id === connectingFrom.nodeId)?.title}</strong> … click or drag to target node
              <button onClick={() => setConnectingFrom(null)} className="ml-2 text-white/50 hover:text-white transition-colors" title="Cancel connection">✕</button>
            </div>
          )}
          </nav>


          <div className="h-5 w-px bg-white/10 flex-shrink-0" />

          <ThemeSwitcher />

          <div className="h-5 w-px bg-white/10 flex-shrink-0" />

          {/* Right nav: Return links — icon-only on small screens, text on large */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <Link href="/" className="px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 bg-[#1c2b3c] text-[#c6c6cb] border border-white/8 hover:text-white hover:border-white/20 cursor-pointer" title="Return to Home">
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>home</span>
              <span className="hidden xl:inline">Home</span>
            </Link>
            <Link href="/dashboard" className="px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 bg-[#1c2b3c] text-[#c6c6cb] border border-white/8 hover:text-white hover:border-white/20 cursor-pointer" title="Return to Dashboard">
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>dashboard</span>
              <span className="hidden xl:inline">Dashboard</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════════════════
          MAIN BODY (offset for studio header 68px)
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="flex w-full" style={{ paddingTop: 68 }}>

        {/* ── LEFT TOOLBOX ────────────────────────────────────────────────── */}
        <aside
          className="glass rim fixed left-4 bottom-4 w-[290px] border border-white/10 shadow-2xl flex flex-col z-40 rounded-2xl overflow-hidden"
          style={{ top: 80 }}
        >
          {/* Tool Nav */}
          <nav className="px-3 pt-3 pb-2 border-b border-white/8 flex gap-2 text-xs font-semibold">
            <button onClick={() => { setTool('select'); setConnectingFrom(null); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border transition-all ${isSelect ? 'bg-[#273647] text-white border-white/8' : 'text-[#d4e4fa] hover:text-white border border-white/10 hover:border-white/20'}`}>
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>near_me</span>Select
            </button>
            <button onClick={() => {
              const newNode: DiagramNode = {
                id: `node_${Date.now()}`,
                title: 'Text label',
                description: '',
                type: 'Process',
                variant: 'text',
                x: 100 - panOffset.x,
                y: 100 - panOffset.y,
                width: 160,
                height: 40,
                color: 'slate'
              };
              setNodes(n => [...n, newNode]);
              debouncedSave([...nodes, newNode], connections);
            }}
              className="flex-1 text-[#d4e4fa] hover:text-white border border-white/10 hover:border-white/20 rounded-lg flex items-center justify-center gap-1.5 py-2 transition-colors"
              style={{ background: 'rgba(59,130,246,0.10)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>text_fields</span>Text
            </button>
          </nav>

          <div className="flex-1 px-3 py-3 overflow-y-auto custom-scroll space-y-4">
            {/* Search */}
            <div className="relative">
              <input
                type="text" placeholder="Search tools…"
                className="w-full rounded-lg py-2 pl-8 pr-3 text-xs text-white focus:outline-none placeholder-white/30 border border-white/8"
                style={{ background: cardBg }}
              />
              <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-white/40" style={{ fontSize: 16 }}>search</span>
            </div>

            {/* Shapes */}
            <div>
              <button onClick={() => setShapesOpen(v => !v)}
                className="w-full flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-blue-400 mb-2 px-0.5">
                <span>Shapes</span>
                <span className={`material-symbols-outlined text-sm transition-transform ${shapesOpen ? '' : 'rotate-180'}`} style={{ fontSize: 16 }}>expand_less</span>
              </button>
              {shapesOpen && (
                <div className="space-y-3 accordion-entry max-h-[360px] overflow-y-auto pr-1 custom-scroll">
                  {/* Standard Flow Shapes */}
                  <div>
                    <div className="text-[9px] text-white/40 font-bold uppercase tracking-wider mb-1.5 px-0.5">Flow & Standard</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {([
                        { type: 'Process',  icon: 'settings',       label: 'Process' },
                        { type: 'Decision', icon: 'help',           label: 'Decision' },
                        { type: 'Database', icon: 'database',       label: 'Database' },
                        { type: 'Cloud',    icon: 'cloud',          label: 'Cloud' },
                        { type: 'People',   icon: 'person',         label: 'People' },
                        { type: 'Business', icon: 'business_center',label: 'Business' },
                        { type: 'Technical',icon: 'dns',            label: 'Technical' },
                        { type: 'Oval',     icon: 'radio_button_unchecked', label: 'Oval' },
                        { type: 'Diamond',  icon: 'change_history', label: 'Diamond' },
                        { type: 'Parallelogram', icon: 'label_important', label: 'Data' },
                        { type: 'Document', icon: 'description',    label: 'Document' },
                        { type: 'Hexagon',  icon: 'hexagon',        label: 'Hexagon' },
                        { type: 'Triangle', icon: 'change_history', label: 'Triangle' },
                        { type: 'Square',   icon: 'crop_square',    label: 'Square' },
                      ] as { type: NodeType; icon: string; label: string }[]).map(s => (
                        <button key={s.label} onClick={() => addNode(s.type)}
                          title={`Add ${s.type} node`}
                          className="flex flex-col items-center gap-1 py-1.5 rounded-xl text-[#c6c6cb] hover:text-white border border-white/8 hover:border-violet-500/40 transition-all text-[9px] font-semibold"
                          style={{ background: cardBg }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{s.icon}</span>
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Modeling & Process */}
                  <div>
                    <div className="text-[9px] text-white/40 font-bold uppercase tracking-wider mb-1.5 px-0.5">UML, ERD & Process</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {([
                        { type: 'UMLClass', icon: 'domain',         label: 'UML Class' },
                        { type: 'EREntity', icon: 'table_rows',     label: 'ER Entity' },
                        { type: 'Swimlane', icon: 'view_week',      label: 'Swimlane' },
                        { type: 'Gantt',    icon: 'calendar_today', label: 'Gantt Bar' },
                        { type: 'DFDProcess', icon: 'change_history', label: 'DFD Process' },
                        { type: 'DFDDataStore', icon: 'reorder',     label: 'DFD Data Store' },
                        { type: 'DFDExternalEntity', icon: 'domain',  label: 'DFD Entity' },
                      ] as { type: NodeType; icon: string; label: string }[]).map(s => (
                        <button key={s.label} onClick={() => addNode(s.type)}
                          title={`Add ${s.type} node`}
                          className="flex flex-col items-center gap-1 py-1.5 rounded-xl text-[#c6c6cb] hover:text-white border border-white/8 hover:border-violet-500/40 transition-all text-[9px] font-semibold"
                          style={{ background: cardBg }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{s.icon}</span>
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Engineering & Circuits */}
                  <div>
                    <div className="text-[9px] text-white/40 font-bold uppercase tracking-wider mb-1.5 px-0.5">Circuit components</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {([
                        { type: 'CircuitResistor', icon: 'legend_toggle',  label: 'Resistor' },
                        { type: 'CircuitCapacitor',icon: 'commit',         label: 'Capacitor' },
                        { type: 'CircuitGround',   icon: 'vertical_align_bottom', label: 'Ground' },
                        { type: 'CircuitSource',   icon: 'control_point',   label: 'Source' },
                      ] as { type: NodeType; icon: string; label: string }[]).map(s => (
                        <button key={s.label} onClick={() => addNode(s.type)}
                          title={`Add ${s.type} node`}
                          className="flex flex-col items-center gap-1 py-1.5 rounded-xl text-[#c6c6cb] hover:text-white border border-white/8 hover:border-violet-500/40 transition-all text-[9px] font-semibold"
                          style={{ background: cardBg }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{s.icon}</span>
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Data Vis & Relational */}
                  <div>
                    <div className="text-[9px] text-white/40 font-bold uppercase tracking-wider mb-1.5 px-0.5">Data Charts & Venns</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {([
                        { type: 'VennCircle',   icon: 'adjust',          label: 'Venn Circle' },
                        { type: 'BarSegment',   icon: 'bar_chart',       label: 'Bar Segment' },
                        { type: 'PieWedge',     icon: 'pie_chart',       label: 'Pie Wedge' },
                        { type: 'LinePoint',    icon: 'multiline_chart', label: 'Line Point' },
                        { type: 'ScatterPoint', icon: 'bubble_chart',    label: 'Scatter Dot' },
                        { type: 'HistogramBar', icon: 'align_horizontal_left', label: 'Histogram Bar' },
                      ] as { type: NodeType; icon: string; label: string }[]).map(s => (
                        <button key={s.label} onClick={() => addNode(s.type)}
                          title={`Add ${s.type} node`}
                          className="flex flex-col items-center gap-1 py-1.5 rounded-xl text-[#c6c6cb] hover:text-white border border-white/8 hover:border-violet-500/40 transition-all text-[9px] font-semibold"
                          style={{ background: cardBg }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{s.icon}</span>
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Media Upload */}
                  <div>
                    <div className="text-[9px] text-white/40 font-bold uppercase tracking-wider mb-1.5 px-0.5">Media</div>
                    <button onClick={() => document.getElementById('canvas-image-upload')?.click()}
                      title="Upload image as node component"
                      className="w-full flex flex-col items-center gap-1 py-1.5 rounded-xl text-[#c6c6cb] hover:text-white border border-white/8 hover:border-violet-500/40 transition-all text-[9px] font-semibold"
                      style={{ background: cardBg }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>upload_file</span>
                      Upload Image
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Connectors */}
            <div>
              <button onClick={() => setConnectorsOpen(v => !v)}
                className="w-full flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-blue-400 mb-2 px-0.5">
                <span>Connectors</span>
                <span className={`material-symbols-outlined text-sm transition-transform ${connectorsOpen ? '' : 'rotate-180'}`} style={{ fontSize: 16 }}>expand_less</span>
              </button>
              {connectorsOpen && (
                <div className="space-y-3 accordion-entry">
                  <div className="text-[10px] text-white/40 font-bold uppercase tracking-wider px-0.5">Line Type</div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['Orthogonal','Curved','Straight','Elbow'] as ConnType[]).map(t => (
                      <button key={t} onClick={() => {
                        setActiveConnType(t);
                        if (selectedConnId) updateConnection(selectedConnId, { type: t });
                      }} title={t}
                        className={`aspect-square rounded flex items-center justify-center text-[#c6c6cb] border transition-all ${activeConnType === t ? 'border-violet-400 bg-violet-400/15 text-violet-200' : 'border-white/8 hover:border-white/20'}`}
                        style={{ background: activeConnType === t ? undefined : cardBg }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                          {t === 'Orthogonal' ? 'route' : t === 'Curved' ? 'gesture' : t === 'Straight' ? 'horizontal_rule' : 'linear_scale'}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="text-[10px] text-white/40 font-bold uppercase tracking-wider px-0.5">Arrowhead</div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['Arrow','Dot','Diamond',"Crow's Foot"] as Arrowhead[]).map(a => (
                      <button key={a} onClick={() => {
                        setActiveArrow(a);
                        if (selectedConnId) updateConnection(selectedConnId, { arrowhead: a });
                      }} title={a}
                        className={`aspect-square rounded flex items-center justify-center text-[#c6c6cb] border transition-all ${activeArrow === a ? 'border-blue-400 bg-blue-400/15 text-blue-200' : 'border-white/8 hover:border-white/20'}`}
                        style={{ background: activeArrow === a ? undefined : cardBg }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                          {a === 'Arrow' ? 'trending_flat' : a === 'Dot' ? 'radio_button_checked' : a === 'Diamond' ? 'diamond' : 'fork_left'}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="text-[10px] text-white/40 font-bold uppercase tracking-wider px-0.5 pt-1">Gallery Preset Styles</div>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { id: 'solid_none', label: 'Solid Line', lineStyle: 'solid', arrowDirection: 'none', icon: 'remove' },
                      { id: 'solid_forward', label: 'Solid Arrow', lineStyle: 'solid', arrowDirection: 'forward', icon: 'trending_flat' },
                      { id: 'solid_both', label: 'Bi-directional', lineStyle: 'solid', arrowDirection: 'both', icon: 'compare_arrows' },
                      { id: 'dotted_none', label: 'Dotted Line', lineStyle: 'dotted', arrowDirection: 'none', icon: 'more_horiz' },
                      { id: 'dotted_forward', label: 'Dotted Arrow', lineStyle: 'dotted', arrowDirection: 'forward', icon: 'arrow_right_alt' },
                      { id: 'dotted_both', label: 'Dotted Bi-dir', lineStyle: 'dotted', arrowDirection: 'both', icon: 'swap_horiz' },
                    ] as { id: string; label: string; lineStyle: 'solid'|'dotted'; arrowDirection: 'forward'|'both'|'none'; icon: string }[]).map(preset => {
                      const isSelected = activeLineStyle === preset.lineStyle && activeArrowDirection === preset.arrowDirection;
                      return (
                        <button key={preset.id} onClick={() => {
                          setActiveLineStyle(preset.lineStyle);
                          setActiveArrowDirection(preset.arrowDirection);
                          if (preset.arrowDirection === 'none') {
                            setActiveArrow('Arrow');
                          }
                          if (selectedConnId) {
                            updateConnection(selectedConnId, {
                              lineStyle: preset.lineStyle,
                              arrowDirection: preset.arrowDirection,
                              ...(preset.arrowDirection === 'none' ? { arrowhead: 'Arrow' } : {})
                            });
                          }
                        }}
                          title={preset.label}
                          className={`py-2 px-1.5 rounded-lg border transition-all flex flex-col items-center justify-center gap-1 ${isSelected ? 'border-emerald-400 text-emerald-300 bg-emerald-400/10' : 'border-white/8 text-[#c6c6cb] hover:border-white/20'}`}
                          style={{ background: isSelected ? undefined : cardBg }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{preset.icon}</span>
                          <span className="text-[9px] font-bold text-center truncate w-full">{preset.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-col gap-2 pt-1">
                    <label className="flex items-center justify-between text-[11px] text-[#c6c6cb] cursor-pointer">
                      <span>Smart Routing</span>
                      <input type="checkbox" checked={smartRouting} onChange={e => setSmartRouting(e.target.checked)}
                        className="rounded w-3.5 h-3.5" />
                    </label>
                    <label className="flex items-center justify-between text-[11px] text-[#c6c6cb] cursor-pointer">
                      <span>Line Jump</span>
                      <input type="checkbox" checked={lineJump} onChange={e => setLineJump(e.target.checked)}
                        className="rounded w-3.5 h-3.5" />
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Assets */}
            <div>
              <button onClick={() => setAssetsOpen(v => !v)}
                className="w-full flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-blue-400 mb-2 px-0.5">
                <span>Assets</span>
                <span className={`material-symbols-outlined text-sm transition-transform ${assetsOpen ? '' : 'rotate-180'}`} style={{ fontSize: 16 }}>expand_less</span>
              </button>
              {assetsOpen && (
                <div className="space-y-2 text-xs text-white accordion-entry">
                  {ASSETS_CATEGORIES.map(cat => (
                    <details key={cat.label} className="group">
                      <summary className="list-none flex items-center gap-2 p-1 rounded cursor-pointer hover:bg-white/5 font-semibold">
                        <span className="material-symbols-outlined text-sm group-open:rotate-90 transition-transform" style={{ fontSize: 14 }}>chevron_right</span>
                        {cat.label}
                      </summary>
                      <div className="grid grid-cols-4 gap-1 p-1.5 text-[#c6c6cb]">
                        {Array.from(new Set(cat.items)).map(icon => (
                          <span key={icon} onClick={() => addIconNode(icon)} title={icon.replace(/_/g, ' ')} className="material-symbols-outlined cursor-pointer hover:text-white hover:scale-110 transition-all text-center" style={{ fontSize: 22 }}>{icon}</span>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Left footer */}
          <div className="px-3 border-t border-white/8 pt-3 pb-3 flex gap-2">
            <button onClick={() => {
              if (nodes.length === 0) { setZoom(100); setPanOffset({ x: 0, y: 0 }); return; }
              const bounds = nodes.reduce((acc, n) => ({
                minX: Math.min(acc.minX, n.x),
                minY: Math.min(acc.minY, n.y),
                maxX: Math.max(acc.maxX, n.x + n.width),
                maxY: Math.max(acc.maxY, n.y + n.height),
              }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
              const canvasEl = canvasRef.current;
              if (!canvasEl) return;
              const cw = canvasEl.clientWidth;
              const ch = canvasEl.clientHeight;
              const bw = bounds.maxX - bounds.minX;
              const bh = bounds.maxY - bounds.minY;
              const pad = 60;
              const scale = Math.min((cw - pad * 2) / bw, (ch - pad * 2) / bh, 1.5);
              const newZoom = Math.round(Math.max(30, Math.min(200, scale * 100)));
              const cx = (bounds.minX + bounds.maxX) / 2;
              const cy = (bounds.minY + bounds.maxY) / 2;
              const px = cw / 2 - cx * (newZoom / 100);
              const py = ch / 2 - cy * (newZoom / 100);
              setZoom(newZoom);
              setPanOffset({ x: px, y: py });
            }}
              className="flex-1 flex flex-col items-center py-2 text-[#c6c6cb] hover:text-white hover:bg-white/5 rounded-lg transition-all text-[10px] font-semibold">
              <span className="material-symbols-outlined mb-0.5" style={{ fontSize: 18 }}>fit_screen</span>Fit View
            </button>
            <button onClick={() => { setActiveRightTab('update'); setCodeFreeMode(false); }}
              className="flex-1 flex flex-col items-center py-2 text-[#c6c6cb] hover:text-white hover:bg-white/5 rounded-lg transition-all text-[10px] font-semibold">
              <span className="material-symbols-outlined mb-0.5" style={{ fontSize: 18 }}>smart_toy</span>AI Chat
            </button>
          </div>
        </aside>

        {/* ── CANVAS ──────────────────────────────────────────────────────── */}
        <main
          className={`canvas-${canvasBg} overflow-hidden relative`}
          style={{
            marginLeft: 306,
            marginRight: codeFreeMode ? 0 : 356,
            height: 'calc(100vh - 70px)',
            cursor: isPanning ? 'grabbing' : panMode ? 'grab' : connectingFrom ? 'crosshair' : draggingId ? 'grabbing' : 'default',
          }}
          ref={canvasRef}
          data-canvas="true"
          onMouseDown={onCanvasMouseDown}
          onWheel={e => {
            e.preventDefault();
            setZoom(z => Math.min(200, Math.max(30, z - e.deltaY * 0.05)));
          }}
        >
          {/* Code mode overlay */}
          {editorMode === 'Code' && (
            <div className="absolute inset-0 z-50 flex flex-col" style={{ background: '#071321' }}>
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/8">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-amber-400" style={{ fontSize: 18 }}>code</span>
                  <span className="text-xs font-bold text-white uppercase tracking-widest">Mermaid Code Editor</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={applyMermaidCode}
                    className="px-4 py-1.5 rounded-lg text-xs font-bold text-white flex items-center gap-2"
                    style={{ background: '#8b5cf6' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>play_arrow</span>Apply
                  </button>
                  <button onClick={() => setEditorMode('Visual Edit')}
                    className="px-4 py-1.5 rounded-lg text-xs font-bold text-[#c6c6cb] border border-white/10 hover:text-white">
                    Visual Edit
                  </button>
                </div>
              </div>
              <textarea
                className="flex-1 w-full p-5 text-sm text-[#d4e4fa] resize-none outline-none custom-scroll"
                style={{ background: 'transparent', fontFamily: "'JetBrains Mono', monospace", fontSize: 13, lineHeight: 1.6 }}
                value={mermaidCode}
                onChange={e => setMermaidCode(e.target.value)}
                spellCheck={false}
              />
            </div>
          )}

          {/* Zoomable & pannable stage */}
          <div data-stage style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom / 100})`,
            transformOrigin: '0 0',
            position: 'relative',
            width: 2400,
            height: 1600,
          }}>

            {/* ── SVG connections ────────────────────────────────────────── */}
            <svg className="diagram-svg absolute inset-0 pointer-events-none" width="2400" height="1600" style={{ overflow: 'visible' }}>
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={LIGHT_CANVASES.has(canvasBg) ? '#1d4ed8' : '#3b82f6'} />
                </marker>
                <marker id="arrow-violet" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={LIGHT_CANVASES.has(canvasBg) ? '#6d28d9' : '#8b5cf6'} />
                </marker>
                <marker id="dot" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="8" markerHeight="8">
                  <circle cx="5" cy="5" r="4" fill={LIGHT_CANVASES.has(canvasBg) ? '#334155' : '#64748b'} />
                </marker>
                <marker id="diamond" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="10" markerHeight="10">
                  <path d="M 5 0 L 10 5 L 5 10 L 0 5 z" fill={LIGHT_CANVASES.has(canvasBg) ? '#b45309' : '#f59e0b'} />
                </marker>
                <marker id="crow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="12" markerHeight="12" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 M 0 10 L 10 5 M 10 0 L 10 10" fill="none" stroke={LIGHT_CANVASES.has(canvasBg) ? '#1d4ed8' : '#3b82f6'} strokeWidth="1.5" />
                </marker>
              </defs>
              {connections.map(conn => {
                const fromNode = nodes.find(n => n.id === conn.from);
                const toNode = nodes.find(n => n.id === conn.to);
                if (!fromNode || !toNode) return null;
                // Get other paths to find intersections
                const otherPaths = lineJump ? connections
                  .filter(c => c.id !== conn.id)
                  .map(c => {
                    const fNode = nodes.find(n => n.id === c.from);
                    const tNode = nodes.find(n => n.id === c.to);
                    if (!fNode || !tNode) return '';
                    return buildPath(fNode, tNode, c.type, c.routingOffset, smartRouting, c.fromPort, c.toPort, c.routingOffsetY);
                  })
                  .filter(path => path !== '') : [];

                const rawPath = buildPath(fromNode, toNode, conn.type, conn.routingOffset, smartRouting, conn.fromPort, conn.toPort, conn.routingOffsetY);
                const d = lineJump ? applyLineJumps(rawPath, otherPaths) : rawPath;
                const markerId = conn.arrowhead === 'Dot' ? 'dot' : conn.arrowhead === 'Diamond' ? 'diamond' : conn.arrowhead === "Crow's Foot" ? 'crow' : (conn.type === 'Curved' ? 'arrow-violet' : 'arrow');
                const isSelectedConn = selectedConnId === conn.id;
                const strokeW = conn.thickness || 2;
                // Compute port coordinates for label/handle placement
                const { fromPort, toPort } = getBestPorts(fromNode, toNode);
                return (
                  <g key={conn.id} className="pointer-events-auto cursor-pointer" onClick={e => {
                    e.stopPropagation();
                    setSelectedConnId(conn.id);
                    setSelectedNode(null);
                    multiSelect.clearSelect();
                  }}>
                    {/* Wider invisible hit area */}
                    <path d={d} fill="none" stroke="transparent" strokeWidth={24} pointerEvents="stroke" />
                    <path
                      d={d}
                      fill="none"
                      stroke={isSelectedConn ? '#ff007f' : (conn.type === 'Curved' ? (LIGHT_CANVASES.has(canvasBg) ? '#6d28d9' : '#8b5cf6') : (LIGHT_CANVASES.has(canvasBg) ? '#1d4ed8' : '#3b82f6'))}
                      strokeWidth={isSelectedConn ? strokeW + 1 : strokeW}
                      strokeDasharray={
                        conn.lineStyle === 'dotted' ? '2 4' :
                        conn.lineStyle === 'dashed' ? '6 4' :
                        conn.type === 'Elbow' ? '6 3' : undefined
                      }
                      markerStart={
                        (conn.arrowDirection === 'both' || conn.arrowDirection === 'backward') ?
                        `url(#${markerId})` : undefined
                      }
                      markerEnd={
                        conn.arrowDirection !== 'backward' && conn.arrowDirection !== 'none' ?
                        `url(#${markerId})` : undefined
                      }
                      className="conn-del transition-all"
                    />
                    {/* Connection label */}
                    {conn.label && (
                      <g style={{ pointerEvents: 'all' }} onClick={e => {
                        e.stopPropagation();
                        setSelectedConnId(conn.id);
                        setSelectedNode(null);
                      }}>
                        <rect x={((fromPort.x + toPort.x) / 2) - 30} y={((fromPort.y + toPort.y) / 2) - 10} width={60} height={20} rx={4} fill={isLight ? '#ffffff' : '#1c2b3c'} stroke={isSelectedConn ? '#8b5cf6' : 'rgba(255,255,255,0.1)'} strokeWidth={1} />
                        <text x={(fromPort.x + toPort.x) / 2} y={((fromPort.y + toPort.y) / 2) + 4} textAnchor="middle" fill={LIGHT_CANVASES.has(canvasBg) ? '#1e293b' : '#c6c6cb'} fontSize={10} fontFamily="sans-serif">{conn.label}</text>
                      </g>
                    )}

                    {/* Midpoint delete badge */}
                    {!isExporting && (() => {
                      const mx = (fromPort.x + toPort.x) / 2;
                      const my = (fromPort.y + toPort.y) / 2;
                      return (
                        <g className="diagram-controls opacity-0 hover:opacity-100 transition-opacity" style={{ pointerEvents: 'all' }} onClick={e => {
                          e.stopPropagation();
                          requestConfirm(
                            'Delete Connection',
                            `Remove the connection from "${fromNode.title}" → "${toNode.title}"?`,
                            () => { deleteConnection(conn.id); setSelectedConnId(null); }
                          );
                        }}>
                          <circle cx={mx} cy={my - 16} r={8} fill={isLight ? '#ffffff' : '#1c2b3c'} stroke="#f43f5e" strokeWidth={1.5} className="cursor-pointer" />
                          <text x={mx} y={my - 12.5} textAnchor="middle" fill="#f43f5e" fontSize={10} fontFamily="sans-serif" className="cursor-pointer">×</text>
                        </g>
                      );
                    })()}

                    {/* Draggable handles when selected */}
                    {isSelectedConn && (
                      <g>
                        <circle cx={fromPort.x} cy={fromPort.y} r={6} fill="#fff" stroke="#8b5cf6" strokeWidth={2} className="cursor-move pointer-events-auto"
                          onMouseDown={e => { e.stopPropagation(); setDraggingConnHandle({ connId: conn.id, end: 'from' }); }} />
                        <circle cx={toPort.x} cy={toPort.y} r={6} fill="#fff" stroke="#8b5cf6" strokeWidth={2} className="cursor-move pointer-events-auto"
                          onMouseDown={e => { e.stopPropagation(); setDraggingConnHandle({ connId: conn.id, end: 'to' }); }} />
                        {/* Midpoint drag handle */}
                        {(() => {
                          const mx = (fromPort.x + toPort.x) / 2;
                          const my = (fromPort.y + toPort.y) / 2;
                          // simple axis check: if width > height, offset is usually vertical (y axis), else horizontal (x axis)
                          const axis = Math.abs(toPort.x - fromPort.x) > Math.abs(toPort.y - fromPort.y) ? 'y' : 'x';
                          return (
                            <circle cx={mx} cy={my} r={6} fill="#8b5cf6" stroke="#fff" strokeWidth={2} className="cursor-pointer pointer-events-auto shadow-md hover:scale-125 transition-transform"
                              onMouseDown={e => { 
                                e.stopPropagation();
                                const rect = canvasRef.current?.getBoundingClientRect();
                                if (rect) {
                                  const startX = (e.clientX - rect.left - panOffset.x) / (zoom / 100);
                                  const startY = (e.clientY - rect.top - panOffset.y) / (zoom / 100);
                                  setDraggingConnHandle({ connId: conn.id, end: 'mid', startPos: {x: startX, y: startY}, startOffset: conn.routingOffset || 0, axis }); 
                                }
                              }} />
                          );
                        })()}
                      </g>
                    )}
                  </g>
                );
              })}

              {/* Temporary Dragging/Connecting Line */}
              {(connectingFrom || draggingConnHandle) && canvasMousePos && (() => {
                 let startX = 0, startY = 0;
                 if (connectingFrom) {
                   const n = nodes.find(n => n.id === connectingFrom.nodeId);
                   if (!n) return null;
                   startX = n.x + n.width / 2; startY = n.y + n.height / 2;
                 } else if (draggingConnHandle && draggingConnHandle.end !== 'mid') {
                   const c = connections.find(c => c.id === draggingConnHandle.connId);
                   if (!c) return null;
                   const targetId = draggingConnHandle.end === 'from' ? c.to : c.from;
                   const n = nodes.find(n => n.id === targetId);
                   if (!n) return null;
                   startX = n.x + n.width / 2; startY = n.y + n.height / 2;
                 } else if (draggingConnHandle && draggingConnHandle.end === 'mid') {
                   return null; // hide temporary line when dragging mid
                 }
                 return (
                   <path
                     d={`M ${startX} ${startY} L ${canvasMousePos.x} ${canvasMousePos.y}`}
                     fill="none" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="6 4"
                     pointerEvents="none"
                   />
                 );
              })()}

              {/* Rubber-band selection box */}
              {multiSelect.selectBox && canvasRef.current && (() => {
                const rect = canvasRef.current.getBoundingClientRect();
                const scale = zoom / 100;
                const minX = Math.min(multiSelect.selectBox.startX, multiSelect.selectBox.endX) - rect.left;
                const minY = Math.min(multiSelect.selectBox.startY, multiSelect.selectBox.endY) - rect.top;
                const w = Math.abs(multiSelect.selectBox.endX - multiSelect.selectBox.startX);
                const h = Math.abs(multiSelect.selectBox.endY - multiSelect.selectBox.startY);
                
                return (
                  <rect
                    x={(minX - panOffset.x) / scale}
                    y={(minY - panOffset.y) / scale}
                    width={w / scale}
                    height={h / scale}
                    fill="rgba(59, 130, 246, 0.15)"
                    stroke="#3b82f6"
                    strokeWidth={1 / scale}
                    pointerEvents="none"
                  />
                );
              })()}
            </svg>

            {/* ── Nodes ──────────────────────────────────────────────────── */}
            {nodes.map(node => {
              const cmap = getColorMap(canvasBg);
              const col = cmap[node.color];
              const isSelected = selectedNode === node.id || multiSelect.selectedIds.has(node.id);
              const isDragging = draggingId === node.id;
              const isLight = LIGHT_CANVASES.has(canvasBg);
              const isDecision = node.type === 'Decision' || node.type === 'Diamond';
              const isDatabase = node.type === 'Database';
              const isCloud = node.type === 'Cloud';
              const isOval = node.type === 'Oval';
              const isParallelogram = node.type === 'Parallelogram';
              const isDocument = node.type === 'Document';
              const isHexagon = node.type === 'Hexagon';
              const isTriangle = node.type === 'Triangle';
              const isSquare = node.type === 'Square';
              const isSwimlane = node.type === 'Swimlane';
              const isGantt = node.type === 'Gantt';
              const isUMLClass = node.type === 'UMLClass';
              const isEREntity = node.type === 'EREntity';
              const isCircuitResistor = node.type === 'CircuitResistor';
              const isCircuitCapacitor = node.type === 'CircuitCapacitor';
              const isCircuitGround = node.type === 'CircuitGround';
              const isCircuitSource = node.type === 'CircuitSource';
              const isVennCircle = node.type === 'VennCircle';
              const isBarSegment = node.type === 'BarSegment';
              const isPieWedge = node.type === 'PieWedge';
              const isLinePoint = node.type === 'LinePoint';
              const isScatterPoint = node.type === 'ScatterPoint';
              const isHistogramBar = node.type === 'HistogramBar';
              const isDFDProcess = node.type === 'DFDProcess';
              const isDFDDataStore = node.type === 'DFDDataStore';
              const isDFDExternalEntity = node.type === 'DFDExternalEntity';

              const useSvgShape = (isDecision || isDatabase || isCloud || isOval || isParallelogram || isDocument || isHexagon || isTriangle || isSquare ||
                isSwimlane || isGantt || isUMLClass || isEREntity || isCircuitResistor || isCircuitCapacitor || isCircuitGround || isCircuitSource || isVennCircle ||
                isBarSegment || isPieWedge || isLinePoint || isScatterPoint || isHistogramBar || isDFDProcess || isDFDDataStore || isDFDExternalEntity) && node.variant !== 'icon';
              const isText = node.variant === 'text';
              
              const nodeBorderColor = node.customBorderColor || (isSelected ? col.border : col.border + '88');
              const nodeStrokeColor = node.customBorderColor || col.border;
              const nodeBorderWidth = node.customBorderWidth ?? 1.5;
              const nodeStrokeWidth = isSelected ? (node.customBorderWidth !== undefined ? node.customBorderWidth + 1.5 : 3) : nodeBorderWidth;

              return (
                <div
                  key={node.id}
                  className={`absolute node-anim rounded-xl overflow-visible group ${node._animating ? 'node-entry-anim' : ''}`}
                  style={{
                    left: node.x, top: node.y,
                    width: node.width, height: node.height,
                    background: isText ? 'transparent' : (node.variant === 'icon' || useSvgShape ? 'transparent' : (node.customFill || (isLight ? `rgba(255,255,255,0.85)` : col.bg))),
                    border: isText ? 'none' : (node.variant === 'icon' || useSvgShape ? 'none' : `${nodeBorderWidth}px ${isSelected ? 'solid' : 'dashed'} ${nodeBorderColor}`),
                    boxShadow: isText || useSvgShape ? undefined : isSelected
                      ? `0 0 0 2px ${col.glow}, 0 8px 32px ${col.glow}`
                      : isLight && node.variant !== 'icon' ? '0 2px 12px rgba(0,0,0,0.08)' : undefined,
                    cursor: isDragging ? 'grabbing' : 'grab',
                    zIndex: isSelected ? 20 : 10,
                    transform: node.rotation ? `rotate(${node.rotation}deg)` : undefined,
                  }}
                  onMouseDown={e => onNodeMouseDown(e, node.id)}
                  onMouseUp={e => {
                    if (connectingFrom && connectingFrom.nodeId !== node.id) {
                      e.stopPropagation();
                      pushHistory(nodes, connections);
                      const newConn: DiagramConnection = {
                        id: `conn_${Date.now()}`,
                        from: connectingFrom.nodeId,
                        to: node.id,
                        type: activeConnType,
                        arrowhead: activeArrow,
                        lineStyle: activeLineStyle,
                        arrowDirection: activeArrowDirection,
                      };
                      setConnections(prev => {
                        const next = [...prev, newConn];
                        debouncedSave(nodes, next);
                        return next;
                      });
                      setConnectingFrom(null);
                    } else if (connectingFrom?.nodeId === node.id) {
                      e.stopPropagation();
                    } else if (draggingConnHandle) {
                      e.stopPropagation();
                      if (draggingConnHandle.end !== 'mid') {
                        pushHistory(nodes, connections);
                        setConnections(prev => {
                          const next = prev.map(c => c.id === draggingConnHandle.connId ? { ...c, [draggingConnHandle.end]: node.id } : c);
                          debouncedSave(nodes, next);
                          return next;
                        });
                      } else {
                        debouncedSave(nodes, connections);
                      }
                      setDraggingConnHandle(null);
                    }
                  }}
                  onClick={e => { e.stopPropagation(); setSelectedNode(node.id); }}
                >
                  {useSvgShape && (
                    <svg className="absolute inset-0 pointer-events-none w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                      {isSelected && (
                        <filter id={`glow-${node.id}`}>
                          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                          <feMerge>
                            <feMergeNode in="coloredBlur"/>
                            <feMergeNode in="SourceGraphic"/>
                          </feMerge>
                        </filter>
                      )}
                      <g filter={isSelected ? `url(#glow-${node.id})` : undefined}>
                        {isDecision && (
                          <polygon points="50,2 98,50 50,98 2,50" 
                            fill={node.customFill || (isLight ? 'rgba(255,255,255,0.85)' : col.bg)} 
                            stroke={nodeStrokeColor} 
                            strokeWidth={nodeStrokeWidth} 
                            strokeDasharray={isSelected ? undefined : '4 2'} 
                            vectorEffect="non-scaling-stroke" />
                        )}
                        {isDatabase && (
                          <>
                            <path d="M 2 20 A 48 15 0 0 0 98 20 A 48 15 0 0 0 2 20 L 2 80 A 48 15 0 0 0 98 80 L 98 20"
                              fill={node.customFill || (isLight ? 'rgba(255,255,255,0.85)' : col.bg)} 
                              stroke={nodeStrokeColor} 
                              strokeWidth={nodeStrokeWidth} 
                              strokeDasharray={isSelected ? undefined : '4 2'} 
                              vectorEffect="non-scaling-stroke" />
                            <path d="M 2 20 A 48 15 0 0 0 98 20" fill="none" stroke={nodeStrokeColor} strokeWidth={nodeStrokeWidth} vectorEffect="non-scaling-stroke" />
                          </>
                        )}
                        {isCloud && (
                          <path d="M 25 60 A 20 20 0 0 1 40 35 A 25 25 0 0 1 75 35 A 20 20 0 0 1 90 60 A 20 20 0 0 1 75 85 L 25 85 A 20 20 0 0 1 25 60 Z"
                            fill={node.customFill || (isLight ? 'rgba(255,255,255,0.85)' : col.bg)} 
                            stroke={nodeStrokeColor} 
                            strokeWidth={nodeStrokeWidth} 
                            strokeDasharray={isSelected ? undefined : '4 2'} 
                            vectorEffect="non-scaling-stroke" />
                        )}
                        {isOval && (
                          <ellipse cx="50" cy="50" rx="48" ry="48"
                            fill={node.customFill || (isLight ? 'rgba(255,255,255,0.85)' : col.bg)} 
                            stroke={nodeStrokeColor} strokeWidth={nodeStrokeWidth} strokeDasharray={isSelected ? undefined : '4 2'} vectorEffect="non-scaling-stroke" />
                        )}
                        {isParallelogram && (
                          <polygon points="20,2 98,2 80,98 2,98"
                            fill={node.customFill || (isLight ? 'rgba(255,255,255,0.85)' : col.bg)} 
                            stroke={nodeStrokeColor} strokeWidth={nodeStrokeWidth} strokeDasharray={isSelected ? undefined : '4 2'} vectorEffect="non-scaling-stroke" />
                        )}
                        {isDocument && (
                          <path d="M 2 2 L 98 2 L 98 85 Q 75 100 50 85 T 2 85 Z"
                            fill={node.customFill || (isLight ? 'rgba(255,255,255,0.85)' : col.bg)} 
                            stroke={nodeStrokeColor} strokeWidth={nodeStrokeWidth} strokeDasharray={isSelected ? undefined : '4 2'} vectorEffect="non-scaling-stroke" />
                        )}
                        {isHexagon && (
                          <polygon points="25,2 75,2 98,50 75,98 25,98 2,50"
                            fill={node.customFill || (isLight ? 'rgba(255,255,255,0.85)' : col.bg)} 
                            stroke={nodeStrokeColor} strokeWidth={nodeStrokeWidth} strokeDasharray={isSelected ? undefined : '4 2'} vectorEffect="non-scaling-stroke" />
                        )}
                        {isTriangle && (
                          <polygon points="50,2 98,98 2,98"
                            fill={node.customFill || (isLight ? 'rgba(255,255,255,0.85)' : col.bg)} 
                            stroke={nodeStrokeColor} strokeWidth={nodeStrokeWidth} strokeDasharray={isSelected ? undefined : '4 2'} vectorEffect="non-scaling-stroke" />
                        )}
                        {isSquare && (
                          <rect x="2" y="2" width="96" height="96" rx="4"
                            fill={node.customFill || (isLight ? 'rgba(255,255,255,0.85)' : col.bg)} 
                            stroke={nodeStrokeColor} strokeWidth={nodeStrokeWidth} strokeDasharray={isSelected ? undefined : '4 2'} vectorEffect="non-scaling-stroke" />
                        )}
                        {isSwimlane && (
                          <rect x="2" y="2" width="96" height="96" rx="4"
                            fill={node.customFill || (isLight ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.05)')} 
                            stroke={nodeStrokeColor} strokeWidth={nodeStrokeWidth} strokeDasharray={isSelected ? undefined : '4 2'} vectorEffect="non-scaling-stroke" />
                        )}
                        {isGantt && (
                          <rect x="2" y="25" width="96" height="50" rx="6"
                            fill={node.customFill || (isLight ? 'rgba(255,255,255,0.85)' : col.bg)} 
                            stroke={nodeStrokeColor} strokeWidth={nodeStrokeWidth} strokeDasharray={isSelected ? undefined : '4 2'} vectorEffect="non-scaling-stroke" />
                        )}
                        {isUMLClass && (
                          <rect x="2" y="2" width="96" height="96" rx="4"
                            fill={node.customFill || (isLight ? 'rgba(255,255,255,0.85)' : col.bg)} 
                            stroke={nodeStrokeColor} strokeWidth={nodeStrokeWidth} strokeDasharray={isSelected ? undefined : '4 2'} vectorEffect="non-scaling-stroke" />
                        )}
                        {isEREntity && (
                          <rect x="2" y="2" width="96" height="96" rx="4"
                            fill={node.customFill || (isLight ? 'rgba(255,255,255,0.85)' : col.bg)} 
                            stroke={nodeStrokeColor} strokeWidth={nodeStrokeWidth} strokeDasharray={isSelected ? undefined : '4 2'} vectorEffect="non-scaling-stroke" />
                        )}
                        {isCircuitResistor && (
                          <>
                            <rect x="2" y="2" width="96" height="96" rx="4" fill="transparent" stroke="transparent" />
                            <path d="M 2 50 L 25 50 M 75 50 L 98 50" stroke={nodeStrokeColor} strokeWidth={nodeStrokeWidth} vectorEffect="non-scaling-stroke" />
                            <path d="M 25 50 L 32 30 L 40 70 L 48 30 L 56 70 L 64 30 L 72 70 L 75 50" fill="none" stroke={nodeStrokeColor} strokeWidth={nodeStrokeWidth} vectorEffect="non-scaling-stroke" />
                          </>
                        )}
                        {isCircuitCapacitor && (
                          <>
                            <path d="M 2 50 L 44 50 M 56 50 L 98 50" stroke={nodeStrokeColor} strokeWidth={nodeStrokeWidth} vectorEffect="non-scaling-stroke" />
                            <path d="M 44 20 L 44 80 M 56 20 L 56 80" stroke={nodeStrokeColor} strokeWidth={nodeStrokeWidth} vectorEffect="non-scaling-stroke" />
                          </>
                        )}
                        {isCircuitGround && (
                          <>
                            <path d="M 50 2 L 50 50" stroke={nodeStrokeColor} strokeWidth={nodeStrokeWidth} vectorEffect="non-scaling-stroke" />
                            <path d="M 20 50 L 80 50 M 35 68 L 65 68 M 45 86 L 55 86" stroke={nodeStrokeColor} strokeWidth={nodeStrokeWidth} vectorEffect="non-scaling-stroke" />
                          </>
                        )}
                        {isCircuitSource && (
                          <>
                            <circle cx="50" cy="50" r="40" fill={node.customFill || (isLight ? 'rgba(255,255,255,0.85)' : col.bg)} stroke={nodeStrokeColor} strokeWidth={nodeStrokeWidth} vectorEffect="non-scaling-stroke" />
                            <path d="M 30 50 L 42 50 M 36 44 L 36 56 M 58 50 L 70 50" stroke={nodeStrokeColor} strokeWidth={nodeStrokeWidth / 1.5} vectorEffect="non-scaling-stroke" />
                          </>
                        )}
                        {isVennCircle && (
                          <ellipse cx="50" cy="50" rx="48" ry="48"
                            fill={node.customFill || col.bg} fillOpacity="0.45"
                            stroke={nodeStrokeColor} strokeWidth={nodeStrokeWidth} strokeDasharray={isSelected ? undefined : '4 2'} vectorEffect="non-scaling-stroke" />
                        )}
                        {isBarSegment && (
                          <>
                            <path d="M 2 95 L 98 95" stroke={nodeStrokeColor} strokeWidth={nodeStrokeWidth} vectorEffect="non-scaling-stroke" />
                            <rect x="25" y="15" width="50" height="80" rx="3"
                              fill={node.customFill || (isLight ? 'rgba(255,255,255,0.85)' : col.bg)} 
                              stroke={nodeStrokeColor} strokeWidth={nodeStrokeWidth} vectorEffect="non-scaling-stroke" />
                          </>
                        )}
                        {isPieWedge && (
                          <>
                            <circle cx="50" cy="50" r="42" fill="none" stroke={nodeStrokeColor} strokeWidth={nodeStrokeWidth / 2} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
                            <path d="M 50 50 L 50 8 A 42 42 0 0 1 88 64 Z" 
                              fill={node.customFill || (isLight ? 'rgba(255,255,255,0.85)' : col.bg)} 
                              stroke={nodeStrokeColor} strokeWidth={nodeStrokeWidth} vectorEffect="non-scaling-stroke" />
                          </>
                        )}
                        {isLinePoint && (
                          <>
                            <path d="M 2 50 L 36 50 M 64 50 L 98 50" stroke={nodeStrokeColor} strokeWidth={nodeStrokeWidth / 2} strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
                            <circle cx="50" cy="50" r="14" fill={node.customFill || (isLight ? 'rgba(255,255,255,0.85)' : col.bg)} stroke={nodeStrokeColor} strokeWidth={nodeStrokeWidth} vectorEffect="non-scaling-stroke" />
                          </>
                        )}
                        {isScatterPoint && (
                          <>
                            <path d="M 50 15 L 50 35 M 50 65 L 50 85 M 15 50 L 35 50 M 65 50 L 85 50" stroke={nodeStrokeColor} strokeWidth={nodeStrokeWidth / 2} vectorEffect="non-scaling-stroke" />
                            <circle cx="50" cy="50" r="10" fill={node.customFill || (isLight ? 'rgba(255,255,255,0.85)' : col.bg)} stroke={nodeStrokeColor} strokeWidth={nodeStrokeWidth} vectorEffect="non-scaling-stroke" />
                          </>
                        )}
                        {isHistogramBar && (
                          <>
                            <path d="M 2 95 L 98 95" stroke={nodeStrokeColor} strokeWidth={nodeStrokeWidth} vectorEffect="non-scaling-stroke" />
                            <rect x="15" y="45" width="20" height="50" rx="2" fill={node.customFill || col.bg} fillOpacity="0.4" stroke={nodeStrokeColor} strokeWidth={nodeStrokeWidth} vectorEffect="non-scaling-stroke" />
                            <rect x="40" y="15" width="20" height="80" rx="2" fill={node.customFill || (isLight ? 'rgba(255,255,255,0.85)' : col.bg)} stroke={nodeStrokeColor} strokeWidth={nodeStrokeWidth} vectorEffect="non-scaling-stroke" />
                            <rect x="65" y="30" width="20" height="65" rx="2" fill={node.customFill || col.bg} fillOpacity="0.6" stroke={nodeStrokeColor} strokeWidth={nodeStrokeWidth} vectorEffect="non-scaling-stroke" />
                          </>
                        )}
                        {isDFDProcess && (
                          <>
                            <circle cx="50" cy="50" r="44" fill={node.customFill || (isLight ? 'rgba(255,255,255,0.85)' : col.bg)} stroke={nodeStrokeColor} strokeWidth={nodeStrokeWidth} vectorEffect="non-scaling-stroke" />
                            <path d="M 6 32 L 94 32" stroke={nodeStrokeColor} strokeWidth={nodeStrokeWidth} vectorEffect="non-scaling-stroke" />
                          </>
                        )}
                        {isDFDDataStore && (
                          <>
                            <path d="M 5 20 L 95 20 M 5 80 L 95 80" stroke={nodeStrokeColor} strokeWidth={nodeStrokeWidth} vectorEffect="non-scaling-stroke" />
                            <path d="M 20 20 L 20 80" stroke={nodeStrokeColor} strokeWidth={nodeStrokeWidth / 1.5} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
                          </>
                        )}
                        {isDFDExternalEntity && (
                          <>
                            <rect x="4" y="4" width="92" height="92" rx="2" fill={node.customFill || (isLight ? 'rgba(255,255,255,0.85)' : col.bg)} stroke={nodeStrokeColor} strokeWidth={nodeStrokeWidth} vectorEffect="non-scaling-stroke" />
                            <rect x="10" y="10" width="80" height="80" rx="1" fill="transparent" stroke={nodeStrokeColor} strokeWidth={nodeStrokeWidth / 1.5} vectorEffect="non-scaling-stroke" />
                          </>
                        )}
                      </g>
                    </svg>
                  )}

                    {node.imageUrl ? (
                    <div className="w-full h-full relative rounded-lg overflow-hidden flex items-center justify-center">
                      <Image src={node.imageUrl} alt={node.title} fill className="object-cover pointer-events-none" unoptimized />
                      {isSelected && (
                        <div className="absolute inset-0 bg-black/40 flex flex-col justify-end p-2 pointer-events-none">
                          <span className="text-[10px] font-bold text-white truncate">{node.title}</span>
                        </div>
                      )}
                      {isSelected && (
                        <button
                          onMouseDown={e => e.stopPropagation()}
                          onClick={e => {
                            e.stopPropagation();
                            requestConfirm('Delete Node', `Remove "${node.title}"?`, () => deleteNode(node.id));
                          }}
                          className="absolute top-2 right-2 w-5 h-5 rounded flex items-center justify-center bg-black/50 text-white hover:bg-rose-500 transition-colors z-20"
                          style={{ fontSize: 12 }}
                        >✕</button>
                      )}
                    </div>
                  ) : node.variant === 'icon' ? (
                    <div className="w-full h-full flex items-center justify-center pointer-events-none">
                      <span className="material-symbols-outlined pointer-events-none" style={{ fontSize: Math.min(node.width, node.height) * 0.8, color: col.text }}>
                        {node.icon}
                      </span>
                    </div>
                  ) : isUMLClass ? (
                    <div className="w-full h-full flex flex-col text-left font-mono" style={{ fontSize: '10px' }}>
                      {/* Class Header */}
                      <div className="h-[30px] flex items-center justify-center border-b font-bold truncate px-2 text-center" style={{ borderColor: nodeStrokeColor, color: getDynamicColor(node.titleStyle?.color, node.color, canvasBg) }}>
                        {node.title}
                      </div>
                      {/* Attributes */}
                      <div className="flex-1 min-h-[30px] p-1.5 overflow-hidden border-b flex flex-col justify-start" style={{ borderColor: nodeStrokeColor, color: isLight ? '#334155' : '#cbd5e1' }}>
                        {node.description ? node.description.split('\n').map((attr, idx) => (
                          <div key={idx} className="truncate select-text">{attr}</div>
                        )) : <div className="text-white/20 italic select-none">+ attributes</div>}
                      </div>
                      {/* Methods */}
                      <div className="flex-1 min-h-[30px] p-1.5 overflow-hidden flex flex-col justify-start" style={{ color: isLight ? '#475569' : '#94a3b8' }}>
                        {node.notes ? node.notes.split('\n').map((m, idx) => (
                          <div key={idx} className="truncate select-text">{m}</div>
                        )) : <div className="text-white/20 italic select-none">+ methods()</div>}
                      </div>
                      {isSelected && (
                        <button
                          onMouseDown={e => e.stopPropagation()}
                          onClick={e => {
                            e.stopPropagation();
                            requestConfirm('Delete Node', `Remove "${node.title}"?`, () => deleteNode(node.id));
                          }}
                          className={`absolute top-2 right-2 w-4 h-4 rounded flex items-center justify-center hover:bg-rose-500/20 hover:text-rose-400 transition-colors z-20 ${isLight ? 'text-slate-400' : 'text-white/30'}`}
                          style={{ fontSize: 10 }}
                        >✕</button>
                      )}
                    </div>
                  ) : isEREntity ? (
                    <div className="w-full h-full flex flex-col text-left font-mono" style={{ fontSize: '10px' }}>
                      <div className="h-[24px] flex items-center justify-center font-bold border-b truncate px-2 text-center uppercase tracking-wider" style={{ borderColor: nodeStrokeColor, color: getDynamicColor(node.titleStyle?.color, node.color, canvasBg) }}>
                        {node.title}
                      </div>
                      <div className="flex-1 p-2 overflow-hidden flex flex-col gap-0.5 justify-start" style={{ color: isLight ? '#334155' : '#cbd5e1' }}>
                        {node.description ? node.description.split('\n').map((field, idx) => {
                          const isPK = field.toLowerCase().includes('pk') || field.toLowerCase().includes('id');
                          return (
                            <div key={idx} className="flex justify-between gap-2 truncate select-text">
                              <span className={isPK ? "underline font-bold" : ""}>{field.replace(/\s*\(pk\)|\s*\(fk\)/gi, '')}</span>
                              {isPK && <span className="text-amber-500 font-bold text-[8px]">PK</span>}
                              {field.toLowerCase().includes('fk') && <span className="text-blue-400 font-bold text-[8px]">FK</span>}
                            </div>
                          );
                        }) : <div className="text-white/20 italic select-none">id (pk)</div>}
                      </div>
                      {isSelected && (
                        <button
                          onMouseDown={e => e.stopPropagation()}
                          onClick={e => {
                            e.stopPropagation();
                            requestConfirm('Delete Node', `Remove "${node.title}"?`, () => deleteNode(node.id));
                          }}
                          className={`absolute top-2 right-2 w-4 h-4 rounded flex items-center justify-center hover:bg-rose-500/20 hover:text-rose-400 transition-colors z-20 ${isLight ? 'text-slate-400' : 'text-white/30'}`}
                          style={{ fontSize: 10 }}
                        >✕</button>
                      )}
                    </div>
                  ) : isSwimlane ? (
                    <div className="w-full h-full flex flex-col">
                      <div className="h-[24px] flex items-center justify-center font-bold text-[10px] uppercase tracking-wider border-b" style={{ borderColor: nodeStrokeColor, background: isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)', color: getDynamicColor(node.titleStyle?.color, node.color, canvasBg) }}>
                        {node.title}
                      </div>
                      <div className="flex-1 p-2 text-[10px] text-white/50 select-text overflow-hidden">
                        {node.description}
                      </div>
                      {isSelected && (
                        <button
                          onMouseDown={e => e.stopPropagation()}
                          onClick={e => {
                            e.stopPropagation();
                            requestConfirm('Delete Node', `Remove "${node.title}"?`, () => deleteNode(node.id));
                          }}
                          className={`absolute top-2 right-2 w-4 h-4 rounded flex items-center justify-center hover:bg-rose-500/20 hover:text-rose-400 transition-colors z-20 ${isLight ? 'text-slate-400' : 'text-white/30'}`}
                          style={{ fontSize: 10 }}
                        >✕</button>
                      )}
                    </div>
                  ) : isText || (useSvgShape && !isUMLClass && !isEREntity && !isSwimlane) ? (
                    <div className="w-full h-full flex items-center justify-center p-6 text-center">
                      <span
                        className={`font-bold outline-none max-w-full ${isLight && !isText ? 'text-slate-800' : 'text-white'}`}
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={e => updateNode(node.id, { title: (e.target as HTMLElement).innerText.trim() || node.title, titleStyle: { ...(node.titleStyle || {}), color: node.titleStyle?.color || col.text } })}
                        onMouseDown={e => e.stopPropagation()}
                        onClick={e => e.stopPropagation()}
                        style={{
                          cursor: 'text',
                          color: getDynamicColor(node.titleStyle?.color, node.color, canvasBg),
                          fontSize: node.titleStyle?.fontSize ? `${node.titleStyle.fontSize}px` : (isText ? '18px' : '14px'),
                          fontFamily: node.titleStyle?.fontFamily,
                          fontWeight: node.titleStyle?.fontWeight,
                          fontStyle: node.titleStyle?.fontStyle,
                          textDecoration: node.titleStyle?.textDecoration,
                          verticalAlign: node.titleStyle?.verticalAlign,
                          zIndex: 10
                        }}
                      >{node.title}</span>
                      {isSelected && !isText && (
                        <button
                          onMouseDown={e => e.stopPropagation()}
                          onClick={e => {
                            e.stopPropagation();
                            requestConfirm('Delete Node', `Remove "${node.title}"?`, () => deleteNode(node.id));
                          }}
                          className={`absolute top-2 right-2 w-5 h-5 rounded flex items-center justify-center hover:bg-rose-500/20 hover:text-rose-400 transition-colors z-20 ${isLight ? 'text-slate-400' : 'text-white/30'}`}
                          style={{ fontSize: 12 }}
                        >✕</button>
                      )}
                    </div>
                  ) : (
                    <>
                      {/* Header */}
                      <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: col.border + '44' }}>
                        <div className="flex items-center gap-1.5 overflow-hidden">
                          <span className="material-symbols-outlined" style={{ fontSize: 14, color: col.text }}>{node.icon || TYPE_ICON[node.type]}</span>
                          <span
                            className={`text-xs font-bold truncate max-w-[140px] ${isLight ? 'text-slate-800' : 'text-white'}`}
                            contentEditable
                            suppressContentEditableWarning
                            onBlur={e => updateNode(node.id, { title: (e.target as HTMLElement).innerText.trim() || node.title, titleStyle: { ...(node.titleStyle || {}), color: node.titleStyle?.color || col.text } })}
                            onMouseDown={e => e.stopPropagation()}
                            onClick={e => e.stopPropagation()}
                            style={{
                              cursor: 'text',
                              color: getDynamicColor(node.titleStyle?.color, node.color, canvasBg),
                              fontSize: node.titleStyle?.fontSize ? `${node.titleStyle.fontSize}px` : undefined,
                              fontFamily: node.titleStyle?.fontFamily,
                              fontWeight: node.titleStyle?.fontWeight,
                              fontStyle: node.titleStyle?.fontStyle,
                              textDecoration: node.titleStyle?.textDecoration,
                              verticalAlign: node.titleStyle?.verticalAlign,
                            }}
                          >{node.title}</span>
                        </div>
                        <button
                          onMouseDown={e => e.stopPropagation()}
                          onClick={e => {
                            e.stopPropagation();
                            requestConfirm(
                              'Delete Node',
                              `Remove "${node.title}" and all its connections?`,
                              () => deleteNode(node.id)
                            );
                          }}
                          className={`w-5 h-5 rounded flex items-center justify-center hover:bg-rose-500/20 hover:text-rose-400 transition-colors ${isLight ? 'text-slate-400' : 'text-white/30'}`}
                          style={{ fontSize: 12, flexShrink: 0 }}
                        >✕</button>
                      </div>

                      {/* Body */}
                      <div className="px-3 py-2">
                        <p
                          className="text-[11px] leading-relaxed"
                          contentEditable
                          suppressContentEditableWarning
                          onBlur={e => updateNode(node.id, { description: (e.target as HTMLElement).innerText.trim(), descriptionStyle: { ...(node.descriptionStyle || {}), color: node.descriptionStyle?.color || col.text } })}
                          onMouseDown={e => e.stopPropagation()}
                          onClick={e => e.stopPropagation()}
                          style={{
                            cursor: 'text',
                            color: getDynamicColor(node.descriptionStyle?.color, node.color, canvasBg),
                            fontSize: node.descriptionStyle?.fontSize ? `${node.descriptionStyle.fontSize}px` : undefined,
                            fontFamily: node.descriptionStyle?.fontFamily,
                            fontWeight: node.descriptionStyle?.fontWeight,
                            fontStyle: node.descriptionStyle?.fontStyle,
                            textDecoration: node.descriptionStyle?.textDecoration,
                            verticalAlign: node.descriptionStyle?.verticalAlign,
                          }}
                        >{node.description}</p>
                      </div>
                    </>
                  )}

                  {/* Invisible Connection Edge Strips */}
                  {[
                    { id: 't', cls: 'top-[-10px] left-[10px] right-[10px] h-[15px]' },
                    { id: 'r', cls: 'right-[-10px] top-[10px] bottom-[10px] w-[15px]' },
                    { id: 'b', cls: 'bottom-[-10px] left-[10px] right-[10px] h-[15px]' },
                    { id: 'l', cls: 'left-[-10px] top-[10px] bottom-[10px] w-[15px]' }
                  ].map(port => (
                    <div
                      key={port.id}
                      className={`absolute ${port.cls} cursor-crosshair z-30 bg-transparent transition-colors ${connectingFrom?.nodeId ? 'bg-violet-400/20' : ''}`}
                      title={connectingFrom?.nodeId ? "Connect to here" : "Connect from here"}
                      onMouseDown={e => { e.stopPropagation(); onPortClick(e, node.id, port.id as 't'|'r'|'b'|'l'); }}
                      onMouseUp={e => {
                        if (connectingFrom && connectingFrom.nodeId !== node.id) {
                          e.stopPropagation();
                          pushHistory(nodes, connections);
                          const newConn: DiagramConnection = {
                            id: `conn_${Date.now()}`,
                            from: connectingFrom.nodeId,
                            to: node.id,
                            fromPort: connectingFrom.portId,
                            toPort: port.id as 't'|'r'|'b'|'l',
                            type: activeConnType,
                            arrowhead: activeArrow,
                            lineStyle: activeLineStyle,
                            arrowDirection: activeArrowDirection,
                          };
                          setConnections(prev => {
                            const next = [...prev, newConn];
                            debouncedSave(nodes, next);
                            return next;
                          });
                          setConnectingFrom(null);
                        }
                      }}
                    />
                  ))}

                  {/* Resize handles when selected */}
                  {isSelected && (
                    <>
                      {[
                        { handle: 'top-left', cursor: 'nwse-resize', cls: 'top-0 left-0' },
                        { handle: 'top-right', cursor: 'nesw-resize', cls: 'top-0 right-0' },
                        { handle: 'bottom-left', cursor: 'nesw-resize', cls: 'bottom-0 left-0' },
                        { handle: 'bottom-right', cursor: 'nwse-resize', cls: 'bottom-0 right-0' },
                        { handle: 'top', cursor: 'ns-resize', cls: 'top-0 left-1/2' },
                        { handle: 'bottom', cursor: 'ns-resize', cls: 'bottom-0 left-1/2' },
                        { handle: 'left', cursor: 'ew-resize', cls: 'top-1/2 left-0' },
                        { handle: 'right', cursor: 'ew-resize', cls: 'top-1/2 right-0' },
                      ].map(h => (
                        <div
                          key={h.handle}
                          className={`absolute ${h.cls} w-3 h-3 bg-white border-2 rounded-full cursor-${h.cursor}`}
                          style={{
                            borderColor: col.border,
                            transform: 'translate(-50%, -50%)',
                            zIndex: 40,
                            cursor: h.cursor,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                          }}
                          onMouseDown={e => onResizeMouseDown(e, node.id, h.handle)}
                        />
                      ))}
                    </>
                  )}


                </div>
              );
            })}
          </div>

          {/* Code-Free Design Palette */}
          {codeFreeMode && (selectedNode || selectedConnId) && (
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3 py-2 rounded-2xl border border-white/10 shadow-2xl"
              style={{ background: 'rgba(12,24,40,0.95)' }}>
              {/* Color palette */}
              <div className="flex items-center gap-1">
                {(Object.entries(DARK_COLOR_MAP) as [NodeColor, typeof DARK_COLOR_MAP[NodeColor]][]).map(([c, v]) => (
                  <button key={c} onClick={() => { if (selectedNode) updateNode(selectedNode, { color: c, customFill: undefined }); }}
                    className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-125"
                    style={{ background: v.bg, borderColor: v.border }} title={c} />
                ))}
              </div>
              <div className="w-px h-6 bg-white/10" />
              {/* Font size */}
              <div className="flex items-center gap-1">
                <button onClick={() => { if (selectedNode) { const n = nodes.find(x => x.id === selectedNode); if (n) updateNode(selectedNode, { titleStyle: { ...(n.titleStyle || {}), fontSize: Math.max(8, (n.titleStyle?.fontSize || 14) - 2) } }); } }}
                  className="w-6 h-6 rounded hover:bg-white/10 text-white/70 hover:text-white text-xs font-bold">A-</button>
                <button onClick={() => { if (selectedNode) { const n = nodes.find(x => x.id === selectedNode); if (n) updateNode(selectedNode, { titleStyle: { ...(n.titleStyle || {}), fontSize: Math.min(48, (n.titleStyle?.fontSize || 14) + 2) } }); } }}
                  className="w-6 h-6 rounded hover:bg-white/10 text-white/70 hover:text-white text-xs font-bold">A+</button>
              </div>
              <div className="w-px h-6 bg-white/10" />
              {/* Bold/Italic */}
              <button onClick={() => { if (selectedNode) { const n = nodes.find(x => x.id === selectedNode); if (n) updateNode(selectedNode, { titleStyle: { ...(n.titleStyle || {}), fontWeight: n.titleStyle?.fontWeight === 'bold' ? 'normal' : 'bold' } }); } }}
                className="w-6 h-6 rounded hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center">
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>format_bold</span>
              </button>
              <button onClick={() => { if (selectedNode) { const n = nodes.find(x => x.id === selectedNode); if (n) updateNode(selectedNode, { titleStyle: { ...(n.titleStyle || {}), fontStyle: n.titleStyle?.fontStyle === 'italic' ? 'normal' : 'italic' } }); } }}
                className="w-6 h-6 rounded hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center">
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>format_italic</span>
              </button>
              <div className="w-px h-6 bg-white/10" />
              {/* Connection type (if connection selected) */}
              {selectedConnId && (
                <>
                  {(['Orthogonal','Curved','Straight','Elbow'] as ConnType[]).map(t => {
                    const conn = connections.find(c => c.id === selectedConnId);
                    return (
                      <button key={t} onClick={() => conn && updateConnection(conn.id, { type: t })}
                        className={`px-2 py-0.5 rounded text-[9px] font-bold border transition-all ${conn?.type === t ? 'border-violet-400 text-violet-300 bg-violet-400/10' : 'border-white/8 text-white/50 hover:text-white'}`}>
                        {t.slice(0,4)}
                      </button>
                    );
                  })}
                  <div className="w-px h-6 bg-white/10" />
                </>
              )}
              {/* Shape type (if node selected) */}
              {selectedNode && (
                <>
                  {(['Process','Decision','Database','Cloud','Oval','Hexagon'] as NodeType[]).map(t => {
                    const node = nodes.find(x => x.id === selectedNode);
                    return (
                      <button key={t} onClick={() => node && updateNode(node.id, { type: t })}
                        className={`px-2 py-0.5 rounded text-[9px] font-bold border transition-all ${node?.type === t ? 'border-violet-400 text-violet-300 bg-violet-400/10' : 'border-white/8 text-white/50 hover:text-white'}`}>
                        {t.slice(0,5)}
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {/* Keyboard hints */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3 text-[10px] text-white/25 font-mono">
            <span>Scroll to zoom</span>
            <span>·</span>
            <span>Alt+drag to pan</span>
            <span>·</span>
            <span>Del to delete</span>
            <span>·</span>
            <span>0 to reset view</span>
          </div>
        </main>

        {/* ── RIGHT PROPERTIES / CHAT PANEL ────────────────────────────── */}
        {!codeFreeMode && (
          <aside
            className="glass rim fixed right-4 bottom-4 w-[340px] rounded-2xl shadow-2xl flex flex-col z-40 overflow-hidden border border-white/10"
            style={{ top: 80 }}
          >
          {/* Tab bar */}
          <div className="flex border-b border-white/8 text-xs font-semibold flex-shrink-0">
            <button
              onClick={() => setActiveRightTab('properties')}
              className={`flex-1 py-3 border-b-2 transition-all ${activeRightTab === 'properties' ? 'text-violet-400 border-violet-400 bg-white/4' : 'text-[#c6c6cb] border-transparent hover:text-white'}`}
            >Properties</button>
            <button
              onClick={() => setActiveRightTab('update')}
              className={`flex-1 py-3 border-b-2 transition-all flex items-center justify-center gap-1.5 ${activeRightTab === 'update' ? 'text-violet-400 border-violet-400 bg-white/4' : 'text-[#c6c6cb] border-transparent hover:text-white'}`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>smart_toy</span>AI Chat
              {aiLoading && <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-ping" />}
            </button>
          </div>

          {/* ── PROPERTIES ─────────────────────────────────────────────── */}
          {activeRightTab === 'properties' && (
            <div className="flex-1 overflow-y-auto custom-scroll p-4 space-y-5 text-xs">

              {!selectedConnId ? (
                <>
                  {multiSelect.selectedIds.size > 1 ? (
                    <div className="space-y-5 animate-fade-in">
                      {/* Group Alignment */}
                      <div>
                        <span className="block font-black text-[10px] text-[#c6c6cb] uppercase tracking-wider mb-2">Group Alignment</span>
                        <div className="grid grid-cols-6 gap-1 rounded-lg p-1 border border-white/8 mb-1.5" style={{ background: cardBg }}>
                          {[
                            { icon: 'align_horizontal_left',   axis: 'left',    title: 'Align Lefts' },
                            { icon: 'align_horizontal_center', axis: 'centerX', title: 'Align Centers Horiz' },
                            { icon: 'align_horizontal_right',  axis: 'right',   title: 'Align Rights' },
                            { icon: 'align_vertical_top',      axis: 'top',     title: 'Align Tops' },
                            { icon: 'align_vertical_center',   axis: 'centerY', title: 'Align Centers Vert' },
                            { icon: 'align_vertical_bottom',   axis: 'bottom',  title: 'Align Bottoms' },
                          ].map(a => (
                            <button key={a.axis} onClick={() => alignSelectedNodes(a.axis as any)} title={a.title}
                              className="aspect-square rounded flex items-center justify-center text-white hover:bg-white/10 transition-colors">
                              <span className="material-symbols-outlined" style={{ fontSize: 17 }}>{a.icon}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Group Spacing */}
                      <div>
                        <span className="block font-black text-[10px] text-[#c6c6cb] uppercase tracking-wider mb-2">Distribution</span>
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={() => distributeSelected('horizontal')}
                            className="flex items-center justify-center gap-1.5 py-2 rounded-lg border border-white/8 text-[#c6c6cb] hover:text-white hover:border-violet-500/40 transition-colors" style={{ background: cardBg }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>align_space_between</span>Distribute Horiz
                          </button>
                          <button onClick={() => distributeSelected('vertical')}
                            className="flex items-center justify-center gap-1.5 py-2 rounded-lg border border-white/8 text-[#c6c6cb] hover:text-white hover:border-violet-500/40 transition-colors" style={{ background: cardBg }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>align_space_around</span>Distribute Vert
                          </button>
                        </div>
                      </div>

                      {/* Group Operations */}
                      <div>
                        <span className="block font-black text-[10px] text-[#c6c6cb] uppercase tracking-wider mb-2">Bulk Operations</span>
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={copySelected}
                            className="flex items-center justify-center gap-1.5 py-2 rounded-lg border border-white/8 text-[#c6c6cb] hover:text-white transition-colors" style={{ background: cardBg }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>content_copy</span>Copy Selected
                          </button>
                          <button onClick={cutSelected}
                            className="flex items-center justify-center gap-1.5 py-2 rounded-lg border border-white/8 text-[#c6c6cb] hover:text-white transition-colors" style={{ background: cardBg }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>content_cut</span>Cut Selected
                          </button>
                          <button onClick={deleteSelected}
                            className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-rose-500/20 hover:bg-rose-500/10 text-rose-400 font-bold transition-colors col-span-2">
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>Delete Selected ({multiSelect.selectedIds.size})
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Quick Actions */}
              <div className="flex justify-between items-center rounded-xl p-2.5 border border-white/8" style={{ background: cardBg }}>
                {[
                  { icon: 'format_align_center', title: 'Auto Layout', action: autoLayout },
                  { icon: 'palette', title: 'Cycle Colors', action: () => selected && updateNode(selected.id, { color: (Object.keys(DARK_COLOR_MAP) as NodeColor[])[(Object.keys(DARK_COLOR_MAP).indexOf(selected.color) + 1) % Object.keys(DARK_COLOR_MAP).length], customFill: undefined }) },
                  { icon: 'aspect_ratio', title: 'Fit View', action: () => {
                    if (nodes.length === 0) { setZoom(100); setPanOffset({ x: 0, y: 0 }); return; }
                    const bounds = nodes.reduce((acc, n) => ({
                      minX: Math.min(acc.minX, n.x),
                      minY: Math.min(acc.minY, n.y),
                      maxX: Math.max(acc.maxX, n.x + n.width),
                      maxY: Math.max(acc.maxY, n.y + n.height),
                    }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
                    const canvasEl = canvasRef.current;
                    if (!canvasEl) return;
                    const cw = canvasEl.clientWidth;
                    const ch = canvasEl.clientHeight;
                    const bw = bounds.maxX - bounds.minX;
                    const bh = bounds.maxY - bounds.minY;
                    const pad = 60;
                    const scale = Math.min((cw - pad * 2) / bw, (ch - pad * 2) / bh, 1.5);
                    const newZoom = Math.round(Math.max(30, Math.min(200, scale * 100)));
                    const cx = (bounds.minX + bounds.maxX) / 2;
                    const cy = (bounds.minY + bounds.maxY) / 2;
                    const px = cw / 2 - cx * (newZoom / 100);
                    const py = ch / 2 - cy * (newZoom / 100);
                    setZoom(newZoom);
                    setPanOffset({ x: px, y: py });
                  } },
                  { icon: 'delete', title: 'Delete Node', action: () => selected && deleteNode(selected.id) },
                ].map(a => (
                  <button key={a.icon} onClick={a.action} title={a.title}
                    className="p-2 rounded-lg hover:bg-white/10 text-white transition-colors">
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{a.icon}</span>
                  </button>
                ))}
              </div>

              {/* Alignment */}
              <div>
                <span className="block font-black text-[10px] text-[#c6c6cb] uppercase tracking-wider mb-2">Alignment</span>
                <div className="grid grid-cols-6 gap-1 rounded-lg p-1 border border-white/8 mb-1.5" style={{ background: cardBg }}>
                  {([
                    { icon: 'align_horizontal_left',   axis: 'left',    title: 'Align Left' },
                    { icon: 'align_horizontal_center', axis: 'centerH', title: 'Center H' },
                    { icon: 'align_horizontal_right',  axis: 'right',   title: 'Align Right' },
                    { icon: 'align_vertical_top',      axis: 'top',     title: 'Align Top' },
                    { icon: 'align_vertical_center',   axis: 'centerV', title: 'Center V' },
                    { icon: 'align_vertical_bottom',   axis: 'bottom',  title: 'Align Bottom' },
                  ] as { icon: string; axis: Parameters<typeof alignSelected>[0]; title: string }[]).map(a => (
                    <button key={a.axis} onClick={() => alignSelected(a.axis)} title={a.title}
                      className="aspect-square rounded flex items-center justify-center text-white hover:bg-white/10 transition-colors">
                      <span className="material-symbols-outlined" style={{ fontSize: 17 }}>{a.icon}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Node color picker */}
              {selected && (
                <div className="space-y-3">
                  <div>
                    <span className="block font-black text-[10px] text-[#c6c6cb] uppercase tracking-wider mb-2">Fill Color</span>
                    <div className="flex gap-1.5 flex-wrap items-center">
                      {(Object.entries(DARK_COLOR_MAP) as [NodeColor, typeof DARK_COLOR_MAP[NodeColor]][]).map(([c, v]) => (
                        <button key={c} onClick={() => updateNode(selected.id, { color: c, customFill: undefined })}
                          title={c.charAt(0).toUpperCase() + c.slice(1)}
                          className={`w-7 h-7 rounded-full border-2 transition-all ${selected.color === c && !selected.customFill ? 'ring-2 ring-white scale-110' : 'hover:scale-110'}`}
                          style={{ background: v.bg, borderColor: v.border, boxShadow: selected.color === c && !selected.customFill ? `0 0 12px ${v.glow}` : 'none' }} />
                      ))}
                      <div className="flex flex-col items-center justify-center relative group">
                        <input type="color" value={selected.customFill || '#ffffff'}
                          onChange={e => updateNode(selected.id, { customFill: e.target.value })}
                          className={`w-7 h-7 cursor-pointer rounded-full p-0 border-2 ${selected.customFill ? 'ring-2 ring-white scale-110' : 'hover:scale-110'}`}
                          style={{ background: selected.customFill || 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)', borderColor: selected.customFill || '#64748b' }}
                          title="Custom Fill Color" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <span className="block font-black text-[10px] text-[#c6c6cb] uppercase tracking-wider mb-2">Border Customization</span>
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-center">
                        <input type="color" value={selected.customBorderColor || (DARK_COLOR_MAP[selected.color]?.border || '#ffffff')}
                          onChange={e => updateNode(selected.id, { customBorderColor: e.target.value })}
                          className={`w-7 h-7 cursor-pointer rounded-full p-0 border-2 border-white`}
                          title="Custom Border Color" />
                        <span className="text-[8px] text-[#8b9bb4] mt-1">Color</span>
                      </div>
                      <div className="flex flex-col flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-[#8b9bb4]">Weight</span>
                          <span className="text-[10px] text-white font-mono bg-[#1c2b3c] px-1 rounded">{selected.customBorderWidth ?? 2}px</span>
                        </div>
                        <input type="range" min="0" max="10" step="1"
                          value={selected.customBorderWidth ?? 2}
                          onChange={e => updateNode(selected.id, { customBorderWidth: parseInt(e.target.value) })}
                          className="w-full accent-violet-500 h-1.5 bg-[#1c2b3c] rounded-lg appearance-none cursor-pointer" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Node type selector */}
              {selected && (
                <div>
                  <span className="block font-black text-[10px] text-[#c6c6cb] uppercase tracking-wider mb-2">Node Type</span>
                  <div className="grid grid-cols-4 gap-1 max-h-[180px] overflow-y-auto custom-scroll pr-1">
                    {(['Process','Square','Decision','Database','Cloud','People','Business','Technical','Computer','Oval','Diamond','Parallelogram','Document','Hexagon','Triangle','Swimlane','Gantt','UMLClass','EREntity','CircuitResistor','CircuitCapacitor','CircuitGround','CircuitSource','VennCircle','BarSegment','PieWedge','LinePoint','ScatterPoint','HistogramBar','DFDProcess','DFDDataStore','DFDExternalEntity'] as NodeType[]).map(t => (
                      <button key={t} onClick={() => updateNode(selected.id, { type: t })}
                        className={`py-1.5 rounded-lg text-[9px] font-bold flex flex-col items-center gap-0.5 border transition-all ${selected.type === t ? 'border-violet-400 text-violet-300' : 'border-white/8 text-[#c6c6cb] hover:border-white/20'}`}
                        style={{ background: selected.type === t ? 'rgba(139,92,246,0.15)' : cardBg }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{TYPE_ICON[t]}</span>
                        <span className="truncate w-full px-1 text-center">{t}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Layout Coordinates */}
              {selected && (
                <div>
                  <span className="block font-black text-[10px] text-[#c6c6cb] uppercase tracking-wider mb-2">Layout</span>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { label: 'X', key: 'x', val: selected.x },
                      { label: 'Y', key: 'y', val: selected.y },
                      { label: 'W', key: 'width', val: selected.width },
                      { label: 'H', key: 'height', val: selected.height },
                    ] as { label: string; key: keyof DiagramNode; val: number }[]).map(f => (
                      <div key={f.key} className="rounded-lg p-2 flex flex-col" style={{ background: cardBg }}>
                        <span className="text-[10px] text-[#c6c6cb] mb-1">{f.label}</span>
                        <input
                          type="number"
                          value={f.val ?? ''}
                          onChange={e => {
                            const raw = e.target.value;
                            if (raw === '') return;
                            const val = Number(raw);
                            if (isNaN(val)) return;
                            if ((f.key === 'width' || f.key === 'height') && val < 10) return;
                            updateNode(selected.id, { [f.key]: val } as any);
                          }}
                          className="bg-transparent border-none p-0 text-white text-xs focus:ring-0 w-full outline-none font-semibold"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Rotation & Sticky Notes */}
              {selected && (
                <div className="space-y-4">
                  <div>
                    <span className="block font-black text-[10px] text-[#c6c6cb] uppercase tracking-wider mb-2">Rotation</span>
                    <div className="grid grid-cols-4 gap-1">
                      {([0, 90, 180, 270] as const).map(angle => (
                        <button
                          key={angle}
                          onClick={() => updateNode(selected.id, { rotation: angle })}
                          className={`py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                            (selected.rotation || 0) === angle
                              ? 'border-violet-400 text-violet-300 bg-violet-400/10'
                              : 'border-white/8 text-[#c6c6cb] hover:border-white/20'
                          }`}
                          style={{ background: cardBg }}
                        >
                          {angle}°
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="block font-black text-[10px] text-[#c6c6cb] uppercase tracking-wider mb-2">Sticky Notes</span>
                    <div className="rounded-xl p-3 border border-white/8 space-y-2" style={{ background: cardBg }}>
                      <textarea
                        value={selected.notes || ''}
                        onChange={e => updateNode(selected.id, { notes: e.target.value })}
                        placeholder="Add annotations, documentation, or implementation notes for this node..."
                        rows={3}
                        className="w-full bg-black/20 border border-white/10 rounded-lg p-2 text-white text-[11px] focus:ring-1 focus:ring-violet-500 focus:border-violet-500 outline-none resize-none custom-scroll placeholder-white/30"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Text Style */}
              {selected && (
                <div>
                  <span className="block font-black text-[10px] text-[#c6c6cb] uppercase tracking-wider mb-2">Text Style</span>
                  <div className="rounded-xl p-3 border border-white/8 space-y-3" style={{ background: cardBg }}>
                    {/* Title Font Size */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] text-white/50 uppercase tracking-wider">Title Size</span>
                        <span className="text-[10px] text-white/70 font-mono">{selected.titleStyle?.fontSize || (selected.variant === 'text' ? 18 : 14)}px</span>
                      </div>
                      <input type="range" min="8" max="48" step="1"
                        value={selected.titleStyle?.fontSize || (selected.variant === 'text' ? 18 : 14)}
                        onChange={e => updateNode(selected.id, { titleStyle: { ...(selected.titleStyle || {}), fontSize: Number(e.target.value) } })}
                        className="w-full h-1.5 bg-[#0f172a] rounded-lg appearance-none cursor-pointer accent-violet-400"
                      />
                    </div>
                    {/* Description Font Size */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] text-white/50 uppercase tracking-wider">Desc Size</span>
                        <span className="text-[10px] text-white/70 font-mono">{selected.descriptionStyle?.fontSize || 11}px</span>
                      </div>
                      <input type="range" min="8" max="30" step="1"
                        value={selected.descriptionStyle?.fontSize || 11}
                        onChange={e => updateNode(selected.id, { descriptionStyle: { ...(selected.descriptionStyle || {}), fontSize: Number(e.target.value) } })}
                        className="w-full h-1.5 bg-[#0f172a] rounded-lg appearance-none cursor-pointer accent-violet-400"
                      />
                    </div>
                    {/* Font Family */}
                    <div>
                      <span className="block text-[10px] text-white/50 uppercase tracking-wider mb-1.5">Font Family</span>
                      <div className="grid grid-cols-2 gap-1">
                        {['Inter', 'Arial', 'Georgia', 'monospace', 'sans-serif', 'serif'].map(f => (
                          <button key={f} onClick={() => updateNode(selected.id, { titleStyle: { ...(selected.titleStyle || {}), fontFamily: f } })}
                            className={`py-1 rounded text-[10px] font-bold border transition-all ${(selected.titleStyle?.fontFamily || 'Inter') === f ? 'border-violet-400 text-violet-300 bg-violet-400/10' : 'border-white/8 text-[#c6c6cb] hover:border-white/20'}`}>
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Text Color & Bold/Italic */}
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-center">
                        <input type="color" value={selected.titleStyle?.color || '#ffffff'}
                          onChange={e => updateNode(selected.id, { titleStyle: { ...(selected.titleStyle || {}), color: e.target.value } })}
                          className="w-7 h-7 cursor-pointer rounded-full p-0 border-2 border-white"
                          title="Text Color" />
                        <span className="text-[8px] text-[#8b9bb4] mt-1">Color</span>
                      </div>
                      <button onClick={() => updateNode(selected.id, { titleStyle: { ...(selected.titleStyle || {}), fontWeight: selected.titleStyle?.fontWeight === 'bold' ? 'normal' : 'bold' } })}
                        className={`p-2 rounded-lg border transition-all ${selected.titleStyle?.fontWeight === 'bold' ? 'border-violet-400 text-violet-300 bg-violet-400/10' : 'border-white/8 text-[#c6c6cb] hover:border-white/20'}`}
                        title="Bold">
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>format_bold</span>
                      </button>
                      <button onClick={() => updateNode(selected.id, { titleStyle: { ...(selected.titleStyle || {}), fontStyle: selected.titleStyle?.fontStyle === 'italic' ? 'normal' : 'italic' } })}
                        className={`p-2 rounded-lg border transition-all ${selected.titleStyle?.fontStyle === 'italic' ? 'border-violet-400 text-violet-300 bg-violet-400/10' : 'border-white/8 text-[#c6c6cb] hover:border-white/20'}`}
                        title="Italic">
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>format_italic</span>
                      </button>
                      <button onClick={() => updateNode(selected.id, { titleStyle: { ...(selected.titleStyle || {}), textDecoration: selected.titleStyle?.textDecoration === 'underline' ? 'none' : 'underline' } })}
                        className={`p-2 rounded-lg border transition-all ${selected.titleStyle?.textDecoration === 'underline' ? 'border-violet-400 text-violet-300 bg-violet-400/10' : 'border-white/8 text-[#c6c6cb] hover:border-white/20'}`}
                        title="Underline">
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>format_underlined</span>
                      </button>
                    </div>
                    {/* Vertical Align */}
                    <div>
                      <span className="block text-[10px] text-white/50 uppercase tracking-wider mb-1.5">Vertical Align</span>
                      <div className="grid grid-cols-3 gap-1">
                        {['top', 'center', 'bottom'].map(a => (
                          <button key={a} onClick={() => updateNode(selected.id, { titleStyle: { ...(selected.titleStyle || {}), verticalAlign: a } })}
                            className={`py-1 rounded text-[10px] font-bold border transition-all ${(selected.titleStyle?.verticalAlign || 'center') === a ? 'border-violet-400 text-violet-300 bg-violet-400/10' : 'border-white/8 text-[#c6c6cb] hover:border-white/20'}`}>
                            {a}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Arrangement */}
              <div>
                <span className="block font-black text-[10px] text-[#c6c6cb] uppercase tracking-wider mb-2">Arrangement</span>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { icon: 'flip_to_front', label: 'Forward', action: () => selected && setNodes(p => { const i = p.findIndex(n => n.id === selected.id); if (i < p.length-1) { const a = [...p]; [a[i], a[i+1]] = [a[i+1], a[i]]; return a; } return p; }) },
                    { icon: 'vertical_align_top', label: 'Front', action: () => selected && setNodes(p => { const n = p.find(x => x.id === selected.id)!; return [...p.filter(x => x.id !== selected.id), n]; }) },
                    { icon: 'flip_to_back', label: 'Backward', action: () => selected && setNodes(p => { const i = p.findIndex(n => n.id === selected.id); if (i > 0) { const a = [...p]; [a[i], a[i-1]] = [a[i-1], a[i]]; return a; } return p; }) },
                    { icon: 'vertical_align_bottom', label: 'Back', action: () => selected && setNodes(p => { const n = p.find(x => x.id === selected.id)!; return [n, ...p.filter(x => x.id !== selected.id)]; }) },
                  ].map(a => (
                    <button key={a.label} onClick={a.action}
                      className="py-1.5 rounded-lg border border-white/8 text-white hover:bg-white/10 transition-colors flex items-center justify-center gap-1.5 font-semibold"
                      style={{ background: cardBg }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{a.icon}</span>{a.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Connections list */}
              {connections.length > 0 && (
                <div>
                  <span className="block font-black text-[10px] text-[#c6c6cb] uppercase tracking-wider mb-2">Connections ({connections.length})</span>
                  <div className="space-y-1 max-h-36 overflow-y-auto custom-scroll">
                    {connections.map(c => {
                      const f = nodes.find(n => n.id === c.from);
                      const t = nodes.find(n => n.id === c.to);
                      if (!f || !t) return null;
                      return (
                        <div key={c.id} 
                             className={`flex items-center justify-between rounded-lg px-3 py-2 border cursor-pointer transition-colors ${selectedConnId === c.id ? 'border-violet-400 bg-violet-400/10' : 'border-white/8 bg-[#1c2b3c] hover:bg-white/10'}`}
                             onClick={() => { setSelectedConnId(c.id); setSelectedNode(null); multiSelect.clearSelect(); }}>
                          <span className="text-[10px] text-[#c6c6cb] truncate flex-1">{f.title} → {t.title}</span>
                          <button onClick={(e) => { e.stopPropagation(); deleteConnection(c.id); if (selectedConnId === c.id) setSelectedConnId(null); }} className="ml-2 text-white/30 hover:text-rose-400 transition-colors">✕</button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Show empty state only when nothing is selected at all */}
              {!selected && (
                <div className="text-center text-white/30 text-[11px] pt-4">
                  <span className="material-symbols-outlined text-2xl block mb-2">touch_app</span>
                  Select a node or connection to edit its properties
                </div>
              )}
              </>
            )}
          </>
        ) : (
          /* Connection properties if selected */
          <>
                {selectedConn && (
                  <div className="space-y-4">
                    <div>
                      <span className="block font-black text-[10px] text-[#c6c6cb] uppercase tracking-wider mb-2">Connection Style</span>
                      <div className="rounded-xl p-3 border border-white/8 space-y-4" style={{ background: cardBg }}>
                        
                        {/* Line Type */}
                        <div>
                          <div className="text-[10px] text-white/50 font-bold uppercase tracking-wider mb-1">Line Type</div>
                          <div className="grid grid-cols-4 gap-1">
                            {(['Orthogonal','Curved','Straight','Elbow'] as ConnType[]).map(t => (
                              <button key={t} onClick={() => updateConnection(selectedConn.id, { type: t })}
                                className={`py-1 rounded-lg text-[10px] font-bold border transition-all ${selectedConn.type === t ? 'border-violet-400 text-violet-300 bg-violet-400/10' : 'border-white/8 text-[#c6c6cb] hover:border-white/20'}`}
                                style={{ background: selectedConn.type === t ? undefined : '#0f172a' }}>
                                {t}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Arrowhead */}
                        <div>
                          <div className="text-[10px] text-white/50 font-bold uppercase tracking-wider mb-1">Arrowhead</div>
                          <div className="grid grid-cols-4 gap-1">
                            {(['Arrow','Dot','Diamond',"Crow's Foot"] as Arrowhead[]).map(a => (
                              <button key={a} onClick={() => updateConnection(selectedConn.id, { arrowhead: a })}
                                className={`py-1 rounded-lg text-[10px] font-bold border transition-all ${selectedConn.arrowhead === a ? 'border-blue-400 text-blue-300 bg-blue-400/10' : 'border-white/8 text-[#c6c6cb] hover:border-white/20'}`}
                                style={{ background: selectedConn.arrowhead === a ? undefined : '#0f172a' }}>
                                {a.slice(0,5)}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Line Dash Style */}
                        <div>
                          <div className="text-[10px] text-white/50 font-bold uppercase tracking-wider mb-1">Line Dash</div>
                          <div className="grid grid-cols-3 gap-1">
                            {([
                              { label: 'Solid', value: 'solid' },
                              { label: 'Dotted', value: 'dotted' },
                              { label: 'Dashed', value: 'dashed' },
                            ] as { label: string; value: 'solid'|'dotted'|'dashed' }[]).map(s => (
                              <button key={s.value} onClick={() => updateConnection(selectedConn.id, { lineStyle: s.value })}
                                className={`py-1 rounded-lg text-[10px] font-bold border transition-all ${selectedConn.lineStyle === s.value || (!selectedConn.lineStyle && s.value === 'solid') ? 'border-emerald-400 text-emerald-300 bg-emerald-400/10' : 'border-white/8 text-[#c6c6cb] hover:border-white/20'}`}
                                style={{ background: selectedConn.lineStyle === s.value || (!selectedConn.lineStyle && s.value === 'solid') ? undefined : '#0f172a' }}>
                                {s.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Arrow Direction */}
                        <div>
                          <div className="text-[10px] text-white/50 font-bold uppercase tracking-wider mb-1">Direction</div>
                          <div className="grid grid-cols-3 gap-1">
                            {([
                              { label: 'One-way', value: 'forward' },
                              { label: 'Bidirectional', value: 'both' },
                              { label: 'None', value: 'none' },
                            ] as { label: string; value: 'forward'|'both'|'none' }[]).map(d => (
                              <button key={d.value} onClick={() => updateConnection(selectedConn.id, { arrowDirection: d.value })}
                                className={`py-1 rounded-lg text-[10px] font-bold border transition-all ${selectedConn.arrowDirection === d.value || (!selectedConn.arrowDirection && d.value === 'forward') ? 'border-amber-400 text-amber-300 bg-amber-400/10' : 'border-white/8 text-[#c6c6cb] hover:border-white/20'}`}
                                style={{ background: selectedConn.arrowDirection === d.value || (!selectedConn.arrowDirection && d.value === 'forward') ? undefined : '#0f172a' }}>
                                {d.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Dimensions (Thickness and Offset) */}
                        <div className="pt-2 border-t border-white/8 space-y-4">
                          <div>
                            <div className="flex justify-between items-center mb-1.5">
                              <span className="text-[10px] text-white/50 font-bold uppercase tracking-wider">Line Weight</span>
                              <span className="text-[10px] text-white/70 font-mono">{selectedConn.thickness || 2}px</span>
                            </div>
                            <input type="range" min="1" max="10" step="1" 
                              value={selectedConn.thickness || 2}
                              onChange={e => updateConnection(selectedConn.id, { thickness: Number(e.target.value) }, false)}
                              onPointerUp={() => pushHistory(nodes, connections)}
                              className="w-full h-1.5 bg-[#0f172a] rounded-lg appearance-none cursor-pointer accent-violet-400"
                            />
                          </div>
                          <div>
                            <div className="flex justify-between items-center mb-1.5">
                              <span className="text-[10px] text-white/50 font-bold uppercase tracking-wider">Angle / Offset</span>
                              <span className="text-[10px] text-white/70 font-mono">{selectedConn.routingOffset || 0}</span>
                            </div>
                            <input type="range" min="-150" max="150" step="5" 
                              value={selectedConn.routingOffset || 0}
                              onChange={e => updateConnection(selectedConn.id, { routingOffset: Number(e.target.value) }, false)}
                              onPointerUp={() => pushHistory(nodes, connections)}
                              className="w-full h-1.5 bg-[#0f172a] rounded-lg appearance-none cursor-pointer accent-violet-400"
                            />
                            <div className="text-[9px] text-white/30 mt-1.5 text-center leading-tight">
                              Adjusts the arc curve, elbow depth, or straight line intersection points.
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between items-center mb-1.5">
                              <span className="text-[10px] text-white/50 font-bold uppercase tracking-wider">Vertical Shift</span>
                              <span className="text-[10px] text-white/70 font-mono">{selectedConn.routingOffsetY || 0}</span>
                            </div>
                            <input type="range" min="-100" max="100" step="2" 
                              value={selectedConn.routingOffsetY || 0}
                              onChange={e => updateConnection(selectedConn.id, { routingOffsetY: Number(e.target.value) }, false)}
                              onPointerUp={() => pushHistory(nodes, connections)}
                              className="w-full h-1.5 bg-[#0f172a] rounded-lg appearance-none cursor-pointer accent-violet-400"
                            />
                            <div className="text-[9px] text-white/30 mt-1.5 text-center leading-tight">
                              Perpendicular offset from the midline.
                            </div>
                          </div>
                        </div>

                        {/* Delete button */}
                        <button onClick={() => { deleteConnection(selectedConn.id); setSelectedConnId(null); }}
                          className="w-full py-2 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/20 hover:border-transparent rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1">
                          <span className="material-symbols-outlined text-sm">delete</span>
                          Delete Connection
                        </button>

                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

          {/* ── AI CHAT ─────────────────────────────────────────────────── */}
          {activeRightTab === 'update' && (
            <div className="flex flex-col flex-1 overflow-hidden">
              {/* Chat header */}
              <div className="px-4 py-2.5 border-b border-white/8 flex items-center justify-between flex-shrink-0" style={{ background: 'rgba(39,54,71,0.5)' }}>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#8b5cf6' }}>smart_toy</span>
                  <span className="text-xs font-bold text-white uppercase tracking-wide">AI Architect</span>
                </div>
                <div className="flex gap-2 items-center">
                  {aiLoading && (
                    <button onClick={stopStreaming}
                      className="text-[10px] text-rose-400 hover:text-rose-300 font-bold border border-rose-400/30 px-2 py-0.5 rounded-full">
                      Stop
                    </button>
                  )}
                  <button
                    onClick={() => setChatMessages([{ role: 'assistant', content: "Chat reset. How can I help redesign your architecture?" }])}
                    className="text-[#c6c6cb] hover:text-white transition-colors" title="Reset Chat">
                    <span className="material-symbols-outlined" style={{ fontSize: 17 }}>close_fullscreen</span>
                  </button>
                </div>
              </div>

              {/* Quick suggestions */}
              <div className="flex gap-1.5 px-3 py-2 overflow-x-auto flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {[
                  'Add a Redis cache node',
                  'Add a Load Balancer',
                  'Insert an API Gateway',
                  'Add monitoring node',
                ].map(s => (
                  <button key={s} onClick={() => handleSendChat(s)}
                    className="flex-shrink-0 text-[10px] text-violet-300 border border-violet-400/30 rounded-full px-2.5 py-1 hover:bg-violet-400/10 transition-colors font-semibold whitespace-nowrap">
                    {s}
                  </button>
                ))}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scroll">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex gap-2.5 group ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 border ${
                      msg.role === 'user'
                        ? isAppLight
                          ? 'bg-blue-500/10 border-blue-500/20 text-blue-700'
                          : 'bg-blue-500/20 border-blue-500/30 text-blue-300'
                        : isAppLight
                          ? 'bg-violet-500/10 border-violet-500/20 text-violet-700'
                          : 'bg-violet-500/10 border-white/8 text-violet-400'
                    }`}>
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{msg.role === 'user' ? 'person' : 'smart_toy'}</span>
                    </div>
                    <div className="flex flex-col max-w-[85%]">
                      <div className={`p-3 rounded-2xl text-xs leading-relaxed border ${
                        msg.role === 'user'
                          ? isAppLight
                            ? 'bg-blue-500/10 border-blue-500/20 text-blue-900 rounded-tr-none'
                            : 'bg-blue-500/15 border-blue-500/25 text-blue-100 rounded-tr-none'
                          : isAppLight
                            ? 'bg-slate-100 border-slate-200 text-slate-800 rounded-tl-none'
                            : 'bg-[#122131] border-white/8 text-white rounded-tl-none'
                      }`}>
                        {msg.content}
                      </div>
                      
                      {/* Message controls */}
                      <div className="flex gap-2 items-center justify-end mt-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(msg.content);
                            setCopiedIndex(i);
                            setTimeout(() => setCopiedIndex(null), 1500);
                          }}
                          className={`flex items-center transition-colors border-none bg-transparent cursor-pointer p-0.5 ${
                            isAppLight ? 'text-slate-400 hover:text-slate-700' : 'text-white/40 hover:text-white'
                          }`}
                          title="Copy Message"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{copiedIndex === i ? 'check' : 'content_copy'}</span>
                          {copiedIndex === i && <span className="text-[8px] ml-0.5 font-bold uppercase tracking-wider text-emerald-400">Copied</span>}
                        </button>
                        
                        <button 
                          onClick={() => setChatMessages(prev => prev.filter((_, idx) => idx !== i))}
                          className={`flex items-center transition-colors border-none bg-transparent cursor-pointer p-0.5 ${
                            isAppLight ? 'text-slate-400 hover:text-rose-600' : 'text-white/40 hover:text-rose-400'
                          }`}
                          title="Delete Message"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 12 }}>delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {agentStatus === 'streaming' && streamingText && (
                  <div className="flex gap-2.5">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 border ${
                      isAppLight
                        ? 'bg-violet-500/10 border-violet-500/20 text-violet-700'
                        : 'bg-violet-500/10 border-white/8 text-violet-400'
                    }`}>
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>smart_toy</span>
                    </div>
                    <div className={`p-3 rounded-2xl text-xs max-w-[85%] leading-relaxed rounded-tl-none border ${
                      isAppLight
                        ? 'bg-slate-100 border-slate-200 text-slate-800'
                        : 'bg-[#122131] border-white/8 text-white'
                    }`}>
                      {streamingText}
                      <span className="inline-flex ml-1 w-1.5 h-3 bg-violet-400 animate-pulse align-middle" />
                    </div>
                  </div>
                )}
                {(agentStatus === 'connecting' || agentStatus === 'applying') && (
                  <div className="flex gap-2.5">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center border ${
                      isAppLight
                        ? 'bg-violet-500/10 border-violet-500/20 text-violet-700'
                        : 'bg-violet-500/10 border-white/8'
                    }`}>
                      <span className="material-symbols-outlined text-violet-400" style={{ fontSize: 14 }}>smart_toy</span>
                    </div>
                    <div className={`p-3 rounded-2xl flex gap-1.5 items-center border ${
                      isAppLight
                        ? 'bg-slate-100 border-slate-200 text-slate-800'
                        : 'bg-[#122131] border-white/8'
                    }`}>
                      <span className={`text-[10px] mr-1 font-bold uppercase tracking-wider ${
                        isAppLight ? 'text-violet-700/80' : 'text-violet-400/80'
                      }`}>
                        {agentStatus === 'connecting' ? 'Connecting to Gateway…' : 'Assembling Nodes…'}
                      </span>
                      {[0,1,2].map(i => (
                        <div 
                          key={i} 
                          className={`w-1.5 h-1.5 rounded-full animate-bounce ${isAppLight ? 'bg-violet-600' : 'bg-violet-400'}`} 
                          style={{ animationDelay: `${i * 0.15}s` }} 
                        />
                      ))}
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className={`p-3 border-t flex-shrink-0 flex flex-col gap-2 ${
                isAppLight ? 'border-slate-200 bg-slate-50' : 'border-white/8 bg-[#1c2b3c]/20'
              }`}>
                {chatImage && (
                  <div className={`flex items-center gap-2 rounded-xl p-2 self-start relative group shadow-lg border ${
                    isAppLight ? 'bg-slate-200 border-slate-300' : 'bg-[#1c2b3c] border-white/10'
                  }`}>
                    <Image src={chatImage} alt="Upload preview" width={48} height={48} className="object-cover rounded-lg border border-white/10" unoptimized />
                    <div className="flex flex-col pr-6">
                      <span className={`text-[10px] font-bold ${isAppLight ? 'text-slate-800' : 'text-white/90'}`}>Screenshot Loaded</span>
                      <span className={`text-[9px] mt-0.5 ${isAppLight ? 'text-slate-500' : 'text-[#c6c6cb]'}`}>Ready for Vision AI</span>
                    </div>
                    <button 
                      onClick={() => setChatImage(null)}
                      className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all cursor-pointer border-none text-[10px]"
                    >
                      ✕
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-2 rounded-full pl-2 pr-1 py-1 border border-white/10 focus-within:border-violet-500/50 transition-colors" style={{ background: cardBg }}>
                  <input 
                    type="file" 
                    id="vision-upload" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleImageUpload} 
                  />
                  <label 
                    htmlFor="vision-upload" 
                    className="flex items-center justify-center w-8 h-8 rounded-full text-[#c6c6cb] hover:text-white hover:bg-white/8 transition-all cursor-pointer flex-shrink-0"
                    title="Upload screenshot of a diagram"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>photo_camera</span>
                  </label>

                  <input
                    type="text"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendChat()}
                    placeholder={chatImage ? "Describe what to do with this screenshot…" : "Describe a change to the diagram…"}
                    className="bg-transparent border-none text-xs text-white flex-1 focus:ring-0 outline-none"
                    style={{ caretColor: '#8b5cf6' }}
                    disabled={aiLoading}
                  />
                  {aiLoading ? (
                    <button
                      onClick={stopStreaming}
                      className="w-8 h-8 rounded-full text-white flex items-center justify-center hover:opacity-80 transition-all flex-shrink-0 border-none cursor-pointer"
                      style={{ background: '#ef4444' }}
                      title="Stop Generation"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>stop</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSendChat()}
                      disabled={(!chatInput.trim() && !chatImage)}
                      className="w-8 h-8 rounded-full text-white flex items-center justify-center hover:opacity-80 transition-all flex-shrink-0 border-none cursor-pointer disabled:opacity-40"
                      style={{ background: '#8b5cf6' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 17 }}>send</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </aside>
        )}
      </div>

      {/* ── Context Menu ────────────────────────────────────────────────────── */}
      {contextMenu && (
        <div
          className="fixed z-[100] glass rim border border-white/10 rounded-xl shadow-2xl py-1 w-48 text-xs font-semibold popover-entry"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onContextMenu={e => e.preventDefault()}
        >
          {contextMenu.type === 'node' && (
            <>
              <button
                className="w-full text-left px-4 py-2 hover:bg-white/10 text-white flex gap-2 items-center"
                onClick={() => {
                  if (contextMenu.targetId) {
                    setSelectedNode(contextMenu.targetId);
                    setTimeout(() => copySelected(), 0);
                  }
                  setContextMenu(null);
                }}
              ><span className="material-symbols-outlined" style={{fontSize: 16}}>content_copy</span>Copy</button>
              <button
                className="w-full text-left px-4 py-2 hover:bg-white/10 text-white flex gap-2 items-center"
                onClick={() => {
                  if (contextMenu.targetId) {
                    setSelectedNode(contextMenu.targetId);
                    setTimeout(() => cutSelected(), 0);
                  }
                  setContextMenu(null);
                }}
              ><span className="material-symbols-outlined" style={{fontSize: 16}}>content_cut</span>Cut</button>
              <button
                className="w-full text-left px-4 py-2 hover:bg-white/10 text-white flex gap-2 items-center"
                onClick={() => {
                  if (contextMenu.targetId) duplicateNode(contextMenu.targetId);
                  setContextMenu(null);
                }}
              ><span className="material-symbols-outlined" style={{fontSize: 16}}>content_copy</span>Duplicate</button>
              <button
                className="w-full text-left px-4 py-2 hover:bg-white/10 text-white flex gap-2 items-center"
                onClick={() => {
                  if (contextMenu.targetId) {
                    rotateNode(contextMenu.targetId, 90);
                  }
                  setContextMenu(null);
                }}
              ><span className="material-symbols-outlined" style={{fontSize: 16}}>rotate_right</span>Rotate 90°</button>
              <button
                className="w-full text-left px-4 py-2 hover:bg-rose-500/20 text-rose-400 flex gap-2 items-center"
                onClick={() => {
                  if (contextMenu.targetId) deleteNode(contextMenu.targetId);
                  setContextMenu(null);
                }}
              ><span className="material-symbols-outlined" style={{fontSize: 16}}>delete</span>Delete</button>
            </>
          )}
          {contextMenu.type === 'canvas' && (
            <>
              <button
                className="w-full text-left px-4 py-2 hover:bg-white/10 text-white flex gap-2 items-center"
                onClick={() => { setShowTemplates(true); setContextMenu(null); }}
              ><span className="material-symbols-outlined" style={{fontSize: 16}}>dashboard_customize</span>Insert Template</button>
              <button
                className="w-full text-left px-4 py-2 hover:bg-white/10 text-white flex gap-2 items-center"
                onClick={() => { undo(nodes, connections); setContextMenu(null); }}
                disabled={!canUndo}
              ><span className="material-symbols-outlined" style={{fontSize: 16}}>undo</span>Undo</button>
            </>
          )}
        </div>
      )}

      {/* ── Templates Modal ─────────────────────────────────────────────────── */}
      {showTemplates && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 animate-fade-in"
          style={{ background: 'rgba(5,20,36,0.72)', backdropFilter: 'blur(6px)' }}
          onClick={() => setShowTemplates(false)}>
          <div className="glass rim w-full max-w-[800px] h-[80vh] rounded-2xl shadow-2xl border border-white/10 scale-in-bounce flex flex-col"
            style={{ background: 'linear-gradient(135deg,#0d1c2d 60%,#122131)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-amber-400" style={{ fontSize: 24 }}>dashboard_customize</span>
                <h2 className="text-lg font-bold text-white">Diagram Templates</h2>
              </div>
              <button onClick={() => setShowTemplates(false)} className="text-white/40 hover:text-white transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 grid grid-cols-2 md:grid-cols-3 gap-4 custom-scroll">
              {DIAGRAM_TEMPLATES.map(tmpl => (
                <button key={tmpl.id} onClick={() => {
                  applyTemplate(tmpl);
                  setShowTemplates(false);
                }} className="text-left border border-white/10 rounded-xl p-4 hover:border-violet-500/50 hover:bg-white/5 transition-all group relative overflow-hidden" style={{ background: 'rgba(0,0,0,0.1)' }}>
                  <h3 className="font-bold text-white text-sm mb-1 group-hover:text-violet-300">{tmpl.name}</h3>
                  <p className="text-[#c6c6cb] text-xs line-clamp-2">{tmpl.description}</p>
                  <div className="absolute right-0 bottom-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity text-violet-400">
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Shortcuts Modal ─────────────────────────────────────────────────── */}
      {showShortcuts && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 animate-fade-in"
          style={{ background: 'rgba(5,20,36,0.72)', backdropFilter: 'blur(6px)' }}
          onClick={() => setShowShortcuts(false)}>
          <div className="glass rim w-full max-w-[400px] rounded-2xl shadow-2xl border border-white/10 scale-in-bounce flex flex-col"
            style={{ background: 'linear-gradient(135deg,#0d1c2d 60%,#122131)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-violet-400" style={{ fontSize: 24 }}>keyboard</span>
                <h2 className="text-lg font-bold text-white">Keyboard Shortcuts</h2>
              </div>
              <button onClick={() => setShowShortcuts(false)} className="text-white/40 hover:text-white transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-5 space-y-3">
              {[
                { key: 'Ctrl+Z', desc: 'Undo' },
                { key: 'Ctrl+Y', desc: 'Redo' },
                { key: 'Ctrl+D', desc: 'Duplicate Selected' },
                { key: 'Ctrl+A', desc: 'Select All' },
                { key: 'Shift+Drag', desc: 'Multi-select' },
                { key: 'Alt+Drag', desc: 'Pan Canvas' },
                { key: '+ / -', desc: 'Zoom In/Out' },
                { key: '0', desc: 'Reset Zoom' },
                { key: 'f', desc: 'Fit to Screen' },
                { key: 'Del / Backspace', desc: 'Delete Selected' },
              ].map(s => (
                <div key={s.key} className="flex items-center justify-between">
                  <span className="text-xs text-[#c6c6cb]">{s.desc}</span>
                  <kbd className="px-2 py-1 bg-black/30 border border-white/10 rounded text-[10px] text-white font-mono">{s.key}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Minimap ─────────────────────────────────────────────────────────── */}
      {showMinimap && (
        <div 
          className="fixed w-[200px] h-[180px] bg-black/50 border border-white/10 rounded-xl overflow-hidden shadow-2xl z-40 hidden lg:block backdrop-blur-md select-none"
          style={{
            left: minimapPos?.x ?? 280,
            top: minimapPos?.y ?? (windowSize.height - 200),
          }}
        >
          {/* Header Drag Handle */}
          <div 
            className="w-full h-[30px] bg-white/5 border-b border-white/10 px-2 flex items-center justify-between cursor-move"
            onPointerDown={handleMinimapDragStart}
            onPointerMove={handleMinimapDragMove}
            onPointerUp={handleMinimapDragEnd}
            onPointerCancel={handleMinimapDragEnd}
          >
            <div className="flex items-center gap-1.5 pointer-events-none">
              <span className="material-symbols-outlined text-[15px] text-violet-400">drag_pan</span>
              <span className="text-[9px] font-bold text-white/60 uppercase tracking-wider">Minimap</span>
            </div>
            <button 
              onClick={() => setShowMinimap(false)}
              className="text-white/40 hover:text-white hover:bg-white/10 w-5 h-5 rounded flex items-center justify-center transition-all cursor-pointer border-none bg-transparent"
              title="Close Minimap"
            >
              <span className="material-symbols-outlined text-[13px]">close</span>
            </button>
          </div>

          <div className="w-full h-[150px] relative overflow-hidden bg-black/20">
            <div className="w-full h-full relative" style={{ transform: 'scale(0.08)', transformOrigin: '0 0' }}>
              {nodes.map(n => (
                <div key={n.id} className="absolute bg-violet-400/50 border border-violet-300 rounded"
                  style={{ left: n.x, top: n.y, width: n.width, height: n.height }} />
              ))}
            </div>
            {/* Viewport indicator */}
            <div className="absolute border-2 border-amber-400/50 bg-amber-400/10"
              style={{
                left: Math.max(0, -panOffset.x * 0.08 / (zoom/100)),
                top: Math.max(0, -panOffset.y * 0.08 / (zoom/100)),
                width: Math.min(200, (windowSize.width / (zoom/100)) * 0.08),
                height: Math.min(150, (windowSize.height / (zoom/100)) * 0.08),
              }}
            />
          </div>
        </div>
      )}

      {/* Loading overlay during export */}
      {isExporting && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center"
          style={{ background: 'rgba(5,20,36,0.6)', backdropFilter: 'blur(4px)' }}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-white/20 border-t-[#3b82f6] rounded-full animate-spin" />
            <p className="text-sm text-white/80 font-semibold">Exporting diagram…</p>
          </div>
        </div>
      )}

      {/* ── Export Dialog ──────────────────────────────────────────────────── */}
      {exportDialog?.isOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-fade-in"
          style={{ background: 'rgba(5,15,28,0.78)', backdropFilter: 'blur(10px)' }}
          onClick={() => setExportDialog(null)}
        >
          <div
            className="glass rim w-full max-w-[430px] rounded-3xl shadow-[0_24px_64px_rgba(0,0,0,0.6)] border border-white/10 scale-in-bounce overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #0d1e33 0%, #061121 100%)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Top accent glowing bar */}
            <div className="h-1.5 w-full bg-gradient-to-r from-violet-500 via-blue-500 to-emerald-400" />
            
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(139,92,246,0.15)', border: '1.5px solid rgba(139,92,246,0.3)' }}
                  >
                    <span className="material-symbols-outlined text-violet-400 animate-pulse" style={{ fontSize: 22 }}>download</span>
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white tracking-tight">Export Canvas Architecture</h3>
                    <p className="text-[10px] text-white/40 font-semibold uppercase tracking-wider mt-0.5">Customize your export options</p>
                  </div>
                </div>
                <button
                  onClick={() => setExportDialog(null)}
                  className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white flex items-center justify-center transition-all cursor-pointer border-none bg-transparent"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>

              <div className="space-y-4">
                {/* Format Segmented Pill Selector */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#8b9bb4] block mb-2">Export Format</label>
                  <div className="grid grid-cols-3 gap-1.5 bg-black/35 rounded-xl p-1 border border-white/5">
                    {(['png', 'jpeg', 'svg'] as const).map(fmt => (
                      <button
                        key={fmt}
                        onClick={() => setExportDialog(d => d ? { ...d, format: fmt } : null)}
                        className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border-none cursor-pointer flex items-center justify-center gap-1.5 ${
                          exportDialog.format === fmt
                            ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-md shadow-violet-500/20'
                            : 'text-[#c6c6cb] hover:text-white hover:bg-white/5 bg-transparent'
                        }`}
                      >
                        <span className="material-symbols-outlined text-xs" style={{ fontSize: 13 }}>
                          {fmt === 'png' ? 'image' : fmt === 'jpeg' ? 'photo' : 'category'}
                        </span>
                        {fmt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Background Selector with Visual Indicators */}
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#8b9bb4] block mb-2">Background Options</label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {([
                      { id: 'current', label: 'Current', style: { background: '#051424' } },
                      { id: 'transparent', label: 'Transp.', style: { backgroundImage: 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)', backgroundSize: '6px 6px', backgroundColor: '#fff' } },
                      { id: 'white', label: 'White', style: { background: '#ffffff' } },
                      { id: 'blueprint', label: 'Blueprint', style: { background: '#0a1e3c' } },
                      { id: 'grid', label: 'Grid', style: { background: '#051424' } },
                    ] as const).map(bg => {
                      const isActive = exportDialog.options.background === bg.id;
                      if (exportDialog.format === 'jpeg' && bg.id === 'transparent') return null;
                      return (
                        <button
                          key={bg.id}
                          onClick={() => setExportDialog(d => d ? { ...d, options: { ...d.options, background: bg.id } } : null)}
                          className={`rounded-xl p-1.5 transition-all border flex flex-col items-center gap-1.5 cursor-pointer bg-transparent ${
                            isActive
                              ? 'border-violet-500 bg-violet-500/10 shadow-[0_0_12px_rgba(139,92,246,0.15)]'
                              : 'border-white/5 bg-black/20 hover:border-white/15'
                          }`}
                        >
                          <div className="w-full aspect-[4/3] rounded-lg border border-white/10" style={bg.style} />
                          <span className="text-[9px] font-black tracking-tight text-[#c6c6cb] truncate w-full text-center">{bg.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Resolution Multiplier (PNG and JPEG only) */}
                {(exportDialog.format === 'png' || exportDialog.format === 'jpeg') && (
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#8b9bb4] block mb-2">Resolution Scale</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {([
                        { id: 1, label: '1x', desc: 'Web (Standard)' },
                        { id: 2, label: '2x', desc: 'HD / Print' },
                        { id: 3, label: '3x', desc: 'Ultra HD' },
                      ] as const).map(r => {
                        const isActive = exportDialog.options.resolution === r.id;
                        return (
                          <button
                            key={r.id}
                            onClick={() => setExportDialog(d => d ? { ...d, options: { ...d.options, resolution: r.id } } : null)}
                            className={`py-2 px-1 rounded-xl text-center transition-all border flex flex-col items-center justify-center cursor-pointer bg-transparent ${
                              isActive
                                ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_12px_rgba(59,130,246,0.15)]'
                                : 'border-white/5 bg-black/20 hover:border-white/15'
                            }`}
                          >
                            <span className={`text-xs font-black ${isActive ? 'text-blue-300' : 'text-white'}`}>{r.label}</span>
                            <span className="text-[8px] text-[#8b9bb4] mt-0.5 font-medium">{r.desc}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Padding selector */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#8b9bb4]">Padding Boundary</label>
                    <span className="text-[10px] font-black text-white font-mono bg-violet-500/20 border border-violet-500/30 px-1.5 py-0.5 rounded-md">{exportDialog.options.padding}px</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {([20, 40, 60, 80, 120] as const).map(p => {
                      const isActive = exportDialog.options.padding === p;
                      return (
                        <button
                          key={p}
                          onClick={() => setExportDialog(d => d ? { ...d, options: { ...d.options, padding: p } } : null)}
                          className={`py-2 rounded-xl text-[10px] font-black transition-all border cursor-pointer bg-transparent ${
                            isActive
                              ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                              : 'border-white/5 bg-black/20 hover:border-white/15'
                          }`}
                        >
                          {p}px
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex gap-2 justify-end pt-5 border-t border-white/5 mt-5">
                <button
                  onClick={() => setExportDialog(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-black border border-white/10 text-[#c6c6cb] hover:bg-white/6 hover:text-white transition-all cursor-pointer bg-transparent"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const fmt = exportDialog.format;
                    if (fmt === 'png') doExportPNG(exportDialog.options);
                    else if (fmt === 'jpeg') doExportJPEG(exportDialog.options);
                    else doExportSVG(exportDialog.options);
                  }}
                  className="px-5 py-2.5 rounded-xl text-xs font-black text-white transition-all hover:brightness-110 active:scale-95 flex items-center gap-2 cursor-pointer"
                  style={{
                    background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                    boxShadow: '0 8px 24px rgba(139,92,246,0.3)',
                  }}
                >
                  <span className="material-symbols-outlined text-sm" style={{ fontSize: 16 }}>download</span>
                  Generate Download
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Animated Custom Confirm Dialog ──────────────────────────────────── */}
      {confirmDialog.isOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-fade-in"
          style={{ background: 'rgba(5,20,36,0.72)', backdropFilter: 'blur(6px)' }}
          onClick={() => setConfirmDialog(p => ({ ...p, isOpen: false }))}
        >
          <div
            className="glass rim w-full max-w-[340px] rounded-2xl shadow-2xl border border-white/10 scale-in-bounce overflow-hidden"
            style={{ background: 'linear-gradient(135deg,#0d1c2d 60%,#122131)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header stripe */}
            <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg,#f43f5e,#8b5cf6,#3b82f6)' }} />

            <div className="p-5">
              {/* Icon + title */}
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(244,63,94,0.15)', border: '1.5px solid rgba(244,63,94,0.35)' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#f43f5e' }}>warning</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-white leading-tight">{confirmDialog.title}</p>
                  <p className="text-[10px] text-white/30 font-medium mt-0.5">This action cannot be undone</p>
                </div>
              </div>

              {/* Message */}
              <p className="text-xs text-[#c6c6cb] leading-relaxed mb-5 pl-1">
                {confirmDialog.message}
              </p>

              {/* Actions */}
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setConfirmDialog(p => ({ ...p, isOpen: false }))}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-white/10 text-[#c6c6cb] hover:bg-white/6 hover:text-white transition-all"
                  style={{ background: cardBg }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDialog.onConfirm}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-all hover:brightness-110 active:scale-95"
                  style={{ background: 'linear-gradient(135deg,#f43f5e,#e11d48)', boxShadow: '0 4px 16px rgba(244,63,94,0.35)' }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <ProjectLimitModal isOpen={showLimitModal} onClose={() => setShowLimitModal(false)} />
    </div>
  );
}
