/**
 * Transcription Routes
 * Defines API endpoints for audio transcription.
 *
 * Route structure:
 * POST /api/transcribe - Upload audio and get transcription
 * GET  /api/health     - Health check
 */
import { Router, Request, Response, NextFunction } from 'express';
import { uploadAudio, validateAudioUpload } from '../middlewares';
import * as transcriptionController from '../controllers/transcription.controller';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import type { JwtPayload } from '../middlewares/auth.middleware';

const router = Router();

/**
 * Optional auth — attaches user info if token is present,
 * but does not reject unauthenticated requests.
 */
const optionalAuth = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.slice(7), config.jwtSecret) as JwtPayload;
      req.user = decoded;
    } catch { /* ignore invalid token */ }
  }
  next();
};

/**
 * POST /api/transcribe
 *
 * Middleware chain:
 * 1. optionalAuth    → Attach user if logged in (for saving to DB)
 * 2. uploadAudio     → Multer saves file to disk, validates MIME type
 * 3. validateAudioUpload → Secondary validation (extension, size)
 * 4. transcribeAudio → Controller sends to Whisper and returns result
 */
router.post(
  '/transcribe',
  optionalAuth,
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
router.post('/youtube-transcribe', optionalAuth, transcriptionController.youtubeTranscribe);

export default router;
