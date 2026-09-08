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
  userId?: string;
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
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Failed to save local document'));
  });
}

export async function getLocalDocument(projectId: string, userId?: string): Promise<LocalDocumentRecord | null> {
  if (typeof indexedDB === 'undefined' || !projectId) return null;
  try {
    const db = await openDb();
    const doc = await new Promise<LocalDocumentRecord | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(projectId);
      req.onsuccess = () => resolve((req.result as LocalDocumentRecord) || null);
      req.onerror = () => reject(req.error || new Error('Failed to read local document'));
    });

    if (!doc) return null;

    // Strict user isolation guard: if userId is provided and record has userId, enforce match
    if (userId && doc.userId && doc.userId !== userId) {
      console.warn(`[LOCAL-STORE] Security check failed: document ${projectId} belongs to user ${doc.userId}, requested by ${userId}`);
      return null;
    }

    return doc;
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