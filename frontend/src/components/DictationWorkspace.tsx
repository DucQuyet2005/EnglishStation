/**
 * DictationWorkspace Component
 * The core dictation practice interface with:
 * - YouTube Player integration for segment playback
 * - Character-by-character typing validation (green/red feedback)
 * - Active word highlighting with glow effect
 * - Shift key to replay segment, Esc to reset input
 * - Show Hint button to reveal the current word
 * - Playback speed control (0.75x, 0.85x, 1.0x)
 * - Auto-advance to next segment on completion
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { getDictationProgress, updateDictationProgress } from '../api';
import type { DictationWorkspaceData, DictationSegment } from '../api';
import './DictationWorkspace.css';

interface DictationWorkspaceProps {
  lessonId: string;
  onBack: () => void;
}

/** Strip punctuation, replace hyphens with spaces, collapse whitespace, lowercase */
function normalizeText(text: string): string {
  return text
    .replace(/-/g, ' ')         // hyphens → spaces
    .replace(/[^\w\s]/g, '')    // remove punctuation
    .replace(/\s+/g, ' ')      // collapse whitespace
    .trim()
    .toLowerCase();
}

/** Build placeholder string: letters → *, spaces stay */
function buildPlaceholder(normalized: string): string {
  return normalized.replace(/[^ ]/g, '*');
}

/** Find the word boundaries in normalized text (start indices of each word) */
function getWordBoundaries(normalized: string): { start: number; end: number }[] {
  const words: { start: number; end: number }[] = [];
  const parts = normalized.split(' ');
  let idx = 0;
  for (const part of parts) {
    words.push({ start: idx, end: idx + part.length - 1 });
    idx += part.length + 1; // +1 for space
  }
  return words;
}

/** Find which word index a character position belongs to */
function getActiveWordIndex(pos: number, boundaries: { start: number; end: number }[]): number {
  for (let i = 0; i < boundaries.length; i++) {
    if (pos >= boundaries[i].start && pos <= boundaries[i].end) return i;
  }
  return boundaries.length - 1;
}

// YouTube IFrame API types
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]+)/);
  return match ? match[1] : null;
}

export function DictationWorkspace({ lessonId, onBack }: DictationWorkspaceProps) {
  const [data, setData] = useState<DictationWorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Segment state
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [hasError, setHasError] = useState(false);
  const [hintedWords, setHintedWords] = useState<Set<number>>(new Set());
  const [shakeKey, setShakeKey] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  // YouTube player
  const [playerReady, setPlayerReady] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const playerRef = useRef<any>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch data
  useEffect(() => {
    setLoading(true);
    getDictationProgress(lessonId)
      .then(d => {
        setData(d);
        setSegmentIndex(d.progress.currentSegmentIndex);
        setIsComplete(d.progress.completed);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [lessonId]);

  // Load YouTube IFrame API
  useEffect(() => {
    if (!data?.transcription.sourceUrl) return;
    const videoId = extractYouTubeId(data.transcription.sourceUrl);
    if (!videoId) return;

    const loadApi = () => {
      if (window.YT && window.YT.Player) {
        createPlayer(videoId);
        return;
      }
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
      window.onYouTubeIframeAPIReady = () => createPlayer(videoId);
    };

    const createPlayer = (id: string) => {
      if (playerRef.current) return;
      playerRef.current = new window.YT.Player('yt-player', {
        height: '240',
        width: '100%',
        videoId: id,
        playerVars: {
          controls: 0,
          disablekb: 1,
          modestbranding: 1,
          rel: 0,
        },
        events: {
          onReady: () => setPlayerReady(true),
          onError: (e: any) => {
            if ([101, 150].includes(e.data)) {
              setError('This video is restricted from embedding. Try a different YouTube link.');
            }
          },
        },
      });
    };

    loadApi();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [data?.transcription.sourceUrl]);

  // Current segment
  const segments = data?.transcription.segments || [];
  const currentSeg: DictationSegment | undefined = segments[segmentIndex];
  const normalizedAnswer = currentSeg ? normalizeText(currentSeg.text) : '';
  const placeholder = buildPlaceholder(normalizedAnswer);
  const wordBoundaries = getWordBoundaries(normalizedAnswer);

  // Play segment audio
  const playSegment = useCallback(() => {
    if (!playerRef.current || !currentSeg || !playerReady) return;
    const player = playerRef.current;
    player.setPlaybackRate(playbackSpeed);
    player.seekTo(currentSeg.start, true);
    player.playVideo();

    // Monitor to pause at segment end
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      try {
        const currentTime = player.getCurrentTime();
        if (currentTime >= currentSeg.end) {
          player.pauseVideo();
          if (intervalRef.current) clearInterval(intervalRef.current);
        }
      } catch { /* player not ready */ }
    }, 100);
  }, [currentSeg, playerReady, playbackSpeed]);

  // Auto-play segment when segmentIndex changes
  useEffect(() => {
    if (playerReady && currentSeg) {
      const timer = setTimeout(() => playSegment(), 300);
      return () => clearTimeout(timer);
    }
  }, [segmentIndex, playerReady]);

  // Focus input on segment change
  useEffect(() => {
    inputRef.current?.focus();
  }, [segmentIndex, loading]);

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isComplete) return;
      // Shift → replay
      if (e.key === 'Shift' && !e.repeat) {
        e.preventDefault();
        playSegment();
        return;
      }
      // Esc → reset input
      if (e.key === 'Escape') {
        e.preventDefault();
        setUserInput('');
        setHasError(false);
        setHintedWords(new Set());
        inputRef.current?.focus();
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playSegment, isComplete]);

  // Handle typing
  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (hasError || isComplete || !currentSeg) return;

    const value = e.target.value.toLowerCase();
    const expected = normalizedAnswer;

    // Check each character
    for (let i = 0; i < value.length; i++) {
      if (i >= expected.length || value[i] !== expected[i]) {
        // Wrong character
        setHasError(true);
        setShakeKey(prev => prev + 1);
        setUserInput(value.slice(0, i + 1)); // Keep up to the error character

        // Track incorrect attempt
        updateDictationProgress({
          transcriptionId: lessonId,
          incorrectAttempt: true,
        }).catch(() => {});
        return;
      }
    }

    setUserInput(value);
    setHasError(false);

    // Check completion
    if (value === expected) {
      handleSegmentComplete();
    }
  };

  // Handle backspace on error
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && hasError) {
      setHasError(false);
      setUserInput(prev => prev.slice(0, -1));
      e.preventDefault();
    }
  };

  // Segment complete → advance
  const handleSegmentComplete = async () => {
    const nextIndex = segmentIndex + 1;
    const totalComplete = nextIndex >= segments.length;

    try {
      await updateDictationProgress({
        transcriptionId: lessonId,
        currentSegmentIndex: nextIndex,
      });
    } catch { /* ignore */ }

    if (totalComplete) {
      setIsComplete(true);
    } else {
      // Brief delay to show completion, then advance
      setTimeout(() => {
        setSegmentIndex(nextIndex);
        setUserInput('');
        setHasError(false);
        setHintedWords(new Set());
      }, 600);
    }
  };

  // Show Hint
  const handleHint = async () => {
    if (!currentSeg || isComplete) return;

    const matchedLen = userInput.length;
    const activeWordIdx = getActiveWordIndex(
      Math.min(matchedLen, normalizedAnswer.length - 1),
      wordBoundaries
    );
    setHintedWords(prev => new Set(prev).add(activeWordIdx));

    try {
      await updateDictationProgress({
        transcriptionId: lessonId,
        hintsUsed: true,
      });
    } catch { /* ignore */ }
  };

  // Speed control
  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (playerRef.current && playerReady) {
      playerRef.current.setPlaybackRate(speed);
    }
  };

  // Build display characters
  const buildDisplayChars = () => {
    const chars: { char: string; state: 'correct' | 'error' | 'hint' | 'active' | 'pending'; isSpace: boolean }[] = [];

    for (let i = 0; i < normalizedAnswer.length; i++) {
      const isSpace = normalizedAnswer[i] === ' ';
      const actualChar = normalizedAnswer[i];

      if (i < userInput.length) {
        if (hasError && i === userInput.length - 1) {
          chars.push({ char: userInput[i], state: 'error', isSpace });
        } else {
          chars.push({ char: actualChar, state: 'correct', isSpace });
        }
      } else {
        // Check if this char belongs to a hinted word
        const wordIdx = getActiveWordIndex(i, wordBoundaries);
        if (hintedWords.has(wordIdx)) {
          chars.push({ char: actualChar, state: 'hint', isSpace });
        } else if (i === userInput.length) {
          chars.push({ char: placeholder[i], state: 'active', isSpace });
        } else {
          chars.push({ char: placeholder[i], state: 'pending', isSpace });
        }
      }
    }
    return chars;
  };

  // ---- RENDER ----

  if (loading) {
    return (
      <div className="dw" id="dictation-workspace">
        <div className="dw__loading">
          <span className="dw__spinner" />
          <p>Preparing your lesson…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dw" id="dictation-workspace">
        <div className="dw__error-container">
          <div className="dw__error-msg">{error}</div>
          <button className="dw__btn dw__btn--back" onClick={onBack}>← Go Back</button>
        </div>
      </div>
    );
  }

  if (!data || segments.length === 0) {
    return (
      <div className="dw" id="dictation-workspace">
        <div className="dw__error-container">
          <p>No segments found for this lesson.</p>
          <button className="dw__btn dw__btn--back" onClick={onBack}>← Go Back</button>
        </div>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="dw" id="dictation-workspace">
        <div className="dw__complete">
          <div className="dw__complete-icon">🎉</div>
          <h2 className="dw__complete-title">Lesson Complete!</h2>
          <p className="dw__complete-subtitle">{data.transcription.title}</p>
          <p className="dw__complete-stats">
            {segments.length} segments completed
          </p>
          <button className="dw__btn dw__btn--back" onClick={onBack}>← Back to Lessons</button>
        </div>
      </div>
    );
  }

  const displayChars = buildDisplayChars();
  const progressPct = Math.round((segmentIndex / segments.length) * 100);

  return (
    <div className="dw" id="dictation-workspace">
      {/* Top bar */}
      <div className="dw__topbar">
        <button className="dw__back-btn" onClick={onBack}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="dw__topbar-info">
          <h2 className="dw__title">{data.transcription.title}</h2>
          <div className="dw__progress-info">
            Segment {segmentIndex + 1} / {segments.length} ({progressPct}%)
          </div>
        </div>
        <div className="dw__topbar-actions">
          {/* Speed control */}
          <div className="dw__speed-group">
            {[0.75, 0.85, 1.0].map(speed => (
              <button
                key={speed}
                className={`dw__speed-btn ${playbackSpeed === speed ? 'dw__speed-btn--active' : ''}`}
                onClick={() => handleSpeedChange(speed)}
              >
                {speed}x
              </button>
            ))}
          </div>
          {/* Toggle video */}
          {data.transcription.sourceUrl && (
            <button
              className="dw__toggle-video"
              onClick={() => setShowVideo(prev => !prev)}
              title={showVideo ? 'Hide video' : 'Show video'}
            >
              {showVideo ? '📺' : '📺'}
              <span className="dw__toggle-label">{showVideo ? 'Hide' : 'Show'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Overall progress bar */}
      <div className="dw__progress-bar">
        <div className="dw__progress-fill" style={{ width: `${progressPct}%` }} />
      </div>

      {/* YouTube Player */}
      {data.transcription.sourceUrl && (
        <div
          className={`dw__player-container ${showVideo ? 'dw__player-container--visible' : ''}`}
          ref={playerContainerRef}
        >
          <div id="yt-player" />
        </div>
      )}

      {/* Segment display area */}
      <div className="dw__segment">
        <div className="dw__segment-header">
          <span className="dw__segment-label">Segment {segmentIndex + 1}</span>
          <button
            className="dw__hint-btn"
            onClick={handleHint}
            title="Reveal the current word"
          >
            💡 Show Hint
          </button>
        </div>

        {/* Character display */}
        <div className={`dw__chars ${hasError ? 'dw__chars--shake' : ''}`} key={shakeKey}>
          {displayChars.map((ch, i) => {
            // Check if this char's word is the active word
            const activeWordIdx = getActiveWordIndex(
              Math.min(userInput.length, normalizedAnswer.length - 1),
              wordBoundaries
            );
            const charWordIdx = getActiveWordIndex(i, wordBoundaries);
            const isActiveWord = charWordIdx === activeWordIdx && ch.state !== 'correct';

            return (
              <span
                key={i}
                className={`dw__char dw__char--${ch.state} ${ch.isSpace ? 'dw__char--space' : ''} ${isActiveWord ? 'dw__char--active-word' : ''}`}
              >
                {ch.isSpace ? '\u00A0' : ch.char}
              </span>
            );
          })}
        </div>

        {/* Hidden input for typing */}
        <input
          ref={inputRef}
          className="dw__input"
          value={userInput}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Start typing what you hear…"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          id="dictation-input"
        />
      </div>

      {/* Hotkey hints */}
      <div className="dw__hotkeys">
        <span className="dw__hotkey">
          <kbd>Shift</kbd> Replay
        </span>
        <span className="dw__hotkey">
          <kbd>Esc</kbd> Reset
        </span>
      </div>
    </div>
  );
}
