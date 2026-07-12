export interface SyncBlock {
  fileId: number;
  line: number;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export class SyncTexParser {
  public blocks: SyncBlock[] = [];
  public files: Record<number, string> = {};

  constructor(syncTexData: string) {
    this.parse(syncTexData);
  }

  private parse(data: string) {
    const lines = data.split('\n');
    let currentPage = 1;

    for (const lineStr of lines) {
      if (lineStr.startsWith('Input:')) {
        const parts = lineStr.split(':');
        if (parts.length >= 3) {
          const id = parseInt(parts[1], 10);
          this.files[id] = parts.slice(2).join(':').trim();
        }
      } else if (lineStr.startsWith('{')) {
        currentPage = parseInt(lineStr.substring(1), 10);
      } else if (
        lineStr.startsWith('[') ||
        lineStr.startsWith('v') ||
        lineStr.startsWith('h') ||
        lineStr.startsWith('x')
      ) {
        // format: [fileId,line:x:y:W:H:D
        const match = lineStr.match(/^[\[vhx](\d+),(\d+):(-?\d+):(-?\d+)/);
        if (match) {
          const fileId = parseInt(match[1], 10);
          const line = parseInt(match[2], 10);
          const x_sp = parseInt(match[3], 10);
          const y_sp = parseInt(match[4], 10);

          // Convert scaled points (sp) to points (pt)
          const x = x_sp / 65536.0;
          const y = y_sp / 65536.0;

          let w = 0;
          let h = 0;

          const parts = lineStr.split(':');
          if (parts.length >= 6) {
             w = parseInt(parts[4], 10) / 65536.0;
             h = parseInt(parts[5], 10) / 65536.0;
          }

          // Ignore blocks with 0 coordinates as they are often generic layout boxes
          if (x !== 0 && y !== 0) {
            this.blocks.push({ fileId, line, page: currentPage, x, y, w, h });
          }
        }
      }
    }
  }

  // Returns line number for a specific click
  public getLineForPosition(page: number, x: number, y: number): { line: number, file: string } | null {
    const pageBlocks = this.blocks.filter(b => b.page === page);
    if (pageBlocks.length === 0) return null;

    let closest = null;
    let minDistance = Infinity;

    for (const b of pageBlocks) {
      const dx = b.x - x;
      const dy = b.y - y;
      // Weight Y distance more heavily since lines are horizontal
      const dist = dx * dx + (dy * dy * 4); 
      if (dist < minDistance) {
        minDistance = dist;
        closest = b;
      }
    }

    if (closest) {
      return { line: closest.line, file: this.files[closest.fileId] };
    }
    return null;
  }

  // Returns exact coordinates for a source line
  public getPositionForLine(line: number): SyncBlock | null {
    // Return the first block on the given line
    const exactMatch = this.blocks.find(b => b.line === line);
    if (exactMatch) return exactMatch;
    
    // If no exact match (e.g. empty line or macro), find closest line
    let closest = null;
    let minDiff = Infinity;
    for (const b of this.blocks) {
       const diff = Math.abs(b.line - line);
       if (diff < minDiff) {
          minDiff = diff;
          closest = b;
       }
    }
    return closest;
  }
}
