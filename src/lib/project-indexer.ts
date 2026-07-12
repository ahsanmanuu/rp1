/**
 * Project Indexer
 * Indexes labels and bibliography keys across all project files.
 */

import { type StudioFile } from './studio-fs';

export interface ProjectIndex {
  labels: string[];
  citations: string[];
}

export function indexProject(files: StudioFile[]): ProjectIndex {
  const labels: Set<string> = new Set();
  const citations: Set<string> = new Set();

  files.forEach(file => {
    if (file.isDirectory) return;

    if (file.name.endsWith('.tex')) {
      // Index labels: \label{key}
      const labelRegex = /\\label\{([^}]+)\}/g;
      let match;
      while ((match = labelRegex.exec(file.content)) !== null) {
        labels.add(match[1]);
      }
    }

    if (file.name.endsWith('.bib')) {
      // Index citations: @type{key, ...}
      // Very loose regex for BibTeX keys
      const bibRegex = /@\w+\{([^,]+),/g;
      let match;
      while ((match = bibRegex.exec(file.content)) !== null) {
        citations.add(match[1].trim());
      }
    }
  });

  return {
    labels: Array.from(labels),
    citations: Array.from(citations),
  };
}
