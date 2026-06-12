interface AmbientToggleProps {
  isEnabled: boolean;
  ambientLevel: number;
  error: string | null;
  onToggle: () => void;
}

export function AmbientToggle({
  isEnabled,
  ambientLevel,
  error,
  onToggle
}: AmbientToggleProps): JSX.Element {
  return (
    <div className="ambient-toggle">
      <button onClick={onToggle} className={isEnabled ? 'active' : ''}>
        {isEnabled ? '🎤 Adaptation active' : '🎤 Activer adaptation au bruit'}
      </button>

      {isEnabled && (
        <div className="ambient-meter" aria-label="Niveau de bruit ambiant">
          <div className="ambient-meter-fill" style={{ width: `${Math.min(ambientLevel * 100 * 3, 100)}%` }} />
        </div>
      )}

      {error && <p className="ambient-error">{error}</p>}
    </div>
  );
}
