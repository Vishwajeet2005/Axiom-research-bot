export interface Session {
  id: string;
  title: string;
  createdAt: number;
  msgCount: number;
}

export interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  ts: number;
}

const NAME = 'axiom_db';
const VERSION = 1;
let _db: IDBDatabase | null = null;

export async function openDB(): Promise<IDBDatabase> {
  if (_db) return _db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(NAME, VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('sessions')) {
        const s = db.createObjectStore('sessions', { keyPath: 'id' });
        s.createIndex('createdAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains('messages')) {
        const m = db.createObjectStore('messages', { keyPath: 'id' });
        m.createIndex('sessionId', 'sessionId');
      }
      if (!db.objectStoreNames.contains('kv')) {
        db.createObjectStore('kv', { keyPath: 'k' });
      }
    };
    req.onsuccess = () => {
      _db = req.result;
      resolve(_db);
    };
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(storeName: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDB();
  const transaction = db.transaction(storeName, mode);
  const store = transaction.objectStore(storeName);
  return new Promise((resolve, reject) => {
    const request = fn(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function dbGet<T>(store: string, key: string): Promise<T | undefined> {
  return tx(store, 'readonly', (s) => s.get(key));
}

export async function dbPut(store: string, val: any): Promise<void> {
  try {
    await tx(store, 'readwrite', (s) => s.put(val));
  } catch (err: any) {
    if (err.name === 'QuotaExceededError') {
      console.error('Storage quota exceeded. Please clear some data in Settings.');
      alert('Storage quota exceeded. Please clear some data in Settings.');
      return;
    }
    console.error('IndexedDB Put Error:', err);
  }
}

export async function dbDel(store: string, key: string): Promise<void> {
  await tx(store, 'readwrite', (s) => s.delete(key));
}

export async function dbGetAll<T>(store: string): Promise<T[]> {
  return tx(store, 'readonly', (s) => s.getAll());
}

export async function dbGetAllByIndex<T>(store: string, idx: string, val: any): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, 'readonly');
    const request = transaction.objectStore(store).index(idx).getAll(val);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function kvGet(k: string): Promise<string | null> {
  const r = await dbGet<{ k: string; v: string }>('kv', k);
  return r ? r.v : null;
}

export async function kvSet(k: string, v: string): Promise<void> {
  return dbPut('kv', { k, v });
}

export async function clearAllDB(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve) => {
    const transaction = db.transaction(['sessions', 'messages', 'kv'], 'readwrite');
    transaction.objectStore('sessions').clear();
    transaction.objectStore('messages').clear();
    transaction.objectStore('kv').clear();
    transaction.oncomplete = () => resolve();
  });
}
