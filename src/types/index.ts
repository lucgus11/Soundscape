export type TrackId = 'rain' | 'cafe' | 'white-noise' | string;

export interface SoundTrack {
  id: TrackId;
  name: string;
  /** URL réseau source (utilisée pour le téléchargement initial) */
  sourceUrl: string;
  /** Indique si le blob est déjà stocké en IndexedDB */
  isCached: boolean;
  /** Volume courant 0..1 */
  volume: number;
  /** Couleur d'icône pour l'UI */
  color: string;
}

export interface StoredAudioBlob {
  id: TrackId;
  blob: Blob;
  mimeType: string;
  storedAt: number;
}

export interface UserPreferences {
  id: 'main';
  trackVolumes: Record<TrackId, number>;
  masterVolume: number;
  ambientAdaptationEnabled: boolean;
  lastSessionAt: number;
}

export interface AmbientAdaptationConfig {
  enabled: boolean;
  /** Seuil RMS (0..1) au-delà duquel on considère l'environnement "bruyant" */
  noiseThreshold: number;
  /** Vitesse de réaction en ms */
  reactionMs: number;
}
