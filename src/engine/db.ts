// ─── Tiny IndexedDB wrapper (library records + poster blobs) ────────────────

const DB_NAME = 'afterglow';
const DB_VERSION = 1;
export const STORE_LIBRARY = 'library';
export const STORE_POSTERS = 'posters';
export const STORE_META = 'meta';

let dbPromise: Promise<IDBDatabase> | null = null;

// In-memory fallback for contexts where IndexedDB is unavailable/blocked
// (sandboxed preview iframes, some private modes). Data won't persist there,
// but the app stays fully functional.
let memoryMode = false;
const memory = new Map<string, Map<string, unknown>>();
const memStore = (store: string) => {
  if (!memory.has(store)) memory.set(store, new Map());
  return memory.get(store)!;
};

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_LIBRARY)) db.createObjectStore(STORE_LIBRARY);
      if (!db.objectStoreNames.contains(STORE_POSTERS)) db.createObjectStore(STORE_POSTERS);
      if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  if (memoryMode) return Promise.reject(new Error('memory mode'));
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

function available(): boolean {
  if (memoryMode) return false;
  try {
    if (typeof indexedDB === 'undefined' || !indexedDB) throw new Error();
    return true;
  } catch {
    memoryMode = true;
    return false;
  }
}

async function safe<T>(fallback: () => T, run: () => Promise<T>): Promise<T> {
  if (!available()) return fallback();
  try {
    return await run();
  } catch {
    memoryMode = true;
    return fallback();
  }
}

export const idb = {
  get: <T>(store: string, key: string) =>
    safe<T | undefined>(
      () => memStore(store).get(key) as T | undefined,
      () => tx<T | undefined>(store, 'readonly', (s) => s.get(key) as IDBRequest<T | undefined>),
    ),
  set: (store: string, key: string, value: unknown) =>
    safe<unknown>(
      () => memStore(store).set(key, value),
      () => tx(store, 'readwrite', (s) => s.put(value, key)),
    ),
  del: (store: string, key: string) =>
    safe<unknown>(
      () => memStore(store).delete(key),
      () => tx(store, 'readwrite', (s) => s.delete(key)),
    ),
  keys: (store: string) =>
    safe<IDBValidKey[]>(
      () => [...memStore(store).keys()],
      () => tx<IDBValidKey[]>(store, 'readonly', (s) => s.getAllKeys()),
    ),
  getAll: <T>(store: string) =>
    safe<T[]>(
      () => [...memStore(store).values()] as T[],
      () => tx<T[]>(store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>),
    ),
  clear: (store: string) =>
    safe<unknown>(
      () => memStore(store).clear(),
      () => tx(store, 'readwrite', (s) => s.clear()),
    ),
  /** true when persistence is unavailable and data lives only in memory */
  isEphemeral: () => memoryMode,
};
