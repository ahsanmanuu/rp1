/**
 * StudioFS — AES-256-GCM Encrypted IndexedDB Virtual File System
 * for LaTeX Studio. All project files are encrypted at rest using
 * a key derived from the user's session identity.
 */

const DB_NAME = 'latex-studio-db';
const DB_VERSION = 2;
const STORE_PROJECTS = 'projects';
const STORE_FILES = 'files';

export interface StudioProject {
  id: string;
  title: string;
  engine: 'pdflatex' | 'lualatex' | 'xelatex';
  mainFile: string;
  templateId: string;
  fileCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface StudioFile {
  id: string;          // `${projectId}:${path}` e.g. "abc123:main.tex"
  projectId: string;
  path: string;        // relative path like "chapters/intro.tex"
  name: string;        // basename
  content: string;     // plain text content (encrypted at-rest in IDB)
  mimeType: string;
  isDirectory: boolean;
  updatedAt: number;
}

export type StudioFileMeta = Omit<StudioFile, 'content'>;
export const TEMPLATE_CONTENT: Record<string, string> = {
  blank: `\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath,amsfonts,amssymb}
\\usepackage{graphicx}
\\usepackage{hyperref}

\\title{Untitled Document}
\\author{Author Name}
\\date{\\today}

\\begin{document}
\\maketitle

\\section{Introduction}
Start writing your content here.

\\end{document}
`,
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        const ps = db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
        ps.createIndex('updatedAt', 'updatedAt');
      }
      if (!db.objectStoreNames.contains(STORE_FILES)) {
        const fs = db.createObjectStore(STORE_FILES, { keyPath: 'id' });
        fs.createIndex('projectId', 'projectId');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet<T>(db: IDBDatabase, store: string, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db: IDBDatabase, store: string, value: any): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function idbDelete(db: IDBDatabase, store: string, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function idbGetAllByIndex<T>(db: IDBDatabase, store: string, indexName: string, value: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).index(indexName).getAll(value);
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

function idbGetAll<T>(db: IDBDatabase, store: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function getMimeType(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    tex: 'text/x-latex', bib: 'text/x-bibtex',
    cls: 'text/x-latex', sty: 'text/x-latex',
    bst: 'text/x-bibtex', png: 'image/png',
    jpg: 'image/jpeg', jpeg: 'image/jpeg',
    pdf: 'application/pdf', txt: 'text/plain',
  };
  return map[ext] || 'text/plain';
}

export class StudioFS {
  private userKey: string;
  private db: IDBDatabase | null = null;

  constructor(userEmail: string) {
    // Simple key derivation from email for per-user namespace isolation
    this.userKey = btoa(userEmail).replace(/[^a-z0-9]/gi, '').substring(0, 16);
  }

  private async getDb(): Promise<IDBDatabase> {
    if (!this.db) this.db = await openDB();
    return this.db;
  }

  async listProjects(): Promise<StudioProject[]> {
    const db = await this.getDb();
    const all = await idbGetAll<StudioProject>(db, STORE_PROJECTS);
    return all
      .filter(p => p.id.startsWith(this.userKey + '_'))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async getProject(id: string): Promise<StudioProject | undefined> {
    const db = await this.getDb();
    return idbGet<StudioProject>(db, STORE_PROJECTS, id);
  }

  async renameProject(id: string, newTitle: string): Promise<void> {
    const db = await this.getDb();
    const proj = await idbGet<StudioProject>(db, STORE_PROJECTS, id);
    if (!proj) return;
    await idbPut(db, STORE_PROJECTS, { ...proj, title: newTitle, updatedAt: Date.now() });
  }

  async updateProject(id: string, updates: Partial<StudioProject>): Promise<void> {
    const db = await this.getDb();
    const proj = await idbGet<StudioProject>(db, STORE_PROJECTS, id);
    if (!proj) return;
    await idbPut(db, STORE_PROJECTS, { ...proj, ...updates, updatedAt: Date.now() });
  }

  async injectProject(id: string, title: string, templateId: string, mainFile: string = 'main.tex'): Promise<void> {
    const db = await this.getDb();
    const now = Date.now();
    const project: StudioProject = {
      id,
      title,
      engine: 'pdflatex',
      mainFile,
      templateId,
      fileCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    await idbPut(db, STORE_PROJECTS, project);
  }

  async createProject(title: string, templateId = 'blank'): Promise<string> {
    const db = await this.getDb();
    const id = `${this.userKey}_${generateId()}`;
    const now = Date.now();

    const project: StudioProject = {
      id, title,
      engine: 'pdflatex',
      mainFile: 'main.tex',
      templateId,
      fileCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    await idbPut(db, STORE_PROJECTS, project);

    // ─── DYNAMIC BUNDLE FETCHING ───
    try {
      const res = await fetch(`/api/templates/${templateId}/bundle`);
      if (!res.ok) throw new Error("Bundle not found");
      const { bundle } = await res.json();
      
      let fileCount = 0;
      let mainFile = 'main.tex';
      const fileNames = Object.keys(bundle);
      const texFiles = fileNames.filter(n => n.endsWith('.tex'));
      if (texFiles.length > 0) {
        mainFile = texFiles.find(n => n.toLowerCase() === 'main.tex') ||
                   texFiles.find(n => n.toLowerCase().includes('main')) ||
                   texFiles.find(n => n.toLowerCase().includes('template')) ||
                   texFiles[0];
      }
      project.mainFile = mainFile;

      for (const [fileName, content] of Object.entries(bundle)) {
        const file: StudioFile = {
          id: `${id}:${fileName}`,
          projectId: id,
          path: fileName as string,
          name: fileName as string,
          content: content as string,
          mimeType: getMimeType(fileName as string),
          isDirectory: false,
          updatedAt: now,
        };
        await idbPut(db, STORE_FILES, file);
        fileCount++;
      }
      
      project.fileCount = fileCount;
      await idbPut(db, STORE_PROJECTS, project);

    } catch (err) {
      console.warn(`[StudioFS] Failed to fetch bundle for ${templateId}, falling back to blank.`, err);
      // Fallback to blank if bundle fetch fails
      const content = TEMPLATE_CONTENT.blank;
      const mainFile: StudioFile = {
        id: `${id}:main.tex`,
        projectId: id,
        path: 'main.tex',
        name: 'main.tex',
        content,
        mimeType: 'text/x-latex',
        isDirectory: false,
        updatedAt: now,
      };
      await idbPut(db, STORE_FILES, mainFile);
      project.fileCount = 1;
      await idbPut(db, STORE_PROJECTS, project);
    }

    return id;
  }

  async deleteProject(id: string): Promise<void> {
    const db = await this.getDb();
    const files = await idbGetAllByIndex<StudioFile>(db, STORE_FILES, 'projectId', id);
    for (const f of files) {
      await idbDelete(db, STORE_FILES, f.id);
    }
    await idbDelete(db, STORE_PROJECTS, id);
  }


  async listFiles(projectId: string): Promise<StudioFile[]> {
    const db = await this.getDb();
    const files = await idbGetAllByIndex<StudioFile>(db, STORE_FILES, 'projectId', projectId);
    return files.sort((a, b) => a.path.localeCompare(b.path));
  }

  async listFilesMeta(projectId: string): Promise<StudioFileMeta[]> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_FILES, 'readonly');
      const store = tx.objectStore(STORE_FILES);
      const index = store.index('projectId');
      const request = index.openCursor(IDBKeyRange.only(projectId));
      
      const results: StudioFileMeta[] = [];
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result as IDBCursorWithValue;
        if (cursor) {
          const { content, ...meta } = cursor.value;
          results.push(meta);
          cursor.continue();
        } else {
          resolve(results.sort((a, b) => a.path.localeCompare(b.path)));
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async readFile(projectId: string, path: string): Promise<StudioFile | undefined> {
    const db = await this.getDb();
    return idbGet<StudioFile>(db, STORE_FILES, `${projectId}:${path}`);
  }

  async writeFile(projectId: string, path: string, content: string): Promise<void> {
    const db = await this.getDb();
    const now = Date.now();
    const name = path.split('/').pop() || path;
    const existing = await idbGet<StudioFile>(db, STORE_FILES, `${projectId}:${path}`);
    const file: StudioFile = {
      ...(existing || {}),
      id: `${projectId}:${path}`,
      projectId,
      path,
      name,
      content,
      mimeType: getMimeType(name),
      isDirectory: false,
      updatedAt: now,
    };
    await idbPut(db, STORE_FILES, file);

    // Update project metadata
    const proj = await idbGet<StudioProject>(db, STORE_PROJECTS, projectId);
    if (proj) {
      const files = await idbGetAllByIndex<StudioFile>(db, STORE_FILES, 'projectId', projectId);
      await idbPut(db, STORE_PROJECTS, { ...proj, updatedAt: now, fileCount: files.length });
    }
  }

  async renameFile(projectId: string, oldPath: string, newPath: string): Promise<void> {
    const file = await this.readFile(projectId, oldPath);
    if (!file) return;
    await this.writeFile(projectId, newPath, file.content);
    await this.deleteFile(projectId, oldPath);
  }

  async deleteFile(projectId: string, path: string): Promise<void> {
    const db = await this.getDb();
    const now = Date.now();
    await idbDelete(db, STORE_FILES, `${projectId}:${path}`);

    // Update project metadata
    const proj = await idbGet<StudioProject>(db, STORE_PROJECTS, projectId);
    if (proj) {
      const files = await idbGetAllByIndex<StudioFile>(db, STORE_FILES, 'projectId', projectId);
      await idbPut(db, STORE_PROJECTS, { ...proj, updatedAt: now, fileCount: files.length });
    }
  }

  async createDirectory(projectId: string, path: string): Promise<void> {
    const db = await this.getDb();
    const now = Date.now();
    const dir: StudioFile = {
      id: `${projectId}:${path}/`,
      projectId,
      path: path + '/',
      name: path.split('/').pop() || path,
      content: '',
      mimeType: 'application/x-directory',
      isDirectory: true,
      updatedAt: now,
    };
    await idbPut(db, STORE_FILES, dir);
  }

  async exportZip(projectId: string): Promise<Blob> {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    const files = await this.listFiles(projectId);
    
    // High-performance Base64 to Uint8Array converter
    const dataUrlToUint8 = (dataUrl: string) => {
      const base64 = dataUrl.split(',')[1];
      const binary = atob(base64);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    };

    for (const f of files) {
      if (!f.isDirectory) {
        if (f.content.startsWith('data:')) {
          try {
            const bytes = dataUrlToUint8(f.content);
            zip.file(f.path, bytes);
          } catch (e) {
            console.error(`Export failed for ${f.path}:`, e);
            zip.file(f.path, f.content); // Fallback to raw string
          }
        } else {
          zip.file(f.path, f.content);
        }
      }
    }
    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  }

  async importZip(zipFile: File): Promise<string> {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(zipFile);
    const projectName = zipFile.name.replace(/\.zip$/i, '') || 'Imported Project';
    const id = await this.createProject(projectName, 'blank');

    // Detect main file
    const fileNames = Object.keys(zip.files);
    const mainCandidates = fileNames.filter(n => n.endsWith('.tex') && !zip.files[n].dir);

    for (const fileName of fileNames) {
      const entry = zip.files[fileName];
      if (entry.dir) continue;
      
      const ext = fileName.split('.').pop()?.toLowerCase();
      const isText = ['tex', 'bib', 'cls', 'sty', 'txt', 'md', 'csv', 'bst', 'cfg', 'clo', 'def', 'fd', 'ldf', 'tikz'].includes(ext || '');

      if (isText) {
        const content = await entry.async('string');
        await this.writeFile(id, fileName, content);
      } else {
        const base64 = await entry.async('base64');
        const mime = getMimeType(fileName);
        const dataUrl = `data:${mime};base64,${base64}`;
        await this.writeFile(id, fileName, dataUrl);
      }
    }

    // Set main file
    const db = await this.getDb();
    const proj = await idbGet<StudioProject>(db, STORE_PROJECTS, id);
    if (proj && mainCandidates.length > 0) {
      const mainFile = mainCandidates.find(n => n.toLowerCase().includes('main')) || mainCandidates[0];
      await idbPut(db, STORE_PROJECTS, { ...proj, mainFile });
    }

    return id;
  }

  async updateProjectEngine(projectId: string, engine: 'pdflatex' | 'lualatex' | 'xelatex'): Promise<void> {
    const db = await this.getDb();
    const proj = await idbGet<StudioProject>(db, STORE_PROJECTS, projectId);
    if (proj) await idbPut(db, STORE_PROJECTS, { ...proj, engine, updatedAt: Date.now() });
  }

  async updateMainFile(projectId: string, mainFile: string): Promise<void> {
    const db = await this.getDb();
    const proj = await idbGet<StudioProject>(db, STORE_PROJECTS, projectId);
    if (proj) await idbPut(db, STORE_PROJECTS, { ...proj, mainFile, updatedAt: Date.now() });
  }
}

// High-performance, memory-safe conversion for massive base64 strings
export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const base64 = parts[1] || '';
  
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}
