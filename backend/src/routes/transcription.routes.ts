/**
 * Transcription Routes
 * Defines API endpoints for audio transcription.
 *
 * Route structure:
 * POST /api/transcribe - Upload audio and get transcription
 * GET  /api/health     - Health check
 */
import { Router } from 'express';
import { uploadAudio, validateAudioUpload } from '../middlewares';
import * as transcriptionController from '../controllers/transcription.controller';

const router = Router();

/**
 * POST /api/transcribe
 *
 * Middleware chain:
 * 1. uploadAudio     → Multer saves file to disk, validates MIME type
 * 2. validateAudioUpload → Secondary validation (extension, size)
 * 3. transcribeAudio → Controller sends to Whisper and returns result
 */
router.post(
  '/transcribe',
  uploadAudio,
  validateAudioUpload,
  transcriptionController.transcribeAudio,
);

/**
 * GET /api/health
 * Returns service status and Whisper service connectivity.
 */
router.get('/health', transcriptionController.healthCheck);

/**
 * POST /api/youtube-transcribe
 *
 * No file upload middleware needed — accepts JSON body with YouTube URL.
 * The Whisper service handles downloading audio from YouTube via yt-dlp.
 */
router.post('/youtube-transcribe', transcriptionController.youtubeTranscribe);

export default router;
