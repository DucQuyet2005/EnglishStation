/**
 * YouTube Transcriber Component
 * Allows users to input a YouTube URL and get its audio transcribed.
 * Features:
 * - URL input with validation
 * - Loading state with animated indicator
 * - Error display
 * - Calls the YouTube transcription API
 */
import { useState } from 'react';
import './YouTubeTranscriber.css';

interface YouTubeTranscriberProps {
  onTranscribe: (url: string) => void;
  isLoading: boolean;
}

export function YouTubeTranscriber({ onTranscribe, isLoading }: YouTubeTranscriberProps) {
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);

  /** Basic YouTube URL pattern check */
  const isValidYouTubeUrl = (value: string): boolean => {
    const pattern =
      /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)[\w-]+/;
    return pattern.test(value.trim());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setUrlError(null);

    const trimmed = url.trim();
    if (!trimmed) {
      setUrlError('Please enter a YouTube URL');
      return;
    }

    if (!isValidYouTubeUrl(trimmed)) {
      setUrlError('Please enter a valid YouTube URL (e.g., https://youtube.com/watch?v=...)');
      return;
    }

    onTranscribe(trimmed);
  };

  return (
    <div className="yt-transcriber" id="youtube-transcriber">
      <div className="yt-transcriber__header">
        <div className="yt-transcriber__icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="4" width="20" height="16" rx="4" stroke="currentColor" strokeWidth="1.5" />
            <polygon points="10,8 16,12 10,16" fill="currentColor" />
          </svg>
        </div>
        <div>
          <h3 className="yt-transcriber__title">YouTube Transcription</h3>
          <p className="yt-transcriber__desc">
            Paste a YouTube link to transcribe its audio
          </p>
        </div>
      </div>

      <form className="yt-transcriber__form" onSubmit={handleSubmit}>
        <div className="yt-transcriber__input-group">
          <input
            type="text"
            className={`yt-transcriber__input ${urlError ? 'yt-transcriber__input--error' : ''}`}
            placeholder="https://youtube.com/watch?v=..."
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (urlError) setUrlError(null);
            }}
            disabled={isLoading}
            id="youtube-url-input"
            autoComplete="off"
          />
          {urlError && (
            <span className="yt-transcriber__error-text">{urlError}</span>
          )}
        </div>

        <button
          type="submit"
          className="yt-transcriber__submit"
          disabled={isLoading || !url.trim()}
          id="youtube-transcribe-button"
        >
          {isLoading ? (
            <>
              <span className="yt-transcriber__spinner" />
              Processing...
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
      </form>

      {isLoading && (
        <div className="yt-transcriber__loading-hint">
          <span className="yt-transcriber__loading-dot" />
          Downloading audio & transcribing — this may take a minute...
        </div>
      )}
    </div>
  );
}
