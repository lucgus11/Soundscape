import type { SoundTrack } from '../types';

interface TrackSliderProps {
  track: SoundTrack;
  onVolumeChange: (volume: number) => void;
  onDownload: () => void;
  isDownloading: boolean;
  isOnline: boolean;
}

export function TrackSlider({
  track,
  onVolumeChange,
  onDownload,
  isDownloading,
  isOnline
}: TrackSliderProps): JSX.Element {
  const canPlay = track.isCached || isOnline;

  return (
    <div className="track-slider" style={{ borderColor: track.color }}>
      <div className="track-header">
        <span className="track-name">{track.name}</span>
        {!track.isCached && (
          <button
            className="download-btn"
            onClick={onDownload}
            disabled={isDownloading || !isOnline}
            title={isOnline ? 'Télécharger pour usage hors-ligne' : 'Connexion requise pour télécharger'}
          >
            {isDownloading ? '…' : '⬇'}
          </button>
        )}
        {track.isCached && <span className="cached-badge" title="Disponible hors-ligne">✓ offline</span>}
      </div>

      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={track.volume}
        disabled={!canPlay}
        onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
        style={{ accentColor: track.color }}
        aria-label={`Volume ${track.name}`}
      />

      {!canPlay && <p className="track-warning">Hors-ligne et non téléchargée</p>}
    </div>
  );
}
