"use client";

// Phase 12 — recording-blob store shim. Re-uses the IndexedDB KVStore
// from Phase 7's network-buffer.ts on web; Capacitor swap-in for
// @capacitor/filesystem is sketched below.
//
// Why a separate file from network-buffer.ts: the latter is keyed to
// the "single active in-flight recording" use case (NETWORK_DROP).
// This module is the generic interface — caller picks the key. RN /
// Capacitor ports will likely swap implementations independently.

import { getBufferStore, type KVStore } from "@/lib/workout/network-buffer";

export type StoredRecording = {
  id: string;
  audioBlob?: Blob;
  audioUrl?: string;
  promptText: string;
  durationMs: number;
  createdAt: number;
};

/** Returns the underlying KVStore. On web this is IDB; on Capacitor
 *  (when shipped) this should switch to @capacitor/filesystem. */
export function getRecordingStore(): KVStore {
  return getBufferStore();
}

// TODO: native path sketch
//
//   import { Filesystem, Directory } from '@capacitor/filesystem';
//   const capacitorStore: KVStore = {
//     async set(key, value) {
//       await Filesystem.writeFile({
//         path: `recordings/${key}.json`,
//         directory: Directory.Data,
//         data: JSON.stringify({ ...value, audioBlob: undefined }),
//       });
//       // audioBlob goes to a separate file:
//       if (value.audioBlob) {
//         const arr = await value.audioBlob.arrayBuffer();
//         await Filesystem.writeFile({
//           path: `recordings/${key}.webm`,
//           directory: Directory.Data,
//           data: new Uint8Array(arr),
//         });
//       }
//     },
//     // ... get/delete/list mirror the IDB versions
//   };
