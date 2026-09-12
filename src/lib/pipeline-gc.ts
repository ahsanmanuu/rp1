import fs from 'fs';
import path from 'path';
import os from 'os';

export interface AutoFreeOptions {
  projectId?: string | null;
  tempDirs?: (string | null | undefined)[];
  buffers?: any[];
  customCleanup?: () => Promise<void> | void;
}

/**
 * PipelineGC: Universal Scholarly Studio Resource & Garbage Collector
 * 
 * Ensures 100% clean project state by purging intermediate LaTeX residue,
 * removing temporary processing directories, and sanitizing volatile memory
 * buffers on completion of every pipeline without altering workflows.
 */
export class PipelineGC {
  private static readonly INTERMEDIATE_EXTS = [
    '.aux', '.log', '.out', '.synctex.gz', '.fls', '.fdb_latexmk',
    '.toc', '.lof', '.lot', '.blg', '.bbl', '.bcf', '.run.xml',
    '.idx', '.ilg', '.ind', '.nav', '.snm', '.vrb', '.thm'
  ];
  private static lastFlushTempTime = 0;

  /**
   * Cleans all intermediate LaTeX files from a project directory.
   * Call this after successful compilation, failed compilation, or project closure.
   */
  static async flushResidue(projectId: string): Promise<{ purged: number; errors: string[] }> {
    if (!projectId) return { purged: 0, errors: [] };
    const projectDir = path.join(process.cwd(), 'public', 'uploads', 'projects', projectId);
    const errors: string[] = [];
    let purged = 0;

    if (!fs.existsSync(projectDir)) {
      return { purged: 0, errors: [] };
    }

    try {
      const files = await fs.promises.readdir(projectDir);
      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (this.INTERMEDIATE_EXTS.includes(ext)) {
          const fullPath = path.join(projectDir, file);
          try {
            await fs.promises.unlink(fullPath);
            purged++;
          } catch (err: any) {
            errors.push(`Failed to delete ${file}: ${err.message}`);
          }
        }
      }
    } catch (err: any) {
      errors.push(`Directory read failed: ${err.message}`);
    }

    if (purged > 0) {
      console.log(`[PIPELINE_GC] Project ${projectId}: Purged ${purged} intermediate residue files.`);
    }
    return { purged, errors };
  }

  /**
   * Safely deletes a specific temporary directory created during pipeline execution.
   * Handles Windows file locks gracefully with asynchronous deferred retry.
   */
  static cleanupTempDir(dirPath: string | null | undefined): void {
    if (!dirPath || typeof dirPath !== 'string') return;
    try {
      if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
      }
    } catch (err) {
      // Deferred retry for transient locks (common on Windows)
      setTimeout(() => {
        try {
          if (fs.existsSync(dirPath)) {
            fs.rmSync(dirPath, { recursive: true, force: true });
          }
        } catch {}
      }, 1000);
    }
  }

  /**
   * Sweeps os.tmpdir() for orphaned pipeline temp directories.
   * Only deletes directories older than maxAgeMs (default: 2 minutes)
   * to avoid interfering with actively running concurrent jobs.
   * Throttled to execute at most once every 3 minutes.
   */
  static async flushTempDirs(maxAgeMs: number = 120_000): Promise<{ purged: number; errors: string[] }> {
    const now = Date.now();
    if (now - this.lastFlushTempTime < 180_000) {
      return { purged: 0, errors: [] };
    }
    this.lastFlushTempTime = now;

    const tmpDir = os.tmpdir();
    let purged = 0;
    const errors: string[] = [];

    try {
      const entries = await fs.promises.readdir(tmpDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const name = entry.name;
        // Match temporary compilation / extraction directories created by our pipelines
        if (/^(?:scholarly-compile-|tex-compile-|doc2latex-|extract-|latex-studio-|diagram-)/i.test(name)) {
          const fullPath = path.join(tmpDir, name);
          try {
            const stats = await fs.promises.stat(fullPath);
            if (now - stats.mtimeMs > maxAgeMs) {
              await fs.promises.rm(fullPath, { recursive: true, force: true });
              purged++;
            }
          } catch (statOrRmErr: any) {
            errors.push(`Failed to clean ${name}: ${statOrRmErr.message}`);
          }
        }
      }
    } catch (readErr: any) {
      errors.push(`Failed to read tmpdir: ${readErr.message}`);
    }

    if (purged > 0) {
      console.log(`[PIPELINE_GC] Swept and purged ${purged} orphaned pipeline temp directories.`);
    }
    return { purged, errors };
  }

  /**
   * Sanitizes in-memory buffers, arrays, maps, and objects to facilitate immediate V8 GC.
   */
  static sanitizeBuffers(objects: any[]) {
    if (!Array.isArray(objects)) return;
    for (let i = 0; i < objects.length; i++) {
      const item = objects[i];
      if (!item) continue;
      try {
        if (Buffer.isBuffer(item)) {
          item.fill(0);
        } else if (Array.isArray(item)) {
          item.length = 0;
        } else if (item instanceof Map || item instanceof Set) {
          item.clear();
        } else if (typeof item === 'object') {
          for (const key of Object.keys(item)) {
            try { delete item[key]; } catch {}
          }
        }
        objects[i] = null;
      } catch {}
    }
  }

  /**
   * Universal automatic resource freeing provision for all tool pipelines.
   * Call this in a `finally` block on pipeline completion.
   * Safe and non-throwing to ensure ZERO disruption to normal workflows.
   */
  static async autoFree(options?: AutoFreeOptions): Promise<void> {
    if (!options) return;
    try {
      // 1. Clean explicit temporary directories
      if (options.tempDirs && Array.isArray(options.tempDirs)) {
        for (const dir of options.tempDirs) {
          if (dir) this.cleanupTempDir(dir);
        }
      }

      // 2. Flush intermediate residue files for the project (background non-blocking)
      if (options.projectId) {
        this.flushResidue(options.projectId).catch(() => {});
      }

      // 3. Sanitize in-memory buffers
      if (options.buffers && Array.isArray(options.buffers)) {
        this.sanitizeBuffers(options.buffers);
      }

      // 4. Run optional custom cleanup
      if (typeof options.customCleanup === 'function') {
        try {
          const res = options.customCleanup();
          if (res instanceof Promise) await res.catch(() => {});
        } catch {}
      }

      // 5. Sweep orphaned temp dirs (background non-blocking)
      this.flushTempDirs().catch(() => {});

      // 6. Signal V8 GC if available
      if (typeof global !== 'undefined' && typeof (global as any).gc === 'function') {
        try { (global as any).gc(); } catch {}
      }
    } catch (err: any) {
      console.warn('[PIPELINE_GC] autoFree non-fatal notice:', err?.message || err);
    }
  }

  /**
   * Higher-order wrapper guaranteeing autoFree execution in `finally`
   * without altering any workflow, return value, or thrown error.
   */
  static async withAutoFree<T>(
    context: { name: string; projectId?: string | null; tempDirs?: string[]; buffers?: any[] },
    pipelineFn: (tracker: {
      trackTempDir: (dir: string) => void;
      trackBuffer: (buf: any) => void;
    }) => Promise<T>
  ): Promise<T> {
    const trackedTempDirs: string[] = [...(context.tempDirs || [])];
    const trackedBuffers: any[] = [...(context.buffers || [])];

    const tracker = {
      trackTempDir: (dir: string) => {
        if (dir && !trackedTempDirs.includes(dir)) trackedTempDirs.push(dir);
      },
      trackBuffer: (buf: any) => {
        if (buf) trackedBuffers.push(buf);
      }
    };

    try {
      return await pipelineFn(tracker);
    } finally {
      await this.autoFree({
        projectId: context.projectId,
        tempDirs: trackedTempDirs,
        buffers: trackedBuffers
      });
    }
  }

  /**
   * Removes local stub .cls and .sty files to force Tectonic registry usage.
   * This is part of the "Hardening" process to ensure 100% fidelity.
   */
  static async purgeTemplateStubs(): Promise<{ deleted: string[] }> {
    const templateDir = path.join(process.cwd(), 'src', 'assets', 'templates');
    const deleted: string[] = [];
    
    if (!fs.existsSync(templateDir)) return { deleted: [] };

    const walk = async (dir: string) => {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (ext === '.cls' || ext === '.sty') {
             const stats = await fs.promises.stat(fullPath);
             // Stubs are typically very small (< 1KB) and contain "stub" or "minimal" in content
             if (stats.size < 1024) {
               const content = await fs.promises.readFile(fullPath, 'utf8');
               if (content.toLowerCase().includes('stub') || content.toLowerCase().includes('minimal')) {
                 await fs.promises.unlink(fullPath);
                 deleted.push(fullPath);
               }
             }
          }
        }
      }
    };

    await walk(templateDir);
    console.log(`[PIPELINE_GC] Purged ${deleted.length} template stubs.`);
    return { deleted };
  }
}
