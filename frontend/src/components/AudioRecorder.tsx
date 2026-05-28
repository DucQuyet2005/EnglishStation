/**
 * Audio Recorder Component
 * The main recording interface with:
 * - Record/Stop button with animated visualizer
 * - Duration timer
 * - Audio playback after recording
 * - Upload button
 */
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import './AudioRecorder.css';

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
  isUploading: boolean;
  uploadProgress: number;
}

export function AudioRecorder({
  onRecordingComplete,
  isUploading,
  uploadProgress,
}: AudioRecorderProps) {
  const {
    state,
    duration,
    isSupported,
    audioBlob,
    audioUrl,
    startRecording,
    stopRecording,
    resetRecording,
    error,
  } = useAudioRecorder();

  /** Format seconds to MM:SS */
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  /** Handle sending the recorded audio */
  const handleSubmit = () => {
    if (audioBlob) {
      onRecordingComplete(audioBlob);
    }
  };

  if (!isSupported) {
    return (
      <div className="recorder recorder--error" id="audio-recorder">
        <div className="recorder__error-icon">⚠️</div>
        <p className="recorder__error-text">
          Audio recording is not supported in this browser.
          <br />
          Please use Chrome, Firefox, or Edge.
        </p>
      </div>
    );
  }

  return (
    <div className="recorder" id="audio-recorder">
      {/* Recording Visualizer */}
      <div className={`recorder__visualizer ${state === 'recording' ? 'recorder__visualizer--active' : ''}`}>
        <div className="recorder__rings">
          <div className="recorder__ring recorder__ring--1"></div>
          <div className="recorder__ring recorder__ring--2"></div>
          <div className="recorder__ring recorder__ring--3"></div>
        </div>

        {/* Main Record Button */}
        <button
          className={`recorder__btn ${state === 'recording' ? 'recorder__btn--recording' : ''}`}
          onClick={state === 'recording' ? stopRecording : startRecording}
          disabled={isUploading}
          id="record-button"
          aria-label={state === 'recording' ? 'Stop recording' : 'Start recording'}
        >
          {state === 'recording' ? (
            <div className="recorder__btn-stop">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            </div>
          ) : (
            <div className="recorder__btn-mic">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="22" />
              </svg>
            </div>
          )}
        </button>
      </div>

      {/* Timer */}
      <div className="recorder__timer" id="recording-timer">
        <span className={`recorder__timer-text ${state === 'recording' ? 'recorder__timer-text--active' : ''}`}>
          {formatTime(duration)}
        </span>
        {state === 'recording' && (
          <span className="recorder__timer-label">Recording...</span>
        )}
        {state === 'idle' && !audioBlob && (
          <span className="recorder__timer-label">Tap to start recording</span>
        )}
      </div>

      {/* Audio Playback & Actions (shown after recording) */}
      {audioBlob && audioUrl && state === 'idle' && (
        <div className="recorder__preview" id="audio-preview">
          <audio
            className="recorder__audio"
            src={audioUrl}
            controls
            id="audio-player"
          />

          <div className="recorder__actions">
            <button
              className="recorder__action-btn recorder__action-btn--secondary"
              onClick={resetRecording}
              disabled={isUploading}
              id="re-record-button"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
              Re-record
            </button>

            <button
              className="recorder__action-btn recorder__action-btn--primary"
              onClick={handleSubmit}
              disabled={isUploading}
              id="transcribe-button"
            >
              {isUploading ? (
                <>
                  <div className="recorder__spinner"></div>
                  {uploadProgress > 0 ? `Uploading ${uploadProgress}%` : 'Processing...'}
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                  Transcribe
                </>
              )}
            </button>
          </div>

          {/* Upload Progress Bar */}
          {isUploading && uploadProgress > 0 && (
            <div className="recorder__progress" id="upload-progress">
              <div
                className="recorder__progress-bar"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="recorder__error" id="recorder-error">
          <span className="recorder__error-icon">⚠️</span>
          <span className="recorder__error-msg">{error}</span>
        </div>
      )}
    </div>
  );
}
