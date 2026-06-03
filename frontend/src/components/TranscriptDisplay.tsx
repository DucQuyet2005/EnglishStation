/**
 * Transcript Display Component
 * Shows the transcription result with:
 * - Full transcript text
 * - Language and confidence info
 * - Timed segments
 * - Copy to clipboard
 */
import { useState } from 'react';
import type { TranscriptionResult } from '../types';
import './TranscriptDisplay.css';

interface TranscriptDisplayProps {
  result: TranscriptionResult;
  onNewRecording: () => void;
}

export function TranscriptDisplay({ result, onNewRecording }: TranscriptDisplayProps) {
  const [copied, setCopied] = useState(false);
  const [showSegments, setShowSegments] = useState(false);

  /** Copy transcript text to clipboard */
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result.transcript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = result.transcript;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  /** Format seconds to MM:SS.ms */
  const formatTimestamp = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="transcript" id="transcript-display">
      {/* YouTube Video Info (if transcribed from YouTube) */}
      {result.youtube && (
        <div className="transcript__youtube-info">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="transcript__youtube-icon">
            <rect x="2" y="4" width="20" height="16" rx="4" stroke="currentColor" strokeWidth="1.5" />
            <polygon points="10,8 16,12 10,16" fill="currentColor" />
          </svg>
          <div className="transcript__youtube-details">
            <a
              href={result.youtube.url}
              target="_blank"
              rel="noopener noreferrer"
              className="transcript__youtube-title"
            >
              {result.youtube.title}
            </a>
            <span className="transcript__youtube-uploader">
              {result.youtube.uploader}
            </span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="transcript__header">
        <div className="transcript__header-left">
          <h2 className="transcript__title">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            Transcription
          </h2>
        </div>

        <button
          className={`transcript__copy-btn ${copied ? 'transcript__copy-btn--copied' : ''}`}
          onClick={handleCopy}
          id="copy-button"
          aria-label="Copy to clipboard"
        >
          {copied ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>

      {/* Main Transcript Text */}
      <div className="transcript__text-container" id="transcript-text">
        <p className="transcript__text">{result.transcript}</p>
        {result.translatedTranscript && (
          <p className="transcript__translated-text">{result.translatedTranscript}</p>
        )}
      </div>

      {/* Metadata */}
      <div className="transcript__meta" id="transcript-meta">
        <div className="transcript__meta-item">
          <span className="transcript__meta-label">Language</span>
          <span className="transcript__meta-value">{result.language.toUpperCase()}</span>
        </div>
        <div className="transcript__meta-item">
          <span className="transcript__meta-label">Confidence</span>
          <span className="transcript__meta-value">{(result.confidence * 100).toFixed(1)}%</span>
        </div>
        <div className="transcript__meta-item">
          <span className="transcript__meta-label">Duration</span>
          <span className="transcript__meta-value">{result.duration.toFixed(1)}s</span>
        </div>
        <div className="transcript__meta-item">
          <span className="transcript__meta-label">Segments</span>
          <span className="transcript__meta-value">{result.segments.length}</span>
        </div>
      </div>

      {/* Segments Toggle */}
      {result.segments.length > 0 && (
        <div className="transcript__segments-section">
          <button
            className="transcript__segments-toggle"
            onClick={() => setShowSegments(!showSegments)}
            id="toggle-segments-button"
          >
            <svg
              width="16" height="16"
              viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className={`transcript__segments-chevron ${showSegments ? 'transcript__segments-chevron--open' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
            {showSegments ? 'Hide' : 'Show'} Timed Segments
          </button>

          {showSegments && (
            <div className="transcript__segments" id="transcript-segments">
              {result.segments.map((segment) => (
                <div key={segment.id} className="transcript__segment">
                  <span className="transcript__segment-time">
                    {formatTimestamp(segment.start)} - {formatTimestamp(segment.end)}
                  </span>
                  <div className="transcript__segment-content">
                    <span className="transcript__segment-text">{segment.text}</span>
                    {segment.translatedText && (
                      <span className="transcript__segment-translated-text">
                        {segment.translatedText}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* New Recording Button */}
      <button
        className="transcript__new-btn"
        onClick={onNewRecording}
        id="new-recording-button"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="22" />
        </svg>
        New Recording
      </button>
    </div>
  );
}
