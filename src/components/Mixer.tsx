import { useAudioMixer } from '../hooks/useAudioMixer';
import { useAmbientAdaptation } from '../hooks/useAmbientAdaptation';
import { TrackSlider } from './TrackSlider';
import { AmbientToggle } from './AmbientToggle';

export function Mixer(): JSX.Element {
  const {
    tracks,
    masterVolume,
    isEngineReady,
    isOnline,
    setTrackVolume,
    setMasterVolume,
    downloadForOffline,
    downloadingTrackId,
    engineRef
  } = useAudioMixer();

  const ambient = useAmbientAdaptation(engineRef);

  if (!isEngineReady) {
    return <div className="mixer-loading">Chargement du moteur audio…</div>;
  }

  return (
    <div className="mixer">
      <header className="mixer-header">
        <h1>SoundScape Focus</h1>
        {!isOnline && <span className="offline-badge">Hors-ligne</span>}
      </header>

      <div className="tracks-list">
        {tracks.map((track) => (
          <TrackSlider
            key={track.id}
            track={track}
            isOnline={isOnline}
            isDownloading={downloadingTrackId === track.id}
            onVolumeChange={(v) => setTrackVolume(track.id, v)}
            onDownload={() => void downloadForOffline(track.id)}
          />
        ))}
      </div>

      <div className="master-volume">
        <label htmlFor="master">Volume principal</label>
        <input
          id="master"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={masterVolume}
          onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
        />
      </div>

      <AmbientToggle
        isEnabled={ambient.isEnabled}
        ambientLevel={ambient.ambientLevel}
        error={ambient.error}
        onToggle={() => void ambient.toggle()}
      />
    </div>
  );
}
