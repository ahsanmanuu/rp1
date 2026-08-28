/**
 * Local (browser IndexedDB) store for client-extracted DOCX uploads.
 *
 * DOC2LATEX uploads keep the original document bytes and the extracted figure
 * data on THIS device: the server receives only the text envelope (Phase 1)
 * and the figures are attached as multipart when the user picks a template
 * (Phase 2 generate-latex). This store bridges that gap, keyed by projectId
 * (known once the upload completes) so template selection can re-attach the
 * figures that belong to the project.
 *
 * IndexedDB is used instead of localStorage because figure data URLs can
 * total many MB.
 */

export interface LocalDocumentRecord {
  projectId: string;
  fileName: string;
  savedAt: number;
  envelope: {
    html: string;
    text: string;
    referencesText: string;
    figures: Array<{ name: string; contentType: string; dataUrl: string }>;
  };
}

const DB_NAME = 'latexify-doc2latex-local';
const DB_VERSION = 1;
const STORE = 'documents';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'projectId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open local document store'));
  });
}

export async function saveLocalDocument(record: LocalDocumentRecord): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(record);
    // Also store under fixed 'latest_upload' key so extraction is never lost across re-routes
    if (record.projectId !== 'latest_upload') {
      tx.objectStore(STORE).put({ ...record, projectId: 'latest_upload' });
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to save local document'));
  });
}

export async function getLocalDocument(projectId: string): Promise<LocalDocumentRecord | null> {
  if (typeof indexedDB === 'undefined') return null;
  try {
    const db = await openDb();
    const directDoc = await new Promise<LocalDocumentRecord | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(projectId);
      req.onsuccess = () => resolve((req.result as LocalDocumentRecord) || null);
      req.onerror = () => reject(req.error || new Error('Failed to read local document'));
    });

    if (directDoc?.envelope?.figures && directDoc.envelope.figures.length > 0) {
      return directDoc;
    }

    // Fallback 1: Try 'latest_upload' key
    const latestDoc = await new Promise<LocalDocumentRecord | null>((resolve) => {
      try {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get('latest_upload');
        req.onsuccess = () => resolve((req.result as LocalDocumentRecord) || null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });

    if (latestDoc?.envelope?.figures && latestDoc.envelope.figures.length > 0) {
      return latestDoc;
    }

    // Fallback 2: Scan all records and return the most recent one with figures
    const allDocs = await new Promise<LocalDocumentRecord[]>((resolve) => {
      try {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).getAll();
        req.onsuccess = () => resolve((req.result as LocalDocumentRecord[]) || []);
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });

    const withFigs = allDocs
      .filter(d => d && d.envelope && Array.isArray(d.envelope.figures) && d.envelope.figures.length > 0)
      .sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));

    return withFigs[0] || directDoc || null;
  } catch {
    return null;
  }
}

export async function deleteLocalDocument(projectId: string): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(projectId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Failed to delete local document'));
    });
  } catch {
    /* non-critical */
  }
}