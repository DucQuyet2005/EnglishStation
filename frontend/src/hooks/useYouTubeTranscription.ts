/**
 * YouTube Transcription Hook
 * Manages the YouTube transcription workflow:
 * 1. Takes a YouTube URL
 * 2. Sends it to the backend
 * 3. Receives and stores the transcription result
 * 4. Tracks loading and error states
 */
import { useState, useCallback } from 'react';
import { transcribeYouTube } from '../api';
import type { TranscriptionResult } from '../types';

interface UseYouTubeTranscriptionReturn {
  /** The transcription result */
  result: TranscriptionResult | null;
  /** Whether transcription is in progress */
  isLoading: boolean;
  /** Error message if transcription failed */
  error: string | null;
  /** Send YouTube URL for transcription */
  transcribe: (url: string, targetLang?: string) => Promise<void>;
  /** Clear the current result */
  clearResult: () => void;
}

export function useYouTubeTranscription(): UseYouTubeTranscriptionReturn {
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const transcribe = useCallback(async (url: string, targetLang?: string) => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const result = await transcribeYouTube(url, targetLang);
      setResult(result);
    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : 'Failed to transcribe YouTube video. Please try again.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearResult = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return {
    result,
    isLoading,
    error,
    transcribe,
    clearResult,
  };
}
