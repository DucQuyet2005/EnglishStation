/**
 * Loading Overlay Component
 * Displayed while audio is being processed by the Whisper service.
 * Features animated waveform and descriptive status text.
 */
import './LoadingOverlay.css';

interface LoadingOverlayProps {
  progress: number;
}

export function LoadingOverlay({ progress }: LoadingOverlayProps) {
  const statusText = progress > 0 && progress < 100
    ? `Uploading audio... ${progress}%`
    : 'AI is transcribing your speech...';

  return (
    <div className="loading" id="loading-overlay">
      <div className="loading__card">
        {/* Animated Waveform */}
        <div className="loading__wave">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="loading__wave-bar"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>

        {/* Status Text */}
        <p className="loading__text">{statusText}</p>
        <p className="loading__subtext">This may take a few seconds...</p>

        {/* Progress Bar (only during upload) */}
        {progress > 0 && progress < 100 && (
          <div className="loading__progress">
            <div
              className="loading__progress-bar"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
