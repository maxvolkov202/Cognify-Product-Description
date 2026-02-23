/**
 * Audio Storage Utility
 * Handles persistent storage of audio blobs using IndexedDB
 * and converts to data URLs for reliable playback across sessions
 */

const DB_NAME = 'CognifyAudioDB';
const DB_VERSION = 1;
const STORE_NAME = 'audioBlobs';

interface StoredAudio {
  repId: string;
  blob: Blob;
  mimeType: string;
  durationSeconds: number;
  sizeBytes: number;
  dataUrl: string;
  createdAt: Date;
}

/**
 * Initialize IndexedDB
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'repId' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        console.log('✓ Created IndexedDB store for audio');
      }
    };
  });
}

/**
 * Convert Blob to Data URL for persistent storage
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Convert Data URL back to Blob
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'audio/webm';
  const binaryString = atob(parts[1]);
  const bytes = new Uint8Array(binaryString.length);
  
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  return new Blob([bytes], { type: mimeType });
}

/**
 * Store audio blob and return a data URL for persistence
 */
export async function storeAudio(
  repId: string,
  blob: Blob,
  mimeType: string,
  durationSeconds: number
): Promise<{ audioUrl: string; audioDuration: number; audioMimeType: string; audioSizeBytes: number }> {
  try {
    console.log('💾 Storing audio for rep:', repId, {
      size: `${(blob.size / 1024).toFixed(1)}KB`,
      mimeType,
      duration: `${durationSeconds.toFixed(1)}s`
    });

    // Convert blob to data URL (this can be stored in localStorage/state and survives refresh)
    const dataUrl = await blobToDataUrl(blob);

    // Store in IndexedDB for backup
    try {
      const db = await openDatabase();
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const storedAudio: StoredAudio = {
        repId,
        blob,
        mimeType,
        durationSeconds,
        sizeBytes: blob.size,
        dataUrl,
        createdAt: new Date()
      };

      await new Promise<void>((resolve, reject) => {
        const request = store.put(storedAudio);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      db.close();
      console.log('✓ Audio stored in IndexedDB');
    } catch (dbError) {
      console.warn('⚠️ IndexedDB storage failed (non-critical):', dbError);
      // Continue anyway - we have the data URL
    }

    return {
      audioUrl: dataUrl,
      audioDuration: durationSeconds,
      audioMimeType: mimeType,
      audioSizeBytes: blob.size
    };
  } catch (error) {
    console.error('❌ Failed to store audio:', error);
    throw new Error('Could not store audio. Please try again.');
  }
}

/**
 * Retrieve audio from IndexedDB by rep ID
 */
export async function getAudio(repId: string): Promise<StoredAudio | null> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.get(repId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    }).finally(() => db.close());
  } catch (error) {
    console.error('❌ Failed to retrieve audio:', error);
    return null;
  }
}

/**
 * Delete audio from IndexedDB
 */
export async function deleteAudio(repId: string): Promise<void> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    await new Promise<void>((resolve, reject) => {
      const request = store.delete(repId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    db.close();
    console.log('✓ Audio deleted from IndexedDB:', repId);
  } catch (error) {
    console.error('❌ Failed to delete audio:', error);
  }
}

/**
 * Clean up old audio entries (older than 7 days)
 */
export async function cleanupOldAudio(): Promise<void> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('createdAt');

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const request = index.openCursor(IDBKeyRange.upperBound(sevenDaysAgo));

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        console.log('🗑️ Deleting old audio:', cursor.value.repId);
        cursor.delete();
        cursor.continue();
      }
    };

    db.close();
  } catch (error) {
    console.error('❌ Failed to cleanup old audio:', error);
  }
}

/**
 * Validate that an audio URL is usable
 */
export function validateAudioUrl(url: string | undefined): {
  valid: boolean;
  reason?: string;
} {
  if (!url) {
    return { valid: false, reason: 'No audio URL provided' };
  }

  // Data URLs are reliable
  if (url.startsWith('data:audio/')) {
    return { valid: true };
  }

  // Blob URLs work within the same session
  if (url.startsWith('blob:')) {
    return { valid: true, reason: 'Blob URL (session-only)' };
  }

  // HTTP/HTTPS URLs
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return { valid: true };
  }

  return { valid: false, reason: 'Invalid audio URL format' };
}

/**
 * Get storage statistics
 */
export async function getStorageStats(): Promise<{
  count: number;
  totalSizeBytes: number;
  oldestDate?: Date;
  newestDate?: Date;
}> {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const items: StoredAudio[] = request.result;
        const totalSizeBytes = items.reduce((sum, item) => sum + item.sizeBytes, 0);
        const dates = items.map(item => new Date(item.createdAt)).sort((a, b) => a.getTime() - b.getTime());

        resolve({
          count: items.length,
          totalSizeBytes,
          oldestDate: dates[0],
          newestDate: dates[dates.length - 1]
        });
      };
      request.onerror = () => reject(request.error);
    }).finally(() => db.close());
  } catch (error) {
    console.error('❌ Failed to get storage stats:', error);
    return { count: 0, totalSizeBytes: 0 };
  }
}

// ─── Session Storage Helpers ───────────────────────────────────────────────
// Used to persist a single "current recording" across page refreshes within
// the rep flow. The blob is serialized as a data-URL (base64) so it fits
// into sessionStorage's string-only API.

const SESSION_KEY = 'cognify_current_recording';

export interface SessionRecording {
  dataUrl: string;
  mimeType: string;
  durationSeconds: number;
  savedAt: number;
}

/**
 * Convenience alias — converts a Blob to a base64 data-URL string.
 * Internally delegates to blobToDataUrl.
 */
export const blobToBase64 = blobToDataUrl;

/**
 * Convenience alias — converts a base64 data-URL string back to a Blob.
 * Internally delegates to dataUrlToBlob.
 */
export const base64ToBlob = dataUrlToBlob;

/**
 * Persist a recording blob into sessionStorage so it survives
 * soft-navigations and page refreshes within the same tab.
 */
export async function saveRecordingToSession(
  blob: Blob,
  mimeType: string,
  durationSeconds: number
): Promise<void> {
  try {
    const dataUrl = await blobToDataUrl(blob);
    const payload: SessionRecording = {
      dataUrl,
      mimeType,
      durationSeconds,
      savedAt: Date.now(),
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    console.log('✓ Recording saved to sessionStorage', {
      size: `${(blob.size / 1024).toFixed(1)}KB`,
    });
  } catch (err) {
    // sessionStorage can throw if full or blocked (private-browsing)
    console.warn('⚠️ saveRecordingToSession failed:', err);
  }
}

/**
 * Restore a previously-saved recording from sessionStorage.
 * Returns the reconstituted Blob + a fresh object URL, or null.
 */
export function loadRecordingFromSession(): {
  blob: Blob;
  audioUrl: string;
  mimeType: string;
  durationSeconds: number;
} | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    const payload: SessionRecording = JSON.parse(raw);
    const blob = dataUrlToBlob(payload.dataUrl);
    const audioUrl = URL.createObjectURL(blob);

    console.log('✓ Recording restored from sessionStorage', {
      size: `${(blob.size / 1024).toFixed(1)}KB`,
      age: `${((Date.now() - payload.savedAt) / 1000).toFixed(0)}s ago`,
    });

    return {
      blob,
      audioUrl,
      mimeType: payload.mimeType,
      durationSeconds: payload.durationSeconds,
    };
  } catch (err) {
    console.warn('⚠️ loadRecordingFromSession failed:', err);
    return null;
  }
}

/**
 * Remove the current recording from sessionStorage.
 */
export function clearRecordingFromSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}