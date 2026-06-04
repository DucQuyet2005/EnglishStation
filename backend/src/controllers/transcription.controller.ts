/**
 * Transcription Controller
 * Handles HTTP request/response logic for audio transcription.
 *
 * Controller responsibilities:
 * - Extract data from request
 * - Call service layer
 * - Format and send response
 * - Does NOT contain business logic
 */
import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/responseHelper';
import { AppError } from '../utils/AppError';
import * as whisperService from '../services/whisper.service';
import { Logger } from '../utils/logger';

const log = new Logger('TranscriptionController');

/**
 * POST /api/transcribe
 * Accepts an audio file upload and returns the transcription.
 *
 * Flow:
 * 1. Multer middleware saves file to disk (already done before this handler)
 * 2. Validation middleware checks file validity (already done)
 * 3. This controller sends file to Whisper service
 * 4. Returns transcription result to client
 */
export const transcribeAudio = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const file = req.file;
    const { targetLang } = req.body;

    if (!file) {
      throw AppError.badRequest('No audio file provided');
    }

    log.info(`Processing transcription request: ${file.originalname} (${(file.size / 1024).toFixed(1)}KB), targetLang: ${targetLang || 'none'}`);

    // Delegate to whisper service
    const result = await whisperService.transcribeAudio(
      file.path,
      file.originalname,
      targetLang,
      req.user?.userId,
    );

    log.info(`Transcription successful: "${result.transcript.substring(0, 50)}..."`);

    sendSuccess(res, result, 'Transcription completed successfully');
  },
);

/**
 * GET /api/health
 * Health check endpoint that also verifies Whisper service connectivity.
 */
export const healthCheck = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    const whisperHealthy = await whisperService.checkWhisperHealth();

    sendSuccess(res, {
      status: 'ok',
      service: 'english-station-backend',
      whisperService: whisperHealthy ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    });
  },
);

/**
 * POST /api/youtube-transcribe
 * Accepts a YouTube URL and returns the transcription.
 *
 * Flow:
 * 1. Validate URL format (must be a YouTube link)
 * 2. Forward URL to Whisper service (which downloads audio via yt-dlp)
 * 3. Return transcription result to client
 */
export const youtubeTranscribe = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { url, targetLang } = req.body;

    if (!url || typeof url !== 'string') {
      throw AppError.badRequest('YouTube URL is required');
    }

    // Basic YouTube URL validation
    const youtubeUrlPattern =
      /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)[\w-]+/;

    if (!youtubeUrlPattern.test(url.trim())) {
      throw AppError.badRequest(
        'Invalid YouTube URL. Please provide a valid YouTube video link.',
      );
    }

    log.info(`Processing YouTube transcription request: ${url}, targetLang: ${targetLang || 'none'}`);

    // Delegate to whisper service
    const result = await whisperService.transcribeYouTube(url.trim(), targetLang, req.user?.userId);

    log.info(
      `YouTube transcription successful: "${result.transcript.substring(0, 50)}..."`,
    );

    sendSuccess(res, result, 'YouTube transcription completed successfully');
  },
);
