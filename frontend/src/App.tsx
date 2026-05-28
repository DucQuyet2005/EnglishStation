/**
 * App Component
 * Main application component that orchestrates:
 * - Audio recording (mic tab)
 * - YouTube transcription (youtube tab)
 * - Transcription upload
 * - Result display
 *
 * State flow:
 * IDLE → RECORDING → IDLE (with audio) → UPLOADING → RESULT
 * IDLE → YOUTUBE URL → PROCESSING → RESULT
 */
import { useState } from 'react';
import { Header } from './components/Header';
import { AudioRecorder } from './components/AudioRecorder';
import { YouTubeTranscriber } from './components/YouTubeTranscriber';
import { TranscriptDisplay } from './components/TranscriptDisplay';
import { LoadingOverlay } from './components/LoadingOverlay';
import { ErrorAlert } from './components/ErrorAlert';
import { LanguageSelector } from './components/LanguageSelector';
import { useTranscription } from './hooks/useTranscription';
import { useYouTubeTranscription } from './hooks/useYouTubeTranscription';
import './App.css';

type InputMode = 'mic' | 'youtube';

function App() {
  const [activeMode, setActiveMode] = useState<InputMode>('mic');
  const [targetLang, setTargetLang] = useState<string>('none');

  const micTranscription = useTranscription();
  const ytTranscription = useYouTubeTranscription();

  // Use the active mode's state
  const current = activeMode === 'mic' ? micTranscription : ytTranscription;
  const { result, isLoading, error } = current;

  /** Called when user clicks "Transcribe" after recording */
  const handleRecordingComplete = async (blob: Blob) => {
    await micTranscription.transcribe(blob, targetLang);
  };

  /** Called when user submits a YouTube URL */
  const handleYouTubeTranscribe = async (url: string) => {
    await ytTranscription.transcribe(url, targetLang);
  };

  /** Reset to initial state for a new recording */
  const handleNewRecording = () => {
    micTranscription.clearResult();
    ytTranscription.clearResult();
  };

  /** Switch tabs and clear state */
  const switchMode = (mode: InputMode) => {
    if (mode !== activeMode) {
      micTranscription.clearResult();
      ytTranscription.clearResult();
      setActiveMode(mode);
    }
  };

  return (
    <div className="app" id="app-root">
      <Header />

      <main className="app__main">
        <div className="app__container">
          {/* Intro Section */}
          {!result && !isLoading && (
            <div className="app__intro">
              <h2 className="app__intro-title">Practice Speaking English</h2>
              <p className="app__intro-desc">
                Record your voice or paste a YouTube link — AI will transcribe
                the speech instantly.
              </p>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <ErrorAlert
              message={error}
              onDismiss={current.clearResult}
            />
          )}

          {/* Tab Switcher (hidden when showing results or loading) */}
          {!result && !isLoading && (
            <div className="app__tabs" id="input-mode-tabs">
              <button
                className={`app__tab ${activeMode === 'mic' ? 'app__tab--active' : ''}`}
                onClick={() => switchMode('mic')}
                id="tab-mic"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
                Microphone
              </button>
              <button
                className={`app__tab ${activeMode === 'youtube' ? 'app__tab--active' : ''}`}
                onClick={() => switchMode('youtube')}
                id="tab-youtube"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <rect x="2" y="4" width="20" height="16" rx="4" stroke="currentColor" strokeWidth="1.5" />
                  <polygon points="10,8 16,12 10,16" fill="currentColor" />
                </svg>
                YouTube
              </button>
            </div>
          )}

          {/* Language Selector */}
          {!result && !isLoading && (
             <LanguageSelector 
               value={targetLang} 
               onChange={setTargetLang} 
             />
          )}

          {/* Mic Recording Mode */}
          {activeMode === 'mic' && !result && !isLoading && (
            <AudioRecorder
              onRecordingComplete={handleRecordingComplete}
              isUploading={micTranscription.isLoading}
              uploadProgress={micTranscription.uploadProgress}
            />
          )}

          {/* YouTube Mode */}
          {activeMode === 'youtube' && !result && !isLoading && (
            <YouTubeTranscriber
              onTranscribe={handleYouTubeTranscribe}
              isLoading={ytTranscription.isLoading}
            />
          )}

          {/* Loading State */}
          {isLoading && activeMode === 'mic' && (
            <LoadingOverlay progress={micTranscription.uploadProgress} />
          )}

          {/* YouTube Loading State (no progress bar — it's a server-side download) */}
          {isLoading && activeMode === 'youtube' && (
            <LoadingOverlay progress={0} />
          )}

          {/* Transcription Result */}
          {result && !isLoading && (
            <TranscriptDisplay
              result={result}
              onNewRecording={handleNewRecording}
            />
          )}

          {/* Tips Section */}
          {!result && !isLoading && (
            <div className="app__tips">
              <div className="app__tip">
                <span className="app__tip-icon">💡</span>
                <div>
                  <h3 className="app__tip-title">Tips for best results</h3>
                  <p className="app__tip-text">
                    {activeMode === 'mic'
                      ? 'Speak clearly in a quiet environment. Keep recordings under 2 minutes for faster processing.'
                      : 'Paste any YouTube video link (max 10 minutes). Works best with videos that have clear speech.'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="app__footer">
        <p className="app__footer-text">
          Powered by <strong>faster-whisper</strong> • Open Source AI
        </p>
      </footer>
    </div>
  );
}

export default App;
