import fs from 'fs';
import path from 'path';

/**
 * PipelineGC: Scholarly Document Pipeline Garbage Collector
 * 
 * Ensures 100% clean project state by purging intermediate LaTeX residue
 * and volatile processing buffers while preserving final artifacts (PDF/Source).
 */
export class PipelineGC {
  private static readonly INTERMEDIATE_EXTS = [
    '.aux', '.log', '.out', '.synctex.gz', '.fls', '.fdb_latexmk',
    '.toc', '.lof', '.lot', '.blg', '.bbl', '.bcf', '.run.xml',
    '.idx', '.ilg', '.ind', '.nav', '.snm', '.vrb', '.thm'
  ];

  /**
   * Cleans all intermediate LaTeX files from a project directory.
   * Call this after successful compilation or project closure.
   */
  static async flushResidue(projectId: string): Promise<{ purged: number; errors: string[] }> {
    const projectDir = path.join(process.cwd(), 'public', 'uploads', 'projects', projectId);
    const errors: string[] = [];
    let purged = 0;

    if (!fs.existsSync(projectDir)) {
      return { purged: 0, errors: [`Directory not found: ${projectDir}`] };
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

    console.log(`[PIPELINE_GC] Project ${projectId}: Purged ${purged} residue files.`);
    return { purged, errors };
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

  /**
   * Sanitizes in-memory buffers by suggesting GC.
   * While JS doesn't have explicit memory management, 
   * we null out provided large objects to assist the engine.
   */
  static sanitizeBuffers(objects: any[]) {
    for (let i = 0; i < objects.length; i++) {
      if (objects[i]) {
         if (Array.isArray(objects[i])) objects[i].length = 0;
         else if (typeof objects[i] === 'object') {
           for (const key in objects[i]) {
             if (Object.prototype.hasOwnProperty.call(objects[i], key)) {
               delete objects[i][key];
             }
           }
         }
         objects[i] = null;
      }
    }
  }
}
