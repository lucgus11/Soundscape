import { getStoredTrack } from './db';
import type { TrackId } from '../types';

interface TrackNode {
  buffer: AudioBuffer;
  source: AudioBufferSourceNode | null;
  gainNode: GainNode;
}

/**
 * Moteur audio central : gère le AudioContext, le mixage multi-pistes
 * et la résolution intelligente online/offline des sources audio.
 *
 * Stratégie de résolution d'une piste :
 *  1. Si un Blob existe en IndexedDB -> on l'utilise (fonctionne 100% offline).
 *  2. Sinon, on tente de fetch la sourceUrl réseau.
 *  3. Si le fetch échoue (offline + pas de cache) -> erreur explicite.
 */
export class AudioEngine {
  private ctx: AudioContext;
  private masterGain: GainNode;
  /** Gain additionnel piloté par l'adaptation au bruit ambiant (0..1) */
  private adaptiveGain: GainNode;
  private tracks: Map<TrackId, TrackNode> = new Map();

  constructor() {
    this.ctx = new AudioContext();
    this.adaptiveGain = this.ctx.createGain();
    this.masterGain = this.ctx.createGain();

    this.adaptiveGain.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    this.adaptiveGain.gain.value = 1;
    this.masterGain.gain.value = 1;
  }

  get audioContext(): AudioContext {
    return this.ctx;
  }

  /** Doit être appelé suite à une interaction utilisateur (politique autoplay des navigateurs) */
  async resume(): Promise<void> {
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  setMasterVolume(value: number): void {
    const v = Math.min(Math.max(value, 0), 1);
    this.masterGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  /**
   * Applique un facteur d'atténuation/amplification adaptatif (0..1),
   * piloté par l'AnalyserNode du micro (effet "waouh").
   */
  setAdaptiveGain(value: number): void {
    const v = Math.min(Math.max(value, 0), 1);
    this.adaptiveGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.3);
  }

  /**
   * Résout la source audio (IndexedDB en priorité, sinon réseau)
   * et décode l'AudioBuffer correspondant.
   */
  private async resolveAudioBuffer(id: TrackId, sourceUrl: string): Promise<AudioBuffer> {
    const stored = await getStoredTrack(id);
    let arrayBuffer: ArrayBuffer;

    if (stored) {
      arrayBuffer = await stored.blob.arrayBuffer();
    } else {
      try {
        const res = await fetch(sourceUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        arrayBuffer = await res.arrayBuffer();
      } catch (err) {
        throw new Error(
          `Impossible de charger la piste "${id}" : ni cache local ni réseau disponible. (${String(err)})`
        );
      }
    }

    // decodeAudioData détache l'ArrayBuffer, on en fait une copie défensive si nécessaire
    return this.ctx.decodeAudioData(arrayBuffer);
  }

  /**
   * Charge une piste (sans la jouer). À appeler une fois par piste.
   */
  async loadTrack(id: TrackId, sourceUrl: string): Promise<void> {
    if (this.tracks.has(id)) return;
    const buffer = await this.resolveAudioBuffer(id, sourceUrl);
    const gainNode = this.ctx.createGain();
    gainNode.gain.value = 0;
    gainNode.connect(this.adaptiveGain);

    this.tracks.set(id, { buffer, source: null, gainNode });
  }

  /**
   * Démarre la lecture en boucle d'une piste préalablement chargée.
   */
  play(id: TrackId): void {
    const track = this.tracks.get(id);
    if (!track) throw new Error(`Piste "${id}" non chargée`);
    if (track.source) return; // déjà en cours

    const source = this.ctx.createBufferSource();
    source.buffer = track.buffer;
    source.loop = true;
    source.connect(track.gainNode);
    source.start();

    track.source = source;
  }

  stop(id: TrackId): void {
    const track = this.tracks.get(id);
    if (!track?.source) return;
    track.source.stop();
    track.source.disconnect();
    track.source = null;
  }

  /**
   * Règle le volume d'une piste individuelle (0..1) avec transition douce.
   */
  setTrackVolume(id: TrackId, volume: number): void {
    const track = this.tracks.get(id);
    if (!track) return;
    const v = Math.min(Math.max(volume, 0), 1);
    track.gainNode.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);

    // Joue/arrête automatiquement selon le volume
    if (v > 0 && !track.source) this.play(id);
    if (v === 0 && track.source) this.stop(id);
  }

  unloadTrack(id: TrackId): void {
    this.stop(id);
    const track = this.tracks.get(id);
    track?.gainNode.disconnect();
    this.tracks.delete(id);
  }

  async dispose(): Promise<void> {
    for (const id of this.tracks.keys()) this.unloadTrack(id);
    await this.ctx.close();
  }
}
