import { openDB, type IDBPDatabase, type DBSchema } from 'idb';
import type { StoredAudioBlob, UserPreferences, TrackId } from '../types';

const DB_NAME = 'soundscape-focus-db';
const DB_VERSION = 1;

interface SoundscapeDB extends DBSchema {
  audioBlobs: {
    key: TrackId;
    value: StoredAudioBlob;
  };
  preferences: {
    key: string;
    value: UserPreferences;
  };
}

let dbPromise: Promise<IDBPDatabase<SoundscapeDB>> | null = null;

function getDB(): Promise<IDBPDatabase<SoundscapeDB>> {
  if (!dbPromise) {
    dbPromise = openDB<SoundscapeDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('audioBlobs')) {
          db.createObjectStore('audioBlobs', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('preferences')) {
          db.createObjectStore('preferences', { keyPath: 'id' });
        }
      }
    });
  }
  return dbPromise;
}

/**
 * Télécharge une piste audio depuis le réseau et la stocke en IndexedDB sous forme de Blob.
 * Doit être appelé explicitement (action utilisateur "Télécharger pour l'offline").
 */
export async function downloadAndStoreTrack(id: TrackId, url: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Échec du téléchargement de la piste "${id}" (HTTP ${response.status})`);
  }
  const blob = await response.blob();
  const db = await getDB();
  const record: StoredAudioBlob = {
    id,
    blob,
    mimeType: blob.type || 'audio/mpeg',
    storedAt: Date.now()
  };
  await db.put('audioBlobs', record);
}

/**
 * Récupère le Blob audio stocké localement, ou null s'il n'existe pas encore.
 */
export async function getStoredTrack(id: TrackId): Promise<StoredAudioBlob | undefined> {
  const db = await getDB();
  return db.get('audioBlobs', id);
}

export async function isTrackCached(id: TrackId): Promise<boolean> {
  const db = await getDB();
  const count = await db.count('audioBlobs', id);
  return count > 0;
}

export async function deleteStoredTrack(id: TrackId): Promise<void> {
  const db = await getDB();
  await db.delete('audioBlobs', id);
}

export async function listCachedTrackIds(): Promise<TrackId[]> {
  const db = await getDB();
  return db.getAllKeys('audioBlobs');
}

/* ---------------- Préférences utilisateur ---------------- */

const DEFAULT_PREFS: UserPreferences = {
  id: 'main',
  trackVolumes: {},
  masterVolume: 1,
  ambientAdaptationEnabled: false,
  lastSessionAt: Date.now()
};

export async function getPreferences(): Promise<UserPreferences> {
  const db = await getDB();
  const prefs = await db.get('preferences', 'main');
  return prefs ?? DEFAULT_PREFS;
}

export async function savePreferences(prefs: UserPreferences): Promise<void> {
  const db = await getDB();
  await db.put('preferences', { ...prefs, lastSessionAt: Date.now() });
}
