/**
 * Whisper Service Client
 * Handles communication between Express backend and Python Whisper service.
 *
 * Flow:
 * 1. Receives the uploaded audio file path from the controller
 * 2. Creates a FormData with the audio file
 * 3. Sends POST request to Python FastAPI /transcribe endpoint
 * 4. Returns the transcription result
 * 5. Cleans up temporary audio file
 *
 * This is the ONLY place that communicates with the Whisper service.
 */
import axios, { AxiosError } from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { AppError } from '../utils/AppError';
import { Logger } from '../utils/logger';
import type { WhisperTranscriptionResult, TranscriptionResponse } from '../types';
import { v4 as uuidv4 } from 'uuid';

const log = new Logger('WhisperService');

// Axios instance with timeout and base URL for Whisper service
const whisperClient = axios.create({
  baseURL: config.whisperServiceUrl,
  timeout: 120_000, // 2 minutes timeout for large audio files
  maxContentLength: Infinity,
  maxBodyLength: Infinity,
});

/**
 * Send audio file to Whisper service for transcription
 * and return formatted result.
 */
export async function transcribeAudio(
  filePath: string,
  originalName: string,
): Promise<TranscriptionResponse> {
  log.info(`Starting transcription for: ${originalName}`);

  // Verify file exists before sending
  if (!fs.existsSync(filePath)) {
    throw AppError.badRequest('Audio file not found on server');
  }

  try {
    // Build multipart form data with the audio file
    const form = new FormData();
    form.append('file', fs.createReadStream(filePath), {
      filename: originalName,
      contentType: getMimeType(filePath),
    });

    // Send to Python Whisper service
    log.info(`Sending audio to Whisper service: ${config.whisperServiceUrl}/transcribe`);

    const response = await whisperClient.post<WhisperTranscriptionResult>(
      '/transcribe',
      form,
      {
        headers: {
          ...form.getHeaders(),
        },
      },
    );

    const result = response.data;
    log.info(`Transcription completed. Language: ${result.language}, Duration: ${result.duration}s`);

    // Map Whisper response to our frontend-friendly format
    const transcription: TranscriptionResponse = {
      id: uuidv4(),
      transcript: result.text.trim(),
      language: result.language,
      confidence: result.language_probability,
      duration: result.duration,
      segments: result.segments.map((seg) => ({
        id: seg.id,
        start: seg.start,
        end: seg.end,
        text: seg.text.trim(),
      })),
      createdAt: new Date().toISOString(),
    };

    return transcription;
  } catch (error) {
    handleWhisperError(error);
    throw error; // TypeScript needs this, but handleWhisperError always throws
  } finally {
    // Always clean up the temporary uploaded file
    cleanupFile(filePath);
  }
}

/**
 * Check if the Whisper service is healthy and responding
 */
export async function checkWhisperHealth(): Promise<boolean> {
  try {
    const response = await whisperClient.get('/health', { timeout: 5000 });
    return response.status === 200;
  } catch {
    return false;
  }
}

/**
 * Handle errors from the Whisper service with descriptive messages
 */
function handleWhisperError(error: unknown): never {
  if (error instanceof AxiosError) {
    if (error.code === 'ECONNREFUSED') {
      log.error('Whisper service is not running or unreachable');
      throw AppError.serviceUnavailable(
        'Speech recognition service is not available. Please try again later.',
      );
    }

    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      log.error('Whisper service timed out');
      throw AppError.serviceUnavailable(
        'Speech recognition took too long. Try a shorter audio clip.',
      );
    }

    if (error.response) {
      const status = error.response.status;
      const data = error.response.data as any;

      log.error(`Whisper service error [${status}]:`, data);

      if (status === 422) {
        throw AppError.badRequest(
          data?.detail || 'Invalid audio file. Please record again.',
        );
      }

      throw AppError.transcriptionFailed(
        data?.detail || 'Speech recognition failed. Please try again.',
      );
    }
  }

  log.error('Unexpected Whisper service error:', error);
  throw AppError.transcriptionFailed(
    'An unexpected error occurred during speech recognition.',
  );
}

/**
 * Delete temporary uploaded file
 */
function cleanupFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      log.debug(`Cleaned up temp file: ${path.basename(filePath)}`);
    }
  } catch (err) {
    log.warn(`Failed to cleanup temp file: ${filePath}`, err);
  }
}

/**
 * Get MIME type from file extension
 */
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.webm': 'audio/webm',
    '.flac': 'audio/flac',
    '.m4a': 'audio/x-m4a',
    '.aac': 'audio/aac',
    '.mp4': 'audio/mp4',
  };
  return mimeMap[ext] || 'application/octet-stream';
}

/**
 * Send YouTube URL to Whisper service for transcription.
 * The Whisper service handles downloading audio from YouTube via yt-dlp.
 */
export async function transcribeYouTube(
  url: string,
): Promise<TranscriptionResponse> {
  log.info(`Starting YouTube transcription for: ${url}`);

  try {
    const response = await whisperClient.post<WhisperTranscriptionResult & { youtube?: YouTubeMetadata }>(
      '/transcribe_youtube',
      { url },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 300_000, // 5 minutes — YouTube download + transcription
      },
    );

    const result = response.data;
    log.info(`YouTube transcription completed. Language: ${result.language}, Duration: ${result.duration}s`);

    const transcription: TranscriptionResponse = {
      id: uuidv4(),
      transcript: result.text.trim(),
      language: result.language,
      confidence: result.language_probability,
      duration: result.duration,
      segments: result.segments.map((seg) => ({
        id: seg.id,
        start: seg.start,
        end: seg.end,
        text: seg.text.trim(),
      })),
      createdAt: new Date().toISOString(),
      youtube: result.youtube,
    };

    return transcription;
  } catch (error) {
    handleWhisperError(error);
    throw error;
  }
}
