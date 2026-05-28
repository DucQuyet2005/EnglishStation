/**
 * Frontend Type Definitions
 * Mirrors backend API response types for type safety.
 */

/** Standard API success response wrapper */
export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
  timestamp: string;
}

/** Standard API error response wrapper */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
}

/** Transcription result from the API */
export interface TranscriptionResult {
  id: string;
  transcript: string;
  language: string;
  confidence: number;
  duration: number;
  segments: TranscriptionSegment[];
  createdAt: string;
  youtube?: YouTubeMetadata;
}

/** YouTube video metadata (present only for YouTube transcriptions) */
export interface YouTubeMetadata {
  title: string;
  uploader: string;
  video_duration: number;
  url: string;
}

/** Individual timed segment of transcription */
export interface TranscriptionSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

/** Health check response */
export interface HealthStatus {
  status: string;
  service: string;
  whisperService: string;
  timestamp: string;
}

/** Recording state for the audio recorder */
export type RecordingState = 'idle' | 'recording' | 'uploading' | 'processing';
