import fs from 'fs';
import path from 'path';

/**
 * Server-side local-first project persistence (Phase 2).
 *
 * The doc2latex pipeline's most fragile link is PocketBase record size caps:
 * large documents can have structuredContent/latexContent trimmed, and record
 * loss wipes everything. This module persists the full project to the server's
 * local disk at upload time — main.tex, extracted images, modular LaTeX
 * components, and an ai-verdict.json snapshot — so recompiles, template
 * re-application and recovery never depend on DB content alone.
 *
 * Disk layout mirrors what the rest of the app already uses:
 *   public/uploads/projects/<projectId>/...
 */

export function localProjectDir(projectId: string): string {
  return path.join(process.cwd(), 'public', 'uploads', 'projects', projectId);
}

export function ensureLocalProjectDir(projectId: string): string {
  const dir = localProjectDir(projectId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function readLocalProjectFile(projectId: string, filename: string): Buffer | null {
  const target = path.join(localProjectDir(projectId), filename);
  if (!fs.existsSync(target)) return null;
  return fs.readFileSync(target);
}

export interface AiVerdictSnapshot {
  savedAt: number;
  aiLatex?: unknown;
  aiVerdict?: unknown;
  aiModel?: string | null;
}

/**
 * Persist a project's artifacts to the server-local filesystem.
 * `files` entries carry either a `buffer` (binary) or a `content` string
 * (plain UTF-8 text or a `data:` URL, which is decoded to base64 bytes).
 * Returns the list of filenames actually written.
 */
export function persistProjectToLocalFs(
  projectId: string,
  files: Array<{ filename: string; buffer?: Buffer; content?: string | null }>,
  aiSnapshot?: AiVerdictSnapshot
): string[] {
  const dir = ensureLocalProjectDir(projectId);
  const written: string[] = [];

  for (const file of files) {
    if (!file.filename) continue;
    const payload = file.buffer ?? decodeContent(file.content);
    if (payload === null || payload.length === 0) continue;

    const destPath = path.join(dir, file.filename);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, payload);
    written.push(file.filename);
  }

  if (aiSnapshot && (aiSnapshot.aiLatex || aiSnapshot.aiVerdict)) {
    fs.writeFileSync(path.join(dir, 'ai-verdict.json'), JSON.stringify(aiSnapshot), 'utf-8');
    written.push('ai-verdict.json');
  }

  return written;
}

function decodeContent(content?: string | null): Buffer | null {
  if (!content) return null;
  if (content.startsWith('data:')) {
    const comma = content.indexOf(',');
    const base64 = comma >= 0 ? content.slice(comma + 1) : content;
    return Buffer.from(base64, 'base64');
  }
  return Buffer.from(content, 'utf-8');
}

/**
 * Load the ai-verdict.json snapshot from disk if present (used by the
 * project GET route to self-heal structuredContent after PB content loss).
 */
export function readAiVerdictSnapshot(projectId: string): AiVerdictSnapshot | null {
  const raw = readLocalProjectFile(projectId, 'ai-verdict.json');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw.toString('utf-8')) as AiVerdictSnapshot;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}
