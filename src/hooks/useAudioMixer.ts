import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioEngine } from '../lib/audioEngine';
import {
  downloadAndStoreTrack,
  getPreferences,
  isTrackCached,
  savePreferences
} from '../lib/db';
import type { SoundTrack, TrackId } from '../types';

const DEFAULT_TRACKS: Omit<SoundTrack, 'isCached' | 'volume'>[] = [
  { id: 'rain', name: 'Pluie', sourceUrl: '/audio/rain.mp3', color: '#38bdf8' },
  { id: 'cafe', name: 'Café', sourceUrl: '/audio/cafe.mp3', color: '#f59e0b' },
  { id: 'white-noise', name: 'Bruit Blanc', sourceUrl: '/audio/white-noise.mp3', color: '#94a3b8' }
];

interface UseAudioMixerResult {
  tracks: SoundTrack[];
  masterVolume: number;
  isEngineReady: boolean;
  isOnline: boolean;
  setTrackVolume: (id: TrackId, volume: number) => void;
  setMasterVolume: (volume: number) => void;
  downloadForOffline: (id: TrackId) => Promise<void>;
  downloadingTrackId: TrackId | null;
  engineRef: React.MutableRefObject<AudioEngine | null>;
}

export function useAudioMixer(): UseAudioMixerResult {
  const engineRef = useRef<AudioEngine | null>(null);
  const [tracks, setTracks] = useState<SoundTrack[]>(
    DEFAULT_TRACKS.map((t) => ({ ...t, isCached: false, volume: 0 }))
  );
  const [masterVolume, setMasterVolumeState] = useState(1);
  const [isEngineReady, setIsEngineReady] = useState(false);
  const [downloadingTrackId, setDownloadingTrackId] = useState<TrackId | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  // Suivi de la connectivité réseau
  useEffect(() => {
    const onOnline = (): void => setIsOnline(true);
    const onOffline = (): void => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Initialisation de l'engine + chargement des préférences + statut cache
  useEffect(() => {
    let cancelled = false;

    async function init(): Promise<void> {
      const engine = new AudioEngine();
      engineRef.current = engine;

      const [prefs, cachedFlags] = await Promise.all([
        getPreferences(),
        Promise.all(DEFAULT_TRACKS.map((t) => isTrackCached(t.id)))
      ]);

      if (cancelled) return;

      setMasterVolumeState(prefs.masterVolume);
      engine.setMasterVolume(prefs.masterVolume);

      setTracks((prev) =>
        prev.map((t, idx) => ({
          ...t,
          isCached: cachedFlags[idx] ?? false,
          volume: prefs.trackVolumes[t.id] ?? 0
        }))
      );

      // Chargement audio (idb si présent, sinon réseau) - en parallèle
      await Promise.all(
        DEFAULT_TRACKS.map(async (t) => {
          try {
            await engine.loadTrack(t.id, t.sourceUrl);
            const vol = prefs.trackVolumes[t.id] ?? 0;
            if (vol > 0) engine.setTrackVolume(t.id, vol);
          } catch (err) {
            console.error(`Chargement échoué pour ${t.id}:`, err);
          }
        })
      );

      if (!cancelled) setIsEngineReady(true);
    }

    void init();

    return () => {
      cancelled = true;
      void engineRef.current?.dispose();
    };
  }, []);

  const persistPrefs = useCallback(
    (updatedTracks: SoundTrack[], master: number, adaptive: boolean) => {
      const trackVolumes = Object.fromEntries(updatedTracks.map((t) => [t.id, t.volume]));
      void savePreferences({
        id: 'main',
        trackVolumes,
        masterVolume: master,
        ambientAdaptationEnabled: adaptive,
        lastSessionAt: Date.now()
      });
    },
    []
  );

  const setTrackVolume = useCallback(
    (id: TrackId, volume: number) => {
      void engineRef.current?.resume();
      engineRef.current?.setTrackVolume(id, volume);

      setTracks((prev) => {
        const next = prev.map((t) => (t.id === id ? { ...t, volume } : t));
        persistPrefs(next, masterVolume, false);
        return next;
      });
    },
    [masterVolume, persistPrefs]
  );

  const setMasterVolume = useCallback(
    (volume: number) => {
      engineRef.current?.setMasterVolume(volume);
      setMasterVolumeState(volume);
      persistPrefs(tracks, volume, false);
    },
    [tracks, persistPrefs]
  );

  const downloadForOffline = useCallback(async (id: TrackId) => {
    const track = DEFAULT_TRACKS.find((t) => t.id === id);
    if (!track) return;

    setDownloadingTrackId(id);
    try {
      await downloadAndStoreTrack(id, track.sourceUrl);
      setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, isCached: true } : t)));
    } finally {
      setDownloadingTrackId(null);
    }
  }, []);

  return {
    tracks,
    masterVolume,
    isEngineReady,
    isOnline,
    setTrackVolume,
    setMasterVolume,
    downloadForOffline,
    downloadingTrackId,
    engineRef
  };
}
