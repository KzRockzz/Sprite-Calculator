// modules/storage.js
const DB_NAME = 'sprite-calc-db';
const DB_VER = 1;
const STORE = 'kv';

let dbp = null;

function openDB() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

export async function get(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const st = tx.objectStore(STORE);
    const rq = st.get(key);
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error);
  });
}

export async function set(key, val) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const st = tx.objectStore(STORE);
    const rq = st.put(val, key);
    rq.onsuccess = () => resolve();
    rq.onerror = () => reject(rq.error);
  });
}

export const KEYS = Object.freeze({
  items: 'items',
  recentSearches: 'recent',
  recentItems: 'recentItems',
  calc: 'calc',
  bills: 'bills',
  settings: 'settings',
  theme: 'theme'
});
