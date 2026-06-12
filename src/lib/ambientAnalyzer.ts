/**
 * Analyse le niveau sonore ambiant via le microphone et expose
 * un niveau RMS normalisé (0..1) en continu.
 *
 * Utilise un AnalyserNode séparé connecté UNIQUEMENT au flux micro
 * (jamais à ctx.destination, pour éviter tout retour de boucle/larsen).
 */
export class AmbientNoiseAnalyzer {
  private audioContext: AudioContext;
  private analyser: AnalyserNode | null = null;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private dataArray: Uint8Array | null = null;
  private rafId: number | null = null;

  constructor(sharedAudioContext: AudioContext) {
    this.audioContext = sharedAudioContext;
  }

  get isActive(): boolean {
    return this.micStream !== null;
  }

  /**
   * Démarre l'écoute du micro. Nécessite une interaction utilisateur préalable
   * (permission navigateur).
   */
  async start(onLevel: (rmsLevel: number) => void): Promise<void> {
    if (this.isActive) return;

    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });

    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.8;

    this.micSource = this.audioContext.createMediaStreamSource(this.micStream);
    this.micSource.connect(this.analyser);
    // Volontairement NON connecté à destination : on n'écoute pas le micro à l'utilisateur

    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    const tick = (): void => {
      if (!this.analyser || !this.dataArray) return;
     this.analyser.getByteTimeDomainData(this.dataArray as Uint8Array<ArrayBuffer>);

      // Calcul du RMS (root mean square) normalisé entre 0 et 1
      let sumSquares = 0;
      for (let i = 0; i < this.dataArray.length; i++) {
        const sample = this.dataArray[i];
        if (sample === undefined) continue;
        const normalized = (sample - 128) / 128; // -1..1
        sumSquares += normalized * normalized;
      }
      const rms = Math.sqrt(sumSquares / this.dataArray.length); // ~0..1

      onLevel(Math.min(rms, 1));
      this.rafId = requestAnimationFrame(tick);
    };

    this.rafId = requestAnimationFrame(tick);
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.micSource?.disconnect();
    this.micSource = null;
    this.analyser = null;
    this.dataArray = null;

    this.micStream?.getTracks().forEach((track) => track.stop());
    this.micStream = null;
  }
}
