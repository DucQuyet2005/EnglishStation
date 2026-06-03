/**
 * Transcription Hook
 * Manages the transcription workflow:
 * 1. Takes an audio blob
 * 2. Uploads it to the backend
 * 3. Receives and stores the transcription result
 * 4. Tracks loading, progress, and error states
 */
import { useState, useCallback } from 'react';
import { transcribeAudio } from '../api';
import type { TranscriptionResult } from '../types';

interface UseTranscriptionReturn {
  /** The transcription result */
  result: TranscriptionResult | null;
  /** Whether transcription is in progress */
  isLoading: boolean;
  /** Upload progress percentage (0-100) */
  uploadProgress: number;
  /** Error message if transcription failed */
  error: string | null;
  /** Send audio blob for transcription */
  transcribe: (blob: Blob, targetLang?: string) => Promise<void>;
  /** Clear the current result */
  clearResult: () => void;
}

export function useTranscription(): UseTranscriptionReturn {
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const transcribe = useCallback(async (blob: Blob, targetLang?: string) => {
    setIsLoading(true);
    setError(null);
    setUploadProgress(0);
    setResult(null);

    try {
      // Determine file extension from blob type
      const ext = blob.type.includes('webm') ? 'webm'
        : blob.type.includes('ogg') ? 'ogg'
        : blob.type.includes('mp4') ? 'mp4'
        : 'wav';

      const result = await transcribeAudio(
        blob,
        `recording.${ext}`,
        targetLang,
        (progress) => setUploadProgress(progress),
      );

      setResult(result);
    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : 'Failed to transcribe audio. Please try again.';
      setError(message);
    } finally {
      setIsLoading(false);
      setUploadProgress(0);
    }
  }, []);

  const clearResult = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return {
    result,
    isLoading,
    uploadProgress,
    error,
    transcribe,
    clearResult,
  };
}
