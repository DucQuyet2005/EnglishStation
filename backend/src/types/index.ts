/**
 * Application Type Definitions
 * Shared types used across the backend application.
 */

// ---- API Response Types ----

/** Standard API success response */
export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
  timestamp: string;
}

/** Standard API error response */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
}

// ---- Whisper Service Types ----

/** Response from the Whisper transcription service */
export interface WhisperTranscriptionResult {
  text: string;
  language: string;
  language_probability: number;
  duration: number;
  segments: WhisperSegment[];
}

/** Individual transcription segment with timing */
export interface WhisperSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  avg_logprob: number;
  no_speech_prob: number;
}

// ---- Transcription Types ----

/** Transcription result returned to frontend */
export interface TranscriptionResponse {
  id: string;
  transcript: string;
  language: string;
  confidence: number;
  duration: number;
  segments: TranscriptionSegment[];
  createdAt: string;
  youtube?: YouTubeMetadata;
}

/** YouTube video metadata attached to YouTube transcriptions */
export interface YouTubeMetadata {
  title: string;
  uploader: string;
  video_duration: number;
  url: string;
}

/** Simplified segment for frontend consumption */
export interface TranscriptionSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

// ---- Upload Types ----

/** File upload metadata */
export interface UploadedFileInfo {
  originalName: string;
  filename: string;
  mimeType: string;
  size: number;
  path: string;
}

// ---- Express Extensions ----

import { Request } from 'express';

/** Extended Request with typed file */
export interface MulterRequest extends Request {
  file?: Express.Multer.File;
}
