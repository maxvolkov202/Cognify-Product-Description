"use client";

// Tiny KV-style abstraction around IndexedDB for buffering an in-flight
// recording when the network drops mid-rep. Phase 7.
//
// Why: the existing scoring pipeline POSTs to /api/score-internal with
// the recording's audio reference. If the user goes offline between
// `FINISH_RECORDING` and that POST, we'd lose the rep. Persisting a
// small marker + the blob in IDB lets us replay on reconnect.
//
// Storage budget: max 1 in-flight recording. iOS Safari is strict about
// IDB quota; we cap conservatively.
//
// API is abstract-store-agnostic so the Capacitor / RN ports can swap
// in AsyncStorage / SQLite without touching the reducer side.

export type BufferedRecording = {
  /** Stable id of the rep this recording was for. Used to dedupe replays. */
  recordingId: string;
  /** muscle_group_day id so we can correlate when the user opens a
   *  different device. */
  muscleGroupDayId: string;
  /** Station index 0..3. */
  stationIndex: number;
  /** Prompt text the user spoke against. */
  promptText: string;
  /** Raw audio blob. May be undefined when the platform supports only
   *  references (RN) — in that case `audioUrl` is set. */
  audioBlob?: Blob;
  /** When `audioBlob` isn't available, a platform-specific reference. */
  audioUrl?: string;
  /** ms wall-clock when the recording finished. */
  finishedAt: number;
};

export interface KVStore {
  set(key: string, value: BufferedRecording): Promise<void>;
  get(key: string): Promise<BufferedRecording | null>;
  delete(key: string): Promise<void>;
  list(): Promise<BufferedRecording[]>;
}

const DB_NAME = "cognify-workout";
const STORE = "workout-session-buffer";
const DB_VERSION = 1;

// ─── IDB-backed store ────────────────────────────────────────────────────

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "recordingId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

function txWrap<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const req = fn(store);
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

export const idbStore: KVStore = {
  async set(key, value) {
    const db = await openDb();
    if (!db) return;
    try {
      await txWrap(db, "readwrite", (s) =>
        s.put({ ...value, recordingId: key }),
      );
    } finally {
      db.close();
    }
  },
  async get(key) {
    const db = await openDb();
    if (!db) return null;
    try {
      const value = await txWrap<BufferedRecording | undefined>(db, "readonly", (s) =>
        s.get(key),
      );
      return value ?? null;
    } finally {
      db.close();
    }
  },
  async delete(key) {
    const db = await openDb();
    if (!db) return;
    try {
      await txWrap(db, "readwrite", (s) => s.delete(key));
    } finally {
      db.close();
    }
  },
  async list() {
    const db = await openDb();
    if (!db) return [];
    try {
      const all = await new Promise<BufferedRecording[]>((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).getAll();
        req.onsuccess = () => resolve(req.result as BufferedRecording[]);
        req.onerror = () => reject(req.error);
      });
      return all;
    } finally {
      db.close();
    }
  },
};

// ─── In-memory fallback (SSR / no-IDB environments) ──────────────────────

const memMap = new Map<string, BufferedRecording>();
export const memoryStore: KVStore = {
  async set(key, value) {
    memMap.set(key, { ...value, recordingId: key });
  },
  async get(key) {
    return memMap.get(key) ?? null;
  },
  async delete(key) {
    memMap.delete(key);
  },
  async list() {
    return [...memMap.values()];
  },
};

export function getBufferStore(): KVStore {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") {
    return memoryStore;
  }
  return idbStore;
}

// ─── Convenience: a single "active" buffer ───────────────────────────────

const ACTIVE_KEY = "active";

export async function setActiveBuffer(rec: BufferedRecording): Promise<void> {
  await getBufferStore().set(ACTIVE_KEY, rec);
}
export async function getActiveBuffer(): Promise<BufferedRecording | null> {
  return getBufferStore().get(ACTIVE_KEY);
}
export async function clearActiveBuffer(): Promise<void> {
  await getBufferStore().delete(ACTIVE_KEY);
}
