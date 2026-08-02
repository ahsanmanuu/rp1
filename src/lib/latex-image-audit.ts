/**
 * Latex image reference audit (Phase 4).
 *
 * The assembled LaTeX references images via \includegraphics{...} and
 * \zimg{...} (assembler's custom figure macro). Every referenced target must
 * resolve to a real project image file — otherwise the compile fails with a
 * hard-to-debug "file not found" or renders a broken placeholder. This audit
 * makes missing references loud instead of silent, so image-loss root causes
 * (extraction bugs, trimming, template collisions) surface in the logs.
 */

export interface LatexImageAudit {
  /** Number of unique image references found in the latex source. */
  total: number;
  /** References that resolve to a real file (possibly via extension). */
  resolved: string[];
  /** References with no matching file anywhere in the project. */
  missing: string[];
}

const IMAGE_REF_RE = /\\(?:includegraphics|zimg)\s*(?:\[[^\]]*\])?\s*\{([^}]+)\}/g;
const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.pdf', '.eps', '.svg', '.tiff', '.tif', '.bmp', '.heic', '.heif'];

function normalizeRef(ref: string): string {
  return ref
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/[?#].*$/, '');
}

export function auditLatexImageReferences(latex: string, imageFiles: string[]): LatexImageAudit {
  const available = new Set(imageFiles.map((f) => f.replace(/\\/g, '/').toLowerCase()));
  const seen = new Set<string>();
  const refs: string[] = [];

  let match: RegExpExecArray | null;
  while ((match = IMAGE_REF_RE.exec(latex || ''))) {
    const ref = normalizeRef(match[1]);
    if (!ref || seen.has(ref)) continue;
    seen.add(ref);
    refs.push(ref);
  }

  const resolved: string[] = [];
  const missing: string[] = [];
  for (const ref of refs) {
    const base = ref.toLowerCase();
    if (
      available.has(base) ||
      IMAGE_EXTS.some((ext) => available.has(base + ext))
    ) {
      resolved.push(ref);
    } else {
      missing.push(ref);
    }
  }

  return { total: refs.length, resolved, missing };
}
