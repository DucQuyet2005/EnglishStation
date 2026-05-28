/**
 * Audio Recorder Hook
 * Custom React hook that encapsulates all audio recording logic.
 *
 * Uses the Web Audio API (MediaRecorder) to:
 * 1. Request microphone permission
 * 2. Record audio from the user's microphone
 * 3. Return the recorded audio as a Blob
 * 4. Track recording state and duration
 *
 * Browser Compatibility:
 * - MediaRecorder API is supported in all modern browsers
 * - Uses webm/opus codec (best browser support)
 * - Falls back gracefully if microphone is denied
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import type { RecordingState } from '../types';

interface UseAudioRecorderReturn {
  /** Current recording state */
  state: RecordingState;
  /** Recording duration in seconds */
  duration: number;
  /** Whether the browser supports audio recording */
  isSupported: boolean;
  /** The recorded audio blob (available after stopping) */
  audioBlob: Blob | null;
  /** Audio URL for playback (available after stopping) */
  audioUrl: string | null;
  /** Start recording from microphone */
  startRecording: () => Promise<void>;
  /** Stop recording and produce the audio blob */
  stopRecording: () => void;
  /** Reset state to allow a new recording */
  resetRecording: () => void;
  /** Error message if something went wrong */
  error: string | null;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [state, setState] = useState<RecordingState>('idle');
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // Check browser support
  const isSupported = typeof navigator !== 'undefined'
    && !!navigator.mediaDevices
    && !!navigator.mediaDevices.getUserMedia
    && typeof MediaRecorder !== 'undefined';

  /**
   * Get the best supported MIME type for recording.
   * Prefer webm/opus for smallest file size with good quality.
   */
  const getSupportedMimeType = (): string => {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return ''; // Browser default
  };

  /**
   * Start recording audio from the microphone.
   * Requests permission if not already granted.
   */
  const startRecording = useCallback(async () => {
    if (!isSupported) {
      setError('Audio recording is not supported in this browser');
      return;
    }

    try {
      setError(null);
      setAudioBlob(null);
      setAudioUrl(null);
      chunksRef.current = [];

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1, // Mono for speech (smaller file, better for STT)
          sampleRate: 16000, // 16kHz is optimal for Whisper
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      // Create MediaRecorder with best available codec
      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, {
        ...(mimeType && { mimeType }),
        audioBitsPerSecond: 128000, // 128kbps for good quality speech
      });

      mediaRecorderRef.current = recorder;

      // Collect audio chunks as they become available
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      // When recording stops, create the final blob
      recorder.onstop = () => {
        const mimeTypeUsed = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeTypeUsed });
        setAudioBlob(blob);

        // Create URL for audio playback
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        setState('idle');
      };

      // Handle recorder errors
      recorder.onerror = () => {
        setError('Recording failed. Please try again.');
        setState('idle');
        cleanupStream();
      };

      // Start recording — request data every 250ms for smoother chunks
      recorder.start(250);
      setState('recording');
      startTimeRef.current = Date.now();
      setDuration(0);

      // Start duration timer
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';

      if (message.includes('Permission denied') || message.includes('NotAllowedError')) {
        setError('Microphone access denied. Please allow microphone permission in your browser settings.');
      } else if (message.includes('NotFoundError')) {
        setError('No microphone found. Please connect a microphone and try again.');
      } else {
        setError(`Failed to start recording: ${message}`);
      }

      setState('idle');
    }
  }, [isSupported]);

  /**
   * Stop the current recording.
   * The onstop handler will create the blob and update state.
   */
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    // Stop duration timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Stop microphone stream
    cleanupStream();
  }, []);

  /**
   * Reset everything for a new recording.
   */
  const resetRecording = useCallback(() => {
    // Revoke previous audio URL to free memory
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }

    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setError(null);
    setState('idle');
    chunksRef.current = [];
  }, [audioUrl]);

  /**
   * Clean up the media stream (stop microphone).
   */
  const cleanupStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupStream();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  return {
    state,
    duration,
    isSupported,
    audioBlob,
    audioUrl,
    startRecording,
    stopRecording,
    resetRecording,
    error,
  };
}
