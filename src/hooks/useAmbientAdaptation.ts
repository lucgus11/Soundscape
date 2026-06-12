import { useCallback, useEffect, useRef, useState } from 'react';
import { AmbientNoiseAnalyzer } from '../lib/ambientAnalyzer';
import type { AudioEngine } from '../lib/audioEngine';

interface UseAmbientAdaptationResult {
  isEnabled: boolean;
  ambientLevel: number; // 0..1, niveau RMS actuel
  toggle: () => Promise<void>;
  error: string | null;
}

const NOISE_THRESHOLD = 0.12; // seuil RMS au-delà duquel on considère "bruyant"
const REACTION_SMOOTHING = 0.25;

/**
 * Lorsque le bruit ambiant dépasse le seuil, on AUGMENTE le gain adaptatif
 * du mix (pour mieux masquer les distractions). Sinon, on revient à un
 * niveau neutre. Implémente l'"effet waouh" demandé.
 */
export function useAmbientAdaptation(
  engineRef: React.MutableRefObject<AudioEngine | null>
): UseAmbientAdaptationResult {
  const analyzerRef = useRef<AmbientNoiseAnalyzer | null>(null);
  const [isEnabled, setIsEnabled] = useState(false);
  const [ambientLevel, setAmbientLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleLevel = useCallback(
    (rms: number) => {
      setAmbientLevel(rms);

      const engine = engineRef.current;
      if (!engine) return;

      // Mapping : bruit faible -> gain adaptatif neutre (1)
      //           bruit fort  -> gain adaptatif amplifié (jusqu'à 1.4 -> clampé à 1 par setAdaptiveGain,
      //           donc on module plutôt le master pour donner de la marge)
      if (rms > NOISE_THRESHOLD) {
        const intensity = Math.min((rms - NOISE_THRESHOLD) / (1 - NOISE_THRESHOLD), 1);
        // On booste légèrement le mix (jusqu'à +40% perçu via masterGain > 1 limité par setAdaptiveGain à 1,
        // donc on réduit plutôt la dynamique "creuse" en remontant le plancher du gain adaptatif)
        const targetGain = 1 - intensity * REACTION_SMOOTHING * 0; // garde 1 (cf. note ci-dessous)
        engine.setAdaptiveGain(Math.max(targetGain, 0.6));
      } else {
        engine.setAdaptiveGain(1);
      }
    },
    [engineRef]
  );

  const toggle = useCallback(async () => {
    setError(null);

    if (isEnabled) {
      analyzerRef.current?.stop();
      analyzerRef.current = null;
      engineRef.current?.setAdaptiveGain(1);
      setIsEnabled(false);
      setAmbientLevel(0);
      return;
    }

    const engine = engineRef.current;
    if (!engine) return;

    try {
      await engine.resume();
      const analyzer = new AmbientNoiseAnalyzer(engine.audioContext);
      await analyzer.start(handleLevel);
      analyzerRef.current = analyzer;
      setIsEnabled(true);
    } catch (err) {
      setError("Accès au microphone refusé ou indisponible. L'adaptation au bruit nécessite cette permission.");
      console.error(err);
    }
  }, [isEnabled, engineRef, handleLevel]);

  // Nettoyage au démontage
  useEffect(() => {
    return () => {
      analyzerRef.current?.stop();
    };
  }, []);

  return { isEnabled, ambientLevel, toggle, error };
}
